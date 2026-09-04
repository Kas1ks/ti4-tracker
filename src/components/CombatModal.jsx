import { ALL_FACTIONS } from '../data/gameData';
import { useEscapeKey } from '../hooks/useEscapeKey';

export function CombatModal({
  show,
  minimized,
  onMinimize,
  onClose,
  activePlayer,
  activePlayers,
  onRecordDamage,
  combatOpponentId,
  setCombatOpponentId,
  combatHits,
  setCombatHits,
  combatRound,
  setCombatRound,
  totalCombatDamage,
  setTotalCombatDamage,
  readOnly = false,
}) {
  useEscapeKey(onClose, show && !minimized && !!activePlayer);
  if (!show || !activePlayer) return null;

  const opponent = activePlayers.find(p => p.id === combatOpponentId);

  const handleEndCombat = () => {
    if (!opponent) return;

    onRecordDamage({
      [activePlayer.id]: totalCombatDamage.attacker + combatHits.attacker,
      [opponent.id]: totalCombatDamage.defender + combatHits.defender,
    });

    onClose();
  };

  const handleNextCombatRound = () => {
    setTotalCombatDamage(prev => ({
      attacker: prev.attacker + combatHits.attacker,
      defender: prev.defender + combatHits.defender,
    }));
    setCombatHits({ attacker: 0, defender: 0 });
    setCombatRound(prev => prev + 1);
  };

  const attackerFaction = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);
  const defenderFaction = opponent ? ALL_FACTIONS.find(f => f.id === opponent.factionId) : null;

  return (
    <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${minimized ? 'hidden' : ''}`} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-modal-title"
        className={`bg-slate-900 border border-red-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-red-500/10 ${readOnly ? '[&_button:not([aria-label])]:pointer-events-none [&_button:not([aria-label])]:opacity-60' : ''}`}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <h2 id="combat-modal-title" className="font-orbitron text-lg font-bold text-red-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-crosshairs" /> Окно Сражения
          </h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onMinimize} aria-label="Свернуть" className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-window-minimize text-base" />
            </button>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        </div>

        {!combatOpponentId ? (
          <div className="space-y-3">
            <h3 className="text-center font-bold text-slate-300">Выберите защищающегося игрока:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activePlayers.filter(p => p.id !== activePlayer.id).map(opp => {
                const faction = ALL_FACTIONS.find(f => f.id === opp.factionId);
                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => setCombatOpponentId(opp.id)}
                    className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-red-500"
                  >
                    <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                    <div className="font-bold text-red-400">{opp.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : opponent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 text-center">
                <div className="text-sm text-slate-400">Раунд боя</div>
                <div className="font-orbitron font-black text-3xl text-amber-400">{combatRound}</div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-700 text-center space-y-3">
                <div className="text-xs font-bold text-cyan-400 uppercase">АТАКУЮЩИЙ</div>
                <img src={attackerFaction?.iconUrl} alt={attackerFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                <div className="font-bold text-lg text-white">{activePlayer.name}</div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: Math.max(0, h.attacker - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">-</button>
                  <div className="font-orbitron font-black text-5xl text-cyan-400 w-24">{combatHits.attacker}</div>
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: h.attacker + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">+</button>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Попаданий</div>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  Всего урона в бою:
                  <span className="font-bold text-base text-cyan-300 ml-1">{totalCombatDamage.attacker + combatHits.attacker}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-red-700 text-center space-y-3">
                <div className="text-xs font-bold text-red-400 uppercase">ЗАЩИЩАЮЩИЙСЯ</div>
                <img src={defenderFaction?.iconUrl} alt={defenderFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                <div className="font-bold text-lg text-white">{opponent.name}</div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, defender: Math.max(0, h.defender - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">-</button>
                  <div className="font-orbitron font-black text-5xl text-red-400 w-24">{combatHits.defender}</div>
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, defender: h.defender + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">+</button>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Попаданий</div>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  Всего урона в бою:
                  <span className="font-bold text-base text-red-300 ml-1">{totalCombatDamage.defender + combatHits.defender}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCombatOpponentId(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-xs transition"
              >
                <i className="fa-solid fa-users mr-1" /> Сменить оппонента
              </button>
              <button
                type="button"
                onClick={handleNextCombatRound}
                className="bg-amber-600 hover:bg-amber-500 text-black font-orbitron font-bold px-5 py-3 rounded-xl text-sm transition"
              >
                Следующий раунд <i className="fa-solid fa-arrow-right ml-1" />
              </button>
              <button
                type="button"
                onClick={handleEndCombat}
                className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-xs transition border border-red-800"
              >
                <i className="fa-solid fa-flag-checkered mr-1" /> Завершить бой
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
