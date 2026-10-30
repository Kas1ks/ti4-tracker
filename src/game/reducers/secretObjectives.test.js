import { describe, expect, it } from 'vitest';
import { createEmptyGameState, normalizeGameState } from '../gameState';
import { gameReducer } from '../gameReducer';
import { canStartSecretDraft } from '../secretDeck';

const player = (id, name, overrides = {}) => ({
  id,
  name,
  factionId: 'sol',
  color: '#3b82f6',
  secrets: 0,
  secretHand: [],
  secretDraft: null,
  secretCap: 3,
  extra: 0,
  totalTime: 0,
  damageDealt: 0,
  eliminated: false,
  cards: [],
  ...overrides,
});

const baseGame = (overrides = {}) => normalizeGameState({
  ...createEmptyGameState(),
  isGameActive: true,
  players: [player(1, 'A'), player(2, 'B')],
  meta: { ...createEmptyGameState().meta, speakerId: 1, usePok: false },
  startingTechDraft: { needed: false, active: false, responses: {} },
  secretObjectives: { deck: [], scored: [], dealStarted: false, draftPending: false },
  ...overrides,
});

const dispatch = (state, action) => gameReducer(state, action);

describe('secret objectives deck flow', () => {
  it('START_GAME does not deal secrets; START_SECRET_DRAFT deals 2 each', () => {
    let state = normalizeGameState({
      ...createEmptyGameState(),
      players: [player(1, 'A'), player(2, 'B')],
      meta: { ...createEmptyGameState().meta, speakerId: 1 },
    });
    state = dispatch(state, { type: 'START_GAME' });
    expect(state.secretObjectives.dealStarted).toBe(false);
    expect(canStartSecretDraft(state)).toBe(true);

    state = dispatch(state, { type: 'START_SECRET_DRAFT' });
    expect(state.secretObjectives.dealStarted).toBe(true);
    expect(state.secretObjectives.draftPending).toBe(true);
    expect(state.players[0].secretDraft).toHaveLength(2);
    expect(state.players[1].secretDraft).toHaveLength(2);
    expect(state.secretObjectives.deck.length).toBe(20 - 4);
  });

  it('blocks START_SECRET_DRAFT while starting tech is needed', () => {
    const state = baseGame({
      startingTechDraft: { needed: true, active: false, responses: {} },
    });
    expect(dispatch(state, { type: 'START_SECRET_DRAFT' })).toBe(state);
  });

  it('blocks ADD_OBJECTIVE until dealStarted', () => {
    const state = baseGame();
    const obj = { id: 'x', stage: 1, desc: 'test', points: 1 };
    expect(dispatch(state, { type: 'ADD_OBJECTIVE', objective: obj })).toBe(state);
    const opened = dispatch(state, { type: 'START_SECRET_DRAFT' });
    const next = dispatch(opened, { type: 'ADD_OBJECTIVE', objective: obj });
    expect(next.objectives.active.some((o) => o.id === 'x')).toBe(true);
  });

  it('keep 1 → when all done, rejects reshuffled into deck', () => {
    let state = dispatch(baseGame(), { type: 'START_SECRET_DRAFT' });
    const a0 = state.players[0].secretDraft[0];
    const a1 = state.players[0].secretDraft[1];
    const b0 = state.players[1].secretDraft[0];
    const b1 = state.players[1].secretDraft[1];

    state = dispatch(state, { type: 'KEEP_SECRET_DRAFT', playerId: 1, cardId: a0 });
    expect(state.players[0].secretHand).toEqual([a0]);
    expect(state.secretObjectives.draftPending).toBe(true);
    expect(state.secretObjectives.deck).toContain(a1);

    state = dispatch(state, { type: 'KEEP_SECRET_DRAFT', playerId: 2, cardId: b0 });
    expect(state.secretObjectives.draftPending).toBe(false);
    expect(state.players[1].secretHand).toEqual([b0]);
    expect(state.secretObjectives.deck).toContain(a1);
    expect(state.secretObjectives.deck).toContain(b1);
    expect(state.secretObjectives.deck).not.toContain(a0);
    expect(state.secretObjectives.deck).not.toContain(b0);
  });

  it('DEV_SKIP_SECRET_DRAFT keeps first card for everyone', () => {
    let state = dispatch(baseGame(), { type: 'START_SECRET_DRAFT' });
    const keepA = state.players[0].secretDraft[0];
    const keepB = state.players[1].secretDraft[0];
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    expect(state.secretObjectives.draftPending).toBe(false);
    expect(state.players[0].secretHand).toEqual([keepA]);
    expect(state.players[1].secretHand).toEqual([keepB]);
  });

  it('draw may exceed cap; DISCARD_SECRET restores limit', () => {
    let state = dispatch(baseGame(), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    // Fill to 3 slots: 1 in hand + draw 2
    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    state = dispatch(state, { type: 'DISMISS_SECRET_REVEAL', playerId: 1 });
    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    state = dispatch(state, { type: 'DISMISS_SECRET_REVEAL', playerId: 1 });
    expect(state.players[0].secretHand).toHaveLength(3);
    expect(state.secretObjectives.overflows?.['1']).toBeUndefined();

    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    expect(state.players[0].secretHand).toHaveLength(4);
    expect(state.secretObjectives.overflows?.['1']).toMatchObject({ resolveStrategy: false });
    const newCard = state.secretObjectives.pendingReveals?.['1'];
    expect(newCard).toBeTruthy();
    expect(state.players[0].secretHand).toContain(newCard);

    const blocked = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    expect(blocked).toBe(state);

    state = dispatch(state, {
      type: 'DISCARD_SECRET',
      playerId: 1,
      cardId: newCard,
    });
    expect(state.players[0].secretHand).toHaveLength(3);
    expect(state.secretObjectives.overflows?.['1']).toBeUndefined();
    expect(state.secretObjectives.deck).toContain(newCard);

    state = dispatch(state, { type: 'RAISE_SECRET_CAP', playerId: 1 });
    expect(state.players[0].secretCap).toBe(4);
    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    expect(state.players[0].secretHand).toHaveLength(4);
    expect(state.secretObjectives.overflows?.['1']).toBeUndefined();
  });

  it('concurrent draws keep separate pending reveals per seat', () => {
    let state = dispatch(baseGame(), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 1 });
    state = dispatch(state, { type: 'DRAW_SECRET', playerId: 2 });
    expect(state.secretObjectives.pendingReveals?.['1']).toBeTruthy();
    expect(state.secretObjectives.pendingReveals?.['2']).toBeTruthy();
    expect(state.secretObjectives.pendingReveals['1'])
      .not.toBe(state.secretObjectives.pendingReveals['2']);

    state = dispatch(state, { type: 'DISMISS_SECRET_REVEAL', playerId: 1 });
    expect(state.secretObjectives.pendingReveals?.['1']).toBeUndefined();
    expect(state.secretObjectives.pendingReveals?.['2']).toBeTruthy();
  });

  it('SCORE_SECRET moves hand → scored and increments VP', () => {
    let state = dispatch(baseGame(), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    const cardId = state.players[0].secretHand[0];
    state = dispatch(state, { type: 'SCORE_SECRET', playerId: 1, cardId });
    expect(state.players[0].secretHand).toEqual([]);
    expect(state.players[0].secrets).toBe(1);
    expect(state.secretObjectives.scored).toContain(cardId);
  });

  it('EXCHANGE_SECRET puts card under deck and draws a new one', () => {
    let state = dispatch(baseGame({
      vpTrack: { custodiansPlayerId: 1, mecatolControllerId: 1, supportHolders: {} },
    }), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    const old = state.players[0].secretHand[0];
    const topBefore = state.secretObjectives.deck[0];
    state = dispatch(state, { type: 'EXCHANGE_SECRET', playerId: 1, cardId: old });
    expect(state.players[0].secretHand).toEqual([topBefore]);
    expect(state.secretObjectives.deck[state.secretObjectives.deck.length - 1]).toBe(old);
    expect(state.round.secretExchangeUsed).toBe(true);
  });

  it('EXCHANGE_SECRET rejects non-controller', () => {
    let state = dispatch(baseGame({
      vpTrack: { custodiansPlayerId: 1, mecatolControllerId: 1, supportHolders: {} },
    }), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    const cardId = state.players[1].secretHand[0];
    const blocked = dispatch(state, { type: 'EXCHANGE_SECRET', playerId: 2, cardId });
    expect(blocked).toBe(state);
  });

  it('EXCHANGE_SECRET is once per round', () => {
    let state = dispatch(baseGame({
      vpTrack: { custodiansPlayerId: 1, mecatolControllerId: 1, supportHolders: {} },
    }), { type: 'START_SECRET_DRAFT' });
    state = dispatch(state, { type: 'DEV_SKIP_SECRET_DRAFT' });
    const first = state.players[0].secretHand[0];
    state = dispatch(state, { type: 'EXCHANGE_SECRET', playerId: 1, cardId: first });
    const second = state.players[0].secretHand[0];
    const blocked = dispatch(state, { type: 'EXCHANGE_SECRET', playerId: 1, cardId: second });
    expect(blocked).toBe(state);
  });

  it('first custodians claim sets VP + controller; later ADJUST_MECATOL moves only controller', () => {
    let state = baseGame();
    state = dispatch(state, { type: 'SET_CUSTODIANS', playerId: 1 });
    expect(state.vpTrack.custodiansPlayerId).toBe(1);
    expect(state.vpTrack.mecatolControllerId).toBe(1);
    state = dispatch(state, { type: 'ADJUST_MECATOL', playerId: 2, delta: 1 });
    expect(state.vpTrack.custodiansPlayerId).toBe(1);
    expect(state.vpTrack.mecatolControllerId).toBe(2);
    expect(state.players[1].extra).toBe(1);
  });
});
