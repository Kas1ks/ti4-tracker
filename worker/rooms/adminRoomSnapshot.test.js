import { describe, expect, it } from 'vitest';
import { createRoomRecord } from './roomCore.js';
import {
  adminSnapshotHasSecrets,
  buildAdminRoomSnapshot,
} from './adminRoomSnapshot.js';
import { noteAdminEventOnRoom } from './adminEvents.js';
import { normalizeGameState } from '../../src/game/gameState.js';

describe('buildAdminRoomSnapshot', () => {
  it('returns phase/clients without session secrets', () => {
    const room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      players: [
        { id: 1, name: 'Алиса', factionId: 'sol', color: '#3b82f6' },
        { id: 2, name: 'Боб', factionId: 'hacan', color: '#ef4444' },
      ],
    }));
    room.hostKey = 'super-secret-host-key';
    const snap = buildAdminRoomSnapshot(room, [
      { role: 'admin', seatPlayerId: null, isAdmin: true },
      { role: 'player', seatPlayerId: 1 },
      { role: 'viewer', seatPlayerId: null },
    ]);

    expect(snap.roomId).toBe(room.roomId);
    expect(snap.phase).toBe('game');
    expect(snap.sseCount).toBe(3);
    expect(snap.clients).toEqual([
      { role: 'admin', seatPlayerId: null, playerName: null },
      { role: 'player', seatPlayerId: 1, playerName: 'Алиса' },
      { role: 'viewer', seatPlayerId: null, playerName: null },
    ]);
    expect(snap.game).toMatchObject({
      roundNumber: expect.any(Number),
      useTe: expect.any(Boolean),
    });
    expect(snap.health).toMatchObject({
      seq: expect.any(Number),
      loadHint: expect.objectContaining({ sseCount: 3 }),
    });
    expect(snap.seats).toHaveLength(2);
    expect(adminSnapshotHasSecrets(snap)).toBe(false);
    expect(JSON.stringify(snap)).not.toMatch(/hostKey|sessionToken|seatSecret/i);
  });

  it('marks milty drafting phase', () => {
    const room = createRoomRecord();
    room.milty = { draftId: 'DRAFT1', status: 'drafting' };
    const snap = buildAdminRoomSnapshot(room, []);
    expect(snap.phase).toBe('milty');
    expect(snap.miltyStatus).toBe('drafting');
  });

  it('exposes secrets discard and politics flags without card ids', () => {
    const room = createRoomRecord(normalizeGameState({
      isGameActive: true,
      meta: { isPoliticsActive: true, isAgendaPhasePending: true },
      politics: {
        showModal: true,
        step: 'VOTE',
        agendas: [{ id: 'mutiny' }],
        activeLaws: [{ id: 'minister_of_peace' }],
      },
      secretObjectives: {
        dealStarted: true,
        draftPending: false,
        deck: ['so_a', 'so_b', 'so_c'],
        scored: ['so_scored'],
        pendingReveals: { 1: 'so_secret_id' },
        overflows: { 2: { resolveStrategy: true } },
      },
      players: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
    }));
    const snap = buildAdminRoomSnapshot(room, []);
    expect(snap.politics).toMatchObject({
      active: true,
      agendaPending: true,
      modalOpen: true,
      step: 'VOTE',
      lawsCount: 1,
    });
    expect(snap.secrets).toMatchObject({
      dealStarted: true,
      draftPending: false,
      deckCount: 3,
      scoredCount: 1,
      pendingRevealCount: 1,
      discardSeatCount: 1,
    });
    expect(snap.attention).toBe('politics');
    expect(JSON.stringify(snap)).not.toMatch(/so_secret_id|so_a|mutiny/);
    expect(adminSnapshotHasSecrets(snap)).toBe(false);
  });

  it('includes admin events without leaking secrets', () => {
    let room = createRoomRecord();
    room = noteAdminEventOnRoom(room, {
      kind: 'connect',
      summary: 'хост подключился',
      role: 'admin',
    });
    room = noteAdminEventOnRoom(room, {
      kind: 'action',
      summary: 'старт партии',
      actionType: 'START_GAME',
    });
    const snap = buildAdminRoomSnapshot(room, [], { events: room.adminEvents });
    expect(snap.events).toHaveLength(2);
    expect(snap.events[0].kind).toBe('connect');
    expect(snap.events[1].actionType).toBe('START_GAME');
    expect(adminSnapshotHasSecrets(snap)).toBe(false);
  });
});
