import { STRATEGY_CARDS } from '../data/gameData';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';

function statusLabel(status) {
  if (status === 'played') return 'Сыграно';
  if (status === 'passed') return 'Пас';
  return 'Ожидание';
}

function resolutionSecsFor(resolution, playerId, liveSecs) {
  const status = resolution?.responses?.[playerId];
  const started = resolution?.startedAt;
  if (!Number.isFinite(started)) return 0;
  if (status === 'played' || status === 'passed') {
    const ended = resolution?.resolvedAt?.[playerId] ?? resolution?.resolvedAt?.[String(playerId)];
    if (Number.isFinite(ended)) {
      return Math.max(0, Math.floor((ended - started) / 1000));
    }
    return liveSecs;
  }
  return liveSecs;
}

export function StrategyResolutionModal({
  show,
  minimized,
  resolution,
  players = [],
  canResolveAny = false,
  onResolve,
  onMinimize,
  onClose,
}) {
  useEscapeKey(onMinimize || onClose, show && !minimized);
  useBodyScrollLock(show && !minimized);

  const seats = (players || []).filter(p => !p.eliminated && resolution?.responses?.[p.id] != null);
  const anyPending = seats.some((p) => {
    const s = resolution?.responses?.[p.id];
    return s !== 'played' && s !== 'passed';
  });
  const liveSecs = useElapsedSeconds(
    resolution?.startedAt,
    !!show && !minimized && anyPending && Number.isFinite(resolution?.startedAt),
  );

  if (!show) return null;

  const card = STRATEGY_CARDS.find(c => c.id === resolution?.cardId) || null;
  const owner = players.find(p => p.id === resolution?.playerId) || null;
  const answered = seats.filter(p => {
    const s = resolution?.responses?.[p.id];
    return s === 'played' || s === 'passed';
  }).length;

  return (
    <div
      className={`fixed inset-0 z-[56] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${minimized ? 'hidden' : ''}`}
      role="presentation"
      onClick={onMinimize || onClose}
    >
      <div
        className="relative w-full max-w-5xl max-md:h-full md:max-h-[92vh] bg-slate-950 border border-amber-700/60 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-resolution-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 md:py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="min-w-0">
            <h2 id="strategy-resolution-title" className="font-orbitron font-black text-base md:text-xl text-amber-300 uppercase tracking-wide truncate">
              Розыгрыш карты стратегии
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {owner ? `${owner.name} · ` : ''}
              {card?.name || `Карта #${resolution?.cardId ?? '—'}`}
              {' · '}
              {answered}/{seats.length}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {Number.isFinite(resolution?.startedAt) && (
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Таймер</div>
                <div className="font-orbitron font-black text-amber-300 text-lg tabular-nums leading-none">
                  {formatTime(liveSecs)}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onMinimize || onClose}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
              title="Свернуть"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 grid md:grid-cols-[minmax(0,300px)_1fr] gap-4 md:gap-6">
          <div className="flex flex-col items-center gap-3">
            {card?.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-full max-w-[300px] rounded-xl border-2 border-amber-600/70 shadow-lg object-cover"
              />
            ) : (
              <div className="w-full max-w-[300px] aspect-[3/4] rounded-xl border-2 border-amber-700/50 bg-slate-900 flex items-center justify-center text-amber-300 font-orbitron font-bold text-center p-4">
                {card?.name || 'Карта стратегии'}
              </div>
            )}
            <div className={`w-full max-w-[300px] text-center text-xs md:text-sm font-bold uppercase tracking-wider px-3 py-2 rounded-xl border ${card?.color || 'border-slate-700 text-slate-300'}`}>
              {card?.name || `Карта #${resolution?.cardId}`}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
              Ответы игроков
            </div>
            {seats.map((p) => {
              const status = resolution?.responses?.[p.id] || 'pending';
              const played = status === 'played';
              const passed = status === 'passed';
              const done = played || passed;
              const secs = resolutionSecsFor(resolution, p.id, liveSecs);
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 md:px-4 py-2.5 md:py-3 ${
                    played
                      ? 'bg-emerald-950/40 border-emerald-600/70'
                      : passed
                        ? 'bg-rose-950/40 border-rose-600/70'
                        : 'bg-slate-900/80 border-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#64748b' }}
                    />
                    <span className={`font-bold truncate md:text-lg ${
                      played ? 'text-emerald-200' : passed ? 'text-rose-200' : 'text-slate-300'
                    }`}>
                      {p.name}
                    </span>
                    {p.id === resolution?.playerId && (
                      <span className="text-[10px] uppercase font-orbitron font-bold text-amber-400/90 border border-amber-700/50 px-1.5 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`font-orbitron font-bold text-sm tabular-nums ${
                      done ? 'text-slate-400' : 'text-amber-300'
                    }`} title="Время ответа">
                      {formatTime(secs)}
                    </span>
                    <span className={`text-xs md:text-sm font-bold uppercase tracking-wide ${
                      played ? 'text-emerald-300' : passed ? 'text-rose-300' : 'text-slate-500'
                    }`}>
                      {statusLabel(status)}
                    </span>
                    {canResolveAny && !done && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onResolve?.(p.id, 'played')}
                          className="text-[11px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700 text-emerald-200 hover:bg-emerald-800/70"
                        >
                          Сыграно
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolve?.(p.id, 'passed')}
                          className="text-[11px] md:text-xs font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-rose-900/60 border border-rose-700 text-rose-200 hover:bg-rose-800/70"
                        >
                          Пас
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
