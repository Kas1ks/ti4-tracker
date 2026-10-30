import { normalizeGameRecord, normalizeHistory } from './gameRecord.js';

export const PENDING_STATS_KEY = 'ti4_stats_pending';
export const LOCAL_SUMMARY_KEY = 'ti4_gameSummary';

function readRaw(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

function recordId(record) {
  if (record?.id == null) return null;
  return String(record.id);
}

/** Load pending local game records waiting for cloud upload. */
export function loadPendingStats() {
  const raw = readRaw(PENDING_STATS_KEY);
  if (!raw) return [];
  try {
    return normalizeHistory(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePendingStats(list) {
  const normalized = normalizeHistory(list);
  writeRaw(PENDING_STATS_KEY, JSON.stringify(normalized));
  return normalized;
}

/** Add a finished-game record to the local upload queue (deduped by id). */
export function enqueuePendingStat(record) {
  const next = normalizeGameRecord(record);
  if (!next) return loadPendingStats();
  const id = recordId(next);
  const pending = loadPendingStats().filter((g) => recordId(g) !== id);
  pending.push(next);
  return savePendingStats(pending);
}

export function clearPendingStats() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(PENDING_STATS_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop pending entries that already exist in cloud history. */
export function prunePendingAgainstCloud(cloudHistory) {
  const cloudIds = new Set(
    normalizeHistory(cloudHistory).map((g) => recordId(g)).filter(Boolean),
  );
  const kept = loadPendingStats().filter((g) => !cloudIds.has(recordId(g)));
  return savePendingStats(kept);
}

export function loadLocalGameSummary() {
  const raw = readRaw(LOCAL_SUMMARY_KEY);
  if (!raw) return null;
  try {
    return normalizeGameRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Merge cloud + pending (+ optional last local summary) for /stats display.
 * Cloud wins on id collision. Newest first.
 */
export function mergeStatsHistory(cloudHistory, pendingHistory = [], extraLocal = null) {
  const byId = new Map();
  const add = (record, source) => {
    const next = normalizeGameRecord(record);
    if (!next) return;
    const id = recordId(next);
    if (!id) return;
    if (byId.has(id) && byId.get(id)._source === 'cloud') return;
    byId.set(id, { ...next, _source: source });
  };

  normalizeHistory(cloudHistory).forEach((g) => add(g, 'cloud'));
  normalizeHistory(pendingHistory).forEach((g) => add(g, 'local'));
  if (extraLocal) add(extraLocal, 'local');

  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.savedAt || '') || Number(a.id) || 0;
    const tb = Date.parse(b.savedAt || '') || Number(b.id) || 0;
    return tb - ta;
  });
}

/** Pending locals that are not already present in cloud. */
export function pendingOnlyCount(cloudHistory, pendingHistory = loadPendingStats()) {
  const cloudIds = new Set(
    normalizeHistory(cloudHistory).map((g) => recordId(g)).filter(Boolean),
  );
  return normalizeHistory(pendingHistory).filter((g) => !cloudIds.has(recordId(g))).length;
}
