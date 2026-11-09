/** Ring-buffer of admin-visible room events (no secrets). */

export const ADMIN_EVENT_LIMIT = 40;

/**
 * @typedef {{
 *   at: string,
 *   kind: 'connect'|'disconnect'|'action'|'admin'|'seat',
 *   summary: string,
 *   role?: string|null,
 *   seatPlayerId?: number|string|null,
 *   actionType?: string|null,
 * }} AdminEvent
 */

/** @param {AdminEvent[]} prev @param {Omit<AdminEvent,'at'> & { at?: string }} entry */
export function pushAdminEvent(prev, entry) {
  const list = Array.isArray(prev) ? prev.slice() : [];
  list.push({
    at: entry.at || new Date().toISOString(),
    kind: entry.kind || 'action',
    summary: String(entry.summary || '').slice(0, 160),
    role: entry.role ?? null,
    seatPlayerId: entry.seatPlayerId ?? null,
    actionType: entry.actionType ?? null,
  });
  if (list.length > ADMIN_EVENT_LIMIT) list.splice(0, list.length - ADMIN_EVENT_LIMIT);
  return list;
}

export function summarizeActionType(type) {
  const t = String(type || '');
  if (!t) return 'действие';
  const map = {
    RESET_GAME: 'завершение партии',
    START_GAME: 'старт партии',
    START_ROUND: 'старт раунда',
    END_ROUND: 'конец раунда',
    NEXT_TURN: 'следующий ход',
    OPEN_DRAFT: 'драфт стратегий',
    PLAY_STRATEGY: 'игра стратегии',
    PASS_TURN: 'пас',
    TOGGLE_POLITICS_ACTIVE: 'политика вкл/выкл',
    SET_CUSTODIANS: 'Мекатол / custodians',
    EXCHANGE_SECRET: 'обмен секретки',
    START_SECRET_DRAFT: 'раздача секреток',
    DISCARD_SECRET: 'сброс секретки',
    CLAIM_EXPEDITION_SLICE: 'экспедиция',
  };
  return map[t] || t;
}

/** Persist a ring-buffer event on the room record (no secrets). */
export function noteAdminEventOnRoom(room, entry) {
  if (!room) return room;
  return {
    ...room,
    adminEvents: pushAdminEvent(room.adminEvents, entry),
  };
}

export function roleConnectSummary(role, seatPlayerId) {
  if (role === 'admin') return 'хост подключился';
  if (role === 'player') {
    return seatPlayerId != null ? `игрок места ${seatPlayerId} подключился` : 'игрок подключился';
  }
  return 'зритель подключился';
}

export function roleDisconnectSummary(role, seatPlayerId) {
  if (role === 'admin') return 'хост отключился';
  if (role === 'player') {
    return seatPlayerId != null ? `игрок места ${seatPlayerId} отключился` : 'игрок отключился';
  }
  return 'зритель отключился';
}
