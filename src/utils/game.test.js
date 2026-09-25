import { describe, expect, it, beforeEach } from 'vitest';
import { shuffleArray, shufflePreferFresh } from './game';
import {
  RECENT_OBJECTIVES_KEY,
  readRecentObjectiveIds,
  rememberObjectiveIds,
} from '../game/objectiveHistory';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    clear: () => map.clear(),
  };
};

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

describe('shufflePreferFresh', () => {
  it('keeps the full pool and puts avoided ids later', () => {
    const pool = [
      { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
    ];
    const order = shufflePreferFresh(pool, ['a', 'b']).map(o => o.id);
    expect(order).toHaveLength(4);
    expect(new Set(order)).toEqual(new Set(['a', 'b', 'c', 'd']));
    const firstHalf = order.slice(0, 2);
    expect(firstHalf.every(id => id === 'c' || id === 'd')).toBe(true);
  });

  it('falls back to a full shuffle when all ids are recent', () => {
    const pool = [{ id: 'a' }, { id: 'b' }];
    const order = shufflePreferFresh(pool, ['a', 'b']).map(o => o.id);
    expect(new Set(order)).toEqual(new Set(['a', 'b']));
  });
});

describe('shuffleArray', () => {
  it('returns a permutation of the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleArray(input);
    expect(out).toHaveLength(5);
    expect(new Set(out)).toEqual(new Set(input));
    expect(out).not.toBe(input);
  });
});

describe('objectiveHistory', () => {
  it('remembers newest ids first and caps length', () => {
    rememberObjectiveIds(['a', 'b']);
    rememberObjectiveIds(['c', 'a']);
    expect(readRecentObjectiveIds().slice(0, 3)).toEqual(['c', 'a', 'b']);
    expect(localStorage.getItem(RECENT_OBJECTIVES_KEY)).toBeTruthy();
  });
});
