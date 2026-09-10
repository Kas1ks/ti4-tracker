import { STRATEGY_CARDS } from '../data/gameData';
import {
  EMPTY_STATUS_CHECKS,
  EMPTY_OBJECTIVE_SCORING,
  EMPTY_STRATEGY_RESOLUTION,
  createEmptyGameState,
  normalizeGameState,
} from './gameState';
import {
  activePlayer,
  activePlayers,
  areAllStrategiesPlayed,
  canStartRound,
  currentAgenda,
  currentDraftPlayerId,
  isDraftInProgress,
  isStrategyCardPlayed,
  nextSpeakerAfter,
  playersNotPassed,
  turnOrder,
} from './selectors';

const emptyAgenda = () => ({ type: null, votes: {}, locked: {} });

const mapPlayers = (state, fn) => ({ ...state, players: state.players.map(fn) });

const patchPlayer = (state, playerId, patch) => mapPlayers(state, player => (
  player.id === playerId ? { ...player, ...patch(player) } : player
));

const withRound = (state, round) => ({ ...state, round: { ...state.round, ...round } });
const withDraft = (state, draft) => ({ ...state, draft: { ...state.draft, ...draft } });
const withMeta = (state, meta) => ({ ...state, meta: { ...state.meta, ...meta } });
const withPolitics = (state, politics) => ({ ...state, politics: { ...state.politics, ...politics } });

const withObjectives = (state, objectives) => ({
  ...state,
  objectives: { ...state.objectives, ...objectives },
});

const withStatusPhase = (state, statusPhase) => ({
  ...state,
  statusPhase: { ...state.statusPhase, ...statusPhase },
});

/** Naalu always goes last-to-act first, then lowest strategy card, then seat order. */
function sortedForTurnOrder(players) {
  return players.filter(p => !p.eliminated).sort((a, b) => {
    const aNaalu = a.factionId === 'naalu';
    const bNaalu = b.factionId === 'naalu';
    if (aNaalu !== bNaalu) return aNaalu ? -1 : 1;

    const aInit = a.lastMinInitiative ?? 99;
    const bInit = b.lastMinInitiative ?? 99;
    if (aInit !== bInit) return aInit - bInit;

    return a.id - b.id;
  });
}

const clearedDraft = {
  queue: [],
  assignments: {},
  currentQueueIndex: 0,
  pickOrder: [],
  step: 'DRAFT',
  showModal: false,
};

const actionAt = (action) => (
  Number.isFinite(action?.at) ? action.at : Date.now()
);

/** Seconds on the clock since turnStartedAt (or legacy turnTime). */
function elapsedSeconds(state, at) {
  const started = state.round.turnStartedAt;
  if (Number.isFinite(started)) {
    return Math.max(0, Math.floor((at - started) / 1000));
  }
  return Math.max(0, state.round.turnTime || 0);
}

/** Credit the active player's totalTime before the clock resets. */
function bankActivePlayerTime(state, at) {
  if (!state.round.active) return state;
  const player = activePlayer(state);
  if (!player) return state;
  const elapsed = elapsedSeconds(state, at);
  if (elapsed <= 0) return state;
  return patchPlayer(state, player.id, p => ({ totalTime: (p.totalTime || 0) + elapsed }));
}

/** End of round: agenda phase if one is pending, otherwise the status checklist. */
function endRound(state, at = Date.now()) {
  let next = bankActivePlayerTime(state, at);
  next = withRound(next, {
    turnTime: 0,
    turnStartedAt: null,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
  });
  if (next.meta.isAgendaPhasePending) {
    return withPolitics(next, { showModal: true });
  }
  return withStatusPhase(next, {
    show: true,
    checks: { ...EMPTY_STATUS_CHECKS },
    scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 },
  });
}

