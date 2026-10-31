/**
 * Mark installed-app display modes on <html>.
 * Standalone WebAPK/TWA often won't scroll the document — pages need an inner scrollport.
 */
const CLASS = 'ti4-standalone';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  if (window.navigator?.standalone === true) return true;
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  return modes.some((mode) => window.matchMedia?.(`(display-mode: ${mode})`)?.matches);
}

function sync() {
  try {
    document.documentElement.classList.toggle(CLASS, isStandaloneDisplay());
  } catch {
    /* ignore */
  }
}

sync();

if (typeof window !== 'undefined') {
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
  modes.forEach((mode) => {
    const mq = window.matchMedia?.(`(display-mode: ${mode})`);
    mq?.addEventListener?.('change', sync);
  });
}

export { isStandaloneDisplay, sync as syncStandaloneDisplayClass };
