import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_UNITS,
  rollNeutralCombat,
} from './neutralUnits';

describe('neutral combat rolls', () => {
  it('has Combat values from TE Neutral Unit Reference', () => {
    const byId = Object.fromEntries(NEUTRAL_UNITS.map(u => [u.id, u.combat]));
    expect(byId.infantry).toBe(8);
    expect(byId.mech).toBe(6);
    expect(byId.fighter).toBe(8);
    expect(byId.destroyer).toBe(8);
    expect(byId.cruiser).toBe(6);
    expect(byId.carrier).toBe(9);
    expect(byId.dreadnought).toBe(5);
    expect(byId.warsun).toBe(3);
    expect(byId.flagship).toBe(7);
  });

  it('counts one die per unit and hits on roll >= combat', () => {
    // Sequence of Math.random → floor(r*10)+1 yields: 8, 7, 10, 1
    const seq = [0.7, 0.6, 0.95, 0.0];
    let i = 0;
    const rng = () => seq[i++];

    const result = rollNeutralCombat({ infantry: 4 }, rng);
    expect(result.diceTotal).toBe(4);
    // infantry combat 8: rolls 8,7,10,1 → hits on 8 and 10
    expect(result.hits).toBe(2);
    expect(result.details[0].rolls).toEqual([8, 7, 10, 1]);
  });

  it('rolls separately per unit type', () => {
    // Iteration order follows NEUTRAL_UNITS: infantry then mech
    const seq = [0.7, 0.5]; // → 8, 6
    let i = 0;
    const rng = () => seq[i++];
    const result = rollNeutralCombat({ mech: 1, infantry: 1 }, rng);
    expect(result.diceTotal).toBe(2);
    // infantry combat 8: roll 8 hit; mech combat 6: roll 6 hit
    expect(result.hits).toBe(2);
    expect(result.details.map(d => d.unitId)).toEqual(['infantry', 'mech']);
  });

  it('War Sun rolls 3 dice and Flagship rolls 2, Flagship capped at 1', () => {
    const byId = Object.fromEntries(NEUTRAL_UNITS.map(u => [u.id, u]));
    expect(byId.warsun.dice).toBe(3);
    expect(byId.flagship.dice).toBe(2);
    expect(byId.flagship.max).toBe(1);

    // 3 warsun dice: all 10 → 3 hits; flagship count 5 still only rolls 2 (max 1)
    const seq = [0.95, 0.95, 0.95, 0.95, 0.95];
    let i = 0;
    const rng = () => seq[i++];
    const result = rollNeutralCombat({ warsun: 1, flagship: 5 }, rng);
    expect(result.diceTotal).toBe(5); // 3 + 2
    expect(result.hits).toBe(5);
  });
});
