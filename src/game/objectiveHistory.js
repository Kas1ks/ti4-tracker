/** Recently revealed public objectives — soft anti-repeat across games. */
export const RECENT_OBJECTIVES_KEY = 'ti4_recentObjectives';
const RECENT_OBJECTIVES_MAX = 20;

export function readRecentObjectiveIds() {
  try {
    const raw = localStorage.getItem(RECENT_OBJECTIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(id => String(id)).filter(Boolean);
  } catch {
    return [];
  }
}

/** Prepend newly seen ids; keep unique; cap length. */
export function rememberObjectiveIds(ids) {
  const incoming = (Array.isArray(ids) ? ids : [])
    .map(id => String(id))
    .filter(Boolean);
  if (incoming.length === 0) return readRecentObjectiveIds();

  const prev = readRecentObjectiveIds();
  const merged = [];
  const seen = new Set();
  [...incoming, ...prev].forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    merged.push(id);
  });
  const next = merged.slice(0, RECENT_OBJECTIVES_MAX);
  try {
    localStorage.setItem(RECENT_OBJECTIVES_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
  return next;
}
