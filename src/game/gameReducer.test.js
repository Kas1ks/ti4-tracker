import { describe, expect, it } from 'vitest';
import { BASE_OBJECTIVES, STRATEGY_CARDS } from '../data/gameData';
import { gameReducer } from './gameReducer';
import { createEmptyGameState, normalizeGameState } from './gameState';
import {
  activePlayer,
  activeStrategyCard,
  canStartRound,
  currentAgenda,
  currentDraftPlayerId,
  playerScore,
  playersForBoard,
  turnOrder,
  votingOrder,
} from './selectors';

const player = (id, name, overrides = {}) => ({
  id, name, factionId: 'sol', color: '#3b82f6', secrets: 0, extra: 0,
  totalTime: 0, damageDealt: 0, eliminated: false, cards: [], ...overrides,
});

/** A started game with `count` players, no draft done yet. */
const gameWith = (players, overrides = {}) => normalizeGameState({
  ...createEmptyGameState(),
  isGameActive: true,
  players,
  meta: { ...createEmptyGameState().meta, speakerId: players[0]?.id ?? null },
  ...overrides,
});

/** Every reducer case must return new objects instead of editing the old ones. */
const dispatch = (state, action) => {
  const before = JSON.stringify(state);
  const next = gameReducer(state, action);
  expect(JSON.stringify(state)).toBe(before);
  return next;
};

const play = (state, actions) => actions.reduce(dispatch, state);

describe('unknown actions', () => {
  it('leaves the state untouched', () => {
    const state = gameWith([player(1, 'A')]);
    expect(gameReducer(state, { type: 'NOPE' })).toBe(state);
  });
});

describe('setup', () => {
  it('adds, updates and removes players', () => {
    let state = createEmptyGameState();
    state = dispatch(state, { type: 'ADD_PLAYER', playerId: 1, factionId: 'sol' });
    state = dispatch(state, { type: 'ADD_PLAYER', playerId: 2, factionId: 'hacan' });
    expect(state.players.map(p => p.name)).toEqual(['Игрок 1', 'Игрок 2']);

    state = dispatch(state, { type: 'UPDATE_PLAYER', playerId: 2, patch: { name: 'Beta', color: '#ef4444' } });
    expect(state.players[1]).toMatchObject({ name: 'Beta', color: '#ef4444', factionId: 'hacan' });

    state = dispatch(state, { type: 'REMOVE_PLAYER', playerId: 1 });
    expect(state.players.map(p => p.id)).toEqual([2]);
  });

  it('refuses a ninth player', () => {
    let state = createEmptyGameState();
    for (let id = 1; id <= 8; id += 1) {
      state = dispatch(state, { type: 'ADD_PLAYER', playerId: id, factionId: 'sol' });
    }
    expect(dispatch(state, { type: 'ADD_PLAYER', playerId: 9, factionId: 'sol' }).players).toHaveLength(8);
  });

  it('makes the first player speaker when starting without one', () => {
    const state = normalizeGameState({ players: [player(7, 'A'), player(8, 'B')] });
    expect(state.meta.speakerId).toBeNull();
    expect(dispatch(state, { type: 'START_GAME' })).toMatchObject({
      isGameActive: true,
      meta: expect.objectContaining({ speakerId: 7 }),
    });
  });

  it('keeps an already chosen speaker', () => {
    const state = gameWith([player(1, 'A'), player(2, 'B')], {
      meta: { ...createEmptyGameState().meta, speakerId: 2 },
    });
    expect(dispatch(state, { type: 'START_GAME' }).meta.speakerId).toBe(2);
  });
});

