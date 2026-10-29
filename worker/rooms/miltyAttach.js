import { createEmptyGameState, normalizeGameState } from '../../src/game/gameState.js';
import {
  assembleResult,
  claimPlayer,
  createDraftDocument,
  publicDraftView,
} from '../../src/milty/draftEngine.js';
import { resolveFaction } from '../../src/milty/factions.js';
import { createRng, randomSeed, shuffleInPlace } from '../../src/milty/rng.js';
import { defaultMiltySettings } from '../../src/milty/settings.js';
import { randomRoomId } from '../cryptoCodes.js';
import {
  memoryMiltyClaim,
  memoryMiltyCreate,
  memoryMiltyGet,
  memoryMiltyPick,
  memoryMiltyRegen,
  memoryMiltyUnclaim,
  memoryMiltyUndo,
} from '../milty/memoryMilty.js';
import { sendWebPush } from '../push/sendPush.js';
import { pushSubsOf } from './pushNotify.js';
import { touchRoomActivity } from './roomCore.js';

function hasMiltyDo(env) {
  return Boolean(env?.MILTY_DRAFTS);
}

function miltyStub(env, id) {
  return env.MILTY_DRAFTS.get(env.MILTY_DRAFTS.idFromName(String(id).toUpperCase()));
}

async function miltyDoFetch(env, id, path, init) {
  const obj = miltyStub(env, id);
  const url = new URL(`https://milty.internal/${String(id).toUpperCase()}${path}`);
  return obj.fetch(new Request(url, init));
}

/**
 * Build setup lobby players (no colors/factions yet) aligned with milty seats 1..N.
 * @param {string[]} names
 */
export function buildMiltyLobbyState(names, expansions = {}) {
  const base = createEmptyGameState();
  const players = names.map((name, i) => ({
    id: i + 1,
    name: String(name || `Игрок ${i + 1}`).slice(0, 40),
    factionId: null,
    color: '',
    secrets: 0,
    extra: 0,
    totalTime: 0,
    damageDealt: 0,
    eliminated: false,
    eliminatedRound: null,
    breakthrough: false,
    techIds: [],
    startingTechIds: [],
  }));
  return normalizeGameState({
    ...base,
    players,
    meta: {
      ...base.meta,
      usePok: expansions.usePok !== false,
      useTe: !!expansions.useTe,
      speakerId: null,
    },
  });
}

/**
 * Attach milty draft metadata to a room record (server-only secrets stay here).
 */
export function attachMiltyToRoom(room, { draftId, adminSecret }) {
  return {
    ...room,
    hubListed: false,
    milty: {
      draftId: String(draftId).toUpperCase(),
      status: 'drafting',
      adminSecret: String(adminSecret || ''),
      seatSecrets: {},
    },
  };
}

export function publicMiltyView(room) {
  if (!room?.milty?.draftId) return null;
  return {
    draftId: room.milty.draftId,
    status: room.milty.status || 'drafting',
    hubListed: room.hubListed !== false && room.milty.status !== 'drafting',
  };
}

export function isMiltyDrafting(room) {
  return room?.milty?.status === 'drafting' && !!room.milty?.draftId;
}

/**
 * After draft is done: fill factions + speaker order; unlock hub listing.
 * Keeps seat player ids stable (milty player ids === seat ids as strings).
 */
export function applyMiltyResultToRoom(room, draft) {
  if (!draft?.done) {
    return { ok: false, error: 'draft-not-done' };
  }
  const seats = assembleResult(draft).filter(Boolean);
  if (!seats.length) {
    return { ok: false, error: 'empty-result' };
  }

  const players = seats.map((seat, idx) => {
    const resolved = seat.faction ? resolveFaction(seat.faction) : null;
    const factionId = resolved?.trackerId || resolved?.id || null;
    const seatId = Number(seat.playerId);
    const id = Number.isFinite(seatId) ? seatId : idx + 1;
    const prev = (room.state?.players || []).find((p) => String(p.id) === String(id));
    return {
      id,
      name: seat.name || prev?.name || `Игрок ${idx + 1}`,
      factionId,
      color: prev?.color || '',
      secrets: 0,
      extra: 0,
      totalTime: 0,
      damageDealt: 0,
      eliminated: false,
      eliminatedRound: null,
      breakthrough: factionId === 'crimson',
      techIds: [],
      startingTechIds: [],
    };
  });

  const speakerId = players[0]?.id ?? null;
  const nextState = normalizeGameState({
    ...room.state,
    players,
    isGameActive: false,
    meta: {
      ...(room.state?.meta || {}),
      speakerId,
      usePok: draft.settings?.factionSets?.includes?.('pok')
        || draft.settings?.tileSets?.includes?.('PoK')
        || room.state?.meta?.usePok,
      useTe: draft.settings?.factionSets?.includes?.('te')
        || draft.settings?.tileSets?.includes?.('TE')
        || room.state?.meta?.useTe,
    },
  });

  const next = touchRoomActivity({
    ...room,
    state: nextState,
    hubListed: true,
    milty: {
      ...room.milty,
      status: 'done',
      adminSecret: room.milty?.adminSecret,
      seatSecrets: room.milty?.seatSecrets || {},
      resultSlices: seats.map((s) => ({
        playerId: s.playerId,
        slice: s.slice || null,
        position: s.position,
      })),
    },
    seq: (room.seq || 0) + 1,
  });

  return { ok: true, room: next };
}

