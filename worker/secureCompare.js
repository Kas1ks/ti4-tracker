/**
 * Timing-safe string compare (UTF-16 code units). Length mismatch still iterates.
 * @param {string} a
 * @param {string} b
 */
export function timingSafeEqualString(a, b) {
  const left = typeof a === 'string' ? a : '';
  const right = typeof b === 'string' ? b : '';
  const max = Math.max(left.length, right.length);
  let mismatch = left.length === right.length ? 0 : 1;
  for (let i = 0; i < max; i += 1) {
    const lc = i < left.length ? left.charCodeAt(i) : 0;
    const rc = i < right.length ? right.charCodeAt(i) : 0;
    mismatch |= lc ^ rc;
  }
  return mismatch === 0;
}

/** Simple per-isolate sliding-window rate limit. */
const buckets = new Map();

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {{ ok: true } | { ok: false, retryAfterMs: number }}
 */
export function consumeRateLimit(key, opts = {}) {
  const limit = Math.max(1, opts.limit ?? 20);
  const windowMs = Math.max(1000, opts.windowMs ?? 60_000);
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0 };
    buckets.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, retryAfterMs: windowMs - (now - entry.windowStart) };
  }
  return { ok: true };
}

/** Prefer client IP when present (CF / proxies). */
export function clientKey(request) {
  const cf = request?.headers?.get?.('cf-connecting-ip');
  if (cf) return cf;
  const fwd = request?.headers?.get?.('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return 'unknown';
}
