import {
  getCloudBin,
  isJsonBinConfigured,
  makeSaveCode,
  putCloudBin,
} from './jsonbin.js';

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

function pinMatches(env, pin) {
  return Boolean(env.ADMIN_PIN) && pin === env.ADMIN_PIN;
}

/**
 * Shared API handler for Cloudflare Worker and Vite dev middleware.
 * @param {Request} request
 * @param {{ JSONBIN_BIN_ID?: string, JSONBIN_MASTER_KEY?: string, ADMIN_PIN?: string }} env
 */
export async function handleApi(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
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

  if (!isJsonBinConfigured(env)) {
    return json({ error: 'not-configured' }, 503);
  }

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return json({ ok: true, cloud: true });
    }

    if (method === 'GET' && pathname === '/api/stats') {
      const { history } = await getCloudBin(env);
      return json({ history });
    }

    if (method === 'POST' && pathname === '/api/games') {
      const record = await readJsonBody(request);
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return json({ error: 'invalid-body' }, 400);
      }
      const { history, saves } = await getCloudBin(env);
      history.unshift(record);
      await putCloudBin(env, { history, saves });
      return json({ ok: true }, 201);
    }

    if (method === 'POST' && pathname === '/api/saves') {
      const body = await readJsonBody(request);
      const snap = body?.state ?? body;
      if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
        return json({ error: 'invalid-body' }, 400);
      }
      const { history, saves } = await getCloudBin(env);
      let code = typeof body?.code === 'string' ? body.code.trim() : '';
      if (!code) code = makeSaveCode();
      saves[code] = snap;
      await putCloudBin(env, { history, saves });
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
      if (!pinMatches(env, body?.pin)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const { saves } = await getCloudBin(env);
      await putCloudBin(env, { history: [], saves });
      return json({ ok: true, history: [] });
    }

    const gameMatch = pathname.match(/^\/api\/stats\/([^/]+)$/);
    if (method === 'DELETE' && gameMatch) {
      const body = await readJsonBody(request);
      if (!pinMatches(env, body?.pin)) {
        return json({ error: 'unauthorized' }, 401);
      }
      const gameIdRaw = decodeURIComponent(gameMatch[1]);
      const gameId = Number(gameIdRaw);
      const { history, saves } = await getCloudBin(env);
      const updated = history.filter((g) => String(g.id) !== String(gameIdRaw) && g.id !== gameId);
      await putCloudBin(env, { history: updated, saves });
      return json({ ok: true, history: updated });
    }

    return json({ error: 'not-found' }, 404);
  } catch (err) {
    console.error('[api]', err);
    return json({ error: 'upstream-error' }, 502);
  }
}
