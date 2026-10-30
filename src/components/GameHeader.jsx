import { useEffect, useId, useRef, useState } from 'react';
import brandMark from '../assets/brand-mark.png';
import { ROLE_LABELS, ROLES } from '../sync/permissions';
import { formatTime } from '../utils/game';

const CTRL =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition border';

function RoomLiveBadge({ room, seatSecret = null }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
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
  const hasSeatSecret = !!seatSecret;
  const hostKey = room?.hostKey || null;
  const hasHostKey = !!hostKey && room?.role === 'admin';

  const copyText = async (value, mark) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      mark(true);
      window.setTimeout(() => mark(false), 1600);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const copySeatSecret = () => copyText(seatSecret, setCopied);
  const copyRoomCode = () => copyText(room?.roomId, setCopiedRoom);
  const copyHostKey = () => copyText(hostKey, setCopiedHost);

  return (
    <div className="relative flex-shrink-0 game-header-room" ref={rootRef}>
      <button
        type="button"
        className="game-header-room-chip"
        aria-expanded={expanded}
        aria-label={`${roleLabel}. Код комнаты ${room.roomId}`}
        title={`Комната ${room.roomId}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <i className="fa-solid fa-wifi" aria-hidden="true" />
        <span className="game-header-room-role">{roleLabel}</span>
        <i
          className={`fa-solid fa-chevron-down text-[9px] opacity-70 transition ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        className="game-header-room-btn"
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `${roleLabel}, комната ${room.roomId}`
            : hasHostKey
              ? `Подключение: ${roleLabel}. Код комнаты и код хоста`
              : hasSeatSecret
                ? `Подключение: ${roleLabel}. Показать код комнаты и код места`
                : `Подключение: ${roleLabel}. Показать код комнаты`
        }
        title="Подключение"
        onClick={() => setExpanded((v) => !v)}
      >
        <i className="fa-solid fa-wifi" aria-hidden="true" />
      </button>

      {expanded && (
        <div role="status" className="game-header-room-pop">
          <div className="game-header-room-seat">
            <div className="game-header-room-seat-label">Код комнаты</div>
            <div className="game-header-room-seat-row">
              <span className="game-header-room-code game-header-room-seat-code">{room.roomId}</span>
              <button
                type="button"
                className="game-header-room-seat-copy"
                onClick={copyRoomCode}
                aria-label="Скопировать код комнаты"
                title={copiedRoom ? 'Скопировано' : 'Скопировать код комнаты'}
              >
                <i className={`fa-solid ${copiedRoom ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="game-header-room-role">{roleLabel}</div>
          {hasSeatSecret && (
            <div className="game-header-room-seat">
              <div className="game-header-room-seat-label">Код места</div>
              <div className="game-header-room-seat-row">
                <span className="game-header-room-seat-code">{seatSecret}</span>
                <button
                  type="button"
                  className="game-header-room-seat-copy"
                  onClick={copySeatSecret}
                  aria-label="Скопировать код места"
                  title={copied ? 'Скопировано' : 'Скопировать'}
                >
                  <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {hasHostKey && (
            <div className="game-header-room-seat">
              <div className="game-header-room-seat-label">Код хоста</div>
              <div className="game-header-room-seat-row">
                <span className="game-header-room-seat-code is-host-key" title={hostKey}>
                  {String(hostKey).slice(0, 8)}…
                </span>
                <button
                  type="button"
                  className="game-header-room-seat-copy"
                  onClick={copyHostKey}
                  aria-label="Скопировать код хоста"
                  title={copiedHost ? 'Скопировано' : 'Скопировать код хоста'}
                >
                  <i className={`fa-solid ${copiedHost ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
                </button>
              </div>
              <p className="game-header-room-host-hint">
                Перенос на другое устройство: Настройки → «Я хост» + код комнаты и этот ключ.
              </p>
            </div>
          )}
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
  onOpenScoredSecrets,
  onOpenTech,
  onOpenActiveLaws,
  activeLawsCount = 0,
  onUndoLast,
  canUndo = false,
  onOpenCombat,
  room,
  roomStatus,
  perms,
  compactBrand = false,
  onLeaveRoom,
  victoryLocked = false,
  canUsePush = false,
  onOpenPushSettings,
}) {
  const role = perms?.role || ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const isViewer = role === ROLES.VIEWER;
  const canPhases = isAdmin && !victoryLocked;
  const canExport = isAdmin;
  const canEndGame = isAdmin;
  const canCombat = isAdmin && !victoryLocked;
  const canUndoLast = isAdmin && typeof onUndoLast === 'function';
  const canPushSettings = !!canUsePush && typeof onOpenPushSettings === 'function';
  const canViewLaws = typeof onOpenActiveLaws === 'function';

  const hasMoreItems = canPhases || canExport || canEndGame || canUndoLast || canPushSettings
    || canViewLaws || typeof onOpenScoredSecrets === 'function';
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
              alt="TI4 Tracker"
              width={32}
              height={32}
              className="game-header-mark h-7 w-7 md:h-9 md:w-9 flex-shrink-0 object-contain"
              draggable={false}
            />
            <span className="game-header-brand truncate max-md:hidden">
              TI4 TRACKER
            </span>
          </div>
          {roomStatus === 'live' && room?.roomId && (
            <RoomLiveBadge room={room} seatSecret={room?.seatSecret || null} />
          )}
          {isGameActive && (
            <div className={`${CTRL} game-header-round hidden md:inline-flex !text-sm md:!text-base cursor-default flex-shrink-0 px-3.5 gap-2 md:gap-3`}>
              <span className="game-header-round-label">Раунд {roundNumber}</span>
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
          {isGameActive && (
            <div className={`${CTRL} game-header-round md:hidden !text-sm cursor-default flex-shrink-0 px-3 gap-2`}>
              <span className="game-header-round-label">R{roundNumber}</span>
              <span className="game-header-round-sep" aria-hidden="true" />
              <span
                className="font-mono game-header-round-time tabular-nums"
                title="Время текущего раунда (фаза действий)"
              >
                {formatTime(roundTime)}
              </span>
            </div>
          )}
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
                    className={`${CTRL} game-header-btn ${
                      roundActive || isDraftLocked ? 'opacity-50 cursor-not-allowed' : ''
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
                      className={`${CTRL} game-header-btn ${
                        canEndRound ? '' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-flag-checkered" />
                      Завершить раунд
                    </button>
                  )
                )}

                {canViewLaws && (
                  <button
                    type="button"
                    onClick={onOpenActiveLaws}
                    className={`${CTRL} game-header-btn`}
                    title="Активные законы"
                  >
                    <i className="fa-solid fa-scroll" aria-hidden="true" />
                    <span className="max-md:hidden">Законы</span>
                    {activeLawsCount > 0 && (
                      <span className="game-header-laws-count">{activeLawsCount}</span>
                    )}
                  </button>
                )}
                {hasMoreItems && (
                  <HeaderMoreMenu
                    canPhases={canPhases}
                    canExport={canExport}
                    canEndGame={canEndGame}
                    canCombat={canCombat}
                    canPushSettings={canPushSettings}
                    canViewLaws={canViewLaws}
                    isPoliticsActive={isPoliticsActive}
                    onTogglePolitics={onTogglePolitics}
                    onExport={onExport}
                    onOpenEndGame={onOpenEndGame}
                    onOpenEventLog={onOpenEventLog}
                    onOpenTech={onOpenTech}
                    onOpenExpedition={onOpenExpedition}
                    onOpenScoredSecrets={onOpenScoredSecrets}
                    onOpenCombat={onOpenCombat}
                    onOpenStats={onOpenStats}
                    onOpenActiveLaws={onOpenActiveLaws}
                    activeLawsCount={activeLawsCount}
                    onOpenPushSettings={onOpenPushSettings}
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
                {canViewLaws && (
                  <button
                    type="button"
                    onClick={onOpenActiveLaws}
                    className={`${CTRL} game-header-btn !px-2.5`}
                    title="Активные законы"
                    aria-label="Активные законы"
                  >
                    <i className="fa-solid fa-scroll" aria-hidden="true" />
                    {activeLawsCount > 0 && (
                      <span className="game-header-laws-count">{activeLawsCount}</span>
                    )}
                  </button>
                )}
                <HeaderMoreMenu
                  compact
                  canPhases={canPhases}
                  canExport={canExport}
                  canEndGame={canEndGame}
                  canCombat={canCombat}
                  canPushSettings={canPushSettings}
                  canViewLaws={canViewLaws}
                  isPoliticsActive={isPoliticsActive}
                  onTogglePolitics={onTogglePolitics}
                  onExport={onExport}
                  onOpenEndGame={onOpenEndGame}
                  onOpenEventLog={onOpenEventLog}
                  onOpenTech={onOpenTech}
                  onOpenExpedition={onOpenExpedition}
                  onOpenScoredSecrets={onOpenScoredSecrets}
                  onOpenCombat={onOpenCombat}
                  onOpenStats={onOpenStats}
                  onOpenActiveLaws={onOpenActiveLaws}
                  activeLawsCount={activeLawsCount}
                  onOpenPushSettings={onOpenPushSettings}
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
  canPushSettings = false,
  canViewLaws = false,
  isPoliticsActive,
  onTogglePolitics,
  onExport,
  onOpenEndGame,
  onOpenEventLog,
  onOpenTech,
  onOpenExpedition,
  onOpenScoredSecrets,
  onOpenCombat,
  onOpenStats,
  onOpenActiveLaws,
  activeLawsCount = 0,
  onOpenPushSettings,
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
    <div className={`hdr-more ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Ещё"
        onClick={() => setOpen((v) => !v)}
        className={`${CTRL} game-header-btn hdr-more-trigger ${compact ? 'is-compact' : ''} ${
          open ? 'is-open' : ''
        }`}
      >
        {compact ? (
          <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
        ) : (
          <>
            <span>Ещё</span>
            <i
              className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px]`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        <div id={menuId} role="menu" className="hdr-more-panel">
          {canPhases && (
            <div role="menuitem" className="hdr-more-item is-toggle">
              <span className="hdr-more-ico is-gold" aria-hidden="true">
                <i className="fa-solid fa-landmark" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Политика</span>
                <span className="hdr-more-desc">Включить / отключить трек политики</span>
              </div>
              <button
                type="button"
                onClick={() => onTogglePolitics()}
                title={isPoliticsActive ? 'Выключить фазу политики' : 'Включить фазу политики'}
                aria-label="Переключить политику"
                className={`hdr-more-switch ${isPoliticsActive ? 'is-on' : ''}`}
              >
                <span className="hdr-more-switch-knob" />
              </button>
            </div>
          )}

          {canViewLaws && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenActiveLaws)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-gold" aria-hidden="true">
                <i className="fa-solid fa-scroll" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Активные законы</span>
                <span className="hdr-more-desc">
                  {activeLawsCount > 0 ? `${activeLawsCount} в игре` : 'Пока пусто'}
                </span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {canExport && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onExport)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-gold" aria-hidden="true">
                <i className="fa-solid fa-share-nodes" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Код игры</span>
                <span className="hdr-more-desc">Показать код для входа</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {onOpenStats && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenStats)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-blue" aria-hidden="true">
                <i className="fa-solid fa-chart-pie" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Статистика</span>
                <span className="hdr-more-desc">Просмотр статистики партии</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {canCombat && onOpenCombat && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenCombat)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-red" aria-hidden="true">
                <i className="fa-solid fa-crosshairs" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Бой</span>
                <span className="hdr-more-desc">Разрешения и настройки боя</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {onOpenTech && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenTech)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-violet" aria-hidden="true">
                <i className="fa-solid fa-gears" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Технологии</span>
                <span className="hdr-more-desc">Настройки колоды технологий</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {onOpenExpedition && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenExpedition)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-amber" aria-hidden="true">
                <i className="fa-solid fa-mountain" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Экспедиция</span>
                <span className="hdr-more-desc">Thunder&apos;s Edge и прорывы</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {onOpenScoredSecrets && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenScoredSecrets)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-violet" aria-hidden="true">
                <i className="fa-solid fa-user-secret" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Достигнутые секретки</span>
                <span className="hdr-more-desc">Какие секретные цели уже засчитаны</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {onOpenEventLog && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEventLog)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-teal" aria-hidden="true">
                <i className="fa-solid fa-scroll" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Журнал партии</span>
                <span className="hdr-more-desc">История событий и действий</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {canPushSettings && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenPushSettings)}
              className="hdr-more-item"
            >
              <span className="hdr-more-ico is-blue" aria-hidden="true">
                <i className="fa-solid fa-bell" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Оповещения</span>
                <span className="hdr-more-desc">Вкл / выкл и выбор типов пушей</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}

          {canEndGame && (
            <button
              type="button"
              role="menuitem"
              onClick={runAndClose(onOpenEndGame)}
              className="hdr-more-item is-danger"
            >
              <span className="hdr-more-ico is-danger" aria-hidden="true">
                <i className="fa-solid fa-square-xmark" />
              </span>
              <div className="hdr-more-copy">
                <span className="hdr-more-title">Завершить партию</span>
                <span className="hdr-more-desc">Закрыть текущую партию и сохранить итог</span>
              </div>
              <i className="fa-solid fa-chevron-right hdr-more-chev" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
