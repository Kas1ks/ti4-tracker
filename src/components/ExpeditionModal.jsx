import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_FACTIONS } from '../data/gameData';
import { EXPEDITION_SLICES, EXPEDITION_PLANET_SRC } from '../data/expedition';
import { secretObjectiveById, secretObjectivePhaseLabel } from '../data/secretObjectives';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ExpeditionToken } from './ExpeditionToken';

function useIsMobileDock() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

/**
 * TE expedition panel.
 * Desktop: docked bottom-right widget (does not block the board).
 * Mobile: full-screen sheet, only when opened from the header button.
 */
export function ExpeditionModal({
  show,
  minimized,
  expedition,
  players = [],
  activePlayer = null,
  canClaim = false,
  claimedThisTurn = false,
  canPickController = false,
  canEdit = false,
  leaders = [],
  onClaimSlice,
  onSetSlice,
  onPickController,
  onMinimize,
  onClose,
}) {
  const isMobile = useIsMobileDock();
  const [hostEditOpen, setHostEditOpen] = useState(false);
  const [secretDiscard, setSecretDiscard] = useState(null); // { playerId }
  const [secretPickId, setSecretPickId] = useState(null);
  useBodyScrollLock(show && !minimized && isMobile);
  useEscapeKey(() => {
    if (secretDiscard) {
      setSecretDiscard(null);
      setSecretPickId(null);
      return;
    }
    if (isMobile) onClose?.();
    else onMinimize?.();
  }, show && !minimized);

  useEffect(() => {
    if (!show || minimized) {
      setHostEditOpen(false);
      setSecretDiscard(null);
      setSecretPickId(null);
    }
  }, [show, minimized]);

  if (!show) return null;

  const slices = expedition?.slices || {};
  const claimed = EXPEDITION_SLICES.filter(s => slices[s.id] != null).length;
  const playerById = (id) => players.find(p => p.id === id) || null;
  const factionOf = (p) => (p ? ALL_FACTIONS.find(f => f.id === p.factionId) : null);
  const showPlanet = !!expedition?.completed;
  const showHostEdit = canEdit && typeof onSetSlice === 'function';
  const livePlayers = players.filter(p => !p.eliminated);

  const handleClaimSlice = (playerId, sliceId) => {
    if (sliceId === 'secret') {
      const p = playerById(playerId);
      const hand = Array.isArray(p?.secretHand) ? p.secretHand : [];
      if (!hand.length) return;
      setSecretPickId(hand.length === 1 ? hand[0] : null);
      setSecretDiscard({ playerId });
      return;
    }
    onClaimSlice?.(playerId, sliceId);
  };

  const discardPlayer = secretDiscard ? playerById(secretDiscard.playerId) : null;
  const discardHand = Array.isArray(discardPlayer?.secretHand) ? discardPlayer.secretHand : [];

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="fixed z-[60] right-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-4 md:right-4 flex items-center gap-2 rounded-xl border border-[var(--game-line-gold)] bg-[rgba(10,12,18,0.95)] px-3.5 py-2.5 text-xs font-bold text-[var(--game-gold-bright)] shadow-lg"
      >
        <i className="fa-solid fa-mountain" aria-hidden="true" />
        <span>Экспедиция {claimed}/6</span>
      </button>
    );
  }

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 z-[55] game-modal-overlay flex items-stretch justify-center p-2 modal-overlay'
          : 'fixed z-[45] right-4 bottom-4 w-[380px] max-h-[min(78vh,680px)] pointer-events-none'
      }
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal={isMobile ? true : undefined}
        aria-labelledby="expedition-title"
        className={
          isMobile
            ? 'game-exp-shell is-mobile pointer-events-auto w-full max-h-[min(96dvh,100%)] overflow-hidden flex flex-col'
            : 'game-exp-shell is-desktop pointer-events-auto w-full max-h-[min(78vh,680px)] overflow-hidden flex flex-col'
        }
      >
        <div className="game-exp-inner">
          <header className="game-exp-head">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="game-exp-kicker">Thunder&apos;s Edge</div>
                <h2 id="expedition-title" className="game-modal-title game-exp-title">
                  Грозовой рубеж
                </h2>
                <p className="game-exp-count">
                  {showPlanet
                    ? 'Планета в игре'
                    : `${claimed}/6${expedition?.awaitingControlPick ? ' · выбор контроля' : ''}`}
                </p>
              </div>
              <div className="game-exp-head-actions">
                {showHostEdit && (
                  <button
                    type="button"
                    onClick={() => setHostEditOpen(v => !v)}
                    className={`game-exp-icon-btn ${hostEditOpen ? 'is-on' : ''}`}
                    aria-label={hostEditOpen ? 'Скрыть правку слотов' : 'Править слоты'}
                    title={hostEditOpen ? 'Скрыть правку' : 'Править слоты'}
                  >
                    <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                  </button>
                )}
                {onMinimize && (
                  <button
                    type="button"
                    onClick={onMinimize}
                    className="game-exp-icon-btn"
                    aria-label="Свернуть"
                    title="Свернуть"
                  >
                    <i className="fa-solid fa-window-minimize" aria-hidden="true" />
                  </button>
                )}
                {isMobile && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="game-exp-icon-btn"
                    aria-label="Закрыть"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="game-exp-body">
            {canClaim && activePlayer && !showPlanet && (
              <p className="game-exp-status">
                Ход:{' '}
                <span className="game-exp-status-name">{activePlayer.name}</span>
                {' '}— можно занять 1 слот
              </p>
            )}
            {claimedThisTurn && !showPlanet && !expedition?.awaitingControlPick && (
              <p className="game-exp-note">
                На этом ходу экспедиция уже занята.
              </p>
            )}

            {!showPlanet ? (
              <ExpeditionToken
                expedition={expedition}
                players={players}
                canClaim={canClaim}
                activePlayer={activePlayer}
                onClaimSlice={handleClaimSlice}
                size={isMobile ? 'lg' : 'md'}
                interactive
                className="game-exp-token"
              />
            ) : (
              <div className="relative mx-auto w-full max-w-[280px]">
                <div className="relative aspect-square">
                  <img
                    src={EXPEDITION_PLANET_SRC}
                    alt="Планета Грозовой рубеж"
                    className="absolute inset-0 w-full h-full object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            )}

            {expedition?.awaitingControlPick && (
              <section className="game-exp-control">
                <h3 className="game-exp-section-title">Контроль</h3>
                <p className="game-exp-note">
                  Ничья. Выбирает {playerById(expedition.placedById)?.name || '…'}
                </p>
                {canPickController ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {leaders.map(id => {
                      const p = playerById(id);
                      const faction = factionOf(p);
                      if (!p) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onPickController?.(expedition.placedById, id)}
                          className="rounded-lg border border-[var(--game-line-gold)] bg-black/40 px-2.5 py-2 text-left hover:bg-[rgba(201,162,39,0.12)] transition flex items-center gap-2"
                        >
                          {faction && (
                            <span
                              className="w-8 h-8 rounded-full border p-0.5 bg-black/60 flex-shrink-0"
                              style={{ borderColor: p.color || '#94a3b8' }}
                            >
                              <img src={faction.iconUrl} alt="" className="w-full h-full object-contain" />
                            </span>
                          )}
                          <span className="font-bold text-xs text-[var(--game-text)]">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="game-exp-note">
                    Ждём {playerById(expedition.placedById)?.name || '…'}
                  </p>
                )}
              </section>
            )}

            {showPlanet && expedition.controllerId != null && (
              <p className="text-xs text-[var(--game-text)] flex items-center gap-2">
                Контроль:{' '}
                {(() => {
                  const ctrl = playerById(expedition.controllerId);
                  const faction = factionOf(ctrl);
                  return (
                    <>
                      {faction && (
                        <span
                          className="inline-flex w-6 h-6 rounded-full border p-0.5 bg-black"
                          style={{ borderColor: ctrl?.color || '#34d399' }}
                        >
                          <img src={faction.iconUrl} alt="" className="w-full h-full object-contain" />
                        </span>
                      )}
                      <span className="font-bold text-emerald-200">{ctrl?.name}</span>
                    </>
                  );
                })()}
              </p>
            )}

            {showHostEdit && hostEditOpen && (
              <section className="game-exp-control">
                <h3 className="game-exp-section-title">Правка слотов</h3>
                <ul className="space-y-1.5">
                  {EXPEDITION_SLICES.map((slice) => {
                    const ownerId = slices[slice.id];
                    const owner = ownerId != null ? playerById(ownerId) : null;
                    const ownerFaction = factionOf(owner);
                    return (
                      <li
                        key={slice.id}
                        className="game-expedition-chip px-2 py-1.5 flex items-center gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-[var(--game-text)] truncate">{slice.label}</div>
                          <div className="text-[10px] text-[var(--game-muted)] truncate">{slice.hint}</div>
                        </div>
                        {owner && ownerFaction && (
                          <span
                            className="w-6 h-6 rounded-full border p-0.5 bg-black flex-shrink-0"
                            style={{ borderColor: owner.color || '#64748b' }}
                            title={owner.name}
                          >
                            <img src={ownerFaction.iconUrl} alt="" className="w-full h-full object-contain" />
                          </span>
                        )}
                        <select
                          value={ownerId ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            onSetSlice(slice.id, raw === '' ? null : Number(raw));
                          }}
                          className="max-w-[7.5rem] bg-black/50 border border-[var(--game-line)] rounded-md text-[11px] text-[var(--game-text)] px-1.5 py-1"
                          aria-label={`Владелец слота ${slice.label}`}
                        >
                          <option value="">— пусто —</option>
                          {livePlayers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {ownerId != null && (
                          <button
                            type="button"
                            onClick={() => onSetSlice(slice.id, null)}
                            className="w-7 h-7 rounded-md border border-[var(--game-line)] text-[var(--game-muted)] hover:text-red-300 hover:border-red-700 flex items-center justify-center flex-shrink-0"
                            title="Снять метку"
                            aria-label={`Снять метку ${slice.label}`}
                          >
                            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="game-exp-break">
              <h3 className="game-exp-break-title">
                <i className="fa-solid fa-diamond" aria-hidden="true" />
                Прорыв
              </h3>
              <ul className="game-exp-break-grid">
                {livePlayers.map(p => {
                  const faction = factionOf(p);
                  const accent = p.color || '#64748b';
                  return (
                    <li
                      key={p.id}
                      className={`game-exp-break-seat ${p.breakthrough ? 'is-on' : ''}`}
                      style={{ '--seat-accent': accent }}
                    >
                      {faction ? (
                        <span className="game-exp-break-icon" style={{ borderColor: accent }}>
                          <img src={faction.iconUrl} alt="" className="w-full h-full object-contain" />
                        </span>
                      ) : null}
                      <span className="game-exp-break-name">{p.name}</span>
                      <span className="game-exp-break-mark">
                        {p.breakthrough ? '✓' : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </div>

      {secretDiscard && discardPlayer && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="presentation"
          onClick={() => {
            setSecretDiscard(null);
            setSecretPickId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exp-secret-discard-title"
            className="game-modal-panel w-full max-w-sm p-4 space-y-3 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="exp-secret-discard-title" className="game-modal-title text-sm uppercase">
              Сброс секретной
            </h3>
            <p className="text-xs text-slate-400">
              Чтобы занять слот экспедиции, сбросьте одну незасчитанную секретную цель из руки под низ колоды.
            </p>
            {discardHand.length === 0 ? (
              <p className="text-sm text-red-300">Нет секретных целей в руке</p>
            ) : (
              <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
                {discardHand.map((cardId) => {
                  const card = secretObjectiveById.get(cardId);
                  const selected = String(secretPickId) === String(cardId);
                  return (
                    <li key={cardId}>
                      <button
                        type="button"
                        className={`w-full text-left rounded-xl border px-3 py-2.5 space-y-1 transition-colors ${
                          selected
                            ? 'border-amber-400/80 bg-amber-950/35'
                            : 'border-slate-600/70 bg-black/30'
                        }`}
                        onClick={() => setSecretPickId(cardId)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-white">{card?.title || cardId}</span>
                          <span className="text-[10px] font-bold uppercase text-amber-200/90">
                            {secretObjectivePhaseLabel(card?.phase)}
                          </span>
                        </div>
                        {card?.desc && (
                          <p className="text-xs text-slate-400 leading-snug">{card.desc}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="game-btn-primary flex-1"
                disabled={!secretPickId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!secretPickId || !secretDiscard) return;
                  const pid = secretDiscard.playerId;
                  const cid = secretPickId;
                  setSecretDiscard(null);
                  setSecretPickId(null);
                  onClaimSlice?.(pid, 'secret', cid);
                }}
              >
                Сбросить и занять
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-600 py-2 text-sm"
                onClick={() => {
                  setSecretDiscard(null);
                  setSecretPickId(null);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
