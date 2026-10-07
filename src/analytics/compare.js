import { STRATEGY_CARDS } from '../data/gameData';
import {
  avg,
  factionLabel,
  pct,
  playerKey,
  resolveFactionId,
} from './keys';
import { normalizeHistory } from './gameRecord';
import { buildFactionProfile, buildPlayerProfile } from './profiles';

/** Per-game action phase duration from roundTimes. */
export function gameActionDurationSeconds(game) {
  const times = Array.isArray(game?.roundTimes) ? game.roundTimes : [];
  return times.reduce((sum, e) => sum + (Number(e.seconds) || 0), 0);
}

/** Trend line for filtered history (newest last). */
export function buildDurationTrend(history) {
  return normalizeHistory(history)
    .map((g) => ({
      id: g.id,
      date: g.date || '',
      rounds: g.roundsCount || 0,
      actionSeconds: gameActionDurationSeconds(g),
      playerCount: g.playerCount || (g.players || []).length,
    }))
    .filter((row) => row.rounds > 0 || row.actionSeconds > 0);
}

/**
 * Faction × strategy card pick counts (from draft picks, not in-round plays).
 * Win = player who picked that card won the game.
 */
export function buildFactionStrategyMatrix(history) {
  const list = normalizeHistory(history);
  const cellMap = new Map();
  const factionMeta = new Map();
  const cardIds = STRATEGY_CARDS.map((c) => c.id);

  list.forEach((game) => {
    const winners = new Set(
      (game.players || []).filter((p) => p.isWinner).map((p) => playerKey(p.name)),
    );
    const seatByName = new Map();
    (game.players || []).forEach((p) => {
      const fid = resolveFactionId(p);
      const fKey = fid || factionLabel(fid, p.faction).toLowerCase();
      if (!fKey || fKey === '—') return;
      seatByName.set(playerKey(p.name), {
        fKey,
        fName: factionLabel(fid, p.faction),
        won: !!p.isWinner,
      });
      if (!factionMeta.has(fKey)) {
        factionMeta.set(fKey, { key: fKey, name: factionLabel(fid, p.faction) });
      }
    });

    (game.strategyPicks || []).forEach((pick) => {
      const cardId = Number(pick.cardId);
      if (!Number.isFinite(cardId)) return;
      const seat = seatByName.get(playerKey(pick.player));
      if (!seat) return;
      const cellKey = `${seat.fKey}::${cardId}`;
      if (!cellMap.has(cellKey)) {
        cellMap.set(cellKey, {
          factionKey: seat.fKey,
          factionName: seat.fName,
          cardId,
          picks: 0,
          wins: 0,
        });
      }
      const cell = cellMap.get(cellKey);
      cell.picks += 1;
      if (winners.has(playerKey(pick.player))) cell.wins += 1;
    });
  });

  const factions = [...factionMeta.values()]
    .map((f) => {
      const picks = cardIds.reduce((sum, cid) => {
        const c = cellMap.get(`${f.key}::${cid}`);
        return sum + (c?.picks || 0);
      }, 0);
      return { ...f, totalPicks: picks };
    })
    .filter((f) => f.totalPicks > 0)
    .sort((a, b) => b.totalPicks - a.totalPicks);

  const topFactionKeys = factions.slice(0, 14).map((f) => f.key);
  const cells = [];
  topFactionKeys.forEach((fKey) => {
    cardIds.forEach((cardId) => {
      const c = cellMap.get(`${fKey}::${cardId}`);
      if (!c || c.picks === 0) return;
      cells.push({
        ...c,
        winRate: pct(c.wins, c.picks),
      });
    });
  });

  const maxPicks = cells.reduce((m, c) => Math.max(m, c.picks), 0);

  return {
    gamesWithPicks: list.filter((g) => (g.strategyPicks || []).length > 0).length,
    factions: factions.filter((f) => topFactionKeys.includes(f.key)),
    cards: STRATEGY_CARDS.map((c) => ({ id: c.id, name: c.name.replace(/^\d+\.\s*/, '') })),
    cells,
    maxPicks,
  };
}

export function comparePlayers(history, keys) {
  const list = normalizeHistory(history);
  const unique = [...new Set((keys || []).map((k) => playerKey(k)).filter(Boolean))].slice(0, 3);
  return unique
    .map((key) => buildPlayerProfile(list, key))
    .filter(Boolean);
}

export function compareFactions(history, keys) {
  const list = normalizeHistory(history);
  const unique = [...new Set((keys || []).map(String).filter(Boolean))].slice(0, 3);
  return unique
    .map((key) => buildFactionProfile(list, key))
    .filter(Boolean);
}

export function avgActionDuration(history) {
  const list = normalizeHistory(history);
  const durations = list.map(gameActionDurationSeconds).filter((s) => s > 0);
  return durations.length ? Math.round(avg(durations.reduce((a, b) => a + b, 0), durations.length)) : 0;
}
