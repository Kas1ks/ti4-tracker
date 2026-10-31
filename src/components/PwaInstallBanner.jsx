import { useState } from 'react';
import { promptInstallFromGesture, usePwaInstall } from '../hooks/usePwaInstall';

/**
 * Install hint on the hub.
 * Android: «Установить» while not installed; sync prompt(); guide if Chrome has no BIP.
 * @param {{ variant?: 'default' | 'hub' }} props
 */
export function PwaInstallBanner({ variant = 'default' }) {
  const {
    showBanner,
    showIosHint,
    showIosSafariHint,
    showInstallButton,
    dismiss,
  } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (!showBanner) return null;

  let body;
  if (showIosHint) {
    body = showIosSafariHint
      ? 'Safari → «Поделиться» (□↑) → «На экран Домой». Дальше открывайте TI4 с иконки.'
      : 'Откройте сайт в Safari, затем «Поделиться» → «На экран Домой».';
  } else {
    body = 'Добавьте приложение на главный экран — быстрее заходить в комнату за столом.';
  }

  const isHub = variant === 'hub';
  const installBtnClass = isHub
    ? 'rounded-lg bg-[var(--hub-gold)] px-3 py-1.5 text-[11px] font-bold text-[#1a1408] hover:brightness-110 transition'
    : 'rounded-xl bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 transition';
  const ghostBtnClass = isHub
    ? 'rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] font-bold text-[var(--hub-muted)] hover:text-white transition'
    : 'rounded-xl border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 transition';

  const onInstallClick = () => {
    // CRITICAL: no await before prompt() — Chrome drops user activation otherwise.
    const result = promptInstallFromGesture();
    if (result.ok) {
      setGuideOpen(false);
      return;
    }
    setGuideOpen(true);
  };

  return (
    <div
      className={
        isHub
          ? 'hub-pwa text-left'
          : 'rounded-2xl border-2 border-cyan-500/50 bg-cyan-950/30 px-3.5 py-3 text-left shadow-lg shadow-cyan-900/20'
      }
    >
      <div className="flex items-start gap-3">
        <img
          src="/pwa/icon-192.png"
          alt=""
          width={isHub ? 32 : 40}
          height={isHub ? 32 : 40}
          className={
            isHub
              ? 'mt-0.5 h-8 w-8 flex-shrink-0 rounded-lg border border-[var(--hub-border-soft)] bg-black/40 object-cover'
              : 'mt-0.5 h-10 w-10 flex-shrink-0 rounded-xl border border-cyan-700/50 bg-slate-950 object-cover'
          }
        />
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${isHub ? 'text-[var(--hub-gold-bright)]' : 'text-cyan-100'}`}>
            Установить на телефон
          </div>
          <p className={`mt-1 text-[11px] leading-relaxed ${isHub ? 'text-[var(--hub-muted)]' : 'text-slate-300'}`}>
            {body}
          </p>
          {guideOpen ? (
            <div
              className={
                isHub
                  ? 'mt-2 rounded-lg border border-[var(--hub-border)] bg-black/50 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--hub-muted)]'
                  : 'mt-2 rounded-xl border border-cyan-700/50 bg-slate-950/90 px-3 py-2.5 text-[11px] leading-relaxed text-slate-300'
              }
            >
              <p className={isHub ? 'font-bold text-[var(--hub-gold-bright)]' : 'font-bold text-cyan-100'}>
                Установка через меню Chrome
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Нажмите <b>⋮</b> справа вверху</li>
                <li>Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b></li>
                <li>Подтвердите установку</li>
              </ol>
              <p className="mt-2 opacity-90">
                Если пункта нет: Chrome → значок замка у адреса → «Разрешения» / «Удалить данные сайта», обновите страницу и попробуйте снова.
              </p>
            </div>
          ) : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {showInstallButton ? (
              <button type="button" onClick={onInstallClick} className={installBtnClass}>
                Установить
              </button>
            ) : null}
            <button type="button" onClick={dismiss} className={ghostBtnClass}>
              Скрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
