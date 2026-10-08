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
import {
  buildFactionStats,
  buildPlayerStats,
  hasReliableVpBreakdown,
} from './aggregate';
import { normalizeHistory } from './gameRecord';

const cardMeta = new Map(STRATEGY_CARDS.map((c) => [c.id, c]));

function emptyVpSums() {
  return { secrets: 0, objectives: 0, custodians: 0, support: 0, extra: 0, total: 0, n: 0 };
}

function addVp(sums, breakdown) {
  sums.secrets += Number(breakdown.secrets) || 0;
  sums.objectives += Number(breakdown.objectives) || 0;
  sums.custodians += Number(breakdown.custodians) || 0;
  sums.support += Number(breakdown.support) || 0;
  sums.extra += Number(breakdown.extra) || 0;
  sums.total += Number(breakdown.total) || 0;
  sums.n += 1;
}

function vpMixForSeats(entries) {
  const sums = emptyVpSums();
  entries.forEach(({ seat }) => {
    if (!hasReliableVpBreakdown(seat)) return;
    addVp(sums, seat.scoreBreakdown);
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
    };
  }
  const avgTotal = avg(sums.total, sums.n);
  const share = (partSum) => (avgTotal > 0 ? Math.round((avg(partSum, sums.n) / avgTotal) * 100) : 0);
  return {
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
}

function collectPlayerGames(history, key) {
  const games = [];
  (history || []).forEach((game) => {
    const seat = (game.players || []).find((p) => playerKey(p.name) === key);
    if (!seat) return;
    games.push({ game, seat });
  });
  return games;
}

function strategyStatsForSeats(entries) {
  const map = new Map();
  entries.forEach(({ game, seat }) => {
    const nameKey = playerKey(seat.name);
    const picks = (game.strategyPicks || []).filter((pick) => playerKey(pick.player) === nameKey);
    const seen = new Set();
    picks.forEach((pick) => {
      const cardId = Number(pick.cardId);
      if (!Number.isFinite(cardId) || seen.has(cardId)) return;
      seen.add(cardId);
      if (!map.has(cardId)) {
        const meta = cardMeta.get(cardId);
        map.set(cardId, {
          cardId,
          name: meta?.name || `#${cardId}`,
          picks: 0,
          wins: 0,
        });
      }
      const row = map.get(cardId);
      row.picks += 1;
      if (seat.isWinner) row.wins += 1;
    });
  });
  return [...map.values()]
    .map((row) => ({ ...row, winRate: pct(row.wins, row.picks) }))
    .sort((a, b) => b.picks - a.picks || b.wins - a.wins);
}

function techStatsForSeats(entries) {
  const map = new Map();
  entries.forEach(({ seat }) => {
    const techs = Array.isArray(seat.techs) ? seat.techs : [];
    if (!techs.length) return;
    const seen = new Set();
    techs.forEach((rawId) => {
      const id = String(rawId || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      if (!map.has(id)) {
        const meta = techById(id);
        map.set(id, {
          id,
          name: meta?.name || id,
          color: meta?.color || null,
          games: 0,
          wins: 0,
        });
      }
      const row = map.get(id);
      row.games += 1;
      if (seat.isWinner) row.wins += 1;
    });
  });
  return [...map.values()]
    .map((row) => ({ ...row, winRate: pct(row.wins, row.games) }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins);
}

/** Secondary strategy play / pass rates for seats across games. */
function secondaryEngagementForEntries(entries) {
  let secondaryPlays = 0;
  let secondaryPasses = 0;
  let gamesWithPlays = 0;
  entries.forEach(({ game, seat }) => {
    const plays = Array.isArray(game.strategyPlays) ? game.strategyPlays : [];
    if (!plays.length) return;
    const mine = plays.filter((p) => {
      const byName = seat.name && p.player === seat.name;
      const byId = seat.playerId != null && p.playerId === seat.playerId;
      return byName || byId;
    });
    if (!mine.length) return;
    gamesWithPlays += 1;
    mine.forEach((p) => {
      if (p.role === 'secondary' || p.choice === 'play') secondaryPlays += 1;
      if (p.role === 'pass' || p.choice === 'pass' || p.passed) secondaryPasses += 1;
    });
  });
  const opportunities = secondaryPlays + secondaryPasses;
  return {
    gamesWithPlays,
    secondaryPlays,
    secondaryPasses,
    engagementRate: opportunities > 0 ? pct(secondaryPlays, opportunities) : 0,
  };
}

/** Deep profile for one player key (normalized name). */
export function buildPlayerProfile(history, rawKey) {
  const list = normalizeHistory(history);
  const key = playerKey(rawKey);
  if (!key) return null;

  const base = buildPlayerStats(list).find((p) => p.key === key);
  if (!base) return null;

  const entries = collectPlayerGames(list, key);
  return {
    type: 'player',
    ...base,
    vpMix: vpMixForSeats(entries),
    strategies: strategyStatsForSeats(entries).slice(0, 8),
    techs: techStatsForSeats(entries).slice(0, 12),
    secondary: secondaryEngagementForEntries(entries),
    recentGames: entries
      .slice()
      .reverse()
      .slice(0, 8)
      .map(({ game, seat }) => ({
        id: game.id,
        date: game.date,
        score: seat.score,
        isWinner: !!seat.isWinner,
        faction: seat.faction || factionLabel(resolveFactionId(seat), ''),
        damageDealt: seat.damageDealt || 0,
      })),
  };
}

function collectFactionGames(history, factionKey) {
  const games = [];
  (history || []).forEach((game) => {
    (game.players || []).forEach((seat) => {
      const fid = resolveFactionId(seat);
      const label = factionLabel(fid, seat.faction);
      const key = fid || (label && label !== '—' ? label.toLowerCase() : null);
      if (key !== factionKey) return;
      games.push({ game, seat });
    });
  });
  return games;
}

/** Deep profile for one faction key (id or lowercased name). */
export function buildFactionProfile(history, factionKeyRaw) {
  const list = normalizeHistory(history);
  const factionKey = String(factionKeyRaw || '').trim();
  if (!factionKey) return null;

  const base = buildFactionStats(list).find((f) => f.key === factionKey);
  if (!base) return null;

  const entries = collectFactionGames(list, factionKey);

  const playersMap = new Map();
  entries.forEach(({ seat }) => {
    const key = playerKey(seat.name);
    if (!key) return;
    const prev = playersMap.get(key) || {
      key,
      name: displayName(seat.name),
      games: 0,
      wins: 0,
    };
    prev.games += 1;
    if (seat.isWinner) prev.wins += 1;
    playersMap.set(key, prev);
  });

  return {
    type: 'faction',
    ...base,
    vpMix: vpMixForSeats(entries),
    strategies: strategyStatsForSeats(entries).slice(0, 8),
    techs: techStatsForSeats(entries).slice(0, 12),
    secondary: secondaryEngagementForEntries(entries),
    players: [...playersMap.values()]
      .map((row) => ({ ...row, winRate: pct(row.wins, row.games) }))
      .sort((a, b) => b.games - a.games || b.wins - a.wins),
    recentGames: entries
      .slice()
      .reverse()
      .slice(0, 8)
      .map(({ game, seat }) => ({
        id: game.id,
        date: game.date,
        score: seat.score,
        isWinner: !!seat.isWinner,
        player: seat.name,
        damageDealt: seat.damageDealt || 0,
      })),
  };
}
