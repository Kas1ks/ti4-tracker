import {
  memoryApplyAction,
  memoryCreateRoom,
  memoryGetRoom,
  memoryJoin,
  memoryClaimHost,
  memoryListAllRoomIds,
  memoryListHubCards,
  memoryAdminRoomSnapshot,
  memoryAdminCloseRoom,
  memoryAdminKickSeat,
  memoryMiltyPick,
  memoryMiltyPromote,
  memoryMiltyRegen,
  memoryMiltyUndo,
  memoryPushSubscribe,
  memoryPushUnsubscribe,
  memoryReleaseSeat,
  memoryHostClaimSeat,
  memoryPublicView,
  memorySubscribe,
} from './memoryRooms.js';
import {
  buildMiltyLobbyState,
  createMiltyInEnv,
  linkedMiltySettings,
} from './miltyAttach.js';
import {
  makeRoomId,
  publicRoomView,
  adminSessionFromRoom,
  sessionAuthFromRoom,
} from './roomCore.js';
import { assertHostWriteAllowed } from './hostWriteToken.js';
import { directoryList, hasRoomDirectory } from './roomIndex.js';
import { readVapidConfig } from '../push/sendPush.js';
import { adminPinMatches } from '../jsonbin.js';
import { clientKey } from '../secureCompare.js';
import { consumeRateLimitEnv } from '../rateLimit/RateLimitGate.js';

function json(data, status = 200, extraHeaders = undefined) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(extraHeaders || {}),
    },
  });
}

