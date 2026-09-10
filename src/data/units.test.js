import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_UNITS,
  figurineColorId,
  productionTotals,
  unitResourceCost,
} from './units';

describe('production units', () => {
  it('charges infantry and fighters as 1 resource / 1 slot per 2 plastics', () => {
    const infantry = PRODUCTION_UNITS.find(u => u.id === 'infantry');
    const fighter = PRODUCTION_UNITS.find(u => u.id === 'fighter');
    expect(unitResourceCost(infantry, 2)).toBe(1);
    expect(unitResourceCost(infantry, 4)).toBe(2);
    expect(unitResourceCost(fighter, 2)).toBe(1);
  });

  it('counts paired units as one slot in totals', () => {
    const totals = productionTotals({
      infantry: 2,
      destroyer: 2,
      cruiser: 1,
    });
    // infantry 2 → 1 slot / 1⚙, destroyer 2 → 2 / 2⚙, cruiser 1 → 1 / 2⚙
    expect(totals.units).toBe(4);
    expect(totals.resources).toBe(5);
  });

  it('maps player color hex to figurine folder', () => {
    expect(figurineColorId('#3b82f6')).toBe('blue');
    expect(figurineColorId('#000000')).toBe('black');
    expect(figurineColorId('#unknown')).toBe('blue');
  });
});
