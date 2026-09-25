import { describe, expect, it } from 'vitest';
import { GAME_STATE_VERSION, migrateGameState } from './migrations';
import { parseRoomActionResult, parseRoomPublicView } from '../sync/roomContract';

describe('migrateGameState', () => {
  it('adds expeditionClaimedSliceId when upgrading v1 docs', () => {
    const next = migrateGameState({
      version: 1,
      isGameActive: true,
      round: { expeditionClaimedThisTurn: true },
    });
    expect(next.version).toBe(GAME_STATE_VERSION);
    expect(next.round).toMatchObject({
      expeditionClaimedThisTurn: true,
      expeditionClaimedSliceId: null,
    });
  });

  it('is a no-op for current version', () => {
    const raw = {
      version: GAME_STATE_VERSION,
      round: { expeditionClaimedThisTurn: false, expeditionClaimedSliceId: 'resources' },
    };
    expect(migrateGameState(raw)).toEqual(raw);
  });
});

describe('roomContract parsers', () => {
  it('accepts a minimal public view', () => {
    const view = parseRoomPublicView({
      roomId: 'ABC123',
      seq: 4,
      state: { version: 2, isGameActive: true },
      claimedSeats: [1],
      canUndo: true,
    });
    expect(view).toMatchObject({
      roomId: 'ABC123',
      seq: 4,
      canUndo: true,
      claimedSeats: [1],
    });
  });

  it('rejects garbage snapshots', () => {
    expect(parseRoomPublicView(null)).toBeNull();
    expect(parseRoomPublicView({ roomId: 'X' })).toBeNull();
    expect(parseRoomActionResult({ seq: 1 })).toBeNull();
  });
});