function startNewRound(state) {
  const next = mapPlayers(
    withMeta(state, { isAgendaPhasePending: false, roundNumber: state.meta.roundNumber + 1 }),
    player => ({
      ...player,
      strategyPlayed: false,
      playedCardIds: [],
      passed: false,
      cards: [],
    }),
  );

  return withDraft(
    withRound(next, {
      active: false,
      turnOrderIds: [],
      activeTurnIdx: 0,
      passed: {},
      turnTime: 0,
      turnStartedAt: null,
      strategyActionTaken: false,
      strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    }),
    clearedDraft,
  );
}

function startRound(state, at = Date.now()) {
  const ordered = sortedForTurnOrder(state.players);

  const next = mapPlayers(state, player => ({
    ...player,
    passed: !!player.eliminated,
    strategyPlayed: !!player.eliminated,
    playedCardIds: player.eliminated
      ? (player.cards || []).map(c => c.id).filter(id => Number.isFinite(id))
      : [],
  }));

  return withRound(next, {
    active: true,
    turnOrderIds: ordered.map(p => p.id),
    activeTurnIdx: 0,
    passed: {},
    turnTime: 0,
    turnStartedAt: at,
    strategyActionTaken: false,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
  });
}

/** Advance to the next player who has not passed; end the round if nobody is left. */
function nextTurn(state, at = Date.now()) {
  if (state.round?.strategyResolution?.active) return state;
  const order = turnOrder(state);
  if (order.length === 0) return state;
  if (playersNotPassed(state).length === 0) return endRound(state, at);

  let next = bankActivePlayerTime(state, at);

  let nextIdx = (next.round.activeTurnIdx + 1) % order.length;
  let checked = 0;
  const orderAfter = turnOrder(next);
  while (next.round.passed[orderAfter[nextIdx].id] && checked < orderAfter.length) {
    nextIdx = (nextIdx + 1) % orderAfter.length;
    checked += 1;
  }

  const activeTurnIdx = checked < orderAfter.length ? nextIdx : next.round.activeTurnIdx;
  return withRound(next, {
    activeTurnIdx,
    turnTime: 0,
    turnStartedAt: at,
    strategyActionTaken: false,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
  });
}

function passTurn(state, playerId, at = Date.now()) {
  if (state.round?.strategyResolution?.active) return state;
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.eliminated) return state;
  if (state.round.passed?.[playerId]) return state;
  if (activePlayer(state)?.id !== playerId) return state;
  if (!areAllStrategiesPlayed(player)) return state;

  const passed = { ...state.round.passed, [playerId]: true };
  const next = withRound(state, { passed });
  return playersNotPassed(next).length === 0 ? endRound(next, at) : nextTurn(next, at);
}

function eliminatePlayer(state, playerId, at = Date.now()) {
  if (!state.players.some(p => p.id === playerId)) return state;

  let next = patchPlayer(state, playerId, () => ({ eliminated: true }));
  next = withRound(next, { passed: { ...next.round.passed, [playerId]: true } });

  const resolution = next.round?.strategyResolution;
  if (resolution?.active && resolution.responses?.[playerId] != null) {
    const { [playerId]: _removed, ...rest } = resolution.responses;
    const responses = rest;
    next = withRound(next, {
      strategyResolution: { ...resolution, responses },
    });
    if (Object.keys(responses).length === 0
      || Object.values(responses).every(s => s === 'played' || s === 'passed')) {
      next = commitStrategyPlay(next);
    }
  }

  if (next.meta.speakerId === playerId) {
    next = withMeta(next, { speakerId: nextSpeakerAfter(next, playerId) });
  }

  const wasActive = activePlayer(state)?.id === playerId;
  if (next.round.active && playersNotPassed(next).length === 0) return endRound(next, at);
  return wasActive ? nextTurn(next, at) : next;
}

function strategyResolutionOf(state) {
  return state.round?.strategyResolution || EMPTY_STRATEGY_RESOLUTION;
}

