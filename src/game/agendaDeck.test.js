import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from './gameState';
import {
  agendaNeedsSpeakerBreak,
  buildShuffledAgendaDeck,
  drawIntoAgenda,
  emptyAgenda,
  fillAgendaFromCard,
  resolveAgendaOutcome,
  resolveAndDiscardAgenda,
  shouldEnactLaw,
} from './agendaDeck';
import { agendaById, agendaDeckForExp } from '../data/agendas';
import { gameReducer } from './gameReducer';

function player(id, name) {
  return { id, name, eliminated: false, influence: 0, votePlanets: 0, cards: [], faction: null };
}

function gameWith(players) {
  const state = createEmptyGameState();
  return {
    ...state,
    players,
    meta: { ...state.meta, speakerId: players[0]?.id ?? null, isPoliticsActive: true },
  };
}

function withAllPassed(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, passed: true })),
  };
}

function voting() {
  let state = gameWith([player(1, 'A'), player(2, 'B')]);
  state = gameReducer(state, { type: 'START_ROUND' });
  state = gameReducer(withAllPassed(state), { type: 'END_ROUND' });
  return gameReducer(state, { type: 'CONFIRM_STATUS_PHASE' });
}

describe('agendaDeck helpers', () => {
  it('builds 50-card decks for base and PoK', () => {
    const base = buildShuffledAgendaDeck(false);
    const pok = buildShuffledAgendaDeck(true);
    expect(base).toHaveLength(50);
    expect(pok).toHaveLength(50);
    expect(base).toContain('core_mining');
    expect(pok).not.toContain('core_mining');
    expect(pok).toContain('articles_of_war');
    expect(agendaDeckForExp({ pok: false })).toHaveLength(50);
    expect(agendaDeckForExp({ pok: true })).toHaveLength(50);
  });

  it('fills agenda type from card voteType', () => {
    const card = agendaById.get('mutiny');
    const agenda = fillAgendaFromCard(emptyAgenda(), card);
    expect(agenda.cardId).toBe('mutiny');
    expect(agenda.type).toBe('FOR_AGAINST');
    expect(agenda.kind).toBe('directive');
    expect(agenda.title).toMatch(/Мятеж/i);
  });

  it('draws and reshuffles discard when deck empty', () => {
    const first = drawIntoAgenda(emptyAgenda(), ['mutiny'], ['arms_reduction']);
    expect(first.agenda.cardId).toBe('mutiny');
    expect(first.agendaDeck).toEqual([]);
    const second = drawIntoAgenda(emptyAgenda(), [], first.agendaDiscard.concat('mutiny'));
    expect(second.agenda.cardId).toBeTruthy();
    expect(second.agendaDeck.length + 1).toBe(2);
  });

  it('enacts FOR_AGAINST law only on for; never enacts directives', () => {
    const law = fillAgendaFromCard(emptyAgenda(), agendaById.get('fleet_regulations'));
    expect(shouldEnactLaw(law, 'for')).toBe(true);
    expect(shouldEnactLaw(law, 'against')).toBe(false);
    const directive = fillAgendaFromCard(emptyAgenda(), agendaById.get('mutiny'));
    expect(shouldEnactLaw(directive, 'for')).toBe(false);
  });

  it('waits for speaker decision on for/against ties, then enacts', () => {
    const state = createEmptyGameState();
    state.players = [
      { id: 1, name: 'A', eliminated: false },
      { id: 2, name: 'B', eliminated: false },
    ];
    state.meta.speakerId = 1;
    const agenda = {
      type: 'FOR_AGAINST',
      kind: 'law',
      cardId: 'fleet_regulations',
      title: 'Fleet',
      votes: {
        1: { choice: 'for', amount: 1 },
        2: { choice: 'against', amount: 1 },
      },
      locked: { 1: true, 2: true },
    };
    expect(resolveAgendaOutcome(state, agenda)).toBeNull();

    const decided = { ...agenda, speakerDecision: 'for' };
    expect(resolveAgendaOutcome(state, decided)).toBe('for');

    const resolved = resolveAndDiscardAgenda(state, decided, [], []);
    expect(resolved.activeLaws).toHaveLength(1);
    expect(resolved.activeLaws[0].id).toBe('fleet_regulations');
    expect(resolved.agendaDiscard).toEqual(['fleet_regulations']);
  });

  it('needs speaker decision when all abstain on for/against', () => {
    const state = createEmptyGameState();
    state.players = [
      { id: 1, name: 'A', eliminated: false },
      { id: 2, name: 'B', eliminated: false },
    ];
    const agenda = {
      type: 'FOR_AGAINST',
      kind: 'law',
      cardId: 'fleet_regulations',
      votes: {
        1: { choice: 'abstain', amount: 0 },
        2: { choice: 'abstain', amount: 0 },
      },
      locked: { 1: true, 2: true },
    };
    expect(resolveAgendaOutcome(state, agenda)).toBeNull();
    expect(resolveAgendaOutcome(state, { ...agenda, speakerDecision: 'against' })).toBe('against');
  });
});

