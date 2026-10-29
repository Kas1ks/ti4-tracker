import {
  memoryMiltyClaim,
  memoryMiltyCreate,
  memoryMiltyGet,
  memoryMiltyPick,
  memoryMiltyRegen,
  memoryMiltySubscribe,
  memoryMiltyUnclaim,
  memoryMiltyUndo,
} from './memoryMilty.js';
import { randomRoomId } from '../cryptoCodes.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hasDo(env) {
  return Boolean(env?.MILTY_DRAFTS);
}

function stub(env, id) {
  return env.MILTY_DRAFTS.get(env.MILTY_DRAFTS.idFromName(String(id).toUpperCase()));
}

async function doFetch(env, id, path, init) {
  const obj = stub(env, id);
  const url = new URL(`https://milty.internal/${String(id).toUpperCase()}${path}`);
  return obj.fetch(new Request(url, init));
}

/**
 * @returns {Promise<Response|null>}
 */
export async function handleMiltyApi(request, env) {
  const url = new URL(request.url);
  let { pathname } = url;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const method = request.method.toUpperCase();

  if (!pathname.startsWith('/api/milty')) return null;

  if (method === 'POST' && pathname === '/api/milty') {
    const body = await readJson(request);
    if (hasDo(env)) {
      const id = randomRoomId();
      const res = await doFetch(env, id, '/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, settings: body?.settings || body || {} }),
      });
      return res;
    }
    const result = memoryMiltyCreate(body?.settings || body || {});
    return json(result, 201);
  }

  const match = pathname.match(/^\/api\/milty\/([^/]+)(?:\/(claim|unclaim|pick|undo|regen|events))?$/);
  if (!match) return json({ error: 'not-found' }, 404);
  const id = decodeURIComponent(match[1]);
  const action = match[2] || null;

  if (method === 'GET' && !action) {
    if (hasDo(env)) {
      const qs = url.search;
      return doFetch(env, id, `/snapshot${qs}`, { method: 'GET' });
    }
    const auth = {
      playerId: url.searchParams.get('playerId'),
      playerSecret: url.searchParams.get('secret'),
      adminSecret: url.searchParams.get('admin'),
    };
    const result = memoryMiltyGet(id, auth);
    return json(result, result.ok ? 200 : 404);
  }

  if (method === 'GET' && action === 'events') {
    if (hasDo(env)) {
      return doFetch(env, id, '/events', { method: 'GET' });
    }
    let unsub = () => {};
    let heartbeat = null;
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (obj) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };
        const current = memoryMiltyGet(id);
        if (current.ok) send({ type: 'state', draft: current.draft });
        unsub = memoryMiltySubscribe(id, (payload) => {
          try {
            send(payload);
          } catch {
            unsub();
          }
        });
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch {
            clearInterval(heartbeat);
            unsub();
          }
        }, 25000);
      },
      cancel() {
        if (heartbeat) clearInterval(heartbeat);
        unsub();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      },
    });
  }

  if (method === 'POST' && action === 'claim') {
    const body = await readJson(request);
    if (hasDo(env)) {
      return doFetch(env, id, '/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    const result = memoryMiltyClaim(id, body || {});
    return json(result, result.ok ? 200 : 400);
  }

  if (method === 'POST' && action === 'unclaim') {
    const body = await readJson(request);
    if (hasDo(env)) {
      return doFetch(env, id, '/unclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    const result = memoryMiltyUnclaim(id, body || {});
    const status = result.ok ? 200 : result.error === 'forbidden' ? 403 : 400;
    return json(result, status);
  }

  if (method === 'POST' && action === 'pick') {
    const body = await readJson(request);
    if (hasDo(env)) {
      return doFetch(env, id, '/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    const result = memoryMiltyPick(id, body || {});
    const status = result.ok ? 200 : result.error === 'stale' ? 409 : result.error === 'forbidden' ? 403 : 400;
    return json(result, status);
  }

  if (method === 'POST' && action === 'undo') {
    const body = await readJson(request);
    if (hasDo(env)) {
      return doFetch(env, id, '/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    const result = memoryMiltyUndo(id, body || {});
    return json(result, result.ok ? 200 : result.error === 'forbidden' ? 403 : 400);
  }

  if (method === 'POST' && action === 'regen') {
    const body = await readJson(request);
    if (hasDo(env)) {
      return doFetch(env, id, '/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }
    const result = memoryMiltyRegen(id, body || {});
    return json(result, result.ok ? 200 : result.error === 'forbidden' ? 403 : 400);
  }

  return json({ error: 'not-found' }, 404);
}
