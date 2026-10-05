import { STRATEGY_CARDS } from '../data/gameData';
import {
  EMPTY_STATUS_CHECKS,
  EMPTY_OBJECTIVE_SCORING,
  EMPTY_STRATEGY_RESOLUTION,
  EMPTY_IMPERIAL_CLAIM,
  EMPTY_TECH_RESEARCH,
  EMPTY_STARTING_TECH_DRAFT,
  createEmptyGameState,
  normalizeGameState,
  decksForExpansions,
} from './gameState';
import { emptyExpeditionSlices } from '../data/expedition';
import {
  availableTechs,
  canConfirmStartingTech,
  canResearch,
  isStartingTechWaveAReady,
  maxResearchSlots,
  playersNeedingStartingTechDraft,
  resolveStartingTechIds,
  sanitizeStartingTechPicks,
  startingTechChoice,
  researchSynergyOpts,
  techById,
} from '../data/technologies';
import {
  claimExpeditionSlice,
  resolveThundersEdgeControl,
  setExpeditionSlice,
} from './expeditionActions';
import { isVictoryActionAllowed, isVictoryReached } from './victory';
import {
  mapPlayers,
  patchPlayer,
  withDraft,
  withMeta,
  withObjectives,
  withPolitics,
  withRound,
  withStatusPhase,
} from './stateHelpers';
import {
  activePlayer,
  activePlayers,
  areAllStrategiesPlayed,
  canStartRound,
  currentAgenda,
  currentDraftPlayerId,
  isDraftInProgress,
  nextSpeakerAfter,
  playersNotPassed,
  turnOrder,
} from './selectors';

const emptyAgenda = () => ({ type: null, votes: {}, locked: {} });

/** Under one-vote law, a non-abstain ballot is always amount 1 (no planet bonuses). */
function coerceAgendaVote(state, vote) {
  if (!vote || typeof vote !== 'object') return vote;
  if (!state.politics?.oneVoteLaw) return vote;
  if (vote.choice === 'abstain') return { ...vote, amount: 0, planets: 0 };
  return { ...vote, amount: 1, planets: 0 };
}

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
  pickStartedAt: null,
};

const actionAt = (action) => (
  Number.isFinite(action?.at) ? action.at : Date.now()
);

/** Seconds on the clock for the active turn (paused accum + live segment). */
function liveTurnElapsed(state, at) {
  const accum = Math.max(0, state.round?.turnPausedAccum || 0);
  const started = state.round?.turnStartedAt;
  if (Number.isFinite(started)) {
    return accum + Math.max(0, Math.floor((at - started) / 1000));
  }
  return accum;
}

/** Credit the active player's totalTime before the clock resets. */
function bankActivePlayerTime(state, at) {
  if (!state.round.active) return state;
  const player = activePlayer(state);
  if (!player) return state;
  const elapsed = liveTurnElapsed(state, at);
  let next = state;
  if (elapsed > 0) {
    next = patchPlayer(next, player.id, p => ({ totalTime: (p.totalTime || 0) + elapsed }));
  }
  return withRound(next, { turnPausedAccum: 0, turnTime: 0 });
}

/** Freeze action-phase duration into meta.roundTimes for the current round number. */
function bankRoundTime(state, at) {
  const started = state.round?.roundStartedAt;
  if (!Number.isFinite(started)) {
    return withRound(state, { roundStartedAt: null });
  }
  const secs = Math.max(0, Math.floor((at - started) / 1000));
  const roundNum = state.meta?.roundNumber || 1;
  const prev = Array.isArray(state.meta?.roundTimes) ? state.meta.roundTimes : [];
  const roundTimes = [
    ...prev.filter(entry => entry.round !== roundNum),
    { round: roundNum, seconds: secs },
  ].sort((a, b) => a.round - b.round);
  return withMeta(
    withRound(state, { roundStartedAt: null }),
    { roundTimes },
  );
}

/** End of round: agenda phase if one is pending, otherwise the status checklist. */
function endRound(state, at = Date.now()) {
  let next = bankActivePlayerTime(state, at);
  next = bankRoundTime(next, at);
  next = withRound(next, {
    turnTime: 0,
    turnStartedAt: null,
    turnPausedAccum: 0,
    roundStartedAt: null,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
    techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
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
      roundStartedAt: null,
      turnPausedAccum: 0,
      strategyActionTaken: false,
      expeditionClaimedThisTurn: false,
      expeditionClaimedSliceId: null,
      strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
      imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
      techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
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
    roundStartedAt: at,
    turnPausedAccum: 0,
    strategyActionTaken: false,
    expeditionClaimedThisTurn: false,
    expeditionClaimedSliceId: null,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
    techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
  });
}

