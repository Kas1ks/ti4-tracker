import { secretObjectiveById } from '../../data/secretObjectives';
import { patchPlayer, withMeta, withObjectives, withPolitics } from '../stateHelpers';
import { currentAgenda, activePlayers } from '../selectors';
import { startNewRound } from './roundLifecycle';
import {
  agendaNeedsSpeakerBreak,
  agendaSpeakerDecisionPending,
  applyMiscountRevote,
  drawIntoAgenda,
  emptyAgenda,
  isAgendaFaceUp,
  resolutionEffectCardId,
  resolveAndDiscardAgenda,
  scoredSecretIdFromElectChoice,
} from '../agendaDeck';
import { drawSecretsForPlayer } from './secretObjectives';
import { drawStageObjectiveIgnoringCap } from './statusPhase';

export { emptyAgenda };

const SEARCH_WARRANT_ID = 'search_warrant';

/** Sync player.secretsRevealed from active Search Warrant ownership. */
export function syncSecretsRevealedFromLaws(state) {
  const laws = state?.politics?.activeLaws || [];
  const revealed = new Set(
    laws
      .filter((l) => l?.id === SEARCH_WARRANT_ID && l.ownerPlayerId != null)
      .map((l) => String(l.ownerPlayerId)),
  );
  let changed = false;
  const players = (state.players || []).map((p) => {
    const next = revealed.has(String(p.id));
    if (!!p.secretsRevealed === next) return p;
    changed = true;
    return { ...p, secretsRevealed: next };
  });
  return changed ? { ...state, players } : state;
}

function electPlayerId(outcome) {
  if (!outcome || typeof outcome !== 'object' || outcome.choice == null) return null;
  const n = Number(outcome.choice);
  return Number.isFinite(n) ? n : outcome.choice;
}

/** Move elected scored secret into the public objective area (CDL). */
function promoteElectedSecretToPublic(state, outcome) {
  if (!outcome || typeof outcome !== 'object' || outcome.choice == null) return state;
  const cardId = scoredSecretIdFromElectChoice(state, outcome.choice);
  if (!cardId) return state;
  const card = secretObjectiveById.get(cardId);
  if (!card) return state;

  let ownerId = null;
  for (const p of state.players || []) {
    if ((p.secretScored || []).includes(cardId)) {
      ownerId = p.id;
      break;
    }
  }
  if (ownerId == null) return state;

  const pubId = `public_secret_${cardId}`;
  const active = state.objectives?.active || [];
  if (active.some((o) => o.id === pubId || o.secretId === cardId)) return state;

  let next = patchPlayer(state, ownerId, (p) => ({
    secretScored: (p.secretScored || []).filter((id) => id !== cardId),
  }));
  const scored = (next.secretObjectives?.scored || []).filter((id) => id !== cardId);
  next = {
    ...next,
    secretObjectives: {
      ...(next.secretObjectives || {}),
      scored,
    },
  };

  const objective = {
    id: pubId,
    stage: Number(card.points) === 2 ? 2 : 1,
    points: Number(card.points) || 1,
    title: card.title,
    desc: card.desc || '',
    exp: card.exp || 'base',
    fromSecret: true,
    secretId: cardId,
    extra: true,
  };
  return withObjectives(next, { active: [...active, objective] });
}

/** Under one-vote law, a non-abstain ballot is always amount 1 (no planet bonuses). */
function coerceAgendaVote(state, vote) {
  if (!vote || typeof vote !== 'object') return vote;
  if (!state.politics?.oneVoteLaw) return vote;
  if (vote.choice === 'abstain') return { ...vote, amount: 0, planets: 0 };
  return { ...vote, amount: 1, planets: 0 };
}

/** 0 голосов (и 0 планет) → воздержание, даже если выбраны За/Против или другой вариант. */
function finalizeLockedVote(state, vote) {
  const coerced = coerceAgendaVote(state, vote);
  if (!coerced || typeof coerced !== 'object') return coerced;
  if (coerced.choice === 'abstain') return { ...coerced, amount: 0, planets: 0 };
  if (state.politics?.oneVoteLaw) return coerced;
  const amount = Math.max(0, Number(coerced.amount) || 0);
  const planets = Math.max(0, Number(coerced.planets) || 0);
  if (amount === 0 && planets === 0) {
    return { ...coerced, choice: 'abstain', amount: 0, planets: 0 };
  }
  return coerced;
}

