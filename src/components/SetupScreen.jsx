import { ALL_FACTIONS } from '../data/gameData';

function readSnapshots() {
  try {
    const raw = localStorage.getItem('ti4_snapshots');
    const snapshots = raw ? JSON.parse(raw) : [];
    return Array.isArray(snapshots) ? snapshots : [];
  } catch {
    return [];
  }
}

export function SetupScreen({
  targetScore, setTargetScore, usePok, setUsePok, useTe, setUseTe,
  players, setPlayers, addPlayer, removePlayer, availableFactions,
  isFactionTaken, isColorTaken, importGameToken, restoreSnapshot,
  handleStartGame,
}) {
  return (
                            <div className="max-w-5xl mx-auto space-y-8">

                                {/* Параметры партии */}
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5">
                                    <h2 className="font-orbitron font-bold text-lg text-amber-400 uppercase flex items-center gap-2">
                                        <i className="fa-solid fa-sliders"></i> Параметры Партии
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Цель Победных Очков (ПО):</label>
                                            <div className="flex gap-3">
                                                {[10, 12, 14].map(score => (
                                                    <button
                                                        key={score}
                                                        onClick={() => setTargetScore(score)}
                                                        className={`flex-1 py-3 rounded-xl font-orbitron font-black text-base border transition ${targetScore === score ? 'bg-amber-500 text-black border-amber-400 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                                                        {score} ПО
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                                            <label className="text-xs font-bold text-slate-400 uppercase">Используемые Дополнения:</label>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setUsePok(!usePok)}
                                                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm border flex items-center justify-between transition ${usePok ? 'bg-purple-950 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                                    <span>Prophecy of Kings</span>
                                                    <i className={`fa-solid ${usePok ? 'fa-check-circle text-purple-400' : 'fa-circle text-slate-700'}`}></i>
                                                </button>
                                                <button
                                                    onClick={() => setUseTe(!useTe)}
                                                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm border flex items-center justify-between transition ${useTe ? 'bg-amber-950 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                                    <span>Thunder's Edge</span>
                                                    <i className={`fa-solid ${useTe ? 'fa-check-circle text-amber-400' : 'fa-circle text-slate-700'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Выбор игроков и фракций */}
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-orbitron font-bold text-lg text-cyan-400 uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-users"></i> Игроки и Фракции ({players.length})
                                        </h2>
                                        {players.length < 8 && (
                                            <button onClick={addPlayer} className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs md:text-sm transition flex items-center gap-2">
                                                <i className="fa-solid fa-user-plus"></i> Добавить игрока
                                            </button>
                                        )}
                                    </div>

                                    {players.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 font-orbitron text-sm border border-dashed border-slate-800 rounded-2xl">
                                            Нажмите «Добавить игрока», чтобы начать настройку партии
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {players.map((p, idx) => {
                                                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);

                                                return (
                                                    <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 relative">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="font-orbitron font-bold text-sm text-slate-500">#{idx + 1}</span>
                                                            <input
                                                                type="text"
                                                                value={p.name}
                                                                onChange={(e) => setPlayers(players.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                                                                className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl font-bold text-base text-white focus:outline-none focus:border-cyan-400 flex-grow"
                                                            />
                                                            <button onClick={() => removePlayer(p.id)} className="text-slate-600 hover:text-red-400 p-1.5 transition">
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        </div>

                                                        <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                                            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                                                                <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="flex-grow">
                                                                <div className="text-[10px] uppercase font-bold text-slate-500">Фракция:</div>
                                                                <select
                                                                    value={p.factionId}
                                                                    onChange={(e) => setPlayers(players.map(x => x.id === p.id ? { ...x, factionId: e.target.value } : x))}
                                                                    className="bg-transparent text-sm font-bold text-amber-400 focus:outline-none w-full">
                                                                    {availableFactions.map(f => (
                                                                        <option
                                                                            key={f.id}
                                                                            value={f.id}
                                                                            disabled={isFactionTaken(f.id, p.id)}
                                                                            className="bg-slate-900 text-white"
                                                                        >
                                                                            {f.name}{isFactionTaken(f.id, p.id) ? " 🔒" : ""}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Выбор цвета игрока c проверкой занятости */}
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                Цвет: {!p.color && <span className="text-red-400 ml-1">(обязательно)</span>}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {[
                                                                    { name: 'Красный', hex: '#ef4444' },
                                                                    { name: 'Синий', hex: '#3b82f6' },
                                                                    { name: 'Зеленый', hex: '#22c55e' },
                                                                    { name: 'Желтый', hex: '#eab308' },
                                                                    { name: 'Фиолетовый', hex: '#a855f7' },
                                                                    { name: 'Оранжевый', hex: '#f97316' },
                                                                    { name: 'Розовый', hex: '#ec4899' },
                                                                    { name: 'Черный', hex: '#000000', border: '#64748b' }
                                                                ].map(c => {
                                                                    const taken = isColorTaken(c.hex, p.id);
                                                                    if (taken) return null;
                                                                    const isSelected = p.color === c.hex;

                                                                    return (
                                                                        <button
                                                                            key={c.hex}
                                                                            type="button"
                                                                            onClick={() => setPlayers(players.map(x => x.id === p.id ? { ...x, color: c.hex } : x))}
                                                                            className={`w-5 h-5 rounded-full transition transform ${isSelected
                                                                                ? 'scale-125 ring-2 ring-cyan-400 shadow-lg'
                                                                                : taken
                                                                                    ? 'opacity-20 cursor-not-allowed'
                                                                                    : 'opacity-60 hover:opacity-100'
                                                                                }`}
                                                                            style={{
                                                                                backgroundColor: c.hex,
                                                                                border: c.border ? `1px solid ${c.border}` : '1px solid rgba(255,255,255,0.2)'
                                                                            }}
                                                                            title={taken ? `${c.name} (Занят)` : c.name}
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Блок Импорта по коду и Автосохранений */}
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                                    <h2 className="font-orbitron font-bold text-lg text-cyan-400 uppercase flex items-center gap-2">
                                        <i className="fa-solid fa-download"></i> Загрузка и Восстановление
                                    </h2>

                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            id="importTokenInput"
                                            placeholder="Вставьте код партии (Base64)..."
                                            className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs md:text-sm text-white focus:outline-none focus:border-cyan-400 flex-grow"
                                        />
                                        <button
                                            onClick={() => {
                                                const input = document.getElementById('importTokenInput');
                                                importGameToken(input.value);
                                            }}
                                            className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition font-orbitron uppercase"
                                        >
                                            Загрузить
                                        </button>
                                    </div>

                                    {(() => {
                                        const snaps = readSnapshots();
                                        if (snaps.length === 0) return null;
                                        return (
                                            <div className="pt-2 border-t border-slate-800/80 space-y-2">
                                                <div className="text-xs font-bold text-slate-400 uppercase">Последние автосохранения:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {snaps.map((s, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => restoreSnapshot(s)}
                                                            className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                                                        >
                                                            <i className="fa-solid fa-clock-rotate-left text-amber-400"></i>
                                                            <span>Раунд {s.roundNumber} ({s.timestamp})</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* КНОПКА СТАРТА */}
                                <button
                                    onClick={handleStartGame}
                                    className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-black font-orbitron font-black text-xl py-5 rounded-3xl shadow-xl hover:opacity-95 transition transform active:scale-95 uppercase tracking-wider flex items-center justify-center gap-3">
                                    <i className="fa-solid fa-play"></i> Начать партию
                                </button>

                            </div>
  );
}
