import { describe, expect, it } from 'vitest';
import { ROLES } from '../../src/sync/permissions.js';
import {
  playerSecretsRevealed,
  redactStateForSession,
} from './secretRedaction.js';

function baseState() {
  return {
    players: [
      {
        id: 1,
        name: 'A',
        secretHand: ['secret_a', 'secret_b'],
        secretDraft: ['draft_a', 'draft_b'],
        secretScored: ['scored_a'],
      },
      {
        id: 2,
        name: 'B',
        secretHand: ['secret_c'],
        secretDraft: null,
        secretScored: [],
      },
    ],
    secretObjectives: {
      deck: ['deck_1', 'deck_2'],
      scored: ['scored_a'],
      dealStarted: true,
      draftPending: true,
      pendingReveals: { 1: 'secret_a', 2: 'secret_c' },
      overflows: { 1: { resolveStrategy: true }, 2: { resolveStrategy: false } },
    },
    politics: { activeLaws: [] },
  };
}

describe('redactStateForSession', () => {
  it('admin sees full hands and deck', () => {
    const state = baseState();
    const out = redactStateForSession(state, { role: ROLES.ADMIN });
    expect(out).toBe(state);
    expect(out.players[0].secretHand).toEqual(['secret_a', 'secret_b']);
    expect(out.secretObjectives.deck).toEqual(['deck_1', 'deck_2']);
  });

  it('viewer sees counts only', () => {
    const out = redactStateForSession(baseState(), { role: ROLES.VIEWER });
    expect(out.players[0].secretHand).toEqual([]);
    expect(out.players[0].secretHandCount).toBe(2);
    expect(out.players[0].secretDraft).toEqual(['__hidden__', '__hidden__']);
    expect(out.players[0].secretScored).toEqual(['scored_a']);
    expect(out.players[1].secretHand).toEqual([]);
    expect(out.players[1].secretHandCount).toBe(1);
    expect(out.secretObjectives.deck).toEqual([]);
    expect(out.secretObjectives.pendingReveals).toEqual({});
    expect(out.secretObjectives.overflows).toEqual({});
  });

  it('player sees own hand and pending only', () => {
    const out = redactStateForSession(baseState(), {
      role: ROLES.PLAYER,
      seatPlayerId: 1,
    });
    expect(out.players[0].secretHand).toEqual(['secret_a', 'secret_b']);
    expect(out.players[0].secretDraft).toEqual(['draft_a', 'draft_b']);
    expect(out.players[1].secretHand).toEqual([]);
    expect(out.players[1].secretHandCount).toBe(1);
    expect(out.secretObjectives.pendingReveals).toEqual({ 1: 'secret_a' });
    expect(out.secretObjectives.overflows).toEqual({ 1: { resolveStrategy: true } });
    expect(out.secretObjectives.deck).toEqual([]);
  });

  it('Search Warrant reveals elected seat hand to everyone', () => {
    const state = {
      ...baseState(),
      politics: {
        activeLaws: [{ id: 'search_warrant', ownerPlayerId: 2 }],
      },
    };
    expect(playerSecretsRevealed(state, state.players[1])).toBe(true);
    const out = redactStateForSession(state, { role: ROLES.VIEWER });
    expect(out.players[1].secretHand).toEqual(['secret_c']);
    expect(out.players[0].secretHand).toEqual([]);
    expect(out.players[0].secretHandCount).toBe(2);
  });

  it('secretsRevealed flag also opens the hand', () => {
    const state = baseState();
    state.players[0] = { ...state.players[0], secretsRevealed: true };
    const out = redactStateForSession(state, { role: ROLES.VIEWER });
    expect(out.players[0].secretHand).toEqual(['secret_a', 'secret_b']);
  });
});
