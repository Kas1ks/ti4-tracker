import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { isStrategyCardPlayed } from '../game/selectors';

export function ActiveTurnBar({
  activePlayer,
  strategyCards = [],
  allStrategiesPlayed,
  strategyActionTaken = false,
  onPlayStrategy,
  turnTime,
  onNextTurn,
  onPassTurn,
  onOpenCombat,
  canPlay = true,
  canNextTurn = true,
  canCombat = true,
}) {
  const faction = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);

  const playerBlock = (
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-14 h-14 max-md:w-11 max-md:h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 overflow-hidden shadow flex-shrink-0">
        <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Сейчас ходит:</div>
        <div className="font-bold text-white text-xl md:text-2xl leading-none truncate">{activePlayer.name}</div>
      </div>
    </div>
  );

  const timerBlock = (
    <div className="flex items-center gap-5 bg-slate-900 px-5 py-2 rounded-xl border border-slate-800 max-md:gap-3 max-md:px-3 flex-shrink-0">
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
  );

  return (
    <div className="bg-slate-950 border-2 border-cyan-500/70 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-4 shadow-[0_0_20px_rgba(6,182,212,0.2)] max-md:flex-col max-md:items-stretch max-md:gap-3">
      {/* Desktop: player alone. Mobile: player + timer in one row */}
      <div className="hidden md:flex items-center gap-4">{playerBlock}</div>
      <div className="flex md:hidden items-center justify-between gap-3 w-full">
        {playerBlock}
        {timerBlock}
      </div>

      {strategyCards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:grid max-md:grid-cols-1">
          {strategyCards.map((card) => {
            const played = isStrategyCardPlayed(activePlayer, card.id);
            const blockedThisTurn = !played && strategyActionTaken;
            const disabled = !canPlay || played || blockedThisTurn;
            return (
              <div
                key={card.id}
                className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 max-md:justify-between"
              >
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">#{card.id}</div>
                  <div className="font-orbitron font-extrabold text-xs md:text-sm text-amber-300 leading-tight">
                    {card.ruName || card.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPlayStrategy(card.id)}
                  disabled={disabled}
                  title={blockedThisTurn ? 'Вторая карта — на следующем ходу' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition whitespace-nowrap max-md:min-h-[40px] max-md:py-2 ${played
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : blockedThisTurn
                      ? 'bg-slate-900 text-slate-500 border-slate-700 cursor-not-allowed'
                      : canPlay
                        ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow'
                        : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
                    }`}
                >
                  {played ? '✓ Сыграна' : blockedThisTurn ? 'След. ход' : 'Сыграть'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="hidden md:flex items-center gap-5 bg-slate-900 px-5 py-2 rounded-xl border border-slate-800">
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

      <div className="flex items-center gap-3 max-md:w-full max-md:grid max-md:grid-cols-2">
        {canNextTurn && (
          <button
            type="button"
            onClick={onNextTurn}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold px-5 py-3 rounded-xl text-sm md:text-base flex items-center justify-center gap-2 shadow-lg transition active:scale-95 font-orbitron uppercase max-md:col-span-2 max-md:min-h-[48px]"
          >
            Завершить ход <i className="fa-solid fa-forward" />
          </button>
        )}
        {canPlay && (
          <button
            type="button"
            onClick={() => onPassTurn(activePlayer.id)}
            disabled={!allStrategiesPlayed}
            title={!allStrategiesPlayed ? 'Сначала сыграйте все карты стратегии!' : ''}
            className={`font-bold px-4 py-3 rounded-xl text-sm border transition max-md:min-h-[48px] ${allStrategiesPlayed
              ? 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800 cursor-pointer'
              : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
              }`}
          >
            Пас
          </button>
        )}
        {canCombat && (
          <button
            type="button"
            onClick={onOpenCombat}
            className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-sm border border-red-800 transition flex items-center justify-center gap-1.5 max-md:min-h-[48px]"
            title="Открыть окно боя"
          >
            <i className="fa-solid fa-crosshairs" />
            <span className="md:hidden">Бой</span>
          </button>
        )}
      </div>
    </div>
  );
}
