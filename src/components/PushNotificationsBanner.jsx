/**
 * Compact prompt after joining as a player: enable turn / action Web Push.
 * Also used as a small status strip when already decided.
 */
export function PushNotificationsBanner({
  showPrompt = false,
  supported = false,
  canUse = false,
  subscribed = false,
  busy = false,
  configured = null,
  onEnable,
  onDismiss,
  onDisable,
  compact = false,
}) {
  if (!supported || !canUse) return null;

  if (showPrompt) {
    return (
      <div
        data-testid="push-prompt-banner"
        className={
          compact
            ? 'rounded-xl border border-sky-500/40 bg-sky-950/80 px-3 py-2'
            : 'mx-3 mt-2 md:mx-0 rounded-xl border border-sky-500/40 bg-sky-950/90 px-3 py-2.5 shadow-lg'
        }
        role="status"
      >
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg border border-sky-400/30 flex items-center justify-center flex-shrink-0 bg-black/20">
            <i className="fa-solid fa-bell text-sky-300 text-sm" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-100/90">
              Оповещения
            </div>
            <p className="text-sm text-slate-200 leading-snug mt-0.5">
              Включить оповещения о вашем ходе? Сработают, когда приложение в фоне.
            </p>
            {configured === false && (
              <p className="text-xs text-amber-300/90 mt-1">
                Сервер ещё не настроен (VAPID) — попробуйте позже.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                disabled={busy || configured === false}
                onClick={() => onEnable?.()}
                className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-50"
              >
                {busy ? '…' : 'Включить'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss?.()}
                className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 disabled:opacity-50"
              >
                Не сейчас
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        data-testid="push-toggle-row"
        className="rounded-xl border border-slate-600/50 bg-slate-900/70 px-3 py-2 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-300">
            Оповещения
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            {subscribed ? 'Пуш о вашем ходе включён' : 'Пуш о вашем ходе выключен'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={subscribed}
          disabled={busy || configured === false}
          onClick={() => (subscribed ? onDisable?.() : onEnable?.())}
          className={`relative w-11 h-6 rounded-full border transition-colors flex-shrink-0 disabled:opacity-50 ${
            subscribed
              ? 'bg-sky-500/80 border-sky-300/40'
              : 'bg-slate-700 border-slate-500/50'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              subscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }

  return null;
}
