export function EndGameModal({ showEndGameModal, setShowEndGameModal, players, getPlayerScore, saveGameToCloud, setShowGameSummaryModal, resetGameState }) {
  return (
{showEndGameModal && (
                            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                                <div className="bg-slate-900 border border-red-500/40 p-6 md:p-8 rounded-3xl max-w-md w-full space-y-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.2)]">
                                    <div className="w-16 h-16 bg-red-950 border-2 border-red-500 rounded-2xl flex items-center justify-center mx-auto text-red-400 text-2xl">
                                        <i className="fa-solid fa-flag-checkered"></i>
                                    </div>

                                    <div>
                                        <h3 className="font-orbitron font-black text-xl md:text-2xl text-white uppercase">Завершить партию?</h3>
                                        <p className="text-xs md:text-sm text-slate-400 mt-2">
                                            Выберите, нужно ли сохранить результаты этой игры в общую статистику компании.
                                        </p>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <button
                                            onClick={async () => {
                                                const sorted = [...players].sort((a, b) => getPlayerScore(b.id) - getPlayerScore(a.id));
                                                const topPlayer = sorted[0];
                                                const winner = topPlayer && getPlayerScore(topPlayer.id) > 0 ? topPlayer : null;

                                                await saveGameToCloud(winner); 
                                                setShowEndGameModal(false);
                                                setShowGameSummaryModal(true);
                                            }}
                                            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-orbitron font-extrabold py-3.5 px-4 rounded-2xl text-xs md:text-sm shadow-lg transition transform active:scale-95 uppercase flex items-center justify-center gap-2"
                                        >
                                            <i className="fa-solid fa-trophy"></i> Сохранить и выйти
                                        </button>

                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('ti4_gameSummary'); // Чистим, если вышли без сохранения
                                                resetGameState();
                                            }}
                                            className="w-full bg-slate-800 hover:bg-red-950/60 hover:border-red-800/80 text-slate-300 hover:text-red-300 font-bold py-3.5 px-4 rounded-2xl text-xs md:text-sm border border-slate-700 transition flex items-center justify-center gap-2"
                                        >
                                            <i className="fa-solid fa-trash-can"></i> Завершить без сохранения
                                        </button>

                                        <button
                                            onClick={() => setShowEndGameModal(false)}
                                            className="w-full bg-transparent text-slate-500 hover:text-slate-300 font-bold py-2 text-xs transition"
                                        >
                                            Продолжить игру
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
  );
}
