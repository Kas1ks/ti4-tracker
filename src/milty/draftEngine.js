import { generateFactionPool } from './generateFactionPool.js';
import { generateSlicePool } from './generateSlicePool.js';
import { createRng, randomSeed, shuffleInPlace } from './rng.js';
import { defaultMiltySettings } from './settings.js';

export const PICK = {
  FACTION: 'faction',
  SLICE: 'slice',
  POSITION: 'position',
};

function randomSecret(length = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const buf = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i += 1) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function makePlayerId() {
  return `p_${randomSecret(8).toLowerCase()}`;
}

export function snakeOrder(playerIds) {
  return [...playerIds, ...[...playerIds].reverse()];
}

export function updateCurrentPlayer(draft) {
  const ids = draft.playerOrder;
  const totalPicks = ids.length * 3;
  if (draft.log.length >= totalPicks) {
    draft.done = true;
    draft.currentPlayerId = null;
    return;
  }
  draft.done = false;
  const snake = snakeOrder(ids);
  draft.currentPlayerId = snake[draft.log.length % snake.length];
}

function serializeSlice(s) {
  return {
    tileIds: s.tileIds,
    totalInfluence: s.totalInfluence,
    totalResources: s.totalResources,
    optimalInfluence: s.optimalInfluence,
    optimalResources: s.optimalResources,
    optimalTotal: s.optimalTotal,
    wormholes: s.wormholes,
    legendaryPlanets: s.legendaryPlanets,
    hasLegendaries: s.hasLegendaries,
  };
}

/**
 * Create a new draft document (server-side generation).
 * @param {object} rawSettings
 */
export function createDraftDocument(rawSettings = {}) {
  const settings = defaultMiltySettings(rawSettings);
  if (!settings.seed) settings.seed = randomSeed();

  const { slices, seed } = generateSlicePool(settings);
  settings.seed = seed;
  const factions = generateFactionPool(settings);

  const names = [...settings.playerNames];
  if (!settings.presetDraftOrder) {
    shuffleInPlace(names, createRng(settings.seed + 2));
  }

  const presetIds = Array.isArray(rawSettings.presetPlayerIds)
    ? rawSettings.presetPlayerIds.map((id) => String(id))
    : null;

  const playerOrder = [];
  const players = {};
  for (let i = 0; i < names.length; i += 1) {
    const id = presetIds?.[i] != null ? String(presetIds[i]) : makePlayerId();
    playerOrder.push(id);
    players[id] = {
      id,
      name: String(names[i] || 'Player').slice(0, 40),
      claimed: false,
      secret: null,
      faction: null,
      slice: null,
      position: null,
    };
  }

  const draft = {
    id: null,
    done: false,
    settings: { ...settings, customSlices: settings.customSlices || [] },
    players,
    playerOrder,
    slicePool: slices.map(serializeSlice),
    factionPool: factions.map((f) => ({
      id: f.id,
      name: f.name,
      displayName: f.displayName,
      set: f.set,
      trackerId: f.trackerId,
      iconUrl: f.iconUrl,
      homesystem: f.homesystem,
    })),
    log: [],
    currentPlayerId: null,
    adminSecret: randomSecret(12),
    seq: 0,
    createdAt: Date.now(),
  };
  updateCurrentPlayer(draft);
  return draft;
}

export function publicDraftView(draft, { playerId = null, playerSecret = null, adminSecret = null } = {}) {
  const isAdmin = !!adminSecret && adminSecret === draft.adminSecret;
  const me = playerId ? draft.players[playerId] : null;
  const secretOk = me && playerSecret && me.secret === playerSecret;

  return {
    id: draft.id,
    done: draft.done,
    seq: draft.seq,
    settings: {
      gameName: draft.settings.gameName,
      seed: draft.settings.seed,
      numberOfSlices: draft.settings.numberOfSlices,
      numberOfFactions: draft.settings.numberOfFactions,
      tileSets: draft.settings.tileSets,
      factionSets: draft.settings.factionSets,
      playerNames: draft.settings.playerNames,
    },
    playerOrder: draft.playerOrder,
    players: Object.fromEntries(
      Object.values(draft.players).map((p) => [p.id, {
        id: p.id,
        name: p.name,
        claimed: p.claimed,
        faction: p.faction,
        slice: p.slice,
        position: p.position,
      }]),
    ),
    slicePool: draft.slicePool,
    factionPool: draft.factionPool,
    log: draft.log,
    currentPlayerId: draft.currentPlayerId,
    taken: {
      factions: Object.values(draft.players).map((p) => p.faction).filter((v) => v != null),
      slices: Object.values(draft.players).map((p) => p.slice).filter((v) => v != null),
      positions: Object.values(draft.players).map((p) => p.position).filter((v) => v != null),
    },
    you: secretOk || isAdmin ? {
      playerId: isAdmin ? playerId : me?.id,
      isAdmin,
      canPick: !draft.done && (
        isAdmin
        || (secretOk && draft.currentPlayerId === me.id)
      ),
    } : null,
    adminSecret: isAdmin ? draft.adminSecret : undefined,
  };
}

