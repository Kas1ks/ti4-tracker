import { ALL_FACTIONS } from '../data/gameData';
import { finalizeRoundTimes, playerScoreBreakdown } from '../game/selectors';
import {
  enrichPlayerAnalytics,
  extractEventDigest,
  extractPolitics,
  extractStrategyPlays,
} from './gameRecordExtract';

/** Current on-disk / cloud schema for finished-game analytics snapshots. */
export const GAME_RECORD_SCHEMA_VERSION = 3;

function factionName(factionId) {
  return ALL_FACTIONS.find(f => f.id === factionId)?.name || factionId || '';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function emptyScoreBreakdown() {
  return { secrets: 0, objectives: 0, custodians: 0, support: 0, extra: 0, total: 0 };
}

function normalizeScoreBreakdown(raw, fallbackTotal = 0) {
  if (!raw || typeof raw !== 'object') {
    const total = asNumber(fallbackTotal, 0);
    return { ...emptyScoreBreakdown(), total };
  }
  const secrets = asNumber(raw.secrets, 0);
  const objectives = asNumber(raw.objectives, 0);
  const custodians = asNumber(raw.custodians, 0);
  const support = asNumber(raw.support, 0);
  const extra = asNumber(raw.extra, 0);
  const parts = secrets + objectives + custodians + support + extra;
  const total = asNumber(raw.total, parts || fallbackTotal);
  return { secrets, objectives, custodians, support, extra, total };
}

function normalizePlayer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  const score = asNumber(raw.score, 0);
  return {
    name,
    factionId: raw.factionId || null,
    faction: raw.faction || factionName(raw.factionId) || '',
    score,
    totalTime: asNumber(raw.totalTime, 0),
    avgTurnTime: asNumber(raw.avgTurnTime, 0),
    isWinner: !!raw.isWinner,
    damageDealt: asNumber(raw.damageDealt, 0),
    breakthrough: !!raw.breakthrough,
    eliminated: !!raw.eliminated,
    eliminatedRound: Number.isFinite(raw.eliminatedRound) ? raw.eliminatedRound : null,
    scoreBreakdown: normalizeScoreBreakdown(raw.scoreBreakdown, score),
    /** Wave B+: researched techs (ids). Empty on legacy records. */
    techs: asArray(raw.techs).map(String).filter(Boolean),
    secretsHeld: asNumber(raw.secretsHeld, 0),
    secretsScoredVp: asNumber(raw.secretsScoredVp, 0),
    objectiveScoringTurns: asNumber(raw.objectiveScoringTurns, 0),
  };
}

function normalizePolitics(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    finalSpeakerId: raw.finalSpeakerId ?? null,
    finalSpeaker: raw.finalSpeaker || null,
    oneVoteLaw: !!raw.oneVoteLaw,
    voteReversed: !!raw.voteReversed,
    agendaPhasesCompleted: asNumber(raw.agendaPhasesCompleted, 0),
    agendas: asArray(raw.agendas).map((a) => ({
      index: asNumber(a.index, 0),
      type: a.type || null,
      label: a.label || a.type || '—',
      voters: asNumber(a.voters, 0),
      for: asNumber(a.for, 0),
      against: asNumber(a.against, 0),
      abstain: asNumber(a.abstain, 0),
      spentInfluence: asNumber(a.spentInfluence, 0),
      voterNames: asArray(a.voterNames).map(String),
    })),
    speakerTimeline: asArray(raw.speakerTimeline).map((e) => ({
      round: e.round ?? null,
      playerId: e.playerId ?? null,
      player: e.player || '—',
    })),
  };
}

function normalizeStrategyPlay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cardId = Number(raw.cardId);
  if (!Number.isFinite(cardId)) return null;
  return {
    round: raw.round ?? null,
    cardId,
    card: raw.card || `#${cardId}`,
    playerId: raw.playerId ?? null,
    player: raw.player || '—',
    role: raw.role === 'secondary' ? 'secondary' : 'primary',
    outcome: raw.outcome === 'passed' ? 'passed' : 'played',
    ownerPlayerId: raw.ownerPlayerId ?? null,
    owner: raw.owner || null,
  };
}

function normalizeObjective(raw) {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;
  return {
    id: String(raw.id),
    title: raw.title || String(raw.id),
    stage: raw.stage ?? null,
    points: raw.points ?? null,
    scoredBy: asArray(raw.scoredBy).map(String).filter(Boolean),
  };
}

function normalizeStrategyPick(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cardId = Number(raw.cardId);
  if (!Number.isFinite(cardId)) return null;
  return {
    round: asNumber(raw.round, 0),
    cardId,
    playerId: raw.playerId ?? null,
    player: String(raw.player || raw.playerId || '').trim(),
  };
}

/**
 * Normalize any stored game snapshot (v1–v3 / partial) into schema v3 shape.
 * Legacy records keep working; missing wave-B/C fields stay empty.
 */
