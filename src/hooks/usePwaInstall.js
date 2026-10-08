import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ti4_pwa_install_dismissed';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const ios = window.navigator.standalone === true;
  return Boolean(mq || ios);
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
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
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
    if (!deferred) return { ok: false, reason: 'unavailable' };
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice?.outcome === 'accepted') {
      setInstalled(true);
      return { ok: true };
    }
    return { ok: false, reason: 'dismissed' };
  };

  const canNativePrompt = Boolean(deferred) && !installed;
  const ios = isIos();
  const iosSafari = isIosSafari();
  const mobile = isMobileViewport();

  // Always hint on phone/tablet when not installed (manual steps if no native prompt).
  const showBanner = !installed && !dismissed && mobile;

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
