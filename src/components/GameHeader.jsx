import { useEffect, useId, useRef, useState } from 'react';
import { ActiveTurnBar } from './ActiveTurnBar';
import { ROLE_LABELS, ROLES } from '../sync/permissions';

const CTRL =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition border';

function RoomLiveBadge({ room }) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!expanded) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setExpanded(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  const roleLabel = ROLE_LABELS[room.role] || room.role;

  return (
    <div className="relative flex-shrink-0" ref={rootRef}>
      {/* Desktop: full code + role */}
      <div className="hidden md:flex items-center gap-2 h-9 bg-slate-950 border border-emerald-800/80 text-emerald-300 font-orbitron font-bold text-xs px-3 rounded-xl">
        <i className="fa-solid fa-wifi" aria-hidden="true" />
        <span>{room.roomId}</span>
        <span className="text-emerald-500/80 font-sans font-semibold normal-case">
          {roleLabel}
        </span>
      </div>

      {/* Mobile: wifi only; tap reveals room code */}
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl bg-slate-950 border border-emerald-800/80 text-emerald-300"
        aria-expanded={expanded}
        aria-label={expanded ? `Комната ${room.roomId}` : 'Показать код комнаты'}
        title="Код комнаты"
        onClick={() => setExpanded(v => !v)}
      >
        <i className="fa-solid fa-wifi" aria-hidden="true" />
      </button>

      {expanded && (
        <div
          role="status"
          className="md:hidden absolute left-0 top-[calc(100%+6px)] z-50 min-w-[9.5rem] rounded-xl border border-emerald-800/80 bg-slate-950 px-3 py-2 shadow-xl"
        >
          <div className="font-orbitron font-bold text-sm text-emerald-300 tracking-wider">
            {room.roomId}
          </div>
          <div className="text-[11px] text-emerald-500/80 font-semibold mt-0.5">
            {roleLabel}
          </div>
        </div>
      )}
    </div>
  );
}

