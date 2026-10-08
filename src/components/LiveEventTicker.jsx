import { useMemo } from 'react';
import { formatGameEvent } from '../game/gameEvents';

/**
 * Compact live feed of recent game.log events for mobile consoles.
 */
export function LiveEventTicker({ events = [], limit = 6, className = '' }) {
  const rows = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    return list.slice(-limit).reverse().map((ev, idx) => {
      const text = typeof ev === 'string'
        ? ev
        : (ev.text || formatGameEvent(ev) || ev.type || '—');
      return {
        key: `${ev?.id || ev?.ts || idx}-${idx}`,
        text,
        round: ev?.roundNumber ?? ev?.round ?? null,
      };
    });
  }, [events, limit]);

  if (!rows.length) return null;

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-950/80 ${className}`}
      aria-label="Последние события"
    >
      <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <i className="fa-solid fa-bolt" aria-hidden="true" />
        Лента
      </div>
      <ul className="max-h-36 overflow-y-auto px-3 pb-2 space-y-1.5 modal-scroll">
        {rows.map((row) => (
          <li key={row.key} className="text-[11px] text-slate-300 leading-snug">
            {row.round != null && (
              <span className="text-slate-600 font-mono mr-1">R{row.round}</span>
            )}
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
