import {
  applyRoomAction,
  createRoomRecord,
  hydrateRoomLifecycle,
  isRoomExpired,
  joinRoom,
  releaseSeat,
  publicRoomView,
  adminSessionFromRoom,
} from './roomCore.js';
import { logRoomEvent, measureMs } from './roomLog.js';
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

export function memoryCreateRoom(initialState) {
  const room = createRoomRecord(initialState);
  rooms.set(room.roomId, room);
  logRoomEvent('room_create', {
    backend: 'memory',
    roomId: room.roomId,
    players: room.state?.players?.length ?? 0,
  });
  return room;
}

export function memoryGetRoom(roomId) {
  return purgeIfExpired(roomId);
}


export function memoryJoin(roomId, body) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = joinRoom(room, body);
  if (!result.ok) return result;
  rooms.set(key, result.room);
  notify(key, {
    type: 'seats',
    claimedSeats: publicRoomView(result.room).claimedSeats,
    reclaimed: !!result.reclaimed,
    seatPlayerId: result.seatPlayerId,
    revokedSessionToken: result.revokedSessionToken || null,
  });
  return result;
}

export function memoryReleaseSeat(roomId, body) {
  const key = String(roomId || '').toUpperCase();
  const room = purgeIfExpired(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = releaseSeat(room, body?.seatPlayerId, {
    sessionToken: body?.sessionToken,
    hostKey: body?.hostKey,
  });
  if (!result.ok) return result;
  rooms.set(key, result.room);
  notify(key, {
    type: 'seats',
    claimedSeats: publicRoomView(result.room).claimedSeats,
    reclaimed: true,
    seatPlayerId: result.seatPlayerId,
    revokedSessionToken: result.revokedSessionToken || null,
    released: true,
  });
  return result;
}

export function memoryApplyAction(roomId, action, auth) {
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

  rooms.set(key, result.room);
  if (!result.noop) {
    notify(key, {
      type: 'state',
      seq: result.room.seq,
      state: result.room.state,
      action: result.action,
      claimedSeats: publicRoomView(result.room).claimedSeats,
      canUndo: !!result.canUndo,
      roomEnded: !!result.roomEnded,
      seatRemoved: !!result.seatRemoved,
      seatPlayerId: result.seatPlayerId ?? null,
      revokedSessionToken: result.revokedSessionToken || null,
    });
    if (result.seatRemoved && result.revokedSessionToken) {
      notify(key, {
        type: 'seats',
        claimedSeats: publicRoomView(result.room).claimedSeats,
        reclaimed: true,
        released: true,
        seatRemoved: true,
        seatPlayerId: result.seatPlayerId,
        revokedSessionToken: result.revokedSessionToken,
      });
    }
  }

  logRoomEvent('action', {
    backend: 'memory',
    roomId: key,
    actionType: action?.type || null,
    ok: true,
    noop: !!result.noop,
    durationMs: measureMs(started),
    seq: result.room.seq,
    undoDepth: undoStackDepth(result.room.undoStack),
    sseListeners: listeners.get(key)?.size || 0,
    roomEnded: !!result.roomEnded,
  });
  return result;
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

export function memoryAdminSession(roomId) {
  const room = memoryGetRoom(roomId);
  return room ? adminSessionFromRoom(room) : null;
}
