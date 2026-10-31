import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ti4_pwa_install_dismissed';
const INSTALLED_KEY = 'ti4_pwa_installed';

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
    // Permanent dismiss ("1") or legacy TTL timestamp still in the future.
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
      // Permanent — banner must not keep reappearing every day on the hub.
      localStorage.setItem(DISMISS_KEY, '1');
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

  const standaloneNow = isStandaloneDisplay();
  const canNativePrompt = Boolean(deferred) && !standaloneNow;
  const ios = isIos();
  const iosSafari = isIosSafari();
  const mobile = isMobileViewport();

  // Live check only: hide when already running as installed app, or user dismissed.
  // Do NOT use ti4_pwa_installed for visibility — that flag survives uninstall /
  // opening the same origin in a normal browser tab and wrongly hid the banner.
  const showBanner = !dismissed && mobile && !standaloneNow;

  return {
    installed: standaloneNow || installed,
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
