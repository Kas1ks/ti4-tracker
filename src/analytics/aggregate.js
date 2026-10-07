import { STRATEGY_CARDS } from '../data/gameData';
import { techById } from '../data/technologies';
import {
  avg,
  displayName,
  factionLabel,
  pct,
  playerKey,
  resolveFactionId,
} from './keys';
import { normalizeHistory } from './gameRecord';

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

/** PLAYER: games, wins, avg score, times, elim round, factions, damage, breakthrough. */
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
        damageSum: 0,
        breakthroughCount: 0,
        custodiansWins: 0,
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
    row.damageSum += Number(p.damageDealt) || 0;
    if (p.breakthrough) row.breakthroughCount += 1;
    if (game.custodians && playerKey(game.custodians) === key) row.custodiansWins += 1;

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
      avgDamage: Math.round(avg(row.damageSum, row.games) * 10) / 10,
      breakthroughRate: pct(row.breakthroughCount, row.games),
      custodiansGames: row.custodiansWins,
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

/** FACTION: picks, wins, avg VP, avg rounds, avg game time, damage, breakthrough. */
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
        damageSum: 0,
        breakthroughCount: 0,
      });
    }
    const row = map.get(key);
    row.picks += 1;
    if (p.isWinner) row.wins += 1;
    row.scoreSum += Number(p.score) || 0;
    row.roundsSum += Number(game.roundsCount) || 0;
    row.timeSum += Number(p.totalTime) || 0;
    row.damageSum += Number(p.damageDealt) || 0;
    if (p.breakthrough) row.breakthroughCount += 1;
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
      avgDamage: Math.round(avg(row.damageSum, row.picks) * 10) / 10,
      breakthroughRate: pct(row.breakthroughCount, row.picks),
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

/** True when scoreBreakdown parts reconcile with total (v3+ records). */
export function hasReliableVpBreakdown(player) {
  const b = player?.scoreBreakdown;
  if (!b || typeof b !== 'object') return false;
  const parts = (Number(b.secrets) || 0)
    + (Number(b.objectives) || 0)
    + (Number(b.custodians) || 0)
    + (Number(b.support) || 0)
    + (Number(b.extra) || 0);
  const total = Number(b.total);
  if (!Number.isFinite(total)) return false;
  if (parts === 0 && total === 0) return true;
  return parts > 0 && parts === total;
}

/** Company-wide average VP composition (only reliable breakdowns). */
export function buildVpSourceStats(history) {
  const sums = {
    secrets: 0,
    objectives: 0,
    custodians: 0,
    support: 0,
    extra: 0,
    total: 0,
    n: 0,
  };

  (history || []).forEach((game) => {
    (game.players || []).forEach((p) => {
      if (!hasReliableVpBreakdown(p)) return;
      const b = p.scoreBreakdown;
      sums.secrets += Number(b.secrets) || 0;
      sums.objectives += Number(b.objectives) || 0;
      sums.custodians += Number(b.custodians) || 0;
      sums.support += Number(b.support) || 0;
      sums.extra += Number(b.extra) || 0;
      sums.total += Number(b.total) || 0;
      sums.n += 1;
    });
  });

  if (!sums.n) {
    return {
      gamesWithDetail: 0,
      avgSecrets: 0,
      avgObjectives: 0,
      avgCustodians: 0,
      avgSupport: 0,
      avgExtra: 0,
      avgTotal: 0,
      shareSecrets: 0,
      shareObjectives: 0,
      shareCustodians: 0,
      shareSupport: 0,
      shareExtra: 0,
      bars: [],
    };
  }

  const avgTotal = avg(sums.total, sums.n);
  const share = (partSum) => (avgTotal > 0 ? Math.round((avg(partSum, sums.n) / avgTotal) * 100) : 0);
  const row = {
    gamesWithDetail: sums.n,
    avgSecrets: Math.round(avg(sums.secrets, sums.n) * 10) / 10,
    avgObjectives: Math.round(avg(sums.objectives, sums.n) * 10) / 10,
    avgCustodians: Math.round(avg(sums.custodians, sums.n) * 10) / 10,
    avgSupport: Math.round(avg(sums.support, sums.n) * 10) / 10,
    avgExtra: Math.round(avg(sums.extra, sums.n) * 10) / 10,
    avgTotal: Math.round(avgTotal * 10) / 10,
    shareSecrets: share(sums.secrets),
    shareObjectives: share(sums.objectives),
    shareCustodians: share(sums.custodians),
    shareSupport: share(sums.support),
    shareExtra: share(sums.extra),
  };

  row.bars = [
    { id: 'objectives', label: 'Цели', value: row.avgObjectives, share: row.shareObjectives, color: 'bg-amber-400' },
    { id: 'secrets', label: 'Секретки', value: row.avgSecrets, share: row.shareSecrets, color: 'bg-violet-400' },
    { id: 'custodians', label: 'Хранители', value: row.avgCustodians, share: row.shareCustodians, color: 'bg-cyan-400' },
    { id: 'support', label: 'Support', value: row.avgSupport, share: row.shareSupport, color: 'bg-emerald-400' },
    { id: 'extra', label: 'Прочее', value: row.avgExtra, share: row.shareExtra, color: 'bg-slate-400' },
  ];

  return row;
}

