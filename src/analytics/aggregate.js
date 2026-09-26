import { STRATEGY_CARDS } from '../data/gameData';
import {
  avg,
  displayName,
  factionLabel,
  pct,
  playerKey,
  resolveFactionId,
} from './keys';

/**
 * @typedef {object} GameRecord
 * @property {number} [id]
 * @property {number} [roundsCount]
 * @property {object[]} [players]
 * @property {object[]} [objectives]
 * @property {object[]} [strategyPicks]
 */

function eachPlayer(history, fn) {
  (history || []).forEach((game) => {
    (game.players || []).forEach((p) => fn(game, p));
  });
}

/** PLAYER: games, wins, avg score, times, elim round, factions. */
export function buildPlayerStats(history) {
  const map = new Map();

  eachPlayer(history, (game, p) => {
    const key = playerKey(p.name);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: displayName(p.name),
        games: 0,
        wins: 0,
        scoreSum: 0,
        timeSum: 0,
        roundsSum: 0,
        elimRoundSum: 0,
        elimCount: 0,
        factions: new Map(),
      });
    }
    const row = map.get(key);
    if (!row.name || row.name === '—') row.name = displayName(p.name);
    row.games += 1;
    if (p.isWinner) row.wins += 1;
    row.scoreSum += Number(p.score) || 0;
    row.timeSum += Number(p.totalTime) || 0;
    row.roundsSum += Number(game.roundsCount) || 0;

    const elimRound = p.eliminatedRound;
    if (p.eliminated && Number.isFinite(elimRound) && elimRound > 0) {
      row.elimRoundSum += elimRound;
      row.elimCount += 1;
    }

    const fid = resolveFactionId(p);
    const flabel = factionLabel(fid, p.faction);
    if (flabel && flabel !== '—') {
      const fKey = fid || flabel.toLowerCase();
      const prev = row.factions.get(fKey) || { id: fid, name: flabel, games: 0, wins: 0 };
      prev.games += 1;
      if (p.isWinner) prev.wins += 1;
      row.factions.set(fKey, prev);
    }
  });

  return [...map.values()]
    .map((row) => ({
      key: row.key,
      name: row.name,
      games: row.games,
      wins: row.wins,
      winRate: pct(row.wins, row.games),
      avgScore: Math.round(avg(row.scoreSum, row.games) * 10) / 10,
      avgGameTime: Math.round(avg(row.timeSum, row.games)),
      avgTurnTime: Math.round(avg(row.timeSum, row.roundsSum)),
      avgElimRound: row.elimCount
        ? Math.round(avg(row.elimRoundSum, row.elimCount) * 10) / 10
        : null,
      elimGames: row.elimCount,
      factions: [...row.factions.values()]
        .sort((a, b) => b.games - a.games || b.wins - a.wins)
        .map((f) => ({
          id: f.id,
          name: f.name,
          games: f.games,
          wins: f.wins,
          winRate: pct(f.wins, f.games),
        })),
    }))
    .sort((a, b) => b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name, 'ru'));
}

/** FACTION: picks, wins, avg VP, avg rounds, avg game time. */
export function buildFactionStats(history) {
  const map = new Map();

  eachPlayer(history, (game, p) => {
    const fid = resolveFactionId(p);
    const label = factionLabel(fid, p.faction);
    if (!label || label === '—') return;
    const key = fid || label.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        key,
        id: fid,
        name: label,
        picks: 0,
        wins: 0,
        scoreSum: 0,
        roundsSum: 0,
        timeSum: 0,
      });
    }
    const row = map.get(key);
    row.picks += 1;
    if (p.isWinner) row.wins += 1;
    row.scoreSum += Number(p.score) || 0;
    row.roundsSum += Number(game.roundsCount) || 0;
    row.timeSum += Number(p.totalTime) || 0;
  });

  return [...map.values()]
    .map((row) => ({
      key: row.key,
      id: row.id,
      name: row.name,
      picks: row.picks,
      wins: row.wins,
      winRate: pct(row.wins, row.picks),
      avgVp: Math.round(avg(row.scoreSum, row.picks) * 10) / 10,
      avgRounds: Math.round(avg(row.roundsSum, row.picks) * 10) / 10,
      avgGameTime: Math.round(avg(row.timeSum, row.picks)),
    }))
    .sort((a, b) => b.picks - a.picks || b.wins - a.wins || a.name.localeCompare(b.name, 'ru'));
}

