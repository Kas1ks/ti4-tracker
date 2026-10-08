/**
 * Host-only gate for creating rooms and unlocking solo/local host actions.
 * Set ROOM_CREATE_SECRET (Worker secret / .dev.vars). Never put a VITE_ copy in the client build.
 */

import { timingSafeEqualString } from '../secureCompare.js';

/** Prod Worker: only non-VITE keys unless ALLOW_VITE_SECRET_FALLBACK=1 (local/legacy). */
export function allowViteSecretFallback(env) {
  return env?.ALLOW_VITE_SECRET_FALLBACK === '1'
    || env?.ALLOW_VITE_SECRET_FALLBACK === 'true'
    || env?.DEV === true
    || env?.DEV === 'true';
}

export function resolveRoomCreateSecret(env) {
  const primary = env?.ROOM_CREATE_SECRET || '';
  if (primary) return primary;
  if (allowViteSecretFallback(env)) {
    return env?.VITE_ROOM_CREATE_SECRET || '';
  }
  return '';
}

export function roomCreateSecretMatches(env, createSecret) {
  const expected = resolveRoomCreateSecret(env);
  if (!expected) return false;
  return typeof createSecret === 'string' && timingSafeEqualString(createSecret, expected);
}

/** @returns {{ ok: true } | { ok: false, error: string, status: number }} */
export function assertRoomCreateAllowed(env, createSecret) {
  const expected = resolveRoomCreateSecret(env);
  if (!expected) {
    return { ok: false, error: 'create-secret-not-configured', status: 503 };
  }
  if (!roomCreateSecretMatches(env, createSecret)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  return { ok: true };
}