function startStrategyResolution(state, cardId) {
  const player = activePlayer(state);
  if (!player?.cards?.length) return state;
  if (state.round.strategyActionTaken) return state;
  if (strategyResolutionOf(state).active) return state;

  const already = new Set(
    Array.isArray(player.playedCardIds) ? player.playedCardIds : [],
  );
  if (player.strategyPlayed && already.size === 0) return state;

  let resolvedCardId = cardId;
  if (resolvedCardId == null) {
    const nextCard = [...player.cards]
      .filter(c => !already.has(c.id))
      .sort((a, b) => a.id - b.id)[0];
    resolvedCardId = nextCard?.id;
  }
  if (resolvedCardId == null || already.has(resolvedCardId)) return state;
  if (!player.cards.some(c => c.id === resolvedCardId)) return state;

  const responses = {};
  activePlayers(state).forEach(p => {
    responses[p.id] = 'pending';
  });

  return withRound(state, {
    strategyActionTaken: true,
    strategyResolution: {
      active: true,
      cardId: resolvedCardId,
      playerId: player.id,
      responses,
    },
  });
}

function commitStrategyPlay(state) {
  const resolution = strategyResolutionOf(state);
  if (!resolution.active) return state;

  const player = state.players.find(p => p.id === resolution.playerId);
  const cardId = resolution.cardId;
  const cleared = withRound(state, {
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    strategyActionTaken: true,
  });

  if (!player || cardId == null) return cleared;
  if (!player.cards?.some(c => c.id === cardId)) return cleared;

  const already = new Set(
    Array.isArray(player.playedCardIds) ? player.playedCardIds : [],
  );
  if (already.has(cardId)) return cleared;

  const playedCardIds = [...already, cardId];
  const strategyPlayed = player.cards.every(c => playedCardIds.includes(c.id));
  return patchPlayer(cleared, player.id, () => ({ playedCardIds, strategyPlayed }));
}

function resolveStrategyResponse(state, playerId, choice) {
  const resolution = strategyResolutionOf(state);
  if (!resolution.active) return state;
  if (choice !== 'played' && choice !== 'passed') return state;

  const current = resolution.responses?.[playerId];
  if (current == null || current !== 'pending') return state;

  const responses = { ...resolution.responses, [playerId]: choice };
  let next = withRound(state, {
    strategyResolution: { ...resolution, responses },
  });

  const allDone = Object.values(responses).every(s => s === 'played' || s === 'passed');
  if (allDone) next = commitStrategyPlay(next);
  return next;
}

function openDraft(state) {
  if (isDraftInProgress(state)) return withDraft(state, { showModal: true });

  const eligible = activePlayers(state);
  if (eligible.length === 0 || canStartRound(state) || state.round.active) return state;

  let speakerId = state.meta.speakerId;
  let speakerIndex = eligible.findIndex(p => p.id === speakerId);
  if (speakerIndex === -1) {
    speakerId = eligible[0].id;
    speakerIndex = 0;
  }

  const draftOrder = draftOrderFromSpeaker(eligible, speakerIndex);
  const queue = buildFullDraftQueue(draftOrder, state.players.length);

  return withDraft(withMeta(state, { speakerId }), {
    queue,
    assignments: {},
    currentQueueIndex: 0,
    pickOrder: [],
    step: 'DRAFT',
    showModal: true,
  });
}

/** Clockwise seat order starting from the speaker. */
function draftOrderFromSpeaker(eligible, speakerIndex) {
  return [...eligible.slice(speakerIndex), ...eligible.slice(0, speakerIndex)];
}

function buildFullDraftQueue(draftOrder, seatCount) {
  const cardsPerPlayer = seatCount <= 4 ? 2 : 1;
  const queue = [];
  for (let pick = 0; pick < cardsPerPlayer; pick += 1) {
    draftOrder.forEach(player => queue.push(player.id));
  }
  return queue;
}

/**
 * After a mid-draft speaker change: keep completed picks, rebuild who still
 * needs to pick using the new speaker-clockwise order.
 */
