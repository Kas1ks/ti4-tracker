import { normalizeStoredBin } from './StatsStore.js';
import {
  fetchJsonBinBin,
  isJsonBinConfigured,
} from '../jsonbin.js';

const IMPORT_RETRY_MS = 5 * 60 * 1000;

/** In-memory fallback for Vite middleware (no DO binding). */
let memoryBin = normalizeStoredBin(null);
let memoryChain = Promise.resolve();

export function hasStatsStore(env) {
  return Boolean(env?.STATS_STORE);
}

function statsStub(env) {
  const id = env.STATS_STORE.idFromName('company');
  return env.STATS_STORE.get(id);
}

async function doFetch(env, path, init) {
  const stub = statsStub(env);
  return stub.fetch(new Request(`https://stats-store${path}`, init));
}

async function loadFromDo(env) {
  const res = await doFetch(env, '/bin', { method: 'GET' });
  if (!res.ok) throw new Error(`stats-do-get-${res.status}`);
  return normalizeStoredBin(await res.json());
}

async function mutateDo(env, body) {
  const res = await doFetch(env, '/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `stats-do-mutate-${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = String(data.error);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return normalizeStoredBin(await res.json());
}

/**
 * Cloud stats: Durable Object in production; in-memory fallback for Vite/local.
 * JSONBin is optional (bootstrap only).
 */
export function isCloudStatsConfigured(env) {
  if (hasStatsStore(env)) return true;
  return env?.DEV === 'true' || env?.ALLOW_VITE_SECRET_FALLBACK === '1';
}

async function maybeBootstrapFromJsonbin(env, bin) {
  if (bin.meta?.importedFromJsonbin) return bin;
  if (!isJsonBinConfigured(env)) return bin;
  const attemptedAt = Number(bin.meta?.importAttemptedAt) || 0;
  if (attemptedAt && Date.now() - attemptedAt < IMPORT_RETRY_MS) {
    return bin;
  }

  try {
    const remote = await fetchJsonBinBin(env);
    if (hasStatsStore(env)) {
      return mutateDo(env, {
        op: 'mergeImport',
        history: remote.history,
        saves: remote.saves,
      });
    }
    const byId = new Map();
    for (const g of remote.history || []) {
      if (g?.id != null) byId.set(String(g.id), g);
    }
    for (const g of bin.history) {
      if (g?.id != null) byId.set(String(g.id), g);
    }
    memoryBin = normalizeStoredBin({
      history: [...byId.values()].sort((a, b) => {
        const ta = Date.parse(a?.savedAt || 0) || Number(a?.id) || 0;
        const tb = Date.parse(b?.savedAt || 0) || Number(b?.id) || 0;
        return tb - ta;
      }),
      saves: { ...(remote.saves || {}), ...bin.saves },
      meta: { importedFromJsonbin: true, importAttemptedAt: Date.now() },
    });
    return memoryBin;
  } catch (err) {
    console.error('[statsBin] jsonbin bootstrap failed', err);
    if (hasStatsStore(env)) {
      try {
        await mutateDo(env, { op: 'markImportAttempt' });
      } catch {
        /* ignore */
      }
      return normalizeStoredBin({
        ...bin,
        meta: { ...bin.meta, importAttemptedAt: Date.now() },
      });
    }
    memoryBin = normalizeStoredBin({
      ...bin,
      meta: { ...bin.meta, importAttemptedAt: Date.now() },
    });
    return memoryBin;
  }
}

/** Read company stats bin (DO or memory), with rare JSONBin bootstrap. */
export async function getCloudBin(env) {
  let bin;
  if (hasStatsStore(env)) {
    bin = await loadFromDo(env);
  } else {
    bin = normalizeStoredBin(memoryBin);
  }
  return maybeBootstrapFromJsonbin(env, bin);
}

async function memoryMutate(mutator) {
  const run = memoryChain.then(async () => {
    const history = memoryBin.history.slice();
    const saves = { ...memoryBin.saves };
    const result = await mutator({ history, saves });
    memoryBin = normalizeStoredBin({
      history,
      saves,
      meta: memoryBin.meta,
    });
    return { result, history: memoryBin.history };
  });
  memoryChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function appendGameRecord(env, record) {
  if (hasStatsStore(env)) {
    await mutateDo(env, { op: 'unshiftHistory', record });
    return;
  }
  await memoryMutate(({ history }) => {
    history.unshift(record);
  });
}

export async function putCloudSave(env, code, state) {
  if (hasStatsStore(env)) {
    await mutateDo(env, { op: 'putSave', code, state });
    return;
  }
  await memoryMutate(({ saves }) => {
    saves[code] = state;
  });
}

export async function clearCloudHistory(env) {
  if (hasStatsStore(env)) {
    await mutateDo(env, { op: 'clearHistory' });
    return;
  }
  await memoryMutate(({ history }) => {
    history.length = 0;
  });
}

export async function deleteCloudHistoryId(env, gameId) {
  if (hasStatsStore(env)) {
    const result = await mutateDo(env, { op: 'deleteHistoryId', gameId: String(gameId) });
    return result.history;
  }
  const { history } = await memoryMutate(({ history }) => {
    const gameIdRaw = String(gameId);
    const n = Number(gameIdRaw);
    const next = history.filter((g) => String(g?.id) !== gameIdRaw && g?.id !== n);
    history.length = 0;
    history.push(...next);
    return [...history];
  });
  return history;
}

/**
 * @deprecated Prefer named helpers; kept for any leftover callers.
 * Generic mutator uses a single DO replace op to avoid GET/PUT races.
 */
export function withCloudBinLock(env, mutator) {
  if (hasStatsStore(env)) {
    return (async () => {
      const bin = await loadFromDo(env);
      const history = bin.history.slice();
      const saves = { ...bin.saves };
      const result = await mutator({ history, saves });
      await mutateDo(env, {
        op: 'replace',
        history,
        saves,
        meta: bin.meta,
      });
      return result;
    })();
  }
  return memoryMutate(mutator).then((x) => x.result);
}

/** Test helper: reset memory bin. */
export function resetMemoryStatsBin() {
  memoryBin = normalizeStoredBin(null);
}
