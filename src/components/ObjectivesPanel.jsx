import { useEffect, useRef } from 'react';
import objStage1Bg from '../assets/objectives/stage1-bg.jpg';
import objStage2Bg from '../assets/objectives/stage2-bg.jpg';

const OBJ_STAGE_BG = {
  1: objStage1Bg,
  2: objStage2Bg,
};

/** Public stage I / II objectives columns for the main board. */
export function ObjectivesPanel({
  objectives,
  completions,
  expandedObjectives,
  toggleExpand,
  removeObjective,
  addRandomObjective,
  addCustomObjective,
  players,
  canAdminBoard,
  canToggleFor,
  onObjectiveClick,
  spotlightObjectiveId = null,
  spotlightReady = false,
}) {
  const spotlightRef = useRef(null);

  useEffect(() => {
    if (!spotlightObjectiveId || !spotlightReady || !spotlightRef.current) return;
    spotlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [spotlightObjectiveId, spotlightReady]);

  const renderSeats = (obj) => (
    <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
      {players.map((p) => {
        const isDone = !!completions[`${p.id}_${obj.id}`];
        const pColor = p.color || '#3b82f6';
        const isBlack =
          pColor.toLowerCase() === '#000000' ||
          pColor.toLowerCase() === '#000' ||
          pColor.toLowerCase() === 'black';
        const accent = isBlack ? '#94a3b8' : pColor;

        return (
          <button
            key={p.id}
            type="button"
            disabled={!canToggleFor(p.id)}
            onClick={() => onObjectiveClick(p.id, obj.id)}
            style={{ '--player-accent': accent }}
            className={`game-obj-seat text-xs md:text-sm active:scale-95 ${
              isDone ? 'is-done' : ''
            } ${!canToggleFor(p.id) ? 'opacity-70 cursor-default' : ''}`}
          >
            <span className="truncate flex-1 text-left">{p.name}</span>
            {isDone && (
              <span className="game-obj-seat-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderStageColumn = (stage, title) => {
    const stageObjectives = objectives.filter((o) => o.stage === stage);
    const officialCount = stageObjectives.filter((o) => !o.extra).length;
    const extraCount = stageObjectives.length - officialCount;
    return (
      <div className={`game-obj-col ${stage === 1 ? 'is-stage1' : 'is-stage2'}`}>
        <div className="space-y-4">
          <div className="game-obj-head flex justify-between items-center border-b pb-3">
            <h2 className="game-obj-title text-base md:text-lg">
              <i className="fa-solid fa-list-check" aria-hidden="true" />
              <span>{title}</span>
            </h2>
            <span className="game-obj-count">
              {officialCount} / 5
              {extraCount > 0 ? ` · +${extraCount}` : ''}
            </span>
          </div>

          <div className="space-y-3">
            {stageObjectives.map((obj) => {
              const isCompletedByAll =
                players.length > 0 &&
                players.every((p) => !!completions[`${p.id}_${obj.id}`]);
              const isExpanded = expandedObjectives[obj.id] ?? !isCompletedByAll;

              const isRevealTarget = spotlightObjectiveId != null && obj.id === spotlightObjectiveId;
              const revealClass = isRevealTarget
                ? (spotlightReady ? ' is-spotlight' : ' is-reveal-pending')
                : '';

              return (
                <div
                  ref={isRevealTarget && spotlightReady ? spotlightRef : undefined}
                  title={obj.desc}
                  key={obj.id}
                  className={`game-obj-card is-stage${stage} transition-all duration-300 ease-in-out ${
                    isCompletedByAll ? 'is-done p-3' : 'p-4 space-y-3'
                  }${revealClass}`}
                  style={{ '--game-obj-bg': `url(${OBJ_STAGE_BG[stage]})` }}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div
                      onClick={() => toggleExpand(obj.id)}
                      className="flex items-center gap-2 truncate cursor-pointer select-none flex-1"
                    >
                      {isCompletedByAll && (
                        <span className="text-emerald-400 font-bold text-xs flex-shrink-0 animate-pulse">
                          ✓ Все
                        </span>
                      )}
                      <p
                        className={`text-sm md:text-base font-bold leading-snug transition-all duration-300 ${
                          isCompletedByAll && !isExpanded
                            ? 'text-slate-400 line-through text-xs decoration-slate-600'
                            : 'text-slate-100'
                        }`}
                      >
                        {obj.extra && (
                          <span className="game-obj-extra-tag" title="Дополнительная цель хоста">
                            доп.
                          </span>
                        )}
                        {obj.desc}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isCompletedByAll && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(obj.id)}
                          className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 transition"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                      {canAdminBoard && (
                        <button
                          type="button"
                          onClick={() => removeObjective(obj.id)}
                          className="text-slate-600 hover:text-red-400 text-sm p-1 transition"
                          title="Убрать цель и открыть следующую из колоды"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isExpanded
                        ? 'max-h-96 opacity-100 pt-3 border-t border-slate-800/80'
                        : 'max-h-0 opacity-0 pt-0 border-t-0'
                    }`}
                  >
                    {renderSeats(obj)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {canAdminBoard && (
          <div className="mt-auto pt-4 space-y-2">
            {officialCount < 5 && (
              <button
                type="button"
                onClick={() => addRandomObjective(stage)}
                className="game-obj-add w-full py-3 border border-dashed rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span className="text-base">+</span>
                <span>
                  Открыть случайную цель {stage === 1 ? 'I' : 'II'} этапа
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => addCustomObjective(stage)}
              className="game-obj-manual w-full py-2 bg-transparent text-xs font-semibold transition"
            >
              + Ввести цель вручную
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="lg:col-span-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {renderStageColumn(1, 'Этап I • Цели')}
        {renderStageColumn(2, 'Этап II • Цели')}
      </div>
    </section>
  );
}