describe('scoring', () => {
  it('counts secrets, mecatol points and completed objectives', () => {
    const objective = BASE_OBJECTIVES.find(o => o.stage === 2);
    let state = gameWith([player(1, 'A'), player(2, 'B')]);
    state = dispatch(state, { type: 'ADD_OBJECTIVE', objective });
    state = dispatch(state, { type: 'ADJUST_SECRETS', playerId: 1, delta: 1 });
    state = dispatch(state, { type: 'ADJUST_MECATOL', playerId: 1, delta: 1 });
    state = dispatch(state, { type: 'TOGGLE_COMPLETION', playerId: 1, objectiveId: objective.id });

    expect(playerScore(state, 1)).toBe(2 + objective.points);
    expect(playerScore(state, 2)).toBe(0);

    state = dispatch(state, { type: 'TOGGLE_COMPLETION', playerId: 1, objectiveId: objective.id });
    expect(playerScore(state, 1)).toBe(2);
  });

  it('clamps secrets to 0..4 and mecatol points to 0', () => {
    let state = gameWith([player(1, 'A', { secrets: 4, extra: 0 })]);
    state = dispatch(state, { type: 'ADJUST_SECRETS', playerId: 1, delta: 1 });
    expect(state.players[0].secrets).toBe(4);

    state = dispatch(state, { type: 'ADJUST_MECATOL', playerId: 1, delta: -1 });
    expect(state.players[0].extra).toBe(0);
  });

  it('removes an objective without touching its recorded completions', () => {
    const objective = BASE_OBJECTIVES[0];
    let state = gameWith([player(1, 'A')]);
    state = dispatch(state, { type: 'ADD_OBJECTIVE', objective });
    state = dispatch(state, { type: 'TOGGLE_COMPLETION', playerId: 1, objectiveId: objective.id });
    state = dispatch(state, { type: 'REMOVE_OBJECTIVE', objectiveId: objective.id });

    expect(state.objectives.active).toEqual([]);
    expect(playerScore(state, 1)).toBe(0);
  });

  it('sorts the board by score, then by seat', () => {
    let state = gameWith([player(1, 'A'), player(2, 'B'), player(3, 'C')]);
    state = dispatch(state, { type: 'ADJUST_MECATOL', playerId: 3, delta: 5 });
    expect(playersForBoard(state).map(p => p.id)).toEqual([3, 1, 2]);
  });
});