/**
 * Notify the new current milty player via room pushSubs.
 */
export async function notifyMiltyTurn(env, room, prevCurrentId, nextCurrentId, { done } = {}) {
  if (!room?.roomId) return room;
  if (!done && (prevCurrentId == null || String(prevCurrentId) === String(nextCurrentId))) {
    return room;
  }

  const subs = Object.entries(pushSubsOf(room));
  if (!subs.length) return room;

  let pushSubs = { ...pushSubsOf(room) };
  const roomId = room.roomId;

  if (done) {
    for (const [token, meta] of subs) {
      const result = await sendWebPush(env, meta.subscription, {
        title: 'Milty: драфт завершён',
        body: 'Хост может перейти к созданию партии.',
        reason: 'milty-done',
        roomId,
        url: `/?room=${encodeURIComponent(roomId)}`,
      });
      if (result.gone) delete pushSubs[token];
    }
    return { ...room, pushSubs };
  }

  const targets = subs.filter(([, meta]) => (
    meta.seatPlayerId != null && String(meta.seatPlayerId) === String(nextCurrentId)
  ));
  for (const [token, meta] of targets) {
    const result = await sendWebPush(env, meta.subscription, {
      title: 'Ваш ход в Milty',
      body: 'Выберите фракцию, слайс или место.',
      reason: 'milty-turn',
      roomId,
      url: `/?room=${encodeURIComponent(roomId)}`,
    });
    if (result.gone) delete pushSubs[token];
  }
  return { ...room, pushSubs };
}

/** Settings for a room-linked milty draft (stable seat ids 1..N). */
export function linkedMiltySettings(rawSettings = {}) {
  const settings = defaultMiltySettings(rawSettings);
  const names = (settings.playerNames || []).map((n, i) => String(n || `Игрок ${i + 1}`).slice(0, 40));
  // Room seats need fixed ids 1..N, but draft order may still be random:
  // shuffle names first (unless client asked to keep list order), then lock.
  if (!settings.presetDraftOrder) {
    const seed = settings.seed || randomSeed();
    settings.seed = seed;
    shuffleInPlace(names, createRng(Number(seed) + 2));
  }
  return {
    names,
    settings: {
      ...settings,
      playerNames: names,
      presetDraftOrder: true,
      presetPlayerIds: names.map((_, i) => i + 1),
    },
    usePok: (settings.factionSets || []).includes('pok') || (settings.tileSets || []).includes('PoK'),
    useTe: (settings.factionSets || []).includes('te') || (settings.tileSets || []).includes('TE'),
  };
}

/**
 * Create milty draft in DO or memory. Returns { ok, id, adminSecret, draft }.
 */
