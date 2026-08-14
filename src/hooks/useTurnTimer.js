import { useEffect } from 'react';

export function useTurnTimer({ isGameActive, turnOrder, activePlayer, passed, setTurnTime, setPlayers }) {
  useEffect(() => {
    if (!isGameActive || turnOrder.length === 0 || !activePlayer || passed[activePlayer.id]) return undefined;

    const interval = window.setInterval(() => {
      setTurnTime((previous) => previous + 1);
      setPlayers((previousPlayers) => previousPlayers.map((player) => (
        player.id === activePlayer.id
          ? { ...player, totalTime: (player.totalTime || 0) + 1 }
          : player
      )));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isGameActive, turnOrder, activePlayer, passed, setTurnTime, setPlayers]);
}
