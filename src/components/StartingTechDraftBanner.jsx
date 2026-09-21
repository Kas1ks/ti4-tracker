/** Host prompt to open the post-start starting-tech draft. */
export function StartingTechDraftBanner({ show, count = 0, onStart }) {
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[57] p-3 md:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-cyan-500/80 bg-slate-950/95 shadow-[0_12px_40px_rgba(34,211,238,0.2)] backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-950/60 border border-cyan-600/50 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-atom text-cyan-300 text-lg" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/90">
              Стартовые технологии
            </div>
            <div className="font-orbitron font-extrabold text-sm text-white leading-tight">
              {count} {count === 1 ? 'игрок выбирает' : 'игроков выбирают'} tech
            </div>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="flex-shrink-0 min-h-[44px] px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-sm border border-cyan-300 shadow"
          >
            Начать
          </button>
        </div>
      </div>
    </div>
  );
}
