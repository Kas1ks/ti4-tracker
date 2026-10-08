/**
 * Pure helpers for optimistic + SSE seq gating (extracted for tests).
 */

/** @returns {boolean} whether this seq should replace local authority */
export function shouldApplySeq(incomingSeq, currentSeq) {
  if (typeof incomingSeq !== 'number' || !Number.isFinite(incomingSeq)) return true;
  if (typeof currentSeq !== 'number' || !Number.isFinite(currentSeq)) return true;
  return incomingSeq >= currentSeq;
}

/**
 * Soft client gate before optimistic reduce — mirrors authorizeAction outcome.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function softAuthorizeOptimistic(authResult) {
  if (!authResult) return { ok: false, error: 'forbidden' };
  if (authResult.ok === false) {
    return { ok: false, error: String(authResult.error || 'forbidden') };
  }
  return { ok: true };
}
