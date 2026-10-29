import { describe, expect, it } from 'vitest';
import { generateSlicePool } from './generateSlicePool.js';
import { defaultMiltySettings } from './settings.js';
import { countSpecials, tileArrangementIsValid } from './tiles.js';

describe('generateSlicePool', () => {
  it('generates N valid slices for 6p base+pok', () => {
    const settings = defaultMiltySettings({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      numberOfSlices: 6,
      seed: 42,
      minInf: 4,
      minRes: 2.5,
      minTotal: 9,
      maxTotal: 13,
      minLegendaries: 0,
      minTwoWormholes: false,
    });
    const { slices, seed } = generateSlicePool(settings);
    expect(seed).toBe(42);
    expect(slices).toHaveLength(6);
    for (const s of slices) {
      expect(s.tileIds).toHaveLength(5);
      expect(s.optimalTotal).toBeGreaterThanOrEqual(9);
      expect(s.optimalTotal).toBeLessThanOrEqual(13);
      const special = countSpecials(s.tiles);
      expect(special.alpha).toBeLessThanOrEqual(1);
      expect(special.beta).toBeLessThanOrEqual(1);
      expect(special.legendary).toBeLessThanOrEqual(1);
      expect(tileArrangementIsValid(s.tiles)).toBe(true);
    }
  });

  it('is stable for the same seed', () => {
    const settings = defaultMiltySettings({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      numberOfSlices: 6,
      seed: 99,
      minLegendaries: 0,
      minTwoWormholes: false,
    });
    const a = generateSlicePool(settings).slices.map((s) => s.tileIds.join(','));
    const b = generateSlicePool(settings).slices.map((s) => s.tileIds.join(','));
    expect(a).toEqual(b);
  });
});
