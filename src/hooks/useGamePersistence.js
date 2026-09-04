import { useEffect } from 'react';
import { saveGameState, stampGameState } from '../game/gameState';

/** Mirror the game document into localStorage whenever it changes. */
export function useGamePersistence(game) {
  useEffect(() => {
    saveGameState(stampGameState(game));
  }, [game]);
}
