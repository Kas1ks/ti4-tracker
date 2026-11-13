import { describe, expect, it, vi } from 'vitest';
import { applyRateLimitHit, pruneRateLimitMap } from './rateLimitCore.js';
import { consumeRateLimitEnv, FAIL_CLOSED_BUCKETS } from './RateLimitGate.js';

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

  it('failClosed denies when DO throws (no memory bypass)', async () => {
    const env = {
      RATE_LIMIT: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({
          fetch: async () => {
            throw new Error('do-down');
          },
        }),
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hit = await consumeRateLimitEnv(env, 'host-secret:1.1.1.1', {
      limit: 5,
      windowMs: 60_000,
      failClosed: true,
    });
    spy.mockRestore();
    expect(hit).toEqual({ ok: false, retryAfterMs: 60_000, unavailable: true });
  });

  it('soft buckets fall back to memory when DO throws', async () => {
    const env = {
      RATE_LIMIT: {
        idFromName: () => ({ toString: () => 'id' }),
        get: () => ({
          fetch: async () => {
            throw new Error('do-down');
          },
        }),
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const key = `admin-poll:soft-${Math.random()}`;
    const hit = await consumeRateLimitEnv(env, key, {
      limit: 2,
      windowMs: 60_000,
      failClosed: false,
    });
    spy.mockRestore();
    expect(hit.ok).toBe(true);
  });

  it('marks host-secret and admin-auth as fail-closed buckets', () => {
    expect(FAIL_CLOSED_BUCKETS.has('host-secret')).toBe(true);
    expect(FAIL_CLOSED_BUCKETS.has('admin-auth')).toBe(true);
    expect(FAIL_CLOSED_BUCKETS.has('admin-poll')).toBe(false);
  });
});