describe('strategy card draft', () => {
  const fourPlayers = [player(1, 'A'), player(2, 'B'), player(3, 'C'), player(4, 'D')];

  it('queues two picks per player at four players, starting from the speaker', () => {
    const state = dispatch(
      gameWith(fourPlayers, { meta: { ...createEmptyGameState().meta, speakerId: 3 } }),
      { type: 'OPEN_DRAFT' },
    );
    expect(state.draft.queue).toEqual([3, 4, 1, 2, 3, 4, 1, 2]);
    expect(state.draft.showModal).toBe(true);
  });

  it('queues one pick per player above four players', () => {
    const five = [...fourPlayers, player(5, 'E')];
    const state = dispatch(gameWith(five), { type: 'OPEN_DRAFT' });
    expect(state.draft.queue).toEqual([1, 2, 3, 4, 5]);
  });

  it('skips eliminated players and repairs a missing speaker', () => {
    const state = dispatch(
      gameWith([player(1, 'A', { eliminated: true }), player(2, 'B'), player(3, 'C')]),
      { type: 'OPEN_DRAFT' },
    );
    // Picks per player follow the seat count, so eliminating someone does not change it.
    expect(state.draft.queue).toEqual([2, 3, 2, 3]);
    expect(state.meta.speakerId).toBe(2);
  });

  it('just reopens the modal when a draft is already running', () => {
    let state = dispatch(gameWith(fourPlayers), { type: 'OPEN_DRAFT' });
    state = dispatch(state, { type: 'PICK_CARD', cardId: 1 });
    state = dispatch(state, { type: 'SET_DRAFT_VISIBLE', visible: false });

    const reopened = dispatch(state, { type: 'OPEN_DRAFT' });
    expect(reopened.draft.showModal).toBe(true);
    expect(reopened.draft.pickOrder).toEqual([1]);
  });

  it('does not start a draft once everyone holds cards', () => {
    const withCards = fourPlayers.map(p => ({ ...p, cards: [STRATEGY_CARDS[0]] }));
    const state = gameWith(withCards);
    expect(canStartRound(state)).toBe(true);
    expect(dispatch(state, { type: 'OPEN_DRAFT' }).draft.queue).toEqual([]);
  });

  it('walks the queue and asks for confirmation after the last pick', () => {
    const twoPlayers = [player(1, 'A'), player(2, 'B')];
    let state = dispatch(gameWith(twoPlayers), { type: 'OPEN_DRAFT' });
    expect(state.draft.queue).toEqual([1, 2, 1, 2]);

    [1, 2, 3, 4].forEach(cardId => {
      expect(currentDraftPlayerId(state)).toBe(state.draft.queue[state.draft.currentQueueIndex]);
      state = dispatch(state, { type: 'PICK_CARD', cardId });
    });

    expect(state.draft.step).toBe('CONFIRM');
    expect(state.draft.assignments).toEqual({ 1: 1, 2: 2, 3: 1, 4: 2 });
  });

  it('ignores a card that is already taken', () => {
    let state = dispatch(gameWith([player(1, 'A'), player(2, 'B')]), { type: 'OPEN_DRAFT' });
    state = dispatch(state, { type: 'PICK_CARD', cardId: 5 });
    const again = dispatch(state, { type: 'PICK_CARD', cardId: 5 });
    expect(again.draft.pickOrder).toEqual([5]);
  });

  it('undoes the last pick and hands the turn back', () => {
    let state = dispatch(gameWith([player(1, 'A'), player(2, 'B')]), { type: 'OPEN_DRAFT' });
    state = dispatch(state, { type: 'PICK_CARD', cardId: 1 });
    state = dispatch(state, { type: 'PICK_CARD', cardId: 2 });
    state = dispatch(state, { type: 'UNDO_PICK' });

    expect(state.draft.assignments).toEqual({ 1: 1 });
    expect(state.draft.currentQueueIndex).toBe(1);
    expect(currentDraftPlayerId(state)).toBe(2);

    expect(dispatch(dispatch(state, { type: 'UNDO_PICK' }), { type: 'UNDO_PICK' }).draft.pickOrder).toEqual([]);
  });

  it('lets a card be reassigned before confirming', () => {
    let state = dispatch(gameWith([player(1, 'A'), player(2, 'B')]), { type: 'OPEN_DRAFT' });
    state = dispatch(state, { type: 'PICK_CARD', cardId: 1 });
    state = dispatch(state, { type: 'REASSIGN_CARD', cardId: 1, playerId: '2' });
    expect(state.draft.assignments).toEqual({ 1: 2 });
  });

  it('hands out cards, sets initiative and grows the bonus on untaken cards', () => {
    let state = dispatch(gameWith([player(1, 'A'), player(2, 'B')]), { type: 'OPEN_DRAFT' });
    state = play(state, [
      { type: 'PICK_CARD', cardId: 4 },
      { type: 'PICK_CARD', cardId: 3 },
      { type: 'PICK_CARD', cardId: 7 },
      { type: 'PICK_CARD', cardId: 8 },
      { type: 'CONFIRM_DRAFT' },
    ]);

    expect(state.players[0].cards.map(c => c.id)).toEqual([4, 7]);
    expect(state.players[0].lastMinInitiative).toBe(4);
    expect(state.players[1].cards.map(c => c.id)).toEqual([3, 8]);
    expect(state.players[1].lastMinInitiative).toBe(3);

    expect(state.draft.strategyCardBonuses[4]).toBe(0);
    expect(state.draft.strategyCardBonuses[1]).toBe(1);
    expect(state.draft.queue).toEqual([]);
    expect(state.draft.showModal).toBe(false);
  });

  it('keeps stacking the bonus over rounds a card is skipped', () => {
    let state = gameWith([player(1, 'A'), player(2, 'B')]);
    for (let round = 0; round < 2; round += 1) {
      state = play(state, [
        { type: 'OPEN_DRAFT' },
        { type: 'PICK_CARD', cardId: 4 },
        { type: 'PICK_CARD', cardId: 3 },
        { type: 'PICK_CARD', cardId: 7 },
        { type: 'PICK_CARD', cardId: 8 },
        { type: 'CONFIRM_DRAFT' },
        { type: 'START_ROUND' },
        { type: 'CONFIRM_STATUS_PHASE' },
      ]);
    }
    expect(state.draft.strategyCardBonuses[1]).toBe(2);
  });
});

