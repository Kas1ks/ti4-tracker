import { describe, expect, it } from 'vitest';
import {
  MAX_GAME_EVENTS,
  appendGameEvents,
  deriveGameEvents,
  formatGameEvent,
  reduceGame,
} from './gameEvents';
import { createEmptyGameState, normalizeGameState } from './gameState';

const player = (id, name, overrides = {}) => ({
  id,
  name,
  factionId: 'sol',
  color: '#3b82f6',
  secrets: 0,
  extra: 0,
  totalTime: 0,
  damageDealt: 0,
  eliminated: false,
  cards: [],
  ...overrides,
});

const gameWith = (players, overrides = {}) => normalizeGameState({
  ...createEmptyGameState(),
  isGameActive: true,
  players,
  meta: { ...createEmptyGameState().meta, speakerId: players[0]?.id ?? null },
  ...overrides,
});

describe('deriveGameEvents', () => {
  it('emits GAME_STARTED on START_GAME', () => {
    const prev = createEmptyGameState();
    const next = { ...prev, isGameActive: true };
    const events = deriveGameEvents(prev, { type: 'START_GAME', at: 1000 }, next);
    expect(events).toEqual([{ type: 'GAME_STARTED', at: 1000 }]);
  });

  it('emits ROUND_STARTED with round number', () => {
    const players = [player(1, 'A'), player(2, 'B')];
    const prev = gameWith(players, {
      round: {
        ...createEmptyGameState().round,
        active: false,
      },
      meta: { ...createEmptyGameState().meta, speakerId: 1, roundNumber: 2 },
      draft: {
        ...createEmptyGameState().draft,
        assignments: { 1: 1, 2: 2 },
      },
    });
    const next = {
      ...prev,
      meta: { ...prev.meta, roundNumber: 3 },
      round: { ...prev.round, active: true },
    };
    const events = deriveGameEvents(prev, { type: 'START_ROUND', at: 42 }, next);
    expect(events[0]).toMatchObject({ type: 'ROUND_STARTED', roundNumber: 3, at: 42 });
  });

  it('emits TURN_STARTED when active seat changes', () => {
    const players = [
      player(1, 'A', { cards: [{ id: 1 }] }),
      player(2, 'B', { cards: [{ id: 2 }] }),
    ];
    const prev = gameWith(players, {
      round: {
        ...createEmptyGameState().round,
        active: true,
        turnOrderIds: [1, 2],
        activeTurnIdx: 0,
        passed: {},
      },
    });
    const next = {
      ...prev,
      round: { ...prev.round, activeTurnIdx: 1 },
    };
    const events = deriveGameEvents(prev, { type: 'NEXT_TURN', at: 5 }, next);
    expect(events).toEqual([{
      type: 'TURN_STARTED',
      at: 5,
      playerId: 2,
      fromPlayerId: 1,
    }]);
  });

  it('returns nothing when state is unchanged', () => {
    const state = createEmptyGameState();
    expect(deriveGameEvents(state, { type: 'NOPE' }, state)).toEqual([]);
  });
});

describe('appendGameEvents / reduceGame', () => {
  it('caps the log at MAX_GAME_EVENTS', () => {
    let state = createEmptyGameState();
    const flood = Array.from({ length: MAX_GAME_EVENTS + 25 }, (_, i) => ({
      type: 'ROUND_STARTED',
      at: i,
      roundNumber: i,
    }));
    state = appendGameEvents(state, flood);
    expect(state.log.events).toHaveLength(MAX_GAME_EVENTS);
    expect(state.log.events[0].at).toBe(25);
  });

  it('RESET_GAME replaces the log with a single reset event', () => {
    const players = [player(1, 'Host')];
    let state = gameWith(players);
    state = appendGameEvents(state, [{ type: 'GAME_STARTED', at: 1 }]);
    state = reduceGame(state, { type: 'RESET_GAME', at: 99 });
    expect(state.log.events).toEqual([{ type: 'GAME_RESET', at: 99 }]);
    expect(state.isGameActive).toBe(false);
  });

  it('normalizeGameState keeps log.events', () => {
    const raw = {
      ...createEmptyGameState(),
      log: { events: [{ type: 'GAME_STARTED', at: 10 }] },
    };
    const normalized = normalizeGameState(raw);
    expect(normalized.log.events).toEqual([{ type: 'GAME_STARTED', at: 10 }]);
  });
});

