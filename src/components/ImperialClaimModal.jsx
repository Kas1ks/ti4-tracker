import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

/**
 * Imperial (strategy 8) primary claim: Mecatol OR secret, plus one public.
 * Picks are draft-only until confirm.
 */
export function ImperialClaimModal({
  show,
  minimized,
  claim,
  players = [],
  objectives = [],
  completions = {},
  seatPlayerId = null,
  canScoreAny = false,
  onSelectPublic,
  onToggleMecatol,
  onToggleSecret,
  onConfirm,
  onPass,
  onMinimize,
  onClose,
}) {
  useEscapeKey(onMinimize || onClose, show && !minimized);
  useBodyScrollLock(show && !minimized);
  if (!show || !claim?.active) return null;

  const player = players.find(p => p.id === claim.playerId) || null;
  const isMySeat = seatPlayerId != null && seatPlayerId === claim.playerId;
  const canAct = !!player && (canScoreAny || isMySeat);

  const stages = [
    { stage: 1, title: 'Этап I · 1 ПО', color: 'text-blue-400' },
    { stage: 2, title: 'Этап II · 2 ПО', color: 'text-rose-400' },
  ];

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="fixed z-[60] right-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-4 md:right-4 flex items-center gap-2 rounded-xl border border-purple-500 bg-slate-900/95 px-4 py-2.5 text-xs font-bold text-purple-300 shadow-lg"
      >
        <i className="fa-solid fa-globe" aria-hidden="true" />
        <span>Экспансия</span>
        <i className="fa-solid fa-up-right-and-down-left-from-center text-[10px] opacity-70" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="imperial-claim-title"
        className="flex flex-col w-full h-full max-h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-xl bg-slate-950 md:rounded-3xl md:border md:border-purple-500/40 shadow-2xl"
      >
        <header className="flex-shrink-0 px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400/90">
                Стратегия · Экспансия
              </div>
              <h2
                id="imperial-claim-title"
                className="font-orbitron font-black text-xl md:text-2xl text-purple-200 leading-tight mt-0.5 truncate"
              >
                {isMySeat ? 'Ваша способность' : (player?.name || '…')}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Мекатол (+1 ПО) или взять секретку (карта, без ПО), плюс 1 общая цель — засчитается только после подтверждения
              </p>
            </div>
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="text-slate-500 hover:text-white transition p-2 -mr-1 flex-shrink-0"
                aria-label="Свернуть"
              >
                <i className="fa-solid fa-window-minimize" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 md:px-6 py-4 space-y-4 modal-scroll">
          <button
            type="button"
            disabled={!canAct}
            onClick={() => canAct && onToggleMecatol?.(claim.playerId)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition ${
              claim.mecatol
                ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            } ${canAct ? 'hover:border-amber-500/60' : 'opacity-70 cursor-default'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              claim.mecatol ? 'border-amber-400 bg-amber-500/20' : 'border-slate-700 bg-slate-950'
            }`}
            >
              <i className={`fa-solid ${claim.mecatol ? 'fa-check' : 'fa-globe'}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-orbitron font-bold text-sm uppercase tracking-wide">
                Мекатол Rex
              </span>
              <span className="block text-xs text-slate-400 mt-0.5">
                +1 ПО, если контролируете Мекатол
              </span>
            </span>
            {claim.mecatol && (
              <span className="font-orbitron font-black text-amber-300 text-sm">+1</span>
            )}
          </button>

          <button
            type="button"
            disabled={!canAct || claim.mecatol}
            onClick={() => canAct && !claim.mecatol && onToggleSecret?.(claim.playerId)}
            title={claim.mecatol ? 'Снимите Мекатол, чтобы взять секретку' : undefined}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition ${
              claim.secret
                ? 'bg-violet-500/15 border-violet-400 text-violet-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            } ${canAct && !claim.mecatol ? 'hover:border-violet-500/60' : 'opacity-70 cursor-default'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              claim.secret ? 'border-violet-400 bg-violet-500/20' : 'border-slate-700 bg-slate-950'
            }`}
            >
              <i className={`fa-solid ${claim.secret ? 'fa-check' : 'fa-user-secret'}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-orbitron font-bold text-sm uppercase tracking-wide">
                Взять секретку
              </span>
              <span className="block text-xs text-slate-400 mt-0.5">
                Взять карту секретной цели (не даёт ПО)
              </span>
            </span>
            {claim.secret && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-violet-300">Отметка</span>
            )}
          </button>

          <section className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <h3 className="font-orbitron font-bold text-sm uppercase tracking-wider text-emerald-400">
                1 общая цель
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Выберите одну цель с поля (необязательно)
              </p>
            </div>

            {objectives.length === 0 ? (
              <p className="text-sm text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-3">
                На столе пока нет общих целей
              </p>
            ) : (
              stages.map(({ stage, title, color }) => {
                const list = objectives.filter(o => Number(o.stage) === stage);
                if (list.length === 0) return null;
                return (
                  <div key={stage} className="space-y-2">
                    <h4 className={`font-orbitron font-bold text-xs uppercase tracking-wider ${color}`}>
                      {title}
                    </h4>
                    <ul className="space-y-2">
                      {list.map((obj) => {
                        const key = `${claim.playerId}_${obj.id}`;
                        const selected = claim.publicId === obj.id;
                        const alreadyHad = !!completions[key];

                        return (
                          <li key={obj.id}>
                            <button
                              type="button"
                              disabled={!canAct || alreadyHad}
                              onClick={() => {
                                if (!canAct || alreadyHad) return;
                                onSelectPublic?.(claim.playerId, obj.id);
                              }}
                              className={`w-full text-left rounded-2xl border px-3.5 py-3 transition ${
                                selected
                                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                  : alreadyHad
                                    ? 'bg-slate-950/60 border-slate-800 text-slate-500'
                                    : 'bg-slate-900 border-slate-700 text-slate-200'
                              } ${canAct && !alreadyHad ? 'hover:border-slate-500' : 'cursor-default'}`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-sm leading-snug flex-1">{obj.title}</span>
                                <span className="font-orbitron text-xs text-slate-500 flex-shrink-0">
                                  {obj.points}ПО
                                </span>
                              </div>
                              {obj.desc && (
                                <p className="text-xs text-slate-500 mt-1 leading-snug">{obj.desc}</p>
                              )}
                              {alreadyHad && (
                                <p className="text-[11px] text-slate-600 mt-1.5 font-semibold uppercase tracking-wide">
                                  Уже засчитано
                                </p>
                              )}
                              {selected && (
                                <p className="text-[11px] text-emerald-400 mt-1.5 font-semibold uppercase tracking-wide">
                                  Выбрано · засчитается при подтверждении
                                </p>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}

            {objectives.length > 0 && objectives.some(o => Number(o.stage) !== 1 && Number(o.stage) !== 2) && (
              <div className="space-y-2">
                <h4 className="font-orbitron font-bold text-xs uppercase tracking-wider text-slate-400">
                  Другие
                </h4>
                <ul className="space-y-2">
                  {objectives.filter(o => Number(o.stage) !== 1 && Number(o.stage) !== 2).map((obj) => {
                    const key = `${claim.playerId}_${obj.id}`;
                    const selected = claim.publicId === obj.id;
                    const alreadyHad = !!completions[key];
                    return (
                      <li key={obj.id}>
                        <button
                          type="button"
                          disabled={!canAct || alreadyHad}
                          onClick={() => {
                            if (!canAct || alreadyHad) return;
                            onSelectPublic?.(claim.playerId, obj.id);
                          }}
                          className={`w-full text-left rounded-2xl border px-3.5 py-3 transition ${
                            selected
                              ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                              : alreadyHad
                                ? 'bg-slate-950/60 border-slate-800 text-slate-500'
                                : 'bg-slate-900 border-slate-700 text-slate-200'
                          } ${canAct && !alreadyHad ? 'hover:border-slate-500' : 'cursor-default'}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-sm leading-snug flex-1">{obj.title}</span>
                            <span className="font-orbitron text-xs text-slate-500 flex-shrink-0">
                              {obj.points}ПО
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>

        {canAct && (
          <div className="flex-shrink-0 flex gap-3 px-4 md:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-5 border-t border-slate-800 bg-slate-950 md:rounded-b-3xl">
            <button
              type="button"
              onClick={() => onConfirm?.(claim.playerId)}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-black font-orbitron font-black text-sm uppercase tracking-wide"
            >
              Подтвердить
            </button>
            <button
              type="button"
              onClick={() => onPass?.(claim.playerId)}
              className="flex-1 py-3.5 rounded-2xl bg-slate-800 text-slate-200 font-orbitron font-bold text-sm uppercase tracking-wide border border-slate-700"
            >
              Пас
            </button>
          </div>
        )}

        {!canAct && (
          <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-slate-800 text-center text-sm text-slate-400">
            Ожидание ответа игрока {player?.name || '…'}
          </div>
        )}
      </div>
    </div>
  );
}
