import { useEffect, useState } from 'react';
import { secretObjectiveById } from '../data/secretObjectives';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import secretCardBack from '../assets/secret-card-back.png';

function phaseBanner(phase) {
  if (phase === 'agenda') return { text: 'ФАЗА ПОЛИТИКИ', tone: 'politics' };
  if (phase === 'action') return { text: 'ФАЗА ДЕЙСТВИЙ', tone: 'action' };
  return { text: 'ФАЗА СТАТУСА', tone: 'status' };
}

/**
 * Start-of-game secret pick: deal face-down, flip on tap, confirm keep.
 * Host sees who still needs to pick (no card text).
 */
export function SecretDraftModal({
  show,
  player = null,
  players = [],
  draftPending = false,
  isHost = false,
  onKeep,
  onMinimize,
}) {
  const [entered, setEntered] = useState(false);
  const [flipped, setFlipped] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);

  const wantOpen = !!show && !!draftPending;
  useEscapeKey(onMinimize, wantOpen);
  useBodyScrollLock(wantOpen);

  const draft = Array.isArray(player?.secretDraft) ? player.secretDraft : [];
  const needsPick = draft.length > 0;
  const activeSeats = players.filter((p) => !p.eliminated);
  const waiting = activeSeats.filter(
    (p) => Array.isArray(p.secretDraft) && p.secretDraft.length > 0,
  );
  const donePlayers = activeSeats.filter(
    (p) => !Array.isArray(p.secretDraft) || p.secretDraft.length === 0,
  );
  const hostStatusView = !needsPick && isHost;

  useEffect(() => {
    if (!wantOpen) {
      setEntered(false);
      setFlipped(new Set());
      setSelectedId(null);
      return undefined;
    }
    setEntered(false);
    setFlipped(new Set());
    setSelectedId(null);
    const enterId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(enterId);
  }, [wantOpen, player?.id, needsPick]);

  if (!wantOpen) return null;

  const canConfirm = needsPick && selectedId != null;

  const onCardTap = (cardId) => {
    if (!needsPick) return;
    if (!flipped.has(cardId)) {
      setFlipped((prev) => new Set(prev).add(cardId));
      return;
    }
    setSelectedId(cardId);
  };

  return (
    <div
      className={`fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 modal-overlay secret-draft-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-draft-title"
        className={`secret-draft-shell ${hostStatusView ? 'is-host-status' : ''} ${entered ? 'is-open' : ''}`}
      >
        <header className="secret-draft-head">
          <div className="min-w-0">
            <div className="secret-draft-eyebrow">
              {hostStatusView && (
                <i className="fa-solid fa-user-secret secret-draft-eyebrow-ico" aria-hidden="true" />
              )}
              Секретные цели
            </div>
            <h2 id="secret-draft-title" className="secret-draft-title">
              {needsPick ? (player?.name || 'Ваш выбор') : (isHost ? 'Статус раздачи' : 'Ожидание')}
            </h2>
            <p className="secret-draft-sub">
              {needsPick
                ? (selectedId
                  ? 'Подтвердите выбор — вторую карту вернут в колоду.'
                  : 'Нажмите на карту, чтобы перевернуть. Затем выберите одну.')
                : isHost
                  ? `Выбрали ${donePlayers.length}/${activeSeats.length}`
                  : 'Выбор сохранён. Ждём остальных…'}
            </p>
          </div>
          {typeof onMinimize === 'function' && (
            <button
              type="button"
              className="secret-draft-icon-btn"
              onClick={onMinimize}
              title="Свернуть"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="secret-draft-body">
          {needsPick && player && (
            <div className="secret-draft-cards">
              {draft.map((cardId, index) => {
                const card = secretObjectiveById.get(cardId);
                const isFlipped = flipped.has(cardId);
                const selected = selectedId === cardId;
                const banner = phaseBanner(card?.phase);
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => onCardTap(cardId)}
                    className={`secret-flip-card ${selected ? 'is-selected' : ''} ${isFlipped ? 'is-open' : ''}`}
                    style={{ '--deal-i': index }}
                    aria-pressed={selected}
                    aria-label={
                      isFlipped
                        ? `${card?.title || cardId}${selected ? ', выбрано' : ''}`
                        : 'Секретная карта — нажмите, чтобы открыть'
                    }
                  >
                    <span className={`secret-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                      <span className="secret-flip-face secret-flip-back">
                        <img src={secretCardBack} alt="" draggable={false} />
                      </span>
                      <span className={`secret-flip-face secret-so-face phase-${banner.tone}`}>
                        <span className="secret-so-frame" aria-hidden="true" />
                        <span className="secret-so-title">{card?.title || cardId}</span>
                        <span className={`secret-so-phase is-${banner.tone}`}>
                          {banner.text}
                        </span>
                        <span className="secret-so-body">
                          <span className="secret-so-desc">{card?.desc || '—'}</span>
                        </span>
                        <span className="secret-so-foot">
                          <span className="secret-so-vp" aria-hidden="true">1</span>
                          <span className="secret-so-vp-label">
                            Победное очко
                            <i className="fa-solid fa-trophy secret-so-vp-ico" aria-hidden="true" />
                          </span>
                        </span>
                        {selected && <span className="secret-so-picked">Выбрано</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {hostStatusView && (
            <div className="secret-host-status">
              <section className="secret-host-panel is-pending" aria-label="Ещё не выбрали">
                <div className="secret-host-panel-head">
                  <span className="secret-host-panel-title">
                    <i className="fa-solid fa-crosshairs" aria-hidden="true" />
                    Ещё не выбрали
                  </span>
                  <span className="secret-host-panel-count">{waiting.length}</span>
                </div>
                {waiting.length === 0 ? (
                  <p className="secret-host-empty">Все сделали выбор</p>
                ) : (
                  <ul className="secret-host-grid">
                    {waiting.map((p) => (
                      <li key={p.id} className="secret-host-seat is-pending">
                        <span className="secret-host-seat-dot" style={{ background: p.color || '#64748b' }} />
                        <span className="secret-host-seat-name">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="secret-host-panel is-done" aria-label="Уже выбрали">
                <div className="secret-host-panel-head">
                  <span className="secret-host-panel-title">
                    <i className="fa-solid fa-circle-check" aria-hidden="true" />
                    Уже выбрали
                  </span>
                  <span className="secret-host-panel-count">{donePlayers.length}</span>
                </div>
                {donePlayers.length === 0 ? (
                  <p className="secret-host-empty">Пока никто не выбрал</p>
                ) : (
                  <ul className="secret-host-grid">
                    {donePlayers.map((p) => (
                      <li key={p.id} className="secret-host-seat is-done">
                        <span className="secret-host-seat-dot" style={{ background: p.color || '#64748b' }} />
                        <span className="secret-host-seat-name">{p.name}</span>
                        <i className="fa-solid fa-check secret-host-seat-check" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {!needsPick && !isHost && (
            <div className="secret-host-status">
              <section className="secret-host-panel is-pending">
                <div className="secret-host-panel-head">
                  <span className="secret-host-panel-title">
                    <i className="fa-solid fa-crosshairs" aria-hidden="true" />
                    Ещё выбирают
                  </span>
                  <span className="secret-host-panel-count">{waiting.length}</span>
                </div>
                <p className="secret-host-empty">Ждём остальных игроков…</p>
                {waiting.length > 0 && (
                  <ul className="secret-host-grid">
                    {waiting.map((p) => (
                      <li key={p.id} className="secret-host-seat is-pending">
                        <span className="secret-host-seat-dot" style={{ background: p.color || '#64748b' }} />
                        <span className="secret-host-seat-name">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        {needsPick && (
          <footer className="secret-draft-foot">
            <button
              type="button"
              disabled={!canConfirm}
              className="secret-draft-confirm"
              onClick={() => {
                if (!canConfirm || !player) return;
                onKeep?.(player.id, selectedId);
              }}
            >
              Подтвердить выбор
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
