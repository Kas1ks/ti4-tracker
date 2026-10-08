import { usePwaInstall } from '../hooks/usePwaInstall';

/**
 * Install hint on the hub.
 * Native «Установить» only on HTTPS Android; on LAN http we show menu steps + app icon.
 */
export function PwaInstallBanner() {
  const {
    showBanner,
    showIosHint,
    showIosSafariHint,
    showManualAndroid,
    canNativePrompt,
    isSecureContext,
    promptInstall,
    dismiss,
  } = usePwaInstall();

  if (!showBanner) return null;

  let body;
  if (showIosHint) {
    body = showIosSafariHint
      ? 'Safari → «Поделиться» (□↑) → «На экран Домой». Дальше открывайте TI4 с иконки.'
      : 'Откройте сайт в Safari, затем «Поделиться» → «На экран Домой».';
  } else if (canNativePrompt) {
    body = 'Добавьте приложение на главный экран — быстрее заходить в комнату за столом.';
  } else {
    body = isSecureContext
      ? 'Chrome → меню ⋮ → «Установить приложение» / «Добавить на главный экран».'
      : 'Сейчас локальный http — кнопка «Установить» может не появиться. Chrome → меню ⋮ → «Добавить на главный экран». После деплоя (https) будет нормальная установка.';
  }

  return (
    <div className="rounded-2xl border-2 border-cyan-500/50 bg-cyan-950/30 px-3.5 py-3 text-left shadow-lg shadow-cyan-900/20">
      <div className="flex items-start gap-3">
        <img
          src="/pwa/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="mt-0.5 h-10 w-10 flex-shrink-0 rounded-xl border border-cyan-700/50 bg-slate-950 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-cyan-100">Установить на телефон</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
            {body}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {canNativePrompt && (
              <button
                type="button"
                onClick={() => promptInstall()}
                className="rounded-xl bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 transition"
              >
                Установить
              </button>
            )}
            {showManualAndroid && (
              <span className="inline-flex items-center rounded-xl border border-cyan-700/60 bg-slate-950/80 px-3 py-1.5 text-[11px] font-bold text-cyan-200">
                <i className="fa-solid fa-ellipsis-vertical mr-1.5" aria-hidden="true" />
                Меню Chrome → на экран
              </span>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition"
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
