/**
 * Capture beforeinstallprompt as early as possible (before React mounts).
 * Chrome may fire it once during bootstrap — a late useEffect listener misses it.
 */

let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(deferredPrompt);
    } catch {
      /* ignore */
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
  notify();
}

/** Subscribe to prompt availability changes. Returns unsubscribe. */
export function onDeferredInstallPrompt(callback) {
  listeners.add(callback);
  callback(deferredPrompt);
  return () => listeners.delete(callback);
}
