/** Persist per-seat reclaim secrets so the same browser can reconnect. */
const KEY = 'ti4_seat_secrets';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function loadSeatSecret(roomId, seatPlayerId) {
  if (!roomId || seatPlayerId == null) return null;
  const all = readAll();
  const room = all[String(roomId).toUpperCase()];
  return room?.[String(seatPlayerId)] || null;
}

export function saveSeatSecret(roomId, seatPlayerId, secret) {
  if (!roomId || seatPlayerId == null || !secret) return;
  const all = readAll();
  const id = String(roomId).toUpperCase();
  all[id] = { ...(all[id] || {}), [String(seatPlayerId)]: String(secret).toUpperCase() };
  writeAll(all);
}

export function clearSeatSecret(roomId, seatPlayerId) {
  if (!roomId || seatPlayerId == null) return;
  const all = readAll();
  const id = String(roomId).toUpperCase();
  if (!all[id]) return;
  delete all[id][String(seatPlayerId)];
  if (Object.keys(all[id]).length === 0) delete all[id];
  writeAll(all);
}
