import { BASE_OBJECTIVES, DEFAULT_OBJECTIVES } from '../data/gameData';
import { shuffleArray } from '../utils/game';

export const GAME_STATE_VERSION = 1;
export const GAME_STATE_KEY = 'ti4_game';
export const DEFAULT_TARGET_SCORE = 10;

/** Pre-Prep-A storage layout. Read once for migration, then removed. */
const LEGACY_KEYS = [
  'ti4_active', 'ti4_targetScore', 'ti4_round', 'ti4_usePok', 'ti4_useTe',
  'ti4_isPoliticsActive', 'ti4_isAgendaPhasePending', 'ti4_players',
  'ti4_objectives', 'ti4_completions', 'ti4_stage1Deck', 'ti4_stage2Deck',
  'ti4_roundActive', 'ti4_turnOrder', 'ti4_activeTurnIdx', 'ti4_passed',
  'ti4_turnTime', 'ti4_speakerId', 'ti4_draftAssignments', 'ti4_draftQueue',
  'ti4_currentQueueIndex', 'ti4_draftStep', 'ti4_draftPickOrder',
  'ti4_showDraftModal', 'ti4_strategyBonuses',
];

export const EMPTY_STATUS_CHECKS = Object.freeze({
  scoreObjectives: false,
  revealObjective: false,
  drawActionCards: false,
  gainCommandTokens: false,
  refreshAndRepair: false,
  returnStrategyCards: false,
});

export const freshStage1Deck = () =>
  shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1));

export const freshStage2Deck = () =>
  shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2));

const emptyAgendas = () => [{ type: null, votes: {}, locked: {} }];

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const asArray = (value, fallback = []) => (Array.isArray(value) ? value : fallback);
const asRecord = (value, fallback = {}) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
const asNumber = (value, fallback) => (Number.isFinite(value) ? value : fallback);

export function createEmptyGameState() {
  return {
    version: GAME_STATE_VERSION,
    isGameActive: false,
    meta: {
      targetScore: DEFAULT_TARGET_SCORE,
      roundNumber: 1,
      usePok: false,
      useTe: false,
      speakerId: null,
      isPoliticsActive: false,
      isAgendaPhasePending: false,
    },
    players: [],
    objectives: {
      active: DEFAULT_OBJECTIVES,
      completions: {},
      stage1Deck: freshStage1Deck(),
      stage2Deck: freshStage2Deck(),
    },
    round: {
      active: false,
      turnOrderIds: [],
      activeTurnIdx: 0,
      passed: {},
      turnTime: 0,
      turnStartedAt: null,
      strategyActionTaken: false,
    },
    draft: {
      queue: [],
      assignments: {},
      currentQueueIndex: 0,
      step: 'DRAFT',
      pickOrder: [],
      showModal: false,
      strategyCardBonuses: {},
    },
    politics: {
      showModal: false,
      step: 'SETUP',
      agendas: emptyAgendas(),
      currentAgendaIndex: 0,
      influenceLocked: {},
      voteReversed: false,
    },
    statusPhase: { show: false, checks: { ...EMPTY_STATUS_CHECKS } },
    updatedAt: null,
  };
}

/**
 * Older cloud saves and pre-Prep-A localStorage used one flat object.
 * Flatten both shapes so normalizeGameState has a single input format.
 */
