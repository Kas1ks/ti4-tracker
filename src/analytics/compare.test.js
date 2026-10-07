import { describe, expect, it } from 'vitest';
import {
  buildDurationTrend,
  buildFactionStrategyMatrix,
  comparePlayers,
  gameActionDurationSeconds,
} from './compare';

const sample = [
  {
    id: 1,
    date: '01.01.2026',
    roundsCount: 5,
    roundTimes: [{ round: 1, seconds: 100 }, { round: 2, seconds: 200 }],
    players: [
      { name: 'Alex', factionId: 'naalu', isWinner: true, score: 10 },
      { name: 'Bob', factionId: 'sol', isWinner: false, score: 7 },
    ],
    strategyPicks: [
      { round: 1, player: 'Alex', cardId: 7 },
      { round: 1, player: 'Bob', cardId: 1 },
    ],
  },
  {
    id: 2,
    date: '02.01.2026',
    roundsCount: 6,
    roundTimes: [{ round: 1, seconds: 150 }],
    players: [
      { name: 'Alex', factionId: 'sol', isWinner: false, score: 8 },
      { name: 'Bob', factionId: 'naalu', isWinner: true, score: 10 },
    ],
    strategyPicks: [
      { round: 1, player: 'Bob', cardId: 7 },
    ],
  },
];

describe('gameActionDurationSeconds', () => {
  it('sums round times', () => {
    expect(gameActionDurationSeconds(sample[0])).toBe(300);
  });
});

describe('buildDurationTrend', () => {
  it('returns per-game durations', () => {
    const trend = buildDurationTrend(sample);
    expect(trend).toHaveLength(2);
    expect(trend[0].actionSeconds).toBe(300);
  });
});

describe('buildFactionStrategyMatrix', () => {
  it('builds cells for faction and card', () => {
    const matrix = buildFactionStrategyMatrix(sample);
    expect(matrix.gamesWithPicks).toBe(2);
    expect(matrix.factions.length).toBeGreaterThan(0);
    expect(matrix.cells.some((c) => c.cardId === 7 && c.picks >= 1)).toBe(true);
    expect(matrix.maxPicks).toBeGreaterThan(0);
  });
});

describe('comparePlayers', () => {
  it('returns up to 3 profiles', () => {
    const rows = comparePlayers(sample, ['Alex', 'Bob']);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('player');
  });
});