describe('round and turn order', () => {
  const drafted = () => gameWith([
    player(1, 'A', { cards: [STRATEGY_CARDS[2]], lastMinInitiative: 3 }),
    player(2, 'B', { cards: [STRATEGY_CARDS[0]], lastMinInitiative: 1 }),
    player(3, 'C', { cards: [STRATEGY_CARDS[1]], lastMinInitiative: 2 }),
  ]);

  it('orders the round by initiative and clears per-round player flags', () => {
    const state = dispatch(drafted(), { type: 'START_ROUND' });
    expect(state.round.turnOrderIds).toEqual([2, 3, 1]);
    expect(state.round.active).toBe(true);
    expect(activePlayer(state).id).toBe(2);
    expect(activeStrategyCard(state).id).toBe(1);
    expect(state.players.every(p => !p.passed && !p.strategyPlayed)).toBe(true);
  });

  it('puts Naalu ahead of everyone regardless of initiative', () => {
    const state = dispatch(gameWith([
      player(1, 'A', { lastMinInitiative: 1 }),
      player(2, 'Naalu', { factionId: 'naalu', lastMinInitiative: 8 }),
    ]), { type: 'START_ROUND' });
    expect(state.round.turnOrderIds).toEqual([2, 1]);
  });

  it('leaves eliminated players out of the turn order', () => {
    const state = dispatch(gameWith([
      player(1, 'A', { lastMinInitiative: 1 }),
      player(2, 'B', { lastMinInitiative: 2, eliminated: true }),
    ]), { type: 'START_ROUND' });
    expect(state.round.turnOrderIds).toEqual([1]);
    expect(turnOrder(state)).toHaveLength(1);
  });

  it('marks only the active player strategy as played', () => {
    let state = dispatch(drafted(), { type: 'START_ROUND' });
    state = dispatch(state, { type: 'PLAY_STRATEGY' });
    expect(state.players.find(p => p.id === 2).strategyPlayed).toBe(true);
    expect(state.players.find(p => p.id === 2).playedCardIds).toEqual([1]);
    expect(state.players.find(p => p.id === 3).strategyPlayed).toBe(false);
  });

  it('plays each strategy card separately when a player holds two', () => {
    let state = gameWith([
      player(1, 'A', { cards: [STRATEGY_CARDS[0], STRATEGY_CARDS[3]], lastMinInitiative: 1 }),
      player(2, 'B', { cards: [STRATEGY_CARDS[1]], lastMinInitiative: 2 }),
    ]);
    state = dispatch(state, { type: 'START_ROUND' });
    expect(activePlayer(state).id).toBe(1);

    state = dispatch(state, { type: 'PLAY_STRATEGY', cardId: 4 });
    expect(state.players.find(p => p.id === 1).playedCardIds).toEqual([4]);
    expect(state.players.find(p => p.id === 1).strategyPlayed).toBe(false);
    expect(state.round.strategyActionTaken).toBe(true);

    // Second card blocked until next turn
    const blocked = dispatch(state, { type: 'PLAY_STRATEGY', cardId: 1 });
    expect(blocked.players.find(p => p.id === 1).playedCardIds).toEqual([4]);

    state = dispatch(state, { type: 'NEXT_TURN' });
    state = dispatch(state, { type: 'NEXT_TURN' }); // back to player 1
    expect(activePlayer(state).id).toBe(1);
    expect(state.round.strategyActionTaken).toBe(false);

    state = dispatch(state, { type: 'PLAY_STRATEGY', cardId: 1 });
    expect(state.players.find(p => p.id === 1).playedCardIds).toEqual([4, 1]);
    expect(state.players.find(p => p.id === 1).strategyPlayed).toBe(true);
  });

  it('builds clockwise voting order with speaker last', () => {
    const state = normalizeGameState({
      isGameActive: true,
      players: [
        player(1, 'A'),
        player(2, 'B'),
        player(3, 'C'),
        player(4, 'D'),
      ],
      speakerId: 2,
      politicsStep: 'VOTE',
      agendas: [{ type: 'FOR_AGAINST', votes: {}, locked: {} }],
    });
    expect(votingOrder(state).map(p => p.id)).toEqual([3, 4, 1, 2]);

    const reversed = gameReducer(state, { type: 'TOGGLE_VOTE_REVERSED' });
    expect(votingOrder(reversed).map(p => p.id)).toEqual([1, 4, 3, 2]);
  });

  it('banks wall-clock elapsed into totalTime on NEXT_TURN', () => {
    const t0 = 1_000_000;
    let state = dispatch(drafted(), { type: 'START_ROUND', at: t0 });
    expect(state.round.turnStartedAt).toBe(t0);

    state = dispatch(state, { type: 'NEXT_TURN', at: t0 + 5000 });
    expect(activePlayer(state).id).toBe(3);
    expect(state.round.turnTime).toBe(0);
    expect(state.round.turnStartedAt).toBe(t0 + 5000);
    expect(state.players.find(p => p.id === 2).totalTime).toBe(5);
    expect(state.players.find(p => p.id === 3).totalTime).toBe(0);
  });

  it('moves to the next player and resets the turn clock', () => {
    const t0 = 2_000_000;
    let state = dispatch(drafted(), { type: 'START_ROUND', at: t0 });
    state = dispatch(state, { type: 'NEXT_TURN', at: t0 + 1000 });
    expect(activePlayer(state).id).toBe(3);
    expect(state.round.turnTime).toBe(0);
    expect(state.round.turnStartedAt).toBe(t0 + 1000);
  });

  it('legacy TICK only bumps turnTime without double-counting totalTime', () => {
    const t0 = 3_000_000;
    let state = dispatch(drafted(), { type: 'START_ROUND', at: t0 });
    state = dispatch(state, { type: 'TICK' });
    state = dispatch(state, { type: 'TICK' });
    expect(state.round.turnTime).toBe(2);
    expect(state.players.find(p => p.id === 2).totalTime).toBe(0);
  });

  it('skips players who already passed', () => {
    let state = dispatch(drafted(), { type: 'START_ROUND' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 2 });
    expect(activePlayer(state).id).toBe(3);

    state = dispatch(state, { type: 'NEXT_TURN' });
    expect(activePlayer(state).id).toBe(1);

    state = dispatch(state, { type: 'NEXT_TURN' });
    expect(activePlayer(state).id).toBe(3);
  });

  it('opens the status phase when the last player passes', () => {
    let state = dispatch(drafted(), { type: 'START_ROUND' });
    state = play(state, [
      { type: 'PASS_TURN', playerId: 2 },
      { type: 'PASS_TURN', playerId: 3 },
    ]);
    expect(state.statusPhase.show).toBe(false);

    state = dispatch(state, { type: 'PASS_TURN', playerId: 1 });
    expect(state.statusPhase.show).toBe(true);
  });

  it('opens the agenda phase instead when one is pending', () => {
    let state = drafted();
    state = { ...state, meta: { ...state.meta, isAgendaPhasePending: true } };
    state = dispatch(state, { type: 'END_ROUND' });
    expect(state.politics.showModal).toBe(true);
    expect(state.statusPhase.show).toBe(false);
  });
});

