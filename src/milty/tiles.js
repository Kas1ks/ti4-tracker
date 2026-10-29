import tilesRaw from './data/tiles.json';
import tierRaw from './data/tile-selection.json';
import { shuffleInPlace } from './rng.js';

export const EDITIONS = {
  BaseGame: 'BaseGame',
  PoK: 'PoK',
  TE: 'TE',
};

export const TILE_TIER = {
  HIGH: 'high',
  MEDIUM: 'mid',
  LOW: 'low',
  RED: 'red',
  NONE: 'none',
};

const NEIGHBOURS = [
  [0, 1], [0, 3], [1, 2], [1, 3], [1, 4], [3, 4],
];

function optimalForPlanet(resources, influence) {
  let optimalResources = 0;
  let optimalInfluence = 0;
  if (influence > resources) optimalInfluence = influence;
  else if (resources > influence) optimalResources = resources;
  else {
    optimalInfluence = influence / 2;
    optimalResources = resources / 2;
  }
  return {
    optimalResources,
    optimalInfluence,
    optimalTotal: optimalResources + optimalInfluence,
  };
}

function parseWormholes(raw) {
  if (raw == null) return [];
  if (raw === 'alpha-beta') return ['alpha', 'beta'];
  if (raw === 'all') return ['alpha', 'beta', 'gamma'];
  return [String(raw)];
}

function buildTierMap() {
  const map = {};
  for (const lists of Object.values(tierRaw)) {
    for (const [level, ids] of Object.entries(lists)) {
      for (const id of ids) {
        map[String(id)] = level;
      }
    }
  }
  return map;
}

const TIER_MAP = buildTierMap();

function enrichTile(id, data) {
  const nonDraftable = data.nonDraftable === true;
  let tier = TILE_TIER.NONE;
  if (!nonDraftable) {
    if (data.type === 'red') tier = TILE_TIER.RED;
    else if (data.type === 'blue') tier = TIER_MAP[String(id)] || TILE_TIER.NONE;
  }

  const planets = (data.planets || []).map((p) => {
    const opt = optimalForPlanet(p.resources || 0, p.influence || 0);
    return {
      name: p.name,
      resources: p.resources || 0,
      influence: p.influence || 0,
      legendary: p.legendary && p.legendary !== false ? p.legendary : null,
      specialties: p.specialties || [],
      ...opt,
    };
  });
  const stations = (data.stations || []).map((s) => {
    const opt = optimalForPlanet(s.resources || 0, s.influence || 0);
    return {
      name: s.name || 'station',
      resources: s.resources || 0,
      influence: s.influence || 0,
      ...opt,
    };
  });

  let totalInfluence = 0;
  let totalResources = 0;
  let optimalInfluence = 0;
  let optimalResources = 0;
  let optimalTotal = 0;
  for (const e of [...planets, ...stations]) {
    totalInfluence += e.influence;
    totalResources += e.resources;
    optimalInfluence += e.optimalInfluence;
    optimalResources += e.optimalResources;
    optimalTotal += e.optimalTotal;
  }

  const wormholes = parseWormholes(data.wormhole);
  const legendaryPlanets = planets
    .filter((p) => p.legendary)
    .map((p) => `${p.name}: ${p.legendary}`);

  return {
    id: String(id),
    type: data.type,
    tier,
    edition: data.set,
    planets,
    stations,
    wormholes,
    anomaly: data.anomaly || null,
    hyperlanes: data.hyperlanes || [],
    totalInfluence,
    totalResources,
    optimalInfluence,
    optimalResources,
    optimalTotal,
    legendaryPlanets,
    hasAnomaly: data.anomaly != null,
    hasLegendary: legendaryPlanets.length > 0,
  };
}

/** @type {Record<string, ReturnType<typeof enrichTile>>} */
let cache = null;

export function allTiles() {
  if (!cache) {
    cache = {};
    for (const [id, data] of Object.entries(tilesRaw)) {
      cache[String(id)] = enrichTile(id, data);
    }
  }
  return cache;
}

export function tilesForEditions(editions = [EDITIONS.BaseGame, EDITIONS.PoK]) {
  const set = new Set(editions);
  return Object.values(allTiles()).filter(
    (t) => set.has(t.edition) && t.tier !== TILE_TIER.NONE,
  );
}

export function countSpecials(tiles) {
  const count = { legendary: 0, alpha: 0, beta: 0, gamma: 0, delta: 0, epsilon: 0 };
  for (const tile of tiles) {
    for (const w of tile.wormholes) {
      if (count[w] != null) count[w] += 1;
    }
    if (tile.hasLegendary) count.legendary += 1;
  }
  return count;
}

export function sliceTotals(tiles) {
  let totalInfluence = 0;
  let totalResources = 0;
  let optimalInfluence = 0;
  let optimalResources = 0;
  let optimalTotal = 0;
  const wormholes = [];
  const legendaryPlanets = [];
  for (const t of tiles) {
    totalInfluence += t.totalInfluence;
    totalResources += t.totalResources;
    optimalInfluence += t.optimalInfluence;
    optimalResources += t.optimalResources;
    optimalTotal += t.optimalTotal;
    wormholes.push(...t.wormholes);
    legendaryPlanets.push(...t.legendaryPlanets);
  }
  return {
    totalInfluence,
    totalResources,
    optimalInfluence,
    optimalResources,
    optimalTotal,
    wormholes,
    legendaryPlanets,
  };
}

export function validateSliceTiles(tiles, settings) {
  if (tiles.length !== 5) return false;
  const special = countSpecials(tiles);
  if (special.alpha > 1 || special.beta > 1 || special.legendary > 1) return false;
  const totals = sliceTotals(tiles);
  if (totals.optimalInfluence < settings.minInf) return false;
  if (totals.optimalResources < settings.minRes) return false;
  if (settings.maxOneWormhole && special.alpha + special.beta > 1) return false;
  if (totals.optimalTotal < settings.minTotal) return false;
  if (totals.optimalTotal > settings.maxTotal) return false;
  return true;
}

export function tileArrangementIsValid(tiles) {
  for (const [a, b] of NEIGHBOURS) {
    if (tiles[a]?.hasAnomaly && tiles[b]?.hasAnomaly) return false;
  }
  return true;
}

/**
 * Shuffle tile order until no adjacent anomalies (or fail).
 * @returns {object[]|null}
 */
export function arrangeSliceTiles(tiles, rng, maxTries = 100) {
  let order = [...tiles];
  for (let i = 0; i <= maxTries; i += 1) {
    shuffleInPlace(order, rng);
    if (tileArrangementIsValid(order)) return order;
  }
  return null;
}

/** Tile art hosted by miltydraft (same ST_{id}.png naming). */
export const MILTY_TILE_CDN = 'https://milty.shenanigans.be/img/tiles';

export function tileImageUrl(tileId) {
  return `${MILTY_TILE_CDN}/ST_${tileId}.png`;
}

const WORMHOLE_SYMBOL = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ' };

export function wormholeSymbol(name) {
  return WORMHOLE_SYMBOL[String(name).toLowerCase()] || String(name);
}

/** Collect tech specialties across a slice's tile ids. */
export function sliceSpecialties(tileIds) {
  const catalog = allTiles();
  const out = [];
  for (const id of tileIds || []) {
    const t = catalog[String(id)];
    if (!t) continue;
    for (const p of t.planets || []) {
      for (const s of p.specialties || []) out.push(String(s).toLowerCase());
    }
  }
  return out;
}