function realignDraftQueueToSpeaker(state) {
  if (!isDraftInProgress(state) || state.draft.step === 'CONFIRM') return state;

  const eligible = activePlayers(state);
  if (eligible.length === 0) return state;

  let speakerIndex = eligible.findIndex(p => p.id === state.meta.speakerId);
  if (speakerIndex === -1) speakerIndex = 0;
  const draftOrder = draftOrderFromSpeaker(eligible, speakerIndex);
  const cardsPerPlayer = state.players.length <= 4 ? 2 : 1;

  const assignedCount = new Map(eligible.map(p => [p.id, 0]));
  Object.values(state.draft.assignments || {}).forEach((rawId) => {
    const playerId = Number(rawId);
    if (!assignedCount.has(playerId)) return;
    assignedCount.set(playerId, assignedCount.get(playerId) + 1);
  });

  const remaining = [];
  for (let pick = 0; pick < cardsPerPlayer; pick += 1) {
    draftOrder.forEach((player) => {
      const have = assignedCount.get(player.id) || 0;
      if (have < pick + 1) remaining.push(player.id);
    });
  }

  const completed = (state.draft.pickOrder || [])
    .map((cardId) => {
      const raw = state.draft.assignments[cardId] ?? state.draft.assignments[String(cardId)];
      return raw == null ? null : Number(raw);
    })
    .filter(id => Number.isFinite(id));

  return withDraft(state, {
    queue: [...completed, ...remaining],
    currentQueueIndex: completed.length,
    step: remaining.length === 0 ? 'CONFIRM' : 'DRAFT',
  });
}

function setSpeaker(state, playerId) {
  if (playerId == null) return state;
  const target = state.players.find(p => p.id === playerId);
  if (!target || target.eliminated) return state;
  if (state.meta.speakerId === playerId) return state;

  const next = withMeta(state, { speakerId: playerId });
  return realignDraftQueueToSpeaker(next);
}

function pickCard(state, cardId) {
  const playerId = currentDraftPlayerId(state);
  if (playerId == null || state.draft.assignments[cardId] != null) return state;

  const nextIndex = state.draft.currentQueueIndex + 1;
  const finished = nextIndex >= state.draft.queue.length;

  return withDraft(state, {
    assignments: { ...state.draft.assignments, [cardId]: playerId },
    pickOrder: [...state.draft.pickOrder, cardId],
    currentQueueIndex: finished ? state.draft.currentQueueIndex : nextIndex,
    step: finished ? 'CONFIRM' : 'DRAFT',
  });
}

function undoPick(state) {
  if (state.draft.pickOrder.length === 0) return state;

  const pickOrder = state.draft.pickOrder.slice(0, -1);
  const assignments = { ...state.draft.assignments };
  delete assignments[state.draft.pickOrder[state.draft.pickOrder.length - 1]];

  return withDraft(state, {
    assignments,
    pickOrder,
    currentQueueIndex: pickOrder.length,
    step: 'DRAFT',
  });
}

/** Hand out the drafted cards and grow the trade-good bonus on untaken ones. */
function confirmDraft(state) {
  const cardsByPlayer = new Map();
  Object.entries(state.draft.assignments).forEach(([cardId, playerId]) => {
    const owned = cardsByPlayer.get(playerId) || [];
    owned.push(Number(cardId));
    cardsByPlayer.set(playerId, owned);
  });

  const next = mapPlayers(state, player => {
    const cardIds = (cardsByPlayer.get(player.id) || []).sort((a, b) => a - b);
    return {
      ...player,
      cards: cardIds.map(id => STRATEGY_CARDS.find(card => card.id === id)).filter(Boolean),
      lastMinInitiative: cardIds.length ? cardIds[0] : player.lastMinInitiative ?? 99,
      playedCardIds: [],
      strategyPlayed: false,
    };
  });

  const takenIds = new Set(Object.keys(state.draft.assignments).map(Number));
  const strategyCardBonuses = { ...state.draft.strategyCardBonuses };
  STRATEGY_CARDS.forEach(card => {
    strategyCardBonuses[card.id] = takenIds.has(card.id)
      ? 0
      : (strategyCardBonuses[card.id] || 0) + 1;
  });

  return withDraft(next, { ...clearedDraft, strategyCardBonuses });
}

