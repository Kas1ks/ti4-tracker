import { describe, expect, it, beforeEach } from 'vitest';
import {
  ROOM_SESSION_KEY,
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
} from './roomSession.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
    get size() { return map.size; },
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

describe('roomSession', () => {
  it('round-trips a session', () => {
    saveRoomSession({
      roomId: 'abc123',
      hostKey: 'hk',
      sessionToken: 'st',
      role: 'admin',
      seatPlayerId: null,
      seq: 4,
    });
    expect(loadRoomSession()).toEqual({
      roomId: 'ABC123',
      hostKey: 'hk',
      sessionToken: 'st',
      role: 'admin',
      seatPlayerId: null,
      seq: 4,
    });
    expect(localStorage.getItem(ROOM_SESSION_KEY)).toBeTruthy();
  });

  it('clears on leave', () => {
    saveRoomSession({
      roomId: 'XYZ999',
      hostKey: null,
      sessionToken: 'tok',
      role: 'player',
      seatPlayerId: 2,
    });
    clearRoomSession();
    expect(loadRoomSession()).toBeNull();
  });

  it('ignores garbage', () => {
    localStorage.setItem(ROOM_SESSION_KEY, '{nope');
    expect(loadRoomSession()).toBeNull();
  });
});
