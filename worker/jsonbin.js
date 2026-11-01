import { randomSaveCode } from './cryptoCodes.js';
import { allowViteSecretFallback } from './rooms/roomCreateAuth.js';
import { timingSafeEqualString } from './secureCompare.js';

export function parseCloudBin(data) {
  if (Array.isArray(data)) {
    return { history: data, saves: {} };
  }

  const record = data?.record && typeof data.record === 'object' ? data.record : data;
  if (Array.isArray(record)) {
    return { history: record, saves: {} };
  }
  if (record && typeof record === 'object') {
    return {
      history: Array.isArray(record.history) ? record.history : [],
      saves: record.saves && typeof record.saves === 'object' ? record.saves : {},
    };
  }
  return { history: [], saves: {} };
}

function binUrl(binId) {
  return `https://api.jsonbin.io/v3/b/${binId}`;
}

function headers(masterKey) {
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': masterKey,
    'X-Bin-Meta': 'false',
  };
}

export function isJsonBinConfigured(env) {
  return Boolean(resolveBinId(env) && resolveMasterKey(env));
}

export function resolveBinId(env) {
  const primary = env?.JSONBIN_BIN_ID || '';
  if (primary) return primary;
  if (allowViteSecretFallback(env)) return env?.VITE_JSONBIN_BIN_ID || '';
  return '';
}

export function resolveMasterKey(env) {
  const primary = env?.JSONBIN_MASTER_KEY || '';
  if (primary) return primary;
  if (allowViteSecretFallback(env)) return env?.VITE_JSONBIN_MASTER_KEY || '';
  return '';
}

export function resolveAdminPin(env) {
  const primary = env?.ADMIN_PIN || '';
  if (primary) return primary;
  if (allowViteSecretFallback(env)) return env?.VITE_ADMIN_PIN || '';
  return '';
}

export function adminPinMatches(env, pin) {
  const expected = resolveAdminPin(env);
  return Boolean(expected) && typeof pin === 'string' && timingSafeEqualString(pin, expected);
}

/** One-shot / rare bootstrap read from JSONBin (not the hot path). */
export async function fetchJsonBinBin(env) {
  const binId = resolveBinId(env);
  const masterKey = resolveMasterKey(env);
  const response = await fetch(`${binUrl(binId)}/latest`, {
    method: 'GET',
    headers: headers(masterKey),
  });
  if (!response.ok) {
    throw new Error(`jsonbin-get-${response.status}`);
  }
  const payload = await response.json();
  // JSONBin v3 wraps as { record: ... }
  const record = payload?.record ?? payload;
  return parseCloudBin(record);
}

export function makeSaveCode() {
  return randomSaveCode(10);
}
