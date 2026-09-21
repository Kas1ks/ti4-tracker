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

  it('blocks direct TOGGLE_COMPLETION for players — scoring window only', () => {
    const state = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
    });
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'TOGGLE_COMPLETION', playerId: 1, objectiveId: 'o1' },
      state,
    }).error).toBe('use-scoring-window');
  });

  it('allows scoring-window actions only for own seat while pending', () => {
    let state = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
      showStatusPhase: true,
    });
    state = gameReducer(state, { type: 'START_OBJECTIVE_SCORING' });

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'SELECT_SCORING_PUBLIC', playerId: 1, objectiveId: 'o1' },
      state,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'SELECT_SCORING_PUBLIC', playerId: 2, objectiveId: 'o1' },
      state,
    }).error).toBe('not-your-objective');

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'CONFIRM_OBJECTIVE_SCORING', playerId: 1 },
      state,
    }).ok).toBe(true);
  });

  it('blocks PASS_TURN off-turn or before strategies are played', () => {
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
      seatPlayerId: 2,
      action: { type: 'PASS_TURN', playerId: 2 },
      state,
    }).error).toBe('not-your-turn');

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'PASS_TURN', playerId: 1 },
      state,
    }).error).toBe('strategy-required');

    state = {
      ...state,
      players: state.players.map(p => (
        p.id === 1 ? { ...p, playedCardIds: [1], strategyPlayed: true } : p
      )),
    };
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'PASS_TURN', playerId: 1 },
      state,
    }).ok).toBe(true);
  });

  it('limits SET_SPEAKER for players to politics handoff or Politics card', () => {
    let state = normalizeGameState({
      isGameActive: true,
      players: [
        { ...player(1, 'A'), cards: [{ id: 1, name: 'Leadership' }] },
        { ...player(2, 'B'), cards: [{ id: 3, name: 'Politics' }] },
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
      action: { type: 'SET_SPEAKER', playerId: 2 },
      state,
    }).error).toBe('forbidden');

    state = { ...state, round: { ...state.round, activeTurnIdx: 1 } };
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'SET_SPEAKER', playerId: 1 },
      state,
    }).ok).toBe(true);

    state = {
      ...state,
      politics: { ...state.politics, showModal: true },
      round: { ...state.round, activeTurnIdx: 0 },
      meta: { ...state.meta, speakerId: 1 },
    };
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'SET_SPEAKER', playerId: 2 },
      state,
    }).ok).toBe(true);
  });

  it('allows expedition claim on own turn when TE is on', () => {
    let state = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
      speakerId: 1,
      useTe: true,
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
      action: { type: 'CLAIM_EXPEDITION_SLICE', playerId: 1, sliceId: 'resources' },
      state,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'CLAIM_EXPEDITION_SLICE', playerId: 2, sliceId: 'resources' },
      state,
    }).ok).toBe(false);

    state = {
      ...state,
      expedition: {
        ...state.expedition,
        awaitingControlPick: true,
        placedById: 1,
      },
    };
    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'RESOLVE_THUNDERS_EDGE_CONTROL', playerId: 1, controllerId: 2 },
      state,
    }).ok).toBe(true);
  });

  it('allows tech research only for pending seats during Technology resolution', () => {
    const state = {
      ...createEmptyGameState(),
      isGameActive: true,
      players: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      round: {
        ...createEmptyGameState().round,
        strategyResolution: {
          active: true,
          cardId: 7,
          playerId: 1,
          responses: { 1: 'pending', 2: 'pending' },
        },
        techResearch: {
          active: true,
          concurrent: true,
          primaryPlayerId: 1,
          byPlayer: {},
          picks: [],
          queueIds: [],
        },
      },
    };

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'RESEARCH_TECH', playerId: 1, techId: 'neural_motivator' },
      state,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'RESEARCH_TECH', playerId: 1, techId: 'neural_motivator' },
      state,
    }).ok).toBe(false);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'RESEARCH_TECH', playerId: 2, techId: 'neural_motivator' },
      state,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'TOGGLE_TECH', playerId: 2, techId: 'neural_motivator' },
      state,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'TOGGLE_TECH', playerId: 1, techId: 'neural_motivator' },
      state,
    }).ok).toBe(false);
  });

  it('lets a seated player pick and confirm starting techs during an active draft', () => {
    const live = createEmptyGameState();
    live.isGameActive = true;
    live.players = [
      { id: 1, name: 'A', factionId: 'argent', color: '#fff' },
      { id: 2, name: 'B', factionId: 'sol', color: '#000' },
    ];
    live.startingTechDraft = {
      needed: true,
      active: true,
      responses: {
        1: { status: 'waiting', picks: [] },
      },
    };

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: {
        type: 'SET_STARTING_TECH_PICK',
        playerId: 1,
        picks: ['neural_motivator', 'plasma_scoring'],
      },
      state: live,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: {
        type: 'SET_STARTING_TECH_PICK',
        playerId: 2,
        picks: ['neural_motivator'],
      },
      state: live,
    }).error).toBe('not-your-starting-tech');

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: { type: 'CONFIRM_STARTING_TECH', playerId: 1 },
      state: live,
    }).ok).toBe(true);

    expect(authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 1,
      action: {
        type: 'UPDATE_PLAYER',
        playerId: 1,
        patch: { startingTechIds: ['neural_motivator', 'plasma_scoring'] },
      },
      state: live,
    }).ok).toBe(false);
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
