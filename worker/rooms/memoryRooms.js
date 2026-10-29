import {
  applyRoomAction,
  createRoomRecord,
  hubRoomCard,
  hydrateRoomLifecycle,
  isRoomExpired,
  joinRoom,
  hostClaimSeat,
  releaseSeat,
  publicRoomView,
  adminSessionFromRoom,
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
import { logRoomEvent, measureMs } from './roomLog.js';
import { notifyNeedsAction, removePushSub, upsertPushSub } from './pushNotify.js';
import { undoStackDepth } from '../../src/sync/undoStack';

/**
 * Process-local rooms for Vite `npm run dev`.
 */
const rooms = new Map();
const listeners = new Map();

function notify(roomId, payload) {
  const set = listeners.get(roomId);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch (err) {
      console.error('[memoryRooms] listener', err);
    }
  }
}

function purgeIfExpired(roomId) {
  const key = String(roomId || '').toUpperCase();
  const room = rooms.get(key);
  if (!room) return null;
  const hydrated = hydrateRoomLifecycle(room);
  if (isRoomExpired(hydrated)) {
    logRoomEvent('room_expire', {
      backend: 'memory',
      roomId: key,
      sseListeners: listeners.get(key)?.size || 0,
      undoDepth: undoStackDepth(hydrated.undoStack),
    });
    rooms.delete(key);
    listeners.delete(key);
    return null;
  }
  if (hydrated !== room) rooms.set(key, hydrated);
  return hydrated;
}

export function memoryCreateRoom(initialState, { milty } = {}) {
  let room = createRoomRecord(initialState);
  if (milty?.draftId && milty?.adminSecret) {
    room = {
      ...room,
      hubListed: false,
      milty: {
        draftId: String(milty.draftId).toUpperCase(),
        status: 'drafting',
        adminSecret: String(milty.adminSecret),
        seatSecrets: {},
      },
    };
  }
  rooms.set(room.roomId, room);
  logRoomEvent('room_create', {
    backend: 'memory',
    roomId: room.roomId,
    players: room.state?.players?.length ?? 0,
    milty: !!room.milty,
  });
  return room;
}

export function memoryGetRoom(roomId) {
  return purgeIfExpired(roomId);
}


export async function memoryJoin(roomId, body, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = joinRoom(room, body);
  if (!result.ok) return result;
  let nextRoom = result.room;
  let miltySecret = null;
  if (isMiltyDrafting(nextRoom) && result.seatPlayerId != null) {
    const bound = await bindMiltySeat(env, nextRoom, result.seatPlayerId);
    nextRoom = bound.room;
    miltySecret = bound.miltySecret;
  }
  rooms.set(key, nextRoom);
  const joinedView = publicRoomView(nextRoom);
  notify(key, {
    type: 'seats',
    claimedSeats: joinedView.claimedSeats,
    securedSeats: joinedView.securedSeats,
    reclaimed: !!result.reclaimed,
    seatPlayerId: result.seatPlayerId,
    revokedSessionToken: result.revokedSessionToken || null,
  });
  return { ...result, room: nextRoom, miltySecret };
}

export async function memoryMiltyPromote(roomId, { hostKey } = {}, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  if (!hostKey || hostKey !== room.hostKey) return { ok: false, error: 'unauthorized' };
  if (!room.milty?.draftId) return { ok: false, error: 'no-milty' };
  const draftRes = await getMiltyInEnv(env, room.milty.draftId, {
    adminSecret: room.milty.adminSecret,
  });
  if (!draftRes.ok) return { ok: false, error: draftRes.error || 'draft-missing' };
  if (!draftRes.draft?.done) return { ok: false, error: 'draft-not-done' };
  const applied = applyMiltyResultToRoom(room, draftRes.draft);
  if (!applied.ok) return applied;
  rooms.set(key, applied.room);
  notify(key, {
    type: 'state',
    seq: applied.room.seq,
    state: applied.room.state,
    milty: publicRoomView(applied.room).milty,
    phase: 'setup',
  });
  return { ok: true, room: applied.room };
}

