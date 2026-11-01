import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from './gameState';
import { isVictoryReached, resolveStatsWinner, victoryWinners } from './victory';

function stateWithScores(rows, targetScore = 10) {
  const base = createEmptyGameState();
  return normalizeGameState({
    ...base,
    isGameActive: true,
    meta: { ...base.meta, targetScore },
    players: rows.map((r, i) => ({
      id: r.id ?? i + 1,
      name: r.name,
      factionId: 'sol',
      secrets: r.secrets ?? 0,
      extra: r.extra ?? 0,
      eliminated: !!r.eliminated,
      cards: [],
      techIds: [],
    })),
    objectives: {
      active: [],
      completions: {},
      stage1Deck: [],
      stage2Deck: [],
    },
    vpTrack: { custodiansPlayerId: null, supportHolders: {} },
  });
}

describe('resolveStatsWinner', () => {
  it('returns null when nobody reached target (even if someone leads)', () => {
    const state = stateWithScores([
      { id: 1, name: 'Alex', secrets: 4 },
      { id: 2, name: 'Bob', secrets: 7 },
    ], 10);
    expect(victoryWinners(state)).toEqual([]);
    expect(isVictoryReached(state)).toBe(false);
    expect(resolveStatsWinner(state)).toBeNull();
  });

  it('picks the player who reached targetScore', () => {
    const state = stateWithScores([
      { id: 1, name: 'Alex', secrets: 6 },
      { id: 2, name: 'Bob', secrets: 10 },
    ], 10);
    const winner = resolveStatsWinner(state);
    expect(winner?.name).toBe('Bob');
  });

  it('among several at/above target picks highest score', () => {
    const state = stateWithScores([
      { id: 1, name: 'Alex', secrets: 10 },
      { id: 2, name: 'Bob', secrets: 12 },
    ], 10);
    expect(resolveStatsWinner(state)?.name).toBe('Bob');
  });
});
