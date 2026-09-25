/**
 * Single player-facing surface for live-room sync problems.
 * Replaces “silent hang” with reconnect / error messaging.
 */
export function SyncStatusBanner({
  roomError,
  syncLink,
  onDismissError,
}) {
  const reconnecting = syncLink === 'reconnecting';
  if (!roomError && !reconnecting) return null;

  const isError = !!roomError;
  const tone = isError
    ? 'border-red-500/70 bg-red-950/95 text-red-100'
    : 'border-amber-500/70 bg-amber-950/95 text-amber-100';
  const icon = isError ? 'fa-triangle-exclamation' : 'fa-wifi';
  const title = isError ? 'Синхронизация' : 'Переподключение…';
  const body = isError
    ? roomError
    : 'Связь с комнатой прервалась. Ждём восстановление потока…';

  return (
    <div
      data-testid="sync-status-banner"
      className="fixed inset-x-0 top-0 z-[90] p-3 md:p-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto mx-auto max-w-xl rounded-2xl border-2 shadow-lg backdrop-blur-md ${tone}`}
      >
        <div className="flex items-start gap-3 p-3 md:p-4">
          <div className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center flex-shrink-0 bg-black/20">
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-orbitron font-bold text-xs uppercase tracking-wider opacity-90">
              {title}
            </div>
            <p className="text-sm leading-snug whitespace-pre-wrap">{body}</p>
          </div>
          {isError && typeof onDismissError === 'function' ? (
            <button
              type="button"
              onClick={onDismissError}
              className="flex-shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg border border-white/25 hover:bg-white/10"
            >
              Скрыть
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
