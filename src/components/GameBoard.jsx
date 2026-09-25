import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { areAllStrategiesPlayed, isStrategyCardPlayed } from '../game/selectors';

export function GameBoard({
  turnOrder,
  passed,
  activePlayer,
  sortedPlayersForBoard,
  getPlayerScore,
  players,
  adjustSecrets,
  adjustMecatol,
  vpTrack,
  setCustodians,
  setSupport,
  objectives,
  completions,
  toggleCompletion,
  scoring,
  expandedObjectives,
  toggleExpand,
  removeObjective,
  addRandomObjective,
  addCustomObjective,
  targetScore,
  speakerId,
  handleAddSecret,
  eliminatePlayer,
  releaseSeat,
  setSpeaker,
  onOpenPlayerTech,
  claimedSeats = [],
  isGameActive,
  perms,
}) {
  const canAdminBoard = !perms || perms.can('secrets');
  const canEliminate = !perms || perms.can('eliminate');
  const canReleaseSeat = typeof releaseSeat === 'function';
  const canSetSpeaker = typeof setSpeaker === 'function';
  const canOpenTech = typeof onOpenPlayerTech === 'function';
  const canScoreAny = !perms || perms.can('scoreAny');
  const canScoreSelf = !perms || perms.can('scoreSelf');
  const seatId = perms?.seatPlayerId;
  const scoringActive = !!scoring?.active;
  const [playerActionsId, setPlayerActionsId] = useState(null);
  const [supportPickOpen, setSupportPickOpen] = useState(false);
  const [custodiansNotice, setCustodiansNotice] = useState(null);
  const playerActionsRef = useRef(null);

  const custodiansPlayerId = vpTrack?.custodiansPlayerId ?? null;
  const supportHolders = vpTrack?.supportHolders || {};

  useEffect(() => {
    if (playerActionsId == null) return undefined;
    const onPointerDown = (event) => {
      if (playerActionsRef.current && !playerActionsRef.current.contains(event.target)) {
        setPlayerActionsId(null);
        setSupportPickOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPlayerActionsId(null);
        setSupportPickOpen(false);
        setCustodiansNotice(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [playerActionsId]);

  const claimCustodiansFor = (player) => {
    if (!canAdminBoard || typeof setCustodians !== 'function') return false;
    if (custodiansPlayerId != null) return false;
    if (!player || player.eliminated) return false;
    setCustodians(player.id);
    setCustodiansNotice({ playerName: player.name });
    return true;
  };

  const onMecatolPlus = (player) => {
    if (custodiansPlayerId == null && typeof setCustodians === 'function') {
      claimCustodiansFor(player);
      return;
    }
    adjustMecatol(player.id, 1);
  };

  const canToggleFor = (playerId) => {
    // During the status-phase scoring window, use ObjectiveScoringModal only.
    if (scoringActive) return false;
    if (canScoreAny) return true;
    return canScoreSelf && seatId != null && playerId === seatId;
  };

  const onObjectiveClick = (playerId, objectiveId) => {
    toggleCompletion(playerId, objectiveId);
  };

  return (
                            <div className="space-y-8">
                                {custodiansNotice && (
                                  <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
                                    <div
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="custodians-notice-title"
                                      className="bg-slate-900 border border-cyan-600/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="w-11 h-11 rounded-xl bg-cyan-950 border border-cyan-600 flex items-center justify-center text-cyan-300 text-xl">
                                          <i className="fa-solid fa-globe" aria-hidden="true" />
                                        </span>
                                        <div>
                                          <h3 id="custodians-notice-title" className="font-orbitron font-bold text-cyan-300 text-sm uppercase">
                                            Хранители Мекатола
                                          </h3>
                                          <p className="text-xs text-slate-400 mt-0.5">+1 ПО за захват Мекатола Rex</p>
                                        </div>
                                      </div>
                                      <p className="text-sm text-slate-200 leading-relaxed">
                                        <span className="font-bold text-white">{custodiansNotice.playerName}</span>
                                        {' '}получил токен Хранителей. Очко учтено в счёте; у игрока появится значок планеты.
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => setCustodiansNotice(null)}
                                        className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm transition"
                                      >
                                        Понятно
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* ПАНЕЛЬ ОЧЕРЕДНОСТИ ХОДОВ */}
                                {turnOrder.length > 0 && (
                                    <section className="bg-slate-900 border border-slate-800 p-5 max-md:p-3 rounded-3xl space-y-4 shadow-lg">
                                        <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-1">
                                            <h3 className="font-orbitron font-bold text-sm uppercase text-slate-400 flex items-center gap-2">
                                                <i className="fa-solid fa-list-ol text-cyan-400"></i>
                                                <span className="max-md:hidden">Очередность хода (По инициативе)</span>
                                                <span className="md:hidden">Очередь хода</span>
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500 uppercase font-orbitron">
                                                Активных: {turnOrder.filter(p => !passed[p.id]).length} / {turnOrder.length}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                            {turnOrder.map((p) => {
                                                if (!p) return null;
                                                const hasPassed = !!passed[p.id];
                                                const isStrategyUsed = areAllStrategiesPlayed(p);
                                                const isCurrent = activePlayer && activePlayer.id === p.id;
                                                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                                                const isBlack = p.color === '#000000' || p.color === '#090d16';
                                                const cardBorderColor = isBlack ? '#f8fafc' : (p.color || '#3b82f6');

                                                const playerCards = (p.cards || [])
                                                    .slice()
                                                    .sort((a, b) => a.initiative - b.initiative);

                                                return (
                                                    <div
                                                        key={p.id}
                                                        style={{ borderLeftColor: cardBorderColor, borderLeftWidth: '4px' }}
                                                        className={`p-2.5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${isCurrent
                                                            ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105'
                                                            : hasPassed ? 'bg-slate-950/50 border-slate-800 opacity-50 grayscale' : 'bg-slate-950/80 border-slate-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-end gap-1 mb-1 h-5">
                                                            {hasPassed ? (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/50 uppercase">
                                                                    ✓ ПАС
                                                                </span>
                                                            ) : isStrategyUsed ? (
                                                                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center gap-1" title="Карта стратегии сыграна">
                                                                    <i className="fa-solid fa-check"></i>
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="flex items-center gap-3 my-auto">
                                                            <div
                                                                className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 flex-shrink-0"
                                                                style={{ boxShadow: `0 0 10px ${cardBorderColor}40` }}
                                                            >
                                                                <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="truncate">
                                                                <div className="font-bold text-base text-white truncate">{p.name}</div>
                                                                <div className="text-sm text-amber-300/80 truncate font-semibold">
                                                                    {playerCards.length
                                                                        ? playerCards.map(card => (
                                                                          `${isStrategyCardPlayed(p, card.id) ? '✓ ' : ''}${card.name}`
                                                                        )).join(', ')
                                                                        : 'Без карты'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-slate-500 mt-2 pt-1.5 border-t border-slate-800/60">
                                                            <span>Время: <span className="font-mono text-slate-400">{formatTime(p.totalTime || 0)}</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* ДВУХКОЛОНОЧНАЯ СЕТКА */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                                    {/* ЛЕВАЯ КОЛОНКА: ТАБЛО ИГРОКОВ */}
                                    <section className="lg:col-span-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-3xl space-y-4 shadow-lg">
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                            <h2 className="font-orbitron font-bold text-base md:text-lg text-white uppercase flex items-center gap-2">
                                                <i className="fa-solid fa-trophy text-amber-400"></i>
                                                <span>Табло Игроков</span>
                                            </h2>
                                            <span className="text-xs text-slate-500 font-orbitron font-bold">Цель: {targetScore} ПО</span>
                                        </div>

                                        <div className="space-y-2.5 flex flex-col">
                                            {sortedPlayersForBoard.map(p => {
                                                const score = getPlayerScore(p.id);
                                                const maxScore = Math.max(...players.map(x => getPlayerScore(x.id)), 0);
                                                const isLeader = score === maxScore && score > 0;
                                                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                                                const isWinner = score >= targetScore;

                                                const isBlack = p.color === '#000000' || p.color === '#090d16' || p.color === '#030712';
                                                const playerColor = p.color || '#3b82f6';
                                                const seatClaimed = claimedSeats.some(id => String(id) === String(p.id));
                                                const showEliminate = !p.eliminated && isGameActive && canEliminate;
                                                const showRelease = canReleaseSeat && seatClaimed;
                                                const showSetSpeaker = canSetSpeaker && !p.eliminated && p.id !== speakerId;
                                                const showOpenTech = canOpenTech && !p.eliminated;
                                                const showVpEdit = canAdminBoard && !p.eliminated && typeof setSupport === 'function';
                                                const hasPlayerActions = showEliminate || showRelease || showSetSpeaker || showOpenTech || showVpEdit;
                                                const actionsOpen = playerActionsId === p.id;
                                                const heldSupportCount = Object.values(supportHolders).filter(id => id === p.id).length;
                                                const hasCustodians = custodiansPlayerId === p.id;
                                                const mecatolShown = (p.extra || 0) + (hasCustodians ? 1 : 0);

                                                return (
                                                    <motion.div
                                                        key={p.id}
                                                        layout
                                                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                                        className={`relative p-3 rounded-2xl border flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch shadow-md ${
                                                          actionsOpen ? 'overflow-visible z-40' : 'overflow-hidden'
                                                        } ${isWinner
                                                            ? 'bg-amber-950/60 border-amber-500 shadow-amber-500/20'
                                                            : p.eliminated
                                                            ? 'bg-slate-950/70 border-slate-800 opacity-60 grayscale'
                                                            : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                                                            }`}
                                                    >
                                                        {p.eliminated && (
                                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                                                                <span className="font-orbitron font-black text-xl text-red-500 tracking-widest -rotate-12 border-4 border-red-500 px-3 py-1">УСТРАНЕН</span>
                                                            </div>
                                                        )}
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl"
                                                            style={{
                                                                backgroundColor: playerColor,
                                                                borderRight: isBlack ? '1px solid #f8fafc' : 'none'
                                                            }}
                                                        />

                                                        <div className="flex items-center gap-3 min-w-0 pl-2 flex-1">
                                                            <div
                                                                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-950 border-2 flex items-center justify-center p-1.5 flex-shrink-0 shadow-inner"
                                                                style={{ borderColor: isBlack ? '#334155' : playerColor }}
                                                            >
                                                                <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain filter drop-shadow" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div
                                                                    className="min-w-0"
                                                                    ref={actionsOpen ? playerActionsRef : undefined}
                                                                >
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <div
                                                                            className={`font-extrabold text-base md:text-lg text-white truncate leading-tight flex items-center gap-1.5 min-w-0 ${hasPlayerActions ? 'cursor-pointer select-none' : ''}`}
                                                                            onClick={hasPlayerActions ? () => {
                                                                              setSupportPickOpen(false);
                                                                              setPlayerActionsId(actionsOpen ? null : p.id);
                                                                            } : undefined}
                                                                            onKeyDown={hasPlayerActions ? (event) => {
                                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                                    event.preventDefault();
                                                                                    setSupportPickOpen(false);
                                                                                    setPlayerActionsId(actionsOpen ? null : p.id);
                                                                                }
                                                                            } : undefined}
                                                                            role={hasPlayerActions ? 'button' : undefined}
                                                                            tabIndex={hasPlayerActions ? 0 : undefined}
                                                                            title={hasPlayerActions ? 'Действия с игроком' : undefined}
                                                                        >
                                                                            <span className={`truncate ${hasPlayerActions ? 'hover:text-slate-200 underline-offset-2 hover:underline decoration-slate-600' : ''}`}>
                                                                                {p.name}
                                                                            </span>
                                                                            {isLeader && !p.eliminated && (
                                                                                <span title="Лидер партии" className="text-amber-400 text-sm filter drop-shadow flex-shrink-0">
                                                                                    👑
                                                                                </span>
                                                                            )}
                                                                            {p.id === speakerId && !p.eliminated && (
                                                                                <span
                                                                                  title="Спикер"
                                                                                  className="w-6 h-6 rounded-md bg-purple-950 text-purple-300 border border-purple-700 flex items-center justify-center flex-shrink-0"
                                                                                >
                                                                                    <i className="fa-solid fa-gavel text-[11px]" aria-hidden="true" />
                                                                                    <span className="sr-only">Спикер</span>
                                                                                </span>
                                                                            )}
                                                                            {hasCustodians && (
                                                                                <span
                                                                                  title="Хранители Мекатола (+1 ПО за захват)"
                                                                                  className="w-6 h-6 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 flex items-center justify-center flex-shrink-0"
                                                                                >
                                                                                    <i className="fa-solid fa-globe text-[11px]" aria-hidden="true" />
                                                                                    <span className="sr-only">Хранители</span>
                                                                                </span>
                                                                            )}
                                                                            {heldSupportCount > 0 && (() => {
                                                                                const fromIds = Object.entries(supportHolders)
                                                                                  .filter(([, holderId]) => holderId === p.id)
                                                                                  .map(([fromId]) => Number(fromId));
                                                                                return (
                                                                                  <span
                                                                                    title={`Support for the Throne ×${heldSupportCount} (+${heldSupportCount} ПО)`}
                                                                                    className="inline-flex items-center gap-1 h-6 pl-1.5 pr-1 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-700 flex-shrink-0"
                                                                                  >
                                                                                    <i className="fa-solid fa-scroll text-[10px]" aria-hidden="true" />
                                                                                    <span className="inline-flex items-center -space-x-1.5">
                                                                                      {fromIds.map(fromId => {
                                                                                        const donor = players.find(x => x.id === fromId);
                                                                                        const donorFaction = ALL_FACTIONS.find(f => f.id === donor?.factionId);
                                                                                        const donorColor = donor?.color || donorFaction?.color || '#64748b';
                                                                                        return (
                                                                                          <span
                                                                                            key={fromId}
                                                                                            title={donor ? `Support от ${donor.name}` : 'Support'}
                                                                                            className="w-5 h-5 rounded-md bg-slate-950 border flex items-center justify-center p-0.5"
                                                                                            style={{ borderColor: donorColor }}
                                                                                          >
                                                                                            {donorFaction?.iconUrl ? (
                                                                                              <img src={donorFaction.iconUrl} alt="" className="w-full h-full object-contain" />
                                                                                            ) : (
                                                                                              <span className="text-[8px] font-bold text-slate-500">?</span>
                                                                                            )}
                                                                                          </span>
                                                                                        );
                                                                                      })}
                                                                                    </span>
                                                                                    <span className="sr-only">Support ×{heldSupportCount}</span>
                                                                                  </span>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                    {hasPlayerActions && actionsOpen && (
                                                                        <div className="mt-1.5 space-y-1.5">
                                                                          <div className="flex flex-wrap items-center gap-1">
                                                                            {showOpenTech && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        onOpenPlayerTech(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-sky-300 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-sky-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title={`Технологии: ${p.name}`}
                                                                                >
                                                                                    <i className="fa-solid fa-atom" />
                                                                                    Тех
                                                                                </button>
                                                                            )}
                                                                            {showSetSpeaker && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        setSpeaker(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-purple-300 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-purple-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title={`Назначить спикером: ${p.name}`}
                                                                                >
                                                                                    <i className="fa-solid fa-gavel" />
                                                                                    <span className="font-semibold">Спикер</span>
                                                                                </button>
                                                                            )}
                                                                            {showVpEdit && typeof setSupport === 'function' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setSupportPickOpen(v => !v)}
                                                                                    className={`text-[11px] px-2 py-1 rounded-lg border transition inline-flex items-center gap-1.5 ${
                                                                                      heldSupportCount > 0 || supportPickOpen
                                                                                        ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                                                                                        : 'border-slate-700/80 bg-slate-950/70 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/40'
                                                                                    }`}
                                                                                    title="Support for the Throne"
                                                                                >
                                                                                    <i className="fa-solid fa-scroll" />
                                                                                    <span className="font-semibold">Support{heldSupportCount > 0 ? ` · ${heldSupportCount}` : ''}</span>
                                                                                </button>
                                                                            )}
                                                                            {showEliminate && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        eliminatePlayer(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-red-400 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-red-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title={`Устранить игрока ${p.name}`}
                                                                                >
                                                                                    <i className="fa-solid fa-skull" />
                                                                                    <span className="font-semibold">Устранить</span>
                                                                                </button>
                                                                            )}
                                                                            {showRelease && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        releaseSeat(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-amber-400 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-amber-950/30 transition inline-flex items-center gap-1.5"
                                                                                    title={`Освободить место ${p.name} (сбросить устройство и код)`}
                                                                                >
                                                                                    <i className="fa-solid fa-link-slash" />
                                                                                    <span className="font-semibold">С места</span>
                                                                                </button>
                                                                            )}
                                                                          </div>
                                                                          {supportPickOpen && typeof setSupport === 'function' && (
                                                                            <div className="rounded-xl border border-emerald-700/50 bg-slate-950 p-2 space-y-1 max-w-xs">
                                                                              <div className="px-1.5 py-1 text-[10px] text-slate-500 uppercase font-bold tracking-wide">
                                                                                Держит Support от
                                                                              </div>
                                                                              {players.filter(o => o.id !== p.id && !o.eliminated).map(o => {
                                                                                const holds = supportHolders[o.id] === p.id;
                                                                                const oFaction = ALL_FACTIONS.find(f => f.id === o.factionId);
                                                                                const oColor = o.color || oFaction?.color || '#64748b';
                                                                                return (
                                                                                  <label
                                                                                    key={o.id}
                                                                                    className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg cursor-pointer transition ${
                                                                                      holds
                                                                                        ? 'bg-emerald-950/60 border border-emerald-700/60'
                                                                                        : 'border border-transparent hover:bg-slate-900'
                                                                                    }`}
                                                                                  >
                                                                                    <input
                                                                                      type="checkbox"
                                                                                      checked={holds}
                                                                                      onChange={() => setSupport(o.id, holds ? null : p.id)}
                                                                                      className="sr-only"
                                                                                    />
                                                                                    <span
                                                                                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[9px] ${
                                                                                        holds
                                                                                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                                                                          : 'border-slate-600 bg-slate-900'
                                                                                      }`}
                                                                                      aria-hidden="true"
                                                                                    >
                                                                                      {holds ? <i className="fa-solid fa-check" /> : null}
                                                                                    </span>
                                                                                    <span
                                                                                      className="w-7 h-7 rounded-lg bg-slate-900 border flex items-center justify-center p-0.5 flex-shrink-0"
                                                                                      style={{ borderColor: oColor }}
                                                                                    >
                                                                                      {oFaction?.iconUrl ? (
                                                                                        <img src={oFaction.iconUrl} alt="" className="w-full h-full object-contain" />
                                                                                      ) : (
                                                                                        <span className="text-[9px] font-bold text-slate-500">?</span>
                                                                                      )}
                                                                                    </span>
                                                                                    <span className={`min-w-0 flex-1 truncate text-xs font-bold ${holds ? 'text-emerald-200' : 'text-slate-300'}`}>
                                                                                      {o.name}
                                                                                    </span>
                                                                                  </label>
                                                                                );
                                                                              })}
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs md:text-sm text-slate-300 font-semibold truncate mt-0.5">{faction?.name}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 flex-shrink-0 max-md:flex-wrap max-md:pl-1">
                                                            <div
                                                                style={{
                                                                    color: isBlack ? '#090d16' : playerColor,
                                                                    WebkitTextStroke: isBlack ? '1.5px #f8fafc' : 'none',
                                                                    borderColor: isBlack ? '#334155' : playerColor
                                                                }}
                                                                className="font-rajdhani font-bold text-3xl md:text-4xl bg-slate-950 px-3 py-1 rounded-xl border text-center min-w-[65px] tracking-wider max-md:text-2xl max-md:min-w-[56px]"
                                                            >
                                                                {score}
                                                            </div>

                                                            <div className="flex flex-col gap-1.5 w-[115px] max-md:flex-row max-md:w-auto max-md:flex-wrap">
                                                                <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-sm w-[125px] max-md:w-auto max-md:min-w-[110px]">
                                                                    <div className="text-[10px] font-bold text-slate-300 uppercase flex items-center justify-between w-[45px] flex-shrink-0">
                                                                        <span>Секр</span>
                                                                        <span className="w-3 text-center">
                                                                            {p.secrets === 3 && <span title="Базовый лимит (3)" className="text-amber-400">🔒</span>}
                                                                            {p.secrets >= 4 && <span title="Сверхлимит (4)" className="text-purple-400">👑</span>}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1">
                                                                        {canAdminBoard ? (
                                                                          <>
                                                                        <button
                                                                            onClick={() => adjustSecrets(p.id, -1)}
                                                                            className="w-5 h-5 max-md:w-8 max-md:h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded flex items-center justify-center transition border border-slate-700"
                                                                        >–</button>

                                                                        <span className="font-sans font-extrabold w-4 text-center text-sm text-slate-200">
                                                                            {p.secrets}
                                                                        </span>

                                                                        <button
                                                                            onClick={() => handleAddSecret(p.id)}
                                                                            className="w-5 h-5 max-md:w-8 max-md:h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-cyan-400 font-bold rounded flex items-center justify-center transition border border-slate-700"
                                                                        >+</button>
                                                                          </>
                                                                        ) : (
                                                                        <span className="font-sans font-extrabold w-4 text-center text-sm text-slate-200">
                                                                            {p.secrets}
                                                                        </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-700/80 shadow-sm w-[125px] max-md:w-auto max-md:min-w-[110px]">
                                                                    <div className="text-[10px] font-bold text-slate-300 uppercase w-[45px] flex-shrink-0">
                                                                        Мек
                                                                    </div>

                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        {canAdminBoard ? (
                                                                          <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => adjustMecatol(p.id, -1)}
                                                                            disabled={p.extra <= 0}
                                                                            className="w-5 h-5 max-md:w-8 max-md:h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold rounded flex items-center justify-center transition border border-slate-700 disabled:opacity-40"
                                                                        >–</button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                              if (custodiansPlayerId == null) {
                                                                                claimCustodiansFor(p);
                                                                              }
                                                                            }}
                                                                            title={
                                                                              hasCustodians
                                                                                ? 'Хранители Мекатола получены'
                                                                                : custodiansPlayerId == null
                                                                                  ? 'Нажмите: отметить захват Мекатола (Хранители)'
                                                                                  : 'Счётчик Мекатола'
                                                                            }
                                                                            className={`font-sans font-extrabold w-4 h-5 max-md:h-8 flex-shrink-0 text-center text-sm transition p-0 ${
                                                                              hasCustodians
                                                                                ? 'text-cyan-300'
                                                                                : custodiansPlayerId == null
                                                                                  ? 'text-purple-300 hover:text-cyan-300 cursor-pointer'
                                                                                  : 'text-purple-300 cursor-default'
                                                                            }`}
                                                                        >
                                                                            {mecatolShown}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onMecatolPlus(p)}
                                                                            className="w-5 h-5 max-md:w-8 max-md:h-8 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-cyan-400 font-bold rounded flex items-center justify-center transition border border-slate-700"
                                                                        >+</button>
                                                                          </>
                                                                        ) : (
                                                                        <span className={`font-sans font-extrabold w-4 text-center text-sm ${hasCustodians ? 'text-cyan-300' : 'text-purple-300'}`}>
                                                                            {mecatolShown}
                                                                        </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    {/* ПРАВАЯ КОЛОНКА: ПУБЛИЧНЫЕ ЗАДАНИЯ (2 СТОЛБЦА) */}
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
                                                                                title="Удалить цель"
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
                                                                                title="Удалить цель"
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

                                </div>
                            </div>
  );
}
