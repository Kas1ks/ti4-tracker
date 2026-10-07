/**
 * Client-side filters for analytics history.
 * @typedef {object} HistoryFilters
 * @property {'all'|'base'|'pok'|'te'|'pok_te'} [expansions]
 * @property {number|null} [playerCount]  exact seat count, or null for any
 * @property {string} [winner]  player name substring (case-insensitive)
 */

export const DEFAULT_HISTORY_FILTERS = {
  expansions: 'all',
  playerCount: null,
  winner: '',
};

function expansionsMatch(game, mode) {
  const pok = !!game?.expansions?.pok;
  const te = !!game?.expansions?.te;
  switch (mode) {
    case 'base':
      return !pok && !te;
    case 'pok':
      return pok && !te;
    case 'te':
      return te;
    case 'pok_te':
      return pok && te;
    case 'all':
    default:
      return true;
  }
}

/** Apply UI filters; expects already-normalized records. */
export function filterHistory(history, filters = DEFAULT_HISTORY_FILTERS) {
  const list = Array.isArray(history) ? history : [];
  const expansions = filters.expansions || 'all';
  const playerCount = filters.playerCount == null || filters.playerCount === ''
    ? null
    : Number(filters.playerCount);
  const winnerQ = String(filters.winner || '').trim().toLowerCase();

  return list.filter((game) => {
    if (!expansionsMatch(game, expansions)) return false;
    if (Number.isFinite(playerCount) && playerCount > 0) {
      const n = game.playerCount || (game.players || []).length;
      if (n !== playerCount) return false;
    }
    if (winnerQ) {
      const w = String(game.winner || '').toLowerCase();
      if (!w.includes(winnerQ)) return false;
    }
    return true;
  });
}
