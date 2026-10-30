import {
  applyPick,
  claimPlayer,
  createDraftDocument,
  publicDraftView,
  regenerateDraftParts,
  unclaimPlayer,
  undoLastPick,
} from '../../src/milty/draftEngine.js';

const TTL_MS = 48 * 60 * 60 * 1000;

/**
 * One Durable Object = one milty draft session.
 */
export class MiltyDraft {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {Set<(chunk: string) => Promise<void>>} */
    this.sseWrites = new Set();
  }

  async load() {
    return (await this.ctx.storage.get('draft')) || null;
  }

  async save(draft) {
    await this.ctx.storage.put('draft', draft);
    await this.ctx.storage.setAlarm(Date.now() + TTL_MS);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
    this.sseWrites.clear();
  }

  broadcast(draft) {
    const payload = `data: ${JSON.stringify({ type: 'state', draft: publicDraftView(draft) })}\n\n`;
    for (const write of [...this.sseWrites]) {
      write(payload).catch(() => {
        this.sseWrites.delete(write);
      });
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    if (method === 'POST' && path.endsWith('/create')) {
      const body = await request.json().catch(() => ({}));
      const draft = createDraftDocument(body?.settings || body || {});
      draft.id = String(body?.id || '').toUpperCase();
      if (!draft.id) return Response.json({ error: 'missing-id' }, { status: 400 });
      await this.save(draft);
      return Response.json({
        ok: true,
        id: draft.id,
        adminSecret: draft.adminSecret,
        draft: publicDraftView(draft, { adminSecret: draft.adminSecret }),
      });
    }

    const draft = await this.load();
    if (!draft && !path.endsWith('/create')) {
      return Response.json({ error: 'not-found' }, { status: 404 });
    }

    if (method === 'GET' && (path.endsWith('/snapshot') || path.endsWith('/'))) {
      const playerId = url.searchParams.get('playerId');
      const secret = url.searchParams.get('secret');
      const adminSecret = url.searchParams.get('admin');
      return Response.json({
        ok: true,
        draft: publicDraftView(draft, {
          playerId,
          playerSecret: secret,
          adminSecret,
        }),
      });
    }

    if (method === 'GET' && path.endsWith('/events')) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const write = async (chunk) => {
        await writer.write(typeof chunk === 'string' ? encoder.encode(chunk) : chunk);
      };
      this.sseWrites.add(write);
      await write(`data: ${JSON.stringify({ type: 'state', draft: publicDraftView(draft) })}\n\n`);
      const heartbeat = setInterval(() => {
        write(': ping\n\n').catch(() => {
          clearInterval(heartbeat);
          this.sseWrites.delete(write);
        });
      }, 15000);
      const cleanup = () => {
        clearInterval(heartbeat);
        this.sseWrites.delete(write);
        writer.close().catch(() => {});
      };
      request.signal?.addEventListener('abort', cleanup);
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    if (method === 'POST' && path.endsWith('/claim')) {
      const body = await request.json().catch(() => ({}));
      const result = claimPlayer(draft, body);
      if (!result.ok) return Response.json(result, { status: 400 });
      await this.save(draft);
      this.broadcast(draft);
      return Response.json({
        ok: true,
        playerId: result.playerId,
        secret: result.secret,
        draft: publicDraftView(draft, {
          playerId: result.playerId,
          playerSecret: result.secret,
        }),
      });
    }

    if (method === 'POST' && path.endsWith('/unclaim')) {
      const body = await request.json().catch(() => ({}));
      const result = unclaimPlayer(draft, body);
      if (!result.ok) {
        const status = result.error === 'forbidden' ? 403 : 400;
        return Response.json(result, { status });
      }
      await this.save(draft);
      this.broadcast(draft);
      return Response.json({
        ok: true,
        playerId: result.playerId,
        draft: publicDraftView(draft, {
          playerId: body.playerId,
          playerSecret: body.secret,
          adminSecret: body.adminSecret,
        }),
      });
    }

    if (method === 'POST' && path.endsWith('/pick')) {
      const body = await request.json().catch(() => ({}));
      const result = applyPick(draft, body);
      if (!result.ok) {
        const status = result.error === 'stale' ? 409 : result.error === 'forbidden' ? 403 : 400;
        return Response.json(result, { status });
      }
      await this.save(draft);
      this.broadcast(draft);
      return Response.json({
        ok: true,
        draft: publicDraftView(draft, {
          playerId: body.playerId,
          playerSecret: body.secret,
          adminSecret: body.adminSecret,
        }),
      });
    }

    if (method === 'POST' && path.endsWith('/undo')) {
      const body = await request.json().catch(() => ({}));
      const result = undoLastPick(draft, body);
      if (!result.ok) {
        return Response.json(result, { status: result.error === 'forbidden' ? 403 : 400 });
      }
      await this.save(draft);
      this.broadcast(draft);
      return Response.json({
        ok: true,
        draft: publicDraftView(draft, { adminSecret: body.adminSecret }),
      });
    }

    if (method === 'POST' && path.endsWith('/regen')) {
      const body = await request.json().catch(() => ({}));
      const result = regenerateDraftParts(draft, body?.parts ?? body?.part, {
        adminSecret: body?.adminSecret,
      });
      if (!result.ok) {
        return Response.json(result, { status: result.error === 'forbidden' ? 403 : 400 });
      }
      await this.save(draft);
      this.broadcast(draft);
      return Response.json({
        ok: true,
        draft: publicDraftView(draft, { adminSecret: body.adminSecret }),
        parts: result.parts,
      });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}
