import {
  memoryApplyAction,
  memoryCreateRoom,
  memoryGetRoom,
  memoryJoin,
  memoryListHubCards,
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
import { makeRoomId, publicRoomView, adminSessionFromRoom } from './roomCore.js';
import { assertRoomCreateAllowed } from './roomCreateAuth.js';
import { directoryList, hasRoomDirectory } from './roomIndex.js';
import { readVapidConfig } from '../push/sendPush.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
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

function hasDurableRooms(env) {
  return Boolean(env?.GAME_ROOMS);
}

async function stubFor(env, roomId) {
  const id = env.GAME_ROOMS.idFromName(String(roomId).toUpperCase());
  return env.GAME_ROOMS.get(id);
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
    const gate = assertRoomCreateAllowed(env, body?.createSecret);
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
    return json({
      ...publicRoomView(room),
      hostKey: room.hostKey,
      sessionToken: adminSessionFromRoom(room),
      role: 'admin',
      miltyAdminSecret,
    }, 201);
  }

  const roomMatch = pathname.match(
    /^\/api\/rooms\/([^/]+)(?:\/(snapshot|actions|events|join|release-seat|claim-seat|push\/subscribe|push\/unsubscribe|milty\/promote|milty\/pick|milty\/undo|milty\/regen))?$/,
  );
  if (!roomMatch) return null;

  const roomId = decodeURIComponent(roomMatch[1]).trim().toUpperCase();
  const sub = roomMatch[2] || 'snapshot';

  if (!roomId) return json({ error: 'missing-room' }, 400);

  if (hasDurableRooms(env)) {
    const stub = await stubFor(env, roomId);

    if (method === 'GET' && (sub === 'snapshot' || !roomMatch[2])) {
      const res = await stub.fetch(new Request('https://room/snapshot'));
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
    const view = memoryPublicView(roomId);
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
      ...publicRoomView(result.room),
      sessionToken: result.sessionToken,
      role: result.role,
      seatPlayerId: result.seatPlayerId,
      seatSecret: result.seatSecret,
      miltySecret: result.miltySecret || null,
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
    return json(publicRoomView(result.room));
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
      room: publicRoomView(result.room),
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
      room: publicRoomView(result.room),
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
      room: publicRoomView(result.room),
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
      ...publicRoomView(result.room),
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
      ...publicRoomView(result.room),
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
      state: result.room.state,
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
    if (!memoryGetRoom(roomId)) return json({ error: 'not-found' }, 404);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        send({ type: 'hello', ...memoryPublicView(roomId) });

        const unsubscribe = memorySubscribe(roomId, (payload) => {
          try {
            send(payload);
          } catch {
            unsubscribe();
          }
        });

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
