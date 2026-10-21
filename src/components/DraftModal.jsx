import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';

const HOST_CARD_CLICK_DELAY_MS = 260;
/** Mobile double-tap window — must be ≥ this before opening preview, or the 2nd tap hits the lightbox. */
const MOBILE_DOUBLE_TAP_MS = 320;

function factionOf(player) {
  return ALL_FACTIONS.find((f) => f.id === player?.factionId) || null;
}

const CARD_GLOW = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#22c55e',
  5: '#14b8a6',
  6: '#06b6d4',
  7: '#3b82f6',
  8: '#a855f7',
};

function tradeGoodBonusForCard(strategyCardBonuses, cardId) {
  const raw = strategyCardBonuses?.[cardId] ?? strategyCardBonuses?.[String(cardId)];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function strategyCardLabel(card) {
  return String(card?.ruName || card?.name || '')
    .replace(/^\d+\.\s*/, '')
    .trim() || card?.name || '—';
}

function playerHasCard(draftAssignments, playerId) {
  return Object.values(draftAssignments || {}).some((ownerId) => ownerId === playerId);
}

/** Host desktop: player status rail (left) — ranked by VP high → low. */
function DraftScoreRail({
  players = [],
  currentPickerId,
  draftAssignments = {},
  getPlayerScore,
}) {
  const scoreOf = (p) => (
    typeof getPlayerScore === 'function' ? getPlayerScore(p.id) : (p.score ?? 0)
  );
  const seats = players
    .filter((p) => !p.eliminated)
    .slice()
    .sort((a, b) => {
      const diff = scoreOf(b) - scoreOf(a);
      if (diff !== 0) return diff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    });

  return (
    <aside className="draft-rail draft-rail-tablo hidden md:flex">
      <div className="draft-rail-head">
        <span className="draft-rail-head-title">
          <i className="fa-solid fa-trophy" aria-hidden="true" />
          Табло
        </span>
      </div>
      <ul className="draft-rail-list modal-scroll">
        {seats.map((p) => {
          const isCurrent = currentPickerId != null && p.id === currentPickerId;
          const picked = playerHasCard(draftAssignments, p.id);
          const score = scoreOf(p);
          return (
            <li
              key={p.id}
              className={`draft-tablo-row ${
                isCurrent ? 'is-current' : picked ? 'is-done' : 'is-wait'
              }`}
            >
              <span
                className="draft-tablo-dot"
                style={{ backgroundColor: p.color || '#64748b' }}
              />
              <span className="draft-tablo-name truncate">{p.name}</span>
              <span className="draft-tablo-score" title="Победные очки">
                {score}
              </span>
            </li>
          );
        })}
        {!seats.length && (
          <li className="draft-rail-empty">Нет игроков</li>
        )}
      </ul>
    </aside>
  );
}

function objectiveList(objectives = []) {
  return [
    ...objectives.filter((o) => Number(o.stage) === 1),
    ...objectives.filter((o) => Number(o.stage) === 2),
  ];
}

function ObjectiveCards({ players = [], objectives = [], completions = {} }) {
  const [expanded, setExpanded] = useState({});
  const seats = players.filter((p) => !p.eliminated);
  const list = objectiveList(objectives);

  const toggleExpand = (objectiveId, defaultOpen) => {
    setExpanded((prev) => {
      const currently = prev[objectiveId] ?? defaultOpen;
      return { ...prev, [objectiveId]: !currently };
    });
  };

  if (!list.length) {
    return <div className="draft-rail-empty">Целей пока нет</div>;
  }

  return (
    <ul className="draft-obj-list">
      {list.map((obj) => {
        const label = obj.desc || obj.title || obj.name || obj.id;
        const doneCount = seats.filter((p) => !!completions[`${p.id}_${obj.id}`]).length;
        const isCompletedByAll = seats.length > 0 && doneCount === seats.length;
        const isExpanded = expanded[obj.id] ?? !isCompletedByAll;

        return (
          <li
            key={obj.id}
            className={`draft-obj-card ${isCompletedByAll ? 'is-done' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}
          >
            <button
              type="button"
              className="draft-obj-toggle"
              onClick={() => toggleExpand(obj.id, !isCompletedByAll)}
              aria-expanded={isExpanded}
              title={isExpanded ? 'Свернуть' : 'Развернуть'}
            >
              <span className={`draft-obj-text ${isCompletedByAll && !isExpanded ? 'is-struck' : ''}`}>
                {label}
              </span>
              <span
                className={`draft-obj-progress ${doneCount > 0 ? 'has-score' : ''} ${isCompletedByAll ? 'is-full' : ''}`}
                title={`Выполнили: ${doneCount} из ${seats.length}`}
              >
                {doneCount}/{seats.length}
              </span>
              {isCompletedByAll && (
                <i
                  className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} draft-obj-chevron`}
                  aria-hidden="true"
                />
              )}
            </button>
            {seats.length > 0 && (
              <div className="draft-obj-bar" aria-hidden="true">
                <span
                  className="draft-obj-bar-fill"
                  style={{ width: `${Math.round((doneCount / seats.length) * 100)}%` }}
                />
              </div>
            )}
            {isExpanded && (
              <div className="draft-obj-players">
                {seats.map((p) => {
                  const isDone = !!completions[`${p.id}_${obj.id}`];
                  return (
                    <div
                      key={p.id}
                      className={`draft-obj-player ${isDone ? 'is-scored' : 'is-pending'}`}
                      title={`${p.name}${isDone ? ' — выполнил' : ' — ещё нет'}`}
                    >
                      <span
                        className="draft-obj-player-dot"
                        style={{ backgroundColor: p.color || '#64748b' }}
                      />
                      <span className="draft-obj-player-name truncate">{p.name}</span>
                      <span className={`draft-obj-player-mark ${isDone ? 'is-yes' : 'is-no'}`}>
                        {isDone ? (
                          <i className="fa-solid fa-check" aria-hidden="true" />
                        ) : (
                          <i className="fa-solid fa-minus" aria-hidden="true" />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Host desktop: public objectives rail. */
function DraftObjectivesRail({ players = [], objectives = [], completions = {} }) {
  return (
    <aside className="draft-rail draft-rail-obj hidden md:flex">
      <div className="draft-rail-head">
        <span className="draft-rail-head-title">
          <i className="fa-solid fa-list-check" aria-hidden="true" />
          Общие цели
        </span>
      </div>
      <div className="draft-rail-list modal-scroll">
        <ObjectiveCards players={players} objectives={objectives} completions={completions} />
      </div>
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
  const lastCardId = draftPickOrder?.[draftPickOrder.length - 1];
  const lastOwner = lastCardId != null ? draftAssignments[lastCardId] : null;
  const seatId = perms?.seatPlayerId;
  const canAdmin = !perms || perms.can('draftAdmin');
  const canPick = canAdmin || (!!perms?.can('draftPick') && seatId != null && currentPickerId === seatId);
  const canUndo = canAdmin || (!!perms?.can('draftPick') && seatId != null && lastOwner === seatId);
  const canConfirm = !perms || perms.can('confirmDraft');
  const canReassign = !perms || perms.can('reassignCard');
  const showHostSidebars = draftStep === 'DRAFT' && canAdmin && typeof getPlayerScore === 'function';

  const openForClient = !!showDraftModal && (draftStep !== 'CONFIRM' || canConfirm);
  const wantOpen = openForClient && !minimizedModals.draft;
  const EXIT_MS = 420;
  const [mounted, setMounted] = useState(wantOpen);
  const [entered, setEntered] = useState(false);

  useBodyScrollLock(wantOpen);

  useEffect(() => {
    if (wantOpen) {
      setMounted(true);
      setEntered(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [wantOpen]);

  const pickClockRunning = draftStep === 'DRAFT' && Number.isFinite(pickStartedAt) && wantOpen;
  const pickElapsed = useElapsedSeconds(pickStartedAt, pickClockRunning);

  const draftLayoutFixed = draftStep === 'DRAFT';
  const showDraftCardGrid = draftStep === 'DRAFT';
  const activeSeats = players.filter((p) => !p.eliminated).length;

  const [previewCardId, setPreviewCardId] = useState(null);
  const [previewAnimOpen, setPreviewAnimOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));
  const hostClickTimerRef = useRef(null);
  const previewCloseTimerRef = useRef(null);
  const previewOpenGenRef = useRef(0);
  const lightboxTapRef = useRef({ at: 0 });
  const lastGridTapRef = useRef({ id: null, at: 0 });
  /** Touch start point — ignore preview if finger moved (scroll). */
  const cardTouchRef = useRef({ x: 0, y: 0, moved: false });
  const previewCard = STRATEGY_CARDS.find((c) => c.id === previewCardId) || null;
  const previewTakenBy = previewCard ? draftAssignments[previewCard.id] : null;
  const previewCanPick = !!previewCard && !previewTakenBy && canPick;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Warm cache so lightbox does not flash while decoding full-size art.
  useEffect(() => {
    STRATEGY_CARDS.forEach((card) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = card.imageUrl;
    });
  }, []);

  useEffect(() => () => {
    previewOpenGenRef.current += 1;
    if (hostClickTimerRef.current) clearTimeout(hostClickTimerRef.current);
    if (previewCloseTimerRef.current) clearTimeout(previewCloseTimerRef.current);
  }, []);

  const decodeCardArt = (cardId) => {
    const card = STRATEGY_CARDS.find((c) => c.id === cardId);
    if (!card?.imageUrl) return Promise.resolve();
    const img = new Image();
    img.src = card.imageUrl;
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => undefined);
    }
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  };

  const openCardPreview = (cardId) => {
    if (hostClickTimerRef.current) {
      clearTimeout(hostClickTimerRef.current);
      hostClickTimerRef.current = null;
    }
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    const gen = ++previewOpenGenRef.current;
    // Decode first, then mount already-open — avoids closed→open blink + empty-art flash.
    decodeCardArt(cardId).then(() => {
      if (gen !== previewOpenGenRef.current) return;
      lightboxTapRef.current.at = 0;
      setPreviewCardId(cardId);
      setPreviewAnimOpen(true);
    });
  };

  const closeCardPreview = () => {
    if (previewCardId == null || previewCloseTimerRef.current) return;
    previewOpenGenRef.current += 1;
    setPreviewAnimOpen(false);
    previewCloseTimerRef.current = setTimeout(() => {
      previewCloseTimerRef.current = null;
      setPreviewCardId(null);
    }, 200);
  };

  const pickCard = (cardId) => {
    previewOpenGenRef.current += 1;
    if (hostClickTimerRef.current) {
      clearTimeout(hostClickTimerRef.current);
      hostClickTimerRef.current = null;
    }
    if (previewCloseTimerRef.current) {
      clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }
    setPreviewAnimOpen(false);
    setPreviewCardId(null);
    handleSelectCard(cardId);
  };

  useEscapeKey(() => {
    if (previewCardId != null) {
      closeCardPreview();
      return;
    }
    setShowDraftModal(false);
  }, wantOpen || previewCardId != null);

  const onPreviewCardClick = (cardId, pickDisabled) => {
    if (isMobileViewport) {
      const now = performance.now();
      const last = lastGridTapRef.current;
      // Double-tap on grid → pick (must fire before preview opens).
      if (last.id === cardId && now - last.at < MOBILE_DOUBLE_TAP_MS) {
        lastGridTapRef.current = { id: null, at: 0 };
        if (hostClickTimerRef.current) {
          clearTimeout(hostClickTimerRef.current);
          hostClickTimerRef.current = null;
        }
        previewOpenGenRef.current += 1;
        if (!pickDisabled) pickCard(cardId);
        else openCardPreview(cardId);
        return;
      }
      lastGridTapRef.current = { id: cardId, at: now };
      // Wait the full double-tap window, then open preview.
      if (hostClickTimerRef.current) clearTimeout(hostClickTimerRef.current);
      hostClickTimerRef.current = setTimeout(() => {
        hostClickTimerRef.current = null;
        openCardPreview(cardId);
      }, MOBILE_DOUBLE_TAP_MS);
      return;
    }

    // Desktop host: delay single-click preview so dblclick can pick.
    if (hostClickTimerRef.current) {
      clearTimeout(hostClickTimerRef.current);
      hostClickTimerRef.current = null;
      return;
    }
    hostClickTimerRef.current = setTimeout(() => {
      hostClickTimerRef.current = null;
      openCardPreview(cardId);
    }, HOST_CARD_CLICK_DELAY_MS);
  };

  const onLightboxArtPointerUp = (event) => {
    if (!isMobileViewport || !previewCanPick || !previewCard) return;
    event.stopPropagation();
    const now = performance.now();
    if (lightboxTapRef.current.at > 0 && now - lightboxTapRef.current.at < MOBILE_DOUBLE_TAP_MS) {
      lightboxTapRef.current.at = 0;
      pickCard(previewCard.id);
      return;
    }
    lightboxTapRef.current.at = now;
  };

  return (
    <>
      {mounted && (
        <div
          className={`draft-overlay fixed inset-0 game-modal-overlay z-50 flex items-center justify-center p-4 max-md:items-stretch max-md:p-0 modal-overlay ${entered ? 'is-open' : ''}`}
          role="presentation"
          style={entered ? undefined : { pointerEvents: 'none' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-modal-title"
            className={`game-hud-chassis draft-shell w-full min-h-0 flex flex-col overflow-hidden ${entered ? 'is-open' : ''} ${
              draftStep === 'CONFIRM'
                ? 'draft-shell-confirm max-h-[min(92vh,100dvh)] h-[min(88vh,720px)] max-md:h-[100dvh] max-md:max-h-[100dvh] max-w-[min(42rem,96vw)]'
                : draftLayoutFixed
                  ? 'max-h-[min(98vh,100dvh)] h-[min(96vh,100dvh)] max-md:h-[100dvh] max-md:max-h-[100dvh] md:h-[min(96vh,1040px)] md:max-h-[96vh]'
                  : 'max-h-[92vh] max-md:h-[100dvh] max-md:max-h-[100dvh]'
            } ${
              draftStep === 'CONFIRM'
                ? ''
                : showHostSidebars
                  ? 'max-w-6xl md:max-w-[min(1760px,98vw)]'
                  : 'max-w-6xl'
            }`}
          >
            <header className="draft-shell-head flex-shrink-0">
              <h2 id="draft-modal-title" className="game-modal-title draft-shell-title">
                {draftStep === 'DRAFT' ? 'Выбор карт стратегий' : 'Подтверждение и обмен'}
              </h2>
              <div className="draft-shell-actions">
                {draftStep === 'DRAFT' && (
                  <div className="draft-timer" title="Время текущего выбора">
                    <span className="draft-timer-value">
                      {Number.isFinite(pickStartedAt) ? formatTime(pickElapsed) : '—'}
                    </span>
                  </div>
                )}
                {draftStep === 'DRAFT' && !isMobileViewport && (
                  <button
                    type="button"
                    onClick={handleUndoLastPick}
                    disabled={!canUndo || !draftPickOrder?.length}
                    className="draft-undo-btn"
                    aria-label="Отменить последний выбор"
                    title="Отменить последний выбор"
                  >
                    <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                    <span>Отменить последний выбор</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleMinimize('draft')}
                  aria-label="Свернуть драфт"
                  className="draft-icon-btn max-md:hidden"
                >
                  <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
                </button>
                {!isMobileViewport && (
                  <button
                    type="button"
                    onClick={() => setShowDraftModal(false)}
                    aria-label="Закрыть драфт"
                    className="draft-icon-btn"
                  >
                    <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
                  </button>
                )}
              </div>
            </header>

            <div
              className={`draft-shell-body min-h-0 flex-1 overflow-hidden ${
                showHostSidebars ? 'is-host' : 'is-solo'
              }`}
            >
              {showHostSidebars && (
                <DraftScoreRail
                  players={players}
                  currentPickerId={currentPickerId}
                  draftAssignments={draftAssignments}
                  getPlayerScore={getPlayerScore}
                />
              )}

              <div className="draft-main min-w-0 min-h-0 flex flex-col overflow-hidden">
                {draftStep === 'DRAFT' && (
                  <div className="draft-main-col flex flex-col min-h-0 min-w-0 flex-1 overflow-hidden">
                    <section className="draft-queue" aria-label="Очередь выбора">
                      <div className="draft-queue-track">
                        {draftQueue.map((pId, idx) => {
                          const player = players.find((p) => p.id === pId);
                          const isCurrent = idx === currentQueueIndex;
                          const isDone = idx < currentQueueIndex;
                          return (
                            <div key={`${pId}-${idx}`} className="contents">
                              {idx > 0 && (
                                <i className="fa-solid fa-chevron-right draft-queue-arrow" aria-hidden="true" />
                              )}
                              <div className="draft-queue-item-wrap">
                                <div
                                  className={`draft-queue-chip ${
                                    isCurrent ? 'is-current' : isDone ? 'is-done' : 'is-next'
                                  }`}
                                >
                                  <span
                                    className="draft-queue-dot"
                                    style={{ backgroundColor: player?.color || '#64748b' }}
                                    aria-hidden="true"
                                  />
                                  <span className="draft-queue-name truncate">{player?.name || '—'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {showDraftCardGrid && (
                      <section className="draft-cards-panel">
                        <div className="draft-cards-scroll modal-scroll">
                        <div className="draft-card-grid">
                          {STRATEGY_CARDS.map((card) => {
                            const takenByPlayerId = draftAssignments[card.id];
                            const isTaken = !!takenByPlayerId;
                            const owner = players.find((p) => p.id === takenByPlayerId);
                            const ownerFaction = factionOf(owner);
                            const ownerColor = owner?.color || '#64748b';
                            const ownerIsBlack = ['#000000', '#000', 'black', '#090d16', '#030712']
                              .includes(String(ownerColor).toLowerCase());
                            const frameColor = ownerIsBlack ? '#f8fafc' : ownerColor;
                            const glow = CARD_GLOW[card.id] || '#c9a227';
                            const bonus = tradeGoodBonusForCard(strategyCardBonuses, card.id);
                            const pickDisabled = isTaken || !canPick;
                            // Mobile + desktop host: tap to enlarge, double-tap / lightbox to pick.
                            const cardPreviewMode = isMobileViewport || canAdmin;

                            return (
                              <button
                                key={card.id}
                                type="button"
                                disabled={!cardPreviewMode && pickDisabled}
                                title={
                                  cardPreviewMode
                                    ? (pickDisabled
                                      ? 'Клик — увеличить'
                                      : 'Клик — увеличить · двойной клик — выбрать')
                                    : undefined
                                }
                                onTouchStart={(event) => {
                                  if (!cardPreviewMode || !isMobileViewport) return;
                                  const t = event.changedTouches[0] || event.touches[0];
                                  if (!t) return;
                                  cardTouchRef.current = { x: t.clientX, y: t.clientY, moved: false };
                                }}
                                onTouchMove={(event) => {
                                  if (!cardPreviewMode || !isMobileViewport) return;
                                  const t = event.changedTouches[0] || event.touches[0];
                                  if (!t) return;
                                  const dx = t.clientX - cardTouchRef.current.x;
                                  const dy = t.clientY - cardTouchRef.current.y;
                                  if ((dx * dx + dy * dy) > 100) {
                                    cardTouchRef.current.moved = true;
                                    // Cancel pending single-tap preview if user started scrolling.
                                    if (hostClickTimerRef.current) {
                                      clearTimeout(hostClickTimerRef.current);
                                      hostClickTimerRef.current = null;
                                    }
                                    lastGridTapRef.current = { id: null, at: 0 };
                                  }
                                }}
                                onTouchEnd={(event) => {
                                  // Touch: handle here (prevents delayed synthetic click that breaks double-tap).
                                  if (!cardPreviewMode || !isMobileViewport) return;
                                  if (cardTouchRef.current.moved) return;
                                  event.preventDefault();
                                  onPreviewCardClick(card.id, pickDisabled);
                                }}
                                onClick={() => {
                                  if (cardPreviewMode) {
                                    if (isMobileViewport) return; // already handled in onTouchEnd
                                    onPreviewCardClick(card.id, pickDisabled);
                                    return;
                                  }
                                  if (!pickDisabled) handleSelectCard(card.id);
                                }}
                                onDoubleClick={(event) => {
                                  if (!cardPreviewMode || isMobileViewport) return;
                                  event.preventDefault();
                                  if (hostClickTimerRef.current) {
                                    clearTimeout(hostClickTimerRef.current);
                                    hostClickTimerRef.current = null;
                                  }
                                  if (!pickDisabled) pickCard(card.id);
                                  else openCardPreview(card.id);
                                }}
                                style={{ '--draft-card-glow': glow }}
                                className={`draft-card ${isTaken ? 'is-taken' : ''} ${
                                  cardPreviewMode || !pickDisabled ? 'is-pickable' : 'is-disabled'
                                }`}
                              >
                                {bonus > 0 && (
                                  <div className="draft-card-bonus" title={`Накоплено товаров: ${bonus}`}>
                                    {bonus}
                                  </div>
                                )}

                                <div className="draft-card-frame">
                                  <img
                                    src={card.imageUrl}
                                    alt={card.name}
                                    decoding="async"
                                    draggable={false}
                                    className={`draft-card-art ${isTaken ? 'is-taken' : ''}`}
                                  />
                                  {isTaken && (
                                    <div
                                      className="draft-card-owner"
                                      title={ownerFaction?.name || owner?.name || '—'}
                                    >
                                      <div className="draft-card-owner-stack">
                                        {ownerFaction?.iconUrl ? (
                                          <div
                                            className="draft-card-owner-crest"
                                            style={{
                                              borderColor: `${frameColor}99`,
                                              boxShadow: `0 0 16px ${frameColor}55`,
                                            }}
                                          >
                                            <img
                                              src={ownerFaction.iconUrl}
                                              alt={ownerFaction.name}
                                              draggable={false}
                                            />
                                          </div>
                                        ) : (
                                          <span
                                            className={`draft-card-owner-dot ${ownerIsBlack ? 'is-black' : ''}`}
                                            style={{ backgroundColor: ownerColor }}
                                          />
                                        )}
                                        <span className="draft-card-owner-name truncate">
                                          {owner?.name || '—'}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        </div>
                      </section>
                    )}
                  </div>
                )}

                {draftStep === 'CONFIRM' && (
                  <div className="draft-confirm">
                    <p className="draft-confirm-lead">
                      Все игроки выбрали карты. Можно быстро обменять или переназначить карты перед началом раунда.
                    </p>

                    <ul className="draft-confirm-list modal-scroll">
                      {STRATEGY_CARDS.map((card) => {
                        const ownerId = draftAssignments[card.id];
                        if (!ownerId) return null;
                        const owner = players.find((p) => p.id === ownerId);
                        const ownerFaction = factionOf(owner);
                        const glow = CARD_GLOW[card.id] || '#c9a227';
                        const ownerColor = owner?.color || '#64748b';

                        return (
                          <li
                            key={card.id}
                            className="draft-confirm-row"
                            style={{ '--draft-card-glow': glow }}
                          >
                            <div className="draft-confirm-card">
                              <img
                                src={card.imageUrl}
                                alt={strategyCardLabel(card)}
                                className="draft-confirm-thumb"
                                draggable={false}
                              />
                              <div className="draft-confirm-meta">
                                <span className="draft-confirm-init">#{card.id}</span>
                                <span className="draft-confirm-name truncate">
                                  {strategyCardLabel(card)}
                                </span>
                              </div>
                            </div>

                            <div className="draft-confirm-owner">
                              {ownerFaction?.iconUrl ? (
                                <img
                                  src={ownerFaction.iconUrl}
                                  alt={ownerFaction.name}
                                  className="draft-confirm-crest"
                                  draggable={false}
                                  title={ownerFaction.name}
                                />
                              ) : (
                                <span
                                  className="draft-confirm-dot"
                                  style={{ backgroundColor: ownerColor }}
                                  aria-hidden="true"
                                />
                              )}
                              {canReassign ? (
                                <select
                                  value={ownerId}
                                  onChange={(e) => handleReassignCard(card.id, e.target.value)}
                                  className="draft-confirm-select"
                                  aria-label={`Игрок для карты ${strategyCardLabel(card)}`}
                                >
                                  {players.filter((p) => !p.eliminated).map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="draft-confirm-owner-name truncate">
                                  {owner?.name || '—'}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="draft-confirm-actions">
                      {canUndo && (
                        <button
                          type="button"
                          onClick={handleUndoLastPick}
                          disabled={!draftPickOrder?.length}
                          className="draft-undo-btn"
                        >
                          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                          <span>Отменить последний выбор</span>
                        </button>
                      )}
                      {canConfirm && (
                        <button
                          type="button"
                          onClick={confirmDraft}
                          className="draft-confirm-submit"
                        >
                          Подтвердить и закрыть
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

      {previewCard && (
        <div
          key={previewCard.id}
          className={`draft-card-lightbox ${previewAnimOpen ? 'is-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={previewCard.name}
          onClick={closeCardPreview}
        >
          <button
            type="button"
            className="draft-card-lightbox-close"
            aria-label="Закрыть"
            onClick={closeCardPreview}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
          <div
            className="draft-card-lightbox-stage"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewCard.imageUrl}
              alt={previewCard.name}
              className="draft-card-lightbox-art"
              draggable={false}
              decoding="sync"
              fetchPriority="high"
              onPointerUp={onLightboxArtPointerUp}
            />
            {previewCanPick && (
              <button
                type="button"
                className="draft-card-lightbox-pick"
                onClick={() => pickCard(previewCard.id)}
              >
                Взять
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
