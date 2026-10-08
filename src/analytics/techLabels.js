import { techById } from '../data/technologies';

/** Human-readable tech name (falls back to id). */
export function techDisplayName(id) {
  const key = String(id || '').trim();
  if (!key) return '';
  return techById(key)?.name || key;
}

/** Format a list of tech ids for UI. */
export function formatTechList(ids, { limit = 0, separator = ', ' } = {}) {
  const names = (Array.isArray(ids) ? ids : [])
    .map(techDisplayName)
    .filter(Boolean);
  const sliced = limit > 0 ? names.slice(0, limit) : names;
  const text = sliced.join(separator);
  if (limit > 0 && names.length > limit) {
    return `${text} +${names.length - limit}`;
  }
  return text;
}
