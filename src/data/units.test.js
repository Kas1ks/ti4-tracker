import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_UNITS,
  figurineColorId,
  productionTotals,
  unitCostForPlayer,
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

  it('applies Sarween Tools −1 to combined cost', () => {
    const totals = productionTotals(
      { destroyer: 2 },
      { techIds: ['sarween_tools'] },
    );
    expect(totals.baseResources).toBe(2);
    expect(totals.sarweenDiscount).toBe(1);
    expect(totals.resources).toBe(1);
  });

  it('applies AI Development Algorithm per unit upgrade when enabled', () => {
    const totals = productionTotals(
      { cruiser: 3 },
      {
        techIds: ['ai_development_algorithm', 'cruiser_2', 'destroyer_2'],
        applyAiAlgorithm: true,
      },
    );
    // 3 cruisers × 2 = 6, −2 unit upgrades
    expect(totals.baseResources).toBe(6);
    expect(totals.aiDiscount).toBe(2);
    expect(totals.resources).toBe(4);
  });

  it('skips AI discount when toggle off', () => {
    const totals = productionTotals(
      { cruiser: 1 },
      {
        techIds: ['ai_development_algorithm', 'cruiser_2'],
        applyAiAlgorithm: false,
      },
    );
    expect(totals.resources).toBe(2);
    expect(totals.aiDiscount).toBe(0);
  });

  it('Muaat Prototype War Sun II costs 10', () => {
    const warsun = PRODUCTION_UNITS.find(u => u.id === 'warsun');
    expect(unitCostForPlayer(warsun, {
      factionId: 'muaat',
      techIds: ['prototype_war_sun_2'],
    })).toBe(10);
    expect(unitCostForPlayer(warsun, { factionId: 'muaat', techIds: [] })).toBe(12);
    expect(unitCostForPlayer(warsun, {
      factionId: 'sol',
      techIds: ['prototype_war_sun_2'],
    })).toBe(12);

    const totals = productionTotals(
      { warsun: 1 },
      { factionId: 'muaat', techIds: ['prototype_war_sun_2', 'sarween_tools'] },
    );
    expect(totals.baseResources).toBe(10);
    expect(totals.resources).toBe(9);
  });

  it('maps player color hex to figurine folder', () => {
    expect(figurineColorId('#3b82f6')).toBe('blue');
    expect(figurineColorId('#000000')).toBe('black');
    expect(figurineColorId('#unknown')).toBe('blue');
  });
});