export async function memoryMiltyPick(roomId, body = {}, env = {}) {
  const key = String(roomId || '').toUpperCase();
  let room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  if (!isMiltyDrafting(room)) return { ok: false, error: 'no-milty' };
  const session = body.sessionToken ? room.sessions?.[body.sessionToken] : null;
  const isHost = body.hostKey && body.hostKey === room.hostKey;
  if (!isHost && (!session || session.role === ROLES.VIEWER)) {
    return { ok: false, error: 'unauthorized' };
  }
  const playerId = body.playerId != null
    ? body.playerId
    : (isHost ? null : session.seatPlayerId);
  if (playerId == null) return { ok: false, error: 'missing-player' };
  if (!isHost && String(session.seatPlayerId) !== String(playerId)) {
    return { ok: false, error: 'not-your-seat' };
  }

  let miltySecret = room.milty?.seatSecrets?.[String(playerId)] || null;
  if (!miltySecret && !isHost) {
    const bound = await bindMiltySeat(env, room, playerId);
    room = bound.room;
    miltySecret = bound.miltySecret;
    rooms.set(key, room);
    if (!miltySecret) return { ok: false, error: bound.error || 'milty-bind-failed' };
  }

  const before = await getMiltyInEnv(env, room.milty.draftId);
  const prevId = before.ok ? before.draft?.currentPlayerId : null;
  const picked = await pickMiltyInEnv(env, room.milty.draftId, {
    playerId: String(playerId),
    category: body.category,
    value: body.value,
    secret: miltySecret,
    adminSecret: isHost ? room.milty.adminSecret : undefined,
    logIndex: body.logIndex,
  });
  if (!picked?.ok) return { ok: false, error: picked?.error || 'pick-failed' };
  let nextRoom = await notifyMiltyTurn(
    env,
    room,
    prevId,
    picked.draft?.currentPlayerId,
    { done: !!picked.draft?.done },
  );
  rooms.set(key, nextRoom);
  notify(key, { type: 'milty', draft: picked.draft, milty: publicRoomView(nextRoom).milty });
  return { ok: true, draft: picked.draft, room: nextRoom };
}

export async function memoryMiltyUndo(roomId, { hostKey } = {}, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  if (!hostKey || hostKey !== room.hostKey) return { ok: false, error: 'unauthorized' };
  if (!room.milty?.draftId) return { ok: false, error: 'no-milty' };
  const undone = await undoMiltyInEnv(env, room.milty.draftId, {
    adminSecret: room.milty.adminSecret,
  });
  if (!undone?.ok) return { ok: false, error: undone?.error || 'undo-failed' };
  notify(key, { type: 'milty', draft: undone.draft, milty: publicRoomView(room).milty });
  return { ok: true, draft: undone.draft, room };
}

export async function memoryMiltyRegen(roomId, { hostKey, part } = {}, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  if (!hostKey || hostKey !== room.hostKey) return { ok: false, error: 'unauthorized' };
  if (!room.milty?.draftId) return { ok: false, error: 'no-milty' };
  const regen = await regenMiltyInEnv(env, room.milty.draftId, {
    part,
    adminSecret: room.milty.adminSecret,
  });
  if (!regen?.ok) return { ok: false, error: regen?.error || 'regen-failed' };
  notify(key, { type: 'milty', draft: regen.draft, milty: publicRoomView(room).milty });
  return { ok: true, draft: regen.draft, room };
}

export async function memoryReleaseSeat(roomId, body, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = releaseSeat(room, body?.seatPlayerId, {
    sessionToken: body?.sessionToken,
    hostKey: body?.hostKey,
  });
  if (!result.ok) return result;
  let nextRoom = result.room;
  if (isMiltyDrafting(nextRoom)) {
    const unbound = await unbindMiltySeat(env, nextRoom, result.seatPlayerId);
    nextRoom = unbound.room;
  }
  rooms.set(key, nextRoom);
  const releasedView = publicRoomView(nextRoom);
  notify(key, {
    type: 'seats',
    claimedSeats: releasedView.claimedSeats,
    securedSeats: releasedView.securedSeats,
    reclaimed: true,
    seatPlayerId: result.seatPlayerId,
    revokedSessionToken: result.revokedSessionToken || null,
    released: true,
  });
  if (isMiltyDrafting(nextRoom)) {
    const snap = await getMiltyInEnv(env, nextRoom.milty.draftId);
    if (snap?.ok) notify(key, { type: 'milty', draft: snap.draft, milty: releasedView.milty });
  }
  return { ...result, room: nextRoom };
}

export async function memoryHostClaimSeat(roomId, body = {}, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = hostClaimSeat(room, body?.seatPlayerId, {
    sessionToken: body?.sessionToken,
    hostKey: body?.hostKey,
  });
  if (!result.ok) return result;
  let nextRoom = result.room;
  let miltySecret = null;
  if (isMiltyDrafting(nextRoom) && result.seatPlayerId != null) {
    const bound = await bindMiltySeat(env, nextRoom, result.seatPlayerId);
    nextRoom = bound.room;
    miltySecret = bound.miltySecret;
    if (!miltySecret && bound.error) {
      return { ok: false, error: bound.error };
    }
  }
  rooms.set(key, nextRoom);
  const view = publicRoomView(nextRoom);
  notify(key, {
    type: 'seats',
    claimedSeats: view.claimedSeats,
    securedSeats: view.securedSeats,
    seatPlayerId: result.seatPlayerId,
  });
  if (isMiltyDrafting(nextRoom)) {
    const snap = await getMiltyInEnv(env, nextRoom.milty.draftId);
    if (snap?.ok) notify(key, { type: 'milty', draft: snap.draft, milty: view.milty });
  }
  return {
    ok: true,
    room: nextRoom,
    seatPlayerId: result.seatPlayerId,
    seatSecret: result.seatSecret,
    miltySecret,
    role: result.role,
  };
}

