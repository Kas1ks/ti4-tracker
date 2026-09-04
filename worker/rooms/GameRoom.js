import {
  applyRoomAction,
  createRoomRecord,
  joinRoom,
  releaseSeat,
  publicRoomView,
  adminSessionFromRoom,
} from './roomCore.js';

/**
 * One Durable Object = one live game room.
 */
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {Set<(chunk: string) => Promise<void>>} */
    this.sseWrites = new Set();
  }

  async load() {
    return (await this.ctx.storage.get('room')) || null;
  }

  async save(room) {
    await this.ctx.storage.put('room', room);
  }

  broadcast(payload) {
    const chunk = `data: ${JSON.stringify(payload)}\n\n`;
    for (const write of [...this.sseWrites]) {
      write(chunk).catch(() => {
        this.sseWrites.delete(write);
      });
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    if (method === 'POST' && path.endsWith('/create')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }

      const existing = await this.load();
      if (existing) {
        return Response.json({
          ...publicRoomView(existing),
          hostKey: existing.hostKey,
          sessionToken: adminSessionFromRoom(existing),
          role: 'admin',
          reused: true,
        });
      }

      const room = createRoomRecord(body?.state ?? null);
      const namedId = url.searchParams.get('roomId');
      if (namedId) room.roomId = namedId.toUpperCase();
      await this.save(room);
      return Response.json({
        ...publicRoomView(room),
        hostKey: room.hostKey,
        sessionToken: adminSessionFromRoom(room),
        role: 'admin',
      }, { status: 201 });
    }

    const room = await this.load();
    if (!room) {
      return Response.json({ error: 'not-found' }, { status: 404 });
    }

    if (method === 'GET' && path.endsWith('/snapshot')) {
      return Response.json(publicRoomView(room));
    }

    if (method === 'POST' && path.endsWith('/join')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const result = joinRoom(room, body || {});
      if (!result.ok) {
        const status = (result.error === 'seat-taken'
          || result.error === 'seat-secret-required'
          || result.error === 'bad-seat-secret') ? 409 : 400;
        return Response.json({ error: result.error }, { status });
      }
      await this.save(result.room);
      this.broadcast({
        type: 'seats',
        claimedSeats: publicRoomView(result.room).claimedSeats,
        reclaimed: !!result.reclaimed,
        seatPlayerId: result.seatPlayerId,
        revokedSessionToken: result.revokedSessionToken || null,
      });
      return Response.json({
        ...publicRoomView(result.room),
        sessionToken: result.sessionToken,
        role: result.role,
        seatPlayerId: result.seatPlayerId,
        seatSecret: result.seatSecret,
        reclaimed: !!result.reclaimed,
      });
    }

    if (method === 'POST' && path.endsWith('/release-seat')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const released = releaseSeat(room, body?.seatPlayerId, {
        sessionToken: body?.sessionToken,
        hostKey: body?.hostKey,
      });
      if (!released.ok) {
        const status = released.error === 'unauthorized' || released.error === 'forbidden' ? 403 : 400;
        return Response.json({ error: released.error }, { status });
      }
      await this.save(released.room);
      this.broadcast({
        type: 'seats',
        claimedSeats: publicRoomView(released.room).claimedSeats,
        reclaimed: true,
        released: true,
        seatPlayerId: released.seatPlayerId,
        revokedSessionToken: released.revokedSessionToken || null,
      });
      return Response.json({
        ...publicRoomView(released.room),
        seatPlayerId: released.seatPlayerId,
      });
    }

    if (method === 'POST' && path.endsWith('/actions')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }

      const result = applyRoomAction(room, body?.action, {
        sessionToken: body?.sessionToken,
        hostKey: body?.hostKey,
      });
      if (!result.ok) {
        const status = result.error === 'unauthorized' || result.error === 'forbidden'
          ? 403
          : 400;
        return Response.json({ error: result.error }, { status });
      }

      await this.save(result.room);
      if (!result.noop) {
        this.broadcast({
          type: 'state',
          seq: result.room.seq,
          state: result.room.state,
          action: result.action,
          claimedSeats: publicRoomView(result.room).claimedSeats,
        });
      }

      return Response.json({
        seq: result.room.seq,
        state: result.room.state,
        noop: !!result.noop,
      });
    }

    if (method === 'GET' && path.endsWith('/events')) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const write = (text) => writer.write(encoder.encode(text));

      this.sseWrites.add(write);
      write(`data: ${JSON.stringify({ type: 'hello', ...publicRoomView(room) })}\n\n`);

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
      request.signal.addEventListener('abort', cleanup);

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    return Response.json({ error: 'not-found' }, { status: 404 });
  }
}
