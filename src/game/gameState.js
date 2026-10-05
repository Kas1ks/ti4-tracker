import { BASE_OBJECTIVES, DEFAULT_OBJECTIVES } from '../data/gameData';
import { EXPEDITION_SLICE_IDS, emptyExpeditionSlices } from '../data/expedition';
import { shufflePreferFresh } from '../utils/game';
import { readRecentObjectiveIds } from './objectiveHistory';
import { GAME_STATE_VERSION, migrateGameState } from './migrations';

export { GAME_STATE_VERSION };
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

/** Per-status-phase objective scoring window (1 public + 1 secret per player). */
export const EMPTY_OBJECTIVE_SCORING = Object.freeze({
  active: false,
  responses: {},
  orderIds: [],
  currentIdx: 0,
});

/** Primary strategy play: all seats must answer played/passed before the card commits. */
export const EMPTY_STRATEGY_RESOLUTION = Object.freeze({
  active: false,
  cardId: null,
  playerId: null,
  startedAt: null,
  responses: {},
  resolvedAt: Object.freeze({}),
});

/** Imperial (card 8) primary: Mecatol VP or secret, plus one public — applied on confirm. */
export const EMPTY_IMPERIAL_CLAIM = Object.freeze({
  active: false,
  playerId: null,
  publicId: null,
  mecatol: false,
  secret: false,
});

/** Technology (card 7): concurrent research while strategyResolution poll is active. */
export const EMPTY_TECH_RESEARCH = Object.freeze({
  active: false,
  concurrent: false,
  playerId: null,
  mode: 'primary',
  picks: Object.freeze([]),
  ignorePrereq: 0,
  queueIds: Object.freeze([]),
  primaryPlayerId: null,
  byPlayer: Object.freeze({}),
});

/** Thunder's Edge expedition (TE only). */
export const EMPTY_EXPEDITION = Object.freeze({
  slices: Object.freeze({
    resources: null,
    actionCards: null,
    influence: null,
    secret: null,
    techPlanet: null,
    tradeGoods: null,
  }),
  completed: false,
  controllerId: null,
  placedById: null,
  awaitingControlPick: false,
});

/**
 * Post-start starting-tech draft (Argent / Winnu / Keleres / TE choice+research).
 * needed: seats require draft after START_GAME; active: host opened the poll.
 * responses[id]: { status: waiting|picking|confirmed, picks: string[] }
 */
export const EMPTY_STARTING_TECH_DRAFT = Object.freeze({
  needed: false,
  active: false,
  responses: Object.freeze({}),
});

/** Which expansion pool an objective belongs to (`base` | `pok` | `te`). */
export function objectiveExp(obj) {
  if (obj?.exp) return obj.exp;
  const id = String(obj?.id || '');
  if (/_p\d+$/.test(id) || id.includes('_p')) return 'pok';
  if (/_t\d+$/.test(id) || id.includes('_t')) return 'te';
  return 'base';
}

/** True if this public objective belongs in the deal for the chosen expansions. */
export function objectiveInPool(obj, { usePok = false, useTe = false } = {}) {
  const exp = objectiveExp(obj);
  if (exp === 'pok') return !!usePok;
  if (exp === 'te') return !!useTe;
  return true;
}

export const freshStage1Deck = (opts = {}) => {
  const pool = BASE_OBJECTIVES.filter(obj => obj.stage === 1 && objectiveInPool(obj, opts));
  return shufflePreferFresh(pool, readRecentObjectiveIds());
};

export const freshStage2Deck = (opts = {}) => {
  const pool = BASE_OBJECTIVES.filter(obj => obj.stage === 2 && objectiveInPool(obj, opts));
  return shufflePreferFresh(pool, readRecentObjectiveIds());
};

export function decksForExpansions({ usePok = false, useTe = false } = {}) {
  return {
    stage1Deck: freshStage1Deck({ usePok, useTe }),
    stage2Deck: freshStage2Deck({ usePok, useTe }),
  };
}