export function memoryApplyAction(roomId, action, auth, env = {}) {
  const key = String(roomId || '').toUpperCase();
  const started = Date.now();
  const room = purgeIfExpired(key);
  if (!room) {
    logRoomEvent('action', {
      backend: 'memory',
      roomId: key,
      actionType: action?.type || null,
      ok: false,
      error: 'not-found',
      durationMs: measureMs(started),
    });
    return { ok: false, error: 'not-found' };
  }

  const result = applyRoomAction(room, action, auth);
  if (!result.ok) {
    logRoomEvent('action', {
      backend: 'memory',
      roomId: key,
      actionType: action?.type || null,
      ok: false,
      error: result.error || 'error',
      durationMs: measureMs(started),
      seq: room.seq,
      undoDepth: undoStackDepth(room.undoStack),
      sseListeners: listeners.get(key)?.size || 0,
    });
    return result;
  }

  let saved = result.room;
  if (result.roomEnded) {
    saved = { ...saved, pushSubs: {} };
  }
  rooms.set(key, saved);
  if (!result.noop) {
    notify(key, {
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
      notify(key, {
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
    if (!result.roomEnded) {
      notifyNeedsAction(env, room, saved).then((updated) => {
        if (updated && updated !== saved) rooms.set(key, updated);
      }).catch(() => {});
    }
  }

  logRoomEvent('action', {
    backend: 'memory',
    roomId: key,
    actionType: action?.type || null,
    ok: true,
    noop: !!result.noop,
    durationMs: measureMs(started),
    seq: saved.seq,
    undoDepth: undoStackDepth(saved.undoStack),
    sseListeners: listeners.get(key)?.size || 0,
    roomEnded: !!result.roomEnded,
  });
  return { ...result, room: saved };
}

export function memoryPushSubscribe(roomId, body) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const sessionToken = String(body?.sessionToken || '').trim();
  const session = room.sessions?.[sessionToken];
  if (!session) return { ok: false, error: 'unauthorized' };
  if (session.role === ROLES.VIEWER) return { ok: false, error: 'viewers-no-push' };
  const next = upsertPushSub(room, sessionToken, {
    subscription: body?.subscription,
    seatPlayerId: session.seatPlayerId ?? null,
    role: session.role,
  });
  rooms.set(key, next);
  return { ok: true, room: next };
}

export function memoryPushUnsubscribe(roomId, body) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const sessionToken = String(body?.sessionToken || '').trim();
  if (!sessionToken || !room.sessions?.[sessionToken]) {
    return { ok: false, error: 'unauthorized' };
  }
  const next = removePushSub(room, sessionToken);
  rooms.set(key, next);
  return { ok: true, room: next };
}

export function memorySubscribe(roomId, callback) {
  const key = String(roomId || '').toUpperCase();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  logRoomEvent('sse_connect', {
    backend: 'memory',
    roomId: key,
    sseListeners: listeners.get(key).size,
  });
  return () => {
    const set = listeners.get(key);
    if (!set) return;
    set.delete(callback);
    logRoomEvent('sse_disconnect', {
      backend: 'memory',
      roomId: key,
      sseListeners: set.size,
    });
    if (set.size === 0) listeners.delete(key);
  };
}

export function memoryPublicView(roomId) {
  const room = memoryGetRoom(roomId);
  return room ? publicRoomView(room) : null;
}

/** All non-expired live rooms as hub cards (Vite / memory backend). */
export function memoryListHubCards() {
  const cards = [];
  for (const roomId of [...rooms.keys()]) {
    const room = purgeIfExpired(roomId);
    if (!room) continue;
    const card = hubRoomCard(room);
    if (card) cards.push(card);
  }
  cards.sort((a, b) => {
    const ta = Date.parse(a.lastActivityAt || a.updatedAt || 0) || 0;
    const tb = Date.parse(b.lastActivityAt || b.updatedAt || 0) || 0;
    return tb - ta;
  });
  return cards;
}

export function memoryAdminSession(roomId) {
  const room = memoryGetRoom(roomId);
  return room ? adminSessionFromRoom(room) : null;
}