function mapCurrentAgenda(state, fn) {
  return withPolitics(state, {
    agendas: state.politics.agendas.map((agenda, index) => (
      index === state.politics.currentAgendaIndex ? fn(agenda) : agenda
    )),
  });
}

function isAgendaFullyVoted(agenda, state) {
  const seats = activePlayers(state);
  if (!agenda?.type || !seats.length) return false;
  return seats.every((p) => !!agenda.locked?.[p.id]);
}

/** Ensure current agenda has a drawn card (idempotent). */
function ensureCurrentAgendaRevealed(state) {
  const agenda = currentAgenda(state);
  // Miscount may be face-up with type=null until the speaker picks a law.
  if (agenda?.cardId) return state;
  const drawn = drawIntoAgenda(
    agenda || emptyAgenda(),
    state.politics.agendaDeck,
    state.politics.agendaDiscard,
    { state },
  );
  const agendas = [...(state.politics.agendas || [])];
  const idx = state.politics.currentAgendaIndex || 0;
  while (agendas.length <= idx) agendas.push(emptyAgenda());
  agendas[idx] = drawn.agenda;
  return withPolitics(state, {
    agendas,
    agendaDeck: drawn.agendaDeck,
    agendaDiscard: drawn.agendaDiscard,
  });
}

/** Post-vote board effects (Incentive Program, secret agendas, etc.). */
function applyResolvedAgendaBoardEffects(state, agenda, outcome) {
  const effectId = resolutionEffectCardId(agenda);
  let next = state;

  if (effectId === 'incentive_program' && (outcome === 'for' || outcome === 'against')) {
    const stage = outcome === 'for' ? 1 : 2;
    next = drawStageObjectiveIgnoringCap(next, stage).state;
  }

  if (effectId === 'archived_secret') {
    const pid = electPlayerId(outcome);
    if (pid != null) next = drawSecretsForPlayer(next, pid, 1);
  }

  if (effectId === 'search_warrant') {
    const pid = electPlayerId(outcome);
    if (pid != null) next = drawSecretsForPlayer(next, pid, 2);
  }

  if (effectId === 'classified_document_leaks') {
    next = promoteElectedSecretToPublic(next, outcome);
  }

  return syncSecretsRevealedFromLaws(next);
}

/**
 * Close out current agenda: resolve+enact (or skip), then open next slot with a draw.
 * @param {'resolve'|'skip'} mode
 */
function advanceAgenda(state, mode) {
  const idx = state.politics.currentAgendaIndex || 0;
  const agenda = state.politics.agendas?.[idx];
  let activeLaws = state.politics.activeLaws || [];
  let agendaDiscard = state.politics.agendaDiscard || [];
  let agendas = [...(state.politics.agendas || [])];
  let boardState = state;

  if (agenda?.cardId || agenda?.type) {
    if (mode === 'resolve' && isAgendaFullyVoted(agenda, state)) {
      // Tie / zero votes: wait for speaker decision before resolving.
      if (agendaSpeakerDecisionPending(state, agenda)) return state;
      const resolved = resolveAndDiscardAgenda(state, agenda, activeLaws, agendaDiscard);
      activeLaws = resolved.activeLaws;
      agendaDiscard = resolved.agendaDiscard;
      agendas[idx] = { ...agenda, outcome: resolved.outcome, hiddenRevealed: true };
      boardState = withPolitics(state, {
        agendas,
        activeLaws,
        agendaDiscard,
      });
      boardState = applyResolvedAgendaBoardEffects(boardState, agenda, resolved.outcome);
      activeLaws = boardState.politics?.activeLaws || activeLaws;
      agendaDiscard = boardState.politics?.agendaDiscard || agendaDiscard;
      agendas = [...(boardState.politics?.agendas || agendas)];
    } else {
      // Skip or incomplete: discard card id(s) without enacting.
      if (agenda?.cardId) agendaDiscard = [...agendaDiscard, agenda.cardId];
      if (agenda?.covert && agenda.hidden?.cardId) {
        agendaDiscard = [...agendaDiscard, agenda.hidden.cardId];
      }
    }
  }

  const nextIndex = idx + 1;
  const drawn = drawIntoAgenda(
    emptyAgenda(),
    boardState.politics.agendaDeck,
    agendaDiscard,
    { state: boardState },
  );
  while (agendas.length <= nextIndex) agendas.push(emptyAgenda());
  agendas[nextIndex] = drawn.agenda;

  return syncSecretsRevealedFromLaws(withPolitics(boardState, {
    agendas,
    currentAgendaIndex: nextIndex,
    agendaDeck: drawn.agendaDeck,
    agendaDiscard: drawn.agendaDiscard,
    activeLaws,
  }));
}

