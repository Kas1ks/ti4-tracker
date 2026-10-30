import { factionsForSets } from './factions.js';
import { createRng, shuffleCopy } from './rng.js';

/**
 * @param {object} settings
 * @param {{ excludeIds?: string[] }} [opts] Prefer factions not in excludeIds (used on regen).
 * @returns {object[]}
 */
export function generateFactionPool(settings, { excludeIds = [] } = {}) {
  const pool = factionsForSets(settings.factionSets, settings.includeKeleres);
  if (pool.length < settings.numberOfFactions) {
    throw new Error('Not enough factions for the selected sets');
  }

  const rng = createRng(settings.seed + 1); // OFFSET_FACTIONS = 1
  const exclude = new Set(
    (excludeIds || []).map((id) => String(id)).filter(Boolean),
  );

  let gathered = [];

  if (settings.customFactions?.length) {
    const byId = Object.fromEntries(pool.map((f) => [f.id, f]));
    for (const id of settings.customFactions) {
      const f = byId[id];
      if (!f) throw new Error(`Unknown custom faction: ${id}`);
      gathered.push(f);
      delete byId[id];
    }
    const restAll = Object.values(byId);
    const preferred = shuffleCopy(restAll.filter((f) => !exclude.has(f.id)), rng);
    const avoided = shuffleCopy(restAll.filter((f) => exclude.has(f.id)), rng);
    const still = settings.numberOfFactions - gathered.length;
    if (still > 0) {
      gathered = gathered.concat(preferred.slice(0, still));
    }
    const need = settings.numberOfFactions - gathered.length;
    if (need > 0) {
      gathered = gathered.concat(avoided.slice(0, need));
    }
  } else {
    const preferred = shuffleCopy(pool.filter((f) => !exclude.has(f.id)), rng);
    const avoided = shuffleCopy(pool.filter((f) => exclude.has(f.id)), rng);
    gathered = preferred.slice(0, settings.numberOfFactions);
    const need = settings.numberOfFactions - gathered.length;
    if (need > 0) {
      gathered = gathered.concat(avoided.slice(0, need));
    }
  }

  return shuffleCopy(gathered, rng).slice(0, settings.numberOfFactions);
}