/** Most researched techs + win correlation. */
export function buildTechStats(history) {
  const map = new Map();
  let gamesWithTechs = 0;

  (history || []).forEach((game) => {
    const seats = (game.players || []).filter((p) => Array.isArray(p.techs) && p.techs.length > 0);
    if (seats.length === 0) return;
    gamesWithTechs += 1;

    seats.forEach((p) => {
      const won = !!p.isWinner;
      const seen = new Set();
      p.techs.forEach((rawId) => {
        const id = String(rawId || '').trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (!map.has(id)) {
          const meta = techById(id);
          map.set(id, {
            id,
            name: meta?.name || id,
            color: meta?.color || null,
            kind: meta?.kind || null,
            games: 0,
            wins: 0,
          });
        }
        const row = map.get(id);
        row.games += 1;
        if (won) row.wins += 1;
      });
    });
  });

  const techs = [...map.values()]
    .map((row) => ({
      ...row,
      winRate: pct(row.wins, row.games),
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name, 'ru'));

  return {
    gamesWithTechs,
    techs,
    top: techs.slice(0, 15),
  };
}

/** Politics: speaker wins, one-vote law games, avg agendas per game. */
export function buildPoliticsStats(history) {
  let gamesWithPolitics = 0;
  let oneVoteGames = 0;
  let speakerWins = 0;
  let agendaSum = 0;
  let phasesSum = 0;

  (history || []).forEach((game) => {
    const pol = game.politics;
    if (!pol) return;
    const hasData = pol.finalSpeaker
      || (pol.agendas && pol.agendas.length > 0)
      || pol.agendaPhasesCompleted > 0;
    if (!hasData) return;
    gamesWithPolitics += 1;
    if (pol.oneVoteLaw) oneVoteGames += 1;
    agendaSum += (pol.agendas || []).length;
    phasesSum += pol.agendaPhasesCompleted || 0;
    const winnerKey = playerKey(game.winner);
    const speakerKey = playerKey(pol.finalSpeaker);
    if (winnerKey && speakerKey && winnerKey === speakerKey) speakerWins += 1;
  });

  return {
    gamesWithPolitics,
    oneVoteGames,
    avgAgendasPerGame: gamesWithPolitics
      ? Math.round((agendaSum / gamesWithPolitics) * 10) / 10
      : 0,
    avgAgendaPhases: gamesWithPolitics
      ? Math.round((phasesSum / gamesWithPolitics) * 10) / 10
      : 0,
    speakerWinRate: pct(speakerWins, gamesWithPolitics),
  };
}

/** In-round strategy usage (primary + secondary) from strategyPlays[]. */
export function buildStrategyExecutionStats(history) {
  const map = new Map();
  let gamesWithPlays = 0;

  (history || []).forEach((game) => {
    const plays = Array.isArray(game.strategyPlays) ? game.strategyPlays : [];
    if (!plays.length) return;
    gamesWithPlays += 1;

    plays.forEach((play) => {
      const cardId = Number(play.cardId);
      if (!Number.isFinite(cardId)) return;
      if (!map.has(cardId)) {
        const meta = STRATEGY_CARDS.find((c) => c.id === cardId);
        map.set(cardId, {
          cardId,
          name: meta?.name || play.card || `#${cardId}`,
          primaryPlays: 0,
          secondaryPlays: 0,
          secondaryPasses: 0,
        });
      }
      const row = map.get(cardId);
      if (play.role === 'secondary') {
        if (play.outcome === 'passed') row.secondaryPasses += 1;
        else row.secondaryPlays += 1;
      } else {
        row.primaryPlays += 1;
      }
    });
  });

  const cards = [...map.values()]
    .map((row) => ({
      ...row,
      secondaryTakeRate: pct(row.secondaryPlays, row.secondaryPlays + row.secondaryPasses),
    }))
    .sort((a, b) => (b.primaryPlays + b.secondaryPlays) - (a.primaryPlays + a.secondaryPlays)
      || a.cardId - b.cardId);

  return { gamesWithPlays, cards };
}

/** Full analytics bundle for the UI. */
export function buildAnalytics(history) {
  const list = normalizeHistory(history);
  return {
    gameCount: list.length,
    players: buildPlayerStats(list),
    factions: buildFactionStats(list),
    objectives: buildObjectiveStats(list),
    strategy: buildStrategyStats(list),
    vpSources: buildVpSourceStats(list),
    techs: buildTechStats(list),
    politics: buildPoliticsStats(list),
    strategyExecution: buildStrategyExecutionStats(list),
  };
}
