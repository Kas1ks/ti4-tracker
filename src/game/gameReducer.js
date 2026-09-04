import { STRATEGY_CARDS } from '../data/gameData';
import {
  EMPTY_STATUS_CHECKS,
  createEmptyGameState,
  normalizeGameState,
} from './gameState';
import {
  activePlayer,
  activePlayers,
  canStartRound,
  currentAgenda,
  currentDraftPlayerId,
  isDraftInProgress,
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
  next = withRound(next, { turnTime: 0, turnStartedAt: null });
  if (next.meta.isAgendaPhasePending) {
    return withPolitics(next, { showModal: true });
  }
  return withStatusPhase(next, { show: true });
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
  });
}

/** Advance to the next player who has not passed; end the round if nobody is left. */
function nextTurn(state, at = Date.now()) {
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
  });
}

function passTurn(state, playerId, at = Date.now()) {
  const passed = { ...state.round.passed, [playerId]: true };
  const next = withRound(state, { passed });
  return playersNotPassed(next).length === 0 ? endRound(next, at) : nextTurn(next, at);
}

function eliminatePlayer(state, playerId, at = Date.now()) {
  if (!state.players.some(p => p.id === playerId)) return state;

  let next = patchPlayer(state, playerId, () => ({ eliminated: true }));
  next = withRound(next, { passed: { ...next.round.passed, [playerId]: true } });

  if (next.meta.speakerId === playerId) {
    next = withMeta(next, { speakerId: nextSpeakerAfter(next, playerId) });
  }

  const wasActive = activePlayer(state)?.id === playerId;
  if (next.round.active && playersNotPassed(next).length === 0) return endRound(next, at);
  return wasActive ? nextTurn(next, at) : next;
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

  const draftOrder = [...eligible.slice(speakerIndex), ...eligible.slice(0, speakerIndex)];
  const cardsPerPlayer = state.players.length <= 4 ? 2 : 1;

  const queue = [];
  for (let pick = 0; pick < cardsPerPlayer; pick += 1) {
    draftOrder.forEach(player => queue.push(player.id));
  }

  return withDraft(withMeta(state, { speakerId }), {
    queue,
    assignments: {},
    currentQueueIndex: 0,
    pickOrder: [],
    step: 'DRAFT',
    showModal: true,
  });
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
  const next = withStatusPhase(state, { show: false, checks: { ...EMPTY_STATUS_CHECKS } });

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

    case 'REMOVE_PLAYER':
      return { ...state, players: state.players.filter(p => p.id !== action.playerId) };

    case 'UPDATE_PLAYER':
      return patchPlayer(state, action.playerId, () => action.patch);

    case 'START_GAME':
      return withMeta({ ...state, isGameActive: true }, {
        speakerId: state.meta.speakerId ?? state.players[0]?.id ?? null,
      });

    case 'SET_SPEAKER':
      return withMeta(state, { speakerId: action.playerId });

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

    case 'PLAY_STRATEGY': {
      const player = activePlayer(state);
      if (!player?.cards?.length) return state;
      // One strategic action per turn (second card waits for the next turn).
      if (state.round.strategyActionTaken) return state;

      const already = new Set(
        Array.isArray(player.playedCardIds) ? player.playedCardIds : [],
      );
      if (player.strategyPlayed && already.size === 0) return state;

      let cardId = action.cardId;
      if (cardId == null) {
        const nextCard = [...player.cards]
          .filter(c => !already.has(c.id))
          .sort((a, b) => a.id - b.id)[0];
        cardId = nextCard?.id;
      }
      if (cardId == null || already.has(cardId)) return state;
      if (!player.cards.some(c => c.id === cardId)) return state;

      const playedCardIds = [...already, cardId];
      const strategyPlayed = player.cards.every(c => playedCardIds.includes(c.id));
      return withRound(
        patchPlayer(state, player.id, () => ({ playedCardIds, strategyPlayed })),
        { strategyActionTaken: true },
      );
    }

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
    case 'TOGGLE_STATUS_CHECK':
      return withStatusPhase(state, {
        checks: { ...state.statusPhase.checks, [action.key]: !state.statusPhase.checks[action.key] },
      });

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
