import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ALL_FACTIONS } from '../data/gameData';
import { secretObjectiveById } from '../data/secretObjectives';
import { formatTime } from '../utils/game';
import { lawsOwnedByPlayer } from '../game/agendaDeck';
import { isStrategyCardPlayed } from '../game/selectors';
import { ObjectivesPanel } from './ObjectivesPanel';
import secretCardBack from '../assets/secret-card-back.png';

export function GameBoard({
  turnOrder,
  passed,
  activePlayer,
  sortedPlayersForBoard,
  getPlayerScore,
  players,
  adjustMecatol,
  vpTrack,
  setCustodians,
  setMecatolController,
  setSupport,
  objectives,
  completions,
  toggleCompletion,
  scoring,
  spotlightObjectiveId = null,
  spotlightReady = false,
  expandedObjectives,
  toggleExpand,
  removeObjective,
  addRandomObjective,
  addCustomObjective,
  targetScore,
  speakerId,
  activeLaws = [],
  handleAddSecret,
  eliminatePlayer,
  releaseSeat,
  setSpeaker,
  onOpenPlayerTech,
  claimedSeats = [],
  isGameActive,
  perms,
  canRevealPublic = true,
  onRaiseSecretCap,
  onShowPlayerSecrets,
  uiConfirm,
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
  const [secretsSheet, setSecretsSheet] = useState(null);
  const playerActionsRef = useRef(null);

  const custodiansPlayerId = vpTrack?.custodiansPlayerId ?? null;
  const mecatolControllerId = vpTrack?.mecatolControllerId ?? custodiansPlayerId;
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
    setCustodiansNotice({ playerName: player.name, firstClaim: true });
    return true;
  };

  const onMecatolPlus = (player) => {
    if (custodiansPlayerId == null && typeof setCustodians === 'function') {
      claimCustodiansFor(player);
      return;
    }
    adjustMecatol(player.id, 1);
  };

  /** Manual Mecatol Rex control token (name menu). First claim also awards custodians VP. */
  const assignMecatolControl = (player) => {
    if (!canAdminBoard || !player || player.eliminated) return;
    const hasControl = mecatolControllerId === player.id;
    if (hasControl) {
      if (typeof setMecatolController === 'function') setMecatolController(null);
      return;
    }
    if (custodiansPlayerId == null && typeof setCustodians === 'function') {
      claimCustodiansFor(player);
      return;
    }
    if (typeof setMecatolController === 'function') setMecatolController(player.id);
  };

  const revealPlayerSecrets = async (player) => {
    if (!canAdminBoard || !player) return;
    const ok = typeof uiConfirm === 'function'
      ? await uiConfirm(`Показать секретные цели игрока ${player.name}?`, {
        title: 'Секреты игрока',
        confirmLabel: 'Показать',
      })
      : true;
    if (!ok) return;
    if (typeof onShowPlayerSecrets === 'function') {
      onShowPlayerSecrets(player.id);
      return;
    }
    setSecretsSheet({
      name: player.name,
      hand: Array.isArray(player.secretHand) ? player.secretHand : [],
    });
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
                                  <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
                                    <div
                                      role="dialog"
                                      aria-modal="true"
                                      aria-labelledby="custodians-notice-title"
                                      className="game-modal-panel max-w-sm w-full p-5 space-y-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="game-badge is-custodians w-11 h-11 !rounded-xl text-xl">
                                          <i className="fa-solid fa-globe" aria-hidden="true" />
                                        </span>
                                        <div>
                                          <h3 id="custodians-notice-title" className="game-modal-title text-sm uppercase">
                                            Хранители Мекатола
                                          </h3>
                                          <p className="text-xs text-[var(--game-muted)] mt-0.5">+1 ПО за захват Мекатола Rex</p>
                                        </div>
                                      </div>
                                      <p className="text-sm text-[var(--game-text)] leading-relaxed">
                                        <span className="font-bold text-white">{custodiansNotice.playerName}</span>
                                        {' '}получил контроль Мекатол Рекс
                                        {custodiansNotice.firstClaim ? ' и +1 ПО хранителей (балл остаётся у первого претендента)' : ''}
                                        . Жетон контроля переходящий.
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => setCustodiansNotice(null)}
                                        className="game-btn-primary w-full"
                                      >
                                        Понятно
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* ПАНЕЛЬ ОЧЕРЕДНОСТИ ХОДОВ */}
                                {turnOrder.length > 0 && (
                                    <section className="game-panel p-5 max-md:p-3 space-y-4">
                                        <div className="flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-1">
                                            <h3 className="game-section-title">
                                                <i className="fa-solid fa-skull" aria-hidden="true" />
                                                <span className="max-md:hidden">Очередность хода по инициативе</span>
                                                <span className="md:hidden">Очередь хода</span>
                                            </h3>
                                            <span className="text-xs font-bold text-[var(--game-muted)] uppercase font-orbitron">
                                                Активных: {turnOrder.filter(p => !passed[p.id]).length} / {turnOrder.length}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                            {turnOrder.map((p) => {
                                                if (!p) return null;
                                                const hasPassed = !!passed[p.id];
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
                                                        style={{ '--player-accent': cardBorderColor }}
                                                        className={`game-initiative-card${isCurrent ? ' is-current' : ''}${hasPassed ? ' is-passed' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3 my-auto">
                                                            <div
                                                                className="w-12 h-12 rounded-xl bg-slate-900 border flex items-center justify-center p-1.5 flex-shrink-0"
                                                                style={{
                                                                  borderColor: `color-mix(in srgb, ${cardBorderColor} 55%, #334155)`,
                                                                  boxShadow: `0 0 12px ${cardBorderColor}55`,
                                                                }}
                                                            >
                                                                <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
                                                            </div>
                                                            <div className="truncate min-w-0">
                                                                <div className="font-bold text-base text-white truncate">{p.name}</div>
                                                                <div className="text-[11px] font-semibold mt-0.5 flex flex-wrap items-center gap-1 text-[var(--game-muted)]">
                                                                    {playerCards.length
                                                                        ? playerCards.map((card) => {
                                                                          const played = isStrategyCardPlayed(p, card.id);
                                                                          const shortName = (card.name || '').replace(/^\d+\.\s*/, '');
                                                                          return (
                                                                            <span key={card.id} className="inline-flex items-center gap-1 min-w-0">
                                                                              <span className="font-orbitron font-bold text-[var(--game-gold-bright)] opacity-80">
                                                                                #{card.id}
                                                                              </span>
                                                                              {played ? (
                                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/50 uppercase tracking-wide">
                                                                                  Сыграно
                                                                                </span>
                                                                              ) : (
                                                                                <span className="truncate opacity-80">{shortName}</span>
                                                                              )}
                                                                            </span>
                                                                          );
                                                                        })
                                                                        : <span>Без карты</span>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-xs text-[var(--game-muted)] mt-2 pt-1.5 border-t border-[var(--game-line)]">
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
                                    <section className="lg:col-span-4 game-panel p-4 md:p-5 space-y-4">
                                        <div className="flex items-center justify-between border-b border-[var(--game-line)] pb-3">
                                            <h2 className="game-section-title !text-base md:!text-lg !text-white">
                                                <i className="fa-solid fa-trophy" aria-hidden="true" />
                                                <span>Табло игроков</span>
                                            </h2>
                                            <span className="text-xs text-[var(--game-muted)] font-orbitron font-bold tracking-wide">
                                              Цель: <span className="text-[var(--game-gold-bright)]">{targetScore} ПО</span>
                                            </span>
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
                                                const showSecretHost = canAdminBoard && !p.eliminated;
                                                const showMecatolControl = canAdminBoard
                                                  && !p.eliminated
                                                  && (typeof setMecatolController === 'function' || typeof setCustodians === 'function');
                                                const hasPlayerActions = showEliminate || showRelease || showSetSpeaker || showOpenTech || showVpEdit || showSecretHost || showMecatolControl;
                                                const actionsOpen = playerActionsId === p.id;
                                                const heldSupportCount = Object.values(supportHolders).filter(id => id === p.id).length;
                                                const hasCustodiansVp = custodiansPlayerId === p.id;
                                                const hasMecatolControl = mecatolControllerId === p.id;
                                                const mecatolShown = (p.extra || 0) + (hasCustodiansVp ? 1 : 0);
                                                const handCount = Array.isArray(p.secretHand) && p.secretHand.length > 0
                                                  ? p.secretHand.length
                                                  : (typeof p.secretHandCount === 'number' ? p.secretHandCount : 0);
                                                const secretCap = Number(p.secretCap) === 4 ? 4 : 3;
                                                const playerLaws = lawsOwnedByPlayer(activeLaws, p.id);
                                                const lawTitles = playerLaws.map((l) => l.title).filter(Boolean).join(', ');

                                                return (
                                                    <motion.div
                                                        key={p.id}
                                                        layout
                                                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                                        className={`game-player-card max-md:flex-col max-md:items-stretch ${
                                                          actionsOpen ? 'overflow-visible z-40' : 'overflow-hidden'
                                                        }${isWinner ? ' is-winner' : ''}${p.eliminated ? ' is-eliminated' : ''}`}
                                                        style={{
                                                          '--player-accent': isBlack ? '#94a3b8' : playerColor,
                                                        }}
                                                    >
                                                        {p.eliminated && (
                                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                                                                <span className="font-orbitron font-black text-xl text-red-500 tracking-widest -rotate-12 border-4 border-red-500 px-3 py-1">УСТРАНЕН</span>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
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
                                                                                  className="game-badge is-speaker"
                                                                                >
                                                                                    <i className="fa-solid fa-gavel text-[11px]" aria-hidden="true" />
                                                                                    <span className="sr-only">Спикер</span>
                                                                                </span>
                                                                            )}
                                                                            {hasMecatolControl && (
                                                                                <span
                                                                                  title={hasCustodiansVp
                                                                                    ? 'Контроль Мекатол Рекс (+1 ПО хранителей)'
                                                                                    : 'Контроль Мекатол Рекс (жетон)'}
                                                                                  className="game-badge is-custodians"
                                                                                >
                                                                                    <i className="fa-solid fa-globe text-[11px]" aria-hidden="true" />
                                                                                    <span className="sr-only">Мекатол</span>
                                                                                </span>
                                                                            )}
                                                                            {hasCustodiansVp && !hasMecatolControl && (
                                                                                <span
                                                                                  title="Первый балл хранителей Мекатола (+1 ПО)"
                                                                                  className="game-badge is-custodians opacity-70"
                                                                                >
                                                                                    <i className="fa-solid fa-star text-[10px]" aria-hidden="true" />
                                                                                    <span className="sr-only">Хранители VP</span>
                                                                                </span>
                                                                            )}
                                                                            {playerLaws.length > 0 && (
                                                                                <span
                                                                                  title={lawTitles ? `Закон: ${lawTitles}` : 'Активный закон на игроке'}
                                                                                  className={`game-badge is-law${playerLaws.length > 1 ? ' !w-auto !h-6 gap-1 px-1.5' : ''}`}
                                                                                >
                                                                                    <i className="fa-solid fa-scroll text-[11px]" aria-hidden="true" />
                                                                                    {playerLaws.length > 1 && (
                                                                                      <span className="text-[10px] font-extrabold tabular-nums">{playerLaws.length}</span>
                                                                                    )}
                                                                                    <span className="sr-only">Закон</span>
                                                                                </span>
                                                                            )}
                                                                            {heldSupportCount > 0 && (() => {
                                                                                const fromIds = Object.entries(supportHolders)
                                                                                  .filter(([, holderId]) => holderId === p.id)
                                                                                  .map(([fromId]) => Number(fromId));
                                                                                return (
                                                                                  <span
                                                                                    title={`Support for the Throne ×${heldSupportCount} (+${heldSupportCount} ПО)`}
                                                                                    className="game-badge is-support !w-auto !h-6 gap-1 pl-1.5 pr-1"
                                                                                  >
                                                                                    <i className="fa-solid fa-handshake text-[10px]" aria-hidden="true" />
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
                                                                            {showSecretHost && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSupportPickOpen(false);
                                                                                        revealPlayerSecrets(p);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-violet-300 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-violet-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title={`Показать секреты: ${p.name}`}
                                                                                >
                                                                                    <i className="fa-solid fa-user-secret" />
                                                                                    Секреты
                                                                                </button>
                                                                            )}
                                                                            {showSecretHost && typeof handleAddSecret === 'function' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        handleAddSecret(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-cyan-300 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-cyan-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title={`Выдать секретную цель: ${p.name}`}
                                                                                >
                                                                                    <i className="fa-solid fa-plus" />
                                                                                    Добавить секретку
                                                                                </button>
                                                                            )}
                                                                            {showSecretHost && secretCap < 4 && typeof onRaiseSecretCap === 'function' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        onRaiseSecretCap(p.id);
                                                                                    }}
                                                                                    className="text-slate-400 hover:text-amber-300 text-[11px] px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-950/70 hover:bg-amber-950/40 transition inline-flex items-center gap-1.5"
                                                                                    title="Разрешить 4-ю секретную"
                                                                                >
                                                                                    <i className="fa-solid fa-unlock" />
                                                                                    Лимит 4
                                                                                </button>
                                                                            )}
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
                                                                            {showMecatolControl && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPlayerActionsId(null);
                                                                                        setSupportPickOpen(false);
                                                                                        assignMecatolControl(p);
                                                                                    }}
                                                                                    className={`text-[11px] px-2 py-1 rounded-lg border transition inline-flex items-center gap-1.5 ${
                                                                                      hasMecatolControl
                                                                                        ? 'border-cyan-600 bg-cyan-950/50 text-cyan-300'
                                                                                        : 'border-slate-700/80 bg-slate-950/70 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/40'
                                                                                    }`}
                                                                                    title={
                                                                                      hasMecatolControl
                                                                                        ? 'Снять контроль Мекатол Рекс'
                                                                                        : custodiansPlayerId == null
                                                                                          ? 'Первый захват Мекатола (контроль + ПО хранителей)'
                                                                                          : 'Передать контроль Мекатол Рекс'
                                                                                    }
                                                                                >
                                                                                    <i className="fa-solid fa-globe" />
                                                                                    <span className="font-semibold">
                                                                                      {hasMecatolControl ? 'Мекатол ✓' : 'Мекатол'}
                                                                                    </span>
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
                                                                                    <i className="fa-solid fa-handshake" />
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
                                                                <div
                                                                  className="text-xs md:text-sm font-semibold truncate mt-0.5"
                                                                  style={{
                                                                    color: `color-mix(in srgb, ${isBlack ? '#94a3b8' : playerColor} 50%, #94a3b8)`,
                                                                  }}
                                                                >
                                                                  {faction?.name}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 flex-shrink-0 max-md:flex-wrap max-md:pl-1">
                                                            <div
                                                                style={{
                                                                    color: isBlack ? '#090d16' : playerColor,
                                                                    WebkitTextStroke: isBlack ? '1.5px #f8fafc' : 'none',
                                                                    borderColor: isBlack ? '#334155' : playerColor,
                                                                    boxShadow: isBlack
                                                                      ? undefined
                                                                      : `0 0 12px color-mix(in srgb, ${playerColor} 35%, transparent)`,
                                                                }}
                                                                className="game-player-score font-rajdhani font-bold text-3xl md:text-4xl px-3 py-1 text-center min-w-[65px] tracking-wider max-md:text-2xl max-md:min-w-[56px]"
                                                            >
                                                                {score}
                                                            </div>

                                                            <div className={`game-player-vp-stack ${canAdminBoard ? 'is-admin' : ''}`}>
                                                                <div
                                                                  className="game-player-stat game-player-vp-row is-secrets"
                                                                  title={`В руке ${handCount} · достигнуто ${p.secrets}`}
                                                                >
                                                                    <div className="game-player-vp-label">
                                                                      <span className="game-player-vp-kicker">Секр</span>
                                                                      <img
                                                                        src={secretCardBack}
                                                                        alt=""
                                                                        draggable={false}
                                                                        className="game-player-vp-card"
                                                                        aria-hidden="true"
                                                                      />
                                                                      <span className="game-player-vp-hand">{handCount}</span>
                                                                      {(p.secrets + handCount) >= secretCap && secretCap === 3 && (
                                                                        <span title="Базовый лимит (3)" className="game-player-vp-cap">🔒</span>
                                                                      )}
                                                                      {secretCap >= 4 && (
                                                                        <span title="Лимит 4" className="game-player-vp-cap is-raised">👑</span>
                                                                      )}
                                                                    </div>
                                                                    {/* ✓ above Мек «−», scored above Мек «0» */}
                                                                    <span className="game-player-vp-check" aria-hidden="true">
                                                                      <i className="fa-solid fa-check" />
                                                                    </span>
                                                                    <span className="game-player-vp-value">{p.secrets}</span>
                                                                    {canAdminBoard && <span className="game-player-vp-side" aria-hidden="true" />}
                                                                </div>

                                                                <div className="game-player-stat game-player-vp-row">
                                                                    <div className="game-player-vp-label">
                                                                      <span className="game-player-vp-kicker">Мек</span>
                                                                    </div>
                                                                    {canAdminBoard ? (
                                                                      <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => adjustMecatol(p.id, -1)}
                                                                            disabled={p.extra <= 0}
                                                                            className="game-player-vp-side is-btn"
                                                                            aria-label="Мекатол −1"
                                                                        >–</button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                              if (custodiansPlayerId == null) {
                                                                                claimCustodiansFor(p);
                                                                              }
                                                                            }}
                                                                            title={
                                                                              hasMecatolControl
                                                                                ? 'Контроль Мекатол Рекс'
                                                                                : custodiansPlayerId == null
                                                                                  ? 'Нажмите: отметить захват Мекатола (Хранители)'
                                                                                  : 'Счётчик Мекатола'
                                                                            }
                                                                            className={`game-player-vp-value is-mek ${
                                                                              hasMecatolControl
                                                                                ? 'is-control'
                                                                                : custodiansPlayerId == null
                                                                                  ? 'is-claimable'
                                                                                  : ''
                                                                            }`}
                                                                        >
                                                                            {mecatolShown}
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onMecatolPlus(p)}
                                                                            className="game-player-vp-side is-btn is-plus"
                                                                            aria-label="Мекатол +1"
                                                                        >+</button>
                                                                      </>
                                                                    ) : (
                                                                      <span className={`game-player-vp-value is-mek ${hasMecatolControl ? 'is-control' : ''}`}>
                                                                          {mecatolShown}
                                                                      </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    {/* ПРАВАЯ КОЛОНКА: ПУБЛИЧНЫЕ ЗАДАНИЯ (2 СТОЛБЦА) */}
                                    <ObjectivesPanel
                                        objectives={objectives}
                                        completions={completions}
                                        expandedObjectives={expandedObjectives}
                                        toggleExpand={toggleExpand}
                                        removeObjective={removeObjective}
                                        addRandomObjective={addRandomObjective}
                                        addCustomObjective={addCustomObjective}
                                        players={players}
                                        canAdminBoard={canAdminBoard}
                                        canToggleFor={canToggleFor}
                                        onObjectiveClick={onObjectiveClick}
                                        spotlightObjectiveId={spotlightObjectiveId}
                                        spotlightReady={spotlightReady}
                                        canRevealPublic={canRevealPublic}
                                    />

                                </div>

                                {secretsSheet && (
                                  <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
                                    <div
                                      role="dialog"
                                      aria-modal="true"
                                      className="game-modal-panel max-w-md w-full p-5 space-y-3"
                                    >
                                      <h3 className="game-modal-title text-sm uppercase">
                                        Секреты: {secretsSheet.name}
                                      </h3>
                                      {secretsSheet.hand.length === 0 ? (
                                        <p className="text-sm text-[var(--game-muted)]">В руке пусто.</p>
                                      ) : (
                                        <ul className="space-y-2">
                                          {secretsSheet.hand.map((id) => {
                                            const card = secretObjectiveById.get(id);
                                            return (
                                              <li key={id} className="rounded-xl border border-violet-700/50 bg-violet-950/20 px-3 py-2 text-sm text-slate-200 space-y-1">
                                                <div className="font-bold text-white">{card?.title || id}</div>
                                                {card?.desc && <p className="text-xs text-slate-400">{card.desc}</p>}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                      <button
                                        type="button"
                                        className="game-btn-primary w-full"
                                        onClick={() => setSecretsSheet(null)}
                                      >
                                        Закрыть
                                      </button>
                                    </div>
                                  </div>
                                )}
                            </div>
  );
}