function confirmStatusPhase(state) {
  const next = withStatusPhase(state, {
    show: false,
    checks: { ...EMPTY_STATUS_CHECKS },
    scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 },
  });

  if (!next.meta.isPoliticsActive) return startNewRound(next);

  return withPolitics(withMeta(next, { isAgendaPhasePending: true }), {
    showModal: true,
    step: 'SETUP',
    agendas: [emptyAgenda()],
    currentAgendaIndex: 0,
    influenceLocked: {},
    voteReversed: false,
  });
}

function scoringOf(state) {
  return state.statusPhase?.scoring || EMPTY_OBJECTIVE_SCORING;
}

function withScoring(state, scoringPatch) {
  const scoring = { ...scoringOf(state), ...scoringPatch };
  return withStatusPhase(state, { scoring });
}

function patchScoringResponse(state, playerId, patch) {
  const scoring = scoringOf(state);
  const prev = scoring.responses[playerId];
  if (!prev) return state;
  return withScoring(state, {
    responses: {
      ...scoring.responses,
      [playerId]: { ...prev, ...patch },
    },
  });
}

function allScoringResolved(responses) {
  const list = Object.values(responses);
  return list.length > 0 && list.every(r => r.status === 'done' || r.status === 'passed');
}

function currentScoringPlayerId(scoring) {
  if (!scoring?.active) return null;
  const ids = scoring.orderIds || [];
  return ids[scoring.currentIdx] ?? null;
}

function isScoringTurn(scoring, playerId) {
  return currentScoringPlayerId(scoring) === playerId;
}

function finishScoringIfComplete(state) {
  const scoring = scoringOf(state);
  if (!scoring.active || !allScoringResolved(scoring.responses)) return state;
  return withStatusPhase(state, {
    scoring: { ...scoring, active: false },
    checks: { ...state.statusPhase.checks, scoreObjectives: true },
  });
}

/** After a player resolves, advance to the next pending seat in initiative order. */
function advanceScoringTurn(state) {
  const scoring = scoringOf(state);
  if (allScoringResolved(scoring.responses)) {
    return finishScoringIfComplete(state);
  }
  const nextIdx = (scoring.orderIds || []).findIndex(
    id => scoring.responses[id]?.status === 'pending',
  );
  if (nextIdx < 0) return finishScoringIfComplete(state);
  return withScoring(state, { currentIdx: nextIdx });
}

function scoringOrderIds(state) {
  const active = activePlayers(state);
  const activeIds = new Set(active.map(p => p.id));
  const fromRound = (state.round.turnOrderIds || []).filter(id => activeIds.has(id));
  if (fromRound.length > 0) return fromRound;
  return sortedForTurnOrder(active).map(p => p.id);
}

function startObjectiveScoring(state) {
  if (!state.statusPhase?.show) return state;
  if (state.statusPhase.checks.scoreObjectives) return state;
  if (scoringOf(state).active) return state;

  const orderIds = scoringOrderIds(state);
  const responses = {};
  orderIds.forEach(id => {
    responses[id] = { status: 'pending', publicId: null, secret: false };
  });
  // Include any active player missing from order (safety).
  activePlayers(state).forEach(p => {
    if (!responses[p.id]) {
      responses[p.id] = { status: 'pending', publicId: null, secret: false };
      orderIds.push(p.id);
    }
  });

  if (Object.keys(responses).length === 0) {
    return withStatusPhase(state, {
      scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 },
      checks: { ...state.statusPhase.checks, scoreObjectives: true },
    });
  }
  return withScoring(state, { active: true, responses, orderIds, currentIdx: 0 });
}

