import { useCallback, useEffect, useState } from 'react';
import {
  PUSH_PREFS_CACHE,
  PUSH_PREFS_URL,
  defaultPushCategories,
} from '../push/categories';
import { ROLES } from '../sync/permissions';
import {
  fetchVapidPublicKey,
  subscribeRoomPush,
  unsubscribeRoomPush,
  urlBase64ToUint8Array,
} from '../sync/pushApi';

const PREF_KEY = 'ti4_push_enabled';
const CATEGORIES_KEY = 'ti4_push_categories';

function readPref() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw == null) return null;
    return raw === '1';
  } catch {
    return null;
  }
}

function writePref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function readCategories() {
  const defaults = defaultPushCategories();
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function writeCategories(categories) {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    /* ignore */
  }
}

async function mirrorPushPrefs(payload) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(PUSH_PREFS_CACHE);
      await cache.put(
        PUSH_PREFS_URL,
        new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
  } catch {
    /* ignore */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({
      type: 'TI4_PUSH_PREFS',
      ...payload,
    });
  } catch {
    /* ignore */
  }
}

function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * Subscribe the current player/host session to room Web Push.
 * @param {{ roomId?: string|null, sessionToken?: string|null, role?: string|null, enabled?: boolean }} opts
 */
export function usePushNotifications({
  roomId = null,
  sessionToken = null,
  role = null,
  enabled = true,
} = {}) {
  const [pref, setPref] = useState(() => readPref());
  const [categories, setCategories] = useState(() => readCategories());
  const [permission, setPermission] = useState(() => (
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [configured, setConfigured] = useState(null);

  const canUse = pushSupported()
    && enabled
    && !!roomId
    && !!sessionToken
    && (role === ROLES.PLAYER || role === ROLES.ADMIN);

  // Keep SW prefs in sync (categories + master flag for clarity).
  useEffect(() => {
    mirrorPushPrefs({
      enabled: pref === true,
      categories,
    });
  }, [pref, categories]);

  const syncSubscription = useCallback(async (wantOn) => {
    if (!canUse) return { ok: false, reason: 'unavailable' };
    setBusy(true);
    setError(null);
    try {
      const vapid = await fetchVapidPublicKey();
      setConfigured(!!vapid?.configured && !!vapid?.publicKey);
      if (!vapid?.publicKey) {
        setError('vapid-not-configured');
        return { ok: false, reason: 'vapid-not-configured' };
      }

      const reg = await navigator.serviceWorker.ready;
      if (!wantOn) {
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe().catch(() => {});
        await unsubscribeRoomPush(roomId, { sessionToken }).catch(() => {});
        setSubscribed(false);
        writePref(false);
        setPref(false);
        return { ok: true };
      }

      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') {
          writePref(false);
          setPref(false);
          return { ok: false, reason: 'denied' };
        }
      } else if (Notification.permission !== 'granted') {
        setPermission(Notification.permission);
        writePref(false);
        setPref(false);
        return { ok: false, reason: 'denied' };
      } else {
        setPermission('granted');
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        });
      }
      await subscribeRoomPush(roomId, {
        sessionToken,
        subscription: sub.toJSON(),
      });
      setSubscribed(true);
      writePref(true);
      setPref(true);
      return { ok: true };
    } catch (err) {
      setError(String(err?.message || err));
      return { ok: false, reason: 'error', error: err };
    } finally {
      setBusy(false);
    }
  }, [canUse, roomId, sessionToken]);

  // Auto-subscribe when pref is on.
  useEffect(() => {
    if (!canUse) {
      setSubscribed(false);
      return undefined;
    }
    if (pref !== true) return undefined;
    let cancelled = false;
    (async () => {
      const result = await syncSubscription(true);
      if (cancelled) return;
      if (!result.ok && result.reason === 'vapid-not-configured') {
        setConfigured(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canUse, pref, syncSubscription]);

  const enable = useCallback(async () => {
    // Turning master on always re-enables every category; user can fine-tune after.
    const allOn = defaultPushCategories();
    writeCategories(allOn);
    setCategories(allOn);
    return syncSubscription(true);
  }, [syncSubscription]);
  const disable = useCallback(async () => syncSubscription(false), [syncSubscription]);

  const setCategory = useCallback((id, on) => {
    setCategories((prev) => {
      const next = { ...prev, [id]: !!on };
      writeCategories(next);
      return next;
    });
  }, []);

  /** Best-effort server unsubscribe when leaving the room (keeps OS subscription). */
  const unsubscribeServer = useCallback(async () => {
    if (!roomId || !sessionToken) return;
    try {
      await unsubscribeRoomPush(roomId, { sessionToken });
    } catch {
      /* ignore */
    }
    setSubscribed(false);
  }, [roomId, sessionToken]);

  return {
    supported: pushSupported(),
    canUse,
    pref,
    permission,
    busy,
    error,
    subscribed,
    configured,
    categories,
    setCategory,
    enable,
    disable,
    unsubscribeServer,
  };
}
