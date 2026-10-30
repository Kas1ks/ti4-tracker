import { LOCAL_ONLY_ACTIONS } from './constants.js';

async function readError(res) {
  try {
    const data = await res.json();
    return data?.error || `http-${res.status}`;
  } catch {
    return `http-${res.status}`;
  }
}

export async function claimHostSession(roomId, { hostKey }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/claim-host`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostKey }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createRoom(state, { createSecret, milty } = {}) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: milty ? null : (state ?? null),
      createSecret: createSecret ?? '',
      milty: milty || undefined,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function promoteMiltyRoom(roomId, { hostKey }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/milty/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostKey }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function pickMiltyInRoom(roomId, body) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/milty/pick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function undoMiltyInRoom(roomId, { hostKey }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/milty/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostKey }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function regenMiltyInRoom(roomId, { hostKey, part, parts }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/milty/regen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostKey,
      parts: parts ?? (part != null ? [part] : undefined),
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** All live rooms on the server (hub «Активные партии»). */
export async function fetchActiveRooms() {
  const res = await fetch('/api/rooms', {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return {
    rooms: Array.isArray(data?.rooms) ? data.rooms : [],
    backend: data?.backend || null,
    indexed: data?.indexed !== false,
  };
}

/** Check host secret without creating a room (solo / local unlock). */
export async function verifyHostSecret(createSecret) {
  const res = await fetch('/api/host-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ createSecret: createSecret ?? '' }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchRoomSnapshot(roomId, { sessionToken } = {}) {
  const qs = sessionToken
    ? `?sessionToken=${encodeURIComponent(sessionToken)}`
    : '';
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/snapshot${qs}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function joinRoom(roomId, { role, seatPlayerId, seatSecret }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, seatPlayerId, seatSecret }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function releaseSeat(roomId, { seatPlayerId, sessionToken, hostKey }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/release-seat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatPlayerId, sessionToken, hostKey }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Host sits as a player without losing ADMIN (host + player). */
export async function claimHostSeat(roomId, { seatPlayerId, sessionToken, hostKey }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/claim-seat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatPlayerId, sessionToken, hostKey }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function postRoomAction(roomId, action, auth = {}) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      sessionToken: auth.sessionToken,
      hostKey: auth.hostKey,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/**
 * Subscribe to room SSE. Optional onStatus receives:
 * 'open' | 'reconnecting' | 'closed'
 * Returns an unsubscribe function.
 */
export function subscribeRoom(roomId, onMessage, onStatus, { sessionToken } = {}) {
  const qs = sessionToken
    ? `?sessionToken=${encodeURIComponent(sessionToken)}`
    : '';
  const source = new EventSource(
    `/api/rooms/${encodeURIComponent(roomId)}/events${qs}`,
  );
  let sawOpen = false;
  let intentionalClose = false;

  source.onopen = () => {
    sawOpen = true;
    onStatus?.('open');
  };

  source.onmessage = (event) => {
    if (sawOpen) onStatus?.('open');
    try {
      onMessage(JSON.parse(event.data));
    } catch (err) {
      console.error('[room] bad sse payload', err);
    }
  };

  source.onerror = () => {
    if (intentionalClose) return;
    // Browser auto-reconnects; surface "reconnecting" while CONNECTING/CLOSED.
    if (source.readyState === EventSource.CLOSED) {
      onStatus?.('closed');
      return;
    }
    onStatus?.('reconnecting');
  };

  return () => {
    intentionalClose = true;
    source.onerror = null;
    source.onmessage = null;
    source.onopen = null;
    source.close();
    // Do not emit 'closed' on intentional unsubscribe — leaveRoom sets idle itself.
  };
}

export { LOCAL_ONLY_ACTIONS };
