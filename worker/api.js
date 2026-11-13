import {
  adminPinMatches,
  makeSaveCode,
} from './jsonbin.js';
import {
  appendGameRecord,
  clearCloudHistory,
  deleteCloudHistoryId,
  getCloudBin,
  isCloudStatsConfigured,
  putCloudSave,
} from './stats/statsBin.js';
import { handleAdminRoomsApi, handleRoomsApi } from './rooms/roomsApi.js';
import { handleMiltyApi } from './milty/miltyApi.js';
import { assertHostWriteAllowed, issueHostWriteToken } from './rooms/hostWriteToken.js';
import { readVapidConfig } from './push/sendPush.js';
import { clientKey } from './secureCompare.js';
import { consumeRateLimitEnv, FAIL_CLOSED_BUCKETS } from './rateLimit/RateLimitGate.js';

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

async function rateLimited(request, env, bucket, opts = {}) {
  const key = `${bucket}:${clientKey(request)}`;
  const failClosed = opts.failClosed ?? FAIL_CLOSED_BUCKETS.has(bucket);
  const result = await consumeRateLimitEnv(env, key, { ...opts, failClosed });
  if (!result.ok) {
    const status = result.unavailable ? 503 : 429;
    return json(
      {
        error: result.unavailable ? 'rate-limit-unavailable' : 'rate-limited',
        retryAfterMs: result.retryAfterMs,
      },
      status,
      { 'Retry-After': String(Math.ceil((result.retryAfterMs || 0) / 1000) || 60) },
    );
  }
  return null;
}

/** Count only failed ADMIN_PIN attempts (successes must not burn the auth bucket). */
async function rateLimitFailedAdminPin(request, env) {
  return rateLimited(request, env, 'admin-auth', { limit: 15, windowMs: 60_000, failClosed: true });
}

/**
 * Rate-limit live-room HTTP before handleRoomsApi.
 * Host createSecret / claim-host share one strict bucket (brute-force surface).
 * SSE /events is not limited here (long-lived stream).
 * @returns {Promise<Response|null>}
 */
async function rateLimitRoomsPath(request, env, pathname, method) {
  // Hub list — light read traffic
  if (method === 'GET' && pathname === '/api/rooms') {
    return rateLimited(request, env, 'room-read', { limit: 120, windowMs: 60_000 });
  }

  // Creating a room checks ROOM_CREATE_SECRET — same class as host-unlock
  if (method === 'POST' && pathname === '/api/rooms') {
    return rateLimited(request, env, 'host-secret', { limit: 15, windowMs: 60_000, failClosed: true });
  }

  const roomMatch = pathname.match(
    /^\/api\/rooms\/([^/]+)(?:\/(snapshot|actions|events|join|claim-host|release-seat|claim-seat|push\/subscribe|push\/unsubscribe|milty\/promote|milty\/pick|milty\/undo|milty\/regen))?$/,
  );
  if (!roomMatch) return null;

  const sub = roomMatch[2] || 'snapshot';

  // Long-lived SSE — do not consume the write/read quotas
  if (method === 'GET' && sub === 'events') return null;

  if (method === 'POST' && sub === 'claim-host') {
    return rateLimited(request, env, 'host-secret', { limit: 15, windowMs: 60_000, failClosed: true });
  }
  if (method === 'POST' && sub === 'join') {
    return rateLimited(request, env, 'room-join', { limit: 40, windowMs: 60_000 });
  }
  if (method === 'POST' && sub === 'actions') {
    return rateLimited(request, env, 'room-actions', { limit: 180, windowMs: 60_000 });
  }
  if (method === 'GET' && (sub === 'snapshot' || !roomMatch[2])) {
    return rateLimited(request, env, 'room-read', { limit: 120, windowMs: 60_000 });
  }
  // release/claim seat, push, milty room helpers
  if (method === 'POST') {
    return rateLimited(request, env, 'room-misc', { limit: 60, windowMs: 60_000 });
  }
  return null;
}