describe('formatGameEvent', () => {
  const players = [player(1, 'Алекс'), player(2, 'Боря')];

  it('formats known events in Russian', () => {
    expect(formatGameEvent({ type: 'GAME_STARTED' }, players)).toBe('Партия начата');
    expect(formatGameEvent({ type: 'PLAYER_PASSED', playerId: 1 }, players)).toBe('Алекс пасует');
    expect(formatGameEvent({ type: 'STRATEGY_PLAYED', playerId: 2, cardId: 6 }, players))
      .toBe('Боря сыграл «Война»');
    expect(formatGameEvent({
      type: 'EXPEDITION_SLICE_CLAIMED',
      playerId: 1,
      breakthrough: true,
    }, players)).toBe('Алекс занял слот экспедиции · прорыв');
    expect(formatGameEvent({
      type: 'EXPEDITION_COMPLETED',
      controllerId: 2,
    }, players)).toBe('Грозовой рубеж: контроль у Боря');
    expect(formatGameEvent({
      type: 'TECH_GAINED',
      playerId: 1,
      techId: 'sarween_tools',
      byHost: true,
    }, players)).toBe('Хост выдал Sarween Tools → Алекс');
    expect(formatGameEvent({
      type: 'TECH_REMOVED',
      playerId: 2,
      techId: 'neural_motivator',
      byHost: true,
    }, players)).toBe('Хост снял Neural Motivator у Боря');
  });
});

describe("Thunder's Edge expedition events", () => {
  const slices = ['resources', 'actionCards', 'influence', 'secret', 'techPlanet', 'tradeGoods'];

  const withTe = (players) => normalizeGameState({
    ...createEmptyGameState(),
    isGameActive: true,
    players,
    meta: {
      ...createEmptyGameState().meta,
      speakerId: players[0]?.id ?? null,
      useTe: true,
    },
    round: {
      ...createEmptyGameState().round,
      active: true,
      turnOrderIds: players.map(p => p.id),
      activeTurnIdx: 0,
      passed: {},
    },
  });

  it('logs slice claim, pending control, and completion', () => {
    let state = withTe([player(1, 'A'), player(2, 'B')]);
    state = reduceGame(state, { type: 'CLAIM_EXPEDITION_SLICE', playerId: 1, sliceId: 'resources', at: 10 });
    expect(state.log.events.at(-1)).toMatchObject({
      type: 'EXPEDITION_SLICE_CLAIMED',
      playerId: 1,
      breakthrough: true,
      at: 10,
    });

    const owners = [1, 2, 1, 2, 1, 2];
    owners.forEach((pid, i) => {
      if (i === 0) return; // already claimed resources as 1
      state = {
        ...state,
        round: {
          ...state.round,
          activeTurnIdx: state.round.turnOrderIds.indexOf(pid),
          expeditionClaimedThisTurn: false,
        },
      };
      state = reduceGame(state, {
        type: 'CLAIM_EXPEDITION_SLICE',
        playerId: pid,
        sliceId: slices[i],
        at: 20 + i,
      });
    });
    expect(state.expedition.awaitingControlPick).toBe(true);
    expect(state.log.events.at(-1).type).toBe('EXPEDITION_CONTROL_PENDING');

    state = reduceGame(state, {
      type: 'RESOLVE_THUNDERS_EDGE_CONTROL',
      playerId: 2,
      controllerId: 2,
      at: 99,
    });
    expect(state.log.events.at(-1)).toMatchObject({
      type: 'EXPEDITION_COMPLETED',
      controllerId: 2,
      at: 99,
    });
  });
});