describe('eliminating a player', () => {
  const running = () => gameReducer(gameWith([
    player(1, 'A', { lastMinInitiative: 1 }),
    player(2, 'B', { lastMinInitiative: 2 }),
    player(3, 'C', { lastMinInitiative: 3 }),
  ]), { type: 'START_ROUND' });

  it('passes them and moves the turn on if it was theirs', () => {
    const state = dispatch(running(), { type: 'ELIMINATE_PLAYER', playerId: 1 });
    expect(state.players.find(p => p.id === 1).eliminated).toBe(true);
    expect(state.round.passed[1]).toBe(true);
    expect(activePlayer(state).id).toBe(2);
  });

  it('leaves the turn alone when someone else is eliminated', () => {
    const state = dispatch(running(), { type: 'ELIMINATE_PLAYER', playerId: 3 });
    expect(activePlayer(state).id).toBe(1);
  });

  it('hands the speaker token to the next player still in the game', () => {
    let state = running();
    expect(state.meta.speakerId).toBe(1);
    state = dispatch(state, { type: 'ELIMINATE_PLAYER', playerId: 1 });
    expect(state.meta.speakerId).toBe(2);
  });

  it('skips an already eliminated player when moving the speaker token', () => {
    let state = running();
    state = dispatch(state, { type: 'ELIMINATE_PLAYER', playerId: 2 });
    state = dispatch(state, { type: 'ELIMINATE_PLAYER', playerId: 1 });
    expect(state.meta.speakerId).toBe(3);
  });

  it('ends the round when the last active player is eliminated', () => {
    let state = running();
    state = play(state, [
      { type: 'PASS_TURN', playerId: 1 },
      { type: 'PASS_TURN', playerId: 2 },
    ]);
    state = dispatch(state, { type: 'ELIMINATE_PLAYER', playerId: 3 });
    expect(state.statusPhase.show).toBe(true);
  });

  it('ignores an unknown player', () => {
    const state = running();
    expect(dispatch(state, { type: 'ELIMINATE_PLAYER', playerId: 99 })).toBe(state);
  });
});

