import {
  EMPTY_STATUS_CHECKS,
  EMPTY_OBJECTIVE_SCORING,
} from '../gameState';
import {
  patchPlayer,
  withMeta,
  withObjectives,
  withPolitics,
  withStatusPhase,
} from '../stateHelpers';
import { activePlayers } from '../selectors';
import { startNewRound } from './roundLifecycle';
import { emptyAgenda } from './politicsPhase';

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

const STATUS_ACTIONS = new Set([
  'TOGGLE_STATUS_CHECK',
  'START_OBJECTIVE_SCORING',
  'SELECT_SCORING_PUBLIC',
  'TOGGLE_SCORING_SECRET',
  'CONFIRM_OBJECTIVE_SCORING',
  'PASS_OBJECTIVE_SCORING',
  'SET_STATUS_PHASE_VISIBLE',
  'CONFIRM_STATUS_PHASE',
]);

export function reduceStatusPhase(state, action) {
  if (!STATUS_ACTIONS.has(action.type)) return null;

  switch (action.type) {
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

    default:
      return null;
  }
}
