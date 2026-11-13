import { describe, expect, it } from 'vitest';
import {
  assertHostWriteAllowed,
  issueHostWriteToken,
  looksLikeHostWriteToken,
  verifyHostWriteToken,
} from './hostWriteToken.js';

const env = { ROOM_CREATE_SECRET: 'host-only' };

describe('host write token', () => {
  it('issues and verifies a token', async () => {
    const issued = await issueHostWriteToken(env, { nowSec: 1_700_000_000, ttlSec: 3600 });
    expect(issued.writeToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(looksLikeHostWriteToken(issued.writeToken)).toBe(true);
    expect(issued.expiresInSec).toBe(3600);

    const ok = await verifyHostWriteToken(env, issued.writeToken, { nowSec: 1_700_000_100 });
    expect(ok).toEqual({ ok: true, exp: 1_700_000_000 + 3600 });
  });

  it('rejects tampered or expired tokens', async () => {
    const issued = await issueHostWriteToken(env, { nowSec: 1_700_000_000, ttlSec: 60 });
    const [payload, sig] = issued.writeToken.split('.');
    expect((await verifyHostWriteToken(env, `${payload}x.${sig}`, { nowSec: 1_700_000_000 })).ok).toBe(false);
    expect((await verifyHostWriteToken(env, `${payload}.${sig.slice(0, -2)}aa`, { nowSec: 1_700_000_000 })).ok).toBe(false);
    expect(await verifyHostWriteToken(env, issued.writeToken, { nowSec: 1_700_000_061 })).toEqual({
      ok: false,
      error: 'token-expired',
    });
  });

  it('assertHostWriteAllowed accepts raw secret and writeToken', async () => {
    expect(await assertHostWriteAllowed(env, { createSecret: 'host-only' })).toEqual({
      ok: true,
      via: 'create-secret',
    });
    expect(await assertHostWriteAllowed(env, { createSecret: 'wrong' })).toMatchObject({
      ok: false,
      error: 'forbidden',
    });

    const issued = await issueHostWriteToken(env, { ttlSec: 3600 });
    expect(await assertHostWriteAllowed(env, { writeToken: issued.writeToken })).toEqual({
      ok: true,
      via: 'write-token',
    });
    // Legacy: token stuffed into createSecret field
    expect(await assertHostWriteAllowed(env, { createSecret: issued.writeToken })).toEqual({
      ok: true,
      via: 'write-token',
    });
  });

  it('returns token-expired with 401', async () => {
    const stale = await issueHostWriteToken(env, {
      nowSec: Math.floor(Date.now() / 1000) - 120,
      ttlSec: 60,
    });
    expect(await assertHostWriteAllowed(env, { writeToken: stale.writeToken })).toEqual({
      ok: false,
      error: 'token-expired',
      status: 401,
    });
  });
});
