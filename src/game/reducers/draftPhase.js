import { STRATEGY_CARDS } from '../../data/gameData';
import { mapPlayers, patchPlayer, withDraft, withMeta } from '../stateHelpers';
import {
  activePlayers,
  canStartRound,
  currentDraftPlayerId,
  isDraftInProgress,
} from '../selectors';

export const clearedDraft = {
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

const DRAFT_ACTIONS = new Set([
  'OPEN_DRAFT',
  'SET_DRAFT_VISIBLE',
  'PICK_CARD',
  'UNDO_PICK',
  'REASSIGN_CARD',
  'CONFIRM_DRAFT',
  'SET_SPEAKER',
]);

export function reduceDraftPhase(state, action) {
  if (!DRAFT_ACTIONS.has(action.type)) return null;

  switch (action.type) {
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

    case 'SET_SPEAKER':
      return setSpeaker(state, action.playerId);

    default:
      return null;
  }
}
