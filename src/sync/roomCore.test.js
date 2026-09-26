import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from '../game/gameState.js';
import {
  applyRoomAction,
  createRoomRecord,
  hydrateRoomLifecycle,
  isRoomExpired,
  joinRoom,
  releaseSeat,
  touchRoomActivity,
  ROOM_ENDED_TTL_MS,
  ROOM_IDLE_TTL_MS,
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
    expect(room.createdAt).toBeTruthy();
    expect(room.lastActivityAt).toBeTruthy();
    expect(room.expiresAt).toBeTruthy();
    expect(Date.parse(room.expiresAt) - Date.parse(room.lastActivityAt))
      .toBe(ROOM_IDLE_TTL_MS);
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

  it('lets a player release their own seat on leave', () => {
    let room = createRoomRecord(normalizeGameState({
      players: [player(1, 'A'), player(2, 'B')],
    }));
    const a = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    room = a.room;
    const b = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 2 });
    room = b.room;

    const denied = releaseSeat(room, 1, { sessionToken: b.sessionToken });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('forbidden');

    const self = releaseSeat(room, 1, { sessionToken: a.sessionToken });
    expect(self.ok).toBe(true);
    expect(self.room.seatClaims[1]).toBeUndefined();
    expect(self.room.seatSecrets[1]).toBeUndefined();
    expect(self.room.sessions[a.sessionToken]).toBeUndefined();
    expect(self.room.seatClaims[2]).toBe(b.sessionToken);

    const reclaim = joinRoom(self.room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    expect(reclaim.ok).toBe(true);
    expect(reclaim.reclaimed).toBe(false);
  });

  it('ends the party for everyone and clears seat claims on RESET_GAME', () => {
    let room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
    }));
    const joined = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    room = joined.room;

    const ended = applyRoomAction(room, { type: 'RESET_GAME' }, { hostKey: room.hostKey });
    expect(ended.ok).toBe(true);
    expect(ended.roomEnded).toBe(true);
    expect(ended.room.state.isGameActive).toBe(false);
    expect(ended.room.seatClaims).toEqual({});
    expect(ended.room.seatSecrets).toEqual({});
    expect(ended.room.sessions[joined.sessionToken]).toBeUndefined();
    expect(Object.values(ended.room.sessions).every(s => s.role === ROLES.ADMIN)).toBe(true);
  });

  it('kicks the seated player when the host removes that seat', () => {
    let room = createRoomRecord(normalizeGameState({
      players: [player(1, 'A'), player(2, 'B')],
    }));
    const joined = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    room = joined.room;

    const removed = applyRoomAction(room, { type: 'REMOVE_PLAYER', playerId: 1 }, { hostKey: room.hostKey });
    expect(removed.ok).toBe(true);
    expect(removed.seatRemoved).toBe(true);
    expect(removed.revokedSessionToken).toBe(joined.sessionToken);
    expect(removed.room.state.players.find(p => p.id === 1)).toBeUndefined();
    expect(removed.room.seatClaims[1]).toBeUndefined();
    expect(removed.room.sessions[joined.sessionToken]).toBeUndefined();
  });

  it('tracks activity TTL and shortens it after RESET_GAME', () => {
    const t0 = Date.parse('2026-01-01T12:00:00.000Z');
    let room = touchRoomActivity(createRoomRecord(), { now: t0 });
    expect(Date.parse(room.expiresAt)).toBe(t0 + ROOM_IDLE_TTL_MS);

    room = touchRoomActivity(room, { now: t0 + 60_000 });
    expect(Date.parse(room.lastActivityAt)).toBe(t0 + 60_000);
    expect(Date.parse(room.expiresAt)).toBe(t0 + 60_000 + ROOM_IDLE_TTL_MS);

    const ended = applyRoomAction(room, { type: 'RESET_GAME' }, { hostKey: room.hostKey });
    expect(ended.ok).toBe(true);
    const endedAt = Date.parse(ended.room.lastActivityAt);
    expect(Date.parse(ended.room.expiresAt) - endedAt).toBe(ROOM_ENDED_TTL_MS);
  });

  it('lets the host undo pass and strategy play via UNDO_LAST', () => {
    let room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      players: [
        {
          ...player(1, 'A'),
          cards: [{ id: 1, name: 'Leadership' }],
          strategyPlayed: true,
          playedCardIds: [1],
        },
        {
          ...player(2, 'B'),
          cards: [{ id: 2, name: 'Diplomacy' }],
          strategyPlayed: false,
          playedCardIds: [],
        },
      ],
      meta: { ...createEmptyGameState().meta, speakerId: 1 },
      round: {
        ...createEmptyGameState().round,
        active: true,
        turnOrderIds: [1, 2],
        activeTurnIdx: 0,
        passed: {},
      },
    }));
    const auth = { hostKey: room.hostKey };

    const passed = applyRoomAction(room, { type: 'PASS_TURN', playerId: 1 }, auth);
    expect(passed.ok).toBe(true);
    expect(passed.noop).toBe(false);
    expect(passed.canUndo).toBe(true);
    expect(passed.room.state.round.passed[1]).toBe(true);
    room = passed.room;

    const undone = applyRoomAction(room, { type: 'UNDO_LAST' }, auth);
    expect(undone.ok).toBe(true);
    expect(undone.noop).toBe(false);
    expect(undone.room.state.round.passed[1]).toBeFalsy();
    expect(undone.room.state.round.activeTurnIdx).toBe(0);
    expect(undone.canUndo).toBe(false);
    room = undone.room;

    const empty = applyRoomAction(room, { type: 'UNDO_LAST' }, auth);
    expect(empty.ok).toBe(true);
    expect(empty.noop).toBe(true);

    // Strategy play must also be undoable.
    room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      players: [
        {
          ...player(1, 'A'),
          cards: [{ id: 1, name: 'Leadership' }],
          strategyPlayed: false,
          playedCardIds: [],
        },
        {
          ...player(2, 'B'),
          cards: [{ id: 2, name: 'Diplomacy' }],
          strategyPlayed: false,
          playedCardIds: [],
        },
      ],
      meta: { ...createEmptyGameState().meta, speakerId: 1 },
      round: {
        ...createEmptyGameState().round,
        active: true,
        turnOrderIds: [1, 2],
        activeTurnIdx: 0,
        passed: {},
        strategyActionTaken: false,
      },
    }));
    const played = applyRoomAction(room, { type: 'PLAY_STRATEGY', playerId: 1, cardId: 1 }, { hostKey: room.hostKey });
    expect(played.ok).toBe(true);
    expect(played.noop).toBe(false);
    expect(played.canUndo).toBe(true);
    expect(played.room.state.round.strategyActionTaken).toBe(true);

    const undoPlay = applyRoomAction(played.room, { type: 'UNDO_LAST' }, { hostKey: room.hostKey });
    expect(undoPlay.ok).toBe(true);
    expect(undoPlay.room.state.round.strategyActionTaken).toBe(false);
    const restored = undoPlay.room.state.players.find(p => p.id === 1);
    expect(restored.strategyPlayed).toBe(false);
    expect(restored.playedCardIds || []).not.toContain(1);
  });

  it('forbids players from UNDO_LAST', () => {
    let room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      players: [player(1, 'A'), player(2, 'B')],
    }));
    const joined = joinRoom(room, { role: ROLES.PLAYER, seatPlayerId: 1 });
    expect(joined.ok).toBe(true);
    room = joined.room;
    // Seed undo stack with a host action first
    room = applyRoomAction(room, { type: 'ADJUST_SECRETS', playerId: 1, delta: 1 }, { hostKey: room.hostKey }).room;
    const denied = applyRoomAction(room, { type: 'UNDO_LAST' }, { sessionToken: joined.sessionToken });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('forbidden');
  });

  it('hydrates legacy rooms and detects expiry', () => {
    const legacy = {
      roomId: 'ABCDEF',
      hostKey: 'hk',
      seq: 1,
      state: createEmptyGameState(),
      sessions: {},
      seatClaims: {},
      seatSecrets: {},
      updatedAt: '2020-01-01T00:00:00.000Z',
    };
    const hydrated = hydrateRoomLifecycle(legacy, Date.parse('2020-01-01T00:00:00.000Z'));
    expect(hydrated.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(hydrated.expiresAt).toBeTruthy();
    expect(isRoomExpired(hydrated, Date.parse('2020-01-03T00:00:00.000Z'))).toBe(true);
    expect(isRoomExpired(hydrated, Date.parse('2020-01-01T01:00:00.000Z'))).toBe(false);
  });
});
