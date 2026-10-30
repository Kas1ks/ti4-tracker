import { describe, expect, it } from 'vitest';
import { generateFactionPool } from './generateFactionPool.js';
import { defaultMiltySettings } from './settings.js';

describe('generateFactionPool', () => {
  it('avoids previously used factions when enough remain', () => {
    const settings = defaultMiltySettings({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      numberOfFactions: 9,
      seed: 42,
    });
    const first = generateFactionPool(settings);
    const second = generateFactionPool(
      { ...settings, seed: 99 },
      { excludeIds: first.map((f) => f.id) },
    );
    const firstIds = new Set(first.map((f) => f.id));
    expect(second).toHaveLength(9);
    expect(second.every((f) => !firstIds.has(f.id))).toBe(true);
  });

  it('fills from excluded set only when pool is too small otherwise', () => {
    const settings = defaultMiltySettings({
      playerNames: ['A', 'B', 'C'],
      numberOfFactions: 5,
      seed: 7,
      factionSets: ['base'],
      includeKeleres: false,
    });
    // Base set is small; excluding almost all forces overlap.
    const first = generateFactionPool(settings);
    const second = generateFactionPool(
      { ...settings, seed: 8 },
      { excludeIds: first.map((f) => f.id) },
    );
    expect(second).toHaveLength(5);
    expect(new Set(second.map((f) => f.id)).size).toBe(5);
  });
});
