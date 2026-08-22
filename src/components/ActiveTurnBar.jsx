import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';

export function ActiveTurnBar({
  activePlayer,
  activeStrategyCard,
  isCurrentStrategyPlayed,
  onPlayStrategy,
  turnTime,
  onNextTurn,
  onPassTurn,
  onOpenCombat,
}) {
  const faction = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);

  return (
    <div className="bg-slate-950 border-2 border-cyan-500/70 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 overflow-hidden shadow">
          <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
        </div>
        <div>
          <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Сейчас ходит:</div>
          <div className="font-bold text-white text-xl md:text-2xl leading-none">{activePlayer.name}</div>
        </div>
      </div>

      {activeStrategyCard && (
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Карта Стратегии:</div>
            <div className="font-orbitron font-extrabold text-sm md:text-base text-amber-300">{activeStrategyCard.name}</div>
          </div>
          <button
            type="button"
            onClick={onPlayStrategy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${isCurrentStrategyPlayed
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
              : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow'
              }`}
          >
            {isCurrentStrategyPlayed ? '✓ Сыграна' : 'Сыграть стратегию'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-5 bg-slate-900 px-5 py-2 rounded-xl border border-slate-800">
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Ход</div>
          <div className="font-orbitron font-black text-amber-400 text-lg md:text-xl">{formatTime(turnTime)}</div>
        </div>
        <div className="w-px h-8 bg-slate-800" />
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Всего</div>
          <div className="font-orbitron font-bold text-slate-300 text-base md:text-lg">{formatTime(activePlayer.totalTime || 0)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNextTurn}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold px-5 py-3 rounded-xl text-sm md:text-base flex items-center gap-2 shadow-lg transition active:scale-95 font-orbitron uppercase"
        >
          Завершить ход <i className="fa-solid fa-forward" />
        </button>
        <button
          type="button"
          onClick={() => onPassTurn(activePlayer.id)}
          disabled={!isCurrentStrategyPlayed}
          title={!isCurrentStrategyPlayed ? 'Сначала сыграйте карту стратегии!' : ''}
          className={`font-bold px-4 py-3 rounded-xl text-sm border transition ${isCurrentStrategyPlayed
            ? 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800 cursor-pointer'
            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
            }`}
        >
          Пас
        </button>
        <button
          type="button"
          onClick={onOpenCombat}
          className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-sm border border-red-800 transition flex items-center gap-1.5"
          title="Открыть окно боя"
        >
          <i className="fa-solid fa-crosshairs" />
        </button>
      </div>
    </div>
  );
}
