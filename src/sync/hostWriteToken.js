const STORAGE_KEY = 'ti4_host_write_token';

export function getHostWriteToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setHostWriteToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, String(token));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function clearHostWriteToken() {
  setHostWriteToken('');
}
