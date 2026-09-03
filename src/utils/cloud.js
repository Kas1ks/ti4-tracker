import { isCloudConfigured } from '../config';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const err = new Error(data?.error || `api-${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

function ensureCloud() {
  if (!isCloudConfigured) {
    throw new Error('not-configured');
  }
}

export async function fetchCloudStats() {
  ensureCloud();
  const data = await api('/api/stats');
  return Array.isArray(data?.history) ? data.history : [];
}

export async function postGameRecord(record) {
  ensureCloud();
  await api('/api/games', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function createCloudSave(state) {
  ensureCloud();
  const data = await api('/api/saves', {
    method: 'POST',
    body: JSON.stringify({ state }),
  });
  return data.code;
}

export async function fetchCloudSave(code) {
  ensureCloud();
  const data = await api(`/api/saves/${encodeURIComponent(code)}`);
  return data.state;
}

export async function deleteCloudGame(gameId, pin) {
  ensureCloud();
  const data = await api(`/api/stats/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ pin }),
  });
  return Array.isArray(data?.history) ? data.history : null;
}

export async function clearCloudStats(pin) {
  ensureCloud();
  await api('/api/stats', {
    method: 'DELETE',
    body: JSON.stringify({ pin }),
  });
}
