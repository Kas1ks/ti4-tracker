import { describe, expect, it } from 'vitest';
import {
  assembleDraftMap,
  axialOf,
  layoutForPlayers,
  positionOf,
  sliceSlotsForHome,
} from './assembleMap.js';
import { createDraftDocument } from './draftEngine.js';

describe('assembleMap', () => {
  it('maps speaker home to top of ring 3', () => {
    expect(axialOf(19)).toEqual([3, 0]);
    expect(positionOf(3, 0)).toBe(19);
  });

  it('places 6p slice slots for speaker (north)', () => {
    const slots = sliceSlotsForHome(19);
    expect(slots.slots).toEqual([
      positionOf(2, 1), // home-left
      positionOf(2, 0), // center
      positionOf(3, -1), // home-right
      positionOf(1, 1), // equidistant
      positionOf(1, 0), // mecatol-gate
    ]);
  });

  it('5p layout uses hyperlanes and 5 homes', () => {
    const layout = layoutForPlayers(5);
    expect(layout.homeWorlds).toHaveLength(5);
    expect(layout.hyperlanes.length).toBeGreaterThan(0);
    expect(layout.hyperlanes.some((h) => h[1] === '83A')).toBe(true);
  });

  it('assembles mecatol + hyperlanes before picks', () => {
    const draft = createDraftDocument({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      numberOfSlices: 5,
      numberOfFactions: 6,
      seed: 1,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    const map = assembleDraftMap(draft);
    expect(map.cells[0].tileId).toBe(18);
    const hyper = map.cells.filter((c) => c.kind === 'hyperlane');
    expect(hyper.length).toBe(6);
  });

  it('fills slice tiles when seat has position+slice', () => {
    const draft = createDraftDocument({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      numberOfSlices: 6,
      numberOfFactions: 7,
      seed: 2,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    const speakerId = draft.playerOrder[0];
    draft.players[speakerId].position = 0;
    draft.players[speakerId].slice = 0;
    const map = assembleDraftMap(draft);
    const sliceCells = map.cells.filter((c) => c.kind === 'slice');
    expect(sliceCells.length).toBe(5);
    expect(map.cells[19].kind).toBe('home');
    expect(map.cells[19].playerName).toBe('A');
    expect(sliceCells.every((c) => c.tileId != null)).toBe(true);
  });

  it('rotates players around home seats without changing draft data', () => {
    const draft = createDraftDocument({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      numberOfSlices: 6,
      numberOfFactions: 7,
      seed: 3,
      minLegendaries: 0,
      minTwoWormholes: false,
      presetDraftOrder: true,
    });
    draft.playerOrder.forEach((pid, i) => {
      draft.players[pid].position = i;
      draft.players[pid].slice = i;
    });
    const homes = layoutForPlayers(6).homeWorlds;
    const base = assembleDraftMap(draft);
    expect(base.cells[homes[0]].playerName).toBe('A');
    expect(base.cells[homes[1]].playerName).toBe('B');

    const cw = assembleDraftMap(draft, { seatOffset: 1 });
    // Clockwise: seat slot 0 shows previous last seat's player (F), slot 1 shows A.
    expect(cw.cells[homes[0]].playerName).toBe('F');
    expect(cw.cells[homes[1]].playerName).toBe('A');
    expect(cw.cells[homes[0]].seatIndex).toBe(5);
    expect(draft.players[draft.playerOrder[0]].position).toBe(0);
  });
});
