import { createRng, shuffleCopy } from './rng.js';
import {
  TILE_TIER,
  allTiles,
  arrangeSliceTiles,
  sliceTotals,
  tilesForEditions,
  validateSliceTiles,
} from './tiles.js';

const MAX_TILE_SELECTION_TRIES = 100;
const MAX_SLICES_FROM_SELECTION_TRIES = 400;

function bucketByTier(tiles) {
  const high = [];
  const mid = [];
  const low = [];
  const red = [];
  for (const t of tiles) {
    if (t.tier === TILE_TIER.HIGH) high.push(t.id);
    else if (t.tier === TILE_TIER.MEDIUM) mid.push(t.id);
    else if (t.tier === TILE_TIER.LOW) low.push(t.id);
    else if (t.tier === TILE_TIER.RED) red.push(t.id);
  }
  return { high, mid, low, red };
}

function makeSliceFromIds(ids) {
  const catalog = allTiles();
  const tiles = ids.map((id) => catalog[String(id)]);
  if (tiles.some((t) => !t)) {
    throw new Error(`Unknown tile in slice: ${ids.join(',')}`);
  }
  const totals = sliceTotals(tiles);
  return {
    tileIds: tiles.map((t) => t.id),
    tiles,
    ...totals,
    hasLegendaries: totals.legendaryPlanets.length > 0,
  };
}

function validatePoolSelection(tileIds, settings) {
  const catalog = allTiles();
  let alpha = 0;
  let beta = 0;
  let legendary = 0;
  for (const id of tileIds) {
    const t = catalog[String(id)];
    if (!t) continue;
    if (t.wormholes.includes('alpha')) alpha += 1;
    if (t.wormholes.includes('beta')) beta += 1;
    if (t.hasLegendary) legendary += 1;
  }
  if (legendary < settings.minLegendaries) return false;
  if (settings.minTwoWormholes && (alpha < 2 || beta < 2)) return false;
  return true;
}

function makeSlicesFromPool(pool, settings, seedBase) {
  for (let tryN = 0; tryN <= MAX_SLICES_FROM_SELECTION_TRIES; tryN += 1) {
    const rng = createRng(seedBase + tryN);
    const high = shuffleCopy(pool.high, rng);
    const mid = shuffleCopy(pool.mid, rng);
    const low = shuffleCopy(pool.low, rng);
    const red = shuffleCopy(pool.red, rng);
    const catalog = allTiles();
    const slices = [];
    let failed = false;

    for (let i = 0; i < settings.numberOfSlices; i += 1) {
      const raw = [
        catalog[high[i]],
        catalog[mid[i]],
        catalog[low[i]],
        catalog[red[i * 2]],
        catalog[red[i * 2 + 1]],
      ];
      if (raw.some((t) => !t)) {
        failed = true;
        break;
      }
      if (!validateSliceTiles(raw, settings)) {
        failed = true;
        break;
      }
      const arranged = arrangeSliceTiles(raw, createRng(seedBase + tryN * 1000 + i));
      if (!arranged) {
        failed = true;
        break;
      }
      slices.push(makeSliceFromIds(arranged.map((t) => t.id)));
    }
    if (!failed && slices.length === settings.numberOfSlices) return slices;
  }
  return null;
}

function fromCustomSlices(customSlices) {
  return customSlices.map((ids) => makeSliceFromIds(ids.map(String)));
}

/**
 * @param {object} settings
 * @returns {{ slices: object[], seed: number }}
 */
export function generateSlicePool(settings) {
  if (settings.customSlices?.length) {
    return { slices: fromCustomSlices(settings.customSlices), seed: settings.seed };
  }

  const gathered = tilesForEditions(settings.tileSets);
  const buckets = bucketByTier(gathered);
  const need = {
    high: settings.numberOfSlices,
    mid: settings.numberOfSlices,
    low: settings.numberOfSlices,
    red: settings.numberOfSlices * 2,
  };
  if (
    buckets.high.length < need.high
    || buckets.mid.length < need.mid
    || buckets.low.length < need.low
    || buckets.red.length < need.red
  ) {
    throw new Error('Not enough tiles for the selected expansions / slice count');
  }

  const seed = settings.seed;
  for (let attempt = 0; attempt <= MAX_TILE_SELECTION_TRIES; attempt += 1) {
    const rng = createRng(seed + attempt);
    const high = shuffleCopy(buckets.high, rng).slice(0, need.high);
    const mid = shuffleCopy(buckets.mid, rng).slice(0, need.mid);
    const low = shuffleCopy(buckets.low, rng).slice(0, need.low);
    const red = shuffleCopy(buckets.red, rng).slice(0, need.red);
    const pool = { high, mid, low, red };
    const allIds = [...high, ...mid, ...low, ...red];
    if (!validatePoolSelection(allIds, settings)) continue;
    const slices = makeSlicesFromPool(pool, settings, seed + attempt * 17);
    if (slices) return { slices, seed };
  }
  throw new Error('Could not generate valid slices — loosen thresholds or add expansions');
}
