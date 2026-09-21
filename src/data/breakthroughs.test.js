import { describe, expect, it } from 'vitest';
import {
  BREAKTHROUGHS,
  BREAKTHROUGH_SYNERGY,
  breakthroughByFaction,
} from './breakthroughs';
import { ALL_FACTIONS } from './gameData';

describe('breakthroughs catalog', () => {
  it('has an entry for every TE-capable faction id in gameData', () => {
    const missing = ALL_FACTIONS.map(f => f.id).filter(id => !BREAKTHROUGHS[id]);
    expect(missing).toEqual([]);
  });

  it('exposes Crimson Resonance Generator unlocked at start', () => {
    const bt = breakthroughByFaction('crimson');
    expect(bt).toMatchObject({
      name: 'Resonance Generator',
      startsUnlocked: true,
      synergy: ['blue', 'red'],
    });
    expect(bt.text.length).toBeGreaterThan(40);
  });

  it('keeps synergy map aligned with breakthrough entries', () => {
    expect(BREAKTHROUGH_SYNERGY.sol).toEqual(['yellow', 'green']);
    expect(BREAKTHROUGH_SYNERGY.mentak).toBeUndefined();
    expect(BREAKTHROUGH_SYNERGY.nekro).toBeUndefined();
    expect(breakthroughByFaction('mentak')?.synergy).toBeNull();
  });
});
