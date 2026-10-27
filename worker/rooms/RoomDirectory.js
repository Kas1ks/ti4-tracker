import { isHubPartyEnded } from './roomCore.js';

/**
 * Global index of live rooms for hub "Активные партии".
 * One Durable Object (name: global) stores compact hub cards by roomId.
 */
export class RoomDirectory {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    if (method === 'GET' && path.endsWith('/list')) {
      const map = await this.ctx.storage.list({ prefix: 'room:' });
      const rooms = [];
      const now = Date.now();
      for (const [key, value] of map) {
        if (!value?.roomId) {
          await this.ctx.storage.delete(key);
          continue;
        }
        const exp = value.expiresAt ? Date.parse(value.expiresAt) : NaN;
        if (Number.isFinite(exp) && exp <= now) {
          await this.ctx.storage.delete(key);
          continue;
        }
        // Drop finished parties left over before directoryRemove-on-end.
        if (isHubPartyEnded(value)) {
          await this.ctx.storage.delete(key);
          continue;
        }
        rooms.push(value);
      }
      rooms.sort((a, b) => {
        const ta = Date.parse(a.lastActivityAt || a.updatedAt || 0) || 0;
        const tb = Date.parse(b.lastActivityAt || b.updatedAt || 0) || 0;
        return tb - ta;
      });
      return Response.json({ rooms });
    }

    if (method === 'POST' && path.endsWith('/upsert')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const roomId = String(body?.roomId || '').trim().toUpperCase();
      if (!roomId) return Response.json({ error: 'missing-room' }, { status: 400 });
      const card = { ...body, roomId };
      await this.ctx.storage.put(`room:${roomId}`, card);
      return Response.json({ ok: true });
    }

    if (method === 'POST' && path.endsWith('/remove')) {
      const roomId = String(url.searchParams.get('roomId') || '').trim().toUpperCase();
      if (!roomId) return Response.json({ error: 'missing-room' }, { status: 400 });
      await this.ctx.storage.delete(`room:${roomId}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}
