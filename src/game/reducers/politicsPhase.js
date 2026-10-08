import { patchPlayer, withMeta, withPolitics } from '../stateHelpers';
import { currentAgenda } from '../selectors';
import { startNewRound } from './roundLifecycle';

export const emptyAgenda = () => ({ type: null, votes: {}, locked: {} });

/** Under one-vote law, a non-abstain ballot is always amount 1 (no planet bonuses). */
function coerceAgendaVote(state, vote) {
  if (!vote || typeof vote !== 'object') return vote;
  if (!state.politics?.oneVoteLaw) return vote;
  if (vote.choice === 'abstain') return { ...vote, amount: 0, planets: 0 };
  return { ...vote, amount: 1, planets: 0 };
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

const POLITICS_ACTIONS = new Set([
  'TOGGLE_POLITICS_ACTIVE',
  'SET_INFLUENCE',
  'LOCK_INFLUENCE',
  'UNLOCK_INFLUENCE',
  'SET_AGENDA_TYPE',
  'SET_AGENDA_CUSTOM_CHOICES',
  'SET_VOTE',
  'LOCK_VOTE',
  'TOGGLE_VOTE_REVERSED',
  'SET_VOTE_REVERSED',
  'TOGGLE_ONE_VOTE_LAW',
  'SET_ONE_VOTE_LAW',
  'SET_POLITICS_STEP',
  'NEXT_AGENDA',
  'FINISH_AGENDA_PHASE',
  'SET_POLITICS_VISIBLE',
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

    default:
      return null;
  }
}
