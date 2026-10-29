import {
  applyPick,
  claimPlayer,
  createDraftDocument,
  publicDraftView,
  regenerateDraftPart,
  unclaimPlayer,
  undoLastPick,
} from '../../src/milty/draftEngine.js';
import { randomRoomId } from '../cryptoCodes.js';

const drafts = new Map();
const listeners = new Map();

function notify(id, payload) {
  const set = listeners.get(id);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch (err) {
      console.error('[memoryMilty] listener', err);
    }
  }
}

function get(id) {
  return drafts.get(String(id || '').toUpperCase()) || null;
}

function put(draft) {
  drafts.set(String(draft.id).toUpperCase(), draft);
}

export function memoryMiltyCreate(settings) {
  const draft = createDraftDocument(settings || {});
  draft.id = randomRoomId();
  put(draft);
  return {
    ok: true,
    id: draft.id,
    adminSecret: draft.adminSecret,
    draft: publicDraftView(draft, { adminSecret: draft.adminSecret }),
  };
}

export function memoryMiltyGet(id, auth = {}) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  return { ok: true, draft: publicDraftView(draft, auth) };
}

export function memoryMiltyClaim(id, body) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  const result = claimPlayer(draft, body);
  if (!result.ok) return result;
  put(draft);
  const view = publicDraftView(draft, {
    playerId: result.playerId,
    playerSecret: result.secret,
  });
  notify(draft.id, { type: 'state', draft: publicDraftView(draft) });
  return { ok: true, playerId: result.playerId, secret: result.secret, draft: view };
}

export function memoryMiltyUnclaim(id, body) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  const result = unclaimPlayer(draft, body || {});
  if (!result.ok) return result;
  put(draft);
  notify(draft.id, { type: 'state', draft: publicDraftView(draft) });
  return {
    ok: true,
    playerId: result.playerId,
    draft: publicDraftView(draft, {
      playerId: body?.playerId,
      playerSecret: body?.secret,
      adminSecret: body?.adminSecret,
    }),
  };
}

export function memoryMiltyPick(id, body) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  const result = applyPick(draft, body);
  if (!result.ok) return result;
  put(draft);
  notify(draft.id, { type: 'state', draft: publicDraftView(draft) });
  return {
    ok: true,
    draft: publicDraftView(draft, {
      playerId: body.playerId,
      playerSecret: body.secret,
      adminSecret: body.adminSecret,
    }),
  };
}

export function memoryMiltyUndo(id, body) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  const result = undoLastPick(draft, body);
  if (!result.ok) return result;
  put(draft);
  notify(draft.id, { type: 'state', draft: publicDraftView(draft) });
  return {
    ok: true,
    draft: publicDraftView(draft, { adminSecret: body.adminSecret }),
  };
}

export function memoryMiltyRegen(id, body) {
  const draft = get(id);
  if (!draft) return { ok: false, error: 'not-found' };
  const result = regenerateDraftPart(draft, body?.part, { adminSecret: body?.adminSecret });
  if (!result.ok) return result;
  put(draft);
  notify(draft.id, { type: 'state', draft: publicDraftView(draft) });
  return {
    ok: true,
    draft: publicDraftView(draft, { adminSecret: body.adminSecret }),
  };
}

export function memoryMiltySubscribe(id, cb) {
  const key = String(id || '').toUpperCase();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(cb);
  return () => {
    listeners.get(key)?.delete(cb);
  };
}
