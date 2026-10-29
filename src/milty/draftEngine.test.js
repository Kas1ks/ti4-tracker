import { describe, expect, it } from 'vitest';
import {
  PICK,
  applyPick,
  claimPlayer,
  createDraftDocument,
  regenerateDraftPart,
  snakeOrder,
  unclaimPlayer,
  undoLastPick,
} from './draftEngine.js';

describe('draftEngine', () => {
  it('snake order for 3 players is F+R', () => {
    expect(snakeOrder(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'c', 'b', 'a']);
  });

  it('runs a full 3-player draft offline', () => {
    const draft = createDraftDocument({
      playerNames: ['Ann', 'Bob', 'Cara'],
      numberOfSlices: 3,
      numberOfFactions: 5,
      seed: 7,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    expect(draft.playerOrder).toHaveLength(3);
    expect(draft.slicePool).toHaveLength(3);
    expect(draft.factionPool.length).toBeGreaterThanOrEqual(3);

    for (const id of draft.playerOrder) {
      const claimed = claimPlayer(draft, { playerId: id });
      expect(claimed.ok).toBe(true);
    }

    const factions = draft.factionPool.map((f) => f.id);
    let fi = 0;
    let si = 0;
    let pi = 0;
    const picksNeeded = 9;
    for (let step = 0; step < picksNeeded; step += 1) {
      const pid = draft.currentPlayerId;
      const player = draft.players[pid];
      let category;
      let value;
      if (player.faction == null) {
        category = PICK.FACTION;
        value = factions[fi++];
      } else if (player.slice == null) {
        category = PICK.SLICE;
        value = si++;
      } else {
        category = PICK.POSITION;
        value = pi++;
      }
      const res = applyPick(draft, {
        playerId: pid,
        secret: player.secret,
        category,
        value,
        logIndex: draft.log.length,
      });
      expect(res.ok).toBe(true);
    }
    expect(draft.done).toBe(true);
    expect(draft.log).toHaveLength(9);
  });

  it('admin can undo', () => {
    const draft = createDraftDocument({
      playerNames: ['A', 'B', 'C'],
      numberOfSlices: 3,
      numberOfFactions: 4,
      seed: 3,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    for (const id of draft.playerOrder) claimPlayer(draft, { playerId: id });
    const pid = draft.currentPlayerId;
    const player = draft.players[pid];
    applyPick(draft, {
      playerId: pid,
      secret: player.secret,
      category: PICK.FACTION,
      value: draft.factionPool[0].id,
      logIndex: 0,
    });
    expect(draft.log).toHaveLength(1);
    const undo = undoLastPick(draft, { adminSecret: draft.adminSecret });
    expect(undo.ok).toBe(true);
    expect(draft.log).toHaveLength(0);
    expect(player.faction).toBeNull();
  });

  it('admin can regenerate only before first pick', () => {
    const draft = createDraftDocument({
      playerNames: ['A', 'B', 'C'],
      numberOfSlices: 3,
      numberOfFactions: 5,
      seed: 11,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    for (const id of draft.playerOrder) claimPlayer(draft, { playerId: id });

    const slices = regenerateDraftPart(draft, 'slices', { adminSecret: draft.adminSecret });
    expect(slices.ok).toBe(true);
    const factions = regenerateDraftPart(draft, 'factions', { adminSecret: draft.adminSecret });
    expect(factions.ok).toBe(true);
    const beforeOrder = [...draft.playerOrder];
    const order = regenerateDraftPart(draft, 'order', { adminSecret: draft.adminSecret });
    expect(order.ok).toBe(true);
    expect(draft.playerOrder).toHaveLength(beforeOrder.length);
    expect(new Set(draft.playerOrder)).toEqual(new Set(beforeOrder));

    const pid = draft.currentPlayerId;
    const player = draft.players[pid];
    applyPick(draft, {
      playerId: pid,
      secret: player.secret,
      category: PICK.SLICE,
      value: 0,
      logIndex: 0,
    });
    expect(player.slice).toBe(0);
    expect(regenerateDraftPart(draft, 'slices', { adminSecret: draft.adminSecret }).ok).toBe(false);
    expect(regenerateDraftPart(draft, 'factions', { adminSecret: draft.adminSecret }).error).toBe('draft-started');
  });

  it('unclaims a seat before picks', () => {
    const draft = createDraftDocument({
      playerNames: ['Ann', 'Bob'],
      numberOfSlices: 2,
      numberOfFactions: 4,
      seed: 3,
      presetDraftOrder: true,
    });
    const pid = draft.playerOrder[0];
    const claimed = claimPlayer(draft, { playerId: pid });
    expect(claimed.ok).toBe(true);
    const freed = unclaimPlayer(draft, { playerId: pid, secret: claimed.secret });
    expect(freed.ok).toBe(true);
    expect(draft.players[pid].claimed).toBe(false);
    expect(draft.players[pid].secret).toBeNull();
  });
});
