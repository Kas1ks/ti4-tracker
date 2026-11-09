/** Persist live-room credentials so F5 keeps the same session. */

export const ROOM_SESSION_KEY = 'ti4_room_session';
/** Wi‑Fi badge codes while the live session exists. */
export const ROOM_SHARE_KEY = 'ti4_room_share';
/** Set while this device was in a live room — used to wipe zombie local games. */
export const WAS_LIVE_ROOM_KEY = 'ti4_was_live_room';

/**
 * @typedef {{
 *   roomId: string,
 *   hostKey: string | null,
 *   sessionToken: string | null,
 *   role: string,
 *   seatPlayerId: number | string | null,
 *   seq?: number,
 * }} RoomSession
 */

/**
 * @typedef {{
 *   roomId: string,
 *   hostKey: string | null,
 *   role: string | null,
 * }} RoomShare
 */

/** @returns {RoomSession | null} */
export function loadRoomSession() {
  try {
    const raw = localStorage.getItem(ROOM_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.roomId || typeof data.roomId !== 'string') return null;
    return {
      roomId: String(data.roomId).toUpperCase(),
      hostKey: data.hostKey || null,
      sessionToken: data.sessionToken || null,
      role: data.role || null,
      seatPlayerId: data.seatPlayerId ?? null,
      seq: typeof data.seq === 'number' ? data.seq : 0,
      miltySecret: data.miltySecret || null,
      miltyAdminSecret: data.miltyAdminSecret || null,
    };
  } catch {
    return null;
  }
}

/** @param {RoomSession | null | undefined} session */
export function saveRoomSession(session) {
  try {
    if (!session?.roomId) {
      localStorage.removeItem(ROOM_SESSION_KEY);
      return;
    }
    localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify({
      roomId: String(session.roomId).toUpperCase(),
      hostKey: session.hostKey || null,
      sessionToken: session.sessionToken || null,
      role: session.role || null,
      seatPlayerId: session.seatPlayerId ?? null,
      seq: typeof session.seq === 'number' ? session.seq : 0,
      miltySecret: session.miltySecret || null,
      miltyAdminSecret: session.miltyAdminSecret || null,
    }));
    markWasLiveRoom(session.roomId);
  } catch {
    /* quota / private mode */
  }
}

export function clearRoomSession() {
  try {
    localStorage.removeItem(ROOM_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function markWasLiveRoom(roomId) {
  try {
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) return;
    localStorage.setItem(WAS_LIVE_ROOM_KEY, id);
  } catch {
    /* ignore */
  }
}

export function loadWasLiveRoom() {
  try {
    const id = localStorage.getItem(WAS_LIVE_ROOM_KEY);
    return id ? String(id).toUpperCase() : null;
  } catch {
    return null;
  }
}

export function clearWasLiveRoom() {
  try {
    localStorage.removeItem(WAS_LIVE_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {RoomShare | null} */
export function loadRoomShare() {
  try {
    const raw = localStorage.getItem(ROOM_SHARE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.roomId || typeof data.roomId !== 'string') return null;
    return {
      roomId: String(data.roomId).toUpperCase(),
      hostKey: data.hostKey || null,
      role: data.role || null,
    };
  } catch {
    return null;
  }
}

/** @param {RoomShare | null | undefined} share */
export function saveRoomShare(share) {
  try {
    if (!share?.roomId) {
      localStorage.removeItem(ROOM_SHARE_KEY);
      return;
    }
    localStorage.setItem(ROOM_SHARE_KEY, JSON.stringify({
      roomId: String(share.roomId).toUpperCase(),
      hostKey: share.hostKey || null,
      role: share.role || null,
    }));
  } catch {
    /* quota / private mode */
  }
}

export function clearRoomShare() {
  try {
    localStorage.removeItem(ROOM_SHARE_KEY);
  } catch {
    /* ignore */
  }
}