/** Named VP outside secrets / public objs / free-form `extra` (Мек). */
export const EMPTY_VP_TRACK = Object.freeze({
  custodiansPlayerId: null,
  /** fromPlayerId → holderPlayerId (who holds that seat's Support for the Throne). */
  supportHolders: Object.freeze({}),
});

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
      strategyPickHistory: [],
      /** Completed action-phase durations: [{ round, seconds }, ...] */
      roundTimes: [],
    },
    players: [],
    objectives: {
      active: DEFAULT_OBJECTIVES,
      completions: {},
      ...decksForExpansions({ usePok: false, useTe: false }),
    },
    vpTrack: {
      custodiansPlayerId: null,
      supportHolders: {},
    },
    round: {
      active: false,
      turnOrderIds: [],
      activeTurnIdx: 0,
      passed: {},
      turnTime: 0,
      turnStartedAt: null,
      /** Wall-clock start of the current action phase (START_ROUND → END_ROUND). */
      roundStartedAt: null,
      turnPausedAccum: 0,
      strategyActionTaken: false,
      expeditionClaimedThisTurn: false,
      expeditionClaimedSliceId: null,
      strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
      imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
      techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
    },
    draft: {
      queue: [],
      assignments: {},
      currentQueueIndex: 0,
      step: 'DRAFT',
      pickOrder: [],
      showModal: false,
      strategyCardBonuses: {},
      pickStartedAt: null,
    },
    politics: {
      showModal: false,
      step: 'SETUP',
      agendas: emptyAgendas(),
      currentAgendaIndex: 0,
      influenceLocked: {},
      voteReversed: false,
      /** Lasting law: each seat casts exactly 1 vote; skip influence SETUP. */
      oneVoteLaw: false,
    },
    statusPhase: {
      show: false,
      checks: { ...EMPTY_STATUS_CHECKS },
      scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 },
    },
    expedition: {
      slices: emptyExpeditionSlices(),
      completed: false,
      controllerId: null,
      placedById: null,
      awaitingControlPick: false,
    },
    startingTechDraft: { ...EMPTY_STARTING_TECH_DRAFT, responses: {} },
    log: {
      events: [],
    },
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
    strategyPickHistory: meta.strategyPickHistory,
    roundTimes: meta.roundTimes,
    players: raw.players,
    objectives: objectives.active,
    completions: objectives.completions,
    stage1Deck: objectives.stage1Deck,
    stage2Deck: objectives.stage2Deck,
    vpTrack: raw.vpTrack,
    roundActive: round.active,
    turnOrderIds: round.turnOrderIds,
    activeTurnIdx: round.activeTurnIdx,
    passed: round.passed,
    turnTime: round.turnTime,
    turnStartedAt: round.turnStartedAt,
    roundStartedAt: round.roundStartedAt,
    turnPausedAccum: round.turnPausedAccum,
    strategyActionTaken: round.strategyActionTaken,
    expeditionClaimedThisTurn: !!round.expeditionClaimedThisTurn,
    expeditionClaimedSliceId: round.expeditionClaimedSliceId ?? null,
    strategyResolution: round.strategyResolution,
    imperialClaim: round.imperialClaim,
    techResearch: round.techResearch,
    draftQueue: draft.queue,
    draftAssignments: draft.assignments,
    currentQueueIndex: draft.currentQueueIndex,
    draftStep: draft.step,
    draftPickOrder: draft.pickOrder,
    showDraftModal: draft.showModal,
    strategyCardBonuses: draft.strategyCardBonuses,
    draftPickStartedAt: draft.pickStartedAt,
    showPoliticsModal: politics.showModal,
    politicsStep: politics.step,
    agendas: politics.agendas,
    currentAgendaIndex: politics.currentAgendaIndex,
    influenceLocked: politics.influenceLocked,
    voteReversed: politics.voteReversed,
    oneVoteLaw: politics.oneVoteLaw,
    showStatusPhase: statusPhase.show,
    statusPhaseChecks: statusPhase.checks,
    objectiveScoring: statusPhase.scoring,
    expedition: raw.expedition,
    startingTechDraft: raw.startingTechDraft,
    gameEvents: asRecord(raw.log).events ?? raw.gameEvents,
    timestamp: raw.timestamp,
    updatedAt: raw.updatedAt,
  };
}

