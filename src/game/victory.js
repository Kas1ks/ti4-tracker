import { activePlayers, playerScore } from './selectors';

/**
 * Host may still edit VP / close panels / undo after someone hits the target.
 * Everything else (turns, draft, scoring windows, strategy play, …) is frozen
 * until scores drop below target (manual edit or UNDO_LAST).
 */
export const VICTORY_ALLOWED_ACTIONS = new Set([
  'UNDO_LAST',
  'TOGGLE_COMPLETION',
  'ADJUST_SECRETS',
  'ADJUST_MECATOL',
  'SET_CUSTODIANS',
  'SET_SUPPORT',
  'ADD_OBJECTIVE',
  'REMOVE_OBJECTIVE',
  'DISCARD_OBJECTIVE',
  'GRANT_TECH',
  'REVOKE_TECH',
  'TOGGLE_TECH',
  'GRANT_BREAKTHROUGH',
  'REVOKE_BREAKTHROUGH',
  'SET_TARGET_SCORE',
  'TOGGLE_POLITICS_ACTIVE',
  'TOGGLE_ONE_VOTE_LAW',
  'SET_ONE_VOTE_LAW',
  'SET_DRAFT_VISIBLE',
  'SET_POLITICS_VISIBLE',
  'SET_STATUS_PHASE_VISIBLE',
  'SET_EXPEDITION_SLICE',
  'SET_SPEAKER',
  'RESET_GAME',
  'LOAD_STATE',
]);

export function isVictoryActionAllowed(type) {
  return typeof type === 'string' && VICTORY_ALLOWED_ACTIONS.has(type);
}

/** Non-eliminated seats at or above the victory target. */
export function victoryWinners(state) {
  if (!state?.isGameActive) return [];
  const target = Number(state.meta?.targetScore);
  if (!Number.isFinite(target) || target <= 0) return [];
  return activePlayers(state).filter(p => playerScore(state, p.id) >= target);
}

export function isVictoryReached(state) {
  return victoryWinners(state).length > 0;
}
