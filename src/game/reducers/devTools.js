import { STRATEGY_CARDS } from '../../data/gameData';
import {
  canStartRound,
  isDraftInProgress,
  turnOrder,
} from '../selectors';
import { withRound } from '../stateHelpers';
import { reduceDraftPhase } from './draftPhase';
import { reduceStatusPhase } from './statusPhase';

const DEV_ACTIONS = new Set([
  'DEV_SKIP_STRATEGY_DRAFT',
  'DEV_PASS_ALL',
  'DEV_SKIP_STATUS_PHASE',
]);

/**
 * Auto-pick remaining strategy cards in ascending id order along the draft
 * queue, confirm, then start the action phase via `startRound`.
 */
function skipStrategyDraft(state, at, startRound) {
  if (state.round?.active) return state;

  let next = state;
  if (!isDraftInProgress(next) && !canStartRound(next)) {
    const opened = reduceDraftPhase(next, { type: 'OPEN_DRAFT', at });
    if (opened == null || opened === next) return state;
    next = opened;
  }

  if (isDraftInProgress(next) && next.draft.step === 'DRAFT') {
    const taken = new Set(
      Object.keys(next.draft.assignments || {}).map(Number).filter(Number.isFinite),
    );
    const available = STRATEGY_CARDS
      .map((card) => card.id)
      .filter((id) => !taken.has(id));

    for (const cardId of available) {
      if (next.draft?.step !== 'DRAFT') break;
      const picked = reduceDraftPhase(next, { type: 'PICK_CARD', cardId, at });
      if (picked == null || picked === next) break;
      next = picked;
    }
  }

  if (next.draft?.step === 'CONFIRM') {
    const confirmed = reduceDraftPhase(next, { type: 'CONFIRM_DRAFT', at });
    if (confirmed != null) next = confirmed;
  }

  if (canStartRound(next) && !next.round?.active) {
    return startRound(next, at);
  }

  return next === state ? state : next;
}

/**
 * Mark every seat in turn order as passed and end the action phase
 * (same outcome as the last legal PASS_TURN).
 */
function passAll(state, at, endRound, isBlocked) {
  if (!state.round?.active) return state;
  if (state.statusPhase?.show || state.statusPhase?.scoring?.active) return state;
  if (isBlocked(state)) return state;

  const passed = {};
  turnOrder(state).forEach((player) => {
    passed[player.id] = true;
  });
  return endRound(withRound(state, { passed }), at);
}

/** Close the status checklist (and any mid-flight scoring) as if the host confirmed. */
function skipStatusPhase(state) {
  if (!state.statusPhase?.show && !state.statusPhase?.scoring?.active) return state;
  return reduceStatusPhase(state, { type: 'CONFIRM_STATUS_PHASE' }) ?? state;
}

/**
 * @param {object} helpers
 * @param {(state: object, at?: number) => object} helpers.startRound
 * @param {(state: object, at?: number) => object} helpers.endRound
 * @param {(state: object) => boolean} helpers.isPassBlocked
 */
export function reduceDevTools(state, action, helpers) {
  if (!DEV_ACTIONS.has(action?.type)) return null;

  const at = Number.isFinite(action?.at) ? action.at : Date.now();
  const { startRound, endRound, isPassBlocked } = helpers;

  switch (action.type) {
    case 'DEV_SKIP_STRATEGY_DRAFT':
      return skipStrategyDraft(state, at, startRound);

    case 'DEV_PASS_ALL':
      return passAll(state, at, endRound, isPassBlocked);

    case 'DEV_SKIP_STATUS_PHASE':
      return skipStatusPhase(state);

    default:
      return null;
  }
}
