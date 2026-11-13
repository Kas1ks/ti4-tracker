import { describe, expect, it } from 'vitest';
import { handleApi } from './api.js';

describe('GET /api/health', () => {
  it('returns liveness without secret or binding flags', async () => {
    const res = await handleApi(new Request('https://example.test/api/health'), {
      ROOM_CREATE_SECRET: 'secret',
      ADMIN_PIN: 'pin',
      GAME_ROOMS: null,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, rooms: 'memory' });
    expect(data).not.toHaveProperty('hasAdminPin');
    expect(data).not.toHaveProperty('hasRoomCreateSecret');
    expect(data).not.toHaveProperty('roomCreateSecretKeys');
    expect(data).not.toHaveProperty('hasMasterKey');
    expect(data).not.toHaveProperty('hasBinId');
  });
});
