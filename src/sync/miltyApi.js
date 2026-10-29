async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { error: 'bad-json', raw: text };
  }
}

export async function createMiltyDraft(settings) {
  const res = await fetch('/api/milty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export async function fetchMiltyDraft(id, auth = {}) {
  const qs = new URLSearchParams();
  if (auth.playerId) qs.set('playerId', auth.playerId);
  if (auth.secret) qs.set('secret', auth.secret);
  if (auth.adminSecret) qs.set('admin', auth.adminSecret);
  const q = qs.toString();
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}${q ? `?${q}` : ''}`);
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function claimMiltySeat(id, body) {
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function unclaimMiltySeat(id, body) {
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}/unclaim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function pickMilty(id, body) {
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}/pick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

export async function undoMilty(id, body) {
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function regenMilty(id, body) {
  const res = await fetch(`/api/milty/${encodeURIComponent(id)}/regen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function subscribeMilty(id, onEvent) {
  const es = new EventSource(`/api/milty/${encodeURIComponent(id)}/events`);
  es.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
  return () => es.close();
}
