import { STRATEGY_CARDS } from '../data/gameData';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';

export function DraftModal({
  showDraftModal, minimizedModals, toggleMinimize, setShowDraftModal, draftStep, draftQueue,
  players, currentQueueIndex, draftAssignments, strategyCardBonuses, handleSelectCard,
  handleUndoLastPick, handleReassignCard, confirmDraft, draftPickOrder, perms,
  pickStartedAt = null,
}) {
  const currentPickerId = draftQueue[currentQueueIndex];
  const currentPicker = players.find(p => p.id === currentPickerId);
  const lastCardId = draftPickOrder?.[draftPickOrder.length - 1];
  const lastOwner = lastCardId != null ? draftAssignments[lastCardId] : null;
  const seatId = perms?.seatPlayerId;
  const canAdmin = !perms || perms.can('draftAdmin');
  const canPick = canAdmin || (!!perms?.can('draftPick') && seatId != null && currentPickerId === seatId);
  const canUndo = canAdmin || (!!perms?.can('draftPick') && seatId != null && lastOwner === seatId);
  const canConfirm = !perms || perms.can('confirmDraft');
  const canReassign = !perms || perms.can('reassignCard');

  /** Confirm/exchange UI is host-only; players leave the draft modal after picks. */
  const openForClient = !!showDraftModal && (draftStep !== 'CONFIRM' || canConfirm);
  const visible = openForClient && !minimizedModals.draft;
  useEscapeKey(() => setShowDraftModal(false), visible);
  useBodyScrollLock(visible);

  const pickClockRunning = draftStep === 'DRAFT' && Number.isFinite(pickStartedAt) && visible;
  const pickElapsed = useElapsedSeconds(pickStartedAt, pickClockRunning);

  /** Full card grid only while this client can pick; otherwise compact status. */
  const showCardPicker = draftStep === 'DRAFT' && canPick;
  const showWaitingBoard = draftStep === 'DRAFT' && !canPick;
  const seatHasPicked = seatId != null
    && Object.values(draftAssignments || {}).some(ownerId => ownerId === seatId);

  const takenCards = STRATEGY_CARDS
    .filter(card => draftAssignments[card.id])
    .map(card => ({
      card,
      owner: players.find(p => p.id === draftAssignments[card.id]),
    }));
  const freeCards = STRATEGY_CARDS.filter(card => !draftAssignments[card.id]);

  return (
    <>
{openForClient && (
                            <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 max-md:items-end max-md:p-2 modal-overlay ${minimizedModals.draft ? 'hidden' : ''}`} role="presentation">
                                <div
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="draft-modal-title"
                                  className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl max-md:p-4 max-md:max-h-[min(92vh,100dvh)] modal-scroll"
                                >
                                    <div className="flex justify-between items-start gap-3 mb-4">
                                        <h2 id="draft-modal-title" className="font-russo text-xl text-amber-400 max-md:text-base max-md:leading-tight">
                                            {draftStep === 'DRAFT' ? "ВЫБОР КАРТ СТРАТЕГИЙ" : "ПОДТВЕРЖДЕНИЕ И ОБМЕН"}
                                        </h2>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            {draftStep === 'DRAFT' && Number.isFinite(pickStartedAt) && (
                                              <div className="text-right" title="Время текущего выбора">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Таймер выбора</div>
                                                <div className="font-orbitron font-black text-amber-300 text-lg tabular-nums leading-none">
                                                  {formatTime(pickElapsed)}
                                                </div>
                                              </div>
                                            )}
                                            <button type="button" onClick={() => toggleMinimize('draft')} aria-label="Свернуть драфт" className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-window-minimize text-base" aria-hidden="true"></i>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowDraftModal(false)}
                                                aria-label="Закрыть драфт"
                                                className="text-slate-500 hover:text-white transition"
                                            >
                                                <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>

                                    {draftStep === 'DRAFT' && (
                                        <div>
                                            <div className="bg-slate-950 border border-slate-800 p-3 md:p-4 rounded-xl mb-5 space-y-2.5">
                                                <div className="text-xs md:text-sm text-slate-400 font-chakra font-bold uppercase tracking-wider">
                                                    Очередь выбора
                                                </div>
                                                {players.length <= 4 && draftQueue.length > players.filter(p => !p.eliminated).length && (
                                                  <p className="text-[11px] text-slate-500">
                                                    Snake draft: 2-й круг против часовой
                                                  </p>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    {draftQueue.map((pId, idx) => {
                                                        const player = players.find(p => p.id === pId);
                                                        const isCurrent = idx === currentQueueIndex;
                                                        const isDone = idx < currentQueueIndex;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg border text-sm transition ${
                                                                    isCurrent
                                                                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                                                                        : isDone
                                                                            ? 'bg-slate-900 border-slate-800 text-slate-600'
                                                                            : 'bg-slate-900 border-slate-800 text-slate-300'
                                                                }`}
                                                            >
                                                                <span className={`font-orbitron font-black text-[11px] flex-shrink-0 ${
                                                                    isCurrent ? 'text-slate-900/70' : 'text-slate-600'
                                                                }`}>
                                                                    {idx + 1}.
                                                                </span>
                                                                <span className={`truncate font-bold ${isDone ? 'line-through' : ''}`}>
                                                                    {player?.name || '—'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {showWaitingBoard && (
                                              <div className="space-y-4">
                                                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-4 text-center space-y-1">
                                                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">Сейчас выбирает</div>
                                                  <div className="font-orbitron font-black text-2xl text-amber-300">
                                                    {currentPicker?.name || '…'}
                                                  </div>
                                                  {Number.isFinite(pickStartedAt) && (
                                                    <div className="font-orbitron font-bold text-amber-400/90 text-lg tabular-nums pt-1">
                                                      {formatTime(pickElapsed)}
                                                    </div>
                                                  )}
                                                  <div className="text-xs text-slate-400">
                                                    {seatHasPicked
                                                      ? 'Ожидание выбора других игроков'
                                                      : 'Ожидайте — список карт откроется, когда снова будет ваш ход'}
                                                  </div>
                                                </div>

                                                <div className="space-y-2">
                                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    Выбрано ({takenCards.length}/8)
                                                  </div>
                                                  {takenCards.length === 0 ? (
                                                    <div className="text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                                                      Пока никто не выбрал карту
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-2">
                                                      {takenCards.map(({ card, owner }) => (
                                                        <div
                                                          key={card.id}
                                                          className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5"
                                                        >
                                                          <img
                                                            src={card.imageUrl}
                                                            alt={card.name}
                                                            className="w-12 h-16 object-cover rounded-md border border-slate-700 flex-shrink-0"
                                                          />
                                                          <div className="min-w-0 flex-1">
                                                            <div className="font-orbitron font-bold text-sm text-amber-300 truncate">
                                                              {card.name}
                                                            </div>
                                                            <div className="text-xs text-slate-400">
                                                              → <span className="text-white font-semibold">{owner?.name || '—'}</span>
                                                            </div>
                                                          </div>
                                                          <div className="text-lg font-orbitron font-black text-slate-600 flex-shrink-0">
                                                            #{card.id}
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>

                                                {freeCards.length > 0 && (
                                                  <div className="space-y-2">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                      Ещё доступны
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                      {freeCards.map(card => (
                                                        <span
                                                          key={card.id}
                                                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300"
                                                        >
                                                          #{card.id} {card.name.replace(/^\d+\.\s*/, '')}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {canUndo && (
                                                  <div className="flex justify-end pt-1">
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
                                                )}
                                              </div>
                                            )}

                                            {showCardPicker && (
                                              <>
                                            {canUndo && (
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
                                            )}

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-md:grid-cols-1 max-md:gap-4">
                                                {STRATEGY_CARDS.map(card => {
                                                    const takenByPlayerId = draftAssignments[card.id];
                                                    const isTaken = !!takenByPlayerId;
                                                    const owner = players.find(p => p.id === takenByPlayerId);
                                                    const bonus = strategyCardBonuses[card.id] || 0;
                                                    const pickDisabled = isTaken || !canPick;

                                                    return (
                                                        <button
                                                            key={card.id}
                                                            disabled={pickDisabled}
                                                            onClick={() => handleSelectCard(card.id)}
                                                            className={`text-left transition relative group ${pickDisabled
                                                                ? 'cursor-not-allowed'
                                                                : 'cursor-pointer'
                                                                }`}
                                                        >
                                                            {bonus > 0 && (
                                                                <div className="absolute top-2 right-2 bg-yellow-500 text-black rounded-full w-7 h-7 flex items-center justify-center font-orbitron font-bold text-sm border-2 border-slate-900 shadow-lg z-20" title={`Накоплено товаров: ${bonus}`}>
                                                                    {bonus}
                                                                </div>
                                                            )}
                                                            <img
                                                              src={card.imageUrl}
                                                              alt={card.name}
                                                              className={`w-full rounded-xl border-2 transition-all bg-slate-950 h-80 object-cover max-md:h-auto max-md:aspect-[2/3] max-md:object-contain max-md:object-top ${isTaken ? 'border-slate-800/50' : 'border-transparent group-hover:border-amber-500/80'}`}
                                                            />
                                                            {isTaken && (
                                                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-2 rounded-xl z-10">
                                                                    <span className="text-xs text-slate-400">Взял:</span>
                                                                    <span className="font-bold text-amber-400 text-sm">{owner?.name}</span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                              </>
                                            )}
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
                                                                        {canReassign ? (
                                                                        <select
                                                                            value={ownerId}
                                                                            onChange={(e) => handleReassignCard(card.id, e.target.value)}
                                                                            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-amber-500 outline-none"
                                                                        >
                                                                            {players.map(p => (
                                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        ) : (
                                                                          <span className="text-slate-300">{players.find(p => p.id === ownerId)?.name || '—'}</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex justify-end pt-2 gap-2">
                                                {canUndo && (
                                                <button
                                                    type="button"
                                                    onClick={handleUndoLastPick}
                                                    disabled={!draftPickOrder?.length}
                                                    className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-700"
                                                >
                                                    <i className="fa-solid fa-rotate-left mr-1"></i>
                                                    Отменить последний выбор
                                                </button>
                                                )}
                                                {canConfirm && (
                                                <button
                                                    onClick={confirmDraft}
                                                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-russo px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-amber-500/10"
                                                >
                                                    ПОДТВЕРДИТЬ И ЗАКРЫТЬ
                                                </button>
                                                )}
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
