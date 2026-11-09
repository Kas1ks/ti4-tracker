/**
 * Sliding fixed-window counter (shared by memory + Durable Object).
 * @param {{ windowStart: number, count: number } | null | undefined} prev
 * @param {number} now
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {{
 *   entry: { windowStart: number, count: number },
 *   ok: boolean,
 *   retryAfterMs?: number,
 * }}
 */
export function applyRateLimitHit(prev, now, opts = {}) {
  const limit = Math.max(1, opts.limit ?? 20);
  const windowMs = Math.max(1000, opts.windowMs ?? 60_000);
  if (!prev || now - prev.windowStart >= windowMs) {
    return { entry: { windowStart: now, count: 1 }, ok: true };
  }
  const count = prev.count + 1;
  if (count > limit) {
    return {
      entry: prev,
      ok: false,
      retryAfterMs: Math.max(0, windowMs - (now - prev.windowStart)),
    };
  }
  return { entry: { windowStart: prev.windowStart, count }, ok: true };
}

/** Drop expired bucket entries (keeps DO storage bounded). */
export function pruneRateLimitMap(map, now, windowMs = 60_000) {
  const next = { ...(map || {}) };
  for (const key of Object.keys(next)) {
    const row = next[key];
    if (!row || now - row.windowStart >= windowMs) delete next[key];
  }
  return next;
}