export async function createMiltyInEnv(env, rawSettings = {}) {
  const { settings } = linkedMiltySettings(rawSettings);
  if (hasMiltyDo(env)) {
    const id = randomRoomId();
    const res = await miltyDoFetch(env, id, '/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, settings }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}` };
    return {
      ok: true,
      id: data.id || id,
      adminSecret: data.adminSecret,
      draft: data.draft,
    };
  }
  return memoryMiltyCreate(settings);
}

export async function getMiltyInEnv(env, draftId, auth = {}) {
  if (hasMiltyDo(env)) {
    const qs = new URLSearchParams();
    if (auth.playerId) qs.set('playerId', auth.playerId);
    if (auth.secret) qs.set('secret', auth.secret);
    if (auth.adminSecret) qs.set('admin', auth.adminSecret);
    const q = qs.toString();
    const res = await miltyDoFetch(env, draftId, `/snapshot${q ? `?${q}` : ''}`, { method: 'GET' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || 'not-found' };
    return { ok: true, draft: data.draft };
  }
  return memoryMiltyGet(draftId, {
    playerId: auth.playerId,
    playerSecret: auth.secret,
    adminSecret: auth.adminSecret,
  });
}

export async function claimMiltyInEnv(env, draftId, playerId, { force = false, adminSecret } = {}) {
  const body = {
    playerId: String(playerId),
    force: !!force,
    adminSecret: adminSecret || undefined,
  };
  if (hasMiltyDo(env)) {
    const res = await miltyDoFetch(env, draftId, '/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}` };
    return data;
  }
  return memoryMiltyClaim(draftId, body);
}

export async function unclaimMiltyInEnv(env, draftId, playerId, { secret, adminSecret } = {}) {
  const body = {
    playerId: String(playerId),
    secret: secret || undefined,
    adminSecret: adminSecret || undefined,
  };
  if (hasMiltyDo(env)) {
    const res = await miltyDoFetch(env, draftId, '/unclaim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}` };
    return data;
  }
  return memoryMiltyUnclaim(draftId, body);
}

export async function pickMiltyInEnv(env, draftId, body) {
  if (hasMiltyDo(env)) {
    const res = await miltyDoFetch(env, draftId, '/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}`, ...data };
    return data;
  }
  return memoryMiltyPick(draftId, body);
}

export async function undoMiltyInEnv(env, draftId, body) {
  if (hasMiltyDo(env)) {
    const res = await miltyDoFetch(env, draftId, '/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}`, ...data };
    return data;
  }
  return memoryMiltyUndo(draftId, body);
}

export async function regenMiltyInEnv(env, draftId, body) {
  if (hasMiltyDo(env)) {
    const res = await miltyDoFetch(env, draftId, '/regen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `http-${res.status}`, ...data };
    return data;
  }
  return memoryMiltyRegen(draftId, body);
}

/**
 * Ensure milty seat is claimed for this room seat; persist secret on room.milty.seatSecrets.
 * @returns {{ room: object, miltySecret: string|null, error?: string }}
 */
export async function bindMiltySeat(env, room, seatPlayerId) {
  if (!isMiltyDrafting(room) || seatPlayerId == null) {
    return { room, miltySecret: null };
  }
  const key = String(seatPlayerId);
  const existing = room.milty?.seatSecrets?.[key];
  if (existing) {
    return { room, miltySecret: existing };
  }

  let claimed = await claimMiltyInEnv(env, room.milty.draftId, key);
  if (!claimed?.ok && claimed?.error === 'already-claimed' && room.milty?.adminSecret) {
    claimed = await claimMiltyInEnv(env, room.milty.draftId, key, {
      force: true,
      adminSecret: room.milty.adminSecret,
    });
  }
  if (!claimed?.ok) {
    return { room, miltySecret: null, error: claimed?.error || 'milty-claim-failed' };
  }

  const next = {
    ...room,
    milty: {
      ...room.milty,
      seatSecrets: {
        ...(room.milty.seatSecrets || {}),
        [key]: claimed.secret,
      },
    },
  };
  return { room: next, miltySecret: claimed.secret };
}

/** Clear milty claim + stored seat secret when a room seat is freed. */
export async function unbindMiltySeat(env, room, seatPlayerId) {
  if (!isMiltyDrafting(room) || seatPlayerId == null) {
    return { room };
  }
  const key = String(seatPlayerId);
  const secret = room.milty?.seatSecrets?.[key] || null;
  if (room.milty?.draftId && (secret || room.milty?.adminSecret)) {
    await unclaimMiltyInEnv(env, room.milty.draftId, key, {
      secret,
      adminSecret: room.milty.adminSecret,
    });
  }
  const seatSecrets = { ...(room.milty.seatSecrets || {}) };
  delete seatSecrets[key];
  return {
    room: {
      ...room,
      milty: {
        ...room.milty,
        seatSecrets,
      },
    },
  };
}

export function draftPublic(draft, auth = {}) {
  return publicDraftView(draft, auth);
}

// Re-export claimPlayer for tests
export { claimPlayer, createDraftDocument };
