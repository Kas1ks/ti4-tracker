import { EDITIONS } from './tiles.js';
import { randomSeed } from './rng.js';

export function defaultMiltySettings(overrides = {}) {
  const playerNames = overrides.playerNames
    || Array.from({ length: overrides.numPlayers || 6 }, (_, i) => `Player ${i + 1}`);
  const n = playerNames.length;
  return {
    playerNames,
    presetDraftOrder: overrides.presetDraftOrder ?? false,
    gameName: overrides.gameName ?? '',
    seed: overrides.seed ?? randomSeed(),
    numberOfSlices: Math.max(n, overrides.numberOfSlices ?? n),
    numberOfFactions: Math.max(n, overrides.numberOfFactions ?? n + 3),
    tileSets: overrides.tileSets || [EDITIONS.BaseGame, EDITIONS.PoK],
    factionSets: overrides.factionSets || ['base', 'pok'],
    includeKeleres: overrides.includeKeleres ?? false,
    minTwoWormholes: overrides.minTwoWormholes ?? false,
    maxOneWormhole: overrides.maxOneWormhole ?? false,
    minLegendaries: overrides.minLegendaries ?? 0,
    minInf: overrides.minInf ?? 4,
    minRes: overrides.minRes ?? 2.5,
    minTotal: overrides.minTotal ?? 9,
    maxTotal: overrides.maxTotal ?? 13,
    customFactions: overrides.customFactions || [],
    customSlices: overrides.customSlices || [],
  };
}

export function parseCustomSlicesText(text) {
  if (!text || !String(text).trim()) return [];
  return String(text)
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((t) => t.trim().replace(/^0+/, '') || '0'));
}
