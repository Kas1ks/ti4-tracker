import {
  applyRoomAction,
  createRoomRecord,
  hydrateRoomLifecycle,
  isRoomExpired,
  joinRoom,
  releaseSeat,
  publicRoomView,
  adminSessionFromRoom,
  ROLES,
} from './roomCore.js';
import { directoryRemove, directoryUpsert } from './roomIndex.js';
import { logRoomEvent, measureMs } from './roomLog.js';
import { notifyNeedsAction, removePushSub, upsertPushSub } from './pushNotify.js';
import { undoStackDepth } from '../../src/sync/undoStack';

/**
 * One Durable Object = one live game room.
 * Idle rooms expire via storage alarm (see roomCore TTL helpers).
 */
export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {Set<(chunk: string) => Promise<void>>} */
    this.sseWrites = new Set();
  }

  async load() {
    const raw = (await this.ctx.storage.get('room')) || null;
    return hydrateRoomLifecycle(raw);
  }

  async save(room) {
    await this.ctx.storage.put('room', room);
    await this.scheduleExpiry(room);
  }

  async scheduleExpiry(room) {
    if (!room?.expiresAt) return;
    const at = Date.parse(room.expiresAt);
    if (!Number.isFinite(at)) return;
    // DO alarms must be in the future; clamp tiny skew.
    const when = Math.max(at, Date.now() + 1000);
    await this.ctx.storage.setAlarm(when);
  }

  async wipeExpired() {
    const room = await this.load().catch(() => null);
    logRoomEvent('room_expire', {
      backend: 'do',
      roomId: room?.roomId || null,
      sseListeners: this.sseWrites.size,
      undoDepth: undoStackDepth(room?.undoStack),
    });
    if (room?.roomId) {
      this.ctx.waitUntil(directoryRemove(this.env, room.roomId));
    }
    for (const write of [...this.sseWrites]) {
      this.sseWrites.delete(write);
    }
    await this.ctx.storage.deleteAll();
  }

  trackInDirectory(room) {
    if (!room) return;
    this.ctx.waitUntil(directoryUpsert(this.env, room));
  }

  async alarm() {
    const room = await this.load();
    if (!room || isRoomExpired(room)) {
      await this.wipeExpired();
      return;
    }
    await this.scheduleExpiry(room);
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
        if (isRoomExpired(existing)) {
          await this.wipeExpired();
        } else {
          this.trackInDirectory(existing);
          return Response.json({
            ...publicRoomView(existing),
            hostKey: existing.hostKey,
            sessionToken: adminSessionFromRoom(existing),
            role: 'admin',
            reused: true,
          });
        }
      }

      const room = createRoomRecord(body?.state ?? null);
      const namedId = url.searchParams.get('roomId');
      if (namedId) room.roomId = namedId.toUpperCase();
      await this.save(room);
      this.trackInDirectory(room);
      logRoomEvent('room_create', {
        backend: 'do',
        roomId: room.roomId,
        players: room.state?.players?.length ?? 0,
      });
      return Response.json({
        ...publicRoomView(room),
        hostKey: room.hostKey,
        sessionToken: adminSessionFromRoom(room),
        role: 'admin',
      }, { status: 201 });
    }

    let room = await this.load();
    if (!room) {
      return Response.json({ error: 'not-found' }, { status: 404 });
    }
    if (isRoomExpired(room)) {
      await this.wipeExpired();
      return Response.json({ error: 'not-found', expired: true }, { status: 404 });
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
      this.trackInDirectory(result.room);
      const joinedView = publicRoomView(result.room);
      this.broadcast({
        type: 'seats',
        claimedSeats: joinedView.claimedSeats,
        securedSeats: joinedView.securedSeats,
        reclaimed: !!result.reclaimed,
        seatPlayerId: result.seatPlayerId,
        revokedSessionToken: result.revokedSessionToken || null,
      });
      return Response.json({
        ...joinedView,
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
      this.trackInDirectory(released.room);
      const releasedView = publicRoomView(released.room);
      this.broadcast({
        type: 'seats',
        claimedSeats: releasedView.claimedSeats,
        securedSeats: releasedView.securedSeats,
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

      const started = Date.now();
      const result = applyRoomAction(room, body?.action, {
        sessionToken: body?.sessionToken,
        hostKey: body?.hostKey,
      });
      if (!result.ok) {
        logRoomEvent('action', {
          backend: 'do',
          roomId: room.roomId,
          actionType: body?.action?.type || null,
          ok: false,
          error: result.error || 'error',
          durationMs: measureMs(started),
          seq: room.seq,
          undoDepth: undoStackDepth(room.undoStack),
          sseListeners: this.sseWrites.size,
        });
        const status = result.error === 'unauthorized' || result.error === 'forbidden'
          ? 403
          : 400;
        return Response.json({ error: result.error }, { status });
      }

      let saved = result.room;
      if (result.roomEnded) {
        saved = { ...saved, pushSubs: {} };
      }
      await this.save(saved);
      if (!result.noop) {
        if (result.roomEnded) {
          this.ctx.waitUntil(directoryRemove(this.env, saved.roomId));
        } else {
          this.trackInDirectory(saved);
          this.ctx.waitUntil(
            notifyNeedsAction(this.env, room, saved).then(async (updated) => {
              if (updated !== saved) await this.save(updated);
            }),
          );
        }
        this.broadcast({
          type: 'state',
          seq: saved.seq,
          state: saved.state,
          action: result.action,
          claimedSeats: publicRoomView(saved).claimedSeats,
          canUndo: !!result.canUndo,
          roomEnded: !!result.roomEnded,
          seatRemoved: !!result.seatRemoved,
          seatPlayerId: result.seatPlayerId ?? null,
          revokedSessionToken: result.revokedSessionToken || null,
        });
        if (result.seatRemoved && result.revokedSessionToken) {
          const removedView = publicRoomView(saved);
          this.broadcast({
            type: 'seats',
            claimedSeats: removedView.claimedSeats,
            securedSeats: removedView.securedSeats,
            reclaimed: true,
            released: true,
            seatRemoved: true,
            seatPlayerId: result.seatPlayerId,
            revokedSessionToken: result.revokedSessionToken,
          });
        }
      }

      logRoomEvent('action', {
        backend: 'do',
        roomId: room.roomId,
        actionType: body?.action?.type || null,
        ok: true,
        noop: !!result.noop,
        durationMs: measureMs(started),
        seq: saved.seq,
        undoDepth: undoStackDepth(saved.undoStack),
        sseListeners: this.sseWrites.size,
        roomEnded: !!result.roomEnded,
      });

      return Response.json({
        seq: saved.seq,
        state: saved.state,
        noop: !!result.noop,
        canUndo: !!result.canUndo,
      });
    }

    if (method === 'POST' && path.endsWith('/push/subscribe')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const sessionToken = String(body?.sessionToken || '').trim();
      const session = room.sessions?.[sessionToken];
      if (!session) return Response.json({ error: 'unauthorized' }, { status: 403 });
      if (session.role === ROLES.VIEWER) {
        return Response.json({ error: 'viewers-no-push' }, { status: 400 });
      }
      const next = upsertPushSub(room, sessionToken, {
        subscription: body?.subscription,
        seatPlayerId: session.seatPlayerId ?? null,
        role: session.role,
      });
      await this.save(next);
      return Response.json({ ok: true });
    }

    if (method === 'POST' && path.endsWith('/push/unsubscribe')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const sessionToken = String(body?.sessionToken || '').trim();
      if (!sessionToken || !room.sessions?.[sessionToken]) {
        return Response.json({ error: 'unauthorized' }, { status: 403 });
      }
      const next = removePushSub(room, sessionToken);
      await this.save(next);
      return Response.json({ ok: true });
    }

    if (method === 'GET' && path.endsWith('/events')) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const write = (text) => writer.write(encoder.encode(text));

      this.sseWrites.add(write);
      logRoomEvent('sse_connect', {
        backend: 'do',
        roomId: room.roomId,
        sseListeners: this.sseWrites.size,
      });
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
        logRoomEvent('sse_disconnect', {
          backend: 'do',
          roomId: room.roomId,
          sseListeners: this.sseWrites.size,
        });
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
