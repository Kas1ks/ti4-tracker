import { describe, expect, it } from 'vitest';
import { handleMiltyApi } from './miltyApi.js';

function req(body) {
  return new Request('https://example.test/api/milty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/milty createSecret gate', () => {
  it('rejects when ROOM_CREATE_SECRET is not configured', async () => {
    const res = await handleMiltyApi(req({ settings: {}, createSecret: 'x' }), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'create-secret-not-configured' });
  });

  it('rejects missing createSecret', async () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    const res = await handleMiltyApi(req({ settings: {} }), env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('rejects wrong createSecret', async () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    const res = await handleMiltyApi(req({ settings: {}, createSecret: 'wrong' }), env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('creates draft when createSecret matches', async () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    const res = await handleMiltyApi(
      req({
        createSecret: 'host-only',
        settings: {
          playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
          numberOfSlices: 6,
          numberOfFactions: 9,
        },
      }),
      env,
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.id).toMatch(/^[A-Z0-9]+$/);
    expect(data.adminSecret).toBeTruthy();
    expect(data.draft).toBeTruthy();
  });
});
