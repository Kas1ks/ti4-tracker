import { useEffect, useState } from 'react';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  onDeferredInstallPrompt,
} from '../pwaInstallCapture.js';

const DISMISS_KEY = 'ti4_pwa_install_dismissed';
const INSTALLED_KEY = 'ti4_pwa_installed';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.standalone === true) return true;
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  return modes.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`)?.matches);
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    if (raw === '1') return true;
    const until = Number(raw);
    if (Number.isFinite(until) && until > Date.now()) return true;
    localStorage.removeItem(DISMISS_KEY);
    return false;
  } catch {
    return false;
  }
}

function readInstalledFlag() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeInstalledFlag() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch {
    /* ignore */
  }
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isIosSafari() {
  if (!isIos()) return false;
  const ua = navigator.userAgent || '';
  return /WebKit/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 900px)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

function manifestUrlForRelatedApps() {
  if (typeof window === 'undefined') return '';
  try {
    return new URL('manifest.webmanifest', window.location.origin).href;
  } catch {
    return `${window.location.origin}/manifest.webmanifest`;
  }
}

/**
 * Chrome Android: detect installed PWA even from a normal browser tab.
 * Requires manifest related_applications[{ platform: 'webapp', url }].
 */
async function probeRelatedWebAppInstalled() {
  if (typeof navigator === 'undefined' || !navigator.getInstalledRelatedApps) {
    return false;
  }
  try {
    const apps = await navigator.getInstalledRelatedApps();
    if (!Array.isArray(apps) || apps.length === 0) return false;
    const manifestHref = manifestUrlForRelatedApps();
    return apps.some((app) => {
      if (app?.platform !== 'webapp') return false;
      if (!app.url) return true;
      try {
        return new URL(app.url, window.location.origin).href === manifestHref
          || app.url === '/'
          || app.url.endsWith('manifest.webmanifest');
      } catch {
        return true;
      }
    });
  } catch {
    return false;
  }
}

/**
 * IMPORTANT: call promptInstallFromGesture() only from a sync click handler.
 * Any await before event.prompt() drops Chrome's user-activation → install UI never opens.
 */
export function promptInstallFromGesture() {
  const promptEvent = getDeferredInstallPrompt();
  if (!promptEvent?.prompt) {
    return { ok: false, reason: 'unavailable', choice: null };
  }
  try {
    // Must stay synchronous relative to the click (no await above this line).
    promptEvent.prompt();
    const choice = promptEvent.userChoice || Promise.resolve({ outcome: 'dismissed' });
    return {
      ok: true,
      reason: 'prompted',
      choice: Promise.resolve(choice).then((result) => {
        clearDeferredInstallPrompt();
        if (result?.outcome === 'accepted') writeInstalledFlag();
        return result;
      }),
    };
  } catch {
    return { ok: false, reason: 'unavailable', choice: null };
  }
}

/**
 * PWA install UX.
 * Android: banner + «Установить» while not installed (BIP optional — guide on fail).
 * Hide when already installed — including normal Chrome tab (relatedApps / flag).
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(() => getDeferredInstallPrompt());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [relatedInstalled, setRelatedInstalled] = useState(false);
  const [flagInstalled, setFlagInstalled] = useState(() => readInstalledFlag());

  useEffect(() => {
    let cancelled = false;

    const markInstalled = () => {
      writeInstalledFlag();
      clearDeferredInstallPrompt();
      setDeferred(null);
      setFlagInstalled(true);
    };

    const refreshRelated = async () => {
      const found = await probeRelatedWebAppInstalled();
      if (cancelled) return;
      setRelatedInstalled(found);
      if (found) {
        writeInstalledFlag();
        setFlagInstalled(true);
        clearDeferredInstallPrompt();
        setDeferred(null);
      }
    };

    if (isStandaloneDisplay()) markInstalled();

    const unsubPrompt = onDeferredInstallPrompt((prompt) => {
      setDeferred(prompt);
    });

    const onInstalled = () => markInstalled();
    window.addEventListener('appinstalled', onInstalled);

    const medias = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
      .map((mode) => window.matchMedia?.(`(display-mode: ${mode})`))
      .filter(Boolean);
    const onMode = () => {
      if (isStandaloneDisplay()) markInstalled();
    };
    medias.forEach((mq) => mq.addEventListener?.('change', onMode));

    const onVis = () => {
      if (document.visibilityState === 'visible') refreshRelated();
    };
    const onFocus = () => refreshRelated();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    refreshRelated();

    return () => {
      cancelled = true;
      unsubPrompt();
      window.removeEventListener('appinstalled', onInstalled);
      medias.forEach((mq) => mq.removeEventListener?.('change', onMode));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const standaloneNow = isStandaloneDisplay();
  const ios = isIos();
  const iosSafari = isIosSafari();
  const mobile = isMobileViewport();
  const installed = standaloneNow || relatedInstalled || flagInstalled;
  const canNativePrompt = Boolean(deferred || getDeferredInstallPrompt()) && !installed;
  // Banner while not installed (Android always gets Install; iOS Share hint).
  const showBanner = !dismissed && mobile && !installed;
  const showInstallButton = showBanner && !ios;

  return {
    installed,
    dismissed,
    canNativePrompt,
    showIosHint: ios,
    showIosSafariHint: iosSafari,
    showInstallButton,
    showBanner,
    promptInstallFromGesture,
    dismiss,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
  };
}
