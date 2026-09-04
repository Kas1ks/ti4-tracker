import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from '../game/gameState.js';
import {
  applyRoomAction,
  createRoomRecord,
  LOCAL_ONLY_ACTIONS,
} from '../../worker/rooms/roomCore.js';

const player = (id, name) => ({
  id, name, factionId: 'sol', color: '#3b82f6', secrets: 0, extra: 0,
  totalTime: 0, damageDealt: 0, eliminated: false, cards: [],
});

describe('roomCore', () => {
  it('creates a room with a code and host key', () => {
    const room = createRoomRecord();
    expect(room.roomId).toMatch(/^[A-Z0-9]{6}$/);
    expect(room.hostKey).toBeTruthy();
    expect(room.seq).toBe(0);
    expect(room.state.isGameActive).toBe(false);
  });

  it('seeds a room from an existing document', () => {
    const state = normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
      roundNumber: 3,
    });
    const room = createRoomRecord(state);
    expect(room.state.meta.roundNumber).toBe(3);
    expect(room.state.players).toHaveLength(2);
  });

  it('applies game actions and bumps seq when authorized as host', () => {
    let room = createRoomRecord(createEmptyGameState());
    const auth = { hostKey: room.hostKey };
    const first = applyRoomAction(room, { type: 'ADD_PLAYER', playerId: 1, factionId: 'sol' }, auth);
    expect(first.ok).toBe(true);
    expect(first.room.seq).toBe(1);
    expect(first.room.state.players).toHaveLength(1);

    const second = applyRoomAction(first.room, { type: 'ADD_PLAYER', playerId: 2, factionId: 'hacan' }, auth);
    expect(second.room.seq).toBe(2);
    expect(second.room.state.players).toHaveLength(2);
  });

  it('rejects unauthorized actions', () => {
    const room = createRoomRecord();
    expect(applyRoomAction(room, { type: 'ADD_PLAYER', playerId: 1 }).error).toBe('unauthorized');
  });

  it('rejects local-only actions like TICK', () => {
    const room = createRoomRecord();
    expect(LOCAL_ONLY_ACTIONS.has('TICK')).toBe(true);
    const result = applyRoomAction(room, { type: 'TICK' }, { hostKey: room.hostKey });
    expect(result).toEqual({ ok: false, error: 'local-only-action' });
  });

  it('rejects garbage actions', () => {
    const room = createRoomRecord();
    expect(applyRoomAction(room, null).error).toBe('invalid-action');
    expect(applyRoomAction(room, { foo: 1 }, { hostKey: room.hostKey }).error).toBe('invalid-action');
  });
});