/** Advance to the next player who has not passed; end the round if nobody is left. */
function nextTurn(state, at = Date.now()) {
  if (state.round?.strategyResolution?.active) return state;
  if (state.round?.imperialClaim?.active) return state;
  if (state.round?.techResearch?.active) return state;
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
    turnPausedAccum: 0,
    strategyActionTaken: false,
    expeditionClaimedThisTurn: false,
    expeditionClaimedSliceId: null,
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
    techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
  });
}

function passTurn(state, playerId, at = Date.now()) {
  if (state.round?.strategyResolution?.active) return state;
  if (state.round?.imperialClaim?.active) return state;
  if (state.round?.techResearch?.active) return state;
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

  const resolution = strategyResolutionOf(state);
  let next = state;
  // Bank pending resolution time before removing the seat from the poll.
  if (resolution.active && resolution.responses?.[playerId] === 'pending') {
    const started = resolution.startedAt;
    const secs = Number.isFinite(started) ? Math.max(0, Math.floor((at - started) / 1000)) : 0;
    if (secs > 0) {
      next = patchPlayer(next, playerId, p => ({ totalTime: (p.totalTime || 0) + secs }));
    }
  }

  next = patchPlayer(next, playerId, (p) => ({
    eliminated: true,
    eliminatedRound: Number.isFinite(p.eliminatedRound) && p.eliminatedRound > 0
      ? p.eliminatedRound
      : (state.meta?.roundNumber || 1),
  }));
  next = withRound(next, { passed: { ...next.round.passed, [playerId]: true } });

  const openResolution = next.round?.strategyResolution;
  if (openResolution?.active && openResolution.responses?.[playerId] != null) {
    const { [playerId]: _removed, ...rest } = openResolution.responses;
    const responses = rest;
    next = withRound(next, {
      strategyResolution: { ...openResolution, responses },
    });
    if (Object.keys(responses).length === 0
      || Object.values(responses).every(s => s === 'played' || s === 'passed')) {
      next = commitStrategyPlay(next, at);
    }
  }

  if (next.meta.speakerId === playerId) {
    next = withMeta(next, { speakerId: nextSpeakerAfter(next, playerId) });
  }

  const claim = imperialClaimOf(next);
  if (claim.active && claim.playerId === playerId) {
    next = clearImperialClaim(next);
  }

  const tech = techResearchOf(next);
  if (tech.active) {
    if (tech.concurrent) {
      const byPlayer = { ...(tech.byPlayer || {}) };
      delete byPlayer[playerId];
      next = withRound(next, { techResearch: { ...tech, byPlayer } });
    } else if (tech.playerId === playerId) {
      next = clearTechResearch(next);
    }
  }

  const wasActive = activePlayer(state)?.id === playerId;
  if (next.round.active && playersNotPassed(next).length === 0) return endRound(next, at);
  return wasActive ? nextTurn(next, at) : next;
}

function strategyResolutionOf(state) {
  return state.round?.strategyResolution || EMPTY_STRATEGY_RESOLUTION;
}

function startStrategyResolution(state, cardId, at = Date.now()) {
  const player = activePlayer(state);
  if (!player?.cards?.length) return state;
  if (state.round.strategyActionTaken) return state;
  if (strategyResolutionOf(state).active) return state;
  if (imperialClaimOf(state).active) return state;
  if (techResearchOf(state).active) return state;

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

  // Pause the active-player turn clock; resolution time is billed per seat instead.
  const pausedAccum = liveTurnElapsed(state, at);

  return withRound(state, {
    turnStartedAt: null,
    turnPausedAccum: pausedAccum,
    strategyActionTaken: true,
    strategyResolution: {
      active: true,
      cardId: resolvedCardId,
      playerId: player.id,
      startedAt: at,
      responses,
      resolvedAt: {},
    },
  });
}

/** Technology (7) opens concurrent tech + shared resolution; Imperial (8) primary UI first. */
function beginStrategyPlay(state, cardId, at = Date.now()) {
  const player = activePlayer(state);
  if (!player?.cards?.length) return state;
  if (state.round.strategyActionTaken) return state;
  if (strategyResolutionOf(state).active) return state;
  if (imperialClaimOf(state).active) return state;
  if (techResearchOf(state).active) return state;

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

  if (resolvedCardId === 7) {
    const withPoll = startStrategyResolution(state, 7, at);
    if (!strategyResolutionOf(withPoll).active) return state;
    return withRound(withPoll, {
      techResearch: {
        active: true,
        concurrent: true,
        playerId: null,
        mode: 'primary',
        picks: [],
        ignorePrereq: 0,
        queueIds: [],
        primaryPlayerId: player.id,
        byPlayer: {},
      },
    });
  }

  if (resolvedCardId === 8) {
    return withRound(state, {
      imperialClaim: {
        active: true,
        playerId: player.id,
        publicId: null,
        mecatol: false,
        secret: false,
      },
    });
  }

  return startStrategyResolution(state, resolvedCardId, at);
}

