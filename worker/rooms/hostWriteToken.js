/**
 * Short-lived signed host write token.
 * Issued after ROOM_CREATE_SECRET check; used instead of re-sending the master secret.
 *
 * Format: `${base64url(payloadJson)}.${base64url(hmacSha256)}`
 * payload: { v: 1, exp: unixSec, scope: 'host-write' }
 */

import { assertRoomCreateAllowed, resolveRoomCreateSecret } from './roomCreateAuth.js';

export const HOST_WRITE_SCOPE = 'host-write';
export const DEFAULT_HOST_TOKEN_TTL_SEC = 12 * 60 * 60; // 12h

function resolveSigningKey(env) {
  const dedicated = env?.HOST_TOKEN_SECRET || '';
  if (dedicated) return String(dedicated);
  // Same compromise surface as create secret — fine until a dedicated key is set.
  return resolveRoomCreateSecret(env) || '';
}

export function resolveHostTokenTtlSec(env) {
  const raw = Number(env?.HOST_TOKEN_TTL_SEC);
  if (Number.isFinite(raw) && raw >= 60 && raw <= 7 * 24 * 60 * 60) {
    return Math.floor(raw);
  }
  return DEFAULT_HOST_TOKEN_TTL_SEC;
}

function bytesToBase64Url(bytes) {
  let bin = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) bin += String.fromCharCode(view[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(keyText, messageText) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyText),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(messageText));
  return new Uint8Array(sig);
}

function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

/**
 * @param {object} env
 * @param {{ ttlSec?: number, nowSec?: number }} [opts]
 * @returns {Promise<{ writeToken: string, expiresAt: string, expiresInSec: number }|null>}
 */
export async function issueHostWriteToken(env, opts = {}) {
  const key = resolveSigningKey(env);
  if (!key) return null;
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const ttlSec = opts.ttlSec ?? resolveHostTokenTtlSec(env);
  const exp = nowSec + ttlSec;
  const payload = JSON.stringify({ v: 1, exp, scope: HOST_WRITE_SCOPE });
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payload));
  const sig = await hmacSha256(key, payloadB64);
  const writeToken = `${payloadB64}.${bytesToBase64Url(sig)}`;
  return {
    writeToken,
    expiresAt: new Date(exp * 1000).toISOString(),
    expiresInSec: ttlSec,
  };
}

/**
 * @param {object} env
 * @param {string} token
 * @param {{ nowSec?: number }} [opts]
 * @returns {Promise<{ ok: true, exp: number } | { ok: false, error: string }>}
 */
export async function verifyHostWriteToken(env, token, opts = {}) {
  const key = resolveSigningKey(env);
  if (!key) return { ok: false, error: 'token-not-configured' };
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: 'bad-token' };
  }
  const [payloadB64, sigB64] = parts;
  let expectedSig;
  try {
    expectedSig = await hmacSha256(key, payloadB64);
  } catch {
    return { ok: false, error: 'bad-token' };
  }
  let gotSig;
  try {
    gotSig = base64UrlToBytes(sigB64);
  } catch {
    return { ok: false, error: 'bad-token' };
  }
  if (!timingSafeEqualBytes(expectedSig, gotSig)) {
    return { ok: false, error: 'bad-token' };
  }
  let payload;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payloadB64));
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'bad-token' };
  }
  if (payload?.v !== 1 || payload?.scope !== HOST_WRITE_SCOPE) {
    return { ok: false, error: 'bad-token' };
  }
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp)) return { ok: false, error: 'bad-token' };
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (exp < nowSec) return { ok: false, error: 'token-expired' };
  return { ok: true, exp };
}

/** True if string looks like our issued token (not the raw master secret). */
export function looksLikeHostWriteToken(value) {
  const s = String(value || '');
  if (!s.includes('.')) return false;
  const [a, b] = s.split('.');
  return !!(a && b && /^[A-Za-z0-9_-]+$/.test(a) && /^[A-Za-z0-9_-]+$/.test(b));
}

/**
 * Accept either a valid writeToken or the raw ROOM_CREATE_SECRET (legacy / first unlock).
 * Prefer explicit writeToken; createSecret is tried as master secret first, then as token
 * (sessionStorage migration / older clients).
 * @param {object} env
 * @param {{ createSecret?: string, writeToken?: string }} body
 */
export async function assertHostWriteAllowed(env, body = {}) {
  const writeToken = body?.writeToken != null ? String(body.writeToken) : '';
  const createSecret = body?.createSecret != null ? String(body.createSecret) : '';

  if (writeToken) {
    const verified = await verifyHostWriteToken(env, writeToken);
    if (verified.ok) return { ok: true, via: 'write-token' };
    if (verified.error === 'token-expired') {
      return { ok: false, error: 'token-expired', status: 401 };
    }
    return { ok: false, error: 'forbidden', status: 403 };
  }

  if (!createSecret) {
    return { ok: false, error: 'forbidden', status: 403 };
  }

  const gate = assertRoomCreateAllowed(env, createSecret);
  if (gate.ok) return { ok: true, via: 'create-secret' };

  if (gate.error === 'forbidden' && looksLikeHostWriteToken(createSecret)) {
    const verified = await verifyHostWriteToken(env, createSecret);
    if (verified.ok) return { ok: true, via: 'write-token' };
    if (verified.error === 'token-expired') {
      return { ok: false, error: 'token-expired', status: 401 };
    }
  }

  return gate;
}
