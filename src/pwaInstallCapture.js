/**
 * Capture beforeinstallprompt as early as possible (before React mounts).
 * Also mirror onto window — guards against duplicate-module edge cases in bundles.
 */

const WIN_KEY = '__TI4_PWA_DEFERRED__';

let deferredPrompt = null;
const listeners = new Set();

function readWindowDeferred() {
  try {
    return typeof window !== 'undefined' ? window[WIN_KEY] || null : null;
  } catch {
    return null;
  }
}

function writeWindowDeferred(value) {
  try {
    if (typeof window !== 'undefined') window[WIN_KEY] = value;
  } catch {
    /* ignore */
  }
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(deferredPrompt);
    } catch {
      /* ignore */
    }
  });
}

function setDeferred(event) {
  deferredPrompt = event || null;
  writeWindowDeferred(deferredPrompt);
  notify();
}

if (typeof window !== 'undefined') {
  // Restore if a previous chunk already captured the event.
  deferredPrompt = readWindowDeferred();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setDeferred(event);
  });
  window.addEventListener('appinstalled', () => {
    setDeferred(null);
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt || readWindowDeferred();
}

export function clearDeferredInstallPrompt() {
  setDeferred(null);
}

/** Subscribe to prompt availability changes. Returns unsubscribe. */
export function onDeferredInstallPrompt(callback) {
  listeners.add(callback);
  callback(getDeferredInstallPrompt());
  return () => listeners.delete(callback);
}
