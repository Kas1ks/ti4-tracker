import { useState } from 'react';

/**
 * Host-only test shortcuts. Mount only behind `import.meta.env.DEV`.
 */
export function DevToolsPanel({
  canSkipDraft = false,
  canPassAll = false,
  canSkipStatus = false,
  canSkipSecretDraft = false,
  onSkipDraft,
  onPassAll,
  onSkipStatus,
  onSkipSecretDraft,
}) {
  const [open, setOpen] = useState(true);

  return (
    <aside className="dev-tools-panel" aria-label="DEV tools">
      <button
        type="button"
        className="dev-tools-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="dev-tools-badge">DEV</span>
        <span className="dev-tools-toggle-label">{open ? 'Свернуть' : 'Тест'}</span>
      </button>
      {open && (
        <div className="dev-tools-actions">
          <button
            type="button"
            className="dev-tools-btn"
            disabled={!canSkipDraft}
            onClick={onSkipDraft}
            title="Автораздача КС по очереди драфта и старт раунда"
          >
            Пропуск драфта КС
          </button>
          <button
            type="button"
            className="dev-tools-btn"
            disabled={!canSkipSecretDraft}
            onClick={onSkipSecretDraft}
            title="Оставить первую секретную каждому и закрыть выбор"
          >
            Скип выбор секреток
          </button>
          <button
            type="button"
            className="dev-tools-btn"
            disabled={!canPassAll}
            onClick={onPassAll}
            title="Все пасуют — конец фазы действий"
          >
            Общий пас
          </button>
          <button
            type="button"
            className="dev-tools-btn"
            disabled={!canSkipStatus}
            onClick={onSkipStatus}
            title="Закрыть чеклист статуса и продолжить (как «Продолжить»)"
          >
            Пропуск фазы статуса
          </button>
        </div>
      )}
    </aside>
  );
}
