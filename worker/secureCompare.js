import { applyRateLimitHit } from './rateLimit/rateLimitCore.js';

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

/** Simple per-isolate sliding-window rate limit (dev / DO fallback). */
const buckets = new Map();

/**
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number }} [opts]
 * @returns {{ ok: true } | { ok: false, retryAfterMs: number }}
 */
export function consumeRateLimit(key, opts = {}) {
  const now = Date.now();
  const prev = buckets.get(key) || null;
  const hit = applyRateLimitHit(prev, now, opts);
  buckets.set(key, hit.entry);
  if (!hit.ok) {
    return { ok: false, retryAfterMs: hit.retryAfterMs ?? 0 };
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
