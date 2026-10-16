import { ALL_FACTIONS } from '../data/gameData';
import { useEffect, useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

function factionOf(player) {
  return ALL_FACTIONS.find((f) => f.id === player?.factionId) || null;
}

export function SpeakerSelectionModal({
  show,
  activePlayer,
  activePlayers = [],
  speakerId = null,
  onSelectSpeaker,
  readOnly = false,
}) {
  const wantOpen = !!(show && activePlayer);
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

  if (!mounted || !activePlayer) return null;

  const seats = (activePlayers || []).filter((p) => !p.eliminated);

  return (
    <div
      className={`spk-overlay fixed inset-0 z-[57] game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
      style={entered ? undefined : { pointerEvents: 'none' }}
    >
      <div
        className={`game-hud-chassis spk-shell relative w-full max-md:h-full md:w-[min(920px,96vw)] md:max-w-[min(920px,96vw)] md:h-auto md:max-h-[min(92vh,900px)] flex flex-col md:overflow-hidden ${entered ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="speaker-select-title"
      >
        <header className="spk-shell-head flex-shrink-0">
          <div className="min-w-0">
            <h2 id="speaker-select-title" className="game-modal-title spk-shell-title">
              Выбор спикера
            </h2>
            <p className="spk-shell-sub truncate">
              3. Политика
              {' · '}
              {readOnly
                ? 'Ожидание выбора…'
                : (
                  <>
                    Выбирает{' '}
                    <span className="spk-shell-em">{activePlayer.name}</span>
                  </>
                )}
            </p>
          </div>
          <div className="spk-shell-badge" title="Карта политики">
            <i className="fa-solid fa-gavel" aria-hidden="true" />
            <span>Politics</span>
          </div>
        </header>

        <div className="spk-shell-body">
          <section className="spk-col-seats" aria-label="Игроки">
            <header className="spk-col-head">Кто станет спикером?</header>
            <ul className="spk-seat-grid">
              {seats.map((player) => {
                const faction = factionOf(player);
                const isCurrent = player.id === speakerId;
                const isPicker = player.id === activePlayer.id;
                return (
                  <li key={player.id}>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && onSelectSpeaker?.(player.id)}
                      className={`spk-seat ${
                        isCurrent ? 'is-current' : ''
                      } ${isPicker ? 'is-picker' : ''} ${readOnly ? 'is-readonly' : ''}`}
                      style={{ '--seat-color': player.color || '#64748b' }}
                    >
                      <span className="spk-seat-avatar" style={{ borderColor: player.color || '#64748b' }}>
                        {faction?.iconUrl ? (
                          <img src={faction.iconUrl} alt="" />
                        ) : (
                          <span className="spk-seat-dot" style={{ backgroundColor: player.color || '#64748b' }} />
                        )}
                      </span>
                      <span className="spk-seat-meta">
                        <span className="spk-seat-name truncate">{player.name}</span>
                        <span className="spk-seat-tags">
                          {isCurrent && <span className="spk-tag is-speaker">Спикер</span>}
                          {isPicker && <span className="spk-tag is-picker">Ход</span>}
                        </span>
                      </span>
                      {!readOnly && (
                        <span className="spk-seat-cta" aria-hidden="true">
                          <i className="fa-solid fa-chevron-right" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
