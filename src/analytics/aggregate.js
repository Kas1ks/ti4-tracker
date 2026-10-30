import { BASE_OBJECTIVES, STRATEGY_CARDS } from '../data/gameData';
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

const objectiveCatalog = new Map(BASE_OBJECTIVES.map((o) => [o.id, o]));

function resolveObjectiveDesc(id, fallback = '') {
  const fromCatalog = objectiveCatalog.get(id)?.desc;
  if (fromCatalog) return fromCatalog;
  const text = String(fallback || '').trim();
  return text || '';
}

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
 * OBJECTIVES: reveal count + avg share of players who scored it per reveal.
 * mostScored / rarelyScored are opposites of the same completion %.
 * A game "reveals" an objective if it appears in game.objectives[].
 */
export function buildObjectiveStats(history) {
  const map = new Map();

  (history || []).forEach((game) => {
    const playerCount = Array.isArray(game.players) && game.players.length
      ? game.players.length
      : (Number(game.playerCount) || 0);

    (game.objectives || []).forEach((obj) => {
      if (!obj?.id) return;
      const catalog = objectiveCatalog.get(obj.id);
      if (!map.has(obj.id)) {
        map.set(obj.id, {
          id: obj.id,
          title: obj.title || catalog?.title || obj.id,
          desc: resolveObjectiveDesc(obj.id, obj.desc),
          stage: obj.stage ?? catalog?.stage ?? null,
          points: obj.points ?? catalog?.points ?? null,
          revealed: 0,
          scored: 0,
          scoreEvents: 0,
          completionSum: 0,
          completionSamples: 0,
        });
      }
      const row = map.get(obj.id);
      if (obj.title) row.title = obj.title;
      const desc = resolveObjectiveDesc(obj.id, obj.desc);
      if (desc) row.desc = desc;
      row.revealed += 1;
      const scorers = Array.isArray(obj.scoredBy) ? obj.scoredBy.filter(Boolean) : [];
      if (scorers.length > 0) {
        row.scored += 1;
        row.scoreEvents += scorers.length;
      }
      if (playerCount > 0) {
        row.completionSum += Math.min(scorers.length, playerCount) / playerCount;
        row.completionSamples += 1;
      }
    });
  });

  const rows = [...map.values()]
    .filter((row) => row.revealed >= 1)
    .map((row) => {
      const avgPlayerPct = row.completionSamples
        ? Math.round((row.completionSum / row.completionSamples) * 100)
        : 0;
      return {
        id: row.id,
        title: row.title,
        desc: row.desc || '',
        stage: row.stage,
        points: row.points,
        revealed: row.revealed,
        scoredGames: row.scored,
        scoreEvents: row.scoreEvents,
        /** Avg % of table that scored the objective when it was revealed. */
        avgPlayerPct,
        /** @deprecated alias of avgPlayerPct for older UI bindings */
        scoreRatePct: avgPlayerPct,
      };
    });

  const byCompletionDesc = [...rows].sort(
    (a, b) => b.avgPlayerPct - a.avgPlayerPct || b.revealed - a.revealed || a.title.localeCompare(b.title, 'ru'),
  );
  const byCompletionAsc = [...rows].sort(
    (a, b) => a.avgPlayerPct - b.avgPlayerPct || b.revealed - a.revealed || a.title.localeCompare(b.title, 'ru'),
  );

  return {
    all: [...rows].sort((a, b) => {
      const stageA = a.stage ?? 99;
      const stageB = b.stage ?? 99;
      return stageA - stageB || a.title.localeCompare(b.title, 'ru');
    }),
    mostScored: byCompletionDesc.slice(0, 5),
    rarelyScored: byCompletionAsc.slice(0, 5),
  };
}

/**
 * STRATEGY CARDS: pick rates as "was this card taken?" (yes/no).
 * - Rn: share of games with a draft in round n where the card was picked that round.
 * - Overall: share of (game × round) drafts where the card was picked.
 * Requires game.strategyPicks[]; empty when history has none.
 */
