/**
 * Sticky banner when someone has reached the VP target.
 * Gameplay processes are frozen until host undoes / edits scores below target.
 */
export function VictoryLockBanner({
  winners = [],
  targetScore,
  canUndo = false,
  onUndo,
  isHost = false,
}) {
  if (!winners.length) return null;
  const names = winners.map(p => p.name).join(', ');

  return (
    <div
      className="sticky top-0 z-[45] border-b border-amber-600/70 bg-gradient-to-r from-amber-950 via-slate-950 to-amber-950 px-3 py-2.5 shadow-lg shadow-amber-900/30"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2.5">
          <i className="fa-solid fa-trophy text-amber-400 text-lg mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-orbitron font-black text-sm md:text-base text-amber-300 uppercase tracking-wide truncate">
              Победа · {names}
            </div>
            <p className="text-[11px] md:text-xs text-slate-400 leading-snug">
              Цель {targetScore} ПО достигнута. Ходы, драфт и розыгрыши остановлены.
              {isHost
                ? ' Хост может править ПО или отменить последнее действие — тогда партия продолжится.'
                : ' Ожидайте хоста.'}
            </p>
          </div>
        </div>
        {isHost && typeof onUndo === 'function' && (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
              canUndo
                ? 'bg-orange-950/80 border-orange-600/70 text-orange-200 hover:bg-orange-900'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
            title={canUndo ? 'Отменить получение победного очка' : 'Нечего отменять'}
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
            Отменить последнее
          </button>
        )}
      </div>
    </div>
  );
}
