import { describe, expect, it } from 'vitest';
import {
  buildAnalytics,
  buildTechStats,
  buildVpSourceStats,
  hasReliableVpBreakdown,
} from './aggregate';
import { buildFactionProfile, buildPlayerProfile } from './profiles';
import { normalizeHistory } from './gameRecord';

const history = normalizeHistory([
  {
    id: 1,
    date: '01.01.2026',
    roundsCount: 5,
    custodians: 'Alex',
    players: [
      {
        name: 'Alex',
        factionId: 'naalu',
        faction: 'Клубок Наалу',
        score: 10,
        totalTime: 3000,
        isWinner: true,
        damageDealt: 2,
        breakthrough: true,
        techs: ['neural_motivator', 'sarween_tools'],
        scoreBreakdown: {
          secrets: 2,
          objectives: 6,
          custodians: 1,
          support: 0,
          extra: 1,
          total: 10,
        },
      },
      {
        name: 'Bob',
        factionId: 'sol',
        faction: 'Федерация Сол',
        score: 7,
        totalTime: 2800,
        isWinner: false,
        techs: ['plasma_scoring'],
        scoreBreakdown: {
          secrets: 1,
          objectives: 5,
          custodians: 0,
          support: 1,
          extra: 0,
          total: 7,
        },
      },
    ],
    strategyPicks: [
      { round: 1, player: 'Alex', cardId: 7 },
      { round: 1, player: 'Bob', cardId: 1 },
    ],
    objectives: [],
  },
  {
    id: 2,
    date: '02.01.2026',
    roundsCount: 6,
    players: [
      {
        name: 'Alex',
        factionId: 'sol',
        score: 8,
        totalTime: 3600,
        isWinner: false,
        // legacy-style: total without parts → ignored in VP mix
        scoreBreakdown: { secrets: 0, objectives: 0, custodians: 0, support: 0, extra: 0, total: 8 },
        techs: [],
      },
      {
        name: 'Bob',
        factionId: 'sol',
        score: 10,
        totalTime: 3500,
        isWinner: true,
        techs: ['neural_motivator'],
        scoreBreakdown: {
          secrets: 3,
          objectives: 7,
          custodians: 0,
          support: 0,
          extra: 0,
          total: 10,
        },
      },
    ],
    strategyPicks: [
      { round: 1, player: 'Alex', cardId: 1 },
      { round: 1, player: 'Bob', cardId: 7 },
    ],
    objectives: [],
  },
]);

describe('VP breakdown reliability', () => {
  it('accepts reconciled parts and rejects legacy totals-only', () => {
    expect(hasReliableVpBreakdown({
      scoreBreakdown: { secrets: 2, objectives: 8, custodians: 0, support: 0, extra: 0, total: 10 },
    })).toBe(true);
    expect(hasReliableVpBreakdown({
      scoreBreakdown: { secrets: 0, objectives: 0, custodians: 0, support: 0, extra: 0, total: 10 },
    })).toBe(false);
  });
});

describe('buildVpSourceStats', () => {
  it('averages only reliable seat breakdowns', () => {
    const vp = buildVpSourceStats(history);
    // seats: Alex g1, Bob g1, Bob g2 (Alex g2 skipped) = 3
    expect(vp.gamesWithDetail).toBe(3);
    expect(vp.avgTotal).toBeCloseTo((10 + 7 + 10) / 3, 1);
    expect(vp.bars.length).toBe(5);
    expect(vp.shareObjectives).toBeGreaterThan(0);
  });
});

describe('buildTechStats', () => {
  it('ranks researched techs with win rates', () => {
    const techs = buildTechStats(history);
    expect(techs.gamesWithTechs).toBe(2);
    const neural = techs.techs.find((t) => t.id === 'neural_motivator');
    expect(neural.games).toBe(2);
    expect(neural.wins).toBe(2);
    expect(neural.winRate).toBe(100);
  });
});

describe('profiles', () => {
  it('builds player profile with strategies and techs', () => {
    const profile = buildPlayerProfile(history, 'Alex');
    expect(profile.type).toBe('player');
    expect(profile.games).toBe(2);
    expect(profile.strategies.some((s) => s.cardId === 7)).toBe(true);
    expect(profile.techs.some((t) => t.id === 'neural_motivator')).toBe(true);
    expect(profile.recentGames.length).toBe(2);
    expect(profile.vpMix.gamesWithDetail).toBe(1);
  });

  it('builds faction profile with players list', () => {
    const profile = buildFactionProfile(history, 'sol');
    expect(profile.type).toBe('faction');
    expect(profile.picks).toBe(3);
    expect(profile.players.length).toBeGreaterThanOrEqual(1);
    expect(profile.players.some((p) => p.key === 'bob')).toBe(true);
  });
});

describe('buildAnalytics wave B fields', () => {
  it('includes vpSources and techs', () => {
    const bundle = buildAnalytics(history);
    expect(bundle.vpSources.gamesWithDetail).toBe(3);
    expect(bundle.techs.gamesWithTechs).toBe(2);
    expect(bundle.politics).toBeDefined();
    expect(bundle.strategyExecution).toBeDefined();
  });
});
