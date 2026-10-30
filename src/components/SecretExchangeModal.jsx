import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { secretObjectiveById } from '../data/secretObjectives';
import secretCardBack from '../assets/secret-card-back.png';

function phaseBanner(phase) {
  if (phase === 'agenda') return { text: 'ФАЗА ПОЛИТИКИ', tone: 'politics' };
  if (phase === 'action') return { text: 'ФАЗА ДЕЙСТВИЙ', tone: 'action' };
  return { text: 'ФАЗА СТАТУСА', tone: 'status' };
}

function SecretCardFace({ cardId, flipped, selected = false, className = '', style, onClick, disabled }) {
  const card = secretObjectiveById.get(cardId);
  const banner = phaseBanner(card?.phase);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`secret-flip-card secret-xchg-card ${selected ? 'is-selected' : ''} ${flipped ? 'is-open' : ''} ${className}`}
      style={style}
      aria-pressed={selected || undefined}
      aria-label={
        flipped
          ? `${card?.title || cardId}${selected ? ', выбрано' : ''}`
          : 'Секретная карта — нажмите, чтобы открыть'
      }
    >
      <span className={`secret-flip-inner ${flipped ? 'is-flipped' : ''}`}>
        <span className="secret-flip-face secret-flip-back">
          <img src={secretCardBack} alt="" draggable={false} />
        </span>
        <span className={`secret-flip-face secret-so-face phase-${banner.tone}`}>
          <span className="secret-so-frame" aria-hidden="true" />
          <span className="secret-so-title">{card?.title || cardId}</span>
          <span className={`secret-so-phase is-${banner.tone}`}>{banner.text}</span>
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
}

/**
 * Mecatol secret exchange: pick → fly out → fly in face-down → tap to flip.
 */
export function SecretExchangeModal({
  show,
  player = null,
  hand = [],
  onExchange,
  onClose,
}) {
  const [entered, setEntered] = useState(false);
  /** pick | out | in | reveal */
  const [phase, setPhase] = useState('pick');
  const [selectedId, setSelectedId] = useState(null);
  const [outgoingId, setOutgoingId] = useState(null);
  const [incomingId, setIncomingId] = useState(null);
  const [incomingFlipped, setIncomingFlipped] = useState(false);
  const [awaitingIncoming, setAwaitingIncoming] = useState(false);
  const handBeforeRef = useRef([]);
  const outTimerRef = useRef(null);

  const cards = Array.isArray(hand) ? hand : [];
  const busy = phase === 'out' || phase === 'in' || awaitingIncoming;

  useEffect(() => {
    if (!show) {
      setEntered(false);
      setPhase('pick');
      setSelectedId(null);
      setOutgoingId(null);
      setIncomingId(null);
      setIncomingFlipped(false);
      setAwaitingIncoming(false);
      if (outTimerRef.current) {
        clearTimeout(outTimerRef.current);
        outTimerRef.current = null;
      }
      return undefined;
    }
    setEntered(false);
    setPhase('pick');
    setSelectedId(null);
    setOutgoingId(null);
    setIncomingId(null);
    setIncomingFlipped(false);
    setAwaitingIncoming(false);
    const enterId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(enterId);
      if (outTimerRef.current) {
        clearTimeout(outTimerRef.current);
        outTimerRef.current = null;
      }
    };
  }, [show, player?.id]);

  useEffect(() => {
    if (!awaitingIncoming || !player) return;
    const before = handBeforeRef.current;
    const remaining = before.filter((id) => id !== outgoingId);
    const next = (Array.isArray(player.secretHand) ? player.secretHand : [])
      .find((id) => !remaining.includes(id));
    if (!next) return;
    setIncomingId(next);
    setIncomingFlipped(false);
    setAwaitingIncoming(false);
    setPhase('in');
  }, [awaitingIncoming, player, player?.secretHand, outgoingId]);

  // Separate effect so cleanup does not cancel reveal when awaitingIncoming flips.
  useEffect(() => {
    if (phase !== 'in') return undefined;
    const t = setTimeout(() => setPhase('reveal'), 560);
    return () => clearTimeout(t);
  }, [phase]);

  const subText = (() => {
    if (phase === 'pick') {
      return selectedId
        ? 'Подтвердите обмен — карта уйдёт в колоду, придёт новая.'
        : 'Выберите секретную цель для обмена.';
    }
    if (phase === 'out' || awaitingIncoming) return 'Карта уходит в колоду…';
    if (phase === 'in') return 'Новая карта…';
    if (phase === 'reveal' && !incomingFlipped) return 'Нажмите на карту, чтобы перевернуть.';
    return 'Обмен завершён.';
  })();

  const startExchange = () => {
    if (!selectedId || busy || !player) return;
    handBeforeRef.current = [...cards];
    setOutgoingId(selectedId);
    setPhase('out');
    outTimerRef.current = setTimeout(() => {
      onExchange?.(player.id, selectedId);
      setAwaitingIncoming(true);
    }, 520);
  };

  const close = () => {
    if (busy) return;
    onClose?.();
  };

  if (!show || !player || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-md modal-overlay secret-xchg-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-xchg-title"
        className={`secret-draft-shell secret-xchg-shell ${entered ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="secret-draft-head">
          <div className="min-w-0">
            <div className="secret-draft-eyebrow">Контроль Мекатола</div>
            <h2 id="secret-xchg-title" className="secret-draft-title">Обмен секретки</h2>
            <p className="secret-draft-sub">{subText}</p>
          </div>
          {!busy && (
            <button
              type="button"
              className="secret-draft-icon-btn"
              onClick={close}
              title="Закрыть"
              aria-label="Закрыть"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="secret-draft-body secret-xchg-body">
          {phase === 'pick' && (
            <div className={`secret-draft-cards ${cards.length === 1 ? 'is-single' : ''}`}>
              {cards.map((cardId, index) => (
                <SecretCardFace
                  key={cardId}
                  cardId={cardId}
                  flipped
                  selected={selectedId === cardId}
                  style={{ '--deal-i': index }}
                  onClick={() => setSelectedId(cardId)}
                />
              ))}
            </div>
          )}

          {(phase === 'out' || awaitingIncoming) && outgoingId && (
            <div className="secret-xchg-stage" aria-live="polite">
              <SecretCardFace
                cardId={outgoingId}
                flipped
                disabled
                className="is-fly-out"
                style={{ '--deal-i': 0 }}
              />
            </div>
          )}

          {(phase === 'in' || phase === 'reveal') && incomingId && (
            <div className="secret-xchg-stage" aria-live="polite">
              <SecretCardFace
                cardId={incomingId}
                flipped={incomingFlipped}
                className={phase === 'in' && !incomingFlipped ? 'is-fly-in' : 'is-settled'}
                style={{ '--deal-i': 0 }}
                onClick={() => {
                  if (phase !== 'in' && phase !== 'reveal') return;
                  if (!incomingFlipped) {
                    setIncomingFlipped(true);
                    if (phase === 'in') setPhase('reveal');
                    return;
                  }
                  close();
                }}
              />
            </div>
          )}
        </div>

        {phase === 'pick' && (
          <footer className="secret-draft-foot">
            <button
              type="button"
              disabled={!selectedId}
              className="secret-draft-confirm"
              onClick={startExchange}
            >
              Обменять
            </button>
          </footer>
        )}

        {phase === 'reveal' && incomingFlipped && (
          <footer className="secret-draft-foot">
            <button type="button" className="secret-draft-confirm" onClick={close}>
              Готово
            </button>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
