import { describe, expect, it } from 'vitest';
import {
  ALL_TECHNOLOGIES,
  availableTechs,
  canResearch,
  hasValidStartingTechChoice,
  ownedColorCounts,
  resolveStartingTechIds,
  startingTechChoice,
  startingTechIds,
  synergyForPlayer,
  techById,
} from './technologies';

describe('technologies catalog', () => {
  it('gives every faction tech a non-empty description', () => {
    const missing = ALL_TECHNOLOGIES
      .filter(t => t.factionId && !(typeof t.text === 'string' && t.text.trim().length > 10))
      .map(t => t.id);
    expect(missing).toEqual([]);
  });
  it('hides PoK techs unless usePok', () => {
    const base = availableTechs({ usePok: false, useTe: false, factionId: 'sol' });
    expect(base.some(t => t.id === 'psychoarchaeology')).toBe(false);
    expect(base.some(t => t.id === 'neural_motivator')).toBe(true);

    const pok = availableTechs({ usePok: true, useTe: false, factionId: 'sol' });
    expect(pok.some(t => t.id === 'psychoarchaeology')).toBe(true);
  });

  it('only shows own faction techs', () => {
    const sol = availableTechs({ usePok: false, factionId: 'sol' });
    expect(sol.some(t => t.id === 'spec_ops_2')).toBe(true);
    expect(sol.some(t => t.id === 'bioplasmosis')).toBe(false);
  });

  it('hides generic unit upgrades replaced by faction versions', () => {
    const sol = availableTechs({ usePok: false, factionId: 'sol' });
    expect(sol.some(t => t.id === 'advanced_carrier_2')).toBe(true);
    expect(sol.some(t => t.id === 'spec_ops_2')).toBe(true);
    expect(sol.some(t => t.id === 'carrier_2')).toBe(false);
    expect(sol.some(t => t.id === 'infantry_2')).toBe(false);
    expect(sol.some(t => t.id === 'cruiser_2')).toBe(true);

    const muaat = availableTechs({ usePok: false, factionId: 'muaat' });
    expect(muaat.some(t => t.id === 'prototype_war_sun_2')).toBe(true);
    expect(muaat.some(t => t.id === 'war_sun')).toBe(false);

    const hacan = availableTechs({ usePok: false, factionId: 'hacan' });
    expect(hacan.some(t => t.id === 'carrier_2')).toBe(true);
    expect(hacan.some(t => t.id === 'war_sun')).toBe(true);
  });

  it('War Sun requires 3 red and 1 yellow', () => {
    expect(techById('war_sun').prereqs).toEqual(['red', 'red', 'red', 'yellow']);
    expect(techById('prototype_war_sun_2').prereqs).toEqual(['red', 'red', 'red', 'yellow']);
  });

  it('returns fixed starting techs', () => {
    expect(startingTechIds('jolnar')).toEqual([
      'neural_motivator',
      'antimass_deflectors',
      'sarween_tools',
      'plasma_scoring',
    ]);
    expect(startingTechIds('saardakk')).toEqual([]);
    expect(startingTechIds('winnu')).toEqual([]);
  });

  it('Argent / Winnu / TE / Deepwrought / Keleres have draft rules', () => {
    expect(startingTechChoice('argent')).toMatchObject({
      kind: 'pick',
      wave: 'A',
      pick: 2,
      options: ['neural_motivator', 'sarween_tools', 'plasma_scoring'],
    });
    expect(startingTechChoice('winnu')).toMatchObject({
      kind: 'pick',
      wave: 'A',
      pick: 1,
      filter: { maxPrereqs: 0 },
    });
    expect(startingTechChoice('crimson')).toMatchObject({
      kind: 'pick',
      filter: { colors: ['red', 'blue'], maxPrereqs: 0 },
    });
    expect(startingTechChoice('firmament').filter.colors).toEqual(['green', 'yellow']);
    expect(startingTechChoice('bastion').filter.colors).toEqual(['blue', 'yellow']);
    expect(startingTechChoice('ralnel').filter.colors).toEqual(['red', 'green']);
    expect(startingTechChoice('deepwrought')).toMatchObject({ kind: 'research', pick: 2 });
    expect(startingTechChoice('keleres_argent')).toMatchObject({
      kind: 'fromOthers',
      wave: 'C',
      pick: 2,
    });
  });

  it('choice factions start empty until draft; setup picks alone are not applied', () => {
    expect(hasValidStartingTechChoice({
      factionId: 'argent',
      startingTechIds: ['neural_motivator'],
    })).toBe(false);
    expect(hasValidStartingTechChoice({
      factionId: 'argent',
      startingTechIds: ['neural_motivator', 'plasma_scoring'],
    })).toBe(true);
    expect(resolveStartingTechIds({
      factionId: 'argent',
      startingTechIds: ['plasma_scoring', 'sarween_tools'],
    })).toEqual([]);
    expect(resolveStartingTechIds({ factionId: 'jolnar' })).toEqual([
      'neural_motivator',
      'antimass_deflectors',
      'sarween_tools',
      'plasma_scoring',
    ]);
  });
});

