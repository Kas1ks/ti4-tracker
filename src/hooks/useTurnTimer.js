import { useEffect, useState } from 'react';

/**
 * Live elapsed seconds from a wall-clock turnStartedAt.
 * Re-renders once a second while running; does not mutate game state.
 */
export function useElapsedSeconds(startedAt, isRunning) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || !Number.isFinite(startedAt)) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning, startedAt]);

  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** @deprecated Prefer useElapsedSeconds — kept for any leftover imports. */
export function useTurnTimer({ isRunning, onTick }) {
  useEffect(() => {
    if (!isRunning) return undefined;
    const interval = window.setInterval(onTick, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, onTick]);
}
