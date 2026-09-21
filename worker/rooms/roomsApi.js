import {
  memoryApplyAction,
  memoryCreateRoom,
  memoryGetRoom,
  memoryJoin,
  memoryReleaseSeat,
  memoryPublicView,
  memorySubscribe,
} from './memoryRooms.js';
import { makeRoomId, publicRoomView, adminSessionFromRoom } from './roomCore.js';
import { assertRoomCreateAllowed } from './roomCreateAuth.js';

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

  if (method === 'POST' && pathname === '/api/rooms') {
    const body = await readJsonBody(request);
    const gate = assertRoomCreateAllowed(env, body?.createSecret);
    if (!gate.ok) return json({ error: gate.error }, gate.status);

    if (hasDurableRooms(env)) {
      const roomId = makeRoomId();
      const stub = await stubFor(env, roomId);
      const res = await stub.fetch(new Request(`https://room/create?roomId=${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: body?.state ?? null }),
      }));
      const data = await res.json();
      return json(data, res.status);
    }

    const room = memoryCreateRoom(body?.state ?? null);
    return json({
      ...publicRoomView(room),
      hostKey: room.hostKey,
      sessionToken: adminSessionFromRoom(room),
      role: 'admin',
    }, 201);
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([^/]+)(?:\/(snapshot|actions|events|join|release-seat))?$/);
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

    if (method === 'GET' && sub === 'events') {
      return stub.fetch(new Request('https://room/events', {
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
    const result = memoryJoin(roomId, body || {});
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
      reclaimed: !!result.reclaimed,
    });
  }

  if (method === 'POST' && sub === 'release-seat') {
    const body = await readJsonBody(request);
    const result = memoryReleaseSeat(roomId, body || {});
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

  if (method === 'POST' && sub === 'actions') {
    const body = await readJsonBody(request);
    const result = memoryApplyAction(roomId, body?.action, {
      sessionToken: body?.sessionToken,
      hostKey: body?.hostKey,
    });
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
    });
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
