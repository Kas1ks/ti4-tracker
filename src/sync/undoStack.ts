import type { GameState } from '../game/types';

/** Max previous game states kept for host undo. */
export const UNDO_STACK_LIMIT = 40;

export function cloneGameState<T>(state: T): T {
  if (state == null) return state;
  try {
    return structuredClone(state);
  } catch {
    return JSON.parse(JSON.stringify(state)) as T;
  }
}

export function pushUndoSnapshot(
  stack: GameState[] | null | undefined,
  state: GameState,
  limit = UNDO_STACK_LIMIT,
): GameState[] {
  const next = Array.isArray(stack) ? stack.slice() : [];
  next.push(cloneGameState(state));
  while (next.length > limit) next.shift();
  return next;
}

export function popUndoSnapshot(stack: GameState[] | null | undefined): {
  stack: GameState[];
  state: GameState | null;
} {
  if (!Array.isArray(stack) || stack.length === 0) {
    return { stack: Array.isArray(stack) ? stack : [], state: null };
  }
  const next = stack.slice();
  const state = next.pop() ?? null;
  return { stack: next, state };
}

export function undoStackDepth(stack: GameState[] | null | undefined): number {
  return Array.isArray(stack) ? stack.length : 0;
}
