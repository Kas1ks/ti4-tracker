import { expect, test } from '@playwright/test';

const SECRET = process.env.ROOM_CREATE_SECRET || 'e2e-secret';

async function json(res) {
  const data = await res.json();
  return { status: res.status(), data };
}

test.describe('standalone milty create API', () => {
  test('rejects create without secret', async ({ request }) => {
    const { status, data } = await json(await request.post('/api/milty', {
      data: {
        settings: {
          playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
          numberOfSlices: 6,
          numberOfFactions: 9,
        },
      },
    }));
    expect(status).toBe(403);
    expect(data.error).toBe('forbidden');
  });

  test('rejects create with wrong secret', async ({ request }) => {
    const { status, data } = await json(await request.post('/api/milty', {
      data: {
        createSecret: 'not-the-secret',
        settings: {
          playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
          numberOfSlices: 6,
          numberOfFactions: 9,
        },
      },
    }));
    expect(status).toBe(403);
    expect(data.error).toBe('forbidden');
  });

  test('creates draft with valid createSecret', async ({ request }) => {
    const created = await json(await request.post('/api/milty', {
      data: {
        createSecret: SECRET,
        settings: {
          playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
          numberOfSlices: 6,
          numberOfFactions: 9,
        },
      },
    }));
    expect(created.status).toBe(201);
    expect(created.data.ok).toBe(true);
    expect(created.data.id).toMatch(/^[A-Z0-9]+$/);
    expect(created.data.adminSecret).toBeTruthy();

    const snap = await json(await request.get(`/api/milty/${created.data.id}`));
    expect(snap.status).toBe(200);
    expect(snap.data.ok).toBe(true);
    expect(snap.data.draft?.id).toBe(created.data.id);
  });
});