function normalizeStartingTechDraft(value) {
  const raw = asRecord(value);
  const responses = {};
  Object.entries(asRecord(raw.responses)).forEach(([playerId, entry]) => {
    const r = asRecord(entry);
    const status = r.status === 'confirmed' || r.status === 'picking'
      ? r.status
      : 'waiting';
    responses[playerId] = {
      status,
      picks: asArray(r.picks).filter(id => typeof id === 'string'),
    };
  });
  return {
    needed: !!raw.needed,
    active: !!raw.active,
    responses,
  };
}

function normalizeObjectiveScoring(value) {
  const raw = asRecord(value);
  const responses = {};
  Object.entries(asRecord(raw.responses)).forEach(([playerId, entry]) => {
    const r = asRecord(entry);
    const status = r.status === 'done' || r.status === 'passed' ? r.status : 'pending';
    responses[playerId] = {
      status,
      publicId: typeof r.publicId === 'string' ? r.publicId : null,
      secret: !!r.secret,
    };
  });
  const orderIds = asArray(raw.orderIds)
    .map(id => (typeof id === 'number' ? id : Number(id)))
    .filter(id => Number.isFinite(id));
  const currentIdx = Math.max(0, asNumber(raw.currentIdx, 0));
  return {
    active: !!raw.active,
    responses,
    orderIds,
    currentIdx: orderIds.length ? Math.min(currentIdx, orderIds.length - 1) : 0,
  };
}

function normalizeStrategyResolution(value) {
  const raw = asRecord(value);
  if (!raw.active) return { ...EMPTY_STRATEGY_RESOLUTION };
  const responses = {};
  Object.entries(asRecord(raw.responses)).forEach(([playerId, status]) => {
    const key = typeof playerId === 'number' ? playerId : Number(playerId);
    if (!Number.isFinite(key)) return;
    responses[key] = status === 'played' || status === 'passed' ? status : 'pending';
  });
  const resolvedAt = {};
  Object.entries(asRecord(raw.resolvedAt)).forEach(([playerId, ts]) => {
    const key = typeof playerId === 'number' ? playerId : Number(playerId);
    const at = Number(ts);
    if (!Number.isFinite(key) || !Number.isFinite(at)) return;
    resolvedAt[key] = at;
  });
  const cardId = Number(raw.cardId);
  const playerId = Number(raw.playerId);
  const startedAt = Number(raw.startedAt);
  return {
    active: true,
    cardId: Number.isFinite(cardId) ? cardId : null,
    playerId: Number.isFinite(playerId) ? playerId : null,
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    responses,
    resolvedAt,
  };
}

function normalizeImperialClaim(value) {
  const raw = asRecord(value);
  if (!raw.active) return { ...EMPTY_IMPERIAL_CLAIM };
  const playerId = Number(raw.playerId);
  return {
    active: true,
    playerId: Number.isFinite(playerId) ? playerId : null,
    publicId: typeof raw.publicId === 'string' ? raw.publicId : null,
    mecatol: !!raw.mecatol,
    secret: !!raw.secret && !raw.mecatol,
  };
}