export function GameHeader({
  isGameActive,
  roundNumber,
  isPoliticsActive,
  onTogglePolitics,
  roundActive,
  isDraftLocked,
  canStartRound,
  onOpenDraft,
  onStartRound,
  onEndRound,
  canEndRound = false,
  endRoundDisabledTitle = 'Сначала все игроки должны спасовать',
  onExport,
  onOpenEndGame,
  onOpenStats,
  onOpenEventLog,
  onOpenExpedition,
  onOpenTech,
  onUndoLast,
  canUndo = false,
  turnOrder,
  activePlayer,
  passed,
  strategyCards,
  allStrategiesPlayed,
  strategyActionTaken,
  strategyResolutionActive = false,
  resolvingCardId = null,
  imperialClaimActive = false,
  techResearchActive = false,
  onPlayStrategy,
  turnTime,
  onNextTurn,
  onPassTurn,
  onOpenCombat,
  room,
  roomStatus,
  perms,
  hideTurnBarOnMobile = false,
  onLeaveRoom,
}) {
  const role = perms?.role || ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const isViewer = role === ROLES.VIEWER;
  const canPhases = isAdmin;
  const canExport = isAdmin;
  const canEndGame = isAdmin;
  const canCombat = isAdmin;
  const canUndoLast = isAdmin && typeof onUndoLast === 'function';
  const canPlayTurn = isAdmin || role === ROLES.PLAYER;
  const canNextTurn = isAdmin || role === ROLES.PLAYER;

  const turnLocked = strategyResolutionActive || imperialClaimActive || techResearchActive;

  const seatIsActive = !perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId;
  const showTurnBar = isGameActive && turnOrder.length > 0 && activePlayer && !passed[activePlayer.id]
    && (isAdmin || canPlayTurn || role === ROLES.VIEWER);

  const hasMoreItems = canPhases || canExport || canEndGame || canUndoLast;
  const leaveButton = typeof onLeaveRoom === 'function' && isViewer ? (
    <button
      type="button"
      onClick={onLeaveRoom}
      className={`${CTRL} bg-slate-950 hover:bg-rose-950/60 border-rose-800/70 text-rose-300`}
      title="Покинуть комнату"
    >
      <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
      <span>Выйти</span>
    </button>
  ) : null;
  const undoButton = canUndoLast ? (
    <button
      type="button"
      onClick={onUndoLast}
      disabled={!canUndo}
      title={canUndo ? 'Отменить последнее действие' : 'Нечего отменять'}
      className={`${CTRL} ${
        canUndo
          ? 'bg-slate-950 hover:bg-orange-950/50 border-orange-800/70 text-orange-300'
          : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
      }`}
    >
      <i className="fa-solid fa-rotate-left" aria-hidden="true" />
      <span className="max-md:hidden">Отменить</span>
    </button>
  ) : null;

  return (
    <header
      className={`bg-slate-900 border-b border-slate-800 shadow-xl flex-shrink-0 z-30 ${
        hideTurnBarOnMobile
          ? 'max-md:rounded-none max-md:static max-md:px-3 max-md:py-2.5 md:p-4 md:sticky md:top-0 md:rounded-b-2xl'
          : 'p-4 sticky top-0 rounded-b-2xl'
      }`}
    >
      <div className="flex items-center justify-between gap-2 md:gap-3 flex-nowrap">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <i className="fa-solid fa-khanda text-cyan-400 text-2xl md:text-3xl flex-shrink-0" />
            <span className={`font-orbitron font-black text-xl md:text-3xl text-white tracking-wider truncate ${hideTurnBarOnMobile ? 'max-md:text-base' : ''}`}>
              TI4 TRACKER
            </span>
          </div>
          {roomStatus === 'live' && room?.roomId && (
            <RoomLiveBadge room={room} />
          )}
          {isGameActive && (
            <div className={`${CTRL} !text-sm md:!text-base bg-slate-950 border-slate-800 text-amber-400 font-orbitron cursor-default flex-shrink-0 px-3.5`}>
              <span className="max-md:hidden">Раунд {roundNumber}</span>
              <span className="md:hidden">R{roundNumber}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isGameActive ? (
            <>
              {/* Desktop host: Primary + overflow (variant B) */}
              <div className="hidden md:flex items-center gap-2">
                {canPhases && (
                  <button
                    type="button"
                    onClick={onOpenDraft}
                    disabled={roundActive || isDraftLocked}
                    title={isDraftLocked ? 'Карты уже выбраны — дождитесь конца раунда' : undefined}
                    className={`${CTRL} ${
                      roundActive || isDraftLocked
                        ? 'bg-slate-800 border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 border-amber-400/30 text-slate-950'
                    }`}
                  >
                    <i className="fa-solid fa-layer-group" />
                    Драфт стратегий
                  </button>
                )}

                {canPhases && (
                  !roundActive ? (
                    <button
                      type="button"
                      onClick={onStartRound}
                      disabled={!canStartRound}
                      className={`${CTRL} ${
                        canStartRound
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500/40 text-white'
                          : 'bg-slate-800 border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-play" />
                      Начать раунд
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onEndRound}
                      disabled={!canEndRound}
                      title={canEndRound ? undefined : endRoundDisabledTitle}
                      className={`${CTRL} ${
                        canEndRound
                          ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500/40 text-white'
                          : 'bg-slate-800 border-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-flag-checkered" />
                      Завершить раунд
                    </button>
                  )
                )}

                {hasMoreItems && (
                  <HeaderMoreMenu
                    canPhases={canPhases}
                    canExport={canExport}
                    canEndGame={canEndGame}
                    isPoliticsActive={isPoliticsActive}
                    onTogglePolitics={onTogglePolitics}
                    onExport={onExport}
                    onOpenEndGame={onOpenEndGame}
                    onOpenEventLog={onOpenEventLog}
                    onOpenTech={onOpenTech}
                    onOpenExpedition={onOpenExpedition}
                  />
                )}
                {undoButton}
                {!hasMoreItems && onOpenTech && (
                  <button
                    type="button"
                    onClick={onOpenTech}
                    className={`${CTRL} bg-slate-950 hover:bg-slate-800 border-sky-800/60 text-sky-300`}
                    title="Технологии"
                  >
                    <i className="fa-solid fa-atom" />
                    <span className="max-md:hidden">Тех</span>
                  </button>
                )}
                {!hasMoreItems && onOpenEventLog && (
                  <button
                    type="button"
                    onClick={onOpenEventLog}
                    className={`${CTRL} bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300`}
                    title="Журнал партии"
                  >
                    <i className="fa-solid fa-scroll" />
                    <span className="max-md:hidden">Журнал</span>
                  </button>
                )}
                {leaveButton}
              </div>

              {/* Mobile: full classic controls (unchanged layout) */}
              <div className="flex md:hidden items-center gap-2 flex-nowrap justify-end">
                {leaveButton}
                {canUndoLast && (
                  <button
                    type="button"
                    onClick={onUndoLast}
                    disabled={!canUndo}
                    title={canUndo ? 'Отменить последнее действие' : 'Нечего отменять'}
                    aria-label="Отменить"
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border transition shadow ${
                      canUndo
                        ? 'bg-slate-950 hover:bg-orange-950/50 border-orange-800/70 text-orange-300'
                        : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                  </button>
                )}
                {canPhases && (
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <span className={`font-bold text-xs uppercase ${isPoliticsActive ? 'text-purple-400' : 'text-slate-500'}`}>
                      Пол.
                    </span>
                    <button
                      type="button"
                      onClick={onTogglePolitics}
                      title={isPoliticsActive ? 'Деактивировать фазу политики' : 'Активировать фазу политики (после взятия Мекатола)'}
                      className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${isPoliticsActive ? 'bg-purple-600 justify-end' : 'bg-slate-700 justify-start'}`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full block shadow-md" />
                    </button>
                  </div>
                )}

                {canPhases && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={onOpenDraft}
                      disabled={roundActive || isDraftLocked}
                      title={isDraftLocked ? 'Карты уже выбраны — дождитесь конца раунда' : undefined}
                      className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition border border-amber-400/30 shadow-md flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-layer-group" />
                      Драфт
                    </button>

                    {!roundActive ? (
                      <button
                        type="button"
                        onClick={onStartRound}
                        disabled={!canStartRound}
                        className={`font-bold px-3 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 ${
                          canStartRound
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <i className="fa-solid fa-play" />
                        Раунд
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onEndRound}
                        disabled={!canEndRound}
                        title={canEndRound ? undefined : endRoundDisabledTitle}
                        className={`font-bold px-3 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 ${
                          canEndRound
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <i className="fa-solid fa-flag-checkered" />
                        Конец
                      </button>
                    )}
                  </div>
                )}

                {canExport && (
                  <button
                    type="button"
                    onClick={onExport}
                    className="bg-cyan-950/80 hover:bg-cyan-900 text-cyan-400 font-extrabold px-3 py-2 rounded-xl text-xs border border-cyan-800 transition flex items-center gap-1.5 shadow"
                    title="Скопировать токен партии"
                  >
                    <i className="fa-solid fa-share-nodes" />
                  </button>
                )}

                {onOpenTech && (
                  <button
                    type="button"
                    onClick={onOpenTech}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-slate-950 hover:bg-slate-800 text-sky-300 border border-sky-800/60 transition shadow"
                    title="Технологии"
                    aria-label="Технологии"
                  >
                    <i className="fa-solid fa-atom" />
                  </button>
                )}

                {onOpenExpedition && (
                  <button
                    type="button"
                    onClick={onOpenExpedition}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-800/60 transition shadow"
                    title="Экспедиция Грозового рубежа"
                    aria-label="Экспедиция"
                  >
                    <i className="fa-solid fa-mountain" />
                  </button>
                )}

                {onOpenEventLog && (
                  <button
                    type="button"
                    onClick={onOpenEventLog}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 transition shadow"
                    title="Журнал партии"
                    aria-label="Журнал партии"
                  >
                    <i className="fa-solid fa-scroll" />
                  </button>
                )}

                {canEndGame && (
                  <button
                    type="button"
                    onClick={onOpenEndGame}
                    className="bg-red-900/80 hover:bg-red-800 text-red-200 font-extrabold px-3 py-2 rounded-xl text-xs border border-red-700 transition flex items-center gap-1.5 shadow"
                  >
                    <i className="fa-solid fa-square-xmark" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenStats}
                className={`${CTRL} bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200`}
              >
                <i className="fa-solid fa-chart-pie" />
                <span className="max-md:hidden">Статистика</span>
              </button>
              <div className={`${CTRL} bg-slate-950 border-cyan-900/60 text-cyan-400 font-orbitron uppercase tracking-wider cursor-default max-md:hidden`}>
                Настройка
              </div>
            </>
          )}
        </div>
      </div>

      {showTurnBar && (
        <div className={hideTurnBarOnMobile ? 'hidden md:block' : undefined}>
          <ActiveTurnBar
            activePlayer={activePlayer}
            strategyCards={strategyCards}
            allStrategiesPlayed={allStrategiesPlayed}
            strategyActionTaken={strategyActionTaken}
            strategyResolutionActive={strategyResolutionActive || imperialClaimActive || techResearchActive}
            resolvingCardId={resolvingCardId}
            onPlayStrategy={onPlayStrategy}
            turnTime={turnTime}
            onNextTurn={onNextTurn}
            onPassTurn={onPassTurn}
            onOpenCombat={onOpenCombat}
            canPlay={canPlayTurn && seatIsActive}
            canNextTurn={canNextTurn && seatIsActive && !turnLocked}
            canCombat={canCombat}
          />
        </div>
      )}
    </header>
  );
}

function HeaderMoreMenu({
  canPhases,
  canExport,
  canEndGame,
  isPoliticsActive,
  onTogglePolitics,
  onExport,
  onOpenEndGame,
  onOpenEventLog,
  onOpenTech,
  onOpenExpedition,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const runAndClose = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(v => !v)}
        className={`${CTRL} ${
          open
            ? 'bg-slate-800 border-slate-600 text-white'
            : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
        }`}
      >
        <span>Ещё</span>
        <i className={`fa-solid fa-chevron-down text-[10px] transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl border border-slate-700 bg-slate-950 p-1.5 shadow-xl"
        >
          {canPhases && (
            <>
              <div
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-200"
              >
                <i className={`fa-solid fa-landmark w-4 text-center ${isPoliticsActive ? 'text-purple-400' : 'text-slate-500'}`} />
                <span className="flex-1">Политика</span>
                <button
                  type="button"
                  onClick={() => onTogglePolitics()}
                  title={isPoliticsActive ? 'Выключить фазу политики' : 'Включить фазу политики'}
                  className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 flex-shrink-0 ${
                    isPoliticsActive ? 'bg-purple-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full block" />
                </button>
              </div>

              <div className="my-1 border-t border-slate-800" />
            </>
          )}

          {canExport && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onExport)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              <i className="fa-solid fa-share-nodes w-4 text-center text-cyan-400" />
              <span className="flex-1">Код игры</span>
            </button>
          )}

          {onOpenTech && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenTech)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              <i className="fa-solid fa-atom w-4 text-center text-sky-400" />
              <span className="flex-1">Технологии</span>
            </button>
          )}

          {onOpenExpedition && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenExpedition)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              <i className="fa-solid fa-mountain w-4 text-center text-amber-400" />
              <span className="flex-1">Экспедиция</span>
            </button>
          )}

          {onOpenEventLog && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEventLog)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-200 hover:bg-slate-900 transition"
            >
              <i className="fa-solid fa-scroll w-4 text-center text-cyan-400" />
              <span className="flex-1">Журнал партии</span>
            </button>
          )}

          {canEndGame && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEndGame)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-red-300 hover:bg-red-950/50 transition"
            >
              <i className="fa-solid fa-square-xmark w-4 text-center" />
              <span className="flex-1">Завершить партию</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
