/** Max previous game states kept for host undo. */
export const UNDO_STACK_LIMIT = 40;

export function cloneGameState(state) {
  if (state == null) return state;
  try {
    return structuredClone(state);
  } catch {
    return JSON.parse(JSON.stringify(state));
  }
}

export function pushUndoSnapshot(stack, state, limit = UNDO_STACK_LIMIT) {
  const next = Array.isArray(stack) ? stack.slice() : [];
  next.push(cloneGameState(state));
  while (next.length > limit) next.shift();
  return next;
}

export function popUndoSnapshot(stack) {
  if (!Array.isArray(stack) || stack.length === 0) {
    return { stack: Array.isArray(stack) ? stack : [], state: null };
  }
  const next = stack.slice();
  const state = next.pop();
  return { stack: next, state };
}

export function undoStackDepth(stack) {
  return Array.isArray(stack) ? stack.length : 0;
}