const POLITICS_ACTIONS = new Set([
  'TOGGLE_POLITICS_ACTIVE',
  'SET_INFLUENCE',
  'LOCK_INFLUENCE',
  'UNLOCK_INFLUENCE',
  'SET_AGENDA_TYPE',
  'SET_AGENDA_CUSTOM_CHOICES',
  'SET_VOTE',
  'LOCK_VOTE',
  'REVEAL_AGENDA',
  'REVEAL_COVERT_AGENDA',
  'SELECT_MISCOUNT_LAW',
  'TOGGLE_VOTE_REVERSED',
  'SET_VOTE_REVERSED',
  'TOGGLE_ONE_VOTE_LAW',
  'SET_ONE_VOTE_LAW',
  'SET_POLITICS_STEP',
  'NEXT_AGENDA',
  'SKIP_AGENDA',
  'FINISH_AGENDA_PHASE',
  'SET_POLITICS_VISIBLE',
  'REMOVE_ACTIVE_LAW',
]);

export function reducePoliticsPhase(state, action) {
  if (!POLITICS_ACTIONS.has(action.type)) return null;

  switch (action.type) {
    case 'TOGGLE_POLITICS_ACTIVE':
      return withMeta(state, { isPoliticsActive: !state.meta.isPoliticsActive });

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

    case 'SET_AGENDA_TYPE':
      return mapCurrentAgenda(state, agenda => ({
        ...agenda,
        type: action.agendaType,
        customChoices: action.agendaType === 'OTHER' ? (agenda.customChoices || ['']) : undefined,
      }));

    case 'SET_AGENDA_CUSTOM_CHOICES':
      return mapCurrentAgenda(state, agenda => ({ ...agenda, customChoices: action.choices }));

    case 'SET_VOTE': {
      const agenda = currentAgenda(state);
      if (agenda?.locked?.[action.playerId]) return state;
      if (agenda?.cardId && !isAgendaFaceUp(agenda)) return state;
      if (agenda?.miscount && !agenda.miscountRevote) return state;
      const vote = coerceAgendaVote(state, action.vote);
      return mapCurrentAgenda(state, a => ({
        ...a,
        votes: { ...a.votes, [action.playerId]: vote },
      }));
    }

    case 'LOCK_VOTE': {
      const agenda = currentAgenda(state);
      if (!agenda || agenda.locked?.[action.playerId]) return state;
      if (agenda?.cardId && !isAgendaFaceUp(agenda)) return state;
      if (agenda?.miscount && !agenda.miscountRevote) return state;
      const prev = action.vote != null
        ? action.vote
        : (agenda.votes?.[action.playerId] || { choice: 'abstain', amount: 0 });
      const vote = finalizeLockedVote(state, prev);
      return mapCurrentAgenda(state, a => ({
        ...a,
        votes: { ...a.votes, [action.playerId]: vote },
        locked: { ...a.locked, [action.playerId]: true },
      }));
    }

    case 'REVEAL_AGENDA':
    case 'REVEAL_COVERT_AGENDA': {
      const agenda = currentAgenda(state);
      if (!agenda?.cardId) return state;
      // 1) Speaker flips the drawn agenda face-up for everyone.
      if (!isAgendaFaceUp(agenda)) {
        return mapCurrentAgenda(state, a => ({ ...a, revealed: true }));
      }
      // 2) Covert Legislation: after voting, unveil the nested agenda.
      if (
        agenda.covert
        && agenda.hidden?.cardId
        && !agenda.hiddenRevealed
        && isAgendaFullyVoted(agenda, state)
      ) {
        return mapCurrentAgenda(state, a => ({ ...a, hiddenRevealed: true }));
      }
      return state;
    }

    case 'SELECT_MISCOUNT_LAW': {
      const agenda = currentAgenda(state);
      if (!agenda?.miscount || agenda.miscountRevote) return state;
      if (!isAgendaFaceUp(agenda)) return state;
      const law = (state.politics.activeLaws || []).find(
        (l) => String(l.id) === String(action.lawId),
      );
      if (!law) return state;
      return mapCurrentAgenda(state, (a) => applyMiscountRevote(a, law));
    }

    case 'SET_SPEAKER_AGENDA_DECISION': {
      const agenda = currentAgenda(state);
      if (!agenda?.type) return state;
      if (!isAgendaFullyVoted(agenda, state)) return state;
      if (!agendaNeedsSpeakerBreak(state, agenda)) return state;
      const choice = action.choice;
      if (choice == null || choice === '') return state;
      if (agenda.type === 'FOR_AGAINST') {
        if (choice !== 'for' && choice !== 'against') return state;
      } else if (agenda.type === 'PLAYER_CHOICE') {
        const ok = activePlayers(state).some((p) => String(p.id) === String(choice));
        if (!ok) return state;
      } else if (agenda.type === 'OTHER') {
        const idx = Number(choice);
        const labels = agenda.customChoices || [];
        if (!Number.isInteger(idx) || idx < 0 || idx >= labels.length) return state;
        if (!String(labels[idx] || '').trim()) return state;
      } else {
        return state;
      }
      return mapCurrentAgenda(state, (a) => ({ ...a, speakerDecision: choice }));
    }

    case 'TOGGLE_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !state.politics.voteReversed });

    case 'SET_VOTE_REVERSED':
      return withPolitics(state, { voteReversed: !!action.reversed });

    case 'TOGGLE_ONE_VOTE_LAW': {
      const enabled = !state.politics?.oneVoteLaw;
      const patch = { oneVoteLaw: enabled };
      if (enabled && state.politics?.showModal && state.politics.step === 'SETUP') {
        patch.step = 'VOTE';
      }
      if (!enabled && state.politics?.showModal && state.politics.step === 'VOTE') {
        patch.step = 'SETUP';
      }
      let next = withPolitics(state, patch);
      if (enabled && next.politics.step === 'VOTE') {
        next = ensureCurrentAgendaRevealed(next);
      }
      return next;
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
      let next = withPolitics(state, patch);
      if (enabled && next.politics.step === 'VOTE') {
        next = ensureCurrentAgendaRevealed(next);
      }
      return next;
    }

    case 'SET_POLITICS_STEP': {
      let next = withPolitics(state, { step: action.step });
      if (action.step === 'VOTE') {
        next = ensureCurrentAgendaRevealed(next);
      }
      if (action.step === 'SPEAKER') {
        const agenda = currentAgenda(next);
        if (agenda && isAgendaFullyVoted(agenda, next) && !agenda.outcome) {
          if (agendaSpeakerDecisionPending(next, agenda)) return state;
          const resolved = resolveAndDiscardAgenda(
            next,
            agenda,
            next.politics.activeLaws,
            next.politics.agendaDiscard,
          );
          const agendas = [...next.politics.agendas];
          agendas[next.politics.currentAgendaIndex] = {
            ...agenda,
            outcome: resolved.outcome,
            hiddenRevealed: true,
          };
          next = withPolitics(next, {
            agendas,
            activeLaws: resolved.activeLaws,
            agendaDiscard: resolved.agendaDiscard,
          });
          next = applyResolvedAgendaBoardEffects(next, agenda, resolved.outcome);
        }
      }
      return syncSecretsRevealedFromLaws(next);
    }

    case 'NEXT_AGENDA':
      return advanceAgenda(state, 'resolve');

    case 'SKIP_AGENDA':
      return advanceAgenda(state, 'skip');

    case 'FINISH_AGENDA_PHASE': {
      let next = state;
      if (action.playerId != null) {
        next = withMeta(next, { speakerId: action.playerId });
      }
      return startNewRound(withPolitics(next, {
        showModal: false,
        influenceLocked: {},
        voteReversed: false,
        // Keep activeLaws / remaining deck across rounds.
      }));
    }

    case 'SET_POLITICS_VISIBLE':
      return withPolitics(state, { showModal: !!action.visible });

    case 'REMOVE_ACTIVE_LAW': {
      const lawId = action.lawId;
      if (lawId == null || lawId === '') return state;
      const activeLaws = state.politics.activeLaws || [];
      const removed = activeLaws.find((l) => String(l.id) === String(lawId));
      if (!removed) return state;
      const nextLaws = activeLaws.filter((l) => String(l.id) !== String(lawId));
      const discard = [...(state.politics.agendaDiscard || [])];
      if (removed.id && !discard.includes(removed.id)) discard.push(removed.id);
      return syncSecretsRevealedFromLaws(withPolitics(state, {
        activeLaws: nextLaws,
        agendaDiscard: discard,
      }));
    }

    default:
      return null;
  }
}
