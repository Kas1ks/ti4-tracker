import { ROLES } from '../../src/sync/permissions.js';

export const SEARCH_WARRANT_LAW_ID = 'search_warrant';

/**
 * True when this seat's secret hand is public (Search Warrant law / flag).
 * @param {object|null} state
 * @param {object|null} player
 */
export function playerSecretsRevealed(state, player) {
  if (!player) return false;
  if (player.secretsRevealed) return true;
  const laws = state?.politics?.activeLaws;
  if (!Array.isArray(laws)) return false;
  const pid = String(player.id);
  return laws.some(
    (law) => law?.id === SEARCH_WARRANT_LAW_ID
      && law?.ownerPlayerId != null
      && String(law.ownerPlayerId) === pid,
  );
}

function sameSeat(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function pickMapEntry(map, playerId) {
  if (!map || typeof map !== 'object' || playerId == null) return undefined;
  if (map[playerId] !== undefined) return map[playerId];
  return map[String(playerId)];
}

/**
 * Strip foreign secret hands / drafts / pending reveal card ids for a session.
 * Admin: unchanged. Player: own seat (+ Search Warrant revealed seats). Viewer: counts only.
 *
 * @param {object|null|undefined} state
 * @param {{ role?: string, seatPlayerId?: string|number|null }|null} [session]
 */
export function redactStateForSession(state, session = null) {
  if (!state || typeof state !== 'object') return state;

  const role = session?.role || ROLES.VIEWER;
  if (role === ROLES.ADMIN) return state;

  const myId = session?.seatPlayerId ?? null;
  const canSeeOwn = role === ROLES.PLAYER && myId != null;

  const players = (state.players || []).map((p) => {
    if (!p || typeof p !== 'object') return p;
    const isSelf = canSeeOwn && sameSeat(p.id, myId);
    const revealed = playerSecretsRevealed(state, p);
    if (isSelf || revealed) return p;

    const hand = Array.isArray(p.secretHand) ? p.secretHand : [];
    const draft = Array.isArray(p.secretDraft) ? p.secretDraft : null;
    return {
      ...p,
      secretHand: [],
      secretHandCount: hand.length,
      // Preserve draft length so host waiting UI still works if a non-admin
      // somehow sees it; card ids stay hidden.
      secretDraft: draft && draft.length > 0
        ? draft.map(() => '__hidden__')
        : draft,
    };
  });

  const sec = state.secretObjectives && typeof state.secretObjectives === 'object'
    ? state.secretObjectives
    : {};
  const rawPending = sec.pendingReveals && typeof sec.pendingReveals === 'object'
    ? sec.pendingReveals
    : {};
  const rawOverflows = sec.overflows && typeof sec.overflows === 'object'
    ? sec.overflows
    : {};

  let pendingReveals = {};
  let overflows = {};
  if (canSeeOwn) {
    const pending = pickMapEntry(rawPending, myId);
    if (typeof pending === 'string' && pending) {
      pendingReveals[String(myId)] = pending;
    }
    const overflow = pickMapEntry(rawOverflows, myId);
    if (overflow && typeof overflow === 'object') {
      overflows[String(myId)] = overflow;
    }
  }

  return {
    ...state,
    players,
    secretObjectives: {
      ...sec,
      // Deck order is private; non-admins only need deal/draft flags + scored ids.
      deck: [],
      pendingReveals,
      overflows,
    },
  };
}

/** Resolve session record from room + token (or null → viewer). */
export function sessionAuthFromRoom(room, sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token || !room?.sessions) return null;
  const session = room.sessions[token];
  if (!session || typeof session !== 'object') return null;
  return {
    role: session.role || ROLES.VIEWER,
    seatPlayerId: session.seatPlayerId ?? null,
  };
}
