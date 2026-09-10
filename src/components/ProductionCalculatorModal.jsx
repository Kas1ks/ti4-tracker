import { useMemo, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  PRODUCTION_UNITS,
  productionTotals,
  unitBatchSize,
  unitImageUrl,
  unitResourceCost,
  unitSlotCount,
} from '../data/units';

const emptyCounts = () => Object.fromEntries(PRODUCTION_UNITS.map(u => [u.id, 0]));

/**
 * Local (unsynced) production calculator: add units, see count + resource cost.
 */
export function ProductionCalculatorModal({
  show,
  playerColor,
  playerName,
  onClose,
}) {
  const [counts, setCounts] = useState(emptyCounts);

  useEscapeKey(onClose, show);
  useBodyScrollLock(show);

  const totals = useMemo(() => productionTotals(counts), [counts]);

  if (!show) return null;

  const bump = (id, deltaSteps) => {
    const unit = PRODUCTION_UNITS.find(u => u.id === id);
    if (!unit) return;
    const step = unitBatchSize(unit);
    setCounts((prev) => {
      const next = Math.max(0, (prev[id] || 0) + deltaSteps * step);
      return { ...prev, [id]: next };
    });
  };

  const reset = () => setCounts(emptyCounts());

  return (
    <div
      className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-md:h-full md:max-h-[92vh] bg-slate-950 border border-cyan-700/50 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="production-calc-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="min-w-0">
            <h2 id="production-calc-title" className="font-orbitron font-black text-base md:text-lg text-cyan-300 uppercase tracking-wide truncate">
              Калькулятор производства
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {playerName ? `${playerName} · ` : ''}
              Добавляйте отряды — считаем количество и цену
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={reset}
              className="h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold"
              title="Сбросить"
            >
              Сброс
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Закрыть"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
          {PRODUCTION_UNITS.map((unit) => {
            const count = counts[unit.id] || 0;
            const slots = unitSlotCount(unit, count);
            const lineCost = unitResourceCost(unit, count);
            const batch = unitBatchSize(unit);
            return (
              <div
                key={unit.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2.5"
              >
                <img
                  src={unitImageUrl(unit, playerColor)}
                  alt={unit.name}
                  className="w-12 h-12 md:w-14 md:h-14 object-contain flex-shrink-0 drop-shadow"
                  draggable={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-sm md:text-base truncate">{unit.name}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">
                    {batch > 1
                      ? `+${batch} шт · ${unit.cost}⚙ / отряд`
                      : `${unit.cost}⚙`}
                    {count > 0 && (
                      <span className="text-cyan-400/90 ml-2">
                        {slots} отр. · {lineCost}⚙
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => bump(unit.id, -1)}
                    disabled={count <= 0}
                    className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-black text-lg disabled:opacity-40 active:scale-95"
                    aria-label={`Убрать ${unit.name}`}
                  >
                    −
                  </button>
                  <div className="w-9 text-center font-orbitron font-black text-lg text-amber-300 tabular-nums">
                    {count}
                  </div>
                  <button
                    type="button"
                    onClick={() => bump(unit.id, 1)}
                    className="w-10 h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 border border-cyan-400 text-black font-black text-lg active:scale-95"
                    aria-label={`Добавить ${unit.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-800 bg-slate-900/90 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Отрядов</div>
            <div className="font-orbitron font-black text-2xl text-white tabular-nums">{totals.units}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Ресурсы</div>
            <div className="font-orbitron font-black text-2xl text-cyan-300 tabular-nums">{totals.resources}⚙</div>
          </div>
        </div>
      </div>
    </div>
  );
}
