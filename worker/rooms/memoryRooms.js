import {
  applyRoomAction,
  createRoomRecord,
  joinRoom,
  publicRoomView,
  adminSessionFromRoom,
} from './roomCore.js';

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

export function memoryCreateRoom(initialState) {
  const room = createRoomRecord(initialState);
  rooms.set(room.roomId, room);
  return room;
}

export function memoryGetRoom(roomId) {
  return rooms.get(String(roomId || '').toUpperCase()) || null;
}

export function memoryJoin(roomId, body) {
  const key = String(roomId || '').toUpperCase();
  const room = rooms.get(key);
  if (!room) return { ok: false, error: 'not-found' };
  const result = joinRoom(room, body);
  if (!result.ok) return result;
  rooms.set(key, result.room);
  return result;
}

export function memoryApplyAction(roomId, action, auth) {
  const key = String(roomId || '').toUpperCase();
  const room = rooms.get(key);
  if (!room) return { ok: false, error: 'not-found' };

  const result = applyRoomAction(room, action, auth);
  if (!result.ok) return result;

  rooms.set(key, result.room);
  if (!result.noop) {
    notify(key, {
      type: 'state',
      seq: result.room.seq,
      state: result.room.state,
      action: result.action,
      claimedSeats: publicRoomView(result.room).claimedSeats,
    });
  }
  return result;
}

export function memorySubscribe(roomId, callback) {
  const key = String(roomId || '').toUpperCase();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => {
    const set = listeners.get(key);
    if (!set) return;
    set.delete(callback);
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