/**
 * OBJECTIVES: most / rarely scored + difficulty (score rate among reveals).
 * A game "reveals" an objective if it appears in game.objectives[].
 */
export function buildObjectiveStats(history) {
  const map = new Map();

  (history || []).forEach((game) => {
    (game.objectives || []).forEach((obj) => {
      if (!obj?.id) return;
      if (!map.has(obj.id)) {
        map.set(obj.id, {
          id: obj.id,
          title: obj.title || obj.id,
          stage: obj.stage ?? null,
          points: obj.points ?? null,
          revealed: 0,
          scored: 0,
          scoreEvents: 0,
        });
      }
      const row = map.get(obj.id);
      if (obj.title) row.title = obj.title;
      row.revealed += 1;
      const scorers = Array.isArray(obj.scoredBy) ? obj.scoredBy.filter(Boolean) : [];
      if (scorers.length > 0) {
        row.scored += 1;
        row.scoreEvents += scorers.length;
      }
    });
  });

  const rows = [...map.values()].map((row) => ({
    id: row.id,
    title: row.title,
    stage: row.stage,
    points: row.points,
    revealed: row.revealed,
    scoredGames: row.scored,
    scoreEvents: row.scoreEvents,
    /** 0–1: share of reveals where at least one player scored it. */
    difficulty: row.revealed ? Math.round((row.scored / row.revealed) * 100) / 100 : 0,
    scoreRatePct: pct(row.scored, row.revealed),
  }));

  const byScoreEvents = [...rows].sort((a, b) => b.scoreEvents - a.scoreEvents || b.scoredGames - a.scoredGames);
  const byRarity = [...rows]
    .filter((r) => r.revealed >= 1)
    .sort((a, b) => a.scoreRatePct - b.scoreRatePct || b.revealed - a.revealed);

  return {
    all: rows.sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    mostScored: byScoreEvents.slice(0, 10),
    rarelyScored: byRarity.slice(0, 10),
  };
}

/**
 * STRATEGY CARDS: pick frequency, avg round picked, victory correlation.
 * Requires game.strategyPicks[]; empty when history has none.
 */
export function buildStrategyStats(history) {
  const cardMeta = new Map(STRATEGY_CARDS.map((c) => [c.id, c]));
  const map = new Map();
  let gamesWithPicks = 0;

  (history || []).forEach((game) => {
    const picks = Array.isArray(game.strategyPicks) ? game.strategyPicks : [];
    if (picks.length === 0) return;
    gamesWithPicks += 1;

    const winners = new Set(
      (game.players || []).filter((p) => p.isWinner).map((p) => playerKey(p.name)),
    );

    // Dedupe (player, card) per game for win correlation; keep all picks for freq/round.
    const seenPair = new Set();

    picks.forEach((pick) => {
      const cardId = Number(pick.cardId);
      if (!Number.isFinite(cardId)) return;
      if (!map.has(cardId)) {
        const meta = cardMeta.get(cardId);
        map.set(cardId, {
          cardId,
          name: meta?.name || `Карта #${cardId}`,
          picks: 0,
          roundSum: 0,
          winPicks: 0,
          uniquePlayerGames: 0,
        });
      }
      const row = map.get(cardId);
      row.picks += 1;
      if (Number.isFinite(pick.round) && pick.round > 0) {
        row.roundSum += pick.round;
      }

      const pKey = playerKey(pick.player);
      const pairKey = `${pKey}::${cardId}`;
      if (pKey && !seenPair.has(pairKey)) {
        seenPair.add(pairKey);
        row.uniquePlayerGames += 1;
        if (winners.has(pKey)) row.winPicks += 1;
      }
    });
  });

  const rows = [...map.values()]
    .map((row) => ({
      cardId: row.cardId,
      name: row.name,
      picks: row.picks,
      avgRoundPicked: row.picks
        ? Math.round(avg(row.roundSum, row.picks) * 10) / 10
        : null,
      winRateWhenPicked: pct(row.winPicks, row.uniquePlayerGames),
      uniquePlayerGames: row.uniquePlayerGames,
    }))
    .sort((a, b) => b.picks - a.picks || a.cardId - b.cardId);

  return {
    gamesWithPicks,
    cards: rows,
  };
}

/** Full analytics bundle for the UI. */
export function buildAnalytics(history) {
  const list = Array.isArray(history) ? history : [];
  return {
    gameCount: list.length,
    players: buildPlayerStats(list),
    factions: buildFactionStats(list),
    objectives: buildObjectiveStats(list),
    strategy: buildStrategyStats(list),
  };
}
