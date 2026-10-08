import { describe, expect, it } from 'vitest';
import {
  randomHostKey,
  randomRoomId,
  randomSaveCode,
  randomSeatSecret,
} from './cryptoCodes.js';
import { timingSafeEqualString, consumeRateLimit } from './secureCompare.js';

describe('cryptoCodes', () => {
  it('makes room ids of length 6', () => {
    expect(randomRoomId()).toHaveLength(6);
  });

  it('makes seat secrets of at least 8 chars', () => {
    expect(randomSeatSecret()).toHaveLength(8);
    expect(randomSeatSecret(10)).toHaveLength(10);
  });

  it('makes save codes of length 10', () => {
    expect(randomSaveCode()).toHaveLength(10);
  });

  it('makes host keys', () => {
    expect(randomHostKey().length).toBeGreaterThan(8);
  });
});

describe('secureCompare', () => {
  it('compares equal strings', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
  });

  it('rate-limits after threshold', () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i += 1) {
      expect(consumeRateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    expect(consumeRateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(false);
  });
});
