import { formatTime } from '../utils/game';
import { isCloudConfigured } from '../config';
import { useEscapeKey } from '../hooks/useEscapeKey';

export function StatsModal({ showStatsModal, setShowStatsModal, isStatsLoading, globalHistory, deleteSingleGame, clearAllStats }) {
  useEscapeKey(() => setShowStatsModal(false), showStatsModal);

  return (
    <>
{showStatsModal && (
                            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4" role="presentation">
                                <div
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="stats-modal-title"
                                  className="bg-slate-900 border border-purple-500/40 p-6 md:p-8 rounded-3xl max-w-4xl w-full space-y-6 shadow-[0_0_40px_rgba(168,85,247,0.2)] max-h-[90vh] overflow-y-auto relative"
                                >

                                    <button
                                        type="button"
                                        onClick={() => setShowStatsModal(false)}
                                        aria-label="Закрыть статистику"
                                        className="absolute top-5 right-5 text-slate-400 hover:text-white text-xl"
                                    >
                                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                                    </button>

                                    <div className="text-center space-y-1">
                                        <h3 id="stats-modal-title" className="font-orbitron font-black text-2xl md:text-3xl text-purple-400 uppercase">
                                          Статистика Компании
                                        </h3>
                                        <p className="text-xs md:text-sm text-slate-400">Зал славы, аналитика времени и мета фракций</p>
                                    </div>

                                    {isStatsLoading ? (
                                        <div className="text-center py-12 text-slate-400 font-orbitron">
                                            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-purple-400"></i>
                                            <div>Загрузка данных из облака...</div>
                                        </div>
                                    ) : globalHistory.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500">
                                            {isCloudConfigured
                                                ? 'История игр пока пуста. Завершите хотя бы одну партию!'
                                                : 'Облачная статистика выключена (VITE_CLOUD_ENABLED=false).'}
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                <h4 className="font-orbitron font-bold text-amber-400 text-sm uppercase mb-3 flex items-center gap-2">
                                                    <i className="fa-solid fa-crown"></i> Зал Славы (Игроки)
                                                </h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs md:text-sm">
                                                        <thead>
                                                            <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                                                                <th className="py-2">Игрок</th>
                                                                <th className="py-2 text-center">Игр</th>
                                                                <th className="py-2 text-center">Побед</th>
                                                                <th className="py-2 text-center">Винрейт</th>
                                                                <th className="py-2 text-right">Ср. время / ход</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {
                                                                const pMap = {};
                                                                globalHistory.forEach(g => {
                                                                    (g.players || []).forEach(p => {
                                                                        if (!pMap[p.name]) pMap[p.name] = { games: 0, wins: 0, totalSecs: 0, turnsCount: 0 };
                                                                        pMap[p.name].games += 1;
                                                                        if (p.isWinner) pMap[p.name].wins += 1;
                                                                        pMap[p.name].totalSecs += (p.totalTime || 0);
                                                                        pMap[p.name].turnsCount += (g.roundsCount || 1);
                                                                    });
                                                                });
                                                                return Object.entries(pMap)
                                                                    .sort((a, b) => (b[1].wins / b[1].games) - (a[1].wins / a[1].games))
                                                                    .map(([name, stat]) => {
                                                                        const wr = ((stat.wins / stat.games) * 100).toFixed(0);
                                                                        const avgTurnSecs = stat.turnsCount > 0 ? Math.round(stat.totalSecs / stat.turnsCount) : 0;
                                                                        return (
                                                                            <tr key={name} className="border-b border-slate-800/50">
                                                                                <td className="py-2.5 font-bold text-white">{name}</td>
                                                                                <td className="py-2.5 text-center text-slate-400">{stat.games}</td>
                                                                                <td className="py-2.5 text-center text-amber-400 font-bold">{stat.wins}</td>
                                                                                <td className="py-2.5 text-center font-orbitron font-bold text-cyan-400">{wr}%</td>
                                                                                <td className="py-2.5 text-right font-mono text-slate-300">{formatTime(avgTurnSecs)}</td>
                                                                            </tr>
                                                                        );
                                                                    });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                <h4 className="font-orbitron font-bold text-purple-400 text-sm uppercase mb-3 flex items-center gap-2">
                                                    <i className="fa-solid fa-planet-ringed"></i> Мета Фракций
                                                </h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs md:text-sm">
                                                        <thead>
                                                            <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                                                                <th className="py-2">Фракция</th>
                                                                <th className="py-2 text-center">Пиков</th>
                                                                <th className="py-2 text-center">Побед</th>
                                                                <th className="py-2 text-right">Винрейт</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {
                                                                const fMap = {};
                                                                globalHistory.forEach(g => {
                                                                    (g.players || []).forEach(p => {
                                                                        if (!p.faction) return;
                                                                        if (!fMap[p.faction]) fMap[p.faction] = { picks: 0, wins: 0 };
                                                                        fMap[p.faction].picks += 1;
                                                                        if (p.isWinner) fMap[p.faction].wins += 1;
                                                                    });
                                                                });
                                                                return Object.entries(fMap)
                                                                    .sort((a, b) => (b[1].wins / b[1].picks) - (a[1].wins / a[1].picks))
                                                                    .map(([facName, stat]) => {
                                                                        const wr = ((stat.wins / stat.picks) * 100).toFixed(0);
                                                                        return (
                                                                            <tr key={facName} className="border-b border-slate-800/50">
                                                                                <td className="py-2.5 font-bold text-slate-200">{facName}</td>
                                                                                <td className="py-2.5 text-center text-slate-400">{stat.picks}</td>
                                                                                <td className="py-2.5 text-center text-amber-400 font-bold">{stat.wins}</td>
                                                                                <td className="py-2.5 text-right font-orbitron font-bold text-emerald-400">{wr}%</td>
                                                                            </tr>
                                                                        );
                                                                    });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                <h4 className="font-orbitron font-bold text-cyan-400 text-sm uppercase mb-3 flex items-center gap-2">
                                                    <i className="fa-solid fa-clock-rotate-left"></i> История Партий
                                                </h4>
                                                <div className="space-y-3">
                                                    {globalHistory.map(g => (
                                                        <div key={g.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                                                            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                                                                <div>
                                                                    <span className="font-bold text-white">{g.date}</span>
                                                                    <span className="text-slate-500 ml-2">({g.roundsCount} раунд., цель {g.targetScore} ПО)</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-amber-400 font-bold">🏆 {g.winner} ({g.winningFaction})</span>
                                                                    <button
                                                                        onClick={() => deleteSingleGame(g.id)}
                                                                        className="text-slate-600 hover:text-red-400 p-1 transition"
                                                                        title="Удалить партию (Требуется PIN)"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                                                                {(g.players || []).map((p, i) => (
                                                                    <div key={i} className="bg-slate-950 p-1.5 rounded-lg border border-slate-800/50 flex items-center justify-between">
                                                                        <span className="text-slate-300 truncate">{p.name}</span>
                                                                        <span className="font-mono text-slate-400">{p.score} ПО / ⏱{formatTime(p.totalTime || 0)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                                <button
                                                    onClick={clearAllStats}
                                                    className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 text-xs px-4 py-2 rounded-xl transition flex items-center gap-2"
                                                >
                                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                                    <span>Сбросить всю статистику (PIN)</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
    </>
  );
}