export function claimPlayer(draft, { playerId, name, adminSecret, force = false } = {}) {
  const player = draft.players[playerId] || draft.players[String(playerId)];
  if (!player) return { ok: false, error: 'player-not-found' };
  if (player.claimed) {
    // Room rebind: host admin may reissue secret if seatSecrets were lost.
    if (force && adminSecret && adminSecret === draft.adminSecret) {
      player.secret = randomSecret(10);
      draft.seq += 1;
      return { ok: true, playerId: player.id, secret: player.secret, draft, reissued: true };
    }
    return { ok: false, error: 'already-claimed' };
  }
  player.claimed = true;
  player.secret = randomSecret(10);
  if (name && String(name).trim()) {
    player.name = String(name).trim().slice(0, 40);
  }
  draft.seq += 1;
  return { ok: true, playerId: player.id, secret: player.secret, draft };
}

/** Free a claimed draft seat (self via secret, or host via adminSecret). */
export function unclaimPlayer(draft, { playerId, secret, adminSecret } = {}) {
  const player = draft.players[playerId] || draft.players[String(playerId)];
  if (!player) return { ok: false, error: 'player-not-found' };
  if (!player.claimed) return { ok: false, error: 'not-claimed' };

  const isAdmin = !!adminSecret && adminSecret === draft.adminSecret;
  const isSelf = !!secret && player.secret === secret;
  if (!isAdmin && !isSelf) return { ok: false, error: 'forbidden' };

  if (player.faction != null || player.slice != null || player.position != null) {
    return { ok: false, error: 'has-picks' };
  }

  player.claimed = false;
  player.secret = null;
  draft.seq += 1;
  return { ok: true, playerId: player.id, draft };
}

function assertAuth(draft, { playerId, secret, adminSecret }) {
  if (adminSecret && adminSecret === draft.adminSecret) {
    return { ok: true, isAdmin: true };
  }
  const player = draft.players[playerId];
  if (!player || !secret || player.secret !== secret) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true, isAdmin: false, player };
}

export function applyPick(draft, {
  playerId,
  category,
  value,
  secret,
  adminSecret,
  logIndex,
} = {}) {
  if (draft.done) return { ok: false, error: 'draft-done' };
  if (logIndex != null && Number(logIndex) !== draft.log.length) {
    return { ok: false, error: 'stale', expected: draft.log.length };
  }

  const auth = assertAuth(draft, { playerId, secret, adminSecret });
  if (!auth.ok) return auth;

  const actingId = auth.isAdmin ? (playerId || draft.currentPlayerId) : playerId;
  if (actingId !== draft.currentPlayerId) {
    return { ok: false, error: 'not-your-turn' };
  }

  const player = draft.players[actingId];
  if (!player) return { ok: false, error: 'player-not-found' };

  if (![PICK.FACTION, PICK.SLICE, PICK.POSITION].includes(category)) {
    return { ok: false, error: 'bad-category' };
  }
  if (player[category] != null) {
    return { ok: false, error: 'already-have-category' };
  }

  for (const p of Object.values(draft.players)) {
    if (p[category] === value) {
      return { ok: false, error: 'option-taken' };
    }
  }

  if (category === PICK.FACTION) {
    if (!draft.factionPool.some((f) => f.id === value)) {
      return { ok: false, error: 'unknown-faction' };
    }
  } else if (category === PICK.SLICE) {
    const idx = Number(value);
    if (!Number.isInteger(idx) || idx < 0 || idx >= draft.slicePool.length) {
      return { ok: false, error: 'unknown-slice' };
    }
  } else if (category === PICK.POSITION) {
    const idx = Number(value);
    if (!Number.isInteger(idx) || idx < 0 || idx >= draft.playerOrder.length) {
      return { ok: false, error: 'unknown-position' };
    }
  }

  const storedValue = category === PICK.FACTION ? value : Number(value);
  player[category] = storedValue;
  draft.log.push({
    playerId: actingId,
    category,
    value: storedValue,
  });
  updateCurrentPlayer(draft);
  draft.seq += 1;
  return { ok: true, draft };
}

