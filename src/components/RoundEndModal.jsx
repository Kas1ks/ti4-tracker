export function RoundEndModal({ showRoundModal, setShowRoundModal, roundNumber, confirmNextRound }) {
  return (
{showRoundModal && (
                            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                                <div className="bg-slate-900 border border-cyan-500/40 p-8 rounded-3xl max-w-lg w-full space-y-6 text-center shadow-[0_0_40px_rgba(6,182,212,0.25)]">
                                    <div className="w-20 h-20 bg-cyan-950 border-2 border-cyan-500 rounded-3xl flex items-center justify-center mx-auto text-cyan-400 text-3xl">
                                        <i className="fa-solid fa-flag-checkered"></i>
                                    </div>

                                    <div>
                                        <h3 className="font-orbitron font-black text-2xl text-white">Раунд {roundNumber} Завершен!</h3>
                                        <p className="text-sm text-slate-400 mt-2">Все игроки спасовали. Переходим к фазе СТАТУСА</p>
                                    </div>

                                    <div className="flex items-center gap-4 pt-2">
                                        <button
                                            onClick={() => setShowRoundModal(false)}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-2xl text-xs md:text-sm transition">
                                            Отмена
                                        </button>
                                        <button
                                            onClick={confirmNextRound}
                                            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-orbitron font-black py-3.5 rounded-2xl text-xs md:text-sm shadow-lg transition transform active:scale-95 uppercase">
                                            Раунд {roundNumber + 1} ➔
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
  );
}
