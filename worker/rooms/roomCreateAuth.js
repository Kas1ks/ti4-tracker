/**
 * Host-only gate for creating rooms and unlocking solo/local host actions.
 * Set ROOM_CREATE_SECRET (Worker secret / .dev.vars). Never put a VITE_ copy in the client build.
 */

export function resolveRoomCreateSecret(env) {
  return env?.ROOM_CREATE_SECRET || env?.VITE_ROOM_CREATE_SECRET || '';
}

export function roomCreateSecretMatches(env, createSecret) {
  const expected = resolveRoomCreateSecret(env);
  if (!expected) return false;
  return typeof createSecret === 'string' && createSecret === expected;
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
