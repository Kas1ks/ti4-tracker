import { PUSH_CATEGORIES } from '../push/categories';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * Settings sheet: master push toggle + per-category filters.
 */
export function PushNotificationsSheet({
  show = false,
  onClose,
  supported = false,
  canUse = false,
  subscribed = false,
  busy = false,
  configured = null,
  categories = {},
  onEnable,
  onDisable,
  onSetCategory,
}) {
  useEscapeKey(onClose, show);
  useBodyScrollLock(!!show);

  if (!show) return null;

  const masterOn = !!subscribed;
  const unavailable = !supported || !canUse;

  return (
    <div
      className="fixed inset-0 game-modal-overlay z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-settings-title"
        className="w-full sm:max-w-md max-h-[min(92dvh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-600/60 bg-slate-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg border border-sky-400/30 flex items-center justify-center flex-shrink-0 bg-sky-950/40">
            <i className="fa-solid fa-bell text-sky-300" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="push-settings-title" className="text-sm font-bold uppercase tracking-wide text-sky-100/95">
              Оповещения
            </h2>
            <p className="text-[12px] text-slate-400 leading-snug mt-0.5">
              Пуши, когда приложение в фоне. Выберите нужные типы.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/15 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
            aria-label="Закрыть"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 space-y-3 modal-scroll">
          {unavailable ? (
            <p className="text-sm text-slate-400">
              Оповещения недоступны в этом браузере или вне живой комнаты.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-600/50 bg-slate-900/70 px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-200">
                    Включить оповещения
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    {masterOn ? 'Подписка активна' : 'Сейчас выключены'}
                  </p>
                  {configured === false && (
                    <p className="text-[11px] text-amber-300/90 mt-1">
                      Сервер ещё не настроен (VAPID) — попробуйте позже.
                    </p>
                  )}
                  {busy && (
                    <p className="text-[11px] text-slate-500 mt-1">Обновление…</p>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={masterOn}
                  disabled={busy || configured === false}
                  onClick={() => (masterOn ? onDisable?.() : onEnable?.())}
                  className={`relative w-11 h-6 rounded-full border transition-colors flex-shrink-0 disabled:opacity-50 ${
                    masterOn
                      ? 'bg-sky-500/80 border-sky-300/40'
                      : 'bg-slate-700 border-slate-500/50'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      masterOn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div
                className={`space-y-2 transition-opacity ${masterOn ? 'opacity-100' : 'opacity-45 pointer-events-none'}`}
                aria-disabled={!masterOn}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-0.5">
                  Какие оповещения получать
                </div>
                {PUSH_CATEGORIES.map((cat) => {
                  const on = categories?.[cat.id] !== false;
                  return (
                    <label
                      key={cat.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2.5 cursor-pointer hover:bg-slate-900/70"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 accent-sky-400 flex-shrink-0"
                        checked={on}
                        disabled={!masterOn || busy}
                        onChange={(e) => onSetCategory?.(cat.id, e.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-slate-100 font-medium leading-snug">
                          {cat.label}
                        </span>
                        <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">
                          {cat.desc}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
