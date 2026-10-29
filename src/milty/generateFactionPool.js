import { factionsForSets } from './factions.js';
import { createRng, shuffleCopy } from './rng.js';

/**
 * @param {object} settings
 * @returns {object[]}
 */
export function generateFactionPool(settings) {
  const pool = factionsForSets(settings.factionSets, settings.includeKeleres);
  if (pool.length < settings.numberOfFactions) {
    throw new Error('Not enough factions for the selected sets');
  }

  const rng = createRng(settings.seed + 1); // OFFSET_FACTIONS = 1
  let gathered = [];

  if (settings.customFactions?.length) {
    const byId = Object.fromEntries(pool.map((f) => [f.id, f]));
    for (const id of settings.customFactions) {
      const f = byId[id];
      if (!f) throw new Error(`Unknown custom faction: ${id}`);
      gathered.push(f);
      delete byId[id];
    }
    const rest = shuffleCopy(Object.values(byId), rng);
    const still = settings.numberOfFactions - gathered.length;
    if (still > 0) gathered = gathered.concat(rest.slice(0, still));
  } else {
    gathered = shuffleCopy(pool, rng);
  }

  return shuffleCopy(gathered, rng).slice(0, settings.numberOfFactions);
}
