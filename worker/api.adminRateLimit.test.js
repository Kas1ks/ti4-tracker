import { describe, expect, it } from 'vitest';
import { handleApi } from './api.js';

function adminList(pin, ip) {
  return new Request('https://example.test/api/admin/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ pin }),
  });
}

describe('admin rooms rate limits', () => {
  it('rate-limits wrong PIN guesses without blocking successful polls', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const ip = '203.0.113.90';

    for (let i = 0; i < 15; i += 1) {
      const res = await handleApi(adminList(`wrong-${i}`, ip), env);
      expect(res.status).toBe(401);
    }
    const blocked = await handleApi(adminList('wrong-final', ip), env);
    expect(blocked.status).toBe(429);

    // Same IP with correct PIN still works — successes use admin-poll, not admin-auth.
    const ok = await handleApi(adminList('correct-pin', ip), env);
    expect(ok.status).toBe(200);
  });

  it('allows many successful admin polls without hitting the auth limit', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const ip = '203.0.113.91';
    for (let i = 0; i < 20; i += 1) {
      const res = await handleApi(adminList('correct-pin', ip), env);
      expect(res.status).toBe(200);
    }
  });
});
