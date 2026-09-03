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

function resolveBinId(env) {
  return env?.JSONBIN_BIN_ID || env?.VITE_JSONBIN_BIN_ID || '';
}

function resolveMasterKey(env) {
  return env?.JSONBIN_MASTER_KEY || env?.VITE_JSONBIN_MASTER_KEY || '';
}

function resolveAdminPin(env) {
  return env?.ADMIN_PIN || env?.VITE_ADMIN_PIN || '';
}

export async function getCloudBin(env) {
  const binId = resolveBinId(env);
  const masterKey = resolveMasterKey(env);
  const response = await fetch(`${binUrl(binId)}/latest`, {
    method: 'GET',
    headers: headers(masterKey),
  });
  if (!response.ok) {
    throw new Error(`jsonbin-get-${response.status}`);
  }
  return parseCloudBin(await response.json());
}

export async function putCloudBin(env, { history, saves }) {
  const binId = resolveBinId(env);
  const masterKey = resolveMasterKey(env);
  const response = await fetch(binUrl(binId), {
    method: 'PUT',
    headers: headers(masterKey),
    body: JSON.stringify({ history, saves }),
  });
  if (!response.ok) {
    throw new Error(`jsonbin-put-${response.status}`);
  }
}

export function makeSaveCode() {
  return Math.random().toString(36).substring(2, 7);
}

export { resolveAdminPin, resolveBinId, resolveMasterKey };
