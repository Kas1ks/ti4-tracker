import { describe, expect, it } from 'vitest';
import { handleAdminRoomsApi } from './roomsApi.js';
import {
  memoryCreateRoom,
  memorySubscribe,
  memoryAdminRoomSnapshot,
  memoryJoin,
  memoryAdminCloseRoom,
} from './memoryRooms.js';
import { adminSnapshotHasSecrets } from './adminRoomSnapshot.js';
import { ROLES } from '../../src/sync/permissions.js';

function adminReq(body, path = '/api/admin/rooms') {
  return new Request(`https://example.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/rooms', () => {
  it('rejects missing or wrong ADMIN_PIN', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const noPin = await handleAdminRoomsApi(adminReq({}), env);
    expect(noPin.status).toBe(401);

    const wrong = await handleAdminRoomsApi(adminReq({ pin: 'nope' }), env);
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: 'unauthorized' });
  });

  it('lists memory rooms with client snapshots and no secrets', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const created = memoryCreateRoom({
      isGameActive: false,
      players: [{ id: 1, name: 'Solo', factionId: 'sol', color: '#fff' }],
    });
    const unsub = memorySubscribe(created.roomId, () => {}, {
      role: ROLES.ADMIN,
      seatPlayerId: null,
    });

    const res = await handleAdminRoomsApi(adminReq({ pin: 'correct-pin' }), env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.backend).toBe('memory');
    expect(Array.isArray(data.rooms)).toBe(true);

    const mine = data.rooms.find((r) => r.roomId === created.roomId);
    expect(mine).toBeTruthy();
    expect(mine.sseCount).toBeGreaterThanOrEqual(1);
    expect(mine.clients.some((c) => c.role === 'admin')).toBe(true);
    expect(mine.health).toBeTruthy();
    expect(mine.game).toBeTruthy();
    expect(Array.isArray(mine.events)).toBe(true);
    expect(mine.events.some((e) => e.kind === 'connect')).toBe(true);
    expect(adminSnapshotHasSecrets(mine)).toBe(false);
    expect(JSON.stringify(mine)).not.toMatch(/hostKey|sessionToken|seatSecret/i);

    const one = await handleAdminRoomsApi(
      adminReq({ pin: 'correct-pin' }, `/api/admin/rooms/${created.roomId}`),
      env,
    );
    expect(one.status).toBe(200);
    const oneData = await one.json();
    expect(oneData.room.roomId).toBe(created.roomId);
    expect(adminSnapshotHasSecrets(oneData.room)).toBe(false);

    unsub();
  });

  it('memoryAdminRoomSnapshot omits secrets even when room has them', () => {
    const created = memoryCreateRoom();
    expect(created.hostKey).toBeTruthy();
    const snap = memoryAdminRoomSnapshot(created.roomId);
    expect(snap.roomId).toBe(created.roomId);
    expect(adminSnapshotHasSecrets(snap)).toBe(false);
    expect(snap).not.toHaveProperty('hostKey');
    expect(snap).not.toHaveProperty('sessionToken');
  });

  it('kicks a claimed seat via admin API', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const created = memoryCreateRoom({
      isGameActive: true,
      players: [
        { id: 1, name: 'Alice', factionId: 'sol', color: '#fff' },
        { id: 2, name: 'Bob', factionId: 'hacan', color: '#f00' },
      ],
    });
    const joined = await memoryJoin(created.roomId, {
      role: ROLES.PLAYER,
      seatPlayerId: 1,
    });
    expect(joined.ok).toBe(true);

    const before = memoryAdminRoomSnapshot(created.roomId);
    expect(before.seats.find((s) => s.id === 1)?.claimed).toBe(true);

    const kick = await handleAdminRoomsApi(
      adminReq({ pin: 'correct-pin', seatPlayerId: 1 }, `/api/admin/rooms/${created.roomId}/kick`),
      env,
    );
    expect(kick.status).toBe(200);
    const kickData = await kick.json();
    expect(kickData.ok).toBe(true);
    expect(kickData.seatPlayerId).toBe(1);
    expect(adminSnapshotHasSecrets(kickData.room)).toBe(false);

    const after = memoryAdminRoomSnapshot(created.roomId);
    expect(after.seats.find((s) => s.id === 1)?.claimed).toBe(false);
    expect(after.events.some((e) => e.actionType === 'ADMIN_KICK')).toBe(true);
  });

  it('closes a room via admin API', async () => {
    const env = { ADMIN_PIN: 'correct-pin' };
    const created = memoryCreateRoom();
    expect(memoryAdminRoomSnapshot(created.roomId)).toBeTruthy();

    const close = await handleAdminRoomsApi(
      adminReq({ pin: 'correct-pin' }, `/api/admin/rooms/${created.roomId}/close`),
      env,
    );
    expect(close.status).toBe(200);
    const closeData = await close.json();
    expect(closeData.ok).toBe(true);
    expect(memoryAdminRoomSnapshot(created.roomId)).toBeNull();
  });

  it('memoryAdminCloseRoom is idempotent on missing room', () => {
    expect(memoryAdminCloseRoom('NOPEXX')).toEqual({ ok: false, error: 'not-found' });
  });
});
