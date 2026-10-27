import { describe, expect, it } from 'vitest';
import { collectNeedsAction, newlyNeedingAction } from './needsAction.js';

const player = (id, name = `P${id}`) => ({
  id,
  name,
  factionId: 'sol',
  color: '#3b82f6',
  eliminated: false,
  cards: [{ id: 1 }],
});

function baseState(over = {}) {
  return {
    isGameActive: true,
    players: [player(1), player(2), player(3)],
    meta: { speakerId: 1, roundNumber: 1 },
    round: {
      turnOrderIds: [1, 2, 3],
      activeTurnIdx: 0,
      passed: {},
      combat: { active: false },
      strategyResolution: { active: false, responses: {} },
      imperialClaim: { active: false },
      techResearch: { active: false },
    },
    statusPhase: { scoring: { active: false, responses: {}, orderIds: [], currentIdx: 0 } },
    politics: { showModal: false, step: 'SETUP', agendas: [], influenceLocked: {}, currentAgendaIndex: 0 },
    startingTechDraft: { needed: false, active: false, responses: {} },
    expedition: { awaitingControlPick: false },
    ...over,
  };
}

describe('needsAction', () => {
  it('flags the active player on their turn', () => {
    const { seats } = collectNeedsAction(baseState());
    expect(seats.get('1')?.reason).toBe('turn');
    expect(seats.has('2')).toBe(false);
  });

  it('skips passed active player', () => {
    const state = baseState({
      round: {
        ...baseState().round,
        passed: { 1: true },
        activeTurnIdx: 0,
      },
    });
    expect(collectNeedsAction(state).seats.has('1')).toBe(false);
  });

  it('flags combat hit entry for both sides', () => {
    const state = baseState({
      round: {
        ...baseState().round,
        combat: {
          active: true,
          mode: 'pvp',
          phase: 'input',
          attackerId: 1,
          defenderId: 2,
          hits: {},
          assigned: {},
        },
      },
    });
    const { seats } = collectNeedsAction(state);
    expect(seats.get('1')?.reason).toBe('combat-hits');
    expect(seats.get('2')?.reason).toBe('combat-hits');
  });

  it('flags current politics voter', () => {
    const state = baseState({
      politics: {
        showModal: true,
        step: 'VOTE',
        voteReversed: false,
        currentAgendaIndex: 0,
        influenceLocked: { 1: true, 2: true, 3: true },
        agendas: [{ type: 'LAW', votes: {}, locked: { 2: true } }],
      },
    });
    // Order from speaker 1: 2,3,1 — 2 locked → current is 3
    expect(collectNeedsAction(state).seats.get('3')?.reason).toBe('politics-vote');
  });

  it('flags strategy resolution pending seats', () => {
    const state = baseState({
      round: {
        ...baseState().round,
        strategyResolution: {
          active: true,
          cardId: 1,
          responses: { 1: 'done', 2: 'pending', 3: 'pending' },
        },
      },
    });
    const { seats } = collectNeedsAction(state);
    expect(seats.get('2')?.reason).toBe('strategy-resolution');
    expect(seats.get('3')?.reason).toBe('strategy-resolution');
    expect(seats.has('1')).toBe(false);
  });

  it('emits only newly needing seats on edge', () => {
    const prev = baseState({
      round: { ...baseState().round, activeTurnIdx: 0 },
    });
    const next = baseState({
      round: { ...baseState().round, activeTurnIdx: 1 },
    });
    const edges = newlyNeedingAction(prev, next);
    expect(edges).toEqual([
      expect.objectContaining({ target: 'seat', seatPlayerId: 2, reason: 'turn' }),
    ]);
  });

  it('returns empty when game inactive', () => {
    expect(collectNeedsAction(baseState({ isGameActive: false })).seats.size).toBe(0);
  });
});
