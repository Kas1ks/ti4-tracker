/**
 * Company-wide stats + cloud saves (replaces JSONBin hot path).
 * One Durable Object (name: company) stores { history, saves, meta }.
 */
export class StatsStore {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async loadBin() {
    const raw = (await this.ctx.storage.get('bin')) || null;
    return normalizeStoredBin(raw);
  }

  async saveBin(bin) {
    const next = normalizeStoredBin(bin);
    await this.ctx.storage.put('bin', next);
    return next;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    if (method === 'GET' && path.endsWith('/bin')) {
      return Response.json(await this.loadBin());
    }

    if (method === 'PUT' && path.endsWith('/bin')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const saved = await this.saveBin(body);
      return Response.json(saved);
    }

    if (method === 'POST' && path.endsWith('/mutate')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const bin = await this.loadBin();
      const history = bin.history.slice();
      const saves = { ...bin.saves };
      const meta = { ...bin.meta };
      const op = body?.op;

      if (op === 'unshiftHistory') {
        if (!body.record || typeof body.record !== 'object') {
          return Response.json({ error: 'invalid-body' }, { status: 400 });
        }
        history.unshift(body.record);
      } else if (op === 'putSave') {
        const code = String(body.code || '').trim();
        if (!code || body.state == null) {
          return Response.json({ error: 'invalid-body' }, { status: 400 });
        }
        saves[code] = body.state;
      } else if (op === 'clearHistory') {
        history.length = 0;
      } else if (op === 'deleteHistoryId') {
        const gameIdRaw = String(body.gameId ?? '');
        const gameId = Number(gameIdRaw);
        const next = history.filter(
          (g) => String(g?.id) !== gameIdRaw && g?.id !== gameId,
        );
        history.length = 0;
        history.push(...next);
      } else if (op === 'mergeImport') {
        const imported = normalizeStoredBin({
          history: body.history,
          saves: body.saves,
        });
        const byId = new Map();
        for (const g of imported.history) {
          if (g?.id != null) byId.set(String(g.id), g);
        }
        // Prefer records already in DO (newer local uploads win).
        for (const g of history) {
          if (g?.id != null) byId.set(String(g.id), g);
        }
        const mergedHistory = [...byId.values()].sort((a, b) => {
          const ta = Date.parse(a?.savedAt || 0) || Number(a?.id) || 0;
          const tb = Date.parse(b?.savedAt || 0) || Number(b?.id) || 0;
          return tb - ta;
        });
        history.length = 0;
        history.push(...mergedHistory);
        Object.assign(saves, imported.saves, saves);
        meta.importedFromJsonbin = true;
        meta.importAttemptedAt = Date.now();
      } else if (op === 'markImportAttempt') {
        meta.importAttemptedAt = Date.now();
        if (body.importedFromJsonbin) meta.importedFromJsonbin = true;
      } else if (op === 'replace') {
        const next = normalizeStoredBin({
          history: body.history,
          saves: body.saves,
          meta: body.meta || meta,
        });
        history.length = 0;
        history.push(...next.history);
        Object.keys(saves).forEach((k) => { delete saves[k]; });
        Object.assign(saves, next.saves);
        Object.assign(meta, next.meta);
      } else {
        return Response.json({ error: 'unknown-op' }, { status: 400 });
      }

      const saved = await this.saveBin({ history, saves, meta });
      return Response.json({
        ok: true,
        history: saved.history,
        saves: saved.saves,
        meta: saved.meta,
      });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}

export function normalizeStoredBin(raw) {
  const history = Array.isArray(raw?.history) ? raw.history.slice() : [];
  const saves = raw?.saves && typeof raw.saves === 'object' && !Array.isArray(raw.saves)
    ? { ...raw.saves }
    : {};
  const meta = raw?.meta && typeof raw.meta === 'object'
    ? {
      importedFromJsonbin: !!raw.meta.importedFromJsonbin,
      importAttemptedAt: Number(raw.meta.importAttemptedAt) || 0,
    }
    : { importedFromJsonbin: false, importAttemptedAt: 0 };
  return { history, saves, meta };
}
