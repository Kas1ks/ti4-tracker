import {
  activePlayer,
  areAllStrategiesPlayed,
  currentDraftPlayerId,
  currentVoterId,
  isStrategyCardPlayed,
} from '../game/selectors.js';

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
      if (state.round.strategyActionTaken
        || state.round?.strategyResolution?.active
        || state.round?.imperialClaim?.active) {
        return { ok: false, error: 'already-played-strategy' };
      }
      return { ok: true };
    }

    case 'RESOLVE_STRATEGY': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-resolve' };
      if (!state.round?.strategyResolution?.active) {
        return { ok: false, error: 'resolution-closed' };
      }
      const status = state.round.strategyResolution.responses?.[seatPlayerId];
      if (status == null || status !== 'pending') {
        return { ok: false, error: 'already-resolved' };
      }
      if (action.choice !== 'played' && action.choice !== 'passed') {
        return { ok: false, error: 'invalid-choice' };
      }
      return { ok: true };
    }

    case 'SET_SPEAKER': {
      // Agenda handoff: current speaker may assign the next speaker.
      if (state.politics?.showModal && state.meta.speakerId === seatPlayerId) {
        return { ok: true };
      }
      // Politics strategy card: active seat may pick a new speaker before playing it.
      const ap = activePlayer(state);
      if (ap?.id === seatPlayerId
        && !state.round?.strategyActionTaken
        && !state.round?.strategyResolution?.active
        && (ap.cards || []).some(c => c.id === 3)
        && !isStrategyCardPlayed(ap, 3)) {
        return { ok: true };
      }
      return { ok: false, error: 'forbidden' };
    }

    case 'FINISH_AGENDA_PHASE': {
      if (state.politics?.showModal && state.meta.speakerId === seatPlayerId) {
        return { ok: true };
      }
      return { ok: false, error: 'forbidden' };
    }

    case 'PASS_TURN': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-turn' };
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round?.strategyResolution?.active) {
        return { ok: false, error: 'strategy-resolving' };
      }
      if (state.round?.imperialClaim?.active) {
        return { ok: false, error: 'imperial-claim' };
      }
      const seat = state.players.find(p => p.id === seatPlayerId);
      if (!areAllStrategiesPlayed(seat)) {
        return { ok: false, error: 'strategy-required' };
      }
      return { ok: true };
    }

    case 'NEXT_TURN': {
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round?.strategyResolution?.active) {
        return { ok: false, error: 'strategy-resolving' };
      }
      if (state.round?.imperialClaim?.active) {
        return { ok: false, error: 'imperial-claim' };
      }
      return { ok: true };
    }

    case 'TOGGLE_COMPLETION': {
      // Players score only through the status-phase scoring window.
      return { ok: false, error: 'use-scoring-window' };
    }

    case 'SELECT_SCORING_PUBLIC':
    case 'TOGGLE_SCORING_SECRET':
    case 'CONFIRM_OBJECTIVE_SCORING':
    case 'PASS_OBJECTIVE_SCORING': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-objective' };
      if (!state.statusPhase?.scoring?.active) return { ok: false, error: 'scoring-closed' };
      const scoring = state.statusPhase.scoring;
      const currentId = scoring.orderIds?.[scoring.currentIdx];
      if (currentId !== seatPlayerId) return { ok: false, error: 'not-your-scoring-turn' };
      const response = scoring.responses?.[seatPlayerId];
      if (!response || response.status !== 'pending') return { ok: false, error: 'scoring-locked' };
      return { ok: true };
    }

    case 'SELECT_IMPERIAL_PUBLIC':
    case 'TOGGLE_IMPERIAL_MECATOL':
    case 'TOGGLE_IMPERIAL_SECRET':
    case 'CONFIRM_IMPERIAL_CLAIM':
    case 'PASS_IMPERIAL_CLAIM': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-imperial' };
      const claim = state.round?.imperialClaim;
      if (!claim?.active) return { ok: false, error: 'imperial-closed' };
      if (claim.playerId !== seatPlayerId) return { ok: false, error: 'not-your-imperial' };
      return { ok: true };
    }

    case 'RESEARCH_TECH':
    case 'PASS_TECH_RESEARCH':
    case 'SET_TECH_IGNORE_PREREQ': {
      if (String(action.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-tech' };
      }
      if (action.type === 'RESEARCH_TECH' && action.force) {
        return { ok: false, error: 'forbidden' };
      }
      const session = state.round?.techResearch;
      if (!session?.active) return { ok: false, error: 'tech-closed' };
      if (session.concurrent) {
        const resolution = state.round?.strategyResolution;
        if (!resolution?.active || resolution.cardId !== 7) {
          return { ok: false, error: 'tech-closed' };
        }
        const status = resolution.responses?.[seatPlayerId]
          ?? resolution.responses?.[action.playerId];
        if (status !== 'pending') return { ok: false, error: 'tech-closed' };
        return { ok: true };
      }
      if (String(session.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-tech' };
      }
      return { ok: true };
    }

    case 'TOGGLE_TECH': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-tech' };
      return { ok: true };
    }

    case 'GRANT_TECH':
    case 'REVOKE_TECH':
      return { ok: false, error: 'forbidden' };

    case 'CLAIM_EXPEDITION_SLICE': {
      if (!state.meta?.useTe || !state.isGameActive) {
        return { ok: false, error: 'expedition-closed' };
      }
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-expedition' };
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round?.expeditionClaimedThisTurn) {
        return { ok: false, error: 'expedition-already-claimed' };
      }
      if (state.expedition?.completed || state.expedition?.awaitingControlPick) {
        return { ok: false, error: 'expedition-locked' };
      }
      return { ok: true };
    }

    case 'RESOLVE_THUNDERS_EDGE_CONTROL': {
      if (!state.meta?.useTe || !state.isGameActive) {
        return { ok: false, error: 'expedition-closed' };
      }
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-expedition' };
      if (!state.expedition?.awaitingControlPick) {
        return { ok: false, error: 'control-pick-closed' };
      }
      if (state.expedition?.placedById !== seatPlayerId) {
        return { ok: false, error: 'not-placer' };
      }
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

    case 'SET_STARTING_TECH_PICK':
    case 'CONFIRM_STARTING_TECH': {
      if (String(action.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-starting-tech' };
      }
      const draft = state.startingTechDraft;
      if (!draft?.active) return { ok: false, error: 'starting-tech-closed' };
      const response = draft.responses?.[seatPlayerId];
      if (!response) return { ok: false, error: 'not-in-draft' };
      if (response.status === 'confirmed') {
        return { ok: false, error: 'already-confirmed' };
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
