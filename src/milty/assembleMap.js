/**
 * Assemble a milty draft into a TI4 hex board (Mecatol + slices + hyperlanes).
 * Coordinate / ring numbering matches KeeganW/ti4 (speaker home = top of ring 3).
 */

const MAX_RING = 3;

/** Walk order around a ring — index 1 is north of Mecatol. */
const HEX_DIRECTIONS = [
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
];

/** Edge order for hyperlane rotations (0 = top, clockwise). */
const EDGE_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

function ringCoordinates(ring) {
  const coordinates = [];
  let q = ring;
  let r = 0;
  for (let side = 0; side < 6; side += 1) {
    for (let step = 0; step < ring; step += 1) {
      coordinates.push([q, r]);
      q += HEX_DIRECTIONS[side][0];
      r += HEX_DIRECTIONS[side][1];
    }
  }
  return coordinates;
}

const axialByPosition = [[0, 0]];
const positionByAxial = new Map([['0,0', 0]]);
for (let ring = 1; ring <= MAX_RING; ring += 1) {
  for (const [q, r] of ringCoordinates(ring)) {
    positionByAxial.set(`${q},${r}`, axialByPosition.length);
    axialByPosition.push([q, r]);
  }
}

export function axialOf(position) {
  return axialByPosition[position] || null;
}

export function positionOf(q, r) {
  const v = positionByAxial.get(`${q},${r}`);
  return v == null ? null : v;
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

/** 60° clockwise cube rotation of an axial vector. */
function rotateCw([q, r]) {
  const s = -q - r;
  return [-s, -q];
}

/** 60° counter-clockwise. */
function rotateCcw([q, r]) {
  const s = -q - r;
  return [-r, -s];
}

/** One hex step from (q,r) toward Mecatol (0,0). */
function stepTowardOrigin(q, r) {
  let best = [0, 0];
  let bestDist = Infinity;
  for (const [dq, dr] of EDGE_DIRECTIONS) {
    const nq = q + dq;
    const nr = r + dr;
    const dist = (Math.abs(nq) + Math.abs(nr) + Math.abs(-nq - nr)) / 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = [dq, dr];
    }
  }
  return best;
}

/**
 * Board slots for one milty slice around a home system.
 * Slice tile order: 0 home-left, 1 center, 2 home-right, 3 equidistant, 4 mecatol-gate.
 */
export function sliceSlotsForHome(homePos) {
  const home = axialOf(homePos);
  if (!home) return null;
  const inward = stepTowardOrigin(home[0], home[1]);
  const cw = rotateCw(inward);
  const ccw = rotateCcw(inward);
  const center = add(home, inward);
  const gate = add(center, inward);
  const equid = add(center, cw);
  const homeLeft = add(home, cw);
  const homeRight = add(home, ccw);
  return {
    home: homePos,
    slots: [
      positionOf(...homeLeft),
      positionOf(...center),
      positionOf(...homeRight),
      positionOf(...equid),
      positionOf(...gate),
    ],
  };
}

/**
 * Layouts keyed by player count. Hyperlane entries: [boardIndex, tileId, rotation].
 * 5p uses FFG/PoK warp; 6p is the standard galaxy.
 */
export const MILTY_LAYOUTS = {
  3: {
    homeWorlds: [19, 25, 31],
    hyperlanes: [
      [2, '85A', 4], [4, '85A', 0], [6, '85A', 2],
      [8, '87A', 0], [10, '87A', 4], [12, '87A', 2],
      [14, '87A', 0], [16, '87A', 4], [18, '87A', 2],
      [21, '83A', 1], [22, '85A', 4], [23, '83A', 2],
      [27, '83A', 0], [28, '85A', 0], [29, '83A', 1],
      [33, '83A', 2], [34, '85A', 2], [35, '83A', 0],
    ],
  },
  4: {
    homeWorlds: [22, 25, 31, 34],
    hyperlanes: [
      [1, '86A', 3], [4, '86A', 0],
      [8, '88A', 1], [12, '88A', 0],
      [14, '87A', 0], [18, '87A', 5],
      [19, '85A', 3], [20, '84A', 0],
      [27, '83A', 0], [28, '85A', 0], [29, '84A', 0],
      [36, '83A', 0],
    ],
  },
  5: {
    homeWorlds: [19, 22, 25, 31, 34],
    hyperlanes: [
      [4, '86A', 0],
      [12, '88A', 0],
      [14, '87A', 0],
      [27, '83A', 0],
      [28, '85A', 0],
      [29, '84A', 0],
    ],
  },
  6: {
    homeWorlds: [19, 22, 25, 28, 31, 34],
    hyperlanes: [],
  },
};

