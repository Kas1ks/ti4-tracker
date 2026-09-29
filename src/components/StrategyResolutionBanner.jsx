import { STRATEGY_CARDS } from '../data/gameData';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';

/**
 * Sticky prompt for seated players during strategy-card resolution.
 * Disappears as soon as the seat picks Сыграно or Пас.
 */
export function StrategyResolutionBanner({
  show,
  cardId,
  myStatus,
  startedAt = null,
  onResolve,
}) {
  const pending = myStatus === 'pending' || myStatus == null;
  const elapsed = useElapsedSeconds(startedAt, !!show && pending && Number.isFinite(startedAt));
  if (!show || !pending) return null;

  const card = STRATEGY_CARDS.find(c => c.id === cardId) || null;

  return (
    <div className="fixed inset-x-0 top-0 z-[57] p-3 md:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-amber-500/80 bg-slate-950/95 shadow-[0_12px_40px_rgba(245,158,11,0.25)] backdrop-blur-md overflow-hidden">
        <div className="flex items-stretch gap-3 p-3">
          {card?.imageUrl && (
            <img
              src={card.imageUrl}
              alt={card.name}
              className="w-14 h-[4.75rem] object-cover rounded-lg border border-amber-700/60 flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1 flex flex-col justify-center gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                  Розыгрыш стратегии
                </div>
                <div className="font-orbitron font-extrabold text-sm text-white leading-tight truncate">
                  {card?.name || `Карта #${cardId}`}
                </div>
              </div>
              {Number.isFinite(startedAt) && (
                <div className="font-orbitron font-black text-amber-300 text-base tabular-nums flex-shrink-0">
                  {formatTime(elapsed)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onResolve?.('played')}
                className="min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm border border-emerald-300 shadow"
              >
                Сыграно
              </button>
              <button
                type="button"
                onClick={() => onResolve?.('passed')}
                className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm border border-rose-400 shadow"
              >
                Пас
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
