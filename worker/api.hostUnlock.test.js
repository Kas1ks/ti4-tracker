import { describe, expect, it } from 'vitest';
import { handleApi } from './api.js';
import { verifyHostWriteToken } from './rooms/hostWriteToken.js';

describe('POST /api/host-unlock', () => {
  it('issues a writeToken after valid createSecret', async () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    const res = await handleApi(new Request('https://example.test/api/host-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createSecret: 'host-only' }),
    }), env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.writeToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(data.expiresAt).toBeTruthy();
    expect((await verifyHostWriteToken(env, data.writeToken)).ok).toBe(true);
  });

  it('refreshes writeToken when an existing token is presented', async () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    const first = await handleApi(new Request('https://example.test/api/host-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createSecret: 'host-only' }),
    }), env);
    const { writeToken } = await first.json();

    const second = await handleApi(new Request('https://example.test/api/host-unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writeToken }),
    }), env);
    expect(second.status).toBe(200);
    const data = await second.json();
    expect(data.writeToken).toBeTruthy();
    expect((await verifyHostWriteToken(env, data.writeToken)).ok).toBe(true);
    // Original token still valid until its own exp
    expect((await verifyHostWriteToken(env, writeToken)).ok).toBe(true);
  });
});
