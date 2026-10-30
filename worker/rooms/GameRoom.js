import {
  applyRoomAction,
  createRoomRecord,
  hydrateRoomLifecycle,
  isRoomExpired,
  joinRoom,
  claimHostByKey,
  hostClaimSeat,
  releaseSeat,
  publicRoomView,
  adminSessionFromRoom,
  redactStateForSession,
  sessionAuthFromRoom,
  ROLES,
} from './roomCore.js';
import {
  applyMiltyResultToRoom,
  bindMiltySeat,
  getMiltyInEnv,
  isMiltyDrafting,
  notifyMiltyTurn,
  pickMiltyInEnv,
  regenMiltyInEnv,
  unbindMiltySeat,
  undoMiltyInEnv,
} from './miltyAttach.js';
import { directoryRemove, directoryUpsert } from './roomIndex.js';
import { logRoomEvent, measureMs } from './roomLog.js';
import { notifyNeedsAction, removePushSub, upsertPushSub } from './pushNotify.js';
import { undoStackDepth } from '../../src/sync/undoStack';

/**
 * One Durable Object = one live game room.
 * Idle rooms expire via storage alarm (see roomCore TTL helpers).
 */
/** After last host SSE drops, wait this long before marking host offline (party stays alive). */
const HOST_OFFLINE_GRACE_MS = 120_000;

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /**
     * SSE clients: { write, role, seatPlayerId, isAdmin }
     * @type {Set<{ write: (chunk: string) => Promise<void>, role: string, seatPlayerId: *, isAdmin: boolean }>}
     */
    this.sseClients = new Set();
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.hostOfflineTimer = null;
  }

  get sseWritesSize() {
    return this.sseClients.size;
  }

  get adminSseWritesSize() {
    let n = 0;
    for (const c of this.sseClients) {
      if (c.isAdmin) n += 1;
    }
    return n;
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
      sseListeners: this.sseClients.size,
      undoDepth: undoStackDepth(room?.undoStack),
    });
    if (room?.roomId) {
      this.ctx.waitUntil(directoryRemove(this.env, room.roomId));
    }
    this.sseClients.clear();
    await this.ctx.storage.deleteAll();
  }

  trackInDirectory(room) {
    if (!room) return;
    this.ctx.waitUntil(directoryUpsert(this.env, room));
  }

  clearHostOfflineTimer() {
    if (this.hostOfflineTimer) {
      clearTimeout(this.hostOfflineTimer);
      this.hostOfflineTimer = null;
    }
  }

  /** Host SSE reconnected — keep room listed and notify clients. */
  async markHostOnline() {
    this.clearHostOfflineTimer();
    const room = await this.load();
    if (!room || room.partyEnded) return;
    if (room.hostOnline !== false) {
      this.trackInDirectory({ ...room, hostOnline: true });
      return;
    }
    const next = { ...room, hostOnline: true };
    await this.save(next);
    this.trackInDirectory(next);
    this.broadcast({
      type: 'host',
      hostOnline: true,
      seq: next.seq,
    });
  }

  /**
   * Last host SSE gone: grace period, then soft-offline (keep state; hide from hub).
   * Explicit RESET_GAME / «Завершить партию» still ends the party.
   */
  scheduleHostOffline() {
    this.clearHostOfflineTimer();
    this.hostOfflineTimer = setTimeout(() => {
      this.hostOfflineTimer = null;
      this.ctx.waitUntil(this.endPartyHostOffline());
    }, HOST_OFFLINE_GRACE_MS);
  }

  async endPartyHostOffline() {
    if (this.adminSseWritesSize > 0) return;
    const room = await this.load();
    if (!room || room.partyEnded) {
      if (room?.roomId) await directoryRemove(this.env, room.roomId);
      return;
    }
    if (room.hostOnline === false) {
      await directoryRemove(this.env, room.roomId);
      return;
    }
    const next = { ...room, hostOnline: false };
    await this.save(next);
    await directoryRemove(this.env, next.roomId);
    this.broadcast({
      type: 'host',
      hostOnline: false,
      seq: next.seq,
    });
  }

  async alarm() {
    const room = await this.load();
    if (!room || isRoomExpired(room)) {
      await this.wipeExpired();
      return;
    }
    await this.scheduleExpiry(room);
  }

  /**
   * Fan-out SSE. When payload includes `state`, redact per-client session.
   * @param {object} payload
   */
  broadcast(payload) {
    for (const client of [...this.sseClients]) {
      let out = payload;
      if (payload && Object.prototype.hasOwnProperty.call(payload, 'state')) {
        out = {
          ...payload,
          state: redactStateForSession(payload.state, {
            role: client.role,
            seatPlayerId: client.seatPlayerId,
          }),
        };
      }
      const chunk = `data: ${JSON.stringify(out)}\n\n`;
      client.write(chunk).catch(() => {
        this.sseClients.delete(client);
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
          const adminTok = adminSessionFromRoom(existing);
          return Response.json({
            ...publicRoomView(existing, adminTok),
            hostKey: existing.hostKey,
            sessionToken: adminTok,
            role: 'admin',
            reused: true,
          });
        }
      }

      let room = createRoomRecord(body?.state ?? null);
      const namedId = url.searchParams.get('roomId');
      if (namedId) room.roomId = namedId.toUpperCase();
      if (body?.milty?.draftId && body?.milty?.adminSecret) {
        room = {
          ...room,
          hubListed: false,
          milty: {
            draftId: String(body.milty.draftId).toUpperCase(),
            status: 'drafting',
            adminSecret: String(body.milty.adminSecret),
            seatSecrets: {},
          },
        };
      }
      await this.save(room);
      this.trackInDirectory(room);
      logRoomEvent('room_create', {
        backend: 'do',
        roomId: room.roomId,
        players: room.state?.players?.length ?? 0,
        milty: !!room.milty,
      });
      const adminTok = adminSessionFromRoom(room);
      return Response.json({
        ...publicRoomView(room, adminTok),
        hostKey: room.hostKey,
        sessionToken: adminTok,
        role: 'admin',
        miltyAdminSecret: room.milty?.adminSecret || undefined,
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
      const token = String(url.searchParams.get('sessionToken') || '').trim();
      return Response.json(publicRoomView(room, token || null));
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
      let nextRoom = result.room;
      let miltySecret = null;
      if (isMiltyDrafting(nextRoom) && result.seatPlayerId != null) {
        const bound = await bindMiltySeat(this.env, nextRoom, result.seatPlayerId);
        nextRoom = bound.room;
        miltySecret = bound.miltySecret;
      }
      await this.save(nextRoom);
      this.trackInDirectory(nextRoom);
      const joinedView = publicRoomView(nextRoom, result.sessionToken);
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
        miltySecret,
        reclaimed: !!result.reclaimed,
      });
    }

    if (method === 'POST' && path.endsWith('/claim-host')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const result = claimHostByKey(room, body?.hostKey);
      if (!result.ok) {
        const status = result.error === 'bad-host-key' ? 403
          : result.error === 'party-ended' ? 409
            : 400;
        return Response.json({ error: result.error }, { status });
      }
      await this.save(result.room);
      this.clearHostOfflineTimer();
      this.trackInDirectory(result.room);
      const view = publicRoomView(result.room, result.sessionToken);
      const revoked = result.revokedSessionTokens || [];
      for (const token of revoked) {
        this.broadcast({
          type: 'seats',
          claimedSeats: view.claimedSeats,
          securedSeats: view.securedSeats,
          reclaimed: true,
          hostMoved: true,
          revokedSessionToken: token,
        });
      }
      if (!revoked.length) {
        this.broadcast({
          type: 'seats',
          claimedSeats: view.claimedSeats,
          securedSeats: view.securedSeats,
          hostMoved: true,
        });
      }
      return Response.json({
        ...view,
        sessionToken: result.sessionToken,
        hostKey: result.hostKey,
        role: result.role,
        seatPlayerId: result.seatPlayerId,
        seatSecret: result.seatSecret,
        miltyAdminSecret: result.room.milty?.adminSecret || undefined,
        reclaimed: !!result.reclaimed,
      });
    }

    if (method === 'POST' && path.endsWith('/milty/promote')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body?.hostKey || body.hostKey !== room.hostKey) {
        return Response.json({ error: 'unauthorized' }, { status: 403 });
      }
      if (!room.milty?.draftId) {
        return Response.json({ error: 'no-milty' }, { status: 400 });
      }
      const draftRes = await getMiltyInEnv(this.env, room.milty.draftId, {
        adminSecret: room.milty.adminSecret,
      });
      if (!draftRes.ok) {
        return Response.json({ error: draftRes.error || 'draft-missing' }, { status: 404 });
      }
      // Need full draft with done flag — public view is enough if done is present
      if (!draftRes.draft?.done) {
        return Response.json({ error: 'draft-not-done' }, { status: 400 });
      }
      // Re-fetch isn't full engine draft; assembleResult needs players with picks.
      // publicDraftView includes players/factionPool/slicePool/playerOrder — enough for assembleResult
      // if we pass a draft-shaped object.
      const applied = applyMiltyResultToRoom(room, draftRes.draft);
      if (!applied.ok) {
        return Response.json({ error: applied.error }, { status: 400 });
      }
      await this.save(applied.room);
      this.trackInDirectory(applied.room);
      const promoteTok = body?.sessionToken || adminSessionFromRoom(applied.room);
      this.broadcast({ type: 'state', seq: applied.room.seq, state: applied.room.state, milty: publicRoomView(applied.room).milty, phase: 'setup' });
      return Response.json(publicRoomView(applied.room, promoteTok));
    }

    if (method === 'POST' && path.endsWith('/milty/pick')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      if (!isMiltyDrafting(room)) {
        return Response.json({ error: 'no-milty' }, { status: 400 });
      }
      const session = body?.sessionToken ? room.sessions?.[body.sessionToken] : null;
      const isHost = body?.hostKey && body.hostKey === room.hostKey;
      if (!isHost && (!session || session.role === ROLES.VIEWER)) {
        return Response.json({ error: 'unauthorized' }, { status: 403 });
      }
      const playerId = body.playerId != null
        ? body.playerId
        : (isHost ? null : session.seatPlayerId);
      if (playerId == null) {
        return Response.json({ error: 'missing-player' }, { status: 400 });
      }
      if (!isHost && String(session.seatPlayerId) !== String(playerId)) {
        return Response.json({ error: 'not-your-seat' }, { status: 403 });
      }

      let nextRoom = room;
      let miltySecret = nextRoom.milty?.seatSecrets?.[String(playerId)] || null;
      if (!miltySecret && !isHost) {
        const bound = await bindMiltySeat(this.env, nextRoom, playerId);
        nextRoom = bound.room;
        miltySecret = bound.miltySecret;
        if (!miltySecret) {
          return Response.json({ error: bound.error || 'milty-bind-failed' }, { status: 400 });
        }
      }

      const before = await getMiltyInEnv(this.env, nextRoom.milty.draftId);
      const prevId = before.ok ? before.draft?.currentPlayerId : null;
      const picked = await pickMiltyInEnv(this.env, nextRoom.milty.draftId, {
        playerId: String(playerId),
        category: body.category,
        value: body.value,
        secret: miltySecret,
        adminSecret: isHost ? nextRoom.milty.adminSecret : undefined,
        logIndex: body.logIndex,
      });
      if (!picked?.ok) {
        return Response.json({ error: picked?.error || 'pick-failed' }, { status: 400 });
      }
      nextRoom = await notifyMiltyTurn(
        this.env,
        nextRoom,
        prevId,
        picked.draft?.currentPlayerId,
        { done: !!picked.draft?.done },
      );
      await this.save(nextRoom);
      this.broadcast({
        type: 'milty',
        draft: picked.draft,
        milty: publicRoomView(nextRoom).milty,
      });
      return Response.json({
        ok: true,
        draft: picked.draft,
        room: publicRoomView(nextRoom, body?.sessionToken),
      });
    }

    if (method === 'POST' && path.endsWith('/milty/undo')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body?.hostKey || body.hostKey !== room.hostKey) {
        return Response.json({ error: 'unauthorized' }, { status: 403 });
      }
      if (!room.milty?.draftId) {
        return Response.json({ error: 'no-milty' }, { status: 400 });
      }
      const undone = await undoMiltyInEnv(this.env, room.milty.draftId, {
        adminSecret: room.milty.adminSecret,
      });
      if (!undone?.ok) {
        return Response.json({ error: undone?.error || 'undo-failed' }, { status: 400 });
      }
      this.broadcast({ type: 'milty', draft: undone.draft, milty: publicRoomView(room).milty });
      const undoTok = body?.sessionToken || adminSessionFromRoom(room);
      return Response.json({
        ok: true,
        draft: undone.draft,
        room: publicRoomView(room, undoTok),
      });
    }

    if (method === 'POST' && path.endsWith('/milty/regen')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      if (!body?.hostKey || body.hostKey !== room.hostKey) {
        return Response.json({ error: 'unauthorized' }, { status: 403 });
      }
      if (!room.milty?.draftId) {
        return Response.json({ error: 'no-milty' }, { status: 400 });
      }
      const regen = await regenMiltyInEnv(this.env, room.milty.draftId, {
        part: body.part,
        parts: body.parts,
        adminSecret: room.milty.adminSecret,
      });
      if (!regen?.ok) {
        return Response.json({ error: regen?.error || 'regen-failed' }, { status: 400 });
      }
      this.broadcast({ type: 'milty', draft: regen.draft, milty: publicRoomView(room).milty });
      const regenTok = body?.sessionToken || adminSessionFromRoom(room);
      return Response.json({
        ok: true,
        draft: regen.draft,
        room: publicRoomView(room, regenTok),
        parts: regen.parts,
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
      let nextRoom = released.room;
      if (isMiltyDrafting(nextRoom)) {
        const unbound = await unbindMiltySeat(this.env, nextRoom, released.seatPlayerId);
        nextRoom = unbound.room;
      }
      await this.save(nextRoom);
      this.trackInDirectory(nextRoom);
      const releasedView = publicRoomView(nextRoom, body?.sessionToken);
      this.broadcast({
        type: 'seats',
        claimedSeats: releasedView.claimedSeats,
        securedSeats: releasedView.securedSeats,
        reclaimed: true,
        released: true,
        seatPlayerId: released.seatPlayerId,
        revokedSessionToken: released.revokedSessionToken || null,
      });
      if (isMiltyDrafting(nextRoom)) {
        const snap = await getMiltyInEnv(this.env, nextRoom.milty.draftId);
        if (snap?.ok) {
          this.broadcast({ type: 'milty', draft: snap.draft, milty: releasedView.milty });
        }
      }
      return Response.json({
        ...releasedView,
        seatPlayerId: released.seatPlayerId,
      });
    }

    if (method === 'POST' && path.endsWith('/claim-seat')) {
      let body = null;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid-body' }, { status: 400 });
      }
      const claimed = hostClaimSeat(room, body?.seatPlayerId, {
        sessionToken: body?.sessionToken,
        hostKey: body?.hostKey,
      });
      if (!claimed.ok) {
        const status = claimed.error === 'unauthorized' ? 403
          : claimed.error === 'seat-taken' ? 409
            : 400;
        return Response.json({ error: claimed.error }, { status });
      }
      let nextRoom = claimed.room;
      let miltySecret = null;
      if (isMiltyDrafting(nextRoom) && claimed.seatPlayerId != null) {
        const bound = await bindMiltySeat(this.env, nextRoom, claimed.seatPlayerId);
        nextRoom = bound.room;
        miltySecret = bound.miltySecret;
        if (!miltySecret && bound.error) {
          return Response.json({ error: bound.error }, { status: 400 });
        }
      }
      await this.save(nextRoom);
      this.trackInDirectory(nextRoom);
      const view = publicRoomView(nextRoom, body?.sessionToken);
      this.broadcast({
        type: 'seats',
        claimedSeats: view.claimedSeats,
        securedSeats: view.securedSeats,
        seatPlayerId: claimed.seatPlayerId,
      });
      if (isMiltyDrafting(nextRoom)) {
        const snap = await getMiltyInEnv(this.env, nextRoom.milty.draftId);
        if (snap?.ok) this.broadcast({ type: 'milty', draft: snap.draft, milty: view.milty });
      }
      return Response.json({
        ...view,
        seatPlayerId: claimed.seatPlayerId,
        seatSecret: claimed.seatSecret,
        miltySecret,
        role: claimed.role,
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
          sseListeners: this.sseClients.size,
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
        sseListeners: this.sseClients.size,
        roomEnded: !!result.roomEnded,
      });

      const actorSession = sessionAuthFromRoom(saved, body?.sessionToken);
      return Response.json({
        seq: saved.seq,
        state: redactStateForSession(saved.state, actorSession),
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
      const sessionToken = String(url.searchParams.get('sessionToken') || '').trim();
      const auth = sessionAuthFromRoom(room, sessionToken);
      const role = auth?.role || ROLES.VIEWER;
      const seatPlayerId = auth?.seatPlayerId ?? null;
      const isAdminSse = role === ROLES.ADMIN;
      const client = {
        write,
        role,
        seatPlayerId,
        isAdmin: isAdminSse,
      };

      this.sseClients.add(client);
      if (isAdminSse) {
        this.ctx.waitUntil(this.markHostOnline());
      }
      logRoomEvent('sse_connect', {
        backend: 'do',
        roomId: room.roomId,
        sseListeners: this.sseClients.size,
        adminSse: isAdminSse,
      });
      write(`data: ${JSON.stringify({ type: 'hello', ...publicRoomView(room, auth) })}\n\n`);

      const heartbeat = setInterval(() => {
        write(': ping\n\n').catch(() => {
          clearInterval(heartbeat);
          this.sseClients.delete(client);
        });
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        this.sseClients.delete(client);
        if (isAdminSse && this.adminSseWritesSize === 0) {
          this.scheduleHostOffline();
        }
        logRoomEvent('sse_disconnect', {
          backend: 'do',
          roomId: room.roomId,
          sseListeners: this.sseClients.size,
          adminSse: isAdminSse,
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
