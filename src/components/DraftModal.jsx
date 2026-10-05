import { STRATEGY_CARDS } from '../data/gameData';
import { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';

function tradeGoodBonusForCard(strategyCardBonuses, cardId) {
  const raw = strategyCardBonuses?.[cardId] ?? strategyCardBonuses?.[String(cardId)];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Host desktop: player scores rail (left of draft). */
function DraftScoreRail({ players = [], getPlayerScore, targetScore }) {
  const seats = players.filter(p => !p.eliminated);
  const byScore = [...seats].sort((a, b) => {
    const diff = getPlayerScore(b.id) - getPlayerScore(a.id);
    return diff !== 0 ? diff : a.id - b.id;
  });

  return (
    <aside className="hidden md:flex flex-col min-h-0 min-w-0 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="text-[10px] text-slate-400 font-chakra font-bold uppercase tracking-wider flex items-center gap-1.5">
          <i className="fa-solid fa-trophy text-amber-400" aria-hidden="true" />
          Табло
        </div>
        <div className="text-[10px] font-bold text-slate-600 uppercase">
          {targetScore} ПО
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 modal-scroll">
        {byScore.map((p, idx) => {
          const score = getPlayerScore(p.id);
          return (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2"
            >
              <span className="text-[10px] font-orbitron font-bold text-slate-600 w-4">{idx + 1}</span>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color || '#64748b' }}
              />
              <span className="text-sm font-bold text-slate-100 truncate flex-1 min-w-0">{p.name}</span>
              <span className="font-orbitron font-black text-amber-400 text-base tabular-nums">{score}</span>
            </li>
          );
        })}
        {!byScore.length && (
          <li className="text-xs text-slate-600 text-center py-4">Нет игроков</li>
        )}
      </ul>
    </aside>
  );
}

