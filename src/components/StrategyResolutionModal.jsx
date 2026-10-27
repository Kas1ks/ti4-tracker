import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { useEffect, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useElapsedSeconds } from '../hooks/useTurnTimer';
import { formatTime } from '../utils/game';
import { isStrategyCardPlayed } from '../game/selectors';

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

function statusLabel(status) {
  if (status === 'played') return 'Сыграно';
  if (status === 'passed') return 'Пас';
  return 'Ожидание';
}

function factionOf(player) {
  return ALL_FACTIONS.find((f) => f.id === player?.factionId) || null;
}

function strategyCardLabel(card) {
  return String(card?.ruName || card?.name || '')
    .replace(/^\d+\.\s*/, '')
    .trim() || card?.name || '—';
}

function resolutionSecsFor(resolution, playerId, liveSecs) {
  const status = resolution?.responses?.[playerId];
  const started = resolution?.startedAt;
  if (!Number.isFinite(started)) return 0;
  if (status === 'played' || status === 'passed') {
    const ended = resolution?.resolvedAt?.[playerId] ?? resolution?.resolvedAt?.[String(playerId)];
    if (Number.isFinite(ended)) {
      return Math.max(0, Math.floor((ended - started) / 1000));
    }
    return liveSecs;
  }
  return liveSecs;
}

