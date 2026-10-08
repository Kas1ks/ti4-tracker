import { describe, expect, it } from 'vitest';
import { shouldApplySeq, softAuthorizeOptimistic } from './seqGate.js';
import { authorizeAction, ROLES } from './permissions.js';
import { createEmptyGameState } from '../game/gameState.js';

describe('seqGate', () => {
  it('rejects older sequences', () => {
    expect(shouldApplySeq(4, 5)).toBe(false);
    expect(shouldApplySeq(5, 5)).toBe(true);
    expect(shouldApplySeq(6, 5)).toBe(true);
  });

  it('accepts missing seq as apply', () => {
    expect(shouldApplySeq(undefined, 3)).toBe(true);
  });
});

describe('softAuthorizeOptimistic', () => {
  it('blocks player PASS_TURN when not their turn', () => {
    const state = {
      ...createEmptyGameState(),
      isGameActive: true,
      players: [
        { id: 1, name: 'A', factionId: 'sol', eliminated: false, secrets: 0, extra: 0 },
        { id: 2, name: 'B', factionId: 'hacan', eliminated: false, secrets: 0, extra: 0 },
      ],
      meta: { ...createEmptyGameState().meta, speakerId: 1 },
      round: {
        ...createEmptyGameState().round,
        active: true,
        activePlayerId: 1,
        passed: {},
        strategyActionTaken: false,
      },
    };
    const auth = authorizeAction({
      role: ROLES.PLAYER,
      seatPlayerId: 2,
      action: { type: 'PASS_TURN', playerId: 2 },
      state,
    });
    const soft = softAuthorizeOptimistic(auth);
    expect(soft.ok).toBe(false);
  });

  it('allows ok auth through', () => {
    expect(softAuthorizeOptimistic({ ok: true })).toEqual({ ok: true });
  });
});
