import { STRATEGY_CARDS } from '../data/gameData';

export function DraftModal({ showDraftModal, minimizedModals, toggleMinimize, setShowDraftModal, draftStep, draftQueue, players, currentQueueIndex, draftAssignments, strategyCardBonuses, handleSelectCard, handleUndoLastPick, handleReassignCard, confirmDraft, draftPickOrder }) {
  return (
    <>
{showDraftModal && (
                            <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${minimizedModals.draft ? 'hidden' : ''}`}>
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="font-russo text-xl text-amber-400">
                                            {draftStep === 'DRAFT' ? "ВЫБОР КАРТ СТРАТЕГИЙ" : "ПОДТВЕРЖДЕНИЕ И ОБМЕН"}
                                        </h2>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => toggleMinimize('draft')} className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-window-minimize text-base"></i>
                                            </button>
                                            <button
                                                onClick={() => setShowDraftModal(false)}
                                                className="text-slate-500 hover:text-white transition"
                                            >
                                                <i className="fa-solid fa-xmark text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>

                                    {/* ШАГ 1: ПООЧЕРЕДНЫЙ ВЫБОР */}
                                    {draftStep === 'DRAFT' && (
                                        <div>
                                            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-5 flex flex-wrap gap-3 items-center">
                                                <span className="text-sm text-slate-400 font-chakra mr-2">ОЧЕРЕДЬ ВЫБОРА:</span>
                                                {draftQueue.map((pId, idx) => {
                                                    const player = players.find(p => p.id === pId);
                                                    const isCurrent = idx === currentQueueIndex;
                                                    return (
                                                        <span
                                                            key={idx}
                                                            className={`text-sm px-3 py-1.5 rounded-lg border transition ${isCurrent
                                                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold scale-105 shadow-md shadow-amber-500/20'
                                                                : idx < currentQueueIndex
                                                                    ? 'bg-slate-900 border-slate-800 text-slate-600 line-through'
                                                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                                                }`}
                                                        >
                                                            {idx + 1}. {player?.name}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex justify-end mb-4">
                                                <button
                                                    type="button"
                                                    onClick={handleUndoLastPick}
                                                    disabled={!draftPickOrder?.length}
                                                    className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5"
                                                >
                                                    <i className="fa-solid fa-rotate-left"></i>
                                                    Отменить последний выбор
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {STRATEGY_CARDS.map(card => {
                                                    const takenByPlayerId = draftAssignments[card.id];
                                                    const isTaken = !!takenByPlayerId;
                                                    const owner = players.find(p => p.id === takenByPlayerId);
                                                    const bonus = strategyCardBonuses[card.id] || 0;

                                                    return (
                                                        <button
                                                            key={card.id}
                                                            disabled={isTaken}
                                                            onClick={() => handleSelectCard(card.id)}
                                                            className={`text-left transition relative group ${isTaken
                                                                ? 'cursor-not-allowed'
                                                                : 'cursor-pointer'
                                                                }`}
                                                        >
                                                            {bonus > 0 && !isTaken && (
                                                                <div className="absolute top-2 right-2 bg-yellow-500 text-black rounded-full w-7 h-7 flex items-center justify-center font-orbitron font-bold text-sm border-2 border-slate-900 shadow-lg z-10" title={`Накоплено товаров: ${bonus}`}>
                                                                    {bonus}
                                                                </div>
                                                            )}
                                                            <img src={card.imageUrl} alt={card.name} className={`w-full h-80 object-cover rounded-xl border-2 transition-all ${isTaken ? 'border-slate-800/50' : 'border-transparent group-hover:border-amber-500/80'}`} />
                                                            {isTaken && (
                                                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-2 rounded-xl">
                                                                    <span className="text-xs text-slate-400">Взял:</span>
                                                                    <span className="font-bold text-amber-400 text-sm">{owner?.name}</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ШАГ 2: ПОДТВЕРЖДЕНИЕ И БЫСТРЫЙ ОБМЕН */}
                                    {draftStep === 'CONFIRM' && (
                                        <div className="space-y-4">
                                            <p className="text-xs text-slate-400">
                                                Все игроки выбрали карты. Вы можете быстро обменять или переназначить карты прямо в таблице перед началом раунда.
                                            </p>

                                            <div className="border border-slate-800 rounded-xl overflow-hidden">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-950 text-slate-400 font-chakra">
                                                        <tr>
                                                            <th className="p-3">Карта</th>
                                                            <th className="p-3">Назначена игроку</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {STRATEGY_CARDS.map(card => {
                                                            const ownerId = draftAssignments[card.id];
                                                            if (!ownerId) return null;

                                                            return (
                                                                <tr key={card.id} className="bg-slate-900/50">
                                                                    <td className="p-3 font-bold text-amber-400">
                                                                        #{card.id} {card.ruName || card.name}
                                                                    </td>
                                                                    <td className="p-3">
                                                                        <select
                                                                            value={ownerId}
                                                                            onChange={(e) => handleReassignCard(card.id, e.target.value)}
                                                                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-amber-500 outline-none"
                                                                        >
                                                                            {players.map(p => (
                                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex justify-end pt-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleUndoLastPick}
                                                    disabled={!draftPickOrder?.length}
                                                    className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-700"
                                                >
                                                    <i className="fa-solid fa-rotate-left mr-1"></i>
                                                    Отменить последний выбор
                                                </button>
                                                <button
                                                    onClick={confirmDraft}
                                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-russo px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/10"
                                                >
                                                    ПОДТВЕРДИТЬ И ЗАКРЫТЬ
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                </div>
                            </div>
                        )}
    </>
  );
}
