import { ALL_FACTIONS } from '../data/gameData';
import { secretObjectiveById, secretObjectivePhaseLabel } from '../data/secretObjectives';

function phaseClass(phase) {
  if (phase === 'action') return 'is-action';
  if (phase === 'agenda') return 'is-politics';
  return 'is-status';
}

/**
 * Table of scored secret objectives by player.
 * Used in mobile (Секретные → Все) and desktop modal.
 */
export function ScoredSecretsBoard({ players = [], className = '' }) {
  const seats = (players || []).filter((p) => {
    if (!p || p.eliminated) return false;
    const scoredIds = Array.isArray(p.secretScored) ? p.secretScored : [];
    return scoredIds.length > 0 || (Number(p.secrets) || 0) > 0;
  });

  if (!seats.length) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        Пока никто не достиг секретную цель
      </p>
    );
  }

  return (
    <div className={`scored-secrets-board space-y-3 ${className}`} aria-label="Достигнутые секретные цели">
      {seats.map((p) => {
        const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
        const scoredIds = Array.isArray(p.secretScored) ? p.secretScored : [];
        const scoredCount = Number(p.secrets) || 0;
        return (
          <section key={p.id} className="scored-secrets-seat">
            <header className="scored-secrets-seat-head">
              <span
                className="scored-secrets-avatar"
                style={{ borderColor: p.color || '#64748b' }}
              >
                {faction?.iconUrl ? (
                  <img src={faction.iconUrl} alt="" />
                ) : (
                  <span
                    className="scored-secrets-dot"
                    style={{ backgroundColor: p.color || '#64748b' }}
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="scored-secrets-name truncate">{p.name}</div>
                <div className="scored-secrets-faction truncate">
                  {faction?.name || '—'}
                </div>
              </div>
              <span className="scored-secrets-count" title="Достигнуто секреток">
                <i className="fa-solid fa-check" aria-hidden="true" />
                {scoredCount}
              </span>
            </header>

            {scoredIds.length === 0 ? (
              <p className="scored-secrets-empty">
                Засчитаны без карты (старые данные) — список пуст
              </p>
            ) : (
              <ul className="scored-secrets-list">
                {scoredIds.map((cardId) => {
                  const card = secretObjectiveById.get(cardId);
                  return (
                    <li key={cardId} className="scored-secrets-item">
                      <div className="scored-secrets-item-top">
                        <span className="scored-secrets-item-title">
                          {card?.title || cardId}
                        </span>
                        <span className={`scored-secrets-phase ${phaseClass(card?.phase)}`}>
                          {secretObjectivePhaseLabel(card?.phase)}
                        </span>
                      </div>
                      {card?.desc && (
                        <p className="scored-secrets-item-desc">{card.desc}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ScoredSecretsModal({ show, onClose, players = [] }) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scored-secrets-title"
        className="flex flex-col w-full h-full max-h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-lg bg-slate-950 md:rounded-3xl md:border md:border-violet-500/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-start justify-between gap-3 px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-5 pb-3 border-b border-slate-800">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-violet-400/90">
              Секретные цели
            </div>
            <h2
              id="scored-secrets-title"
              className="font-orbitron font-black text-xl text-violet-100 leading-tight mt-0.5"
            >
              Достигнутые
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Какие секретки уже засчитаны у каждого игрока
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition p-2 -mr-1 flex-shrink-0"
            aria-label="Закрыть"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 md:px-6 py-4 modal-scroll">
          <ScoredSecretsBoard players={players} />
        </div>
      </div>
    </div>
  );
}
