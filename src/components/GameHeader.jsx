import { useEffect, useId, useRef, useState } from 'react';
import brandMark from '../assets/brand-mark.png';
import { ROLE_LABELS, ROLES } from '../sync/permissions';
import { formatTime } from '../utils/game';

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
    <div className="relative flex-shrink-0 game-header-room" ref={rootRef}>
      {/* Desktop: full code + role */}
      <div className="hidden md:flex items-center gap-2 h-9 game-header-room-chip">
        <i className="fa-solid fa-wifi" aria-hidden="true" />
        <span className="game-header-room-code">{room.roomId}</span>
        <span className="game-header-room-role">{roleLabel}</span>
      </div>

      {/* Mobile: wifi only; tap reveals room code */}
      <button
        type="button"
        className="md:hidden game-header-room-btn"
        aria-expanded={expanded}
        aria-label={expanded ? `Комната ${room.roomId}` : 'Показать код комнаты'}
        title="Код комнаты"
        onClick={() => setExpanded((v) => !v)}
      >
        <i className="fa-solid fa-wifi" aria-hidden="true" />
      </button>

      {expanded && (
        <div role="status" className="md:hidden game-header-room-pop">
          <div className="game-header-room-code">{room.roomId}</div>
          <div className="game-header-room-role">{roleLabel}</div>
        </div>
      )}
    </div>
  );
}