function undoWindowScores(state, playerId, response) {
  let next = state;
  if (response.publicId) {
    const key = `${playerId}_${response.publicId}`;
    next = withObjectives(next, {
      completions: { ...next.objectives.completions, [key]: false },
    });
  }
  if (response.secret) {
    next = patchPlayer(next, playerId, player => ({
      secrets: Math.min(4, Math.max(0, player.secrets - 1)),
    }));
  }
  return next;
}

function selectScoringPublic(state, playerId, objectiveId) {
  const scoring = scoringOf(state);
  if (!scoring.active || !isScoringTurn(scoring, playerId)) return state;
  const response = scoring.responses[playerId];
  if (!response || response.status !== 'pending') return state;
  if (!state.objectives.active.some(o => o.id === objectiveId)) return state;

  const key = `${playerId}_${objectiveId}`;
  const alreadyOwned = !!state.objectives.completions[key] && response.publicId !== objectiveId;
  if (alreadyOwned) return state;

  let completions = { ...state.objectives.completions };
  let publicId = response.publicId;

  if (publicId === objectiveId) {
    completions[key] = false;
    publicId = null;
  } else {
    if (publicId) {
      completions[`${playerId}_${publicId}`] = false;
    }
    completions[key] = true;
    publicId = objectiveId;
  }

  return patchScoringResponse(
    withObjectives(state, { completions }),
    playerId,
    { publicId },
  );
}

function toggleScoringSecret(state, playerId) {
  const scoring = scoringOf(state);
  if (!scoring.active || !isScoringTurn(scoring, playerId)) return state;
  const response = scoring.responses[playerId];
  if (!response || response.status !== 'pending') return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;

  if (response.secret) {
    return patchScoringResponse(
      patchPlayer(state, playerId, p => ({
        secrets: Math.min(4, Math.max(0, p.secrets - 1)),
      })),
      playerId,
      { secret: false },
    );
  }

  // Players score at most 3 secrets; a 4th is host-only via ADJUST_SECRETS.
  if (player.secrets >= 3) return state;
  return patchScoringResponse(
    patchPlayer(state, playerId, p => ({
      secrets: Math.min(3, p.secrets + 1),
    })),
    playerId,
    { secret: true },
  );
}

function confirmObjectiveScoring(state, playerId) {
  const scoring = scoringOf(state);
  if (!scoring.active || !isScoringTurn(scoring, playerId)) return state;
  const response = scoring.responses[playerId];
  if (!response || response.status !== 'pending') return state;
  return advanceScoringTurn(patchScoringResponse(state, playerId, { status: 'done' }));
}

function passObjectiveScoring(state, playerId) {
  const scoring = scoringOf(state);
  if (!scoring.active || !isScoringTurn(scoring, playerId)) return state;
  const response = scoring.responses[playerId];
  if (!response || response.status !== 'pending') return state;

  const cleared = undoWindowScores(state, playerId, response);
  return advanceScoringTurn(
    patchScoringResponse(cleared, playerId, {
      status: 'passed',
      publicId: null,
      secret: false,
    }),
  );
}

function mapCurrentAgenda(state, fn) {
  return withPolitics(state, {
    agendas: state.politics.agendas.map((agenda, index) => (
      index === state.politics.currentAgendaIndex ? fn(agenda) : agenda
    )),
  });
}

function nextAgenda(state) {
  const nextIndex = state.politics.currentAgendaIndex + 1;
  const agendas = state.politics.agendas[nextIndex]
    ? state.politics.agendas
    : [...state.politics.agendas, emptyAgenda()];

  // Step is kept as-is: influence is entered once and reused for later agendas.
  return withPolitics(state, { agendas, currentAgendaIndex: nextIndex });
}

