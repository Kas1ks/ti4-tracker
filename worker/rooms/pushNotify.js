import { newlyNeedingAction } from './needsAction.js';
import { sendWebPush } from '../push/sendPush.js';

/**
 * @param {object} room
 * @returns {Record<string, object>}
 */
export function pushSubsOf(room) {
  return room?.pushSubs && typeof room.pushSubs === 'object' ? room.pushSubs : {};
}

/**
 * @param {object} room
 * @param {string} sessionToken
 * @param {{ subscription: object, seatPlayerId?: any, role?: string }} entry
 */
export function upsertPushSub(room, sessionToken, entry) {
  const token = String(sessionToken || '').trim();
  if (!token || !entry?.subscription?.endpoint) return room;
  const pushSubs = { ...pushSubsOf(room) };
  pushSubs[token] = {
    seatPlayerId: entry.seatPlayerId ?? null,
    role: entry.role || null,
    subscription: {
      endpoint: String(entry.subscription.endpoint),
      expirationTime: entry.subscription.expirationTime ?? null,
      keys: {
        p256dh: String(entry.subscription.keys?.p256dh || ''),
        auth: String(entry.subscription.keys?.auth || ''),
      },
    },
    updatedAt: new Date().toISOString(),
  };
  return { ...room, pushSubs };
}

export function removePushSub(room, sessionToken) {
  const token = String(sessionToken || '').trim();
  if (!token) return room;
  const pushSubs = { ...pushSubsOf(room) };
  if (!pushSubs[token]) return room;
  delete pushSubs[token];
  return { ...room, pushSubs };
}

/**
 * After a successful action: notify seats/admin that newly need action.
 * @param {object} env
 * @param {object} prevRoom
 * @param {object} nextRoom
 * @returns {Promise<object>} nextRoom (possibly with dead subs pruned)
 */
export async function notifyNeedsAction(env, prevRoom, nextRoom) {
  const edges = newlyNeedingAction(prevRoom?.state, nextRoom?.state);
  if (!edges.length) return nextRoom;

  const subs = Object.entries(pushSubsOf(nextRoom));
  if (!subs.length) return nextRoom;

  let pushSubs = { ...pushSubsOf(nextRoom) };
  const roomId = nextRoom.roomId;

  for (const edge of edges) {
    const targets = subs.filter(([, meta]) => {
      if (edge.target === 'admin') {
        return meta.role === 'admin' || meta.role === 'ADMIN';
      }
      const seat = meta.seatPlayerId;
      return seat != null && String(seat) === String(edge.seatPlayerId);
    });

    for (const [token, meta] of targets) {
      const result = await sendWebPush(env, meta.subscription, {
        title: edge.title,
        body: edge.body,
        reason: edge.reason,
        roomId,
        url: `/?room=${encodeURIComponent(roomId)}`,
      });
      if (result.gone) {
        delete pushSubs[token];
      }
    }
  }

  return { ...nextRoom, pushSubs };
}
