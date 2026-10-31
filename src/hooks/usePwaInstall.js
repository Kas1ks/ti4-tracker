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

/**
 * PWA install UX.
 * - Banner when mobile + not running as installed app + not dismissed.
 * - Native prompt when Chrome fired beforeinstallprompt.
 * - Android still exposes «Установить» when app is not installed (standalone),
 *   even if BIP is late/missing — click uses native prompt when available.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(() => getDeferredInstallPrompt());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [swReady, setSwReady] = useState(() => (
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller
  ));

  useEffect(() => {
    if (isStandaloneDisplay()) {
      writeInstalledFlag();
      clearDeferredInstallPrompt();
      setDeferred(null);
    }

    const unsubPrompt = onDeferredInstallPrompt((prompt) => {
      setDeferred(prompt);
    });

    const onInstalled = () => {
      writeInstalledFlag();
      clearDeferredInstallPrompt();
      setDeferred(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    const medias = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
      .map((mode) => window.matchMedia?.(`(display-mode: ${mode})`))
      .filter(Boolean);
    const onMode = () => {
      if (isStandaloneDisplay()) onInstalled();
    };
    medias.forEach((mq) => mq.addEventListener?.('change', onMode));

    let cancelled = false;
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(() => {
        if (!cancelled) setSwReady(true);
      }).catch(() => {});
      const onController = () => {
        if (!cancelled) setSwReady(true);
      };
      navigator.serviceWorker.addEventListener('controllerchange', onController);
      return () => {
        cancelled = true;
        unsubPrompt();
        window.removeEventListener('appinstalled', onInstalled);
        medias.forEach((mq) => mq.removeEventListener?.('change', onMode));
        navigator.serviceWorker.removeEventListener('controllerchange', onController);
      };
    }

    return () => {
      cancelled = true;
      unsubPrompt();
      window.removeEventListener('appinstalled', onInstalled);
      medias.forEach((mq) => mq.removeEventListener?.('change', onMode));
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

  const promptInstall = async () => {
    const promptEvent = deferred || getDeferredInstallPrompt();
    if (!promptEvent?.prompt) return { ok: false, reason: 'unavailable' };
    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearDeferredInstallPrompt();
      setDeferred(null);
      if (choice?.outcome === 'accepted') {
        writeInstalledFlag();
        return { ok: true };
      }
      return { ok: false, reason: 'dismissed' };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  };

  const standaloneNow = isStandaloneDisplay();
  const ios = isIos();
  const iosSafari = isIosSafari();
  const mobile = isMobileViewport();
  const canNativePrompt = Boolean(deferred || getDeferredInstallPrompt()) && !standaloneNow;

  // Not installed (browser tab) on mobile → show banner.
  const showBanner = !dismissed && mobile && !standaloneNow;

  // Android: Install CTA whenever app is not installed. iOS has no native prompt API.
  const showInstallButton = showBanner && !ios;

  return {
    installed: standaloneNow,
    dismissed,
    canNativePrompt,
    showIosHint: ios,
    showIosSafariHint: iosSafari,
    showInstallButton,
    showBanner,
    swReady,
    promptInstall,
    dismiss,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
  };
}