function toFlat(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const isNested = raw.meta || raw.round || raw.draft || raw.politics;
  if (!isNested) return raw;

  const meta = asRecord(raw.meta);
  const objectives = asRecord(raw.objectives);
  const round = asRecord(raw.round);
  const draft = asRecord(raw.draft);
  const politics = asRecord(raw.politics);
  const statusPhase = asRecord(raw.statusPhase);

  return {
    isGameActive: raw.isGameActive,
    targetScore: meta.targetScore,
    roundNumber: meta.roundNumber,
    usePok: meta.usePok,
    useTe: meta.useTe,
    speakerId: meta.speakerId,
    isPoliticsActive: meta.isPoliticsActive,
    isAgendaPhasePending: meta.isAgendaPhasePending,
    players: raw.players,
    objectives: objectives.active,
    completions: objectives.completions,
    stage1Deck: objectives.stage1Deck,
    stage2Deck: objectives.stage2Deck,
    roundActive: round.active,
    turnOrderIds: round.turnOrderIds,
    activeTurnIdx: round.activeTurnIdx,
    passed: round.passed,
    turnTime: round.turnTime,
    turnStartedAt: round.turnStartedAt,
    strategyActionTaken: round.strategyActionTaken,
    draftQueue: draft.queue,
    draftAssignments: draft.assignments,
    currentQueueIndex: draft.currentQueueIndex,
    draftStep: draft.step,
    draftPickOrder: draft.pickOrder,
    showDraftModal: draft.showModal,
    strategyCardBonuses: draft.strategyCardBonuses,
    showPoliticsModal: politics.showModal,
    politicsStep: politics.step,
    agendas: politics.agendas,
    currentAgendaIndex: politics.currentAgendaIndex,
    influenceLocked: politics.influenceLocked,
    voteReversed: politics.voteReversed,
    showStatusPhase: statusPhase.show,
    statusPhaseChecks: statusPhase.checks,
    timestamp: raw.timestamp,
    updatedAt: raw.updatedAt,
  };
}

/** Drop objectives that no longer exist in game data, keep custom ones. */
function normalizeObjectives(value) {
  const saved = asArray(value, null);
  if (!saved) return DEFAULT_OBJECTIVES;
  return saved.filter(obj => {
    const id = obj?.id;
    if (typeof id !== 'string') return false;
    return id.startsWith('custom_') || BASE_OBJECTIVES.some(base => base.id === id);
  });
}

function normalizeTurnOrderIds(flat, players) {
  const known = new Set(players.map(p => p.id));
  const fromIds = asArray(flat.turnOrderIds, null);
  const source = fromIds ?? asArray(flat.turnOrder).map(entry => entry?.id);
  return source.filter(id => known.has(id));
}

/** Normalize strategy-play tracking (supports legacy strategyPlayed boolean). */
function normalizePlayer(player) {
  if (!player || typeof player !== 'object') return player;
  const cards = asArray(player.cards);
  let playedCardIds = asArray(player.playedCardIds)
    .map(Number)
    .filter(id => Number.isFinite(id));
  if (playedCardIds.length === 0 && player.strategyPlayed && cards.length > 0) {
    playedCardIds = cards.map(c => c.id).filter(id => Number.isFinite(id));
  }
  const strategyPlayed = cards.length > 0
    ? cards.every(c => playedCardIds.includes(c.id))
    : !!player.strategyPlayed;
  return { ...player, cards, playedCardIds, strategyPlayed };
}

/** Accepts a nested doc, a legacy flat snapshot, or junk, and returns a valid doc. */
export function normalizeGameState(raw) {
  const flat = toFlat(raw);
  const players = asArray(flat.players).map(normalizePlayer);
  const draftQueue = asArray(flat.draftQueue);
  const agendas = asArray(flat.agendas, null);

  return {
    version: GAME_STATE_VERSION,
    isGameActive: !!flat.isGameActive,
    meta: {
      targetScore: asNumber(flat.targetScore, DEFAULT_TARGET_SCORE),
      roundNumber: asNumber(flat.roundNumber, 1) || 1,
      usePok: !!flat.usePok,
      useTe: !!flat.useTe,
      speakerId: flat.speakerId ?? null,
      isPoliticsActive: !!flat.isPoliticsActive,
      isAgendaPhasePending: !!flat.isAgendaPhasePending,
    },
    players,
    objectives: {
      active: normalizeObjectives(flat.objectives),
      completions: asRecord(flat.completions),
      stage1Deck: asArray(flat.stage1Deck, null) ?? freshStage1Deck(),
      stage2Deck: asArray(flat.stage2Deck, null) ?? freshStage2Deck(),
    },
    round: {
      active: !!flat.roundActive,
      turnOrderIds: normalizeTurnOrderIds(flat, players),
      activeTurnIdx: asNumber(flat.activeTurnIdx, 0),
      passed: asRecord(flat.passed),
      turnTime: asNumber(flat.turnTime, 0),
      turnStartedAt: Number.isFinite(flat.turnStartedAt) ? flat.turnStartedAt : null,
      strategyActionTaken: !!flat.strategyActionTaken,
    },
    draft: {
      queue: draftQueue,
      assignments: asRecord(flat.draftAssignments),
      currentQueueIndex: asNumber(flat.currentQueueIndex, 0),
      step: flat.draftStep === 'CONFIRM' ? 'CONFIRM' : 'DRAFT',
      pickOrder: asArray(flat.draftPickOrder),
      // An empty queue means there is nothing to resume.
      showModal: draftQueue.length > 0 && flat.showDraftModal !== false,
      strategyCardBonuses: asRecord(flat.strategyCardBonuses),
    },
    politics: {
      showModal: !!flat.showPoliticsModal,
      step: flat.politicsStep === 'VOTE' ? 'VOTE' : 'SETUP',
      agendas: agendas && agendas.length > 0 ? agendas : emptyAgendas(),
      currentAgendaIndex: asNumber(flat.currentAgendaIndex, 0),
      influenceLocked: asRecord(flat.influenceLocked),
      voteReversed: !!flat.voteReversed,
    },
    statusPhase: {
      show: !!flat.showStatusPhase,
      checks: { ...EMPTY_STATUS_CHECKS, ...asRecord(flat.statusPhaseChecks) },
    },
    updatedAt: flat.updatedAt ?? flat.timestamp ?? null,
  };
}