export function buildStrategyStats(history) {
  const cardMeta = new Map(STRATEGY_CARDS.map((c) => [c.id, c]));
  const map = new Map();
  /** Games that had at least one pick in this round. */
  const roundGames = new Map();
  /** cardId → round → games where the card was picked that round. */
  const cardRoundGames = new Map();
  let gamesWithPicks = 0;
  let draftSlots = 0;
  let totalPicks = 0;

  function ensureCard(cardId) {
    if (!map.has(cardId)) {
      const meta = cardMeta.get(cardId);
      map.set(cardId, {
        cardId,
        name: meta?.name || `Карта #${cardId}`,
        picks: 0,
        draftHits: 0,
      });
      cardRoundGames.set(cardId, new Map());
    }
    return map.get(cardId);
  }

  (history || []).forEach((game) => {
    const picks = Array.isArray(game.strategyPicks) ? game.strategyPicks : [];
    if (picks.length === 0) return;
    gamesWithPicks += 1;

    /** round → Set(cardId) taken in that round of this game. */
    const cardsByRound = new Map();

    picks.forEach((pick) => {
      const cardId = Number(pick.cardId);
      if (!Number.isFinite(cardId)) return;
      const row = ensureCard(cardId);
      row.picks += 1;
      totalPicks += 1;

      const round = Number(pick.round);
      if (!Number.isFinite(round) || round <= 0) return;
      if (!cardsByRound.has(round)) cardsByRound.set(round, new Set());
      cardsByRound.get(round).add(cardId);
    });

    cardsByRound.forEach((cardIds, round) => {
      roundGames.set(round, (roundGames.get(round) || 0) + 1);
      draftSlots += 1;
      cardIds.forEach((cardId) => {
        const row = ensureCard(cardId);
        row.draftHits += 1;
        const byRound = cardRoundGames.get(cardId);
        byRound.set(round, (byRound.get(round) || 0) + 1);
      });
    });
  });

  const rounds = [...roundGames.keys()].sort((a, b) => a - b);

  const rows = [...map.values()]
    .map((row) => {
      const hitsByRound = cardRoundGames.get(row.cardId) || new Map();
      const byRound = {};
      rounds.forEach((round) => {
        const hits = hitsByRound.get(round) || 0;
        const gamesInRound = roundGames.get(round) || 0;
        byRound[round] = {
          games: hits,
          pct: pct(hits, gamesInRound),
        };
      });
      return {
        cardId: row.cardId,
        name: row.name,
        picks: row.picks,
        overallPct: pct(row.draftHits, draftSlots),
        byRound,
      };
    })
    .sort((a, b) => a.cardId - b.cardId);

  return {
    gamesWithPicks,
    totalPicks,
    draftSlots,
    rounds,
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

/** Politics: lasting laws, vote outcomes, speaker breaks, one-vote / reverse. */
export function buildPoliticsStats(history) {
  let gamesWithPolitics = 0;
  let oneVoteGames = 0;
  let voteReversedGames = 0;
  let speakerWins = 0;
  let agendaSum = 0;
  let phasesSum = 0;
  let activeLawsSum = 0;
  let electLawsSum = 0;
  let speakerBreaks = 0;
  let agendasTallied = 0;
  let forOutcomes = 0;
  let againstOutcomes = 0;
  let covertAgendas = 0;
  let miscountAgendas = 0;
  const typeCounts = { FOR_AGAINST: 0, PLAYER_CHOICE: 0, OTHER: 0 };
  const lawMap = new Map();
  const electOwnerMap = new Map();

  (history || []).forEach((game) => {
    const pol = game.politics;
    if (!pol) return;
    const activeLaws = Array.isArray(pol.activeLaws) ? pol.activeLaws : [];
    const agendas = Array.isArray(pol.agendas) ? pol.agendas : [];
    const hasData = pol.finalSpeaker
      || agendas.length > 0
      || activeLaws.length > 0
      || pol.agendaPhasesCompleted > 0;
    if (!hasData) return;
    gamesWithPolitics += 1;
    if (pol.oneVoteLaw) oneVoteGames += 1;
    if (pol.voteReversed) voteReversedGames += 1;
    agendaSum += agendas.length;
    phasesSum += pol.agendaPhasesCompleted || 0;
    activeLawsSum += activeLaws.length;
    const winnerKey = playerKey(game.winner);
    const speakerKey = playerKey(pol.finalSpeaker);
    if (winnerKey && speakerKey && winnerKey === speakerKey) speakerWins += 1;

    activeLaws.forEach((law) => {
      const id = law.id != null ? String(law.id) : null;
      const title = law.title || id || 'Закон';
      const key = id || title.toLowerCase();
      const prev = lawMap.get(key) || { id, title, games: 0 };
      prev.games += 1;
      if (!prev.title && title) prev.title = title;
      lawMap.set(key, prev);
      if (law.ownerPlayerId != null || law.owner) {
        electLawsSum += 1;
        const ownerKey = playerKey(law.owner) || String(law.ownerPlayerId);
        if (ownerKey) {
          const row = electOwnerMap.get(ownerKey) || {
            key: ownerKey,
            name: law.owner || String(law.ownerPlayerId),
            laws: 0,
          };
          row.laws += 1;
          electOwnerMap.set(ownerKey, row);
        }
      }
    });

    agendas.forEach((agenda) => {
      agendasTallied += 1;
      if (agenda.type && typeCounts[agenda.type] != null) typeCounts[agenda.type] += 1;
      if (agenda.speakerBreak) speakerBreaks += 1;
      if (agenda.covert) covertAgendas += 1;
      if (agenda.miscount) miscountAgendas += 1;
      if (agenda.outcome === 'for') forOutcomes += 1;
      else if (agenda.outcome === 'against') againstOutcomes += 1;
    });
  });

  const faResolved = forOutcomes + againstOutcomes;
  const topLaws = [...lawMap.values()]
    .sort((a, b) => b.games - a.games || String(a.title).localeCompare(String(b.title), 'ru'))
    .slice(0, 8);
  const topElectOwners = [...electOwnerMap.values()]
    .sort((a, b) => b.laws - a.laws || String(a.name).localeCompare(String(b.name), 'ru'))
    .slice(0, 5);

  return {
    gamesWithPolitics,
    oneVoteGames,
    voteReversedGames,
    avgAgendasPerGame: gamesWithPolitics
      ? Math.round((agendaSum / gamesWithPolitics) * 10) / 10
      : 0,
    avgAgendaPhases: gamesWithPolitics
      ? Math.round((phasesSum / gamesWithPolitics) * 10) / 10
      : 0,
    avgActiveLaws: gamesWithPolitics
      ? Math.round((activeLawsSum / gamesWithPolitics) * 10) / 10
      : 0,
    electLawsTotal: electLawsSum,
    speakerBreaks,
    speakerBreakRate: pct(speakerBreaks, agendasTallied),
    forOutcomeRate: pct(forOutcomes, faResolved),
    againstOutcomeRate: pct(againstOutcomes, faResolved),
    faResolved,
    typeCounts,
    covertAgendas,
    miscountAgendas,
    topLaws,
    topElectOwners,
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
