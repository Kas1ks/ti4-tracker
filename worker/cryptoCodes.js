const CROCKFORD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SAVE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomBytes(n) {
  const out = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i += 1) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

function randomFromAlphabet(length, alphabet) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** 6-char room id (Crockford). */
export function randomRoomId() {
  return randomFromAlphabet(6, CROCKFORD);
}

/** Seat reclaim secret — ≥8 chars. */
export function randomSeatSecret(length = 8) {
  return randomFromAlphabet(Math.max(8, length), CROCKFORD);
}

/** Mid-game save code. */
export function randomSaveCode(length = 10) {
  return randomFromAlphabet(Math.max(8, length), SAVE_ALPHABET);
}

export function randomHostKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `host_${Date.now()}_${randomFromAlphabet(16, SAVE_ALPHABET)}`;
}