function normalizeTechResearch(value) {
  const raw = asRecord(value);
  if (!raw.active) {
    return { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} };
  }
  const playerId = Number(raw.playerId);
  const primaryPlayerId = Number(raw.primaryPlayerId);
  const picks = asArray(raw.picks).filter(id => typeof id === 'string');
  const queueIds = asArray(raw.queueIds)
    .map(id => Number(id))
    .filter(id => Number.isFinite(id));
  const ignorePrereq = Number(raw.ignorePrereq) > 0 ? 1 : 0;
  const byPlayerRaw = asRecord(raw.byPlayer);
  const byPlayer = {};
  Object.keys(byPlayerRaw).forEach((key) => {
    const id = Number(key);
    if (!Number.isFinite(id)) return;
    const entry = asRecord(byPlayerRaw[key]);
    byPlayer[id] = {
      picks: asArray(entry.picks).filter(t => typeof t === 'string'),
      ignorePrereq: Number(entry.ignorePrereq) > 0 ? 1 : 0,
    };
  });
  return {
    active: true,
    concurrent: !!raw.concurrent || Object.keys(byPlayer).length > 0,
    playerId: Number.isFinite(playerId) ? playerId : null,
    mode: raw.mode === 'secondary' ? 'secondary' : 'primary',
    picks,
    ignorePrereq,
    queueIds,
    primaryPlayerId: Number.isFinite(primaryPlayerId) ? primaryPlayerId : null,
    byPlayer,
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
  const techIds = asArray(player.techIds).filter(id => typeof id === 'string');
  const startingTechIds = asArray(player.startingTechIds).filter(id => typeof id === 'string');
  const eliminated = !!player.eliminated;
  const elimRound = Number(player.eliminatedRound);
  const votePlanets = Math.max(0, asNumber(player.votePlanets, 0));
  return {
    ...player,
    cards,
    playedCardIds,
    strategyPlayed,
    breakthrough: !!player.breakthrough,
    eliminated,
    eliminatedRound: eliminated && Number.isFinite(elimRound) && elimRound > 0 ? elimRound : null,
    techIds,
    startingTechIds,
    votePlanets,
  };
}

function normalizeExpedition(value) {
  const raw = asRecord(value);
  const source = asRecord(raw.slices);
  const slices = emptyExpeditionSlices();
  EXPEDITION_SLICE_IDS.forEach(id => {
    const rawId = source[id];
    if (rawId == null || rawId === '') {
      slices[id] = null;
      return;
    }
    const n = Number(rawId);
    slices[id] = Number.isFinite(n) ? n : null;
  });
  const controllerId = raw.controllerId == null || raw.controllerId === ''
    ? NaN
    : Number(raw.controllerId);
  const placedById = raw.placedById == null || raw.placedById === ''
    ? NaN
    : Number(raw.placedById);
  return {
    slices,
    completed: !!raw.completed,
    controllerId: Number.isFinite(controllerId) ? controllerId : null,
    placedById: Number.isFinite(placedById) ? placedById : null,
    awaitingControlPick: !!raw.awaitingControlPick,
  };
}

function normalizeVpTrack(value) {
  const raw = asRecord(value);
  const custodiansRaw = raw.custodiansPlayerId;
  const custodiansPlayerId = custodiansRaw == null || custodiansRaw === ''
    ? null
    : (Number.isFinite(Number(custodiansRaw)) ? Number(custodiansRaw) : null);
  const supportHolders = {};
  Object.entries(asRecord(raw.supportHolders)).forEach(([fromId, holderId]) => {
    const from = Number(fromId);
    const holder = Number(holderId);
    if (!Number.isFinite(from) || !Number.isFinite(holder)) return;
    if (from === holder) return;
    supportHolders[from] = holder;
  });
  return { custodiansPlayerId, supportHolders };
}

function normalizeGameEvents(value) {
  return asArray(value)
    .filter(entry => entry && typeof entry === 'object' && typeof entry.type === 'string')
    .map(entry => ({
      ...entry,
      type: String(entry.type),
      at: Number.isFinite(entry.at) ? entry.at : Date.now(),
    }))
    .slice(-200);
}

function normalizeStrategyPickHistory(value) {
  return asArray(value)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const round = Number(entry.round);
      const playerId = Number(entry.playerId);
      const cardId = Number(entry.cardId);
      if (!Number.isFinite(round) || round < 1) return null;
      if (!Number.isFinite(playerId) || !Number.isFinite(cardId)) return null;
      return { round, playerId, cardId };
    })
    .filter(Boolean);
}

function normalizeRoundTimes(value) {
  return asArray(value)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const round = Number(entry.round);
      const seconds = Number(entry.seconds);
      if (!Number.isFinite(round) || round < 1) return null;
      if (!Number.isFinite(seconds) || seconds < 0) return null;
      return { round, seconds: Math.floor(seconds) };
    })
    .filter(Boolean)
    .sort((a, b) => a.round - b.round);
}

