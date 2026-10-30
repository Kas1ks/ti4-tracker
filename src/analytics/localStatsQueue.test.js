import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingStats,
  enqueuePendingStat,
  loadPendingStats,
  mergeStatsHistory,
  pendingOnlyCount,
  prunePendingAgainstCloud,
  savePendingStats,
} from './localStatsQueue.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
  clearPendingStats();
});

describe('localStatsQueue', () => {
  it('enqueues and dedupes by id', () => {
    enqueuePendingStat({
      id: 10,
      date: '01.01.2026',
      players: [{ name: 'A', score: 10, isWinner: true }],
      winner: 'A',
    });
    enqueuePendingStat({
      id: 10,
      date: '01.01.2026',
      players: [{ name: 'A', score: 11, isWinner: true }],
      winner: 'A',
    });
    const pending = loadPendingStats();
    expect(pending).toHaveLength(1);
    expect(pending[0].players[0].score).toBe(11);
  });

  it('merges cloud over local on id collision', () => {
    const cloud = [{
      id: 1,
      date: '01.01.2026',
      winner: 'Cloud',
      players: [{ name: 'Cloud', score: 10, isWinner: true }],
    }];
    const pending = [{
      id: 1,
      date: '01.01.2026',
      winner: 'Local',
      players: [{ name: 'Local', score: 9, isWinner: true }],
    }, {
      id: 2,
      date: '02.01.2026',
      winner: 'Local2',
      players: [{ name: 'Local2', score: 10, isWinner: true }],
    }];
    const merged = mergeStatsHistory(cloud, pending);
    expect(merged).toHaveLength(2);
    expect(merged.find((g) => String(g.id) === '1').winner).toBe('Cloud');
    expect(merged.find((g) => String(g.id) === '2')._source).toBe('local');
  });

  it('prunes pending that already exist in cloud', () => {
    savePendingStats([
      { id: 1, date: '01.01.2026', players: [{ name: 'A', score: 10, isWinner: true }], winner: 'A' },
      { id: 2, date: '02.01.2026', players: [{ name: 'B', score: 10, isWinner: true }], winner: 'B' },
    ]);
    const kept = prunePendingAgainstCloud([{ id: 1, date: '01.01.2026', players: [{ name: 'A', score: 10, isWinner: true }], winner: 'A' }]);
    expect(kept.map((g) => g.id)).toEqual([2]);
    expect(pendingOnlyCount([{ id: 1 }], kept)).toBe(1);
  });
});