describe('prereq helpers', () => {
  it('unit upgrades do not grant color counts', () => {
    const counts = ownedColorCounts(['carrier_2', 'neural_motivator']);
    expect(counts).toEqual({ green: 1, blue: 0, yellow: 0, red: 0 });
  });

  it('blocks research without prereqs', () => {
    const hyper = techById('hyper_metabolism');
    expect(canResearch(hyper, [])).toBe(false);
    expect(canResearch(hyper, ['neural_motivator'])).toBe(false);
    expect(canResearch(hyper, ['neural_motivator', 'dacxive_animators'])).toBe(true);
  });

  it('allows one ignored prereq', () => {
    const hyper = techById('hyper_metabolism');
    expect(canResearch(hyper, ['neural_motivator'], { ignoreCount: 1 })).toBe(true);
  });

  it('applies breakthrough synergy remap', () => {
    const bioStims = techById('bio_stims');
    // Arborec: R/G — own 1 red counts as green
    expect(canResearch(bioStims, ['plasma_scoring'], {
      synergyColors: ['red', 'green'],
    })).toBe(true);
    expect(canResearch(bioStims, ['plasma_scoring'])).toBe(false);
  });

  it('pools synergy colors so mixed prereqs can use either side', () => {
    // PDS II needs red+yellow; Bastion synergy R/Y with 2 red should work
    const pds2 = techById('pds_2');
    expect(canResearch(pds2, ['plasma_scoring', 'magen_defense_grid'], {
      synergyColors: ['red', 'yellow'],
    })).toBe(true);
    expect(canResearch(pds2, ['plasma_scoring', 'magen_defense_grid'])).toBe(false);

    // Cruiser II needs green+yellow+red; 2 green (Y/G synergy) + 1 red
    const cruiser2 = techById('cruiser_2');
    expect(cruiser2.prereqs).toEqual(['green', 'yellow', 'red']);
    expect(canResearch(cruiser2, ['neural_motivator', 'dacxive_animators', 'plasma_scoring'], {
      synergyColors: ['yellow', 'green'],
    })).toBe(true);
    expect(canResearch(cruiser2, ['neural_motivator', 'dacxive_animators'], {
      synergyColors: ['yellow', 'green'],
    })).toBe(false);
  });

  it('exposes Crimson blue/red synergy when breakthrough is unlocked', () => {
    expect(synergyForPlayer('crimson', true, true)).toEqual(['blue', 'red']);
    const gravity = techById('gravity_drive');
    // Plasma (red) counts as blue via Resonance Generator
    expect(canResearch(gravity, ['plasma_scoring'], {
      synergyColors: synergyForPlayer('crimson', true, true),
    })).toBe(true);
    expect(canResearch(gravity, ['plasma_scoring'])).toBe(false);
  });

  it('rejects already owned tech', () => {
    const neural = techById('neural_motivator');
    expect(canResearch(neural, ['neural_motivator'])).toBe(false);
  });
});
