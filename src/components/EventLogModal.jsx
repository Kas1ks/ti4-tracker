import { formatGameEvent } from '../game/gameEvents';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

function formatClock(at) {
  if (!Number.isFinite(at)) return '';
  try {
    return new Date(at).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export function EventLogModal({ show, onClose, events = [], players = [] }) {
  useEscapeKey(onClose, show);
  useBodyScrollLock(!!show);
  if (!show) return null;

  const rows = [...events].reverse();

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-log-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800 flex-shrink-0">
          <h2
            id="event-log-title"
            className="font-orbitron text-lg font-bold text-cyan-400 uppercase flex items-center gap-2"
          >
            <i className="fa-solid fa-scroll" aria-hidden="true" /> Журнал партии
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition"
            aria-label="Закрыть журнал"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">
            Пока пусто — события появятся по ходу партии.
          </p>
        ) : (
          <ul className="space-y-1 overflow-y-auto modal-scroll flex-1 min-h-0 pr-1">
            {rows.map((event, idx) => (
              <li
                key={`${event.at}-${event.type}-${idx}`}
                className="flex gap-3 items-start px-2 py-2 rounded-lg hover:bg-slate-950/80"
              >
                <span className="font-mono text-[11px] text-slate-500 tabular-nums pt-0.5 flex-shrink-0 w-16">
                  {formatClock(event.at)}
                </span>
                <span className="text-sm text-slate-200 leading-snug">
                  {formatGameEvent(event, players)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
