import { describe, expect, it } from 'vitest';
import { applyRateLimitHit, pruneRateLimitMap } from './rateLimitCore.js';
import { consumeRateLimitEnv } from './RateLimitGate.js';

describe('applyRateLimitHit', () => {
  it('allows up to limit then blocks within the window', () => {
    const now = 1_000_000;
    let entry = null;
    for (let i = 0; i < 3; i += 1) {
      const hit = applyRateLimitHit(entry, now + i, { limit: 3, windowMs: 60_000 });
      expect(hit.ok).toBe(true);
      entry = hit.entry;
    }
    const blocked = applyRateLimitHit(entry, now + 10, { limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window', () => {
    const now = 1_000_000;
    const first = applyRateLimitHit(null, now, { limit: 1, windowMs: 1000 });
    expect(first.ok).toBe(true);
    const blocked = applyRateLimitHit(first.entry, now + 100, { limit: 1, windowMs: 1000 });
    expect(blocked.ok).toBe(false);
    const fresh = applyRateLimitHit(first.entry, now + 1000, { limit: 1, windowMs: 1000 });
    expect(fresh.ok).toBe(true);
    expect(fresh.entry.count).toBe(1);
  });
});

describe('pruneRateLimitMap', () => {
  it('drops expired keys', () => {
    const now = 10_000;
    const map = pruneRateLimitMap({
      keep: { windowStart: now - 1000, count: 2 },
      drop: { windowStart: now - 120_000, count: 9 },
    }, now, 60_000);
    expect(map.keep).toBeTruthy();
    expect(map.drop).toBeUndefined();
  });
});

describe('consumeRateLimitEnv', () => {
  it('falls back to memory when RATE_LIMIT binding is missing', async () => {
    const key = `mem-${Math.random()}`;
    for (let i = 0; i < 2; i += 1) {
      const hit = await consumeRateLimitEnv({}, key, { limit: 2, windowMs: 60_000 });
      expect(hit.ok).toBe(true);
    }
    const blocked = await consumeRateLimitEnv({}, key, { limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
  });
});
