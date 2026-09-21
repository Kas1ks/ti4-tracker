import { describe, expect, it } from 'vitest';
import {
  assertRoomCreateAllowed,
  resolveRoomCreateSecret,
  roomCreateSecretMatches,
} from '../../worker/rooms/roomCreateAuth.js';

describe('room create secret', () => {
  it('resolves ROOM_CREATE_SECRET and VITE_ fallback', () => {
    expect(resolveRoomCreateSecret({ ROOM_CREATE_SECRET: 'a' })).toBe('a');
    expect(resolveRoomCreateSecret({ VITE_ROOM_CREATE_SECRET: 'b' })).toBe('b');
    expect(resolveRoomCreateSecret({})).toBe('');
  });

  it('denies when secret is not configured', () => {
    expect(assertRoomCreateAllowed({}, 'anything')).toEqual({
      ok: false,
      error: 'create-secret-not-configured',
      status: 503,
    });
  });

  it('denies wrong or missing createSecret', () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    expect(assertRoomCreateAllowed(env, null)).toMatchObject({ ok: false, error: 'forbidden' });
    expect(assertRoomCreateAllowed(env, '')).toMatchObject({ ok: false, error: 'forbidden' });
    expect(assertRoomCreateAllowed(env, 'wrong')).toMatchObject({ ok: false, error: 'forbidden' });
    expect(roomCreateSecretMatches(env, 'wrong')).toBe(false);
  });

  it('allows exact match', () => {
    const env = { ROOM_CREATE_SECRET: 'host-only' };
    expect(assertRoomCreateAllowed(env, 'host-only')).toEqual({ ok: true });
    expect(roomCreateSecretMatches(env, 'host-only')).toBe(true);
  });
});
