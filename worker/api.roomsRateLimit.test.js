import { describe, expect, it } from 'vitest';
import { handleApi } from './api.js';

function postRooms(secret, ip) {
  return new Request('https://example.test/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ createSecret: secret, state: null }),
  });
}

function claimHost(roomId, hostKey, ip) {
  return new Request(`https://example.test/api/rooms/${roomId}/claim-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ hostKey }),
  });
}

describe('rooms API rate limits (host-secret surface)', () => {
  it('rate-limits POST /api/rooms createSecret guesses per IP', async () => {
    const env = { ROOM_CREATE_SECRET: 'real-host-secret' };
    const ip = '203.0.113.50';
    for (let i = 0; i < 15; i += 1) {
      const res = await handleApi(postRooms(`wrong-${i}`, ip), env);
      expect(res.status).not.toBe(429);
      expect([401, 403]).toContain(res.status);
    }
    const limited = await handleApi(postRooms('wrong-16', ip), env);
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toBe('rate-limited');
  });

  it('shares host-secret bucket with /api/host-unlock', async () => {
    const env = { ROOM_CREATE_SECRET: 'real-host-secret' };
    const ipHeaders = {
      'Content-Type': 'application/json',
      'cf-connecting-ip': '198.51.100.7',
    };
    for (let i = 0; i < 10; i += 1) {
      const unlock = await handleApi(new Request('https://example.test/api/host-unlock', {
        method: 'POST',
        headers: ipHeaders,
        body: JSON.stringify({ createSecret: `nope-${i}` }),
      }), env);
      expect(unlock.status).not.toBe(429);
    }
    for (let i = 0; i < 5; i += 1) {
      const create = await handleApi(new Request('https://example.test/api/rooms', {
        method: 'POST',
        headers: ipHeaders,
        body: JSON.stringify({ createSecret: `still-wrong-${i}`, state: null }),
      }), env);
      expect(create.status).not.toBe(429);
    }
    const blocked = await handleApi(new Request('https://example.test/api/host-unlock', {
      method: 'POST',
      headers: ipHeaders,
      body: JSON.stringify({ createSecret: 'final-wrong' }),
    }), env);
    expect(blocked.status).toBe(429);
  });

  it('rate-limits claim-host attempts', async () => {
    const env = { ROOM_CREATE_SECRET: 'real-host-secret' };
    const ip = '203.0.113.77';
    for (let i = 0; i < 15; i += 1) {
      const res = await handleApi(claimHost('AAAAAA', `bad-key-${i}`, ip), env);
      expect(res.status).not.toBe(429);
    }
    const blocked = await handleApi(claimHost('AAAAAA', 'bad-key-final', ip), env);
    expect(blocked.status).toBe(429);
  });
});
