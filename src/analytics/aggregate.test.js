import { describe, expect, it } from 'vitest';
import {
  buildAnalytics,
  buildFactionStats,
  buildObjectiveStats,
  buildPlayerStats,
  buildStrategyStats,
} from './aggregate';
import { playerKey, resolveFactionId } from './keys';

const history = [
  {
    id: 1,
    roundsCount: 5,
    players: [
      {
        name: 'Alex',
        faction: 'Клубок Наалу',
        factionId: 'naalu',
        score: 10,
        totalTime: 3000,
        isWinner: true,
      },
      {
        name: 'Bob',
        faction: 'Федерация Сол',
        factionId: 'sol',
        score: 7,
        totalTime: 2800,
        isWinner: false,
        eliminated: true,
        eliminatedRound: 4,
      },
    ],
    objectives: [
      { id: 'o1', title: 'Lead', stage: 1, points: 1, scoredBy: ['Alex'] },
      { id: 'o2', title: 'Rare', stage: 2, points: 2, scoredBy: [] },
    ],
    strategyPicks: [
      { round: 1, player: 'Alex', cardId: 7 },
      { round: 1, player: 'Bob', cardId: 1 },
      { round: 2, player: 'Alex', cardId: 8 },
      { round: 2, player: 'Bob', cardId: 7 },
    ],
  },
  {
    id: 2,
    roundsCount: 6,
    players: [
      {
        name: 'alex',
        faction: 'Клубок Наалу',
        score: 8,
        totalTime: 3600,
        isWinner: false,
      },
      {
        name: 'Bob',
        factionId: 'sol',
        faction: 'Федерация Сол',
        score: 10,
        totalTime: 3500,
        isWinner: true,
      },
    ],
    objectives: [
      { id: 'o1', title: 'Lead', stage: 1, points: 1, scoredBy: ['Bob', 'alex'] },
      { id: 'o2', title: 'Rare', stage: 2, points: 2, scoredBy: [] },
    ],
    strategyPicks: [
      { round: 1, player: 'Alex', cardId: 1 },
      { round: 1, player: 'Bob', cardId: 7 },
    ],
  },
];

describe('analytics keys', () => {
  it('normalizes player names case-insensitively', () => {
    expect(playerKey(' Alex ')).toBe('alex');
    expect(playerKey('ALEX')).toBe('alex');
  });

  it('resolves faction by id or legacy name', () => {
    expect(resolveFactionId('naalu')).toBe('naalu');
    expect(resolveFactionId('Клубок Наалу')).toBe('naalu');
    expect(resolveFactionId({ factionId: 'sol' })).toBe('sol');
  });
});

describe('buildPlayerStats', () => {
  it('merges players and computes core metrics', () => {
    const players = buildPlayerStats(history);
    const alex = players.find((p) => p.key === 'alex');
    const bob = players.find((p) => p.key === 'bob');

    expect(alex.games).toBe(2);
    expect(alex.wins).toBe(1);
    expect(alex.winRate).toBe(50);
    expect(alex.avgScore).toBe(9);
    expect(alex.avgGameTime).toBe(3300);
    expect(alex.factions[0].name).toMatch(/Наалу/);

    expect(bob.elimGames).toBe(1);
    expect(bob.avgElimRound).toBe(4);
  });
});

describe('buildFactionStats', () => {
  it('aggregates picks, wins, avg VP and rounds', () => {
    const factions = buildFactionStats(history);
    const naalu = factions.find((f) => f.id === 'naalu');
    const sol = factions.find((f) => f.id === 'sol');

    expect(naalu.picks).toBe(2);
    expect(naalu.wins).toBe(1);
    expect(naalu.avgVp).toBe(9);
    expect(sol.picks).toBe(2);
    expect(sol.wins).toBe(1);
  });
});

describe('buildObjectiveStats', () => {
  it('ranks most and rarely scored objectives', () => {
    const objectives = buildObjectiveStats(history);
    expect(objectives.mostScored[0].id).toBe('o1');
    expect(objectives.mostScored[0].scoreEvents).toBe(3);
    expect(objectives.rarelyScored[0].id).toBe('o2');
    expect(objectives.rarelyScored[0].scoreRatePct).toBe(0);
  });
});

describe('buildStrategyStats', () => {
  it('computes pick frequency, avg round and win correlation', () => {
    const strategy = buildStrategyStats(history);
    expect(strategy.gamesWithPicks).toBe(2);
    const tech = strategy.cards.find((c) => c.cardId === 7);
    expect(tech.picks).toBe(3);
    expect(tech.avgRoundPicked).toBeCloseTo(1.3, 1);
    // Alex won once with 7, Bob won once with 7 → unique player-games with 7: Alex+Bob in g1, Bob in g2 = 3? 
    // g1: Alex-7, Bob-7 (round2) → unique Alex and Bob
    // g2: Bob-7 → Bob already counted in g2
    // winPicks: Alex win in g1, Bob win in g2 → 2/3
    expect(tech.uniquePlayerGames).toBe(3);
    expect(tech.winRateWhenPicked).toBe(67);
  });

  it('returns empty cards when history has no strategyPicks', () => {
    const strategy = buildStrategyStats([{ id: 1, players: [], objectives: [] }]);
    expect(strategy.gamesWithPicks).toBe(0);
    expect(strategy.cards).toEqual([]);
  });
});

describe('buildAnalytics', () => {
  it('bundles all sections', () => {
    const bundle = buildAnalytics(history);
    expect(bundle.gameCount).toBe(2);
    expect(bundle.players).toHaveLength(2);
    expect(bundle.factions.length).toBeGreaterThanOrEqual(2);
    expect(bundle.objectives.mostScored.length).toBeGreaterThan(0);
    expect(bundle.strategy.cards.length).toBeGreaterThan(0);
  });
});