describe('status phase', () => {
  const atStatusPhase = () => {
    const state = gameReducer(gameWith([player(1, 'A'), player(2, 'B')]), { type: 'START_ROUND' });
    return gameReducer(state, { type: 'END_ROUND' });
  };

  it('does not toggle scoreObjectives via the checklist — scoring window owns that step', () => {
    const state = dispatch(atStatusPhase(), { type: 'TOGGLE_STATUS_CHECK', key: 'scoreObjectives' });
    expect(state.statusPhase.checks.scoreObjectives).toBe(false);
  });

  it('ticks the other checklist items independently', () => {
    let state = dispatch(atStatusPhase(), { type: 'TOGGLE_STATUS_CHECK', key: 'drawActionCards' });
    expect(state.statusPhase.checks).toMatchObject({ drawActionCards: true, scoreObjectives: false });

    state = dispatch(state, { type: 'TOGGLE_STATUS_CHECK', key: 'drawActionCards' });
    expect(state.statusPhase.checks.drawActionCards).toBe(false);
  });

  it('opens an objective scoring window and completes when everyone responds', () => {
    const objective = BASE_OBJECTIVES[0];
    let state = dispatch(atStatusPhase(), { type: 'ADD_OBJECTIVE', objective });
    state = dispatch(state, { type: 'START_OBJECTIVE_SCORING' });
    expect(state.statusPhase.scoring.active).toBe(true);
    expect(state.statusPhase.scoring.orderIds[0]).toBe(1);
    expect(state.statusPhase.scoring.currentIdx).toBe(0);
    expect(state.statusPhase.scoring.responses[1].status).toBe('pending');

    state = dispatch(state, { type: 'SELECT_SCORING_PUBLIC', playerId: 1, objectiveId: objective.id });
    expect(state.objectives.completions[`1_${objective.id}`]).toBe(true);
    state = dispatch(state, { type: 'TOGGLE_SCORING_SECRET', playerId: 1 });
    expect(state.players.find(p => p.id === 1).secrets).toBe(1);
    state = dispatch(state, { type: 'CONFIRM_OBJECTIVE_SCORING', playerId: 1 });
    expect(state.statusPhase.scoring.responses[1].status).toBe('done');
    expect(state.statusPhase.scoring.currentIdx).toBe(1);
    expect(state.statusPhase.scoring.active).toBe(true);

    state = dispatch(state, { type: 'PASS_OBJECTIVE_SCORING', playerId: 2 });
    expect(state.statusPhase.scoring.active).toBe(false);
    expect(state.statusPhase.checks.scoreObjectives).toBe(true);
    expect(state.players.find(p => p.id === 1).secrets).toBe(1);
  });

  it('blocks scoring out of initiative order', () => {
    const objective = BASE_OBJECTIVES[0];
    let state = dispatch(atStatusPhase(), { type: 'ADD_OBJECTIVE', objective });
    state = dispatch(state, { type: 'START_OBJECTIVE_SCORING' });

    const blocked = dispatch(state, { type: 'SELECT_SCORING_PUBLIC', playerId: 2, objectiveId: objective.id });
    expect(blocked).toBe(state);
    expect(state.objectives.completions[`2_${objective.id}`]).toBeFalsy();

    const blockedPass = dispatch(state, { type: 'PASS_OBJECTIVE_SCORING', playerId: 2 });
    expect(blockedPass).toBe(state);
  });

  it('uses round initiative order for scoring', () => {
    let state = gameWith([
      player(1, 'A', { lastMinInitiative: 5 }),
      player(2, 'B', { lastMinInitiative: 1 }),
      player(3, 'C', { lastMinInitiative: 3 }),
    ]);
    state = dispatch(state, { type: 'START_ROUND' });
    state = dispatch(state, { type: 'END_ROUND' });
    state = dispatch(state, { type: 'START_OBJECTIVE_SCORING' });
    expect(state.statusPhase.scoring.orderIds).toEqual([2, 3, 1]);
    expect(state.statusPhase.scoring.currentIdx).toBe(0);
  });

  it('pass undoes public and secret picks made in the window', () => {
    const objective = BASE_OBJECTIVES[0];
    let state = dispatch(atStatusPhase(), { type: 'ADD_OBJECTIVE', objective });
    state = dispatch(state, { type: 'START_OBJECTIVE_SCORING' });
    state = dispatch(state, { type: 'SELECT_SCORING_PUBLIC', playerId: 1, objectiveId: objective.id });
    state = dispatch(state, { type: 'TOGGLE_SCORING_SECRET', playerId: 1 });
    state = dispatch(state, { type: 'PASS_OBJECTIVE_SCORING', playerId: 1 });

    expect(state.objectives.completions[`1_${objective.id}`]).toBe(false);
    expect(state.players.find(p => p.id === 1).secrets).toBe(0);
    expect(state.statusPhase.scoring.responses[1].status).toBe('passed');
  });

  it('limits players to one public objective per scoring window', () => {
    const a = BASE_OBJECTIVES[0];
    const b = BASE_OBJECTIVES[1];
    let state = atStatusPhase();
    state = dispatch(state, { type: 'ADD_OBJECTIVE', objective: a });
    state = dispatch(state, { type: 'ADD_OBJECTIVE', objective: b });
    state = dispatch(state, { type: 'START_OBJECTIVE_SCORING' });
    state = dispatch(state, { type: 'SELECT_SCORING_PUBLIC', playerId: 1, objectiveId: a.id });
    state = dispatch(state, { type: 'SELECT_SCORING_PUBLIC', playerId: 1, objectiveId: b.id });

    expect(state.objectives.completions[`1_${a.id}`]).toBe(false);
    expect(state.objectives.completions[`1_${b.id}`]).toBe(true);
    expect(state.statusPhase.scoring.responses[1].publicId).toBe(b.id);
  });

  it('starts the next round and clears the checklist when politics is off', () => {
    const state = dispatch(atStatusPhase(), { type: 'CONFIRM_STATUS_PHASE' });
    expect(state.meta.roundNumber).toBe(2);
    expect(state.round.active).toBe(false);
    expect(state.round.turnOrderIds).toEqual([]);
    expect(state.players.every(p => p.cards.length === 0)).toBe(true);
    expect(state.statusPhase.show).toBe(false);
    expect(state.statusPhase.checks.drawActionCards).toBe(false);
    expect(state.statusPhase.scoring.active).toBe(false);
    expect(state.politics.showModal).toBe(false);
  });

  it('goes to the agenda phase when politics is on', () => {
    let state = atStatusPhase();
    state = dispatch(state, { type: 'TOGGLE_POLITICS_ACTIVE' });
    state = dispatch(state, { type: 'CONFIRM_STATUS_PHASE' });

    expect(state.meta.roundNumber).toBe(1);
    expect(state.meta.isAgendaPhasePending).toBe(true);
    expect(state.politics).toMatchObject({ showModal: true, step: 'SETUP', currentAgendaIndex: 0 });
    expect(state.politics.agendas).toEqual([{ type: null, votes: {}, locked: {} }]);
  });
});

