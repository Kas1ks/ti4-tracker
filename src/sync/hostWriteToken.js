const STORAGE_KEY = 'ti4_host_write_token';
const EXPIRES_KEY = 'ti4_host_write_token_exp';

/** Compact HMAC token shape: base64url.base64url */
export function looksLikeHostWriteToken(value) {
  const s = String(value || '');
  if (!s.includes('.')) return false;
  const [a, b] = s.split('.');
  return !!(a && b && /^[A-Za-z0-9_-]+$/.test(a) && /^[A-Za-z0-9_-]+$/.test(b));
}

export function getHostWriteToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getHostWriteTokenExpiresAt() {
  try {
    return sessionStorage.getItem(EXPIRES_KEY) || '';
  } catch {
    return '';
  }
}

export function setHostWriteToken(token, expiresAt = '') {
  try {
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, String(token));
      if (expiresAt) sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
      else sessionStorage.removeItem(EXPIRES_KEY);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(EXPIRES_KEY);
    }
  } catch {
    /* private mode */
  }
}

export function clearHostWriteToken() {
  setHostWriteToken('');
}

/** Build JSON body auth fields: prefer writeToken for session tokens. */
export function hostAuthBody(credential) {
  const value = String(credential || '').trim();
  if (!value) return { createSecret: '' };
  if (looksLikeHostWriteToken(value)) return { writeToken: value };
  return { createSecret: value };
}
