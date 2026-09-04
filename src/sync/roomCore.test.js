import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from '../game/gameState.js';
import {
  applyRoomAction,
  createRoomRecord,
  joinRoom,
  releaseSeat,
  LOCAL_ONLY_ACTIONS,
} from '../../worker/rooms/roomCore.js';
import { ROLES } from './permissions.js';

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

  it('lets a player reclaim a taken seat only with the seat secret', () => {
    let room = createRoomRecord(normalizeGameState({
      players: [player(1, 'A'), player(2, 'B')],
    }));

    const first = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    expect(first.ok).toBe(true);
    expect(first.reclaimed).toBe(false);
    expect(first.seatSecret).toMatch(/^[A-Z0-9]{4}$/);
    room = first.room;
    const oldToken = first.sessionToken;
    const secret = first.seatSecret;

    const denied = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('seat-secret-required');

    const wrong = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1, seatSecret: 'XXXX' });
    expect(wrong.ok).toBe(false);
    expect(wrong.error).toBe('bad-seat-secret');

    const second = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1, seatSecret: secret });
    expect(second.ok).toBe(true);
    expect(second.reclaimed).toBe(true);
    expect(second.revokedSessionToken).toBe(oldToken);
    expect(second.sessionToken).not.toBe(oldToken);
    expect(second.seatSecret).toBe(secret);
    expect(second.room.sessions[oldToken]).toBeUndefined();
    expect(second.room.seatClaims[1]).toBe(second.sessionToken);

    const stale = applyRoomAction(second.room, { type: 'NEXT_TURN' }, { sessionToken: oldToken });
    expect(stale.ok).toBe(false);
    expect(stale.error).toBe('unauthorized');
  });

  it('lets the host release a seat and clear its secret', () => {
    let room = createRoomRecord(normalizeGameState({
      players: [player(1, 'A')],
    }));
    const joined = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    room = joined.room;

    const released = releaseSeat(room, 1, { hostKey: room.hostKey });
    expect(released.ok).toBe(true);
    expect(released.revokedSessionToken).toBe(joined.sessionToken);
    expect(released.room.seatClaims[1]).toBeUndefined();
    expect(released.room.seatSecrets[1]).toBeUndefined();

    const again = joinRoom(released.room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    expect(again.ok).toBe(true);
    expect(again.reclaimed).toBe(false);
    expect(again.seatSecret).not.toBe(joined.seatSecret);
  });
});