describe('agenda phase', () => {
  const voting = () => {
    let state = gameWith([player(1, 'A'), player(2, 'B')]);
    state = gameReducer(state, { type: 'TOGGLE_POLITICS_ACTIVE' });
    state = gameReducer(state, { type: 'START_ROUND' });
    state = gameReducer(state, { type: 'END_ROUND' });
    return gameReducer(state, { type: 'CONFIRM_STATUS_PHASE' });
  };

  it('records votes without editing the previous state', () => {
    const before = voting();
    const after = dispatch(before, { type: 'SET_VOTE', playerId: 1, vote: 'FOR' });

    expect(currentAgenda(after).votes).toEqual({ 1: 'FOR' });
    expect(currentAgenda(before).votes).toEqual({});
  });

  it('locks a single player vote', () => {
    let state = dispatch(voting(), { type: 'SET_VOTE', playerId: 2, vote: 'AGAINST' });
    state = dispatch(state, { type: 'LOCK_VOTE', playerId: 2 });
    expect(currentAgenda(state).locked).toEqual({ 2: true });
  });

  it('seeds custom choices only for a custom agenda', () => {
    let state = dispatch(voting(), { type: 'SET_AGENDA_TYPE', agendaType: 'OTHER' });
    expect(currentAgenda(state)).toMatchObject({ type: 'OTHER', customChoices: [''] });

    state = dispatch(state, { type: 'SET_AGENDA_CUSTOM_CHOICES', choices: ['Мир', 'Война'] });
    expect(currentAgenda(state).customChoices).toEqual(['Мир', 'Война']);

    state = dispatch(state, { type: 'SET_AGENDA_TYPE', agendaType: 'FOR_AGAINST' });
    expect(currentAgenda(state).customChoices).toBeUndefined();
  });

  it('appends a blank second agenda and keeps the first one intact', () => {
    let state = dispatch(voting(), { type: 'SET_VOTE', playerId: 1, vote: 'FOR' });
    state = dispatch(state, { type: 'NEXT_AGENDA' });

    expect(state.politics.currentAgendaIndex).toBe(1);
    expect(state.politics.agendas).toHaveLength(2);
    expect(state.politics.agendas[0].votes).toEqual({ 1: 'FOR' });
    expect(currentAgenda(state).votes).toEqual({});
  });

  it('stays on the voting step so influence is entered only once', () => {
    let state = dispatch(voting(), { type: 'SET_POLITICS_STEP', step: 'VOTE' });
    state = dispatch(state, { type: 'NEXT_AGENDA' });
    expect(state.politics.step).toBe('VOTE');
    expect(state.politics.agendas).toHaveLength(2);
  });

  it('starts the next round when the agenda phase finishes', () => {
    const state = dispatch(voting(), { type: 'FINISH_AGENDA_PHASE' });
    expect(state.politics.showModal).toBe(false);
    expect(state.meta.isAgendaPhasePending).toBe(false);
    expect(state.meta.roundNumber).toBe(2);
  });

  it('tracks influence spent per player', () => {
    const state = dispatch(voting(), { type: 'SET_INFLUENCE', playerId: 2, influence: 6 });
    expect(state.players.find(p => p.id === 2).influence).toBe(6);
  });
});

describe('combat', () => {
  it('adds dealt damage to both sides at once', () => {
    const state = dispatch(gameWith([player(1, 'A'), player(2, 'B'), player(3, 'C')]), {
      type: 'ADD_COMBAT_DAMAGE',
      damageByPlayerId: { 1: 3, 2: 5 },
    });
    expect(state.players.map(p => p.damageDealt)).toEqual([3, 5, 0]);
  });
});

describe('whole-document actions', () => {
  it('loads a snapshot and marks the game active', () => {
    const state = dispatch(createEmptyGameState(), {
      type: 'LOAD_STATE',
      state: { players: [player(1, 'A')], roundNumber: 6, targetScore: 12 },
    });
    expect(state).toMatchObject({
      isGameActive: true,
      meta: expect.objectContaining({ roundNumber: 6, targetScore: 12 }),
    });
    expect(state.players).toHaveLength(1);
  });

  it('resets to an empty game', () => {
    const running = gameReducer(gameWith([player(1, 'A')]), { type: 'START_ROUND' });
    const state = dispatch(running, { type: 'RESET_GAME' });
    expect(state.isGameActive).toBe(false);
    expect(state.players).toEqual([]);
    expect(state.meta.roundNumber).toBe(1);
  });
});