function rateLimitResponse(result) {
  const status = result?.unavailable ? 503 : 429;
  return json(
    {
      error: result?.unavailable ? 'rate-limit-unavailable' : 'rate-limited',
      retryAfterMs: result?.retryAfterMs ?? 0,
    },
    status,
    { 'Retry-After': String(Math.ceil((result?.retryAfterMs || 0) / 1000) || 60) },
  );
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hasDurableRooms(env) {
  return Boolean(env?.GAME_ROOMS);
}

async function stubFor(env, roomId) {
  const id = env.GAME_ROOMS.idFromName(String(roomId).toUpperCase());
  return env.GAME_ROOMS.get(id);
}

async function fetchDoAdminSnapshot(env, roomId, pin) {
  const stub = await stubFor(env, roomId);
  const res = await stub.fetch(new Request('https://room/admin/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  }));
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  if (res.status === 404) {
    return { roomId: String(roomId).toUpperCase(), error: 'not-found' };
  }
  if (!res.ok) {
    return { roomId: String(roomId).toUpperCase(), error: `http-${res.status}` };
  }
  return res.json();
}

async function fetchDoAdminAction(env, roomId, pathSuffix, body) {
  const stub = await stubFor(env, roomId);
  const res = await stub.fetch(new Request(`https://room${pathSuffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  }));
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
  return { status: res.status, data };
}

/**
 * Admin monitor API — list live rooms + SSE clients (ADMIN_PIN).
 * Also: detail, close room, kick seat.
 *
 * Rate limits:
 * - Wrong PIN → admin-auth (strict, fail-closed) — successes do not consume it.
 * - List/poll → admin-poll (soft, generous).
 * - close/kick → admin-action (soft).
 */
export async function handleAdminRoomsApi(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const method = request.method.toUpperCase();
  if (method !== 'POST') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  const body = await readJsonBody(request);
  const pin = body?.pin != null ? String(body.pin) : '';
  const ip = clientKey(request);
  if (!adminPinMatches(env, pin)) {
    const authHit = await consumeRateLimitEnv(env, `admin-auth:${ip}`, {
      limit: 15,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!authHit.ok) return rateLimitResponse(authHit);
    return json({ error: 'unauthorized' }, 401);
  }

  const isMutate = /\/(close|kick)$/.test(pathname);
  const softHit = await consumeRateLimitEnv(
    env,
    `${isMutate ? 'admin-action' : 'admin-poll'}:${ip}`,
    {
      limit: isMutate ? 60 : 180,
      windowMs: 60_000,
      failClosed: false,
    },
  );
  if (!softHit.ok) return rateLimitResponse(softHit);

  const closeMatch = pathname.match(/^\/api\/admin\/rooms\/([^/]+)\/close$/);
  if (closeMatch) {
    const roomId = decodeURIComponent(closeMatch[1]).trim().toUpperCase();
    if (!roomId) return json({ error: 'missing-room' }, 400);
    if (hasDurableRooms(env)) {
      try {
        const { status, data } = await fetchDoAdminAction(env, roomId, '/admin/close', { pin });
        return json(data, status);
      } catch (err) {
        if (err?.status === 401 || err?.message === 'unauthorized') {
          return json({ error: 'unauthorized' }, 401);
        }
        return json({ error: 'admin-close-failed' }, 500);
      }
    }
    const closed = memoryAdminCloseRoom(roomId);
    if (!closed.ok) return json({ error: closed.error }, 404);
    return json({ ok: true, roomId: closed.roomId, backend: 'memory' });
  }

  const kickMatch = pathname.match(/^\/api\/admin\/rooms\/([^/]+)\/kick$/);
  if (kickMatch) {
    const roomId = decodeURIComponent(kickMatch[1]).trim().toUpperCase();
    if (!roomId) return json({ error: 'missing-room' }, 400);
    const seatPlayerId = body?.seatPlayerId;
    if (seatPlayerId == null || seatPlayerId === '') {
      return json({ error: 'seat-required' }, 400);
    }
    if (hasDurableRooms(env)) {
      try {
        const { status, data } = await fetchDoAdminAction(env, roomId, '/admin/kick', {
          pin,
          seatPlayerId,
        });
        return json(data, status);
      } catch (err) {
        if (err?.status === 401 || err?.message === 'unauthorized') {
          return json({ error: 'unauthorized' }, 401);
        }
        return json({ error: 'admin-kick-failed' }, 500);
      }
    }
    const kicked = await memoryAdminKickSeat(roomId, seatPlayerId, env);
    if (!kicked.ok) {
      const status = kicked.error === 'unauthorized' || kicked.error === 'forbidden' ? 403
        : kicked.error === 'not-found' ? 404
          : 400;
      return json({ error: kicked.error }, status);
    }
    return json({
      ok: true,
      seatPlayerId: kicked.seatPlayerId,
      room: kicked.room,
      backend: 'memory',
    });
  }

  const oneMatch = pathname.match(/^\/api\/admin\/rooms\/([^/]+)$/);
  if (oneMatch) {
    const roomId = decodeURIComponent(oneMatch[1]).trim().toUpperCase();
    if (!roomId) return json({ error: 'missing-room' }, 400);
    if (hasDurableRooms(env)) {
      try {
        const snap = await fetchDoAdminSnapshot(env, roomId, pin);
        return json({ room: snap, backend: 'durable-object' });
      } catch (err) {
        if (err?.status === 401 || err?.message === 'unauthorized') {
          return json({ error: 'unauthorized' }, 401);
        }
        return json({ room: { roomId, error: 'unavailable' }, backend: 'durable-object' });
      }
    }
    const snap = memoryAdminRoomSnapshot(roomId);
    if (!snap) return json({ room: { roomId, error: 'not-found' }, backend: 'memory' });
    return json({ room: snap, backend: 'memory' });
  }

  if (pathname !== '/api/admin/rooms') {
    return json({ error: 'not-found' }, 404);
  }

  if (hasDurableRooms(env)) {
    const cards = hasRoomDirectory(env) ? await directoryList(env) : [];
    const ids = [...new Set(
      cards
        .map((c) => String(c?.roomId || '').trim().toUpperCase())
        .filter(Boolean),
    )];
    let rooms;
    try {
      rooms = await Promise.all(ids.map(async (roomId) => {
        try {
          return await fetchDoAdminSnapshot(env, roomId, pin);
        } catch (err) {
          if (err?.status === 401 || err?.message === 'unauthorized') throw err;
          return { roomId, error: 'unavailable' };
        }
      }));
    } catch (err) {
      if (err?.status === 401 || err?.message === 'unauthorized') {
        return json({ error: 'unauthorized' }, 401);
      }
      throw err;
    }
    rooms.sort((a, b) => {
      const ta = Date.parse(a?.lastActivityAt || 0) || 0;
      const tb = Date.parse(b?.lastActivityAt || 0) || 0;
      return tb - ta;
    });
    return json({ rooms, backend: 'durable-object', indexed: hasRoomDirectory(env) });
  }

  const ids = memoryListAllRoomIds();
  const rooms = ids.map((roomId) => {
    const snap = memoryAdminRoomSnapshot(roomId);
    return snap || { roomId, error: 'not-found' };
  });
  rooms.sort((a, b) => {
    const ta = Date.parse(a?.lastActivityAt || 0) || 0;
    const tb = Date.parse(b?.lastActivityAt || 0) || 0;
    return tb - ta;
  });
  return json({ rooms, backend: 'memory', indexed: true });
}

/**
 * Room HTTP API — Vite middleware and Cloudflare Worker.
 */
export async function handleRoomsApi(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (method === 'GET' && pathname === '/api/push/vapid-public-key') {
    const vapid = readVapidConfig(env);
    if (!vapid) return json({ error: 'vapid-not-configured', configured: false }, 503);
    return json({ publicKey: vapid.publicKey, configured: true });
  }

  // Global hub list — all live rooms on this server (not device-local).
  if (method === 'GET' && pathname === '/api/rooms') {
    if (hasDurableRooms(env)) {
      if (!hasRoomDirectory(env)) {
        return json({ rooms: [], backend: 'durable-object', indexed: false });
      }
      const rooms = await directoryList(env);
      return json({ rooms, backend: 'durable-object', indexed: true });
    }
    return json({ rooms: memoryListHubCards(), backend: 'memory', indexed: true });
  }

  if (method === 'POST' && pathname === '/api/rooms') {
    const body = await readJsonBody(request);
    const gate = await assertHostWriteAllowed(env, body);
    if (!gate.ok) return json({ error: gate.error }, gate.status);

    let createState = body?.state ?? null;
    let miltyAttach = null;
    let miltyAdminSecret = undefined;

    if (body?.milty) {
      const linked = linkedMiltySettings(body.milty);
      const milty = await createMiltyInEnv(env, linked.settings);
      if (!milty?.ok) {
        return json({ error: milty?.error || 'milty-create-failed' }, 500);
      }
      createState = buildMiltyLobbyState(linked.names, {
        usePok: linked.usePok,
        useTe: linked.useTe,
      });
      miltyAttach = { draftId: milty.id, adminSecret: milty.adminSecret };
      miltyAdminSecret = milty.adminSecret;
    }

    if (hasDurableRooms(env)) {
      const roomId = makeRoomId();
      const stub = await stubFor(env, roomId);
      const res = await stub.fetch(new Request(`https://room/create?roomId=${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: createState, milty: miltyAttach }),
      }));
      const data = await res.json();
      if (miltyAdminSecret && !data.miltyAdminSecret) {
        data.miltyAdminSecret = miltyAdminSecret;
      }
      return json(data, res.status);
    }

    const room = memoryCreateRoom(createState, { milty: miltyAttach });
    const adminTok = adminSessionFromRoom(room);
    return json({
      ...publicRoomView(room, adminTok),
      hostKey: room.hostKey,
      sessionToken: adminTok,
      role: 'admin',
      miltyAdminSecret,
    }, 201);
  }

  const roomMatch = pathname.match(
    /^\/api\/rooms\/([^/]+)(?:\/(snapshot|actions|events|join|claim-host|release-seat|claim-seat|push\/subscribe|push\/unsubscribe|milty\/promote|milty\/pick|milty\/undo|milty\/regen))?$/,
  );
  if (!roomMatch) return null;

  const roomId = decodeURIComponent(roomMatch[1]).trim().toUpperCase();
  const sub = roomMatch[2] || 'snapshot';

  if (!roomId) return json({ error: 'missing-room' }, 400);

  if (hasDurableRooms(env)) {
    const stub = await stubFor(env, roomId);

    if (method === 'GET' && (sub === 'snapshot' || !roomMatch[2])) {
      const token = url.searchParams.get('sessionToken') || '';
      const qs = token ? `?sessionToken=${encodeURIComponent(token)}` : '';
      const res = await stub.fetch(new Request(`https://room/snapshot${qs}`));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && sub === 'join') {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request('https://room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && sub === 'claim-host') {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request('https://room/claim-host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && sub === 'release-seat') {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request('https://room/release-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && sub === 'claim-seat') {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request('https://room/claim-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && sub === 'actions') {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request('https://room/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && (sub === 'push/subscribe' || sub === 'push/unsubscribe')) {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request(`https://room/${sub}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'POST' && (sub === 'milty/promote' || sub === 'milty/pick' || sub === 'milty/undo' || sub === 'milty/regen')) {
      const body = await readJsonBody(request);
      const res = await stub.fetch(new Request(`https://room/${sub}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }));
      return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (method === 'GET' && sub === 'events') {
      const token = new URL(request.url).searchParams.get('sessionToken') || '';
      const qs = token ? `?sessionToken=${encodeURIComponent(token)}` : '';
      return stub.fetch(new Request(`https://room/events${qs}`, {
        headers: { Accept: 'text/event-stream' },
        signal: request.signal,
      }));
    }

    return json({ error: 'not-found' }, 404);
  }

  // --- In-memory (Vite) ---
  if (method === 'GET' && (sub === 'snapshot' || !roomMatch[2])) {
    const token = url.searchParams.get('sessionToken') || '';
    const view = memoryPublicView(roomId, token || null);
    if (!view) return json({ error: 'not-found' }, 404);
    return json(view);
  }

  if (method === 'POST' && sub === 'join') {
    const body = await readJsonBody(request);
    const result = await memoryJoin(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : (result.error === 'seat-taken'
          || result.error === 'seat-secret-required'
          || result.error === 'bad-seat-secret') ? 409
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ...publicRoomView(result.room, result.sessionToken),
      sessionToken: result.sessionToken,
      role: result.role,
      seatPlayerId: result.seatPlayerId,
      seatSecret: result.seatSecret,
      miltySecret: result.miltySecret || null,
      reclaimed: !!result.reclaimed,
    });
  }

  if (method === 'POST' && sub === 'claim-host') {
    const body = await readJsonBody(request);
    const result = await memoryClaimHost(roomId, body || {});
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'bad-host-key' ? 403
          : result.error === 'party-ended' ? 409
            : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ...publicRoomView(result.room, result.sessionToken),
      sessionToken: result.sessionToken,
      hostKey: result.hostKey,
      role: result.role,
      seatPlayerId: result.seatPlayerId,
      seatSecret: result.seatSecret,
      miltyAdminSecret: result.room.milty?.adminSecret || undefined,
      reclaimed: !!result.reclaimed,
    });
  }

  if (method === 'POST' && sub === 'milty/promote') {
    const body = await readJsonBody(request);
    const result = await memoryMiltyPromote(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'unauthorized' ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json(publicRoomView(result.room, body?.sessionToken || adminSessionFromRoom(result.room)));
  }

  if (method === 'POST' && sub === 'milty/pick') {
    const body = await readJsonBody(request);
    const result = await memoryMiltyPick(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'unauthorized' ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ok: true,
      draft: result.draft,
      room: publicRoomView(result.room, body?.sessionToken),
    });
  }

  if (method === 'POST' && sub === 'milty/regen') {
    const body = await readJsonBody(request);
    const result = await memoryMiltyRegen(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'unauthorized' ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ok: true,
      draft: result.draft,
      room: publicRoomView(result.room, body?.sessionToken),
    });
  }

  if (method === 'POST' && sub === 'milty/undo') {
    const body = await readJsonBody(request);
    const result = await memoryMiltyUndo(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'unauthorized' ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ok: true,
      draft: result.draft,
      room: publicRoomView(result.room, body?.sessionToken),
    });
  }

  if (method === 'POST' && sub === 'release-seat') {
    const body = await readJsonBody(request);
    const result = await memoryReleaseSeat(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : (result.error === 'unauthorized' || result.error === 'forbidden') ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ...publicRoomView(result.room, body?.sessionToken),
      seatPlayerId: result.seatPlayerId,
    });
  }

  if (method === 'POST' && sub === 'claim-seat') {
    const body = await readJsonBody(request);
    const result = await memoryHostClaimSeat(roomId, body || {}, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : result.error === 'unauthorized' ? 403
          : result.error === 'seat-taken' ? 409
            : 400;
      return json({ error: result.error }, status);
    }
    return json({
      ...publicRoomView(result.room, body?.sessionToken),
      seatPlayerId: result.seatPlayerId,
      seatSecret: result.seatSecret,
      miltySecret: result.miltySecret || null,
      role: result.role,
    });
  }

  if (method === 'POST' && sub === 'actions') {
    const body = await readJsonBody(request);
    const result = memoryApplyAction(roomId, body?.action, {
      sessionToken: body?.sessionToken,
      hostKey: body?.hostKey,
    }, env);
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : (result.error === 'unauthorized' || result.error === 'forbidden') ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({
      seq: result.room.seq,
      state: result.viewState ?? result.room.state,
      noop: !!result.noop,
      canUndo: !!result.canUndo,
    });
  }

  if (method === 'POST' && sub === 'push/subscribe') {
    const body = await readJsonBody(request);
    const result = memoryPushSubscribe(roomId, body || {});
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : (result.error === 'unauthorized' || result.error === 'forbidden') ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({ ok: true });
  }

  if (method === 'POST' && sub === 'push/unsubscribe') {
    const body = await readJsonBody(request);
    const result = memoryPushUnsubscribe(roomId, body || {});
    if (!result.ok) {
      const status = result.error === 'not-found' ? 404
        : (result.error === 'unauthorized' || result.error === 'forbidden') ? 403
          : 400;
      return json({ error: result.error }, status);
    }
    return json({ ok: true });
  }

  if (method === 'GET' && sub === 'events') {
    const room = memoryGetRoom(roomId);
    if (!room) return json({ error: 'not-found' }, 404);
    const token = url.searchParams.get('sessionToken') || '';
    const auth = sessionAuthFromRoom(room, token);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        send({ type: 'hello', ...memoryPublicView(roomId, auth) });

        const unsubscribe = memorySubscribe(roomId, (payload) => {
          try {
            send(payload);
          } catch {
            unsubscribe();
          }
        }, auth);

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(heartbeat);
            unsubscribe();
          }
        }, 15000);

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  return json({ error: 'not-found' }, 404);
}
