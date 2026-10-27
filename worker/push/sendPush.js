import { buildPushPayload } from '@block65/webcrypto-web-push';

/**
 * @param {object} env
 * @returns {{ subject: string, publicKey: string, privateKey: string } | null}
 */
export function readVapidConfig(env) {
  const publicKey = String(env?.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(env?.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(env?.VAPID_SUBJECT || 'mailto:admin@ti4-tracker.local').trim();
  if (!publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}

/**
 * Send one Web Push notification.
 * @returns {Promise<{ ok: boolean, status?: number, gone?: boolean, error?: string }>}
 */
export async function sendWebPush(env, subscription, payload) {
  const vapid = readVapidConfig(env);
  if (!vapid) return { ok: false, error: 'vapid-not-configured' };
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { ok: false, error: 'bad-subscription' };
  }

  try {
    const built = await buildPushPayload(
      {
        data: payload,
        options: { ttl: 60 * 60, urgency: 'high' },
      },
      {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      vapid,
    );

    const res = await fetch(subscription.endpoint, {
      method: built.method || 'POST',
      headers: built.headers,
      body: built.body,
    });

    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: res.status, gone: true };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `push-http-${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
