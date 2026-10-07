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
  it('snapshots agendas and speaker', () => {
    const state = {
      players: [{ id: 1, name: 'Spk' }],
      meta: { speakerId: 1, roundNumber: 3 },
      politics: {
        oneVoteLaw: true,
        voteReversed: false,
        agendas: [{
          type: 'FOR_AGAINST',
          votes: { 1: { choice: 'for', amount: 2 } },
          locked: { 1: true },
        }],
      },
      log: { events: [{ type: 'AGENDA_PHASE_FINISHED', roundNumber: 3 }] },
    };
    const pol = extractPolitics(state);
    expect(pol.finalSpeaker).toBe('Spk');
    expect(pol.oneVoteLaw).toBe(true);
    expect(pol.agendas).toHaveLength(1);
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
