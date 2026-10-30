/** Host prompt to deal secret objectives after starting techs (if any). */
export function SecretDealBanner({ show, onStart }) {
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[56] p-3 md:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border-2 border-red-500/75 bg-slate-950/95 shadow-[0_12px_40px_rgba(239,68,68,0.22)] backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          <div className="w-11 h-11 rounded-xl bg-red-950/60 border border-red-600/55 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-user-secret text-red-300 text-lg" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-400/90">
              Секретные цели
            </div>
            <div className="font-orbitron font-extrabold text-sm text-white leading-tight">
              Раздать по 2 карты каждому
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              После запуска можно открывать публичные цели
            </p>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="flex-shrink-0 min-h-[44px] px-4 rounded-xl bg-red-500 hover:bg-red-400 text-black font-extrabold text-sm border border-red-300 shadow"
          >
            Раздать
          </button>
        </div>
      </div>
    </div>
  );
}
