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
                                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-4 shadow-lg flex flex-col h-auto">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                                        <h2 className="font-orbitron font-bold text-base md:text-lg text-blue-400 uppercase flex items-center gap-2">
                                                            <i className="fa-solid fa-list-check"></i>
                                                            <span>Этап I (1 ПО)</span>
                                                        </h2>
                                                        <span className="text-xs text-slate-500 font-mono font-bold">
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
                                                                    className={`bg-slate-950 rounded-2xl border transition-all duration-300 ease-in-out ${isCompletedByAll
                                                                        ? 'border-emerald-500/40 p-3 bg-emerald-950/10'
                                                                        : 'border-slate-800/80 p-4 space-y-3'
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

                                                                                return (
                                                                                    <button
                                                                                        key={p.id}
                                                                                        type="button"
                                                                                        disabled={!canToggleFor(p.id)}
                                                                                        onClick={() => onObjectiveClick(p.id, obj.id)}
                                                                                        style={{
                                                                                            borderColor: isDone ? (isBlack ? '#ffffff' : pColor) : undefined,
                                                                                        }}
                                                                                        className={`px-2 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 active:scale-95 flex items-center justify-between gap-1 border ${isDone
                                                                                            ? 'bg-slate-900 text-white shadow-md'
                                                                                            : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                                                                                            } ${isDone && isBlack ? 'ring-2 ring-white/80' : ''} ${!canToggleFor(p.id) ? 'opacity-70 cursor-default' : ''}`}
                                                                                    >
                                                                                        <span className="truncate">{p.name}</span>
                                                                                        {isDone && (
                                                                                            <span
                                                                                                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-black font-extrabold flex-shrink-0"
                                                                                                style={{ backgroundColor: isBlack ? '#ffffff' : pColor }}
                                                                                            >
                                                                                                ✓
                                                                                            </span>
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
                                                            className="w-full py-3 bg-slate-950/60 hover:bg-slate-800/40 border border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl text-slate-500 hover:text-blue-400 text-xs font-bold transition flex items-center justify-center gap-2"
                                                        >
                                                            <span className="text-base">+</span>
                                                            <span>Открыть случайную цель I этапа</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={addCustomObjective}
                                                        className="w-full py-2 bg-transparent text-slate-600 hover:text-amber-400 text-xs font-semibold transition"
                                                    >
                                                        + Ввести свою цель вручную
                                                    </button>
                                                </div>
                                                )}
                                            </div>

                                            {/* ПРАВЫЙ СТОЛБЕЦ: ЭТАП II (2 ПО) */}
                                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-4 shadow-lg flex flex-col h-auto">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                                        <h2 className="font-orbitron font-bold text-base md:text-lg text-rose-400 uppercase flex items-center gap-2">
                                                            <i className="fa-solid fa-list-check"></i>
                                                            <span>Этап II (2 ПО)</span>
                                                        </h2>
                                                        <span className="text-xs text-slate-500 font-mono font-bold">
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
                                                                    className={`bg-slate-950 rounded-2xl border transition-all duration-300 ease-in-out ${isCompletedByAll
                                                                        ? 'border-emerald-500/40 p-3 bg-emerald-950/10'
                                                                        : 'border-slate-800/80 p-4 space-y-3'
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

                                                                                return (
                                                                                    <button
                                                                                        key={p.id}
                                                                                        type="button"
                                                                                        disabled={!canToggleFor(p.id)}
                                                                                        onClick={() => onObjectiveClick(p.id, obj.id)}
                                                                                        style={{
                                                                                            borderColor: isDone ? (isBlack ? '#ffffff' : pColor) : undefined,
                                                                                        }}
                                                                                        className={`px-2 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-200 active:scale-95 flex items-center justify-between gap-1 border ${isDone
                                                                                            ? 'bg-slate-900 text-white shadow-md'
                                                                                            : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                                                                                            } ${isDone && isBlack ? 'ring-2 ring-white/80' : ''} ${!canToggleFor(p.id) ? 'opacity-70 cursor-default' : ''}`}
                                                                                    >
                                                                                        <span className="truncate">{p.name}</span>
                                                                                        {isDone && (
                                                                                            <span
                                                                                                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-black font-extrabold flex-shrink-0"
                                                                                                style={{ backgroundColor: isBlack ? '#ffffff' : pColor }}
                                                                                            >
                                                                                                ✓
                                                                                            </span>
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
                                                            className="w-full py-3 bg-slate-950/60 hover:bg-slate-800/40 border border-dashed border-slate-800 hover:border-rose-500/50 rounded-2xl text-slate-500 hover:text-rose-400 text-xs font-bold transition flex items-center justify-center gap-2"
                                                        >
                                                            <span className="text-base">+</span>
                                                            <span>Открыть случайную цель II этапа</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={addCustomObjective}
                                                        className="w-full py-2 bg-transparent text-slate-600 hover:text-amber-400 text-xs font-semibold transition"
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