describe('agenda deck in politics phase', () => {
  const openLaw = (s) => gameReducer(s, { type: 'REVEAL_AGENDA' });

  it('seeds a shuffled deck on status confirm; speaker opens law on VOTE', () => {
    let state = voting();
    expect(state.politics.agendaDeck).toHaveLength(50);
    expect(state.politics.agendas[0].cardId).toBeUndefined();

    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    const agenda = state.politics.agendas[0];
    expect(agenda.cardId).toBeTruthy();
    expect(agenda.type).toBeTruthy();
    expect(agenda.revealed).toBe(false);
    expect(state.politics.agendaDeck).toHaveLength(49);

    state = openLaw(state);
    expect(state.politics.agendas[0].revealed).toBe(true);
  });

  it('enacts FOR_AGAINST law on For, not Against; skips directives', () => {
    let state = voting();
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendaDeck: ['fleet_regulations', 'mutiny', 'arms_reduction'],
        agendaDiscard: [],
        activeLaws: [],
        agendas: [emptyAgenda()],
        currentAgendaIndex: 0,
      },
    };
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    expect(state.politics.agendas[0].cardId).toBe('fleet_regulations');
    expect(state.politics.agendas[0].kind).toBe('law');
    state = openLaw(state);

    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'for', amount: 3 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'against', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    state = gameReducer(state, { type: 'NEXT_AGENDA' });

    expect(state.politics.activeLaws.map((l) => l.id)).toEqual(['fleet_regulations']);
    expect(state.politics.agendaDiscard).toContain('fleet_regulations');
    expect(state.politics.agendas[1].cardId).toBe('mutiny');

    // Against on a law → no enact
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendas: [
          state.politics.agendas[0],
          {
            ...fillAgendaFromCard(emptyAgenda(), agendaById.get('homeland_defense_act')),
            revealed: true,
            votes: {},
            locked: {},
          },
        ],
        currentAgendaIndex: 1,
        activeLaws: [...state.politics.activeLaws],
      },
    };
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'against', amount: 5 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'against', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    state = gameReducer(state, { type: 'NEXT_AGENDA' });
    expect(state.politics.activeLaws.map((l) => l.id)).toEqual(['fleet_regulations']);

    // Directive never stays
    const mutinyIdx = state.politics.currentAgendaIndex;
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendas: state.politics.agendas.map((a, i) => (
          i === mutinyIdx
            ? {
              ...fillAgendaFromCard(emptyAgenda(), agendaById.get('mutiny')),
              revealed: true,
              votes: {},
              locked: {},
            }
            : a
        )),
      },
    };
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'for', amount: 2 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'for', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    state = gameReducer(state, { type: 'NEXT_AGENDA' });
    expect(state.politics.activeLaws.every((l) => l.id !== 'mutiny')).toBe(true);
  });

  it('requires two completed agendas before SPEAKER finishes unchanged', () => {
    let state = voting();
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    const firstId = state.politics.agendas[0].cardId;
    expect(firstId).toBeTruthy();

    const lockBoth = (s, choice = 'for') => {
      let next = openLaw(s);
      next = gameReducer(next, {
        type: 'SET_VOTE', playerId: 1, vote: { choice, amount: 1 },
      });
      next = gameReducer(next, { type: 'LOCK_VOTE', playerId: 1 });
      next = gameReducer(next, {
        type: 'SET_VOTE', playerId: 2, vote: { choice, amount: 1 },
      });
      return gameReducer(next, { type: 'LOCK_VOTE', playerId: 2 });
    };

    state = lockBoth(state);
    state = gameReducer(state, { type: 'NEXT_AGENDA' });
    expect(state.politics.currentAgendaIndex).toBe(1);
    expect(state.politics.agendas[1].cardId).toBeTruthy();
    expect(state.politics.agendas[1].cardId).not.toBe(firstId);

    state = lockBoth(state, 'against');
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'SPEAKER' });
    expect(state.politics.step).toBe('SPEAKER');
    expect(state.politics.agendaDiscard.length).toBeGreaterThanOrEqual(2);
  });

  it('SKIP_AGENDA discards without enacting and draws next', () => {
    let state = voting();
    state = {
      ...state,
      politics: {
        ...state.politics,
        agendaDeck: ['fleet_regulations', 'mutiny'],
        agendas: [emptyAgenda()],
        activeLaws: [],
      },
    };
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    expect(state.politics.agendas[0].cardId).toBe('fleet_regulations');
    state = gameReducer(state, { type: 'SKIP_AGENDA' });
    expect(state.politics.activeLaws).toEqual([]);
    expect(state.politics.agendaDiscard).toContain('fleet_regulations');
    expect(state.politics.agendas[1].cardId).toBe('mutiny');
  });

  it('Incentive Program For opens Stage I as extra (never counts toward status 5)', () => {
    let state = voting();
    state = {
      ...state,
      objectives: {
        ...state.objectives,
        active: [],
      },
      politics: {
        ...state.politics,
        agendaDeck: ['incentive_program', 'mutiny'],
        agendas: [emptyAgenda()],
        currentAgendaIndex: 0,
        activeLaws: [],
      },
    };
    state = openLaw(gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' }));
    expect(state.politics.agendas[0].cardId).toBe('incentive_program');

    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'for', amount: 2 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'for', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    state = gameReducer(state, { type: 'NEXT_AGENDA' });

    const stage1Active = state.objectives.active.filter((o) => Number(o.stage) !== 2);
    expect(stage1Active).toHaveLength(1);
    expect(stage1Active[0].extra).toBe(true);
  });

  it('Miscount Disclosed: revote uses original law voteType (player / for-against)', () => {
    let state = voting();
    state = {
      ...state,
      meta: { ...state.meta, speakerId: 1 },
      politics: {
        ...state.politics,
        agendaDeck: ['miscount_disclosed', 'mutiny'],
        activeLaws: [
          {
            id: 'minister_of_war',
            title: 'Министр войны',
            kind: 'law',
            elect: 'player',
            voteType: 'PLAYER_CHOICE',
            outcome: { choice: '1' },
            ownerPlayerId: 1,
          },
        ],
        agendas: [emptyAgenda()],
        currentAgendaIndex: 0,
      },
    };
    state = openLaw(gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' }));
    state = gameReducer(state, { type: 'SELECT_MISCOUNT_LAW', lawId: 'minister_of_war' });
    expect(state.politics.agendas[0].type).toBe('PLAYER_CHOICE');
    expect(state.politics.agendas[0].revote.voteType).toBe('PLAYER_CHOICE');
  });

  it('Miscount Disclosed: speaker picks a law, revote against removes it', () => {
    let state = voting();
    state = {
      ...state,
      meta: { ...state.meta, speakerId: 1 },
      politics: {
        ...state.politics,
        agendaDeck: ['miscount_disclosed', 'mutiny'],
        agendaDiscard: [],
        activeLaws: [{
          id: 'fleet_regulations',
          title: 'Fleet',
          desc: 'Law',
          kind: 'law',
          elect: 'for_against',
          forText: 'For',
          againstText: 'Against',
          outcome: 'for',
        }],
        agendas: [emptyAgenda()],
        currentAgendaIndex: 0,
      },
    };
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    state = openLaw(state);
    expect(state.politics.agendas[0].cardId).toBe('miscount_disclosed');
    expect(state.politics.agendas[0].miscount).toBe(true);
    expect(state.politics.agendas[0].type).toBeNull();

    state = gameReducer(state, { type: 'SELECT_MISCOUNT_LAW', lawId: 'fleet_regulations' });
    expect(state.politics.agendas[0].miscountRevote).toBe(true);
    expect(state.politics.agendas[0].type).toBe('FOR_AGAINST');
    expect(state.politics.agendas[0].revote.id).toBe('fleet_regulations');

    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'against', amount: 3 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'against', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    state = gameReducer(state, { type: 'NEXT_AGENDA' });

    expect(state.politics.activeLaws).toEqual([]);
    expect(state.politics.agendaDiscard).toEqual(
      expect.arrayContaining(['miscount_disclosed', 'fleet_regulations']),
    );
  });

  it('Covert Legislation draws a hidden agenda and reveals after full vote', () => {
    let state = voting();
    state = {
      ...state,
      meta: { ...state.meta, speakerId: 1, usePok: true },
      politics: {
        ...state.politics,
        agendaDeck: ['covert_legislation', 'fleet_regulations', 'mutiny'],
        agendaDiscard: [],
        activeLaws: [],
        agendas: [emptyAgenda()],
        currentAgendaIndex: 0,
      },
    };
    state = gameReducer(state, { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    const agenda = state.politics.agendas[0];
    expect(agenda.cardId).toBe('covert_legislation');
    expect(agenda.title).toMatch(/Тайный законопроект/i);
    expect(agenda.covert).toBe(true);
    expect(agenda.revealed).toBe(false);
    expect(agenda.hiddenRevealed).toBe(false);
    expect(agenda.hidden.cardId).toBe('fleet_regulations');
    expect(agenda.type).toBe('FOR_AGAINST');
    expect(agenda.forText).toBeUndefined();
    expect(state.politics.agendaDeck[0]).toBe('mutiny');

    state = openLaw(state);
    expect(state.politics.agendas[0].revealed).toBe(true);

    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 1, vote: { choice: 'for', amount: 2 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 1 });
    expect(state.politics.agendas[0].hiddenRevealed).toBe(false);

    state = gameReducer(state, {
      type: 'SET_VOTE', playerId: 2, vote: { choice: 'against', amount: 1 },
    });
    state = gameReducer(state, { type: 'LOCK_VOTE', playerId: 2 });
    // Nested card stays sealed until the speaker opens it again.
    expect(state.politics.agendas[0].hiddenRevealed).toBe(false);
    state = openLaw(state);
    expect(state.politics.agendas[0].hiddenRevealed).toBe(true);

    state = gameReducer(state, { type: 'NEXT_AGENDA' });
    expect(state.politics.activeLaws.map((l) => l.id)).toEqual(['fleet_regulations']);
    expect(state.politics.agendaDiscard).toEqual(
      expect.arrayContaining(['covert_legislation', 'fleet_regulations']),
    );
  });
});
