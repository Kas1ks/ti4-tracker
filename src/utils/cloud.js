import { JSONBIN_BIN_ID, JSONBIN_MASTER_KEY, isCloudConfigured } from '../config';

const BIN_URL = () => `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Master-Key': JSONBIN_MASTER_KEY,
    'X-Bin-Meta': 'false',
  };
}

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

export async function fetchCloudBin() {
  if (!isCloudConfigured) {
    throw new Error('not-configured');
  }
  const response = await fetch(`${BIN_URL()}/latest`, {
    method: 'GET',
    headers: headers(),
  });
  if (!response.ok) {
    throw new Error(`jsonbin-get-${response.status}`);
  }
  return parseCloudBin(await response.json());
}

export async function putCloudBin({ history, saves }) {
  if (!isCloudConfigured) {
    throw new Error('not-configured');
  }
  const response = await fetch(BIN_URL(), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ history, saves }),
  });
  if (!response.ok) {
    throw new Error(`jsonbin-put-${response.status}`);
  }
}
