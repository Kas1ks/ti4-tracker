import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

function applyLock() {
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  const { body, documentElement } = document;
  body.dataset.scrollLocked = '1';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${savedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  documentElement.style.overflow = 'hidden';
}

function releaseLock() {
  const { body, documentElement } = document;
  delete body.dataset.scrollLocked;
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  documentElement.style.overflow = '';
  window.scrollTo(0, savedScrollY);
}

/**
 * Lock page scroll while a modal/overlay is open.
 * Supports nested locks via a shared counter.
 */
export function useBodyScrollLock(locked = true) {
  useEffect(() => {
    if (!locked) return undefined;

    lockCount += 1;
    if (lockCount === 1) applyLock();

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
}
