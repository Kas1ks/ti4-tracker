/** Persist live-room credentials so F5 keeps the same session. */

export const ROOM_SESSION_KEY = 'ti4_room_session';

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
    }));
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
