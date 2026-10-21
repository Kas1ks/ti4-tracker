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
        className="game-hud-chassis combat-pick-shell game-prod-shell w-full max-md:h-full max-md:overflow-y-auto modal-scroll"
        role="dialog"
        aria-modal="true"
        aria-labelledby="production-calc-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="combat-pick-inner game-prod-inner">
          <div className="game-prod-head">
            <div className="game-prod-head-text min-w-0">
              <h2 id="production-calc-title" className="game-modal-title game-prod-title">
                <i className="fa-solid fa-compass-drafting" aria-hidden="true" />
                Калькулятор производства
              </h2>
              <p className="game-prod-sub">
                {playerName ? `${playerName} · ` : ''}
                Добавляйте отряды — считаем количество и цену
              </p>
            </div>
            <div className="game-prod-head-actions">
              <button type="button" onClick={reset} className="game-prod-reset" title="Сбросить">
                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                Сброс
              </button>
              <button type="button" onClick={onClose} className="game-prod-close" aria-label="Закрыть">
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
          </div>

          {(hasSarween || hasAiAlgo) && (
            <div className="game-prod-tech">
              {hasSarween && (
                <div className="game-prod-tech-line">
                  <i className="fa-solid fa-wrench" aria-hidden="true" />
                  <span>
                    Sarween Tools: −1 <i className="fa-solid fa-gear" aria-hidden="true" /> к суммарной стоимости
                  </span>
                </div>
              )}
              {hasAiAlgo && (
                <label className="game-prod-tech-ai">
                  <input
                    type="checkbox"
                    checked={applyAiAlgorithm}
                    onChange={(e) => setApplyAiAlgorithm(e.target.checked)}
                  />
                  <span>
                    <strong>AI Development Algorithm</strong>
                    <em>
                      −{unitUpgradeCount} <i className="fa-solid fa-gear" aria-hidden="true" />{' '}
                      (по 1 за каждый unit upgrade). Снимите галочку, если карта уже истощена.
                    </em>
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="game-prod-list">
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
                <div key={unit.id} className="game-prod-row">
                  <img
                    src={unitImageUrl(unit, playerColor)}
                    alt=""
                    className="game-prod-row-icon"
                    draggable={false}
                  />
                  <div className="game-prod-row-meta min-w-0">
                    <div className="game-prod-row-name truncate">{unit.name}</div>
                    <div className="game-prod-row-cost">
                      {batch > 1
                        ? `+${batch} шт · ${unitCost} `
                        : `${unitCost} `}
                      <i className="fa-solid fa-gear" aria-hidden="true" />
                      {batch > 1 ? ' / отряд' : ''}
                      {muaatWs && <span className="game-prod-row-note"> (Prototype II)</span>}
                      {count > 0 && (
                        <span className="game-prod-row-note">
                          {' '}· {slots} отр. · {lineCost} <i className="fa-solid fa-gear" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="game-prod-stepper">
                    <button
                      type="button"
                      onClick={() => bump(unit.id, -1)}
                      disabled={count <= 0}
                      className="game-prod-btn is-minus"
                      aria-label={`Убрать ${unit.name}`}
                    >
                      −
                    </button>
                    <div className="game-prod-count tabular-nums" title="Количество">
                      <span className="game-prod-unit-mark" aria-hidden="true" />
                      {count}
                    </div>
                    <button
                      type="button"
                      onClick={() => bump(unit.id, 1)}
                      className="game-prod-btn is-plus"
                      aria-label={`Добавить ${unit.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="game-prod-footer">
            <div className="game-prod-footer-cell">
              <span className="game-prod-footer-label">Отрядов</span>
              <span className="game-prod-footer-value">
                <span className="game-prod-unit-mark" aria-hidden="true" />
                {totals.units}
              </span>
            </div>
            <div className="game-prod-footer-divider" aria-hidden="true" />
            <div className="game-prod-footer-cell is-end">
              <span className="game-prod-footer-label">Ресурсы</span>
              <span className="game-prod-footer-value is-gold">
                {totals.discount > 0 && (
                  <span className="game-prod-footer-discount">
                    {totals.baseResources} − {totals.discount}
                  </span>
                )}
                <i className="fa-solid fa-gear" aria-hidden="true" />
                {totals.resources}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
