import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from '../game/gameState.js';
import { gameReducer } from '../game/gameReducer.js';
import { authorizeAction, can, ROLES } from './permissions.js';

const player = (id, name) => ({
  id, name, factionId: 'sol', color: '#3b82f6', secrets: 0, extra: 0,
  totalTime: 0, damageDealt: 0, eliminated: false, cards: [],
});

function draftState() {
  let state = normalizeGameState({
    isGameActive: true,
    players: [player(1, 'A'), player(2, 'B')],
    speakerId: 1,
  });
  state = gameReducer(state, { type: 'OPEN_DRAFT' });
  return state;
}

describe('authorizeAction', () => {
  it('allows admin everything', () => {
    const state = createEmptyGameState();
    expect(authorizeAction({
      role: ROLES.ADMIN,
      seatPlayerId: null,
      action: { type: 'START_ROUND' },
      state,
    }).ok).toBe(true);
  });

  it('blocks viewer mutations', () => {
    const state = draftState();
    expect(authorizeAction({
      role: ROLES.VIEWER,
      seatPlayerId: null,
      action: { type: 'PICK_CARD', cardId: 1 },
      state,
    })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('lets a player pick only on their draft turn', () => {
    const state = draftState();
    const current = state.draft.queue[state.draft.currentQueueIndex];
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: current,
      action: { type: 'PICK_CARD', cardId: 1 },
      state,
    }).ok).toBe(true);

    const other = state.players.find((p) => p.id !== current).id;
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: other,
      action: { type: 'PICK_CARD', cardId: 1 },
      state,
    }).error).toBe('not-your-pick');
  });

  it('lets a player undo only their own last pick', () => {
    let state = draftState();
    const first = state.draft.queue[0];
    state = gameReducer(state, { type: 'PICK_CARD', cardId: 1 });

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: first,
      action: { type: 'UNDO_PICK' },
      state,
    }).ok).toBe(true);

    const other = state.players.find((p) => p.id !== first).id;
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: other,
      action: { type: 'UNDO_PICK' },
      state,
    }).error).toBe('not-your-pick');
  });

  it('blocks player from opening draft / politics', () => {
    const state = createEmptyGameState();
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'OPEN_DRAFT' },
      state,
    }).error).toBe('forbidden');
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'SET_POLITICS_VISIBLE', visible: true },
      state,
    }).error).toBe('forbidden');
  });

  it('lets a player end only their own turn', () => {
    let state = normalizeGameState({
      isGameActive: true,
      players: [
        { ...player(1, 'A'), cards: [{ id: 1, name: 'Leadership' }] },
        { ...player(2, 'B'), cards: [{ id: 2, name: 'Diplomacy' }] },
      ],
      speakerId: 1,
    });
    state = {
      ...state,
      round: {
        ...state.round,
        active: true,
        turnOrderIds: [1, 2],
        activeTurnIdx: 0,
        passed: {},
      },
    };

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'NEXT_TURN' },
      state,
    }).ok).toBe(true);
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'NEXT_TURN' },
      state,
    }).error).toBe('not-your-turn');
  });

  it('allows TOGGLE_COMPLETION only for own seat', () => {
    const state = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
    });
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'TOGGLE_COMPLETION', playerId: 1, objectiveId: 'o1' },
      state,
    }).ok).toBe(true);
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'TOGGLE_COMPLETION', playerId: 2, objectiveId: 'o1' },
      state,
    }).error).toBe('not-your-objective');
  });
});

describe('can (UI capabilities)', () => {
  it('admin gets all', () => {
    expect(can(ROLES.ADMIN, 'phases')).toBe(true);
    expect(can(ROLES.ADMIN, 'scoreSelf')).toBe(true);
  });

  it('viewer gets none', () => {
    expect(can(ROLES.VIEWER, 'draftPick')).toBe(false);
    expect(can(ROLES.VIEWER, 'scoreSelf')).toBe(false);
  });

  it('player gets pick / play / nextTurn / scoreSelf only', () => {
    expect(can(ROLES.PLAYER, 'draftPick')).toBe(true);
    expect(can(ROLES.PLAYER, 'playTurn')).toBe(true);
    expect(can(ROLES.PLAYER, 'nextTurn')).toBe(true);
    expect(can(ROLES.PLAYER, 'scoreSelf')).toBe(true);
    expect(can(ROLES.PLAYER, 'phases')).toBe(false);
    expect(can(ROLES.PLAYER, 'politics')).toBe(false);
    expect(can(ROLES.PLAYER, 'confirmDraft')).toBe(false);
  });
});
