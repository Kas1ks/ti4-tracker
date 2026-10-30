import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../game/gameState';
import { reduceGame } from '../game/gameEvents';
import {
  extractPolitics,
  extractStrategyPlays,
  eventsWithRound,
} from './gameRecordExtract';
import { buildGameRecord } from './gameRecord';

describe('eventsWithRound', () => {
  it('tracks round from ROUND_STARTED', () => {
    const out = eventsWithRound([
      { type: 'ROUND_STARTED', roundNumber: 2 },
      { type: 'PLAYER_PASSED', playerId: 1 },
    ]);
    expect(out[1].roundNumber).toBe(2);
  });
});

describe('extractStrategyPlays', () => {
  it('collects primary and secondary plays from log', () => {
    const state = {
      players: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      log: {
        events: [
          { type: 'ROUND_STARTED', roundNumber: 1 },
          { type: 'STRATEGY_SECONDARY_PASSED', playerId: 2, cardId: 3, ownerPlayerId: 1, roundNumber: 1 },
          { type: 'STRATEGY_PLAYED', playerId: 1, cardId: 3, roundNumber: 1 },
        ],
      },
    };
    const plays = extractStrategyPlays(state);
    expect(plays).toHaveLength(2);
    expect(plays.find((p) => p.role === 'secondary' && p.outcome === 'passed')).toBeTruthy();
    expect(plays.find((p) => p.role === 'primary')).toBeTruthy();
  });
});

describe('extractPolitics', () => {
  it('snapshots agendas, active laws and speaker', () => {
    const state = {
      players: [
        { id: 1, name: 'Spk' },
        { id: 2, name: 'Bob' },
      ],
      meta: { speakerId: 1, roundNumber: 3 },
      politics: {
        oneVoteLaw: true,
        voteReversed: true,
        agendas: [{
          cardId: 'fleet_regulations',
          title: 'Регулирование флота',
          kind: 'law',
          type: 'FOR_AGAINST',
          outcome: 'for',
          speakerDecision: 'for',
          votes: {
            1: { choice: 'for', amount: 1 },
            2: { choice: 'against', amount: 1 },
          },
          locked: { 1: true, 2: true },
        }],
        activeLaws: [{
          id: 'minister_of_policy',
          title: 'Министр политики',
          elect: 'player',
          voteType: 'PLAYER_CHOICE',
          ownerPlayerId: 2,
          outcome: { choice: '2' },
          enactedRound: 2,
        }],
      },
      log: { events: [{ type: 'AGENDA_PHASE_FINISHED', roundNumber: 3 }] },
    };
    const pol = extractPolitics(state);
    expect(pol.finalSpeaker).toBe('Spk');
    expect(pol.oneVoteLaw).toBe(true);
    expect(pol.voteReversed).toBe(true);
    expect(pol.agendas).toHaveLength(1);
    expect(pol.agendas[0].title).toBe('Регулирование флота');
    expect(pol.agendas[0].outcome).toBe('for');
    expect(pol.agendas[0].outcomeLabel).toBe('За');
    expect(pol.agendas[0].speakerBreak).toBe(true);
    expect(pol.activeLaws).toHaveLength(1);
    expect(pol.activeLaws[0].owner).toBe('Bob');
    expect(pol.agendaPhasesCompleted).toBe(1);
  });
});

describe('buildGameRecord wave C', () => {
  it('embeds politics and strategy plays', () => {
    let state = createEmptyGameState();
    state = {
      ...state,
      meta: { ...state.meta, roundNumber: 2, speakerId: 1 },
      players: [{
        id: 1,
        name: 'A',
        factionId: 'sol',
        secrets: 2,
        secretScored: ['destroy_their_greatest_ship'],
        techIds: [],
        totalTime: 100,
      }],
      politics: {
        oneVoteLaw: false,
        agendas: [{ type: 'FOR_AGAINST', votes: {}, locked: {} }],
      },
      log: {
        events: [
          { type: 'STRATEGY_PLAYED', playerId: 1, cardId: 1, roundNumber: 2 },
        ],
      },
    };
    const record = buildGameRecord(state, state.players[0], () => 10);
    expect(record.strategyPlays.length).toBe(1);
    expect(record.players[0].secretsHeld).toBe(2);
    expect(record.players[0].secretsScored).toEqual(['destroy_their_greatest_ship']);
    expect(record.politics?.finalSpeaker).toBe('A');
  });
});

describe('reduceGame strategy secondary events', () => {
  it('logs secondary pass before primary commit', () => {
    const players = [
      { id: 1, name: 'A', factionId: 'sol', cards: [{ id: 3, name: '3' }], playedCardIds: [] },
      { id: 2, name: 'B', factionId: 'sol', cards: [], playedCardIds: [] },
    ];
    let state = createEmptyGameState();
    state = {
      ...state,
      isGameActive: true,
      meta: { ...state.meta, speakerId: 1, roundNumber: 1 },
      players,
      round: {
        ...state.round,
        active: true,
        turnOrderIds: [1, 2],
        activeTurnIdx: 0,
        strategyResolution: {
          active: true,
          cardId: 3,
          playerId: 1,
          startedAt: Date.now(),
          responses: { 1: 'pending', 2: 'pending' },
          resolvedAt: {},
        },
      },
    };
    state = reduceGame(state, { type: 'RESOLVE_STRATEGY', playerId: 2, choice: 'passed', at: 100 });
    expect(state.log.events.some((e) => e.type === 'STRATEGY_SECONDARY_PASSED')).toBe(true);
    state = reduceGame(state, { type: 'RESOLVE_STRATEGY', playerId: 1, choice: 'played', at: 101 });
    expect(state.log.events.some((e) => e.type === 'STRATEGY_PLAYED')).toBe(true);
  });
});
