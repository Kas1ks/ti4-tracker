import { useEffect, useRef } from 'react';

function ensureAudioContext(ref) {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ref.current || ref.current.state === 'closed') {
    ref.current = new AC();
  }
  return ref.current;
}

/** Short two-tone chime — no external assets. */
function playTurnChime(ctx) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [
    { freq: 660, start: 0, dur: 0.14 },
    { freq: 880, start: 0.12, dur: 0.22 },
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  });
}

function vibrateTurn() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([40, 60, 80]);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Plays a sound (+ light vibration) when it becomes the local player's turn.
 * Skips the initial mount so a refresh mid-turn does not beep.
 */
export function useYourTurnAlert({ enabled, isYourTurn }) {
  const prevRef = useRef(null);
  const audioRef = useRef(null);

  // Unlock AudioContext after first user gesture (browser autoplay policy).
  useEffect(() => {
    if (!enabled) return undefined;

    const unlock = () => {
      const ctx = ensureAudioContext(audioRef);
      if (ctx?.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      prevRef.current = null;
      return;
    }

    if (prevRef.current === null) {
      prevRef.current = !!isYourTurn;
      return;
    }

    if (isYourTurn && !prevRef.current) {
      const ctx = ensureAudioContext(audioRef);
      if (ctx?.state === 'suspended') {
        ctx.resume().then(() => playTurnChime(ctx)).catch(() => {});
      } else {
        playTurnChime(ctx);
      }
      vibrateTurn();

      if (typeof document !== 'undefined') {
        const prevTitle = document.title;
        document.title = 'Ваш ход — TI4 Tracker';
        window.setTimeout(() => {
          if (document.title === 'Ваш ход — TI4 Tracker') {
            document.title = prevTitle;
          }
        }, 8000);
      }
    }

    prevRef.current = !!isYourTurn;
  }, [enabled, isYourTurn]);
}
