import { consumeRateLimit } from '../secureCompare.js';
import { applyRateLimitHit, pruneRateLimitMap } from './rateLimitCore.js';

/**
 * Company-wide rate-limit counters (one DO: name "global").
 * Survives across Worker isolates — unlike the in-memory Map fallback.
 */
export class RateLimitGate {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async loadMap() {
    return (await this.ctx.storage.get('buckets')) || {};
  }

  async saveMap(map) {
    await this.ctx.storage.put('buckets', map);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'POST' && url.pathname.endsWith('/consume')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const key = String(body?.key || '').trim();
      if (!key) return Response.json({ error: 'missing-key' }, { status: 400 });

      const limit = body?.limit;
      const windowMs = body?.windowMs ?? 60_000;
      const now = Date.now();
      let map = await this.loadMap();
      map = pruneRateLimitMap(map, now, Math.max(60_000, Number(windowMs) || 60_000));
      const hit = applyRateLimitHit(map[key], now, { limit, windowMs });
      map[key] = hit.entry;
      await this.saveMap(map);

      if (!hit.ok) {
        return Response.json({ ok: false, retryAfterMs: hit.retryAfterMs ?? 0 });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}

/**
 * Prefer Durable Object when bound; otherwise process-local Map.
 * @param {object} env
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 */
export async function consumeRateLimitEnv(env, key, opts = {}) {
  if (env?.RATE_LIMIT) {
    try {
      const id = env.RATE_LIMIT.idFromName('global');
      const stub = env.RATE_LIMIT.get(id);
      const res = await stub.fetch(new Request('https://rate-limit/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          limit: opts.limit,
          windowMs: opts.windowMs,
        }),
      }));
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.ok === 'boolean') return data;
      }
    } catch (err) {
      console.error('[rate-limit] DO failed, falling back to memory', err);
    }
  }
  return consumeRateLimit(key, opts);
}
