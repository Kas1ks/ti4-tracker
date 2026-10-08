import { withDraft, withMeta, withRound, mapPlayers } from '../stateHelpers';
import {
  EMPTY_STRATEGY_RESOLUTION,
  EMPTY_IMPERIAL_CLAIM,
  EMPTY_TECH_RESEARCH,
} from '../gameState';
import { clearedDraft } from './draftPhase';

export function startNewRound(state) {
  const next = mapPlayers(
    withMeta(state, { isAgendaPhasePending: false, roundNumber: state.meta.roundNumber + 1 }),
    player => ({
      ...player,
      strategyPlayed: false,
      playedCardIds: [],
      passed: false,
      cards: [],
    }),
  );

  return withDraft(
    withRound(next, {
      active: false,
      turnOrderIds: [],
      activeTurnIdx: 0,
      passed: {},
      turnTime: 0,
      turnStartedAt: null,
      roundStartedAt: null,
      turnPausedAccum: 0,
      strategyActionTaken: false,
      expeditionClaimedThisTurn: false,
      expeditionClaimedSliceId: null,
      strategyResolution: { ...EMPTY_STRATEGY_RESOLUTION },
      imperialClaim: { ...EMPTY_IMPERIAL_CLAIM },
      techResearch: { ...EMPTY_TECH_RESEARCH, picks: [], queueIds: [], byPlayer: {} },
    }),
    clearedDraft,
  );
}
