import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ti4_pwa_install_dismissed';
const INSTALLED_KEY = 'ti4_pwa_installed';
/** «Позже» hides the banner for a day. */
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.standalone === true) return true;
  // Installed PWAs / home-screen apps report one of these, not "browser".
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  return modes.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`)?.matches);
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    // Legacy forever-dismiss — clear so logic can recover.
    if (raw === '1') {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
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
  const webkit = /WebKit/.test(ua);
  const criOS = /CriOS/.test(ua);
  const fxIOS = /FxiOS/.test(ua);
  return webkit && !criOS && !fxIOS;
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 900px)').matches
    || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

/**
 * Captures beforeinstallprompt (Android Chrome HTTPS) and exposes install UX state.
 * On LAN http:// the native prompt often never fires — still show manual steps.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(
    () => isStandaloneDisplay() || readInstalledFlag(),
  );
  const [dismissed, setDismissed] = useState(() => readDismissed());

  useEffect(() => {
    const markInstalled = () => {
      writeInstalledFlag();
      setInstalled(true);
      setDeferred(null);
    };

    if (isStandaloneDisplay()) {
      markInstalled();
    }

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      markInstalled();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    const medias = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
      .map((mode) => window.matchMedia?.(`(display-mode: ${mode})`))
      .filter(Boolean);
    const onMode = () => {
      if (isStandaloneDisplay()) markInstalled();
    };
    medias.forEach((mq) => mq.addEventListener?.('change', onMode));

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      medias.forEach((mq) => mq.removeEventListener?.('change', onMode));
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_TTL_MS));
    } catch {
      /* ignore */
    }
  };

  const promptInstall = async () => {
    if (!deferred) return { ok: false, reason: 'unavailable' };
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice?.outcome === 'accepted') {
      writeInstalledFlag();
      setInstalled(true);
      return { ok: true };
    }
    return { ok: false, reason: 'dismissed' };
  };

  const canNativePrompt = Boolean(deferred) && !installed;
  const ios = isIos();
  const iosSafari = isIosSafari();
  const mobile = isMobileViewport();

  // Never hint inside an installed / home-screen session.
  const showBanner = !installed && !dismissed && mobile && !isStandaloneDisplay();

  return {
    installed,
    dismissed,
    canNativePrompt,
    showIosHint: ios,
    showIosSafariHint: iosSafari,
    showManualAndroid: !ios && !canNativePrompt,
    showBanner,
    promptInstall,
    dismiss,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
  };
}
