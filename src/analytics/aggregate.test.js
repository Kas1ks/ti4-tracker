import { describe, expect, it } from 'vitest';
import {
  buildAnalytics,
  buildFactionStats,
  buildObjectiveStats,
  buildPlayerStats,
  buildPoliticsStats,
  buildSecretStats,
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
      { id: 'p1_b01', title: 'Монополизируй рынок', stage: 1, points: 1, scoredBy: ['Alex'] },
      { id: 'p2_b03', title: 'Покорить галактику', stage: 2, points: 2, scoredBy: [] },
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
      { id: 'p1_b01', title: 'Монополизируй рынок', stage: 1, points: 1, scoredBy: ['Bob', 'alex'] },
      { id: 'p2_b03', title: 'Покорить галактику', stage: 2, points: 2, scoredBy: [] },
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

describe('buildSecretStats', () => {
  it('ranks secrets by share of v4 games where they were scored', () => {
    const secrets = buildSecretStats([
      {
        id: 1,
        players: [
          { name: 'A', secretsScored: ['destroy_their_greatest_ship', 'make_an_example_of_their_world'] },
          { name: 'B', secretsScored: ['destroy_their_greatest_ship'] },
        ],
      },
      {
        id: 2,
        players: [
          { name: 'A', secretsScored: ['destroy_their_greatest_ship'] },
          { name: 'B', secretsScored: [] },
        ],
      },
      {
        id: 3,
        players: [
          { name: 'A', secretsHeld: 1 },
          { name: 'B' },
        ],
      },
    ]);
    expect(secrets.gamesWithSecrets).toBe(2);
    expect(secrets.mostScored[0].id).toBe('destroy_their_greatest_ship');
    expect(secrets.mostScored[0].scoredGames).toBe(2);
    expect(secrets.mostScored[0].gameRatePct).toBe(100);
    expect(secrets.mostScored[0].scoreEvents).toBe(3);
    expect(secrets.rarelyScored.some((s) => s.id === 'make_an_example_of_their_world')).toBe(true);
    expect(buildAnalytics(history).secrets.gamesWithSecrets).toBe(0);
  });
});

describe('buildObjectiveStats', () => {
  it('ranks by avg player completion per reveal', () => {
    const objectives = buildObjectiveStats(history);
    // g1: 1/2=50%, g2: 2/2=100% → avg 75%
    expect(objectives.mostScored[0].id).toBe('p1_b01');
    expect(objectives.mostScored[0].revealed).toBe(2);
    expect(objectives.mostScored[0].avgPlayerPct).toBe(75);
    expect(objectives.mostScored[0].desc).toMatch(/4 планет/i);
    // never scored when shown → 0%
    expect(objectives.rarelyScored[0].id).toBe('p2_b03');
    expect(objectives.rarelyScored[0].revealed).toBe(2);
    expect(objectives.rarelyScored[0].avgPlayerPct).toBe(0);
    expect(objectives.rarelyScored[0].desc).toMatch(/11 планет/i);
  });
});

describe('buildStrategyStats', () => {
  it('computes taken-or-not rates per round and overall', () => {
    const strategy = buildStrategyStats(history);
    expect(strategy.gamesWithPicks).toBe(2);
    expect(strategy.totalPicks).toBe(6);
    expect(strategy.draftSlots).toBe(3);
    expect(strategy.rounds).toEqual([1, 2]);
    const tech = strategy.cards.find((c) => c.cardId === 7);
    expect(tech.picks).toBe(3);
    // Taken in g1r1, g1r2, g2r1 → 3/3 draft slots
    expect(tech.overallPct).toBe(100);
    expect(tech.byRound[1].pct).toBe(100);
    expect(tech.byRound[2].pct).toBe(100);
    const leadership = strategy.cards.find((c) => c.cardId === 1);
    // Taken in g1r1, g2r1 → 2/3
    expect(leadership.overallPct).toBe(67);
    expect(leadership.byRound[1].pct).toBe(100);
    expect(leadership.byRound[2].pct).toBe(0);
  });

  it('returns empty cards when history has no strategyPicks', () => {
    const strategy = buildStrategyStats([{ id: 1, players: [], objectives: [] }]);
    expect(strategy.gamesWithPicks).toBe(0);
    expect(strategy.totalPicks).toBe(0);
    expect(strategy.draftSlots).toBe(0);
    expect(strategy.rounds).toEqual([]);
    expect(strategy.cards).toEqual([]);
  });
});

describe('buildPoliticsStats', () => {
  it('aggregates lasting laws, speaker breaks and for/against outcomes', () => {
    const stats = buildPoliticsStats([
      {
        winner: 'Alex',
        politics: {
          finalSpeaker: 'Alex',
          oneVoteLaw: true,
          voteReversed: true,
          agendaPhasesCompleted: 2,
          agendas: [{
            type: 'FOR_AGAINST',
            outcome: 'for',
            speakerBreak: true,
            covert: true,
          }],
          activeLaws: [{
            id: 'minister_of_policy',
            title: 'Министр политики',
            owner: 'Bob',
            ownerPlayerId: 2,
          }],
        },
      },
      {
        winner: 'Bob',
        politics: {
          finalSpeaker: 'Alex',
          agendaPhasesCompleted: 1,
          agendas: [{ type: 'FOR_AGAINST', outcome: 'against' }],
          activeLaws: [{
            id: 'minister_of_policy',
            title: 'Министр политики',
            owner: 'Alex',
            ownerPlayerId: 1,
          }],
        },
      },
    ]);
    expect(stats.gamesWithPolitics).toBe(2);
    expect(stats.oneVoteGames).toBe(1);
    expect(stats.voteReversedGames).toBe(1);
    expect(stats.avgActiveLaws).toBe(1);
    expect(stats.speakerBreaks).toBe(1);
    expect(stats.forOutcomeRate).toBe(50);
    expect(stats.againstOutcomeRate).toBe(50);
    expect(stats.covertAgendas).toBe(1);
    expect(stats.electLawsTotal).toBe(2);
    expect(stats.topLaws[0].id).toBe('minister_of_policy');
    expect(stats.topLaws[0].games).toBe(2);
    expect(stats.speakerWinRate).toBe(50);
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
