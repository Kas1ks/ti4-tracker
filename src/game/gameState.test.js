import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_OBJECTIVES } from '../data/gameData';
import {
  DEFAULT_TARGET_SCORE,
  GAME_STATE_KEY,
  GAME_STATE_VERSION,
  clearGameState,
  createEmptyGameState,
  loadGameState,
  normalizeGameState,
  rehydrateTurnOrder,
  saveGameState,
  stampGameState,
} from './gameState';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
};

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

const player = (id, name) => ({
  id, name, factionId: 'sol', color: 'blue', secrets: 0, extra: 0,
  passed: false, strategyPlayed: false, eliminated: false, cards: [],
});

describe('createEmptyGameState', () => {
  it('is already normalized and deals a fresh objective deck each time', () => {
    const blank = createEmptyGameState();
    expect(normalizeGameState(blank)).toEqual(blank);
    expect(blank.objectives.stage1Deck).not.toEqual(createEmptyGameState().objectives.stage1Deck);
  });
});

describe('normalizeGameState', () => {
  it('returns a usable document for junk input', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      const state = normalizeGameState(junk);
      expect(state.version).toBe(GAME_STATE_VERSION);
      expect(state.isGameActive).toBe(false);
      expect(state.meta.targetScore).toBe(DEFAULT_TARGET_SCORE);
      expect(state.players).toEqual([]);
      expect(state.objectives.stage1Deck.length).toBeGreaterThan(0);
      expect(state.round.turnOrderIds).toEqual([]);
    }
  });

  it('is idempotent', () => {
    const once = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
      turnOrder: [player(2, 'B'), player(1, 'A')],
      roundNumber: 4,
      passed: { 1: true },
    });
    expect(normalizeGameState(once)).toEqual(once);
  });

  it('keeps empty expedition slices as null (not player 0)', () => {
    const state = normalizeGameState(createEmptyGameState());
    expect(state.expedition.slices.resources).toBeNull();
    expect(Object.values(state.expedition.slices).every(v => v === null)).toBe(true);
    expect(state.expedition.controllerId).toBeNull();
    expect(state.expedition.placedById).toBeNull();
  });

  it('reads a legacy flat snapshot', () => {
    const state = normalizeGameState({
      targetScore: 14,
      roundNumber: 3,
      usePok: true,
      players: [player(1, 'A'), player(2, 'B')],
      turnOrder: [player(2, 'B'), player(1, 'A')],
      draftQueue: [1, 2],
      draftStep: 'CONFIRM',
      speakerId: 2,
      timestamp: '01.01.2026, 12:00:00',
    });

    expect(state.meta).toMatchObject({ targetScore: 14, roundNumber: 3, usePok: true, speakerId: 2 });
    expect(state.round.turnOrderIds).toEqual([2, 1]);
    expect(state.draft.step).toBe('CONFIRM');
    expect(state.draft.showModal).toBe(true);
    expect(state.updatedAt).toBe('01.01.2026, 12:00:00');
  });

  it('drops turn order entries for players that no longer exist', () => {
    const state = normalizeGameState({
      players: [player(1, 'A')],
      turnOrderIds: [1, 7, 9],
    });
    expect(state.round.turnOrderIds).toEqual([1]);
  });

  it('drops objectives removed from game data but keeps custom ones', () => {
    const state = normalizeGameState({
      objectives: [
        { id: BASE_OBJECTIVES[0].id, stage: BASE_OBJECTIVES[0].stage },
        { id: 'custom_my_goal', stage: 1 },
        { id: 'deleted_in_a_patch', stage: 2 },
        null,
      ],
    });
    expect(state.objectives.active.map(o => o.id)).toEqual([BASE_OBJECTIVES[0].id, 'custom_my_goal']);
  });

  it('never resumes the draft modal with an empty queue', () => {
    expect(normalizeGameState({ draftQueue: [], showDraftModal: true }).draft.showModal).toBe(false);
    expect(normalizeGameState({ draftQueue: [1], showDraftModal: false }).draft.showModal).toBe(false);
  });

  it('keeps agenda votes and status phase checks', () => {
    const state = normalizeGameState({
      politics: {
        showModal: true,
        step: 'VOTE',
        agendas: [{ type: 'law', votes: { 1: 4 }, locked: { 1: true } }],
        currentAgendaIndex: 0,
      },
      statusPhase: { checks: { drawActionCards: true } },
    });
    expect(state.politics.agendas[0].votes).toEqual({ 1: 4 });
    expect(state.statusPhase.checks).toMatchObject({ drawActionCards: true, scoreObjectives: false });
  });
});

describe('stampGameState', () => {
  it('records when the document was saved without changing anything else', () => {
    const state = normalizeGameState({ players: [player(1, 'A')], roundNumber: 3 });
    const stamped = stampGameState(state);

    expect(stamped.updatedAt).toBeTruthy();
    expect({ ...stamped, updatedAt: null }).toEqual({ ...state, updatedAt: null });
  });
});

describe('rehydrateTurnOrder', () => {
  it('resolves stored ids against the current players', () => {
    const players = [player(1, 'A'), player(2, 'B')];
    expect(rehydrateTurnOrder(players, [2, 1])).toEqual([players[1], players[0]]);
  });

  it('reflects later player changes instead of a stale copy', () => {
    const updated = [{ ...player(1, 'A'), strategyPlayed: true }];
    expect(rehydrateTurnOrder(updated, [1])[0].strategyPlayed).toBe(true);
  });

  it('drops ids with no matching player', () => {
    expect(rehydrateTurnOrder([player(1, 'A')], [1, 42])).toHaveLength(1);
  });
});

describe('persistence', () => {
  it('round-trips through a single storage key', () => {
    const state = stampGameState(normalizeGameState({
      isGameActive: true, players: [player(1, 'A')], roundNumber: 5,
    }));
    saveGameState(state);

    expect(localStorage.size).toBe(1);
    expect(localStorage.getItem(GAME_STATE_KEY)).toBeTruthy();
    expect(loadGameState()).toEqual(state);
  });

  it('migrates pre-Prep-A keys and removes them', () => {
    localStorage.setItem('ti4_active', 'true');
    localStorage.setItem('ti4_round', '7');
    localStorage.setItem('ti4_targetScore', '14');
    localStorage.setItem('ti4_players', JSON.stringify([player(1, 'A')]));
    localStorage.setItem('ti4_roundActive', 'true');

    const state = loadGameState();
    expect(state.isGameActive).toBe(true);
    expect(state.meta.roundNumber).toBe(7);
    expect(state.meta.targetScore).toBe(14);
    expect(state.players).toHaveLength(1);
    expect(state.round.active).toBe(true);

    expect(localStorage.getItem('ti4_players')).toBeNull();
    expect(localStorage.size).toBe(1);
    expect(loadGameState()).toEqual(state);
  });

  it('falls back to an empty game when storage is corrupted', () => {
    localStorage.setItem(GAME_STATE_KEY, '{not json');
    const state = loadGameState();
    expect(state.version).toBe(GAME_STATE_VERSION);
    expect(state.isGameActive).toBe(false);
    expect(state.players).toEqual([]);
  });

  it('clears the document and the finished-game record', () => {
    saveGameState(stampGameState(createEmptyGameState()));
    localStorage.setItem('ti4_gameSummary', '{}');
    localStorage.setItem('ti4_round', '3');

    clearGameState();
    expect(localStorage.size).toBe(0);
  });
});
