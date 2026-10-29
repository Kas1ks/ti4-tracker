import factionsRaw from './data/factions.json';
import { ALL_FACTIONS } from '../data/gameData.js';

/** Map milty faction id → tracker faction id where names differ. */
const ID_ALIASES = {
  norr: 'saardakk',
  ul: 'titans',
  // Icon/seat mapping only — milty Keleres is one faction; HS variant is chosen later.
  keleres: 'keleres_argent',
  last_bastion: 'bastion',
  ral_nel: 'ralnel',
  deepwrought_scholarate: 'deepwrought',
  crimson_rebellion: 'crimson',
  firmament_obsidian: 'firmament',
};

/** Display names that must not inherit tracker variant labels. */
const DISPLAY_NAME_OVERRIDES = {
  keleres: 'Совет Келерес',
};

/**
 * @typedef {{ id: string, name: string, set: string, homesystem: string, trackerId: string, iconUrl?: string, displayName?: string, wiki?: string }} MiltyFaction
 */

/** Faction reference sheets hosted by miltydraft (`r_{id}.jpg`). */
export const MILTY_REF_CDN = 'https://milty.shenanigans.be/img/reference';

export function factionReferenceUrl(factionId) {
  if (!factionId) return null;
  return `${MILTY_REF_CDN}/r_${factionId}.jpg`;
}

/** @type {MiltyFaction[]} */
let listCache = null;
/** @type {Record<string, MiltyFaction>|null} */
let byIdCache = null;

export function allFactions() {
  if (!listCache) {
    const byTrackerId = Object.fromEntries(ALL_FACTIONS.map((f) => [f.id, f]));
    listCache = Object.values(factionsRaw).map((f) => {
      const trackerId = ID_ALIASES[f.id] || f.id;
      const local = byTrackerId[trackerId];
      return {
        id: f.id,
        name: f.name,
        set: f.set,
        homesystem: String(f.homesystem),
        trackerId,
        iconUrl: local?.iconUrl,
        displayName: DISPLAY_NAME_OVERRIDES[f.id] || local?.name || f.name,
        wiki: f.wiki || null,
      };
    });
    byIdCache = Object.fromEntries(listCache.map((f) => [f.id, f]));
  }
  return listCache;
}

/** Resolve icon/name for a milty faction id (also fixes older drafts with missing iconUrl). */
export function resolveFaction(factionOrId) {
  const id = typeof factionOrId === 'string' ? factionOrId : factionOrId?.id;
  if (!id) return null;
  allFactions();
  const known = byIdCache?.[id];
  if (!known) {
    if (typeof factionOrId === 'object' && factionOrId) return factionOrId;
    return null;
  }
  if (typeof factionOrId === 'object' && factionOrId) {
    return {
      ...factionOrId,
      iconUrl: factionOrId.iconUrl || known.iconUrl,
      // Prefer milty canonical label (e.g. Keleres without HS variant).
      displayName: known.displayName || factionOrId.displayName || known.name,
      trackerId: factionOrId.trackerId || known.trackerId,
      wiki: factionOrId.wiki || known.wiki || null,
    };
  }
  return known;
}

/**
 * @param {string[]} sets e.g. ['base','pok']
 * @param {boolean} includeKeleres
 */
export function factionsForSets(sets, includeKeleres = false) {
  const allow = new Set(sets.map((s) => String(s).toLowerCase()));
  return allFactions().filter((f) => {
    const set = String(f.set).toLowerCase();
    if (set === 'keleres') return includeKeleres;
    return allow.has(set);
  });
}