export function normalizeGameRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const players = asArray(raw.players).map(normalizePlayer).filter(Boolean);
  const objectives = asArray(raw.objectives).map(normalizeObjective).filter(Boolean);
  const strategyPicks = asArray(raw.strategyPicks).map(normalizeStrategyPick).filter(Boolean);
  const roundTimes = asArray(raw.roundTimes)
    .map((entry) => ({
      round: asNumber(entry?.round, 0),
      seconds: asNumber(entry?.seconds, 0),
    }))
    .filter((entry) => entry.round > 0);

  const expansions = {
    pok: !!(raw.expansions?.pok ?? raw.usePok),
    te: !!(raw.expansions?.te ?? raw.useTe),
  };

  let teController = null;
  if (raw.teController && typeof raw.teController === 'object' && raw.teController.name) {
    teController = {
      name: String(raw.teController.name),
      faction: raw.teController.faction || '',
    };
  }

  const supports = asArray(raw.supports)
    .map((s) => ({
      from: String(s?.from || '').trim(),
      holder: String(s?.holder || '').trim(),
    }))
    .filter((s) => s.from && s.holder);

  return {
    id: raw.id ?? null,
    schemaVersion: GAME_RECORD_SCHEMA_VERSION,
    sourceSchemaVersion: asNumber(raw.schemaVersion, 1),
    date: raw.date || '',
    savedAt: raw.savedAt || null,
    targetScore: asNumber(raw.targetScore, 10),
    roundsCount: asNumber(raw.roundsCount, 0),
    playerCount: asNumber(raw.playerCount, players.length),
    roundTimes,
    winner: raw.winner || '—',
    winningFaction: raw.winningFaction || '',
    expansions,
    objectives,
    strategyPicks,
    teController,
    custodians: raw.custodians ? String(raw.custodians) : null,
    supports,
    players,
    politics: normalizePolitics(raw.politics),
    strategyPlays: asArray(raw.strategyPlays).map(normalizeStrategyPlay).filter(Boolean),
    eventDigest: asArray(raw.eventDigest),
  };
}

export function normalizeHistory(list) {
  return asArray(list).map(normalizeGameRecord).filter(Boolean);
}

/**
 * Build a v3 analytics snapshot from live game state at end-of-game.
 * @param {object} state
 * @param {object|null} winnerPlayer
 * @param {(playerId: number) => number} getPlayerScore
 */
export function buildGameRecord(state, winnerPlayer, getPlayerScore) {
  const players = asArray(state?.players);
  const meta = state?.meta || {};
  const targetScore = meta.targetScore;
  const roundNumber = asNumber(meta.roundNumber, 0);
  const now = new Date();

  const playerRows = players.map((p) => {
    const breakdown = playerScoreBreakdown(state, p.id);
    const score = typeof getPlayerScore === 'function' ? getPlayerScore(p.id) : breakdown.total;
    const row = {
      name: p.name,
      damageDealt: p.damageDealt || 0,
      factionId: p.factionId || null,
      faction: factionName(p.factionId),
      score,
      totalTime: p.totalTime || 0,
      avgTurnTime: roundNumber > 0 ? Math.round((p.totalTime || 0) / roundNumber) : 0,
      isWinner: winnerPlayer ? p.id === winnerPlayer.id : false,
      breakthrough: !!p.breakthrough,
      eliminated: !!p.eliminated,
      eliminatedRound: p.eliminated && Number.isFinite(p.eliminatedRound) ? p.eliminatedRound : null,
      scoreBreakdown: {
        ...breakdown,
        total: score,
      },
      techs: asArray(p.techIds).map(String).filter(Boolean),
    };
    return enrichPlayerAnalytics(state, row, p.id);
  });

  const record = {
    id: Date.now(),
    schemaVersion: GAME_RECORD_SCHEMA_VERSION,
    date: now.toLocaleDateString('ru-RU'),
    savedAt: now.toISOString(),
    targetScore,
    roundsCount: roundNumber,
    playerCount: players.length,
    roundTimes: finalizeRoundTimes(state),
    winner: winnerPlayer ? winnerPlayer.name : 'Ничья',
    winningFaction: winnerPlayer ? factionName(winnerPlayer.factionId) : '',
    expansions: {
      pok: !!meta.usePok,
      te: !!meta.useTe,
    },
    objectives: asArray(state?.objectives?.active).map((o) => ({
      id: o.id,
      title: o.title,
      stage: o.stage,
      points: o.points,
      scoredBy: players
        .filter((p) => state?.objectives?.completions?.[`${p.id}_${o.id}`])
        .map((p) => p.name),
    })),
    strategyPicks: asArray(meta.strategyPickHistory).map((pick) => {
      const seat = players.find((p) => p.id === pick.playerId);
      return {
        round: pick.round,
        cardId: pick.cardId,
        playerId: pick.playerId,
        player: seat?.name || String(pick.playerId),
      };
    }),
    teController: (() => {
      if (!meta.useTe || !state?.expedition?.completed) return null;
      const ctrl = players.find((p) => p.id === state.expedition.controllerId);
      if (!ctrl) return null;
      return {
        name: ctrl.name,
        faction: factionName(ctrl.factionId),
      };
    })(),
    custodians: (() => {
      const id = state?.vpTrack?.custodiansPlayerId;
      if (id == null) return null;
      const p = players.find((x) => x.id === id);
      return p ? p.name : null;
    })(),
    supports: Object.entries(state?.vpTrack?.supportHolders || {}).map(([fromId, holderId]) => {
      const from = players.find((p) => p.id === Number(fromId));
      const holder = players.find((p) => p.id === Number(holderId));
      return {
        from: from?.name || String(fromId),
        holder: holder?.name || String(holderId),
      };
    }),
    players: playerRows,
    politics: extractPolitics(state),
    strategyPlays: extractStrategyPlays(state),
    eventDigest: extractEventDigest(state, 50),
  };

  return normalizeGameRecord(record);
}
