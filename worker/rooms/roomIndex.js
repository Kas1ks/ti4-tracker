import { hubRoomCard } from './roomCore.js';

export function hasRoomDirectory(env) {
  return Boolean(env?.ROOM_DIRECTORY);
}

function directoryStub(env) {
  const id = env.ROOM_DIRECTORY.idFromName('global');
  return env.ROOM_DIRECTORY.get(id);
}

/** Register / refresh a room card in the global hub index. */
export async function directoryUpsert(env, room) {
  if (!hasRoomDirectory(env)) return;
  const card = hubRoomCard(room);
  if (!card) return;
  try {
    const stub = directoryStub(env);
    await stub.fetch(new Request('https://directory/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    }));
  } catch (err) {
    console.error('[roomIndex] upsert failed', err);
  }
}

/** Drop a room from the global hub index. */
export async function directoryRemove(env, roomId) {
  if (!hasRoomDirectory(env)) return;
  const id = String(roomId || '').trim().toUpperCase();
  if (!id) return;
  try {
    const stub = directoryStub(env);
    await stub.fetch(new Request(`https://directory/remove?roomId=${encodeURIComponent(id)}`, {
      method: 'POST',
    }));
  } catch (err) {
    console.error('[roomIndex] remove failed', err);
  }
}

/** @returns {Promise<object[]>} */
export async function directoryList(env) {
  if (!hasRoomDirectory(env)) return [];
  try {
    const stub = directoryStub(env);
    const res = await stub.fetch(new Request('https://directory/list'));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.rooms) ? data.rooms : [];
  } catch (err) {
    console.error('[roomIndex] list failed', err);
    return [];
  }
}
