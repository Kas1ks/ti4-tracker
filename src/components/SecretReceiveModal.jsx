import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { secretObjectiveById } from '../data/secretObjectives';
import { secretCapOf, secretSlotsUsed } from '../game/secretDeck';
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
 * Mid-game secret receive: fly-in → flip → accept.
 * If over cap, pick any hand card (including the new one) to discard under the deck.
 */
export function SecretReceiveModal({
  show,
  player = null,
  cardId = null,
  needsDiscard = false,
  hand = [],
  onDismiss,
  onDiscard,
}) {
  const [entered, setEntered] = useState(false);
  /** in | reveal | discard */
  const [phase, setPhase] = useState('in');
  const [flipped, setFlipped] = useState(false);
  const [selectedDiscard, setSelectedDiscard] = useState(null);

  const cards = Array.isArray(hand) ? hand : [];
  const cap = secretCapOf(player);
  const used = secretSlotsUsed(player);
  const overBy = Math.max(0, used - cap);

  useEffect(() => {
    if (!show) {
      setEntered(false);
      setPhase('in');
      setFlipped(false);
      setSelectedDiscard(null);
      return undefined;
    }
    setEntered(false);
    setFlipped(false);
    setSelectedDiscard(null);
    // Overflow-only reopen (reveal already dismissed) → discard picker.
    if (!cardId && needsDiscard) {
      setPhase('discard');
    } else {
      setPhase('in');
    }
    const enterId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(enterId);
  }, [show, cardId, needsDiscard, player?.id]);

  useEffect(() => {
    if (!show || phase !== 'in' || !cardId) return undefined;
    const t = setTimeout(() => setPhase('reveal'), 560);
    return () => clearTimeout(t);
  }, [show, phase, cardId]);

  if (!show || typeof document === 'undefined') return null;

  const subText = (() => {
    if (phase === 'discard' || (!cardId && needsDiscard)) {
      return overBy > 0
        ? `Лимит ${cap}. Сбросьте ${overBy === 1 ? 'любую карту' : `${overBy} карт`} (можно только что взятую).`
        : 'Выберите карту для сброса.';
    }
    if (phase === 'in') return 'Новая секретная цель…';
    if (!flipped) return 'Нажмите на карту, чтобы перевернуть.';
    if (needsDiscard) return 'Примите карту, затем сбросьте одну до лимита.';
    return 'Карта у вас на руке.';
  })();

  const acceptReveal = () => {
    if (needsDiscard) {
      setPhase('discard');
      setSelectedDiscard(null);
      onDismiss?.();
      return;
    }
    onDismiss?.();
  };

  const confirmDiscard = () => {
    if (!selectedDiscard) return;
    onDiscard?.(selectedDiscard);
  };

  const body = (
    <div
      className={`fixed inset-0 z-[90] bg-black/80 backdrop-blur-md modal-overlay secret-xchg-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-recv-title"
        className={`secret-draft-shell secret-xchg-shell ${entered ? 'is-open' : ''}`}
      >
        <header className="secret-draft-head">
          <div className="min-w-0">
            <div className="secret-draft-eyebrow">Секретные цели</div>
            <h2 id="secret-recv-title" className="secret-draft-title">
              {phase === 'discard' ? 'Сброс до лимита' : 'Новая секретка'}
            </h2>
            <p className="secret-draft-sub">{subText}</p>
          </div>
        </header>

        <div className="secret-draft-body secret-xchg-body">
          {(phase === 'in' || phase === 'reveal') && cardId && (
            <div className="secret-xchg-stage" aria-live="polite">
              <SecretCardFace
                cardId={cardId}
                flipped={phase === 'reveal' && flipped}
                className={phase === 'in' ? 'is-fly-in' : 'is-settled'}
                onClick={() => {
                  if (phase !== 'reveal') return;
                  if (!flipped) setFlipped(true);
                }}
              />
            </div>
          )}

          {phase === 'discard' && (
            <div className={`secret-draft-cards ${cards.length === 1 ? 'is-single' : ''}`}>
              {cards.map((id, index) => (
                <SecretCardFace
                  key={id}
                  cardId={id}
                  flipped
                  selected={selectedDiscard === id}
                  style={{ '--deal-i': index }}
                  onClick={() => setSelectedDiscard(id)}
                />
              ))}
            </div>
          )}
        </div>

        {phase === 'reveal' && flipped && (
          <footer className="secret-draft-foot">
            <button type="button" className="secret-draft-confirm" onClick={acceptReveal}>
              {needsDiscard ? 'Далее · сброс' : 'Принято'}
            </button>
          </footer>
        )}

        {phase === 'discard' && (
          <footer className="secret-draft-foot">
            <button
              type="button"
              className="secret-draft-confirm"
              disabled={!selectedDiscard}
              onClick={confirmDiscard}
            >
              Сбросить под колоду
            </button>
          </footer>
        )}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
