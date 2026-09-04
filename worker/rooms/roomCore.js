import { createEmptyGameState, normalizeGameState } from '../../src/game/gameState.js';
import { gameReducer } from '../../src/game/gameReducer.js';
import { LOCAL_ONLY_ACTIONS } from '../../src/sync/constants.js';
import { authorizeAction, makeSessionToken, ROLES } from '../../src/sync/permissions.js';

export { LOCAL_ONLY_ACTIONS, ROLES };

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

export function createRoomRecord(initialState = null) {
  const state = initialState
    ? normalizeGameState(initialState)
    : createEmptyGameState();

  const hostKey = makeHostKey();
  const sessionToken = makeSessionToken();

  return {
    roomId: makeRoomId(),
    hostKey,
    seq: 0,
    state,
    updatedAt: new Date().toISOString(),
    sessions: {
      [sessionToken]: { role: ROLES.ADMIN, seatPlayerId: null },
    },
    /** seatPlayerId → sessionToken */
    seatClaims: {},
    /** seatPlayerId → short secret required to reclaim */
    seatSecrets: {},
  };
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

    const next = {
      ...room,
      sessions,
      seatClaims: { ...(room.seatClaims || {}), [seat.id]: sessionToken },
      seatSecrets,
      updatedAt: new Date().toISOString(),
    };
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
  const next = {
    ...room,
    sessions: {
      ...room.sessions,
      [sessionToken]: { role: ROLES.VIEWER, seatPlayerId: null },
    },
    updatedAt: new Date().toISOString(),
  };
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

  const next = {
    ...room,
    sessions,
    seatClaims,
    seatSecrets,
    updatedAt: new Date().toISOString(),
  };
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

  const nextState = gameReducer(room.state, stamped);
  if (nextState === room.state) {
    return {
      ok: true,
      room: { ...room, updatedAt: new Date().toISOString() },
      action: stamped,
      noop: true,
    };
  }

  return {
    ok: true,
    room: {
      ...room,
      seq: room.seq + 1,
      state: nextState,
      updatedAt: new Date().toISOString(),
    },
    action: stamped,
    noop: false,
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
    claimedSeats,
  };
}
