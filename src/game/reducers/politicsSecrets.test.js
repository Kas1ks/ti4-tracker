import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../gameState';
import { reduceGame } from '../gameEvents';
import { drawIntoAgenda, emptyAgenda, hasAnyScoredSecrets } from '../agendaDeck';
import { SECRET_OBJECTIVES } from '../../data/secretObjectives';

function dispatch(state, action) {
  return reduceGame(state, action);
}

function baseWithSecrets() {
  let state = createEmptyGameState();
  state = {
    ...state,
    isGameActive: true,
    players: [
      {
        ...state.players[0],
        id: 1,
        name: 'A',
        secretHand: [],
        secretScored: ['destroy_their_greatest_ship'],
        secrets: 1,
        secretCap: 3,
      },
      {
        ...state.players[1],
        id: 2,
        name: 'B',
        secretHand: [],
        secretScored: [],
        secrets: 0,
        secretCap: 3,
      },
    ].concat(state.players.slice(2)),
    secretObjectives: {
      deck: SECRET_OBJECTIVES.slice(0, 20).map((c) => c.id).filter(
        (id) => id !== 'destroy_their_greatest_ship',
      ),
      scored: ['destroy_their_greatest_ship'],
      dealStarted: true,
      draftPending: false,
      pendingReveals: {},
      overflows: {},
    },
    politics: {
      ...state.politics,
      showModal: true,
      step: 'VOTE',
      agendas: [emptyAgenda()],
      currentAgendaIndex: 0,
      agendaDeck: [],
      agendaDiscard: [],
      activeLaws: [],
    },
  };
  return state;
}

function lockAllVotes(state, choice) {
  let next = state;
  for (const p of next.players.filter((x) => !x.eliminated)) {
    next = dispatch(next, {
      type: 'SET_VOTE',
      playerId: p.id,
      vote: { choice, amount: 1, planets: 0 },
    });
    next = dispatch(next, { type: 'LOCK_VOTE', playerId: p.id });
  }
  return next;
}

describe('agenda secret effects', () => {
  it('drawIntoAgenda skips CDL when no scored secrets', () => {
    const state = createEmptyGameState();
    expect(hasAnyScoredSecrets(state)).toBe(false);
    const drawn = drawIntoAgenda(
      emptyAgenda(),
      ['classified_document_leaks', 'mutiny'],
      [],
      { state },
    );
    expect(drawn.agenda.cardId).toBe('mutiny');
    expect(drawn.agendaDiscard).toContain('classified_document_leaks');
  });

  it('drawIntoAgenda fills CDL elect choices from scored secrets', () => {
    const state = baseWithSecrets();
    const drawn = drawIntoAgenda(
      emptyAgenda(),
      ['classified_document_leaks'],
      [],
      { state },
    );
    expect(drawn.agenda.cardId).toBe('classified_document_leaks');
    expect(drawn.agenda.customChoices?.length).toBeGreaterThan(0);
    expect(drawn.agenda.customChoices[0]).toMatch(/величайший|Destroy/i);
  });

  it('Archived Secret draws 1 secret for elected player', () => {
    let state = baseWithSecrets();
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendas: [{
          ...emptyAgenda(),
          cardId: 'archived_secret',
          title: 'Архивный секрет',
          kind: 'directive',
          elect: 'player',
          type: 'PLAYER_CHOICE',
          revealed: true,
          votes: {},
          locked: {},
        }],
      },
    };
    const before = state.players.find((p) => p.id === 2).secretHand.length;
    state = lockAllVotes(state, 2);
    state = dispatch(state, { type: 'NEXT_AGENDA' });
    const after = state.players.find((p) => p.id === 2);
    expect(after.secretHand.length).toBe(before + 1);
  });

  it('Search Warrant draws 2 and reveals hand', () => {
    let state = baseWithSecrets();
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendas: [{
          ...emptyAgenda(),
          cardId: 'search_warrant',
          title: 'Ордер на обыск',
          kind: 'law',
          elect: 'player',
          type: 'PLAYER_CHOICE',
          revealed: true,
          votes: {},
          locked: {},
        }],
      },
    };
    state = lockAllVotes(state, 2);
    state = dispatch(state, { type: 'NEXT_AGENDA' });
    const p2 = state.players.find((p) => p.id === 2);
    expect(p2.secretHand.length).toBe(2);
    expect(p2.secretsRevealed).toBe(true);
    expect(state.politics.activeLaws.some((l) => l.id === 'search_warrant')).toBe(true);

    state = dispatch(state, { type: 'REMOVE_ACTIVE_LAW', lawId: 'search_warrant' });
    expect(state.players.find((p) => p.id === 2).secretsRevealed).toBe(false);
  });

  it('CDL promotes elected scored secret to a public objective', () => {
    let state = baseWithSecrets();
    const title = SECRET_OBJECTIVES.find((c) => c.id === 'destroy_their_greatest_ship')?.title;
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendas: [{
          ...emptyAgenda(),
          cardId: 'classified_document_leaks',
          title: 'Утечка',
          kind: 'law',
          elect: 'scored_secret_objective',
          type: 'OTHER',
          revealed: true,
          customChoices: [title],
          votes: {},
          locked: {},
        }],
      },
    };
    state = lockAllVotes(state, title);
    state = dispatch(state, { type: 'NEXT_AGENDA' });

    expect(state.players.find((p) => p.id === 1).secretScored).toEqual([]);
    expect(state.players.find((p) => p.id === 1).secrets).toBe(1);
    const pub = state.objectives.active.find((o) => o.secretId === 'destroy_their_greatest_ship');
    expect(pub).toBeTruthy();
    expect(pub.title).toBe(title);
  });
});
