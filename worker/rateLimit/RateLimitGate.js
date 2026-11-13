import { consumeRateLimit } from '../secureCompare.js';
import { applyRateLimitHit } from './rateLimitCore.js';

const STORAGE_PREFIX = 'rl:';

/** Buckets where DO failure must deny the request (no silent memory bypass). */
export const FAIL_CLOSED_BUCKETS = new Set(['host-secret', 'admin-auth']);

/**
 * Company-wide rate-limit counters (one DO: name "global").
 * Each counter is stored under its own key — no full-map rewrite.
 */
export class RateLimitGate {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    // Drop legacy blob map from earlier versions (best-effort, once per isolate wake).
    this.ctx.storage.delete('buckets').catch(() => {});
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
      const storageKey = `${STORAGE_PREFIX}${key}`;
      const prev = (await this.ctx.storage.get(storageKey)) || null;
      const hit = applyRateLimitHit(prev, now, { limit, windowMs });

      if (hit.ok) {
        await this.ctx.storage.put(storageKey, hit.entry);
      }
      // Blocked: leave stored entry unchanged (no write amplification).

      if (!hit.ok) {
        return Response.json({ ok: false, retryAfterMs: hit.retryAfterMs ?? 0 });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}

/**
 * Prefer Durable Object when bound; memory only when binding is absent (local/dev).
 * @param {object} env
 * @param {string} key  full bucket key, e.g. "host-secret:1.2.3.4"
 * @param {{ limit?: number, windowMs?: number, failClosed?: boolean }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterMs: number, unavailable?: boolean }>}
 */
export async function consumeRateLimitEnv(env, key, opts = {}) {
  const windowMs = opts.windowMs ?? 60_000;
  const failClosed = opts.failClosed === true;

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
          windowMs,
        }),
      }));
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.ok === 'boolean') return data;
      }
      console.error('[rate-limit] DO returned non-OK', res.status);
      if (failClosed) {
        return { ok: false, retryAfterMs: windowMs, unavailable: true };
      }
    } catch (err) {
      console.error('[rate-limit] DO failed', err);
      if (failClosed) {
        return { ok: false, retryAfterMs: windowMs, unavailable: true };
      }
    }
    // Soft buckets: fall through to isolate memory so reads/polls keep working.
  }

  return consumeRateLimit(key, opts);
}

/** Infer failClosed from bucket name prefix (before first ':'). */
export function failClosedForKey(key) {
  const bucket = String(key || '').split(':')[0];
  return FAIL_CLOSED_BUCKETS.has(bucket);
}
