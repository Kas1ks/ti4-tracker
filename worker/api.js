import {
  adminPinMatches,
  getCloudBin,
  isJsonBinConfigured,
  makeSaveCode,
  resolveAdminPin,
  resolveBinId,
  resolveMasterKey,
  withCloudBinLock,
} from './jsonbin.js';
import { handleRoomsApi } from './rooms/roomsApi.js';
import { assertRoomCreateAllowed, resolveRoomCreateSecret } from './rooms/roomCreateAuth.js';
import { clientKey, consumeRateLimit } from './secureCompare.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function rateLimited(request, bucket, opts) {
  const key = `${bucket}:${clientKey(request)}`;
  const result = consumeRateLimit(key, opts);
  if (!result.ok) {
    return json(
      { error: 'rate-limited', retryAfterMs: result.retryAfterMs },
      429,
      { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) },
    );
  }
  return null;
}

function assertCloudWrite(env, body) {
  return assertRoomCreateAllowed(env, body?.createSecret ?? body?.writeToken ?? '');
}

/** Strip auth fields from a flat game-record POST body. */
function extractGameRecord(body) {
  if (body?.record && typeof body.record === 'object' && !Array.isArray(body.record)) {
    return body.record;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { createSecret: _c, writeToken: _w, record: _r, ...rest } = body;
  return Object.keys(rest).length ? rest : null;
}

/**
 * Shared API handler for Cloudflare Worker and Vite dev middleware.
 * @param {Request} request
 * @param {object} env
 */
export async function handleApi(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (method === 'GET' && pathname === '/api/health') {
    return json({
      ok: true,
      cloudConfigured: isJsonBinConfigured(env),
      rooms: Boolean(env?.GAME_ROOMS) ? 'durable-object' : 'memory',
      hasBinId: Boolean(resolveBinId(env)),
      hasMasterKey: Boolean(resolveMasterKey(env)),
      hasAdminPin: Boolean(resolveAdminPin(env)),
      hasRoomCreateSecret: Boolean(resolveRoomCreateSecret(env)),
      roomCreateSecretKeys: {
        ROOM_CREATE_SECRET: Boolean(env?.ROOM_CREATE_SECRET),
        VITE_ROOM_CREATE_SECRET: Boolean(env?.VITE_ROOM_CREATE_SECRET),
      },
    });
  }

  if (pathname === '/api/rooms' || pathname.startsWith('/api/rooms/')) {
    try {
      const roomResponse = await handleRoomsApi(request, env);
      if (roomResponse) return roomResponse;
    } catch (err) {
      console.error('[rooms]', err);
      return json({ error: 'room-error', message: String(err?.message || err) }, 500);
    }
  }

  if (method === 'POST' && pathname === '/api/host-unlock') {
    const limited = rateLimited(request, 'host-unlock', { limit: 30, windowMs: 60_000 });
    if (limited) return limited;
    const body = await readJsonBody(request);
    const gate = assertRoomCreateAllowed(env, body?.createSecret);
    if (!gate.ok) return json({ error: gate.error }, gate.status);
    return json({ ok: true });
  }

  if (!isJsonBinConfigured(env)) {
    return json({
      error: 'not-configured',
      hasBinId: Boolean(resolveBinId(env)),
      hasMasterKey: Boolean(resolveMasterKey(env)),
      hasAdminPin: Boolean(resolveAdminPin(env)),
      hint: 'Add Worker runtime Secrets JSONBIN_BIN_ID + JSONBIN_MASTER_KEY (no VITE_ prefix in production).',
    }, 503);
  }

  try {
    if (method === 'GET' && pathname === '/api/stats') {
      const { history } = await getCloudBin(env);
      return json({ history });
    }

    if (method === 'POST' && (pathname === '/api/stats' || pathname === '/api/game')) {
      const limited = rateLimited(request, 'cloud-write', { limit: 40, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      const gate = assertCloudWrite(env, body);
      if (!gate.ok) return json({ error: gate.error }, gate.status);
      const gameRecord = extractGameRecord(body);
      if (!gameRecord) return json({ error: 'invalid-body' }, 400);
      await withCloudBinLock(env, ({ history }) => {
        history.unshift(gameRecord);
      });
      return json({ ok: true }, 201);
    }

    if (method === 'POST' && pathname === '/api/saves') {
      const limited = rateLimited(request, 'cloud-write', { limit: 40, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      const gate = assertCloudWrite(env, body);
      if (!gate.ok) return json({ error: gate.error }, gate.status);
      const snap = body?.state ?? null;
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
        return json({ error: 'invalid-body' }, 400);
      }
      let code = typeof body?.code === 'string' ? body.code.trim() : '';
      if (!code) code = makeSaveCode();
      await withCloudBinLock(env, ({ saves }) => {
        saves[code] = snap;
      });
      return json({ code }, 201);
    }

    const saveMatch = pathname.match(/^\/api\/saves\/([^/]+)$/);
    if (method === 'GET' && saveMatch) {
      const code = decodeURIComponent(saveMatch[1]).trim();
      if (!code) return json({ error: 'missing-code' }, 400);
      const { saves } = await getCloudBin(env);
      const state = saves[code];
      if (!state) return json({ error: 'not-found' }, 404);
      return json({ state });
    }

    if (method === 'DELETE' && pathname === '/api/stats') {
      const limited = rateLimited(request, 'admin-pin', { limit: 15, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      if (!adminPinMatches(env, body?.pin)) {
        return json({ error: 'unauthorized' }, 401);
      }
      await withCloudBinLock(env, ({ history }) => {
        history.length = 0;
      });
      return json({ ok: true, history: [] });
    }

    const gameMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
    if (method === 'DELETE' && gameMatch) {
      const limited = rateLimited(request, 'admin-pin', { limit: 15, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      if (!adminPinMatches(env, body?.pin)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const gameIdRaw = decodeURIComponent(gameMatch[1]);
      const gameId = Number(gameIdRaw);
      const updated = await withCloudBinLock(env, ({ history }) => {
        const next = history.filter((g) => String(g.id) !== String(gameIdRaw) && g.id !== gameId);
        history.length = 0;
        history.push(...next);
        return [...next];
      });
      return json({ ok: true, history: updated });
    }

    return json({ error: 'not-found', method, pathname }, 404);
  } catch (err) {
    console.error('[api]', err);
    return json({ error: 'upstream-error', message: String(err?.message || err) }, 502);
  }
}
