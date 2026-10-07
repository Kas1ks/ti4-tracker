import { describe, expect, it } from 'vitest';
import {
  GAME_RECORD_SCHEMA_VERSION,
  buildGameRecord,
  normalizeGameRecord,
  normalizeHistory,
} from './gameRecord';
import { filterHistory } from './filter';
import { gamesToCsv, playersToCsv } from './exportCsv';
import { createEmptyGameState } from '../game/gameState';

describe('normalizeGameRecord', () => {
  it('upgrades legacy v1/v2 snapshots to v3 shape', () => {
    const legacy = {
      id: 42,
      schemaVersion: 2,
      date: '01.01.2026',
      roundsCount: 4,
      targetScore: 10,
      winner: 'Alex',
      winningFaction: 'Сол',
      expansions: { pok: true, te: false },
      custodians: 'Alex',
      players: [
        {
          name: 'Alex',
          factionId: 'sol',
          faction: 'Федерация Сол',
          score: 10,
          totalTime: 1000,
          isWinner: true,
          damageDealt: 3,
          breakthrough: true,
        },
      ],
      objectives: [{ id: 'o1', title: 'Lead', stage: 1, points: 1, scoredBy: ['Alex'] }],
      strategyPicks: [{ round: 1, cardId: 7, player: 'Alex' }],
    };

    const n = normalizeGameRecord(legacy);
    expect(n.schemaVersion).toBe(GAME_RECORD_SCHEMA_VERSION);
    expect(n.sourceSchemaVersion).toBe(2);
    expect(n.playerCount).toBe(1);
    expect(n.players[0].scoreBreakdown.total).toBe(10);
    expect(n.players[0].techs).toEqual([]);
    expect(n.politics).toBeNull();
    expect(n.strategyPlays).toEqual([]);
    expect(n.eventDigest).toEqual([]);
    expect(n.custodians).toBe('Alex');
  });

  it('returns null for garbage', () => {
    expect(normalizeGameRecord(null)).toBeNull();
    expect(normalizeHistory([null, { players: [{ name: 'A', score: 1 }] }])).toHaveLength(1);
  });
});

describe('buildGameRecord', () => {
  it('captures score breakdown and tech ids from live state', () => {
    let state = createEmptyGameState();
    state = {
      ...state,
      meta: {
        ...state.meta,
        roundNumber: 3,
        usePok: true,
        useTe: false,
        targetScore: 10,
        strategyPickHistory: [{ round: 1, playerId: 1, cardId: 1 }],
      },
      players: [
        {
          id: 1,
          name: 'Alex',
          factionId: 'sol',
          secrets: 2,
          extra: 1,
          totalTime: 900,
          damageDealt: 4,
          breakthrough: false,
          eliminated: false,
          techIds: ['neural_motivator', 'sarween_tools'],
        },
      ],
      objectives: {
        active: [{ id: 'obj1', title: 'Test', stage: 1, points: 1 }],
        completions: { '1_obj1': true },
        stage1Deck: [],
        stage2Deck: [],
      },
      vpTrack: {
        custodiansPlayerId: 1,
        supportHolders: {},
      },
    };

    const record = buildGameRecord(state, state.players[0], () => 5);
    expect(record.schemaVersion).toBe(3);
    expect(record.playerCount).toBe(1);
    expect(record.players[0].techs).toEqual(['neural_motivator', 'sarween_tools']);
    expect(record.players[0].scoreBreakdown).toMatchObject({
      secrets: 2,
      objectives: 1,
      custodians: 1,
      support: 0,
      extra: 1,
      total: 5,
    });
    expect(record.custodians).toBe('Alex');
    expect(record.strategyPicks).toEqual([
      expect.objectContaining({ round: 1, cardId: 1, player: 'Alex' }),
    ]);
  });
});

describe('filterHistory', () => {
  const sample = normalizeHistory([
    {
      id: 1,
      expansions: { pok: false, te: false },
      playerCount: 4,
      winner: 'Alex',
      players: [{ name: 'Alex', score: 10 }],
    },
    {
      id: 2,
      expansions: { pok: true, te: true },
      playerCount: 6,
      winner: 'Bob',
      players: [{ name: 'Bob', score: 10 }],
    },
  ]);

  it('filters by expansions and player count', () => {
    expect(filterHistory(sample, { expansions: 'base' })).toHaveLength(1);
    expect(filterHistory(sample, { expansions: 'pok_te' })[0].id).toBe(2);
    expect(filterHistory(sample, { expansions: 'all', playerCount: 6 })).toHaveLength(1);
  });

  it('filters by winner substring', () => {
    expect(filterHistory(sample, { expansions: 'all', winner: 'bo' })).toHaveLength(1);
  });
});

describe('exportCsv', () => {
  it('emits header rows for games and players', () => {
    const history = normalizeHistory([
      {
        id: 9,
        date: '05.10.2026',
        winner: 'Alex',
        expansions: { pok: true, te: false },
        players: [
          {
            name: 'Alex',
            score: 10,
            isWinner: true,
            damageDealt: 2,
            scoreBreakdown: { secrets: 1, objectives: 8, custodians: 1, support: 0, extra: 0, total: 10 },
          },
        ],
      },
    ]);

    const games = gamesToCsv(history);
    expect(games.split('\r\n')[0]).toContain('winner');
    expect(games).toContain('Alex');

    const players = playersToCsv(history);
    expect(players).toContain('vpSecrets');
    expect(players).toContain('Alex');
  });
});
