import { useEffect } from 'react';

/**
 * Pins player mobile UI to the browser visible viewport via CSS vars:
 * --app-top, --app-height, --app-bottom
 */
export function useVisualViewportShell(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const root = document.documentElement;
    const body = document.body;
    const mq = window.matchMedia('(max-width: 767px)');

    const clear = () => {
      root.classList.remove('player-mobile-shell');
      body.classList.remove('player-mobile-shell');
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-top');
      root.style.removeProperty('--app-bottom');
    };

    const sync = () => {
      if (!mq.matches) {
        clear();
        return;
      }

      root.classList.add('player-mobile-shell');
      body.classList.add('player-mobile-shell');

      const vv = window.visualViewport;
      const layoutH = window.innerHeight;
      const height = Math.max(1, Math.round(vv?.height ?? layoutH));
      const top = Math.max(0, Math.round(vv?.offsetTop ?? 0));
      const bottom = Math.max(0, Math.round(layoutH - top - height));

      root.style.setProperty('--app-height', `${height}px`);
      root.style.setProperty('--app-top', `${top}px`);
      root.style.setProperty('--app-bottom', `${bottom}px`);
    };

    sync();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    mq.addEventListener('change', sync);

    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      mq.removeEventListener('change', sync);
      clear();
    };
  }, [enabled]);
}
