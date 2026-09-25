import { expect, test } from '@playwright/test';

const SECRET = process.env.ROOM_CREATE_SECRET || 'e2e-secret';

async function json(res) {
  const data = await res.json();
  return { status: res.status(), data };
}

test.describe('live room API critical path', () => {
  test('health reports memory rooms', async ({ request }) => {
    const { status, data } = await json(await request.get('/api/health'));
    expect(status).toBe(200);
    expect(data.rooms).toBe('memory');
  });

  test('create → action → undo', async ({ request }) => {
    const created = await json(await request.post('/api/rooms', {
      data: { state: null, createSecret: SECRET },
    }));
    expect(created.status).toBe(201);
    const { roomId, hostKey } = created.data;
    expect(roomId).toMatch(/^[A-Z0-9]+$/);
    expect(hostKey).toBeTruthy();

    const add1 = await json(await request.post(`/api/rooms/${roomId}/actions`, {
      data: {
        action: { type: 'ADD_PLAYER', playerId: 1, factionId: 'sol', name: 'Alice', color: '#3b82f6' },
        hostKey,
      },
    }));
    expect(add1.status).toBe(200);
    expect(add1.data.state.players).toHaveLength(1);
    expect(add1.data.canUndo).toBe(true);

    const add2 = await json(await request.post(`/api/rooms/${roomId}/actions`, {
      data: {
        action: { type: 'ADD_PLAYER', playerId: 2, factionId: 'hacan', name: 'Bob', color: '#eab308' },
        hostKey,
      },
    }));
    expect(add2.status).toBe(200);
    expect(add2.data.state.players).toHaveLength(2);

    const start = await json(await request.post(`/api/rooms/${roomId}/actions`, {
      data: { action: { type: 'START_GAME' }, hostKey },
    }));
    expect(start.status).toBe(200);
    expect(start.data.state.isGameActive).toBe(true);

    const join = await json(await request.post(`/api/rooms/${roomId}/join`, {
      data: { role: 'viewer' },
    }));
    expect(join.status).toBe(200);
    expect(join.data.role === 'viewer' || join.data.sessionToken).toBeTruthy();

    const undo = await json(await request.post(`/api/rooms/${roomId}/actions`, {
      data: { action: { type: 'UNDO_LAST' }, hostKey },
    }));
    expect(undo.status).toBe(200);
    // Undoes START_GAME → back to setup with 2 players
    expect(undo.data.state.isGameActive).toBe(false);
    expect(undo.data.state.players).toHaveLength(2);

    const snap = await json(await request.get(`/api/rooms/${roomId}/snapshot`));
    expect(snap.status).toBe(200);
    expect(snap.data.roomId).toBe(roomId);
    expect(snap.data.seq).toBe(undo.data.seq);
  });
});