export function GameHeader({
  isGameActive,
  roundNumber,
  roundTime = 0,
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
  onOpenCombat,
  room,
  roomStatus,
  perms,
  compactBrand = false,
  onLeaveRoom,
  victoryLocked = false,
}) {
  const role = perms?.role || ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const isViewer = role === ROLES.VIEWER;
  const canPhases = isAdmin && !victoryLocked;
  const canExport = isAdmin;
  const canEndGame = isAdmin;
  const canCombat = isAdmin && !victoryLocked;
  const canUndoLast = isAdmin && typeof onUndoLast === 'function';

  const hasMoreItems = canPhases || canExport || canEndGame || canUndoLast;
  const leaveButton = typeof onLeaveRoom === 'function' && isViewer ? (
    <button
      type="button"
      onClick={onLeaveRoom}
      className={`${CTRL} game-header-btn game-header-btn--danger`}
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
      className={`${CTRL} game-header-btn ${canUndo ? '' : 'opacity-50 cursor-not-allowed'}`}
    >
      <i className="fa-solid fa-rotate-left" aria-hidden="true" />
      <span className="max-md:hidden">Отменить</span>
    </button>
  ) : null;

  return (
    <header
      className={`game-header flex-shrink-0 z-30 ${
        compactBrand
          ? 'max-md:rounded-none max-md:static max-md:px-3 max-md:py-2.5 md:p-4 md:sticky md:top-0 md:rounded-b-2xl'
          : 'p-4 sticky top-0 rounded-b-2xl'
      }${!isGameActive ? ' game-header--lobby' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 md:gap-3 flex-nowrap">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img
              src={brandMark}
              alt=""
              width={32}
              height={32}
              className="game-header-mark h-7 w-7 md:h-9 md:w-9 flex-shrink-0 object-contain"
              draggable={false}
            />
            <span className={`game-header-brand truncate ${compactBrand ? 'max-md:text-base' : ''}`}>
              TI4 TRACKER
            </span>
          </div>
          {roomStatus === 'live' && room?.roomId && (
            <RoomLiveBadge room={room} />
          )}
          {isGameActive && (
            <div className={`${CTRL} game-header-round !text-sm md:!text-base cursor-default flex-shrink-0 px-3.5 gap-2 md:gap-3`}>
              <span className="max-md:hidden">Раунд {roundNumber}</span>
              <span className="md:hidden">R{roundNumber}</span>
              <span className="game-header-round-sep" aria-hidden="true" />
              <span
                className="font-mono game-header-round-time tabular-nums"
                title="Время текущего раунда (фаза действий)"
              >
                {formatTime(roundTime)}
              </span>
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
                        ? 'game-header-btn opacity-50 cursor-not-allowed'
                        : 'game-btn-primary !h-9 !py-0 !text-xs'
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
                          ? 'game-btn-primary !h-9 !py-0 !text-xs'
                          : 'game-header-btn opacity-50 cursor-not-allowed'
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
                          ? 'game-btn-primary !h-9 !py-0 !text-xs'
                          : 'game-header-btn opacity-50 cursor-not-allowed'
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
                    canCombat={canCombat}
                    isPoliticsActive={isPoliticsActive}
                    onTogglePolitics={onTogglePolitics}
                    onExport={onExport}
                    onOpenEndGame={onOpenEndGame}
                    onOpenEventLog={onOpenEventLog}
                    onOpenTech={onOpenTech}
                    onOpenExpedition={onOpenExpedition}
                    onOpenCombat={onOpenCombat}
                    onOpenStats={onOpenStats}
                  />
                )}
                {undoButton}
                {!hasMoreItems && onOpenTech && (
                  <button
                    type="button"
                    onClick={onOpenTech}
                    className={`${CTRL} game-header-btn`}
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
                    className={`${CTRL} game-header-btn`}
                    title="Журнал партии"
                  >
                    <i className="fa-solid fa-scroll" />
                    <span className="max-md:hidden">Журнал</span>
                  </button>
                )}
                {leaveButton}
              </div>

              {/* Mobile: primary phase controls + overflow for secondary tools */}
              <div className="flex md:hidden items-center gap-2 flex-nowrap justify-end">
                {leaveButton}
                {undoButton}
                {canPhases && (
                  <button
                    type="button"
                    onClick={onOpenDraft}
                    disabled={roundActive || isDraftLocked}
                    title={isDraftLocked ? 'Карты уже выбраны — дождитесь конца раунда' : undefined}
                    aria-label="Драфт стратегий"
                    className="game-btn-primary !px-3 !py-2 !text-xs disabled:opacity-45"
                  >
                    <i className="fa-solid fa-layer-group" aria-hidden="true" />
                    Драфт
                  </button>
                )}
                {canPhases && (
                  !roundActive ? (
                    <button
                      type="button"
                      onClick={onStartRound}
                      disabled={!canStartRound}
                      aria-label="Начать раунд"
                      className={`!px-3 !py-2 !text-xs ${
                        canStartRound
                          ? 'game-btn-primary'
                          : 'game-header-btn opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-play" aria-hidden="true" />
                      Раунд
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onEndRound}
                      disabled={!canEndRound}
                      title={canEndRound ? undefined : endRoundDisabledTitle}
                      aria-label="Завершить раунд"
                      className={`!px-3 !py-2 !text-xs ${
                        canEndRound
                          ? 'game-btn-primary'
                          : 'game-header-btn opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-flag-checkered" aria-hidden="true" />
                      Конец
                    </button>
                  )
                )}
                <HeaderMoreMenu
                  compact
                  canPhases={canPhases}
                  canExport={canExport}
                  canEndGame={canEndGame}
                  canCombat={canCombat}
                  isPoliticsActive={isPoliticsActive}
                  onTogglePolitics={onTogglePolitics}
                  onExport={onExport}
                  onOpenEndGame={onOpenEndGame}
                  onOpenEventLog={onOpenEventLog}
                  onOpenTech={onOpenTech}
                  onOpenExpedition={onOpenExpedition}
                  onOpenCombat={onOpenCombat}
                  onOpenStats={onOpenStats}
                />
              </div>
            </>
          ) : (
            <>
              {leaveButton}
              {onOpenStats && (
                <button
                  type="button"
                  onClick={onOpenStats}
                  className={`${CTRL} game-header-btn`}
                >
                  <i className="fa-solid fa-chart-simple" aria-hidden="true" />
                  <span className="max-md:hidden">Статистика</span>
                </button>
              )}
              <div className={`${CTRL} game-header-status cursor-default`}>
                Ожидание
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderMoreMenu({
  compact = false,
  canPhases,
  canExport,
  canEndGame,
  canCombat = false,
  isPoliticsActive,
  onTogglePolitics,
  onExport,
  onOpenEndGame,
  onOpenEventLog,
  onOpenTech,
  onOpenExpedition,
  onOpenCombat,
  onOpenStats,
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
        aria-label="Ещё"
        onClick={() => setOpen(v => !v)}
        className={`${CTRL} ${compact ? 'w-9 px-0' : ''} ${
          open
            ? 'bg-slate-800 border-slate-600 text-white'
            : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
        }`}
      >
        {compact ? (
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
        ) : (
          <>
            <span>Ещё</span>
            <i className={`fa-solid fa-chevron-down text-[10px] transition ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 rounded-2xl border border-[var(--game-line-gold)] bg-[rgba(10,12,18,0.96)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_24px_rgba(201,162,39,0.12)] backdrop-blur-md"
        >
          {canPhases && (
            <>
              <div
                role="menuitem"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[var(--game-text)]"
              >
                <i className={`fa-solid fa-landmark w-4 text-center ${isPoliticsActive ? 'text-[var(--game-gold-bright)]' : 'text-[var(--game-muted)]'}`} />
                <span className="flex-1">Политика</span>
                <button
                  type="button"
                  onClick={() => onTogglePolitics()}
                  title={isPoliticsActive ? 'Выключить фазу политики' : 'Включить фазу политики'}
                  aria-label="Переключить политику"
                  className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 flex-shrink-0 ${
                    isPoliticsActive ? 'bg-[var(--game-gold)] justify-end' : 'bg-black/50 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 bg-white rounded-full block" />
                </button>
              </div>

              <div className="my-1 border-t border-[var(--game-line)]" />
            </>
          )}

          {canExport && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onExport)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-share-nodes w-4 text-center text-[var(--game-gold-bright)]" />
              <span className="flex-1">Код игры</span>
            </button>
          )}

          {onOpenStats && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenStats)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-chart-pie w-4 text-center text-[var(--game-gold-bright)]" />
              <span className="flex-1">Статистика</span>
            </button>
          )}

          {canCombat && onOpenCombat && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenCombat)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-crosshairs w-4 text-center text-red-400" />
              <span className="flex-1">Бой</span>
            </button>
          )}

          {onOpenTech && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenTech)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-atom w-4 text-center text-[var(--game-gold-bright)]" />
              <span className="flex-1">Технологии</span>
            </button>
          )}

          {onOpenExpedition && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenExpedition)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-mountain w-4 text-center text-[var(--game-gold-bright)]" />
              <span className="flex-1">Экспедиция</span>
            </button>
          )}

          {onOpenEventLog && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEventLog)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-[var(--game-text)] hover:bg-[rgba(201,162,39,0.1)] transition"
            >
              <i className="fa-solid fa-scroll w-4 text-center text-[var(--game-gold-bright)]" />
              <span className="flex-1">Журнал партии</span>
            </button>
          )}

          {canEndGame && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEndGame)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-red-300 hover:bg-red-950/40 transition"
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
