import { activePlayer, currentDraftPlayerId, currentVoterId } from '../game/selectors.js';

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  PLAYER: 'player',
  VIEWER: 'viewer',
});

/** Labels for the setup / header UI. */
export const ROLE_LABELS = Object.freeze({
  admin: 'Админ',
  player: 'Игрок',
  viewer: 'Зритель',
});

function lastPickOwner(state) {
  const lastCardId = state.draft.pickOrder[state.draft.pickOrder.length - 1];
  if (lastCardId == null) return null;
  return state.draft.assignments[lastCardId] ?? null;
}

/**
 * Server-side authorization for a room action.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function authorizeAction({ role, seatPlayerId, action, state }) {
  if (!action || typeof action.type !== 'string') {
    return { ok: false, error: 'invalid-action' };
  }

  if (role === ROLES.ADMIN) return { ok: true };
  if (role === ROLES.VIEWER) return { ok: false, error: 'forbidden' };
  if (role !== ROLES.PLAYER) return { ok: false, error: 'invalid-role' };

  if (seatPlayerId == null) {
    return { ok: false, error: 'seat-required' };
  }

  switch (action.type) {
    case 'PICK_CARD': {
      const current = currentDraftPlayerId(state);
      if (current !== seatPlayerId) return { ok: false, error: 'not-your-pick' };
      return { ok: true };
    }

    case 'UNDO_PICK': {
      const owner = lastPickOwner(state);
      if (owner == null) return { ok: false, error: 'nothing-to-undo' };
      if (owner !== seatPlayerId) return { ok: false, error: 'not-your-pick' };
      return { ok: true };
    }

    case 'PLAY_STRATEGY': {
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round.strategyActionTaken) {
        return { ok: false, error: 'already-played-strategy' };
      }
      return { ok: true };
    }

    case 'SET_SPEAKER': {
      if (activePlayer(state)?.id === seatPlayerId) return { ok: true };
      if (state.politics?.showModal && state.meta.speakerId === seatPlayerId) {
        return { ok: true };
      }
      return { ok: false, error: 'not-your-turn' };
    }

    case 'FINISH_AGENDA_PHASE': {
      if (state.politics?.showModal && state.meta.speakerId === seatPlayerId) {
        return { ok: true };
      }
      return { ok: false, error: 'forbidden' };
    }

    case 'PASS_TURN': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-turn' };
      return { ok: true };
    }

    case 'NEXT_TURN': {
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      return { ok: true };
    }

    case 'TOGGLE_COMPLETION': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-objective' };
      return { ok: true };
    }

    case 'SET_INFLUENCE':
    case 'LOCK_INFLUENCE': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-influence' };
      if (state.politics.influenceLocked?.[seatPlayerId] && action.type === 'SET_INFLUENCE') {
        return { ok: false, error: 'influence-locked' };
      }
      return { ok: true };
    }

    case 'SET_VOTE':
    case 'LOCK_VOTE': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-vote' };
      if (currentVoterId(state) !== seatPlayerId) {
        return { ok: false, error: 'not-your-vote-turn' };
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'forbidden' };
  }
}

/** UI capability checks (client). Solo mode should pass role=admin. */
export function can(role, capability) {
  if (!role || role === ROLES.ADMIN) {
    return true;
  }
  if (role === ROLES.VIEWER) return false;

  switch (capability) {
    case 'setup':
    case 'phases':
    case 'draftAdmin':
    case 'confirmDraft':
    case 'reassignCard':
    case 'politics':
    case 'politicsAdmin':
    case 'statusPhase':
    case 'combat':
    case 'eliminate':
    case 'scoreAny':
    case 'secrets':
    case 'mecatol':
    case 'objectivesAdmin':
    case 'endGame':
    case 'export':
      return false;
    case 'draftPick':
    case 'playTurn':
    case 'nextTurn':
    case 'scoreSelf':
    case 'politicsSelf':
      return true;
    default:
      return false;
  }
}

export function makeSessionToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
