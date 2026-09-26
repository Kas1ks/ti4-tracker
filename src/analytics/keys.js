import { ALL_FACTIONS } from '../data/gameData';

/** Stable player key for aggregating across games. */
export function playerKey(name) {
  return String(name || '').trim().toLowerCase();
}

/** Display name: prefer first non-empty seen spelling. */
export function displayName(name) {
  return String(name || '').trim() || '—';
}

const factionById = new Map(ALL_FACTIONS.map(f => [f.id, f]));
const factionByName = new Map(ALL_FACTIONS.map(f => [f.name.toLowerCase(), f]));

/** Resolve faction id from record field (id or legacy name). */
export function resolveFactionId(playerOrFaction) {
  if (playerOrFaction == null) return null;
  if (typeof playerOrFaction === 'string') {
    const raw = playerOrFaction.trim();
    if (!raw) return null;
    if (factionById.has(raw)) return raw;
    return factionByName.get(raw.toLowerCase())?.id || null;
  }
  if (playerOrFaction.factionId && factionById.has(playerOrFaction.factionId)) {
    return playerOrFaction.factionId;
  }
  if (playerOrFaction.faction) {
    return resolveFactionId(playerOrFaction.faction);
  }
  return null;
}

export function factionLabel(factionId, fallbackName = '') {
  if (factionId && factionById.has(factionId)) return factionById.get(factionId).name;
  return fallbackName || factionId || '—';
}

export function pct(wins, total) {
  if (!total) return 0;
  return Math.round((wins / total) * 100);
}

export function avg(sum, count) {
  if (!count) return 0;
  return sum / count;
}
