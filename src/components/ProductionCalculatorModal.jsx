import { useEffect, useMemo, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  PRODUCTION_UNITS,
  countOwnedUnitUpgrades,
  productionTotals,
  unitBatchSize,
  unitCostForPlayer,
  unitImageUrl,
  unitResourceCost,
  unitSlotCount,
} from '../data/units';

const emptyCounts = () => Object.fromEntries(PRODUCTION_UNITS.map(u => [u.id, 0]));

/**
 * Local (unsynced) production calculator: add units, see count + resource cost.
 * Applies Sarween Tools / AI Development Algorithm / Muaat War Sun II when techIds known.
 */
export function ProductionCalculatorModal({
  show,
  playerColor,
  playerName,
  factionId = null,
  techIds = [],
  onClose,
}) {
  const [counts, setCounts] = useState(emptyCounts);
  const owned = useMemo(
    () => (Array.isArray(techIds) ? techIds : []),
    [techIds],
  );
  const hasSarween = owned.includes('sarween_tools');
  const hasAiAlgo = owned.includes('ai_development_algorithm');
  const unitUpgradeCount = useMemo(() => countOwnedUnitUpgrades(owned), [owned]);
  const [applyAiAlgorithm, setApplyAiAlgorithm] = useState(true);

  useEscapeKey(onClose, show);
  useBodyScrollLock(show);

  useEffect(() => {
    if (show) setApplyAiAlgorithm(true);
  }, [show, hasAiAlgo]);

  const costOpts = useMemo(
    () => ({ factionId, techIds: owned }),
    [factionId, owned],
  );

  const totals = useMemo(
    () => productionTotals(counts, {
      ...costOpts,
      applyAiAlgorithm: hasAiAlgo && applyAiAlgorithm,
    }),
    [counts, costOpts, hasAiAlgo, applyAiAlgorithm],
  );

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
      className="fixed inset-0 z-[58] game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-md:h-full md:max-h-[92vh] game-modal-panel md:!rounded-2xl flex flex-col overflow-hidden !rounded-none md:!rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="production-calc-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--game-line)] bg-black/30">
          <div className="min-w-0">
            <h2 id="production-calc-title" className="game-modal-title text-base md:text-lg uppercase truncate">
              Калькулятор производства
            </h2>
            <p className="text-xs text-[var(--game-muted)] mt-0.5 truncate">
              {playerName ? `${playerName} · ` : ''}
              Добавляйте отряды — считаем количество и цену
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={reset}
              className="game-btn-ghost !h-10 !px-3 !text-xs"
              title="Сбросить"
            >
              Сброс
            </button>
            <button
              type="button"
              onClick={onClose}
              className="game-btn-ghost !w-10 !h-10 !px-0"
              aria-label="Закрыть"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        </div>

        {(hasSarween || hasAiAlgo) && (
          <div className="px-4 py-2.5 border-b border-[var(--game-line)] bg-black/20 space-y-2">
            {hasSarween && (
              <div className="text-xs text-[var(--game-gold-bright)] font-semibold flex items-center gap-2">
                <i className="fa-solid fa-wrench" aria-hidden="true" />
                Sarween Tools: −1⚙ к суммарной стоимости
              </div>
            )}
            {hasAiAlgo && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyAiAlgorithm}
                  onChange={(e) => setApplyAiAlgorithm(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[var(--game-line)] bg-black/40 text-[var(--game-gold)] focus:ring-[var(--game-gold)]/40"
                />
                <span className="text-xs text-[var(--game-text)] font-semibold leading-snug">
                  AI Development Algorithm
                  <span className="block text-[var(--game-muted)] font-normal mt-0.5">
                    −{unitUpgradeCount}⚙ (по 1 за каждый unit upgrade).
                    Снимите галочку, если карта уже истощена.
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 modal-scroll">
          {PRODUCTION_UNITS.map((unit) => {
            const count = counts[unit.id] || 0;
            const slots = unitSlotCount(unit, count);
            const unitCost = unitCostForPlayer(unit, costOpts);
            const lineCost = unitResourceCost(unit, count, costOpts);
            const batch = unitBatchSize(unit);
            const muaatWs = unit.id === 'warsun'
              && factionId === 'muaat'
              && owned.includes('prototype_war_sun_2');
            return (
              <div
                key={unit.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--game-line)] bg-black/35 px-3 py-2.5"
              >
                <img
                  src={unitImageUrl(unit, playerColor)}
                  alt={unit.name}
                  className="w-12 h-12 md:w-14 md:h-14 object-contain flex-shrink-0 drop-shadow"
                  draggable={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--game-text)] text-sm md:text-base truncate">{unit.name}</div>
                  <div className="text-[11px] text-[var(--game-muted)] font-semibold">
                    {batch > 1
                      ? `+${batch} шт · ${unitCost}⚙ / отряд`
                      : `${unitCost}⚙`}
                    {muaatWs && (
                      <span className="text-[var(--game-gold-bright)] ml-1.5">(Prototype II)</span>
                    )}
                    {count > 0 && (
                      <span className="text-[var(--game-gold-bright)] ml-2">
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
                    className="w-10 h-10 rounded-xl bg-black/50 border border-[var(--game-line)] text-[var(--game-text)] font-black text-lg disabled:opacity-40 active:scale-95"
                    aria-label={`Убрать ${unit.name}`}
                  >
                    −
                  </button>
                  <div className="w-9 text-center font-orbitron font-black text-lg text-[var(--game-gold-bright)] tabular-nums">
                    {count}
                  </div>
                  <button
                    type="button"
                    onClick={() => bump(unit.id, 1)}
                    className="game-btn-primary !w-10 !h-10 !p-0 !text-lg"
                    aria-label={`Добавить ${unit.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[var(--game-line-gold)] bg-black/35 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--game-muted)]">Отрядов</div>
            <div className="font-orbitron font-black text-2xl text-[var(--game-text)] tabular-nums">{totals.units}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--game-muted)]">Ресурсы</div>
            {totals.discount > 0 && (
              <div className="text-[11px] text-[var(--game-muted)] tabular-nums">
                {totals.baseResources}⚙ − {totals.discount}⚙ скидка
              </div>
            )}
            <div className="font-orbitron font-black text-2xl text-[var(--game-gold-bright)] tabular-nums">{totals.resources}⚙</div>
          </div>
        </div>
      </div>
    </div>
  );
}
