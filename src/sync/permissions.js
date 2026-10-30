import {
  activePlayer,
  areAllStrategiesPlayed,
  canMarkStrategyPlayed,
  currentDraftPlayerId,
  currentVoterId,
  isStrategyCardPlayed,
} from '../game/selectors.js';
import { isVictoryActionAllowed, isVictoryReached } from '../game/victory.js';
import { NEUTRAL_OPPONENT_ID } from '../data/neutralUnits.js';
import { secretObjectiveById } from '../data/secretObjectives.js';
import { secretCapOf } from '../game/secretDeck.js';

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

  // Victory lock: only host VP edits / panel closes / undo; no new processes.
  if (state?.isGameActive && isVictoryReached(state)) {
    if (role === ROLES.ADMIN && isVictoryActionAllowed(action.type)) {
      return { ok: true };
    }
    return { ok: false, error: 'victory-locked' };
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
      const res = state.round.strategyResolution;
      const status = res.responses?.[seatPlayerId];
      // Primary waits until agenda peek is committed; secondaries may answer during peek.
      if (status === 'peeking'
        || (res.phase === 'peek' && String(res.playerId) === String(seatPlayerId))) {
        return { ok: false, error: 'politics-peek-pending' };
      }
      if (status == null || status !== 'pending') {
        return { ok: false, error: 'already-resolved' };
      }
      if (action.choice !== 'played' && action.choice !== 'passed') {
        return { ok: false, error: 'invalid-choice' };
      }
      // Imperial (8): Сыграно only clockwise after speaker; Пас anytime.
      if (action.choice === 'played' && !canMarkStrategyPlayed(state, seatPlayerId)) {
        return { ok: false, error: 'imperial-play-order' };
      }
      return { ok: true };
    }

    case 'COMMIT_POLITICS_PEEK': {
      const res = state.round?.strategyResolution;
      if (!res?.active || res.cardId !== 3 || res.phase !== 'peek') {
        return { ok: false, error: 'politics-peek-closed' };
      }
      if (String(res.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-politics-peek' };
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

    case 'REVEAL_AGENDA':
    case 'REVEAL_COVERT_AGENDA':
    case 'SELECT_MISCOUNT_LAW':
    case 'SET_SPEAKER_AGENDA_DECISION': {
      // Speaker flips agendas / picks Miscount law / breaks ties.
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

    case 'SCORE_SECRET': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-objective' };
      // Status scoring window (existing flow).
      if (state.statusPhase?.scoring?.active) {
        const scoring = state.statusPhase.scoring;
        const currentId = scoring.orderIds?.[scoring.currentIdx];
        if (currentId !== seatPlayerId) return { ok: false, error: 'not-your-scoring-turn' };
        const response = scoring.responses?.[seatPlayerId];
        if (!response || response.status !== 'pending') return { ok: false, error: 'scoring-locked' };
        return { ok: true };
      }
      // Mid-phase: action secrets in action phase, agenda secrets in politics.
      const player = (state.players || []).find((p) => p.id === seatPlayerId);
      if (!player || player.eliminated) return { ok: false, error: 'not-your-seat' };
      const hand = Array.isArray(player.secretHand) ? player.secretHand : [];
      if (!hand.includes(action.cardId)) return { ok: false, error: 'secret-not-in-hand' };
      if ((player.secrets || 0) >= secretCapOf(player)) {
        return { ok: false, error: 'secret-cap' };
      }
      const card = secretObjectiveById.get(action.cardId);
      if (!card) return { ok: false, error: 'unknown-secret' };
      const politics = !!state.meta?.isPoliticsActive;
      const inAction = !!state.round?.active && !politics && !state.statusPhase?.show;
      if (card.phase === 'action' && inAction) return { ok: true };
      if (card.phase === 'agenda' && politics) return { ok: true };
      return { ok: false, error: 'wrong-secret-phase' };
    }

    case 'SELECT_SCORING_PUBLIC':
    case 'TOGGLE_SCORING_SECRET':
    case 'UNSCORE_SECRET':
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
    case 'GRANT_BREAKTHROUGH':
    case 'REVOKE_BREAKTHROUGH':
    case 'SET_EXPEDITION_SLICE':
      return { ok: false, error: 'forbidden' };

    case 'CLAIM_EXPEDITION_SLICE': {
      if (!state.meta?.useTe || !state.isGameActive) {
        return { ok: false, error: 'expedition-closed' };
      }
      if (String(action.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-expedition' };
      }
      if (String(activePlayer(state)?.id) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round?.expeditionClaimedThisTurn) {
        return { ok: false, error: 'expedition-already-claimed' };
      }
      if (state.expedition?.completed || state.expedition?.awaitingControlPick) {
        return { ok: false, error: 'expedition-locked' };
      }
      if (action.sliceId === 'secret') {
        const seat = state.players?.find((p) => String(p.id) === String(seatPlayerId));
        const hand = Array.isArray(seat?.secretHand) ? seat.secretHand : [];
        if (!hand.length) return { ok: false, error: 'no-secret-in-hand' };
        if (action.cardId != null && !hand.some((id) => String(id) === String(action.cardId))) {
          return { ok: false, error: 'secret-not-in-hand' };
        }
        if (hand.length > 1 && action.cardId == null) {
          return { ok: false, error: 'secret-card-required' };
        }
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

    case 'KEEP_SECRET_DRAFT':
    case 'DRAW_SECRET':
    case 'DISCARD_SECRET':
    case 'DISMISS_SECRET_REVEAL':
    case 'EXCHANGE_SECRET': {
      if (action.playerId !== seatPlayerId) return { ok: false, error: 'not-your-seat' };
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

    case 'UPDATE_PLAYER': {
      // Seated players may pick their own plastic color before the game starts.
      if (String(action.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-seat' };
      }
      if (state?.isGameActive) {
        return { ok: false, error: 'game-active' };
      }
      const patch = action.patch && typeof action.patch === 'object' ? action.patch : {};
      const keys = Object.keys(patch);
      if (keys.length !== 1 || keys[0] !== 'color') {
        return { ok: false, error: 'forbidden' };
      }
      const color = patch.color;
      if (color != null && color !== '') {
        const taken = (state?.players || []).some(
          (p) => String(p.id) !== String(seatPlayerId) && p.color === color,
        );
        if (taken) return { ok: false, error: 'color-taken' };
      }
      return { ok: true };
    }

    case 'START_COMBAT': {
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (state.round?.combat?.active) return { ok: false, error: 'combat-active' };
      if (state.round?.strategyResolution?.active) {
        return { ok: false, error: 'strategy-resolving' };
      }
      if (state.round?.imperialClaim?.active) {
        return { ok: false, error: 'imperial-claim' };
      }
      if (action.mode === 'neutral') return { ok: true };
      if (action.defenderId == null) return { ok: false, error: 'opponent-required' };
      if (String(action.defenderId) === String(seatPlayerId)) {
        return { ok: false, error: 'invalid-opponent' };
      }
      return { ok: true };
    }

    case 'COMBAT_SET_OPPONENT': {
      const combat = state.round?.combat;
      if (!combat?.active) return { ok: false, error: 'no-combat' };
      if (activePlayer(state)?.id !== seatPlayerId) {
        return { ok: false, error: 'not-your-turn' };
      }
      if (action.neutral) return { ok: true };
      if (action.defenderId == null) return { ok: false, error: 'opponent-required' };
      return { ok: true };
    }

    case 'COMBAT_SET_NEUTRAL_COUNTS':
    case 'COMBAT_BEGIN_NEUTRAL': {
      const combat = state.round?.combat;
      if (!combat?.active || combat.mode !== 'neutral') return { ok: false, error: 'no-combat' };
      // Reveal casualty edits are host-only (admin bypasses above).
      if (action.type === 'COMBAT_SET_NEUTRAL_COUNTS' && combat.phase === 'reveal') {
        return { ok: false, error: 'host-only' };
      }
      if (String(combat.attackerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-in-combat' };
      }
      if (action.type === 'COMBAT_SET_NEUTRAL_COUNTS') {
        if (combat.phase !== 'setup' && combat.phase !== 'input') {
          return { ok: false, error: 'wrong-phase' };
        }
      } else if (combat.phase !== 'setup') {
        return { ok: false, error: 'wrong-phase' };
      }
      return { ok: true };
    }

    case 'COMBAT_SET_HITS': {
      const combat = state.round?.combat;
      if (!combat?.active) return { ok: false, error: 'no-combat' };
      if (combat.mode === 'pvp') {
        if (combat.phase !== 'input') return { ok: false, error: 'wrong-phase' };
        if (String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-hits' };
        }
        const inFight = String(combat.attackerId) === String(seatPlayerId)
          || String(combat.defenderId) === String(seatPlayerId);
        if (!inFight) return { ok: false, error: 'not-in-combat' };
        return { ok: true };
      }
      if (combat.mode === 'neutral') {
        // Phone: input → rolling (hits only). Host/admin finishes roll while phase=rolling.
        if (combat.phase === 'rolling') {
          return { ok: false, error: 'wait-host-roll' };
        }
        if (combat.phase !== 'input') return { ok: false, error: 'wrong-phase' };
        if (String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-hits' };
        }
        if (String(combat.attackerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-in-combat' };
        }
        return { ok: true };
      }
      return { ok: false, error: 'no-combat' };
    }

    case 'COMBAT_ASSIGN': {
      const combat = state.round?.combat;
      if (!combat?.active) return { ok: false, error: 'no-combat' };
      if (combat.phase !== 'reveal') return { ok: false, error: 'wrong-phase' };
      if (combat.mode === 'pvp') {
        if (String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-assign' };
        }
        const inFight = String(combat.attackerId) === String(seatPlayerId)
          || String(combat.defenderId) === String(seatPlayerId);
        if (!inFight) return { ok: false, error: 'not-in-combat' };
        return { ok: true };
      }
      if (combat.mode === 'neutral') {
        // Host assigns casualties for neutrals (admin bypasses).
        if (String(action.playerId) === NEUTRAL_OPPONENT_ID) {
          return { ok: false, error: 'host-assign' };
        }
        // Player assigns only for themselves.
        if (String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-assign' };
        }
        if (String(combat.attackerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-in-combat' };
        }
        return { ok: true };
      }
      return { ok: false, error: 'no-combat' };
    }

    case 'COMBAT_DECLARE_RETREAT': {
      const combat = state.round?.combat;
      if (!combat?.active || (combat.mode !== 'pvp' && combat.mode !== 'neutral')) {
        return { ok: false, error: 'no-combat' };
      }
      if (combat.phase !== 'input' && combat.phase !== 'reveal') {
        return { ok: false, error: 'wrong-phase' };
      }
      if (combat.retreatPlayerId != null) return { ok: false, error: 'retreat-pending' };
      if (String(action.playerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-retreat' };
      }
      if (combat.mode === 'neutral') {
        if (String(combat.attackerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-in-combat' };
        }
        return { ok: true };
      }
      const inFight = String(combat.attackerId) === String(seatPlayerId)
        || String(combat.defenderId) === String(seatPlayerId);
      if (!inFight) return { ok: false, error: 'not-in-combat' };
      return { ok: true };
    }

    case 'COMBAT_RESOLVE_RETREAT': {
      const combat = state.round?.combat;
      if (!combat?.active || (combat.mode !== 'pvp' && combat.mode !== 'neutral')) {
        return { ok: false, error: 'no-combat' };
      }
      if (combat.phase !== 'retreat_check') return { ok: false, error: 'wrong-phase' };
      // Only the seat that declared retreat answers «удалось ли отступить?».
      if (combat.retreatPlayerId == null
        || String(combat.retreatPlayerId) !== String(seatPlayerId)) {
        return { ok: false, error: 'not-your-retreat' };
      }
      return { ok: true };
    }

    case 'COMBAT_DEFEAT': {
      const combat = state.round?.combat;
      if (!combat?.active) return { ok: false, error: 'no-combat' };
      if (combat.phase === 'result' || combat.phase === 'retreat_check') {
        return { ok: false, error: 'combat-finished' };
      }
      if (combat.mode === 'pvp') {
        const inFight = String(combat.attackerId) === String(seatPlayerId)
          || String(combat.defenderId) === String(seatPlayerId);
        if (!inFight) return { ok: false, error: 'not-in-combat' };
        if (action.playerId != null && String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-defeat' };
        }
        return { ok: true };
      }
      if (combat.mode === 'neutral') {
        if (String(combat.attackerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-in-combat' };
        }
        if (action.playerId != null && String(action.playerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-your-defeat' };
        }
        return { ok: true };
      }
      return { ok: false, error: 'forbidden' };
    }

    case 'END_COMBAT': {
      // Players may dismiss the victory/defeat screen; host may end anytime.
      const combat = state.round?.combat;
      if (!combat?.active) return { ok: false, error: 'no-combat' };
      if (combat.phase !== 'result') return { ok: false, error: 'forbidden' };
      if (combat.mode === 'neutral') {
        if (String(combat.attackerId) !== String(seatPlayerId)) {
          return { ok: false, error: 'not-in-combat' };
        }
        return { ok: true };
      }
      const inFight = String(combat.attackerId) === String(seatPlayerId)
        || String(combat.defenderId) === String(seatPlayerId);
      if (!inFight) return { ok: false, error: 'not-in-combat' };
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
    case 'custodians':
    case 'support':
    case 'breakthrough':
    case 'expeditionAdmin':
    case 'objectivesAdmin':
    case 'endGame':
    case 'export':
    case 'undo':
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