/** Host desktop: public objectives rail — chip badges for all seats, collapse when all scored. */
function DraftObjectivesRail({ players = [], objectives = [], completions = {} }) {
  const [expanded, setExpanded] = useState({});
  const seats = players.filter(p => !p.eliminated);
  const list = [
    ...objectives.filter(o => Number(o.stage) === 1),
    ...objectives.filter(o => Number(o.stage) === 2),
  ];

  const toggleExpand = (objectiveId) => {
    setExpanded((prev) => {
      const seatsDone = seats.length > 0 && seats.every(p => !!completions[`${p.id}_${objectiveId}`]);
      const currently = prev[objectiveId] ?? !seatsDone;
      return { ...prev, [objectiveId]: !currently };
    });
  };

  return (
    <aside className="hidden md:flex flex-col min-h-0 min-w-0 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-800/80 flex-shrink-0">
        <div className="text-[10px] text-slate-400 font-chakra font-bold uppercase tracking-wider flex items-center gap-1.5">
          <i className="fa-solid fa-list-check text-cyan-400" aria-hidden="true" />
          Общие цели
        </div>
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 modal-scroll">
        {list.map((obj) => {
          const label = obj.desc || obj.title || obj.name || obj.id;
          const doneCount = seats.filter(p => !!completions[`${p.id}_${obj.id}`]).length;
          const isCompletedByAll = seats.length > 0 && doneCount === seats.length;
          const isExpanded = expanded[obj.id] ?? !isCompletedByAll;
          const stageTone = Number(obj.stage) === 2
            ? 'text-rose-400 border-rose-800/50 bg-rose-950/30'
            : 'text-blue-400 border-blue-800/50 bg-blue-950/30';

          return (
            <li
              key={obj.id}
              title={label}
              className={`rounded-lg border transition-all duration-300 space-y-1.5 ${
                isCompletedByAll
                  ? 'border-emerald-500/40 bg-emerald-950/10 p-2'
                  : 'border-slate-800 bg-slate-900/60 p-2.5'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded border font-orbitron font-bold text-[10px] ${stageTone}`}>
                  {Number(obj.stage) === 2 ? 'II' : 'I'}
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpand(obj.id)}
                  className="min-w-0 flex-1 text-left flex items-start gap-1.5 cursor-pointer select-none"
                >
                  {isCompletedByAll ? (
                    <span className="text-emerald-400 font-bold text-[10px] flex-shrink-0 mt-0.5 uppercase animate-pulse">
                      ✓ Все
                    </span>
                  ) : doneCount > 0 ? (
                    <span className="text-emerald-400/80 font-bold text-[10px] flex-shrink-0 mt-0.5">
                      {doneCount}/{seats.length}
                    </span>
                  ) : null}
                  <span
                    className={`text-xs font-semibold leading-snug transition-all duration-300 ${
                      isCompletedByAll && !isExpanded
                        ? 'text-slate-400 line-through text-[11px] decoration-slate-600'
                        : 'text-slate-100'
                    }`}
                  >
                    {label}
                  </span>
                </button>
                {isCompletedByAll && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(obj.id)}
                    className="text-slate-500 hover:text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 transition flex-shrink-0"
                    aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isExpanded
                    ? 'max-h-40 opacity-100'
                    : 'max-h-0 opacity-0'
                }`}
              >
                <div className="flex flex-wrap gap-1 pl-0.5">
                  {seats.map((p) => {
                    const isDone = !!completions[`${p.id}_${obj.id}`];
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          isDone
                            ? 'border-emerald-800/50 bg-emerald-950/40 text-emerald-200'
                            : 'border-slate-700/60 bg-slate-950/50 text-slate-500'
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color || '#64748b' }}
                        />
                        {p.name}
                        {isDone && <span className="text-emerald-400">✓</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
        {!list.length && (
          <li className="text-xs text-slate-600 text-center py-4">Целей пока нет</li>
        )}
      </ul>
    </aside>
  );
}

export function DraftModal({
  showDraftModal, minimizedModals, toggleMinimize, setShowDraftModal, draftStep, draftQueue,
  players, currentQueueIndex, draftAssignments, strategyCardBonuses, handleSelectCard,
  handleUndoLastPick, handleReassignCard, confirmDraft, draftPickOrder, perms,
  pickStartedAt = null,
  getPlayerScore,
  targetScore = 10,
  objectives = [],
  completions = {},
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
  const showHostSidebars = canAdmin && typeof getPlayerScore === 'function';

  /** Confirm/exchange UI is host-only; players leave the draft modal after picks. */
  const openForClient = !!showDraftModal && (draftStep !== 'CONFIRM' || canConfirm);
  const visible = openForClient && !minimizedModals.draft;
  useEscapeKey(() => setShowDraftModal(false), visible);
  useBodyScrollLock(visible);

  const pickClockRunning = draftStep === 'DRAFT' && Number.isFinite(pickStartedAt) && visible;
  const pickElapsed = useElapsedSeconds(pickStartedAt, pickClockRunning);

  const seatHasPicked = seatId != null
    && Object.values(draftAssignments || {}).some(ownerId => ownerId === seatId);
  const draftLayoutFixed = draftStep === 'DRAFT';
  const showWaitingBoard = draftStep === 'DRAFT' && !canPick;
  const showDraftCardGrid = draftStep === 'DRAFT';

  return (
    <>
{openForClient && (
                            <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 max-md:items-end max-md:p-2 modal-overlay ${minimizedModals.draft ? 'hidden' : ''}`} role="presentation">
                                <div
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="draft-modal-title"
                                  className={`bg-slate-900 border border-slate-800 rounded-2xl w-full p-6 shadow-2xl max-md:p-3 flex flex-col min-h-0 overflow-hidden ${
                                    draftLayoutFixed
                                      ? 'max-h-[min(96vh,100dvh)] h-[min(92vh,100dvh)] md:h-[min(94vh,980px)] md:max-h-[94vh]'
                                      : 'max-h-[90vh] max-md:max-h-[min(92vh,100dvh)]'
                                  } ${
                                    showHostSidebars
                                      ? 'max-w-6xl md:max-w-[min(1720px,98vw)]'
                                      : 'max-w-6xl'
                                  }`}
                                >
                                    <div className="flex justify-between items-start gap-3 mb-2 md:mb-4 flex-shrink-0">
                                        <h2 id="draft-modal-title" className="font-russo text-xl text-amber-400 max-md:text-base max-md:leading-tight">
                                            {draftStep === 'DRAFT' ? "ВЫБОР КАРТ СТРАТЕГИЙ" : "ПОДТВЕРЖДЕНИЕ И ОБМЕН"}
                                        </h2>
                                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
                                            {draftStep === 'DRAFT' && canUndo && (
                                              <button
                                                type="button"
                                                onClick={handleUndoLastPick}
                                                disabled={!draftPickOrder?.length}
                                                className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-slate-700 flex items-center gap-1.5"
                                              >
                                                <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
                                                <span className="max-md:hidden">Отменить последний выбор</span>
                                                <span className="md:hidden">Отменить</span>
                                              </button>
                                            )}
                                            {draftStep === 'DRAFT' && (
                                              <div className="text-right min-w-[4.75rem]" title="Время текущего выбора">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Таймер выбора</div>
                                                <div className="font-orbitron font-black text-amber-300 text-lg tabular-nums leading-none">
                                                  {Number.isFinite(pickStartedAt) ? formatTime(pickElapsed) : '—'}
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
                                                className="hidden md:inline-flex text-slate-500 hover:text-white transition"
                                            >
                                                <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className={`min-h-0 flex-1 overflow-hidden ${
                                      showHostSidebars
                                        ? 'md:grid md:grid-cols-[210px_minmax(0,1fr)_250px] md:gap-4'
                                        : 'flex flex-col'
                                    }`}
                                    >
                                      {showHostSidebars && (
                                        <DraftScoreRail
                                          players={players}
                                          getPlayerScore={getPlayerScore}
                                          targetScore={targetScore}
                                        />
                                      )}
                                      <div className={`min-w-0 min-h-0 flex flex-col overflow-hidden ${showHostSidebars ? '' : 'flex-1'}`}>

                                    {draftStep === 'DRAFT' && (
                                        <div className="flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden">
                                            <div className="bg-slate-950 border border-slate-800 p-2.5 md:p-4 rounded-xl mb-2 md:mb-3 space-y-2 md:space-y-2.5 flex-shrink-0 w-full">
                                                <div className="text-[10px] md:text-sm text-slate-400 font-chakra font-bold uppercase tracking-wider">
                                                    Очередь выбора
                                                </div>
                                                {players.length <= 4 && draftQueue.length > players.filter(p => !p.eliminated).length && (
                                                  <p className="text-[11px] text-slate-500 max-md:hidden">
                                                    Snake draft: 2-й круг против часовой
                                                  </p>
                                                )}
                                                <div className="flex flex-wrap gap-1.5 md:gap-2 max-md:max-h-[4.5rem] max-md:overflow-y-auto">
                                                    {draftQueue.map((pId, idx) => {
                                                        const player = players.find(p => p.id === pId);
                                                        const isCurrent = idx === currentQueueIndex;
                                                        const isDone = idx < currentQueueIndex;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`inline-flex items-center gap-1 max-w-full px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border text-xs md:text-sm transition ${
                                                                    isCurrent
                                                                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                                                                        : isDone
                                                                            ? 'bg-slate-900 border-slate-800 text-slate-600'
                                                                            : 'bg-slate-900 border-slate-800 text-slate-300'
                                                                }`}
                                                            >
                                                                <span className={`font-orbitron font-black text-[10px] md:text-[11px] flex-shrink-0 ${
                                                                    isCurrent ? 'text-slate-900/70' : 'text-slate-600'
                                                                }`}>
                                                                    {idx + 1}.
                                                                </span>
                                                                <span className={`truncate font-bold max-w-[5.5rem] md:max-w-none ${isDone ? 'line-through' : ''}`}>
                                                                    {player?.name || '—'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {showDraftCardGrid && (
                                            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden modal-scroll overscroll-contain pb-2 space-y-3">
                                            {showWaitingBoard && (
                                              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-center space-y-1 flex-shrink-0">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">Сейчас выбирает</div>
                                                <div className="font-orbitron font-black text-xl md:text-2xl text-amber-300">
                                                  {currentPicker?.name || '…'}
                                                </div>
                                                {Number.isFinite(pickStartedAt) && (
                                                  <div className="font-orbitron font-bold text-amber-400/90 text-lg tabular-nums pt-0.5">
                                                    {formatTime(pickElapsed)}
                                                  </div>
                                                )}
                                                <div className="text-xs text-slate-400">
                                                  {seatHasPicked
                                                    ? 'Ожидание выбора других игроков — на картах видны накопленные товары'
                                                    : 'Ожидайте своего хода — на свободных картах показаны накопленные товары'}
                                                </div>
                                              </div>
                                            )}
                                            {/* Mobile: compact 2×4 grid. Desktop: full 4-col cards. */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 w-full min-w-0">
                                                {STRATEGY_CARDS.map(card => {
                                                    const takenByPlayerId = draftAssignments[card.id];
                                                    const isTaken = !!takenByPlayerId;
                                                    const owner = players.find(p => p.id === takenByPlayerId);
                                                    const ownerColor = owner?.color || '#64748b';
                                                    const ownerIsBlack = ['#000000', '#000', 'black', '#090d16', '#030712']
                                                      .includes(String(ownerColor).toLowerCase());
                                                    const frameColor = ownerIsBlack ? '#f8fafc' : ownerColor;
                                                    const bonus = tradeGoodBonusForCard(strategyCardBonuses, card.id);
                                                    const pickDisabled = isTaken || !canPick;
                                                    const shortName = (card.ruName || card.name || '').replace(/^\d+\.\s*/, '');

                                                    return (
                                                        <button
                                                            key={card.id}
                                                            disabled={pickDisabled}
                                                            onClick={() => handleSelectCard(card.id)}
                                                            style={isTaken ? {
                                                              boxShadow: `0 0 0 2px ${frameColor}, 0 0 14px ${frameColor}44`,
                                                            } : undefined}
                                                            className={`text-left transition relative group w-full min-w-0 rounded-xl bg-slate-950 overflow-hidden active:scale-[0.98] ${pickDisabled
                                                                ? 'cursor-not-allowed'
                                                                : 'cursor-pointer'
                                                                }`}
                                                        >
                                                            {bonus > 0 && (
                                                                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 bg-yellow-500 text-black rounded-full w-6 h-6 md:w-7 md:h-7 flex items-center justify-center font-orbitron font-bold text-xs md:text-sm border-2 border-slate-900 shadow-lg z-30 pointer-events-none" title={`Накоплено товаров: ${bonus}`}>
                                                                    {bonus}
                                                                </div>
                                                            )}

                                                            {/* Mobile compact tile */}
                                                            <div className="md:hidden relative aspect-[3/4] w-full">
                                                              <img
                                                                src={card.imageUrl}
                                                                alt={card.name}
                                                                className={`absolute inset-0 w-full h-full object-cover object-top ${
                                                                  isTaken ? 'opacity-40 grayscale-[35%]' : ''
                                                                }`}
                                                              />
                                                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-2 pt-6 pb-2">
                                                                <div className="font-orbitron font-black text-[11px] text-amber-300 leading-tight truncate">
                                                                  #{card.id} {shortName}
                                                                </div>
                                                              </div>
                                                              {isTaken && (
                                                                <div className="absolute inset-0 z-10 flex items-center justify-center p-2 pointer-events-none">
                                                                  <div
                                                                    className="w-full rounded-lg border-2 bg-slate-950/90 backdrop-blur-sm px-2 py-2 shadow-lg"
                                                                    style={{ borderColor: frameColor }}
                                                                  >
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                      <span
                                                                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ${ownerIsBlack ? 'ring-white/70' : 'ring-black/40'}`}
                                                                        style={{ backgroundColor: ownerColor }}
                                                                      />
                                                                      <div className="min-w-0">
                                                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Взял</div>
                                                                        <div className="font-orbitron font-black text-xs text-white truncate leading-tight">
                                                                          {owner?.name || '—'}
                                                                        </div>
                                                                      </div>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>

                                                            {/* Desktop full card */}
                                                            <div className="hidden md:block relative">
                                                              <img
                                                                src={card.imageUrl}
                                                                alt={card.name}
                                                                className={`block w-full h-auto rounded-xl border-2 transition-all bg-slate-950 object-contain ${
                                                                  isTaken
                                                                    ? 'border-transparent opacity-45 grayscale-[30%]'
                                                                    : 'border-transparent group-hover:border-amber-500/80'
                                                                }`}
                                                              />
                                                              {isTaken && (
                                                                <div className="absolute inset-0 z-10 flex flex-col items-stretch justify-center p-3 pointer-events-none">
                                                                  <div
                                                                    className="rounded-xl border-2 bg-slate-950/92 backdrop-blur-sm px-3 py-3 shadow-xl"
                                                                    style={{ borderColor: frameColor, boxShadow: `0 8px 24px rgba(0,0,0,0.45), inset 0 0 0 1px ${frameColor}33` }}
                                                                  >
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                      <span
                                                                        className={`w-4 h-4 rounded-full flex-shrink-0 ring-2 ${ownerIsBlack ? 'ring-white/70' : 'ring-black/40'}`}
                                                                        style={{ backgroundColor: ownerColor }}
                                                                      />
                                                                      <div className="min-w-0 flex-1">
                                                                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                                          Взял
                                                                        </div>
                                                                        <div className="font-orbitron font-black text-base text-white truncate leading-tight">
                                                                          {owner?.name || '—'}
                                                                        </div>
                                                                      </div>
                                                                      <span
                                                                        className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border flex-shrink-0"
                                                                        style={{
                                                                          color: frameColor,
                                                                          borderColor: `${frameColor}99`,
                                                                          backgroundColor: `${frameColor}22`,
                                                                        }}
                                                                      >
                                                                        #{card.id}
                                                                      </span>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            </div>
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
                                      {showHostSidebars && (
                                        <DraftObjectivesRail
                                          players={players}
                                          objectives={objectives}
                                          completions={completions}
                                        />
                                      )}
                                    </div>
                                </div>
                            </div>
                        )}
    </>
  );
}