function commitStrategyPlay(state, at = Date.now()) {
  const resolution = strategyResolutionOf(state);
  if (!resolution.active) return state;

  const player = state.players.find(p => p.id === resolution.playerId);
  const cardId = resolution.cardId;
  // Resume the active-player turn clock after the shared resolution window.
  const cleared = withRound(state, {
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    strategyActionTaken: true,
    turnStartedAt: at,
  });

  if (!player || cardId == null) return cleared;
  return markStrategyCardPlayed(cleared, player.id, cardId, at);
}

/** Mark a strategy card played and clear tech session (Technology / commit helpers). */
function markStrategyCardPlayed(state, playerId, cardId, at = Date.now()) {
  const player = state.players.find(p => p.id === playerId);
  let next = withRound(state, {
    strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
    strategyActionTaken: true,
    techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
    // Keep / restore turn clock if already resumed by commitStrategyPlay.
    turnStartedAt: Number.isFinite(state.round?.turnStartedAt) ? state.round.turnStartedAt : at,
  });
  if (!player || cardId == null) return next;
  if (!player.cards?.some(c => c.id === cardId)) return next;

  const already = new Set(
    Array.isArray(player.playedCardIds) ? player.playedCardIds : [],
  );
  if (already.has(cardId)) return next;

  const playedCardIds = [...already, cardId];
  const strategyPlayed = player.cards.every(c => playedCardIds.includes(c.id));
  return patchPlayer(next, player.id, () => ({ playedCardIds, strategyPlayed }));
}

function resolveStrategyResponse(state, playerId, choice, at = Date.now()) {
  const resolution = strategyResolutionOf(state);
  if (!resolution.active) return state;
  if (choice !== 'played' && choice !== 'passed') return state;

  const current = resolution.responses?.[playerId];
  if (current == null || current !== 'pending') return state;

  // Sequential (legacy) tech sessions block the shared poll; concurrent card-7 does not.
  const tech = techResearchOf(state);
  if (tech.active && !tech.concurrent) return state;

  const started = resolution.startedAt;
  const secs = Number.isFinite(started) ? Math.max(0, Math.floor((at - started) / 1000)) : 0;
  let next = state;
  if (secs > 0) {
    next = patchPlayer(next, playerId, p => ({ totalTime: (p.totalTime || 0) + secs }));
  }

  const responses = { ...resolution.responses, [playerId]: choice };
  const resolvedAt = { ...(resolution.resolvedAt || {}), [playerId]: at };
  next = withRound(next, {
    strategyResolution: { ...resolution, responses, resolvedAt },
  });

  const allDone = Object.values(responses).every(s => s === 'played' || s === 'passed');
  if (allDone) next = commitStrategyPlay(next, at);
  return next;
}

