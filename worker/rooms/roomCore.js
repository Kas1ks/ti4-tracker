import { createEmptyGameState, normalizeGameState } from '../../src/game/gameState.js';
import { reduceGame } from '../../src/game/gameEvents.js';
import { LOCAL_ONLY_ACTIONS } from '../../src/sync/constants.js';
import { authorizeAction, makeSessionToken, ROLES } from '../../src/sync/permissions.js';
import {
  popUndoSnapshot,
  pushUndoSnapshot,
  undoStackDepth,
} from '../../src/sync/undoStack';

export { LOCAL_ONLY_ACTIONS, ROLES };

/** Idle rooms expire after 48h without join/action. */
export const ROOM_IDLE_TTL_MS = 48 * 60 * 60 * 1000;
/** After host ends the party, keep the DO briefly then wipe. */
export const ROOM_ENDED_TTL_MS = 2 * 60 * 60 * 1000;

export function makeRoomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export function makeHostKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `host_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function makeSeatSecret() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let secret = '';
  for (let i = 0; i < 4; i += 1) {
    secret += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return secret;
}

/**
 * Refresh activity timestamps and push expiresAt forward.
 * @param {{ ended?: boolean, now?: number }} [opts]
 */
export function touchRoomActivity(room, opts = {}) {
  if (!room) return room;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const ttl = opts.ended ? ROOM_ENDED_TTL_MS : ROOM_IDLE_TTL_MS;
  const iso = new Date(now).toISOString();
  return {
    ...room,
    createdAt: room.createdAt || iso,
    lastActivityAt: iso,
    expiresAt: new Date(now + ttl).toISOString(),
    updatedAt: iso,
  };
}

/** Fill lifecycle fields for rooms created before TTL existed. */
export function hydrateRoomLifecycle(room, now = Date.now()) {
  if (!room) return null;
  if (room.createdAt && room.lastActivityAt && room.expiresAt) return room;
  const parsed = room.updatedAt ? Date.parse(room.updatedAt) : NaN;
  const base = Number.isFinite(parsed) ? parsed : now;
  const iso = new Date(base).toISOString();
  return {
    ...room,
    createdAt: room.createdAt || iso,
    lastActivityAt: room.lastActivityAt || iso,
    expiresAt: room.expiresAt || new Date(base + ROOM_IDLE_TTL_MS).toISOString(),
  };
}

export function isRoomExpired(room, now = Date.now()) {
  if (!room?.expiresAt) return false;
  const at = Date.parse(room.expiresAt);
  return Number.isFinite(at) && at <= now;
}

export function createRoomRecord(initialState = null) {
  const state = initialState
    ? normalizeGameState(initialState)
    : createEmptyGameState();

  const hostKey = makeHostKey();
  const sessionToken = makeSessionToken();

  return touchRoomActivity({
    roomId: makeRoomId(),
    hostKey,
    seq: 0,
    state,
    undoStack: [],
    sessions: {
      [sessionToken]: { role: ROLES.ADMIN, seatPlayerId: null },
    },
    /** seatPlayerId → sessionToken */
    seatClaims: {},
    /** seatPlayerId → short secret required to reclaim */
    seatSecrets: {},
  });
}

export function adminSessionFromRoom(room) {
  const entry = Object.entries(room.sessions || {}).find(([, s]) => s.role === ROLES.ADMIN);
  return entry ? entry[0] : null;
}

/**
 * Join as player or viewer.
 * Empty seat: free claim + new seatSecret.
 * Taken seat: only with matching seatSecret (device switch).
 */
export function joinRoom(room, { role, seatPlayerId, seatSecret } = {}) {
  if (role === ROLES.ADMIN) {
    return { ok: false, error: 'use-host-key' };
  }
  if (role !== ROLES.PLAYER && role !== ROLES.VIEWER) {
    return { ok: false, error: 'invalid-role' };
  }

  if (role === ROLES.PLAYER) {
    if (seatPlayerId == null || seatPlayerId === '') {
      return { ok: false, error: 'seat-required' };
    }
    const seat = room.state.players.find(p => String(p.id) === String(seatPlayerId));
    if (!seat) return { ok: false, error: 'unknown-seat' };

    const seatSecrets = { ...(room.seatSecrets || {}) };
    const previousToken = room.seatClaims?.[seat.id] ?? null;
    const existingSecret = seatSecrets[seat.id] ?? null;
    const reclaimed = previousToken != null;

    if (reclaimed) {
      const provided = String(seatSecret || '').trim().toUpperCase();
      if (!existingSecret) {
        return { ok: false, error: 'seat-secret-required' };
      }
      if (!provided) {
        return { ok: false, error: 'seat-secret-required' };
      }
      if (provided !== String(existingSecret).toUpperCase()) {
        return { ok: false, error: 'bad-seat-secret' };
      }
    }

    const sessionToken = makeSessionToken();
    const secret = existingSecret || makeSeatSecret();
    seatSecrets[seat.id] = secret;

    const sessions = { ...(room.sessions || {}) };
    if (previousToken && sessions[previousToken]) {
      delete sessions[previousToken];
    }
    sessions[sessionToken] = { role: ROLES.PLAYER, seatPlayerId: seat.id };

    const next = touchRoomActivity({
      ...room,
      sessions,
      seatClaims: { ...(room.seatClaims || {}), [seat.id]: sessionToken },
      seatSecrets,
    });
    return {
      ok: true,
      room: next,
      sessionToken,
      role: ROLES.PLAYER,
      seatPlayerId: seat.id,
      seatSecret: secret,
      reclaimed,
      revokedSessionToken: previousToken,
    };
  }

  const sessionToken = makeSessionToken();
  const next = touchRoomActivity({
    ...room,
    sessions: {
      ...room.sessions,
      [sessionToken]: { role: ROLES.VIEWER, seatPlayerId: null },
    },
  });
  return {
    ok: true,
    room: next,
    sessionToken,
    role: ROLES.VIEWER,
    seatPlayerId: null,
    reclaimed: false,
    seatSecret: null,
  };
}

/**
 * Host frees a seat so the next join does not need the old secret.
 */
export function releaseSeat(room, seatPlayerId, auth = {}) {
  let role = null;
  if (auth.sessionToken && room.sessions?.[auth.sessionToken]) {
    role = room.sessions[auth.sessionToken].role;
  } else if (auth.hostKey && auth.hostKey === room.hostKey) {
    role = ROLES.ADMIN;
  } else {
    return { ok: false, error: 'unauthorized' };
  }
  if (role !== ROLES.ADMIN) {
    return { ok: false, error: 'forbidden' };
  }

  const seat = room.state.players.find(p => String(p.id) === String(seatPlayerId));
  if (!seat) return { ok: false, error: 'unknown-seat' };

  const previousToken = room.seatClaims?.[seat.id] ?? null;
  const sessions = { ...(room.sessions || {}) };
  if (previousToken && sessions[previousToken]) {
    delete sessions[previousToken];
  }

  const seatClaims = { ...(room.seatClaims || {}) };
  delete seatClaims[seat.id];
  const seatSecrets = { ...(room.seatSecrets || {}) };
  delete seatSecrets[seat.id];

  const next = touchRoomActivity({
    ...room,
    sessions,
    seatClaims,
    seatSecrets,
  });
  return {
    ok: true,
    room: next,
    seatPlayerId: seat.id,
    revokedSessionToken: previousToken,
  };
}

/**
 * Apply one client action to a room after role checks.
 */
export function applyRoomAction(room, action, auth = {}) {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
    return { ok: false, error: 'invalid-action' };
  }
  if (LOCAL_ONLY_ACTIONS.has(action.type)) {
    return { ok: false, error: 'local-only-action' };
  }

  let role = null;
  let seatPlayerId = null;

  if (auth.sessionToken && room.sessions?.[auth.sessionToken]) {
    role = room.sessions[auth.sessionToken].role;
    seatPlayerId = room.sessions[auth.sessionToken].seatPlayerId;
  } else if (auth.hostKey && auth.hostKey === room.hostKey) {
    role = ROLES.ADMIN;
  } else {
    return { ok: false, error: 'unauthorized' };
  }

  const gate = authorizeAction({ role, seatPlayerId, action, state: room.state });
  if (!gate.ok) return gate;

  // Host global undo: restore previous snapshot (works for pass, strategy play, etc.).
  if (action.type === 'UNDO_LAST') {
    const { stack, state: prevState } = popUndoSnapshot(room.undoStack);
    if (!prevState) {
      return {
        ok: true,
        room: touchRoomActivity(room),
        action,
        noop: true,
        canUndo: false,
      };
    }
    const nextRoom = touchRoomActivity({
      ...room,
      seq: room.seq + 1,
      state: prevState,
      undoStack: stack,
    });
    return {
      ok: true,
      room: nextRoom,
      action,
      noop: false,
      canUndo: undoStackDepth(stack) > 0,
    };
  }

  const CLOCK_ACTIONS = new Set([
    'START_ROUND',
    'NEXT_TURN',
    'PASS_TURN',
    'ELIMINATE_PLAYER',
    'END_ROUND',
    'CONFIRM_STATUS_PHASE',
    'FINISH_AGENDA_PHASE',
  ]);
  const stamped = CLOCK_ACTIONS.has(action.type)
    ? { ...action, at: Date.now() }
    : action;

  const nextState = reduceGame(room.state, stamped);
  if (nextState === room.state) {
    return {
      ok: true,
      room: touchRoomActivity(room),
      action: stamped,
      noop: true,
      canUndo: undoStackDepth(room.undoStack) > 0,
    };
  }

  const undoStack = stamped.type === 'RESET_GAME'
    ? []
    : pushUndoSnapshot(room.undoStack, room.state);

  let nextRoom = touchRoomActivity({
    ...room,
    seq: room.seq + 1,
    state: nextState,
    undoStack,
  });

  // Ending the party: wipe seats so every guest must return to the hub.
  if (stamped.type === 'RESET_GAME') {
    const sessions = {};
    for (const [token, session] of Object.entries(room.sessions || {})) {
      if (session?.role === ROLES.ADMIN) sessions[token] = session;
    }
    nextRoom = touchRoomActivity({
      ...nextRoom,
      sessions,
      seatClaims: {},
      seatSecrets: {},
      undoStack: [],
    }, { ended: true });
    return {
      ok: true,
      room: nextRoom,
      action: stamped,
      noop: false,
      roomEnded: true,
      canUndo: false,
    };
  }

  // Host deleted a seat: drop that player's session/claim so they leave the lobby.
  if (stamped.type === 'REMOVE_PLAYER') {
    let claimKey = null;
    let claimToken = null;
    for (const [key, token] of Object.entries(room.seatClaims || {})) {
      if (String(key) === String(stamped.playerId)) {
        claimKey = key;
        claimToken = token;
        break;
      }
    }

    const sessions = { ...(nextRoom.sessions || {}) };
    if (claimToken && sessions[claimToken]) {
      delete sessions[claimToken];
    }
    const seatClaims = { ...(nextRoom.seatClaims || {}) };
    const seatSecrets = { ...(nextRoom.seatSecrets || {}) };
    if (claimKey != null) {
      delete seatClaims[claimKey];
      delete seatSecrets[claimKey];
    }

    nextRoom = touchRoomActivity({
      ...nextRoom,
      sessions,
      seatClaims,
      seatSecrets,
    });

    return {
      ok: true,
      room: nextRoom,
      action: stamped,
      noop: false,
      seatRemoved: true,
      seatPlayerId: stamped.playerId,
      revokedSessionToken: claimToken,
      canUndo: undoStackDepth(undoStack) > 0,
    };
  }

  return {
    ok: true,
    room: nextRoom,
    action: stamped,
    noop: false,
    roomEnded: false,
    canUndo: undoStackDepth(undoStack) > 0,
  };
}

export function publicRoomView(room) {
  const claimedSeats = Object.keys(room.seatClaims || {}).map((id) => {
    const asNum = Number(id);
    return Number.isNaN(asNum) ? id : asNum;
  });

  return {
    roomId: room.roomId,
    seq: room.seq,
    state: room.state,
    updatedAt: room.updatedAt,
    createdAt: room.createdAt || null,
    lastActivityAt: room.lastActivityAt || null,
    expiresAt: room.expiresAt || null,
    claimedSeats,
    canUndo: undoStackDepth(room.undoStack) > 0,
  };
}
