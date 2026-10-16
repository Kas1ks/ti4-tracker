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
}) {
  return (
                                    <section className="lg:col-span-8">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

                                            {/* ЛЕВЫЙ СТОЛБЕЦ: ЭТАП I (1 ПО) */}
                                            <div className="game-obj-col is-stage1">
                                                <div className="space-y-4">
                                                    <div className="game-obj-head flex justify-between items-center border-b pb-3">
                                                        <h2 className="game-obj-title text-base md:text-lg">
                                                            <i className="fa-solid fa-list-check" aria-hidden="true" />
                                                            <span>Этап I (1 ПО)</span>
                                                        </h2>
                                                        <span className="text-xs text-[var(--game-muted)] font-mono font-bold">
                                                            {objectives.filter(o => o.stage === 1).length} / 5
                                                        </span>
                                                    </div>

                                                    {/* Список задач 1 этапа */}
                                                    <div className="space-y-3">
                                                        {objectives.filter(o => o.stage === 1).map(obj => {
                                                            const isCompletedByAll = players.length > 0 && players.every(p => !!completions[`${p.id}_${obj.id}`]);
                                                            const isExpanded = expandedObjectives[obj.id] ?? !isCompletedByAll;

                                                            return (
                                                                <div
                                                                    title={obj.desc}
                                                                    key={obj.id}
                                                                    className={`game-obj-card transition-all duration-300 ease-in-out ${isCompletedByAll
                                                                        ? 'is-done p-3'
                                                                        : 'p-4 space-y-3'
                                                                        }`}
                                                                >
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <div
                                                                            onClick={() => toggleExpand(obj.id)}
                                                                            className="flex items-center gap-2 truncate cursor-pointer select-none flex-1"
                                                                        >
                                                                            {isCompletedByAll && (
                                                                                <span className="text-emerald-400 font-bold text-xs flex-shrink-0 animate-pulse">✓ Все</span>
                                                                            )}
                                                                            <p className={`text-sm md:text-base font-bold leading-snug transition-all duration-300 ${isCompletedByAll && !isExpanded ? 'text-slate-400 line-through text-xs decoration-slate-600' : 'text-slate-100'
                                                                                }`}>
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

                                                                    {/* Плавно скрываемая/раскрываемая сетка игроков */}
                                                                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100 pt-3 border-t border-slate-800/80' : 'max-h-0 opacity-0 pt-0 border-t-0'
                                                                        }`}>
                                                                        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
                                                                            {players.map(p => {
                                                                                const isDone = !!completions[`${p.id}_${obj.id}`];
                                                                                const pColor = p.color || '#3b82f6';
                                                                                const isBlack = pColor.toLowerCase() === '#000000' || pColor.toLowerCase() === '#000' || pColor.toLowerCase() === 'black';
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
                                                                                        <span className="truncate">{p.name}</span>
                                                                                        {isDone && (
                                                                                            <span className="game-obj-seat-check" aria-hidden="true">✓</span>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Кнопка добавления внизу столбца */}
                                                {canAdminBoard && (
                                                <div className="mt-auto pt-4 space-y-2">
                                                    {objectives.filter(o => o.stage === 1).length < 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => addRandomObjective(1)}
                                                            className="game-obj-add w-full py-3 border border-dashed rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
                                                        >
                                                            <span className="text-base">+</span>
                                                            <span>Открыть случайную цель I этапа</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={addCustomObjective}
                                                        className="game-obj-manual w-full py-2 bg-transparent text-xs font-semibold transition"
                                                    >
                                                        + Ввести свою цель вручную
                                                    </button>
                                                </div>
                                                )}
                                            </div>

                                            {/* ПРАВЫЙ СТОЛБЕЦ: ЭТАП II (2 ПО) */}
                                            <div className="game-obj-col is-stage2">
                                                <div className="space-y-4">
                                                    <div className="game-obj-head flex justify-between items-center border-b pb-3">
                                                        <h2 className="game-obj-title text-base md:text-lg">
                                                            <i className="fa-solid fa-list-check" aria-hidden="true" />
                                                            <span>Этап II (2 ПО)</span>
                                                        </h2>
                                                        <span className="text-xs text-[var(--game-muted)] font-mono font-bold">
                                                            {objectives.filter(o => o.stage === 2).length} / 5
                                                        </span>
                                                    </div>

                                                    {/* Список задач 2 этапа */}
                                                    <div className="space-y-3">
                                                        {objectives.filter(o => o.stage === 2).map(obj => {
                                                            const isCompletedByAll = players.length > 0 && players.every(p => !!completions[`${p.id}_${obj.id}`]);
                                                            const isExpanded = expandedObjectives[obj.id] ?? !isCompletedByAll;

                                                            return (
                                                                <div
                                                                    title={obj.desc}
                                                                    key={obj.id}
                                                                    className={`game-obj-card transition-all duration-300 ease-in-out ${isCompletedByAll
                                                                        ? 'is-done p-3'
                                                                        : 'p-4 space-y-3'
                                                                        }`}
                                                                >
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <div
                                                                            onClick={() => toggleExpand(obj.id)}
                                                                            className="flex items-center gap-2 truncate cursor-pointer select-none flex-1"
                                                                        >
                                                                            {isCompletedByAll && (
                                                                                <span className="text-emerald-400 font-bold text-xs flex-shrink-0 animate-pulse">✓ Все</span>
                                                                            )}
                                                                            <p className={`text-sm md:text-base font-bold leading-snug transition-all duration-300 ${isCompletedByAll && !isExpanded ? 'text-slate-400 line-through text-xs decoration-slate-600' : 'text-slate-100'
                                                                                }`}>
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

                                                                    {/* Плавно скрываемая/раскрываемая сетка игроков */}
                                                                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100 pt-3 border-t border-slate-800/80' : 'max-h-0 opacity-0 pt-0 border-t-0'
                                                                        }`}>
                                                                        <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2">
                                                                            {players.map(p => {
                                                                                const isDone = !!completions[`${p.id}_${obj.id}`];
                                                                                const pColor = p.color || '#ef4444';
                                                                                const isBlack = pColor.toLowerCase() === '#000000' || pColor.toLowerCase() === '#000' || pColor.toLowerCase() === 'black';
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
                                                                                        <span className="truncate">{p.name}</span>
                                                                                        {isDone && (
                                                                                            <span className="game-obj-seat-check" aria-hidden="true">✓</span>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Кнопка добавления внизу столбца */}
                                                {canAdminBoard && (
                                                <div className="mt-auto pt-4 space-y-2">
                                                    {objectives.filter(o => o.stage === 2).length < 5 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => addRandomObjective(2)}
                                                            className="game-obj-add w-full py-3 border border-dashed rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
                                                        >
                                                            <span className="text-base">+</span>
                                                            <span>Открыть случайную цель II этапа</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={addCustomObjective}
                                                        className="game-obj-manual w-full py-2 bg-transparent text-xs font-semibold transition"
                                                    >
                                                        + Ввести свою цель вручную
                                                    </button>
                                                </div>
                                                )}
                                            </div>

                                        </div>
                                    </section>
  );
}
