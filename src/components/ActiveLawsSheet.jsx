import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { agendaEffectText } from '../data/agendas';

/** Sheet of lasting laws currently in play (host may remove). */
export function ActiveLawsSheet({
  show,
  onClose,
  laws = [],
  players = [],
  canAdmin = false,
  onRemoveLaw,
}) {
  const [entered, setEntered] = useState(false);
  useEscapeKey(show && onClose);
  useBodyScrollLock(show);

  useEffect(() => {
    if (!show) {
      setEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [show]);

  if (!show) return null;

  const nameById = new Map(players.map((p) => [p.id, p.name]));

  return createPortal(
    <div
      className={`pol-overlay fixed inset-0 z-50 game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-laws-title"
        className={`pol-shell relative w-full max-md:h-full md:w-full md:max-w-xl md:h-auto md:max-h-[min(90vh,720px)] flex flex-col overflow-hidden ${entered ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pol-shell-head">
          <div className="pol-shell-head-main">
            <span className="pol-shell-mark" aria-hidden="true">
              <i className="fa-solid fa-scroll" />
            </span>
            <div>
              <h2 id="active-laws-title" className="pol-shell-title">Активные законы</h2>
              <p className="pol-shell-sub">
                {laws.length ? `${laws.length} в игре` : 'Пока нет принятых законов'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pol-icon-btn pol-icon-btn--corner"
            onClick={onClose}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <i className="fa-solid fa-xmark text-base" aria-hidden="true" />
          </button>
        </header>

        <div className="pol-shell-body modal-scroll space-y-3">
          {laws.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Законы появятся здесь после голосования «За» (или elect) в фазе политики.
            </p>
          ) : (
            laws.map((law) => {
              const ownerName = law.ownerPlayerId != null
                ? (nameById.get(law.ownerPlayerId) || nameById.get(Number(law.ownerPlayerId)) || null)
                : null;
              const effect = agendaEffectText({
                voteType: law.elect === 'for_against' ? 'FOR_AGAINST' : 'OTHER',
                forText: law.forText,
                againstText: law.againstText,
                text: law.text || law.desc,
              });
              return (
                <article key={`${law.id}-${law.enactedRound ?? ''}`} className="pol-card-reveal is-law">
                  <div className="pol-card-reveal-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="pol-card-reveal-kind">
                          Закон
                          {law.enactedRound != null ? ` · раунд ${law.enactedRound}` : ''}
                          {ownerName ? ` · ${ownerName}` : ''}
                        </span>
                        <h3 className="pol-card-reveal-title">{law.title}</h3>
                        {law.desc && <p className="pol-card-reveal-desc">{law.desc}</p>}
                      </div>
                      {canAdmin && typeof onRemoveLaw === 'function' && (
                        <button
                          type="button"
                          className="pol-law-remove-btn"
                          title="Удалить закон"
                          aria-label={`Удалить закон ${law.title}`}
                          onClick={() => onRemoveLaw(law.id)}
                        >
                          <i className="fa-solid fa-trash-can" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {effect && (
                    <div className="pol-card-reveal-effect">
                      {effect.split('\n\n').map((block, i) => (
                        <p key={i}>{block}</p>
                      ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