function StrategyBoardGlance({ players = [], resolution }) {
  const resolvingId = resolution?.cardId ?? null;
  const seats = (players || []).filter((p) => !p.eliminated);

  const ownerByCardId = new Map();
  for (const p of seats) {
    const cards = Array.isArray(p.cards) ? p.cards : [];
    for (const card of cards) {
      if (card?.id == null) continue;
      ownerByCardId.set(card.id, { player: p, card });
    }
  }

  const displayRows = STRATEGY_CARDS
    .slice()
    .sort((a, b) => (a.initiative ?? a.id) - (b.initiative ?? b.id))
    .filter((meta) => ownerByCardId.has(meta.id))
    .map((meta) => {
      const { player, card } = ownerByCardId.get(meta.id);
      const played = isStrategyCardPlayed(player, card.id);
      const resolving = resolvingId === card.id;
      return {
        key: `card-${meta.id}`,
        player,
        card,
        meta,
        state: resolving ? 'resolving' : played ? 'played' : 'hand',
      };
    });

  return (
    <section className="sr-col sr-col-round-inner">
      <header className="sr-col-head">
        <i className="fa-solid fa-layer-group" aria-hidden="true" />
        <span>Карты стратегий раунда</span>
      </header>
      <ul className="sr-round-list">
        {displayRows.map(({ key, player, meta, state }) => {
          const glow = CARD_GLOW[meta.id] || '#c9a227';
          return (
            <li
              key={key}
              className={`sr-round-item ${
                state === 'resolving' ? 'is-resolving' : state === 'played' ? 'is-played' : 'is-hand'
              }`}
              style={{ '--sr-card-glow': glow }}
            >
              {meta?.imageUrl ? (
                <img
                  src={meta.imageUrl}
                  alt={meta.name || `#${meta.id}`}
                  className="sr-round-thumb"
                />
              ) : (
                <div className="sr-round-thumb is-empty" />
              )}
              <div className="sr-round-meta min-w-0 flex-1">
                <div className={`sr-round-name ${state === 'played' ? 'is-done' : ''}`}>
                  {meta.id}. {strategyCardLabel(meta)}
                </div>
                <div className="sr-round-owner">
                  <span className="sr-dot" style={{ backgroundColor: player.color || '#64748b' }} />
                  <span className="truncate">{player.name}</span>
                </div>
              </div>
              <span className={`sr-badge is-${state}`}>
                {state === 'resolving' ? 'Розыгрыш' : state === 'played' ? 'Сыграна' : 'В руке'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StrategyResolutionModal({
  show,
  minimized,
  resolution,
  players = [],
  canResolveAny = false,
  onResolve,
  onMinimize,
  onClose,
}) {
  const wantOpen = !!(show && !minimized);
  useEscapeKey(onMinimize || onClose, wantOpen);
  useBodyScrollLock(wantOpen);

  const EXIT_MS = 420;
  const [mounted, setMounted] = useState(wantOpen);
  const [entered, setEntered] = useState(false);

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
  }, [wantOpen, resolution?.cardId, resolution?.startedAt]);

  const seats = (players || []).filter((p) => !p.eliminated && resolution?.responses?.[p.id] != null);
  const anyPending = seats.some((p) => {
    const s = resolution?.responses?.[p.id];
    return s !== 'played' && s !== 'passed';
  });
  const liveSecs = useElapsedSeconds(
    resolution?.startedAt,
    wantOpen && anyPending && Number.isFinite(resolution?.startedAt),
  );

  if (!mounted) return null;

  const card = STRATEGY_CARDS.find((c) => c.id === resolution?.cardId) || null;
  const owner = players.find((p) => p.id === resolution?.playerId) || null;
  const answered = seats.filter((p) => {
    const s = resolution?.responses?.[p.id];
    return s === 'played' || s === 'passed';
  }).length;
  const glow = CARD_GLOW[card?.id] || '#c9a227';

  return (
    <div
      className={`sr-overlay fixed inset-0 z-[56] game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
      onClick={wantOpen ? (onMinimize || onClose) : undefined}
      style={entered ? undefined : { pointerEvents: 'none' }}
    >
      <div
        className={`sr-shell relative w-full max-md:h-full md:w-fit md:max-w-[96vw] md:h-auto md:max-h-[min(90vh,920px)] flex flex-col md:overflow-hidden ${entered ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-resolution-title"
        onClick={(event) => event.stopPropagation()}
        style={{ '--sr-card-glow': glow }}
      >
        <header className="sr-shell-head flex-shrink-0">
          <div className="min-w-0">
            <h2 id="strategy-resolution-title" className="game-modal-title sr-shell-title">
              Розыгрыш карты стратегии
            </h2>
            <p className="sr-shell-sub truncate">
              {owner ? `${owner.name}` : '—'}
              {' · '}
              {card ? `${card.id}. ${strategyCardLabel(card)}` : `Карта #${resolution?.cardId ?? '—'}`}
              {' · '}
              {answered}/{seats.length}
            </p>
          </div>
          <div className="sr-shell-actions">
            <div className="sr-timer" title="Время розыгрыша">
              <i className="fa-solid fa-hourglass-half" aria-hidden="true" />
              <div className="sr-timer-text">
                <span className="sr-timer-label">Таймер</span>
                <span className="sr-timer-value">
                  {Number.isFinite(resolution?.startedAt) ? formatTime(liveSecs) : '—'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onMinimize || onClose}
              className="sr-icon-btn"
              title="Свернуть"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="sr-shell-body max-md:flex-1 max-md:min-h-0">
          <aside className="sr-col sr-col-card">
            <div className="sr-card-frame">
              {card?.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} className="sr-card-art" />
              ) : (
                <div className="sr-card-art is-fallback">
                  {card?.name || 'Карта стратегии'}
                </div>
              )}
            </div>
            <div className="sr-card-caption">
              {card ? `${card.id}. ${strategyCardLabel(card)}` : `Карта #${resolution?.cardId}`}
            </div>
          </aside>

          <section className="sr-col sr-col-seats">
            <header className="sr-col-head is-muted">Ответы игроков</header>
            <ul className="sr-seat-list">
              {seats.map((p, idx) => {
                const status = resolution?.responses?.[p.id] || 'pending';
                const played = status === 'played';
                const passed = status === 'passed';
                const done = played || passed;
                const isPrimary = p.id === resolution?.playerId;
                const secs = resolutionSecsFor(resolution, p.id, liveSecs);
                const faction = factionOf(p);
                return (
                  <li
                    key={p.id}
                    className={`sr-seat-row ${
                      isPrimary && !done
                        ? 'is-primary'
                        : played
                          ? 'is-played'
                          : passed
                            ? 'is-passed'
                            : ''
                    }`}
                  >
                    <span className="sr-seat-idx">{idx + 1}</span>

                    <span
                      className="sr-seat-avatar"
                      style={{ borderColor: p.color || '#64748b' }}
                    >
                      {faction?.iconUrl ? (
                        <img src={faction.iconUrl} alt="" />
                      ) : (
                        <span className="sr-dot" style={{ backgroundColor: p.color || '#64748b' }} />
                      )}
                    </span>

                    <div className="sr-seat-meta min-w-0">
                      <div className="sr-seat-name-row">
                        <span className="sr-seat-name truncate">{p.name}</span>
                        {isPrimary && <span className="sr-primary-tag">Primary</span>}
                      </div>
                    </div>

                    <div className={`sr-seat-status ${done ? 'is-docked' : ''}`}>
                      <div className={`sr-seat-time ${done ? 'is-done' : ''}`}>{formatTime(secs)}</div>
                      <div className={`sr-seat-state is-${status}`}>{statusLabel(status)}</div>
                    </div>

                    {canResolveAny && !done ? (
                      <div className="sr-seat-actions">
                        <button
                          type="button"
                          onClick={() => onResolve?.(p.id, 'played')}
                          className="sr-act is-play"
                        >
                          Сыграно
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolve?.(p.id, 'passed')}
                          className="sr-act is-pass"
                        >
                          Пас
                        </button>
                      </div>
                    ) : !done ? (
                      <div className="sr-seat-actions is-spacer" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="sr-col-round">
            <StrategyBoardGlance players={players} resolution={resolution} />
          </aside>
        </div>
      </div>
    </div>
  );
}