export function undoLastPick(draft, { adminSecret } = {}) {
  if (!adminSecret || adminSecret !== draft.adminSecret) {
    return { ok: false, error: 'forbidden' };
  }
  const last = draft.log.pop();
  if (!last) return { ok: false, error: 'nothing-to-undo' };
  const player = draft.players[last.playerId];
  if (player) player[last.category] = null;
  updateCurrentPlayer(draft);
  draft.seq += 1;
  return { ok: true, draft };
}

function assertAdmin(draft, adminSecret) {
  if (!adminSecret || adminSecret !== draft.adminSecret) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true };
}

function serializeFaction(f) {
  return {
    id: f.id,
    name: f.name,
    displayName: f.displayName,
    set: f.set,
    trackerId: f.trackerId,
    iconUrl: f.iconUrl,
    homesystem: f.homesystem,
  };
}

function assertCanRegen(draft) {
  if (draft.done) return { ok: false, error: 'draft-done' };
  if ((draft.log?.length || 0) > 0) return { ok: false, error: 'draft-started' };
  return { ok: true };
}

function mutateRegenSlices(draft) {
  if (draft.settings.customSlices?.length) return;
  const seed = randomSeed();
  draft.settings.seed = seed;
  const { slices, seed: used } = generateSlicePool({ ...draft.settings, seed });
  draft.settings.seed = used;
  draft.slicePool = slices.map(serializeSlice);
}

function mutateRegenFactions(draft) {
  const previousIds = (draft.factionPool || []).map((f) => f.id);
  const factionSeed = randomSeed();
  const factions = generateFactionPool(
    { ...draft.settings, seed: factionSeed },
    { excludeIds: previousIds },
  );
  draft.factionPool = factions.map(serializeFaction);
}

function mutateRegenOrder(draft) {
  shuffleInPlace(draft.playerOrder, createRng(randomSeed()));
  updateCurrentPlayer(draft);
}

function normalizeRegenParts(parts) {
  const raw = Array.isArray(parts) ? parts : (parts != null ? [parts] : []);
  const allowed = new Set(['slices', 'factions', 'order']);
  const out = [];
  for (const part of raw) {
    const key = String(part || '');
    if (!allowed.has(key)) continue;
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** Host: regenerate slice pool. Only before the first pick. */
export function regenerateSlices(draft, { adminSecret } = {}) {
  return regenerateDraftParts(draft, ['slices'], { adminSecret });
}

/** Host: regenerate faction pool (prefers new races). Only before the first pick. */
export function regenerateFactions(draft, { adminSecret } = {}) {
  return regenerateDraftParts(draft, ['factions'], { adminSecret });
}

/** Host: reshuffle draft (snake) player order. Only before the first pick. */
export function regeneratePlayerOrder(draft, { adminSecret } = {}) {
  return regenerateDraftParts(draft, ['order'], { adminSecret });
}

/**
 * Host: regenerate one or more parts in a single confirm.
 * @param {'slices'|'factions'|'order'|Array<'slices'|'factions'|'order'>} parts
 */
export function regenerateDraftParts(draft, parts, { adminSecret } = {}) {
  const auth = assertAdmin(draft, adminSecret);
  if (!auth.ok) return auth;
  const gate = assertCanRegen(draft);
  if (!gate.ok) return gate;
  const list = normalizeRegenParts(parts);
  if (!list.length) return { ok: false, error: 'bad-part' };
  try {
    if (list.includes('slices')) mutateRegenSlices(draft);
    if (list.includes('factions')) mutateRegenFactions(draft);
    if (list.includes('order')) mutateRegenOrder(draft);
  } catch (err) {
    return { ok: false, error: String(err?.message || err || 'regen-failed') };
  }
  draft.seq += 1;
  return { ok: true, draft, parts: list };
}

/**
 * @param {'slices'|'factions'|'order'} part
 */
export function regenerateDraftPart(draft, part, { adminSecret } = {}) {
  return regenerateDraftParts(draft, part, { adminSecret });
}

/** Assemble final seating: position → player with faction + slice. */
export function assembleResult(draft) {
  const byPosition = Array.from({ length: draft.playerOrder.length }, () => null);
  for (const p of Object.values(draft.players)) {
    if (p.position == null) continue;
    byPosition[p.position] = {
      playerId: p.id,
      name: p.name,
      faction: draft.factionPool.find((f) => f.id === p.faction) || null,
      slice: p.slice != null ? draft.slicePool[p.slice] : null,
      position: p.position,
    };
  }
  return byPosition;
}
