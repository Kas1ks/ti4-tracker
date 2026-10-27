async function readError(res) {
  try {
    const data = await res.json();
    return data?.error || `http-${res.status}`;
  } catch {
    return `http-${res.status}`;
  }
}

export async function fetchVapidPublicKey() {
  const res = await fetch('/api/push/vapid-public-key');
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function subscribeRoomPush(roomId, { sessionToken, subscription }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, subscription }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function unsubscribeRoomPush(roomId, { sessionToken }) {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/** Convert URL-safe base64 VAPID key to Uint8Array for PushManager.subscribe. */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