/** Mark a document with the moment it was saved or shared. */
export function stampGameState(state) {
  return { ...state, updatedAt: new Date().toISOString() };
}

/** turnOrder is kept as player objects in the UI; ids are the stored form. */
export function rehydrateTurnOrder(players, turnOrderIds) {
  const byId = new Map(asArray(players).map(p => [p.id, p]));
  return asArray(turnOrderIds).map(id => byId.get(id)).filter(Boolean);
}

function readLegacyState() {
  const flat = {
    isGameActive: readRaw('ti4_active'),
    targetScore: readRaw('ti4_targetScore'),
    roundNumber: readRaw('ti4_round'),
    usePok: readRaw('ti4_usePok'),
    useTe: readRaw('ti4_useTe'),
    speakerId: readRaw('ti4_speakerId'),
    isPoliticsActive: readRaw('ti4_isPoliticsActive'),
    isAgendaPhasePending: readRaw('ti4_isAgendaPhasePending'),
    players: readRaw('ti4_players'),
    objectives: readRaw('ti4_objectives'),
    completions: readRaw('ti4_completions'),
    stage1Deck: readRaw('ti4_stage1Deck'),
    stage2Deck: readRaw('ti4_stage2Deck'),
    roundActive: readRaw('ti4_roundActive'),
    turnOrder: readRaw('ti4_turnOrder'),
    activeTurnIdx: readRaw('ti4_activeTurnIdx'),
    passed: readRaw('ti4_passed'),
    turnTime: readRaw('ti4_turnTime'),
    draftAssignments: readRaw('ti4_draftAssignments'),
    draftQueue: readRaw('ti4_draftQueue'),
    currentQueueIndex: readRaw('ti4_currentQueueIndex'),
    draftStep: readRaw('ti4_draftStep'),
    draftPickOrder: readRaw('ti4_draftPickOrder'),
    showDraftModal: readRaw('ti4_showDraftModal'),
    strategyCardBonuses: readRaw('ti4_strategyBonuses'),
  };

  const hasAnything = Object.values(flat).some(value => value !== undefined);
  return hasAnything ? flat : null;
}

function dropLegacyKeys() {
  try {
    LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}

/** Load the single document, migrating a pre-Prep-A game on first run. */
export function loadGameState() {
  const stored = readRaw(GAME_STATE_KEY);
  if (stored) return normalizeGameState(stored);

  const legacy = readLegacyState();
  if (!legacy) return createEmptyGameState();

  const migrated = normalizeGameState(legacy);
  saveGameState(migrated);
  dropLegacyKeys();
  return migrated;
}

export function saveGameState(state) {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem('ti4_gameSummary');
    localStorage.removeItem('ti4_snapshots');
  } catch {
    /* storage unavailable */
  }
  dropLegacyKeys();
}
