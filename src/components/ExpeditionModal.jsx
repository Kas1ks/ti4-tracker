import { useEffect, useState } from 'react';
import { ALL_FACTIONS } from '../data/gameData';
import { EXPEDITION_SLICES, EXPEDITION_PLANET_SRC } from '../data/expedition';
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
  useBodyScrollLock(show && !minimized && isMobile);
  useEscapeKey(() => {
    if (isMobile) onClose?.();
    else onMinimize?.();
  }, show && !minimized);

  useEffect(() => {
    if (!show || minimized) setHostEditOpen(false);
  }, [show, minimized]);

  if (!show) return null;

  const slices = expedition?.slices || {};
  const claimed = EXPEDITION_SLICES.filter(s => slices[s.id] != null).length;
  const playerById = (id) => players.find(p => p.id === id) || null;
  const factionOf = (p) => (p ? ALL_FACTIONS.find(f => f.id === p.factionId) : null);
  const showPlanet = !!expedition?.completed;
  const showHostEdit = canEdit && typeof onSetSlice === 'function';

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="fixed z-[60] right-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-4 md:right-4 flex items-center gap-2 rounded-xl border border-cyan-500/60 bg-slate-950/95 px-3.5 py-2.5 text-xs font-bold text-cyan-200 shadow-lg"
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
          ? 'fixed inset-0 z-[55] bg-black/85 backdrop-blur-sm flex flex-col'
          : 'fixed z-[45] right-4 bottom-4 w-[360px] max-h-[min(72vh,620px)] pointer-events-none'
      }
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal={isMobile ? true : undefined}
        aria-labelledby="expedition-title"
        className={
          isMobile
            ? 'flex flex-col w-full h-full max-h-[100dvh] bg-slate-950 pointer-events-auto'
            : 'pointer-events-auto flex flex-col w-full max-h-[min(72vh,620px)] rounded-2xl border border-cyan-700/40 bg-slate-950 shadow-2xl overflow-hidden'
        }
      >
        <header className="flex-shrink-0 px-3 md:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3 pb-2 border-b border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/90">
                Thunder&apos;s Edge
              </div>
              <h2
                id="expedition-title"
                className="font-orbitron font-black text-base md:text-lg text-white leading-tight mt-0.5"
              >
                Грозовой рубеж
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {showPlanet
                  ? 'Планета в игре'
                  : `${claimed}/6${expedition?.awaitingControlPick ? ' · выбор контроля' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {showHostEdit && (
                <button
                  type="button"
                  onClick={() => setHostEditOpen(v => !v)}
                  className={`text-slate-500 hover:text-amber-300 transition p-2 ${hostEditOpen ? 'text-amber-400' : ''}`}
                  aria-label={hostEditOpen ? 'Скрыть правку слотов' : 'Править слоты'}
                  title={hostEditOpen ? 'Скрыть правку' : 'Править слоты'}
                >
                  <i className="fa-solid fa-pen-to-square text-sm" aria-hidden="true" />
                </button>
              )}
              {onMinimize && (
                <button
                  type="button"
                  onClick={onMinimize}
                  className="text-slate-500 hover:text-white transition p-2"
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
                  className="text-slate-500 hover:text-white transition p-2"
                  aria-label="Закрыть"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 md:px-4 py-3 space-y-3 modal-scroll bg-slate-950">
          {canClaim && activePlayer && !showPlanet && (
            <p className="text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1.5">
              Ход:{' '}
              <span className="text-cyan-200 font-bold">{activePlayer.name}</span>
              {' '}— можно занять 1 слот
            </p>
          )}
          {claimedThisTurn && !showPlanet && !expedition?.awaitingControlPick && (
            <p className="text-[11px] text-slate-500 px-0.5">
              На этом ходу экспедиция уже занята.
            </p>
          )}

          {!showPlanet ? (
            <ExpeditionToken
              expedition={expedition}
              players={players}
              canClaim={canClaim}
              activePlayer={activePlayer}
              onClaimSlice={onClaimSlice}
              size={isMobile ? 'lg' : 'md'}
              interactive
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
            <section className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-3 space-y-2">
              <h3 className="font-orbitron font-bold text-xs text-cyan-200 uppercase">
                Контроль
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
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
                        className="rounded-lg border border-cyan-600/50 bg-black px-2.5 py-2 text-left hover:bg-cyan-950/40 transition flex items-center gap-2"
                      >
                        {faction && (
                          <span
                            className="w-8 h-8 rounded-full border p-0.5 bg-slate-950 flex-shrink-0"
                            style={{ borderColor: p.color || '#94a3b8' }}
                          >
                            <img src={faction.iconUrl} alt="" className="w-full h-full object-contain" />
                          </span>
                        )}
                        <span className="font-bold text-xs text-cyan-100">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Ждём {playerById(expedition.placedById)?.name || '…'}
                </p>
              )}
            </section>
          )}

          {showPlanet && expedition.controllerId != null && (
            <p className="text-xs text-slate-300 flex items-center gap-2">
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
            <section className="rounded-xl border border-amber-700/40 bg-amber-950/15 p-3 space-y-2">
              <h3 className="font-orbitron font-bold text-[10px] uppercase text-amber-400/90">
                Правка слотов
              </h3>
              <ul className="space-y-1.5">
                {EXPEDITION_SLICES.map((slice) => {
                  const ownerId = slices[slice.id];
                  const owner = ownerId != null ? playerById(ownerId) : null;
                  const ownerFaction = factionOf(owner);
                  return (
                    <li
                      key={slice.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 flex items-center gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-200 truncate">{slice.label}</div>
                        <div className="text-[10px] text-slate-500 truncate">{slice.hint}</div>
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
                        className="max-w-[7.5rem] bg-slate-950 border border-slate-700 rounded-md text-[11px] text-slate-200 px-1.5 py-1"
                        aria-label={`Владелец слота ${slice.label}`}
                      >
                        <option value="">— пусто —</option>
                        {players.filter(p => !p.eliminated).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      {ownerId != null && (
                        <button
                          type="button"
                          onClick={() => onSetSlice(slice.id, null)}
                          className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-700 flex items-center justify-center flex-shrink-0"
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

          <section>
            <h3 className="font-orbitron font-bold text-[10px] uppercase text-slate-500 mb-1.5">
              Прорыв
            </h3>
            <ul className="grid grid-cols-2 gap-1">
              {players.filter(p => !p.eliminated).map(p => {
                const faction = factionOf(p);
                return (
                  <li
                    key={p.id}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold flex items-center gap-1.5 ${
                      p.breakthrough
                        ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-100'
                        : 'border-slate-800 bg-slate-900 text-slate-500'
                    }`}
                  >
                    {faction ? (
                      <span
                        className="w-5 h-5 rounded-full border p-0.5 bg-black flex-shrink-0"
                        style={{ borderColor: p.color || '#64748b' }}
                      >
                        <img src={faction.iconUrl} alt="" className="w-full h-full object-contain" />
                      </span>
                    ) : null}
                    <span className="truncate flex-1">{p.name}</span>
                    {p.breakthrough ? '✓' : '—'}
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
