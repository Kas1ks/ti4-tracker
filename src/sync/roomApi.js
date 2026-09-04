import { LOCAL_ONLY_ACTIONS } from './constants.js';

async function readError(res) {
  try {
    const data = await res.json();
    return data?.error || `http-${res.status}`;
  } catch {
    return `http-${res.status}`;
  }
}

export async function createRoom(state) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: state ?? null }),
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

export function subscribeRoom(roomId, onMessage) {
  const source = new EventSource(`/api/rooms/${encodeURIComponent(roomId)}/events`);

  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch (err) {
      console.error('[room] bad sse payload', err);
    }
  };

  return () => source.close();
}

export { LOCAL_ONLY_ACTIONS };
