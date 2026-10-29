import { useEffect } from 'react';

const LOCKED_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';
const ZOOMABLE_VIEWPORT =
  'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover';

const CLASS = 'milty-allow-zoom';

/**
 * Temporarily allow pinch / browser page zoom (Milty draft on mobile).
 * Restores the app-wide locked viewport on unmount.
 */
export function useAllowPageZoom(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    const meta = document.querySelector('meta[name="viewport"]');
    const prevContent = meta?.getAttribute('content') || LOCKED_VIEWPORT;
    const { documentElement, body } = document;

    if (meta) meta.setAttribute('content', ZOOMABLE_VIEWPORT);
    documentElement.classList.add(CLASS);
    body.classList.add(CLASS);

    return () => {
      if (meta) meta.setAttribute('content', prevContent || LOCKED_VIEWPORT);
      documentElement.classList.remove(CLASS);
      body.classList.remove(CLASS);
    };
  }, [enabled]);
}