function openDraft(state, at = Date.now()) {
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
    pickStartedAt: at,
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
    // Official snake for 3–4: second pass is counter-clockwise.
    const order = pick === 1 ? [...draftOrder].reverse() : draftOrder;
    order.forEach(player => queue.push(player.id));
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
    const order = pick === 1 ? [...draftOrder].reverse() : draftOrder;
    order.forEach((player) => {
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

function pickCard(state, cardId, at = Date.now()) {
  const playerId = currentDraftPlayerId(state);
  if (playerId == null || state.draft.assignments[cardId] != null) return state;

  let next = state;
  const started = state.draft.pickStartedAt;
  if (Number.isFinite(started)) {
    const secs = Math.max(0, Math.floor((at - started) / 1000));
    if (secs > 0) {
      next = patchPlayer(next, playerId, p => ({ totalTime: (p.totalTime || 0) + secs }));
    }
  }

  const nextIndex = next.draft.currentQueueIndex + 1;
  const finished = nextIndex >= next.draft.queue.length;

  return withDraft(next, {
    assignments: { ...next.draft.assignments, [cardId]: playerId },
    pickOrder: [...next.draft.pickOrder, cardId],
    currentQueueIndex: finished ? next.draft.currentQueueIndex : nextIndex,
    step: finished ? 'CONFIRM' : 'DRAFT',
    pickStartedAt: finished ? null : at,
  });
}

function undoPick(state, at = Date.now()) {
  if (state.draft.pickOrder.length === 0) return state;

  const pickOrder = state.draft.pickOrder.slice(0, -1);
  const assignments = { ...state.draft.assignments };
  delete assignments[state.draft.pickOrder[state.draft.pickOrder.length - 1]];

  return withDraft(state, {
    assignments,
    pickOrder,
    currentQueueIndex: pickOrder.length,
    step: 'DRAFT',
    pickStartedAt: at,
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

  const round = state.meta?.roundNumber || 1;
  const newPicks = Object.entries(state.draft.assignments).map(([cardId, playerId]) => ({
    round,
    playerId: Number(playerId),
    cardId: Number(cardId),
  })).filter((p) => Number.isFinite(p.playerId) && Number.isFinite(p.cardId));

  const nextPlayers = mapPlayers(state, player => {
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

  const prevHistory = Array.isArray(state.meta?.strategyPickHistory)
    ? state.meta.strategyPickHistory
    : [];

  return withMeta(
    withDraft(nextPlayers, { ...clearedDraft, strategyCardBonuses }),
    { strategyPickHistory: [...prevHistory, ...newPicks] },
  );
}

function confirmStatusPhase(state) {
  const next = withStatusPhase(state, {
    show: false,
    checks: { ...EMPTY_STATUS_CHECKS },
    scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 },
  });

  if (!next.meta.isPoliticsActive) return startNewRound(next);

  const oneVoteLaw = !!next.politics?.oneVoteLaw;
  return withPolitics(withMeta(next, { isAgendaPhasePending: true }), {
    showModal: true,
    step: oneVoteLaw ? 'VOTE' : 'SETUP',
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
    show: true,
    scoring: { ...scoring, active: false },
    checks: { ...state.statusPhase.checks, scoreObjectives: true },
  });
}

/** Remove a revealed objective from the board and its stage deck; reveal the next undrawn card if any. */
function discardObjectiveAndRevealNext(state, objectiveId) {
  const removed = state.objectives.active.find(o => o.id === objectiveId);
  if (!removed) return state;

  const stage = Number(removed.stage) === 2 ? 2 : 1;
  const deckKey = stage === 2 ? 'stage2Deck' : 'stage1Deck';
  const active = state.objectives.active.filter(o => o.id !== objectiveId);
  const deck = state.objectives[deckKey].filter(o => o.id !== objectiveId);

  const next = deck.find(o => !active.some(a => a.id === o.id));
  const newActive = next ? [...active, next] : active;

  const completions = { ...state.objectives.completions };
  for (const key of Object.keys(completions)) {
    if (key.endsWith(`_${objectiveId}`)) delete completions[key];
  }

  return withObjectives(state, {
    active: newActive,
    [deckKey]: deck,
    completions,
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

function imperialClaimOf(state) {
  return state.round?.imperialClaim || EMPTY_IMPERIAL_CLAIM;
}

function clearImperialClaim(state) {
  return withRound(state, { imperialClaim: { ...EMPTY_IMPERIAL_CLAIM } });
}

/** Draft picks live only in claim until confirm — nothing to undo on pass. */
function applyImperialClaim(state, claim) {
  let next = state;
  const playerId = claim.playerId;

  if (claim.publicId) {
    const key = `${playerId}_${claim.publicId}`;
    if (!next.objectives.completions[key]) {
      next = withObjectives(next, {
        completions: { ...next.objectives.completions, [key]: true },
      });
    }
  }

  if (claim.mecatol) {
    next = patchPlayer(next, playerId, p => ({
      extra: (p.extra || 0) + 1,
    }));
  }
  // claim.secret is only a reminder to draw a secret objective card — no VP.

  return next;
}

function selectImperialPublic(state, playerId, objectiveId) {
  const claim = imperialClaimOf(state);
  if (!claim.active || claim.playerId !== playerId) return state;
  if (!state.objectives.active.some(o => o.id === objectiveId)) return state;

  const key = `${playerId}_${objectiveId}`;
  if (state.objectives.completions[key]) return state;

  const publicId = claim.publicId === objectiveId ? null : objectiveId;
  return withRound(state, {
    imperialClaim: { ...claim, publicId },
  });
}

function toggleImperialMecatol(state, playerId) {
  const claim = imperialClaimOf(state);
  if (!claim.active || claim.playerId !== playerId) return state;

  if (claim.mecatol) {
    return withRound(state, {
      imperialClaim: { ...claim, mecatol: false },
    });
  }

  return withRound(state, {
    imperialClaim: { ...claim, mecatol: true, secret: false },
  });
}

function toggleImperialSecret(state, playerId) {
  const claim = imperialClaimOf(state);
  if (!claim.active || claim.playerId !== playerId) return state;
  if (claim.mecatol) return state;

  return withRound(state, {
    imperialClaim: { ...claim, secret: !claim.secret },
  });
}

function confirmImperialClaim(state, playerId, at = Date.now()) {
  const claim = imperialClaimOf(state);
  if (!claim.active || claim.playerId !== playerId) return state;
  const next = clearImperialClaim(applyImperialClaim(state, claim));
  return startStrategyResolution(next, 8, at);
}

function passImperialClaim(state, playerId, at = Date.now()) {
  const claim = imperialClaimOf(state);
  if (!claim.active || claim.playerId !== playerId) return state;
  return startStrategyResolution(clearImperialClaim(state), 8, at);
}

function techResearchOf(state) {
  return state.round?.techResearch || { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} };
}

function clearTechResearch(state) {
  return withRound(state, {
    techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
  });
}

function techModeForPlayer(state, session, playerId) {
  if (playerId === session.primaryPlayerId) return 'primary';
  // Brilliant: when resolving Technology secondary, Jol-Nar may use primary instead.
  const player = state.players.find(p => p.id === playerId);
  if (player?.factionId === 'jolnar') return 'primary';
  return 'secondary';
}

function techEntryForPlayer(session, playerId) {
  const entry = session.byPlayer?.[playerId] || session.byPlayer?.[String(playerId)];
  return {
    picks: Array.isArray(entry?.picks) ? entry.picks : [],
    ignorePrereq: entry?.ignorePrereq ? 1 : 0,
  };
}

/**
 * How many color prereqs to waive for this RESEARCH_TECH.
 * Planet/marker → 1. Cabal Riftmeld (return captured plastic) → all, unit upgrades only.
 */
function researchIgnoreCount(player, tech, opts, entry) {
  const raw = opts?.ignorePrereq;
  if (raw === 'all' || opts?.ignoreAll) {
    if (player?.factionId === 'vuilraith' && tech?.kind === 'unit') {
      return Math.max((tech.prereqs || []).length, 1);
    }
    return 0;
  }
  if (raw != null) {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
    return raw ? 1 : 0;
  }
  return entry?.ignorePrereq ? 1 : 0;
}

function resolutionStatus(resolution, playerId) {
  const responses = resolution?.responses || {};
  if (responses[playerId] != null) return responses[playerId];
  if (responses[String(playerId)] != null) return responses[String(playerId)];
  const n = Number(playerId);
  if (Number.isFinite(n) && responses[n] != null) return responses[n];
  return null;
}

function researchTech(state, playerId, techId, opts = {}, at = Date.now()) {
  const session = techResearchOf(state);
  if (!session.active || !session.concurrent) return state;

  const resolution = strategyResolutionOf(state);
  if (!resolution.active || resolution.cardId !== 7) return state;
  if (resolutionStatus(resolution, playerId) !== 'pending') return state;

  const mode = techModeForPlayer(state, session, playerId);
  const maxSlots = maxResearchSlots(mode);
  const entry = techEntryForPlayer(session, playerId);
  if (entry.picks.length >= maxSlots) return state;

  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  const tech = techById(techId);
  if (!tech) return state;

  const catalog = availableTechs({
    usePok: !!state.meta?.usePok,
    useTe: !!state.meta?.useTe,
    factionId: player.factionId,
  });
  if (!catalog.some(t => t.id === techId)) return state;

  const owned = player.techIds || [];
  const ignoreCount = researchIgnoreCount(player, tech, opts, entry);
  if (!opts.force && !canResearch(tech, owned, {
    ...researchSynergyOpts(player, state),
    ignoreCount,
  })) {
    return state;
  }

  let next = patchPlayer(state, playerId, p => ({
    techIds: [...(p.techIds || []), techId],
  }));
  const picks = [...entry.picks, techId];
  next = withRound(next, {
    techResearch: {
      ...session,
      byPlayer: {
        ...(session.byPlayer || {}),
        [playerId]: { picks, ignorePrereq: 0 },
      },
    },
  });

  if (picks.length >= maxSlots) {
    return resolveStrategyResponse(next, playerId, 'played', at);
  }
  return next;
}

function passTechResearch(state, playerId, at = Date.now()) {
  const session = techResearchOf(state);
  if (!session.active || !session.concurrent) return state;

  const resolution = strategyResolutionOf(state);
  if (!resolution.active || resolution.cardId !== 7) return state;
  if (resolutionStatus(resolution, playerId) !== 'pending') return state;
  const entry = techEntryForPlayer(session, playerId);
  const choice = entry.picks.length > 0 ? 'played' : 'passed';
  return resolveStrategyResponse(state, playerId, choice, at);
}

function setTechIgnorePrereq(state, playerId, enabled) {
  const session = techResearchOf(state);
  if (!session.active || !session.concurrent) return state;

  const resolution = strategyResolutionOf(state);
  if (!resolution.active || resolution.cardId !== 7) return state;
  if (resolutionStatus(resolution, playerId) !== 'pending') return state;
  const entry = techEntryForPlayer(session, playerId);
  return withRound(state, {
    techResearch: {
      ...session,
      byPlayer: {
        ...(session.byPlayer || {}),
        [playerId]: { ...entry, ignorePrereq: enabled ? 1 : 0 },
      },
    },
  });
}

/** Host / manual grant outside strategy 7 — no prereq check. */
function grantTech(state, playerId, techId) {
  if (!techById(techId)) return state;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if ((player.techIds || []).includes(techId)) return state;
  return patchPlayer(state, playerId, p => ({
    techIds: [...(p.techIds || []), techId],
  }));
}

function revokeTech(state, playerId, techId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if (!(player.techIds || []).includes(techId)) return state;
  return patchPlayer(state, playerId, p => ({
    techIds: (p.techIds || []).filter(id => id !== techId),
  }));
}

function toggleTech(state, playerId, techId) {
  if (!techById(techId)) return state;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if ((player.techIds || []).includes(techId)) {
    return revokeTech(state, playerId, techId);
  }
  return grantTech(state, playerId, techId);
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

function startingTechDraftOf(state) {
  return state.startingTechDraft || { ...EMPTY_STARTING_TECH_DRAFT, responses: {} };
}

function withStartingTechDraft(state, draft) {
  return { ...state, startingTechDraft: { ...startingTechDraftOf(state), ...draft } };
}

function applyStartingTechDraftIfComplete(state) {
  const draft = startingTechDraftOf(state);
  if (!draft.active) return state;
  const needers = playersNeedingStartingTechDraft(state.players);
  if (needers.length === 0) {
    return withStartingTechDraft(state, { ...EMPTY_STARTING_TECH_DRAFT, responses: {} });
  }
  const allConfirmed = needers.every(
    p => draft.responses?.[p.id]?.status === 'confirmed',
  );
  if (!allConfirmed) return state;

  return {
    ...state,
    players: state.players.map((p) => {
      const response = draft.responses?.[p.id];
      if (!response || response.status !== 'confirmed') return p;
      return { ...p, techIds: [...(response.picks || [])] };
    }),
    startingTechDraft: { ...EMPTY_STARTING_TECH_DRAFT, responses: {} },
  };
}

export function gameReducer(state, action) {
  if (
    state?.isGameActive
    && action?.type
    && isVictoryReached(state)
    && !isVictoryActionAllowed(action.type)
  ) {
    return state;
  }

  switch (action.type) {
    // --- Setup ---
    case 'SET_TARGET_SCORE':
      return withMeta(state, { targetScore: action.value });

    case 'SET_EXPANSION': {
      const isTe = action.expansion === 'te';
      const enabled = !!action.enabled;
      let usePok = state.meta.usePok;
      let useTe = state.meta.useTe;
      if (isTe) {
        useTe = enabled;
        // TE assumes PoK content; turning TE on forces PoK on.
        if (enabled) usePok = true;
      } else {
        // Cannot disable PoK while TE is active.
        if (!enabled && state.meta.useTe) {
          return state;
        }
        usePok = enabled;
      }
      const next = withMeta(state, { usePok, useTe });
      if (state.isGameActive) return next;
      return withObjectives(next, decksForExpansions({ usePok, useTe }));
    }

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
          eliminatedRound: null,
          breakthrough: false,
          techIds: [],
          startingTechIds: [],
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

    case 'UPDATE_PLAYER': {
      const patch = { ...action.patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'factionId')) {
        patch.startingTechIds = [];
      }
      // Legacy field — starting techs are chosen in startingTechDraft after start.
      if (Object.prototype.hasOwnProperty.call(patch, 'startingTechIds')) {
        delete patch.startingTechIds;
      }
      return patchPlayer(state, action.playerId, () => patch);
    }

    case 'START_GAME': {
      const needers = playersNeedingStartingTechDraft(state.players);
      const usePok = !!state.meta.usePok || !!state.meta.useTe;
      const useTe = !!state.meta.useTe;
      const next = {
        ...state,
        isGameActive: true,
        meta: { ...state.meta, usePok, useTe },
        objectives: {
          ...state.objectives,
          ...decksForExpansions({ usePok, useTe }),
        },
        vpTrack: {
          custodiansPlayerId: null,
          supportHolders: {},
        },
        expedition: {
          slices: emptyExpeditionSlices(),
          completed: false,
          controllerId: null,
          placedById: null,
          awaitingControlPick: false,
        },
        players: state.players.map(p => ({
          ...p,
          breakthrough: p.factionId === 'crimson',
          techIds: resolveStartingTechIds(p),
        })),
        startingTechDraft: needers.length > 0
          ? { needed: true, active: false, responses: {} }
          : { ...EMPTY_STARTING_TECH_DRAFT, responses: {} },
      };
      return withMeta(next, {
        speakerId: state.meta.speakerId ?? state.players[0]?.id ?? null,
      });
    }

    case 'START_STARTING_TECH_DRAFT': {
      if (!state.isGameActive) return state;
      const draft = startingTechDraftOf(state);
      if (!draft.needed || draft.active) return state;
      const needers = playersNeedingStartingTechDraft(state.players);
      if (needers.length === 0) {
        return withStartingTechDraft(state, { ...EMPTY_STARTING_TECH_DRAFT, responses: {} });
      }
      const responses = {};
      needers.forEach((p) => {
        responses[p.id] = { status: 'waiting', picks: [] };
      });
      return withStartingTechDraft(state, {
        needed: true,
        active: true,
        responses,
      });
    }

    case 'SET_STARTING_TECH_PICK': {
      const draft = startingTechDraftOf(state);
      if (!draft.active) return state;
      const player = state.players.find(p => p.id === action.playerId);
      if (!player || player.eliminated) return state;
      const choice = startingTechChoice(player.factionId);
      if (!choice) return state;
      const current = draft.responses?.[player.id];
      if (!current || current.status === 'confirmed') return state;
      if (choice.wave === 'C') {
        if (!isStartingTechWaveAReady(state)) return state;
      }
      const picks = sanitizeStartingTechPicks(
        player.factionId,
        action.picks,
        state,
        { playerId: player.id },
      );
      const responses = {
        ...draft.responses,
        [player.id]: {
          status: picks.length > 0 ? 'picking' : 'waiting',
          picks,
        },
      };
      return withStartingTechDraft(state, { responses });
    }

    case 'CONFIRM_STARTING_TECH': {
      const draft = startingTechDraftOf(state);
      if (!draft.active) return state;
      const player = state.players.find(p => p.id === action.playerId);
      if (!player || player.eliminated) return state;
      if (!canConfirmStartingTech(player, state)) return state;
      const response = draft.responses?.[player.id];
      const picks = sanitizeStartingTechPicks(
        player.factionId,
        response?.picks,
        state,
        { playerId: player.id },
      );
      const next = withStartingTechDraft(state, {
        responses: {
          ...draft.responses,
          [player.id]: { status: 'confirmed', picks },
        },
      });
      return applyStartingTechDraftIfComplete(next);
    }

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

    case 'SET_CUSTODIANS': {
      if (!state.isGameActive) return state;
      const playerId = action.playerId == null ? null : Number(action.playerId);
      if (playerId != null && !state.players.some(p => p.id === playerId && !p.eliminated)) {
        return state;
      }
      const current = state.vpTrack?.custodiansPlayerId ?? null;
      // Toggle off when claiming the same seat again.
      const nextId = (playerId != null && current === playerId && action.force !== true)
        ? null
        : playerId;
      return {
        ...state,
        vpTrack: {
          ...(state.vpTrack || { supportHolders: {} }),
          custodiansPlayerId: nextId,
          supportHolders: { ...(state.vpTrack?.supportHolders || {}) },
        },
      };
    }

    case 'SET_SUPPORT': {
      if (!state.isGameActive) return state;
      const fromPlayerId = Number(action.fromPlayerId);
      const holderPlayerId = action.holderPlayerId == null
        ? null
        : Number(action.holderPlayerId);
      if (!Number.isFinite(fromPlayerId)) return state;
      if (!state.players.some(p => p.id === fromPlayerId)) return state;
      if (holderPlayerId != null) {
        if (!Number.isFinite(holderPlayerId)) return state;
        if (holderPlayerId === fromPlayerId) return state;
        if (!state.players.some(p => p.id === holderPlayerId && !p.eliminated)) return state;
      }
      const supportHolders = { ...(state.vpTrack?.supportHolders || {}) };
      if (holderPlayerId == null) delete supportHolders[fromPlayerId];
      else supportHolders[fromPlayerId] = holderPlayerId;
      return {
        ...state,
        vpTrack: {
          custodiansPlayerId: state.vpTrack?.custodiansPlayerId ?? null,
          supportHolders,
        },
      };
    }

    case 'SET_INFLUENCE': {
      const patch = {
        influence: Math.max(0, Number(action.influence) || 0),
      };
      if (action.planets != null) {
        patch.votePlanets = Math.max(0, Number(action.planets) || 0);
      }
      return patchPlayer(state, action.playerId, () => patch);
    }

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

    case 'DISCARD_OBJECTIVE':
      return discardObjectiveAndRevealNext(state, action.objectiveId);

    // --- Draft ---
    case 'OPEN_DRAFT':
      return openDraft(state, actionAt(action));

    case 'SET_DRAFT_VISIBLE':
      return withDraft(state, { showModal: !!action.visible });

    case 'PICK_CARD':
      return pickCard(state, action.cardId, actionAt(action));

    case 'UNDO_PICK':
      return undoPick(state, actionAt(action));

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
      return beginStrategyPlay(state, action.cardId, actionAt(action));

    case 'RESOLVE_STRATEGY':
      return resolveStrategyResponse(state, action.playerId, action.choice, actionAt(action));

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
      if (state.statusPhase?.show || state.statusPhase?.scoring?.active) return state;
      if (playersNotPassed(state).length > 0) return state;
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

    case 'SELECT_IMPERIAL_PUBLIC':
      return selectImperialPublic(state, action.playerId, action.objectiveId);

    case 'TOGGLE_IMPERIAL_MECATOL':
      return toggleImperialMecatol(state, action.playerId);

    case 'TOGGLE_IMPERIAL_SECRET':
      return toggleImperialSecret(state, action.playerId);

    case 'CONFIRM_IMPERIAL_CLAIM':
      return confirmImperialClaim(state, action.playerId, actionAt(action));

    case 'PASS_IMPERIAL_CLAIM':
      return passImperialClaim(state, action.playerId, actionAt(action));

    case 'RESEARCH_TECH':
      return researchTech(state, action.playerId, action.techId, {
        force: !!action.force,
        ignorePrereq: action.ignorePrereq,
      }, actionAt(action));

    case 'PASS_TECH_RESEARCH':
      return passTechResearch(state, action.playerId, actionAt(action));

    case 'SET_TECH_IGNORE_PREREQ':
      return setTechIgnorePrereq(state, action.playerId, !!action.enabled);

    case 'GRANT_TECH':
      return grantTech(state, action.playerId, action.techId);

    case 'REVOKE_TECH':
      return revokeTech(state, action.playerId, action.techId);

    case 'GRANT_BREAKTHROUGH':
      return patchPlayer(state, action.playerId, () => ({ breakthrough: true }));

    case 'REVOKE_BREAKTHROUGH':
      return patchPlayer(state, action.playerId, () => ({ breakthrough: false }));

    case 'TOGGLE_TECH':
      return toggleTech(state, action.playerId, action.techId);

    case 'CLAIM_EXPEDITION_SLICE':
      return claimExpeditionSlice(state, action.playerId, action.sliceId);

    case 'SET_EXPEDITION_SLICE':
      return setExpeditionSlice(state, action.sliceId, action.playerId);

    case 'RESOLVE_THUNDERS_EDGE_CONTROL':
      return resolveThundersEdgeControl(state, action.playerId, action.controllerId);

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
      const vote = coerceAgendaVote(state, action.vote);
      return mapCurrentAgenda(state, a => ({
        ...a,
        votes: { ...a.votes, [action.playerId]: vote },
      }));
    }

    case 'LOCK_VOTE': {
      const agenda = currentAgenda(state);
      if (!agenda || agenda.locked?.[action.playerId]) return state;
      const prev = agenda.votes?.[action.playerId] || { choice: 'abstain', amount: 0 };
      const vote = coerceAgendaVote(state, prev);
      return mapCurrentAgenda(state, a => ({
        ...a,
        votes: { ...a.votes, [action.playerId]: vote },
        locked: { ...a.locked, [action.playerId]: true },
      }));
    }

    case 'TOGGLE_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !state.politics.voteReversed });

    case 'SET_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !!action.reversed });

    case 'TOGGLE_ONE_VOTE_LAW': {
      const enabled = !state.politics?.oneVoteLaw;
      const patch = { oneVoteLaw: enabled };
      // Enabling skips influence entry; disabling returns to SETUP if still in agenda.
      if (enabled && state.politics?.showModal && state.politics.step === 'SETUP') {
        patch.step = 'VOTE';
      }
      if (!enabled && state.politics?.showModal && state.politics.step === 'VOTE') {
        patch.step = 'SETUP';
      }
      return withPolitics(state, patch);
    }

    case 'SET_ONE_VOTE_LAW': {
      const enabled = !!action.enabled;
      const patch = { oneVoteLaw: enabled };
      if (enabled && state.politics?.showModal && state.politics.step === 'SETUP') {
        patch.step = 'VOTE';
      }
      if (!enabled && state.politics?.showModal && state.politics.step === 'VOTE') {
        patch.step = 'SETUP';
      }
      return withPolitics(state, patch);
    }

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
      // Preserve active/lobby flag from the snapshot (do not force a started game).
      return normalizeGameState(action.state);

    case 'RESET_GAME':
      return createEmptyGameState();

    default:
      return state;
  }
}
