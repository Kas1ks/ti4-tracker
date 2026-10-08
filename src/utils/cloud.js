import { isCloudConfigured } from '../config';
import { getHostWriteToken } from '../sync/hostWriteToken';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const err = new Error(data?.error || `api-${response.status}`);
    err.status = response.status;
    err.data = data;
    err.url = response.url || path;
    throw err;
  }

  if (!contentType.includes('application/json')) {
    const err = new Error('api-html-fallback');
    err.status = 502;
    err.data = { error: 'html-fallback' };
    err.url = response.url || path;
    throw err;
  }

  return data;
}

function ensureCloud() {
  if (!isCloudConfigured) {
    throw new Error('not-configured');
  }
}

function requireWriteToken(createSecret) {
  const token = createSecret || getHostWriteToken();
  if (!token) {
    const err = new Error('write-token-required');
    err.status = 403;
    err.data = { error: 'write-token-required' };
    throw err;
  }
  return token;
}

export async function fetchCloudStats() {
  ensureCloud();
  const data = await api('/api/stats');
  return Array.isArray(data?.history) ? data.history : [];
}

export async function postGameRecord(record, { createSecret } = {}) {
  ensureCloud();
  const token = requireWriteToken(createSecret);
  await api('/api/stats', {
    method: 'POST',
    body: JSON.stringify({ record, createSecret: token }),
  });
}

export async function createCloudSave(state, { createSecret } = {}) {
  ensureCloud();
  const token = requireWriteToken(createSecret);
  const data = await api('/api/saves', {
    method: 'POST',
    body: JSON.stringify({ state, createSecret: token }),
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