function assertCloudWrite(env, body) {
  return assertHostWriteAllowed(env, body);
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
    // Public liveness only — never advertise which secrets/bindings are set.
    return json({
      ok: true,
      rooms: Boolean(env?.GAME_ROOMS) ? 'durable-object' : 'memory',
    });
  }

  if (method === 'GET' && pathname === '/api/push/vapid-public-key') {
    const vapid = readVapidConfig(env);
    if (!vapid) return json({ error: 'vapid-not-configured', configured: false }, 503);
    return json({ publicKey: vapid.publicKey, configured: true });
  }

  if (pathname === '/api/rooms' || pathname.startsWith('/api/rooms/')) {
    const limited = await rateLimitRoomsPath(request, env, pathname, method);
    if (limited) return limited;
    try {
      const roomResponse = await handleRoomsApi(request, env);
      if (roomResponse) return roomResponse;
    } catch (err) {
      console.error('[rooms]', err);
      return json({ error: 'room-error' }, 500);
    }
  }

  // Before cloud-stats gate — admin rooms must work even if StatsStore is down.
  // Auth vs poll buckets are applied inside handleAdminRoomsApi (failures-only for PIN).
  if (pathname === '/api/admin/rooms' || pathname.startsWith('/api/admin/rooms/')) {
    try {
      return await handleAdminRoomsApi(request, env);
    } catch (err) {
      console.error('[admin-rooms]', err);
      return json({ error: 'admin-rooms-error' }, 500);
    }
  }

  if (pathname === '/api/milty' || pathname.startsWith('/api/milty/')) {
    try {
      if (method === 'POST' && pathname === '/api/milty') {
        const limited = await rateLimited(request, env, 'milty-create', { limit: 20, windowMs: 60_000 });
        if (limited) return limited;
      }
      const miltyResponse = await handleMiltyApi(request, env);
      if (miltyResponse) return miltyResponse;
    } catch (err) {
      console.error('[milty]', err);
      return json({ error: 'milty-error' }, 500);
    }
  }

  if (method === 'POST' && pathname === '/api/host-unlock') {
    // Same bucket as POST /api/rooms + claim-host — one IP cannot spray createSecret/hostKey.
    const limited = await rateLimited(request, env, 'host-secret', {
      limit: 15,
      windowMs: 60_000,
      failClosed: true,
    });
    if (limited) return limited;
    const body = await readJsonBody(request);
    const gate = await assertHostWriteAllowed(env, body);
    if (!gate.ok) return json({ error: gate.error }, gate.status);
    const issued = await issueHostWriteToken(env);
    if (!issued) return json({ error: 'create-secret-not-configured' }, 503);
    return json({ ok: true, ...issued });
  }

  if (!isCloudStatsConfigured(env)) {
    return json({ error: 'not-configured' }, 503);
  }

  try {
    if (method === 'GET' && pathname === '/api/stats') {
      const { history } = await getCloudBin(env);
      return json({ history });
    }

    if (method === 'POST' && (pathname === '/api/stats' || pathname === '/api/game')) {
      const limited = await rateLimited(request, env, 'cloud-write', { limit: 40, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      const gate = await assertCloudWrite(env, body);
      if (!gate.ok) return json({ error: gate.error }, gate.status);
      const gameRecord = extractGameRecord(body);
      if (!gameRecord) return json({ error: 'invalid-body' }, 400);
      await appendGameRecord(env, gameRecord);
      return json({ ok: true }, 201);
    }

    if (method === 'POST' && pathname === '/api/saves') {
      const limited = await rateLimited(request, env, 'cloud-write', { limit: 40, windowMs: 60_000 });
      if (limited) return limited;
      const body = await readJsonBody(request);
      const gate = await assertCloudWrite(env, body);
      if (!gate.ok) return json({ error: gate.error }, gate.status);
      const snap = body?.state ?? null;
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
        return json({ error: 'invalid-body' }, 400);
      }
      let code = typeof body?.code === 'string' ? body.code.trim() : '';
      if (!code) code = makeSaveCode();
      await putCloudSave(env, code, snap);
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
      const body = await readJsonBody(request);
      if (!adminPinMatches(env, body?.pin)) {
        const limited = await rateLimitFailedAdminPin(request, env);
        if (limited) return limited;
        return json({ error: 'unauthorized' }, 401);
      }
      await clearCloudHistory(env);
      return json({ ok: true, history: [] });
    }

    const gameMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
    if (method === 'DELETE' && gameMatch) {
      const body = await readJsonBody(request);
      if (!adminPinMatches(env, body?.pin)) {
        const limited = await rateLimitFailedAdminPin(request, env);
        if (limited) return limited;
        return json({ error: 'unauthorized' }, 401);
      }
      const gameIdRaw = decodeURIComponent(gameMatch[1]);
      const updated = await deleteCloudHistoryId(env, gameIdRaw);
      return json({ ok: true, history: updated });
    }

    return json({ error: 'not-found', method, pathname }, 404);
  } catch (err) {
    console.error('[api]', err);
    return json({ error: 'upstream-error' }, 502);
  }
}