export function gameReducer(state, action) {
  switch (action.type) {
    // --- Setup ---
    case 'SET_TARGET_SCORE':
      return withMeta(state, { targetScore: action.value });

    case 'SET_EXPANSION':
      return withMeta(state, { [action.expansion === 'te' ? 'useTe' : 'usePok']: !!action.enabled });

    case 'ADD_PLAYER': {
      if (state.players.length >= 8) return state;
      return {
        ...state,
        players: [...state.players, {
          id: action.playerId,
          name: action.name ?? `Игрок ${state.players.length + 1}`,
          factionId: action.factionId,
          color: '',
          secrets: 0,
          extra: 0,
          totalTime: 0,
          damageDealt: 0,
          eliminated: false,
        }],
      };
    }

    case 'REMOVE_PLAYER': {
      // Mid-game seat removal must go through ELIMINATE_PLAYER so turn/speaker
      // /resolution state stays consistent.
      if (state.isGameActive) return state;
      const next = {
        ...state,
        players: state.players.filter(p => p.id !== action.playerId),
      };
      if (next.meta.speakerId === action.playerId) {
        return withMeta(next, { speakerId: next.players[0]?.id ?? null });
      }
      return next;
    }

    case 'UPDATE_PLAYER':
      return patchPlayer(state, action.playerId, () => action.patch);

    case 'START_GAME':
      return withMeta({ ...state, isGameActive: true }, {
        speakerId: state.meta.speakerId ?? state.players[0]?.id ?? null,
      });

    case 'SET_SPEAKER':
      return setSpeaker(state, action.playerId);

    case 'TOGGLE_POLITICS_ACTIVE':
      return withMeta(state, { isPoliticsActive: !state.meta.isPoliticsActive });

    // --- Scoring ---
    case 'ADJUST_SECRETS':
      return patchPlayer(state, action.playerId, player => ({
        secrets: Math.min(4, Math.max(0, player.secrets + action.delta)),
      }));

    case 'ADJUST_MECATOL':
      return patchPlayer(state, action.playerId, player => ({
        extra: Math.max(0, player.extra + action.delta),
      }));

    case 'SET_INFLUENCE':
      return patchPlayer(state, action.playerId, () => ({
        influence: Math.max(0, Number(action.influence) || 0),
      }));

    case 'LOCK_INFLUENCE':
      return withPolitics(state, {
        influenceLocked: {
          ...(state.politics.influenceLocked || {}),
          [action.playerId]: true,
        },
      });

    case 'UNLOCK_INFLUENCE': {
      const influenceLocked = { ...(state.politics.influenceLocked || {}) };
      delete influenceLocked[action.playerId];
      return withPolitics(state, { influenceLocked });
    }

    case 'ADD_COMBAT_DAMAGE':
      return mapPlayers(state, player => (
        action.damageByPlayerId[player.id]
          ? { ...player, damageDealt: (player.damageDealt || 0) + action.damageByPlayerId[player.id] }
          : player
      ));

    case 'TOGGLE_COMPLETION': {
      const key = `${action.playerId}_${action.objectiveId}`;
      return withObjectives(state, {
        completions: { ...state.objectives.completions, [key]: !state.objectives.completions[key] },
      });
    }

    case 'ADD_OBJECTIVE':
      return withObjectives(state, { active: [...state.objectives.active, action.objective] });

    case 'REMOVE_OBJECTIVE':
      return withObjectives(state, {
        active: state.objectives.active.filter(obj => obj.id !== action.objectiveId),
      });

    // --- Draft ---
    case 'OPEN_DRAFT':
      return openDraft(state);

    case 'SET_DRAFT_VISIBLE':
      return withDraft(state, { showModal: !!action.visible });

    case 'PICK_CARD':
      return pickCard(state, action.cardId);

    case 'UNDO_PICK':
      return undoPick(state);

    case 'REASSIGN_CARD':
      return withDraft(state, {
        assignments: { ...state.draft.assignments, [action.cardId]: Number(action.playerId) },
      });

    case 'CONFIRM_DRAFT':
      return confirmDraft(state);

    // --- Round ---
    case 'START_ROUND':
      return startRound(state, actionAt(action));

    case 'PLAY_STRATEGY':
      return startStrategyResolution(state, action.cardId);

    case 'RESOLVE_STRATEGY':
      return resolveStrategyResponse(state, action.playerId, action.choice);

    case 'TICK': {
      // Legacy solo tick: display-only turnTime. totalTime is banked on turn change.
      return withRound(state, { turnTime: state.round.turnTime + 1 });
    }

    case 'NEXT_TURN':
      return nextTurn(state, actionAt(action));

    case 'PASS_TURN':
      return passTurn(state, action.playerId, actionAt(action));

    case 'ELIMINATE_PLAYER':
      return eliminatePlayer(state, action.playerId, actionAt(action));

    case 'END_ROUND':
      return endRound(state, actionAt(action));

    // --- Status phase ---
    case 'TOGGLE_STATUS_CHECK': {
      // scoreObjectives is controlled by the scoring window, not the checklist click.
      if (action.key === 'scoreObjectives') return state;
      if (!Object.prototype.hasOwnProperty.call(EMPTY_STATUS_CHECKS, action.key)) return state;
      return withStatusPhase(state, {
        checks: { ...state.statusPhase.checks, [action.key]: !state.statusPhase.checks[action.key] },
      });
    }

    case 'START_OBJECTIVE_SCORING':
      return startObjectiveScoring(state);

    case 'SELECT_SCORING_PUBLIC':
      return selectScoringPublic(state, action.playerId, action.objectiveId);

    case 'TOGGLE_SCORING_SECRET':
      return toggleScoringSecret(state, action.playerId);

    case 'CONFIRM_OBJECTIVE_SCORING':
      return confirmObjectiveScoring(state, action.playerId);

    case 'PASS_OBJECTIVE_SCORING':
      return passObjectiveScoring(state, action.playerId);

    case 'SET_STATUS_PHASE_VISIBLE':
      return withStatusPhase(state, { show: !!action.visible });

    case 'CONFIRM_STATUS_PHASE':
      return confirmStatusPhase(state);

    // --- Agenda phase ---
    case 'SET_AGENDA_TYPE':
      return mapCurrentAgenda(state, agenda => ({
        ...agenda,
        type: action.agendaType,
        customChoices: action.agendaType === 'OTHER' ? [''] : undefined,
      }));

    case 'SET_AGENDA_CUSTOM_CHOICES':
      return mapCurrentAgenda(state, agenda => ({ ...agenda, customChoices: action.choices }));

    case 'SET_VOTE': {
      const agenda = currentAgenda(state);
      if (agenda?.locked?.[action.playerId]) return state;
      return mapCurrentAgenda(state, a => ({
        ...a,
        votes: { ...a.votes, [action.playerId]: action.vote },
      }));
    }

    case 'LOCK_VOTE':
      return mapCurrentAgenda(state, agenda => ({
        ...agenda,
        locked: { ...agenda.locked, [action.playerId]: true },
      }));

    case 'TOGGLE_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !state.politics.voteReversed });

    case 'SET_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !!action.reversed });

    case 'SET_POLITICS_STEP':
      return withPolitics(state, { step: action.step });

    case 'NEXT_AGENDA':
      return nextAgenda(state);

    case 'FINISH_AGENDA_PHASE': {
      let next = state;
      if (action.playerId != null) {
        next = withMeta(next, { speakerId: action.playerId });
      }
      return startNewRound(withPolitics(next, {
        showModal: false,
        influenceLocked: {},
        voteReversed: false,
      }));
    }

    case 'SET_POLITICS_VISIBLE':
      return withPolitics(state, { showModal: !!action.visible });

    // --- Whole-document changes ---
    case 'LOAD_STATE':
      return { ...normalizeGameState(action.state), isGameActive: true };

    case 'RESET_GAME':
      return createEmptyGameState();

    default:
      return state;
  }
}
