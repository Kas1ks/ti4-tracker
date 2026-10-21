/**
 * Remember rooms this browser created or joined (seat/role meta for rejoin).
 * The hub room *list* itself comes from GET /api/rooms (server-wide).
 */

const KEY = 'ti4_recent_rooms';
const MAX = 8;

/**
 * @typedef {{
 *   roomId: string,
 *   role?: string | null,
 *   seatPlayerId?: number | string | null,
 *   lastSeen: number,
 * }} RecentRoom
 */

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.roomId === 'string')
      .map((item) => ({
        roomId: String(item.roomId).toUpperCase(),
        role: item.role || null,
        seatPlayerId: item.seatPlayerId ?? null,
        lastSeen: Number(item.lastSeen) || 0,
      }));
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* quota / private mode */
  }
}

/** @returns {RecentRoom[]} */
export function listRecentRooms() {
  return readAll().sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * @param {{
 *   roomId: string,
 *   role?: string | null,
 *   seatPlayerId?: number | string | null,
 * }} entry
 */
export function rememberRecentRoom(entry) {
  const roomId = String(entry?.roomId || '').trim().toUpperCase();
  if (!roomId) return;
  const next = [
    {
      roomId,
      role: entry.role || null,
      seatPlayerId: entry.seatPlayerId ?? null,
      lastSeen: Date.now(),
    },
    ...readAll().filter((item) => item.roomId !== roomId),
  ];
  writeAll(next);
}

/** @param {string} roomId */
export function forgetRecentRoom(roomId) {
  const id = String(roomId || '').trim().toUpperCase();
  if (!id) return;
  writeAll(readAll().filter((item) => item.roomId !== id));
}

/** Room ids known from seat secrets (legacy bootstrap). */
export function roomIdsFromSeatSecrets() {
  try {
    const raw = localStorage.getItem('ti4_seat_secrets');
    const all = raw ? JSON.parse(raw) : {};
    if (!all || typeof all !== 'object') return [];
    return Object.keys(all).map((id) => String(id).toUpperCase());
  } catch {
    return [];
  }
}

/** Merge remembered rooms with seat-secret rooms (no duplicates). */
export function listKnownRoomIds() {
  const fromRecent = listRecentRooms().map((r) => r.roomId);
  const fromSeats = roomIdsFromSeatSecrets();
  const seen = new Set();
  const out = [];
  for (const id of [...fromRecent, ...fromSeats]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, MAX);
}