/** Accepts a nested doc, a legacy flat snapshot, or junk, and returns a valid doc. */
export function normalizeGameState(raw) {
  // Migrations assume the nested document shape. Flat legacy snapshots skip them —
  // toFlat() already lifts their fields into the current shape.
  const nested = raw && typeof raw === 'object'
    && (raw.meta != null || raw.round != null || raw.draft != null || raw.version != null);
  const migrated = nested ? migrateGameState(raw) : raw;
  const flat = toFlat(migrated);
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
      strategyPickHistory: normalizeStrategyPickHistory(flat.strategyPickHistory),
      roundTimes: normalizeRoundTimes(flat.roundTimes),
    },
    players,
    objectives: {
      active: normalizeObjectives(flat.objectives),
      completions: asRecord(flat.completions),
      stage1Deck: asArray(flat.stage1Deck, null) ?? freshStage1Deck({
        usePok: !!flat.usePok,
        useTe: !!flat.useTe,
      }),
      stage2Deck: asArray(flat.stage2Deck, null) ?? freshStage2Deck({
        usePok: !!flat.usePok,
        useTe: !!flat.useTe,
      }),
    },
    vpTrack: normalizeVpTrack(flat.vpTrack),
    round: {
      active: !!flat.roundActive,
      turnOrderIds: normalizeTurnOrderIds(flat, players),
      activeTurnIdx: asNumber(flat.activeTurnIdx, 0),
      passed: asRecord(flat.passed),
      turnTime: asNumber(flat.turnTime, 0),
      turnStartedAt: Number.isFinite(flat.turnStartedAt) ? flat.turnStartedAt : null,
      roundStartedAt: Number.isFinite(flat.roundStartedAt) ? flat.roundStartedAt : null,
      turnPausedAccum: Math.max(0, asNumber(flat.turnPausedAccum, 0)),
      strategyActionTaken: !!flat.strategyActionTaken,
      expeditionClaimedThisTurn: !!flat.expeditionClaimedThisTurn,
      expeditionClaimedSliceId: flat.expeditionClaimedSliceId ?? null,
      strategyResolution: normalizeStrategyResolution(flat.strategyResolution),
      imperialClaim: normalizeImperialClaim(flat.imperialClaim),
      techResearch: normalizeTechResearch(flat.techResearch),
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
      pickStartedAt: Number.isFinite(flat.draftPickStartedAt) ? flat.draftPickStartedAt : null,
    },
    politics: {
      showModal: !!flat.showPoliticsModal,
      step: flat.politicsStep === 'VOTE' || flat.politicsStep === 'SPEAKER'
        ? flat.politicsStep
        : 'SETUP',
      agendas: agendas && agendas.length > 0 ? agendas : emptyAgendas(),
      currentAgendaIndex: asNumber(flat.currentAgendaIndex, 0),
      influenceLocked: asRecord(flat.influenceLocked),
      voteReversed: !!flat.voteReversed,
      oneVoteLaw: !!flat.oneVoteLaw,
    },
    statusPhase: {
      show: !!flat.showStatusPhase,
      checks: { ...EMPTY_STATUS_CHECKS, ...asRecord(flat.statusPhaseChecks) },
      scoring: normalizeObjectiveScoring(flat.objectiveScoring),
    },
    expedition: normalizeExpedition(flat.expedition),
    startingTechDraft: normalizeStartingTechDraft(flat.startingTechDraft),
    log: {
      events: normalizeGameEvents(flat.gameEvents),
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
    localStorage.removeItem('ti4_snapshots');
  } catch {
    /* storage unavailable */
  }
  dropLegacyKeys();
}

/** Finished-game summary kept until the host leaves the results screen. */
export function clearGameSummary() {
  try {
    localStorage.removeItem('ti4_gameSummary');
  } catch {
    /* storage unavailable */
  }
}
