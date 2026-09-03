import { ALL_FACTIONS } from '../data/gameData';

export function SpeakerSelectionModal({
  show,
  activePlayer,
  activePlayers,
  onSelectSpeaker,
}) {
  if (!show || !activePlayer) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaker-select-title"
        className="bg-slate-900 border border-purple-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-purple-500/10"
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <h2 id="speaker-select-title" className="font-orbitron text-lg font-bold text-purple-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-gavel" aria-hidden="true" /> Карта Политики: Выбор Спикера
          </h2>
        </div>
        <div className="space-y-4">
          <h3 className="font-orbitron font-bold text-lg text-amber-400 text-center">Выберите следующего Спикера</h3>
          <p className="text-sm text-slate-400 text-center">
            Игрок <span className="font-bold text-white">{activePlayer.name}</span> выбирает следующего Спикера.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            {activePlayers.map(player => {
              const faction = ALL_FACTIONS.find(f => f.id === player.factionId);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onSelectSpeaker(player.id)}
                  className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-purple-500"
                >
                  <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                  <div className="font-bold text-purple-400">{player.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
