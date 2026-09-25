import { LOCAL_ONLY_ACTIONS } from './constants.js';

async function readError(res) {
  try {
    const data = await res.json();
    return data?.error || `http-${res.status}`;
  } catch {
    return `http-${res.status}`;
  }
}

export async function createRoom(state, { createSecret } = {}) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: state ?? null,
      createSecret: createSecret ?? '',
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
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

export async function fetchRoomSnapshot(roomId) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/snapshot`);
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
 */
export function subscribeRoom(roomId, onMessage, onStatus) {
  const source = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events`);
  let sawOpen = false;

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
    // Browser auto-reconnects; surface "reconnecting" while CONNECTING/CLOSED.
    if (source.readyState === EventSource.CLOSED) {
      onStatus?.('closed');
      return;
    }
    onStatus?.('reconnecting');
  };

  return () => {
    source.close();
    onStatus?.('closed');
  };
}

export { LOCAL_ONLY_ACTIONS };