export function layoutForPlayers(n) {
  const count = Math.max(3, Math.min(6, Number(n) || 6));
  return MILTY_LAYOUTS[count] || MILTY_LAYOUTS[6];
}

/**
 * Pixel offsets from Mecatol for flat-ish hex tiles (KeeganW/ti4 basis).
 * @returns {[number, number][]} [dx, dy] per board index
 */
export function calculateOffsets(width, height, maxRing = MAX_RING) {
  const topHeight = -height;
  const halfWidth = -width * 0.5;
  const halfHeight = -height * 0.5;
  const treQuarWidth = -width * 0.75;
  const toOffset = (q, r) => [
    Math.round(halfWidth - r * treQuarWidth),
    Math.round(halfHeight + q * topHeight + r * halfHeight),
  ];
  const offsets = [toOffset(0, 0)];
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (const [q, r] of ringCoordinates(ring)) {
      offsets.push(toOffset(q, r));
    }
  }
  return offsets;
}

export const BOARD_SIZE = axialByPosition.length;

/**
 * Normalize a seat rotation offset into `0 .. n-1`.
 * Positive = clockwise around the table (by seats).
 */
export function normalizeSeatOffset(offset, seatCount) {
  const n = Math.max(0, Number(seatCount) || 0);
  if (n <= 0) return 0;
  const raw = Number(offset) || 0;
  return ((raw % n) + n) % n;
}

/**
 * Build placed tiles for the draft map view.
 * @param {object} draft
 * @param {{ seatOffset?: number }} [opts] View-only rotation by table seats.
 * @returns {{
 *   cells: Array<{
 *     index: number,
 *     q: number,
 *     r: number,
 *     tileId: string|number|null,
 *     rotation: number,
 *     kind: 'mecatol'|'hyperlane'|'slice'|'home'|'empty',
 *     playerName?: string|null,
 *     seatIndex?: number|null,
 *   }>,
 *   homeWorlds: number[],
 *   seatOffset: number,
 * }}
 */
export function assembleDraftMap(draft, opts = {}) {
  const n = draft?.playerOrder?.length || 0;
  const seatOffset = normalizeSeatOffset(opts.seatOffset, n);
  const layout = layoutForPlayers(n);
  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const [q, r] = axialByPosition[index];
    return {
      index,
      q,
      r,
      tileId: null,
      rotation: 0,
      kind: 'empty',
      playerName: null,
      seatIndex: null,
    };
  });

  cells[0].tileId = 18;
  cells[0].kind = 'mecatol';

  for (const [idx, tileId, rotation] of layout.hyperlanes) {
    if (!cells[idx]) continue;
    cells[idx].tileId = tileId;
    cells[idx].rotation = rotation || 0;
    cells[idx].kind = 'hyperlane';
  }

  const byPosition = Array.from({ length: n }, () => null);
  for (const p of Object.values(draft?.players || {})) {
    if (p.position == null) continue;
    byPosition[p.position] = p;
  }

  layout.homeWorlds.forEach((homePos, seatIndex) => {
    if (seatIndex >= n) return;
    // Rotate players around fixed home slots (view-only).
    const sourceSeat = (seatIndex - seatOffset + n) % n;
    const player = byPosition[sourceSeat];
    const slots = sliceSlotsForHome(homePos);
    if (!slots) return;

    if (cells[homePos] && cells[homePos].kind !== 'hyperlane') {
      cells[homePos].kind = 'home';
      cells[homePos].seatIndex = sourceSeat;
      cells[homePos].playerName = player?.name || null;
      if (player?.faction != null) {
        const fac = (draft.factionPool || []).find((f) => f.id === player.faction);
        const hs = fac?.homesystem != null ? fac.homesystem : 0;
        cells[homePos].tileId = hs;
      } else {
        cells[homePos].tileId = 0;
      }
    }

    if (player?.slice == null) return;
    const slice = draft.slicePool?.[player.slice];
    if (!slice?.tileIds) return;
    slots.slots.forEach((boardIdx, sliceIdx) => {
      if (boardIdx == null || !cells[boardIdx]) return;
      if (cells[boardIdx].kind === 'hyperlane') return;
      const tid = slice.tileIds[sliceIdx];
      if (tid == null) return;
      cells[boardIdx].tileId = tid;
      cells[boardIdx].kind = 'slice';
      cells[boardIdx].seatIndex = sourceSeat;
      cells[boardIdx].playerName = player.name;
    });
  });

  return {
    cells,
    homeWorlds: layout.homeWorlds.slice(0, n),
    seatOffset,
  };
}
