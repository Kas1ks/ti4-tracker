import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { agendaById, agendaEffectText } from '../data/agendas';

/**
 * Politics strategy primary: look at top 2 agenda cards and put each on top or bottom.
 * Apply order = list order (first placement applied first).
 */
export function PoliticsPeekModal({
  show,
  minimized = false,
  cardIds = [],
  canAct = false,
  onConfirm,
  onMinimize,
  onClose,
}) {
  const [entered, setEntered] = useState(false);
  const initial = useMemo(
    () => (cardIds || []).map((id) => ({ cardId: String(id), dest: 'top' })),
    [cardIds],
  );
  const [rows, setRows] = useState(initial);

  const open = show && !minimized;
  useEscapeKey(open && (onMinimize || onClose));
  useBodyScrollLock(open);

  useEffect(() => {
    setRows((cardIds || []).map((id) => ({ cardId: String(id), dest: 'top' })));
  }, [cardIds, show]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const move = (index, dir) => {
    setRows((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const setDest = (index, dest) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, dest } : row)));
  };

  return createPortal(
    <div
      className={`pol-overlay fixed inset-0 z-50 game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
      onClick={canAct ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="politics-peek-title"
        className={`pol-shell relative w-full max-md:h-full md:w-full md:max-w-xl md:h-auto md:max-h-[min(90vh,720px)] flex flex-col overflow-hidden ${entered ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pol-shell-head">
          <div className="pol-shell-head-main">
            <span className="pol-shell-mark" aria-hidden="true">
              <i className="fa-solid fa-eye" />
            </span>
            <div>
              <h2 id="politics-peek-title" className="pol-shell-title">Политика · просмотр</h2>
              <p className="pol-shell-sub">
                2 верхние карты колоды. Положите каждую на верх или вниз (порядок в списке = порядок укладки).
              </p>
            </div>
          </div>
          {typeof (onMinimize || onClose) === 'function' && (
            <button
              type="button"
              className="pol-icon-btn pol-icon-btn--corner"
              onClick={onMinimize || onClose}
              aria-label="Свернуть"
              title="Свернуть"
            >
              <i className="fa-solid fa-minus text-base" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="pol-shell-body modal-scroll space-y-3">
          {!rows.length ? (
            <p className="text-sm text-slate-400 text-center py-8">В колоде нет карт для просмотра.</p>
          ) : (
            rows.map((row, index) => {
              const card = canAct ? agendaById.get(row.cardId) : null;
              const effect = card ? agendaEffectText(card) : '';
              return (
                <article key={row.cardId} className={`pol-card-reveal is-directive${!canAct ? ' is-shrouded' : ''}`}>
                  <div className="pol-card-reveal-top">
                    <span className="pol-card-reveal-kind">
                      {canAct ? (card?.kind === 'law' ? 'Закон' : 'Директива') : 'Скрыто'}
                      {' · '}
                      шаг {index + 1}
                    </span>
                    <h3 className="pol-card-reveal-title">
                      {canAct ? (card?.title || row.cardId) : 'Карта колоды политики'}
                    </h3>
                    {canAct && card?.desc && <p className="pol-card-reveal-desc">{card.desc}</p>}
                  </div>
                  {canAct && effect && (
                    <div className="pol-card-reveal-effect">
                      {effect.split('\n\n').map((block, i) => (
                        <p key={i}>{block}</p>
                      ))}
                    </div>
                  )}
                  {canAct && (
                    <div className="pol-peek-controls">
                      <div className="pol-peek-dest">
                        <button
                          type="button"
                          className={`pol-peek-dest-btn ${row.dest === 'top' ? 'is-on' : ''}`}
                          onClick={() => setDest(index, 'top')}
                        >
                          На верх колоды
                        </button>
                        <button
                          type="button"
                          className={`pol-peek-dest-btn ${row.dest === 'bottom' ? 'is-on' : ''}`}
                          onClick={() => setDest(index, 'bottom')}
                        >
                          Вниз колоды
                        </button>
                      </div>
                      {rows.length > 1 && (
                        <div className="pol-peek-order">
                          <button
                            type="button"
                            className="pol-peek-order-btn"
                            disabled={index === 0}
                            onClick={() => move(index, -1)}
                            aria-label="Раньше в укладке"
                          >
                            <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="pol-peek-order-btn"
                            disabled={index === rows.length - 1}
                            onClick={() => move(index, 1)}
                            aria-label="Позже в укладке"
                          >
                            <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {canAct && (
          <footer className="pol-shell-foot p-3 border-t border-violet-800/40">
            <button
              type="button"
              className="pol-covert-reveal-btn w-full justify-center"
              onClick={() => onConfirm?.(rows)}
            >
              Подтвердить укладку
            </button>
          </footer>
        )}
        {!canAct && (
          <footer className="pol-shell-foot p-3 border-t border-violet-800/40">
            <p className="pol-covert-reveal-wait m-0">Ожидание игрока с «Политикой»…</p>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
