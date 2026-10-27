import { useEffect, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const STATUS_STEPS = [
  {
    key: 'scoreObjectives',
    label: '1. Достижение целей',
    icon: 'fa-flag',
  },
  {
    key: 'revealObjective',
    label: '2. Раскрытие новой цели',
    icon: 'fa-clone',
  },
  {
    key: 'drawActionCards',
    label: '3. Добор карт действий',
    icon: 'fa-layer-group',
  },
  {
    key: 'gainCommandTokens',
    label: '4. Возвращение и получение жетонов приказов',
    icon: 'fa-coins',
  },
  {
    key: 'refreshAndRepair',
    label: '5. Возобновление карт и ремонт отрядов',
    icon: 'fa-wrench',
  },
  {
    key: 'returnStrategyCards',
    label: '6. Возврат карт стратегий',
    icon: 'fa-id-card',
  },
];

export function StatusPhaseModal({
  show,
  minimized,
  roundNumber,
  checks,
  scoring,
  players = [],
  onCheck,
  onStartScoring,
  onConfirm,
  onClose,
  onMinimize,
  readOnly = false,
}) {
  /** Keep overlay mounted through exit so collapse/expand can animate. */
  const EXIT_MS = 380;
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wantOpen = show && !minimized;

  useEscapeKey(onClose, wantOpen);
  // Players need to scroll the console under a minimized/read-only status view.
  useBodyScrollLock(wantOpen && !readOnly);

  useEffect(() => {
    if (!show) {
      setEntered(false);
      setMounted(false);
      return undefined;
    }
    if (wantOpen) {
      setMounted(true);
      setEntered(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    // Minimize / close: play exit, then unmount.
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [wantOpen, show]);

  if (!show || !mounted) return null;

  const allDone = Object.values(checks).every(Boolean);
  const scoringActive = !!scoring?.active;
  const responses = scoring?.responses || {};
  // Nearest incomplete step in order — gold “active” frame like the mock.
  const activeStepKey = STATUS_STEPS.find((step) => !checks[step.key])?.key ?? null;
  const subtitle = readOnly
    ? 'Только просмотр — шаги отмечает админ.'
    : 'Сначала запустите достижение целей, затем отметьте остальные шаги.';

  return (
    <div
      className={`status-overlay fixed inset-0 z-50 game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : 'is-tucking'}`}
      role="presentation"
      onClick={wantOpen ? (onMinimize || onClose) : undefined}
      style={entered ? undefined : { pointerEvents: 'none' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-phase-title"
        className={`status-shell relative w-full max-md:h-full md:w-full md:max-w-3xl md:h-auto md:max-h-[min(94vh,920px)] flex flex-col overflow-hidden ${entered ? 'is-open' : 'is-tucking'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="status-shell-head flex-shrink-0">
          <div className="status-shell-head-main min-w-0">
            <div className="status-shell-mark" aria-hidden="true">
              <i className="fa-solid fa-clipboard-check" />
            </div>
            <div className="min-w-0">
              <h2 id="status-phase-title" className="status-shell-title">
                Фаза статуса
                <span className="status-shell-round">Раунд {roundNumber}</span>
              </h2>
              <p className="status-shell-sub">{subtitle}</p>
            </div>
          </div>
          <div className="status-shell-actions">
            <button
              type="button"
              onClick={onMinimize}
              className="status-icon-btn"
              aria-label="Свернуть"
              title="Свернуть"
            >
              <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="status-icon-btn"
              aria-label="Закрыть"
              title="Закрыть"
            >
              <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="status-shell-body min-h-0 flex-1 overflow-y-auto modal-scroll">
          <ol className="status-step-list">
            {STATUS_STEPS.map((step) => {
              const isActive = step.key === activeStepKey;
              if (step.key === 'scoreObjectives') {
                return (
                  <ScoringStep
                    key={step.key}
                    label={step.label}
                    icon={step.icon}
                    checked={!!checks.scoreObjectives}
                    active={isActive}
                    scoringActive={scoringActive}
                    responses={responses}
                    players={players}
                    readOnly={readOnly}
                    onStartScoring={onStartScoring}
                    scoring={scoring}
                  />
                );
              }
              return (
                <StatusStepRow
                  key={step.key}
                  label={step.label}
                  icon={step.icon}
                  checked={!!checks[step.key]}
                  active={isActive}
                  disabled={readOnly}
                  onToggle={readOnly ? undefined : () => onCheck(step.key)}
                />
              );
            })}
          </ol>
        </div>

        <footer className="status-shell-foot flex-shrink-0">
          <button type="button" onClick={onClose} className="status-btn status-btn--ghost">
            {readOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!allDone || scoringActive}
              className="status-btn status-btn--primary"
            >
              Продолжить
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function StatusStepRow({
  label,
  icon,
  checked,
  disabled = false,
  onToggle,
  active = false,
  children,
}) {
  const interactive = typeof onToggle === 'function' && !disabled;
  return (
    <li
      className={[
        'status-step',
        checked ? 'is-checked' : '',
        active ? 'is-active' : '',
        interactive ? 'is-interactive' : '',
        disabled ? 'is-readonly' : '',
      ].filter(Boolean).join(' ')}
    >
      <div
        className="status-step-main"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={interactive ? onToggle : undefined}
        onKeyDown={interactive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        } : undefined}
      >
        <span className={`status-step-check ${checked ? 'is-on' : ''}`} aria-hidden="true">
          {checked && <i className="fa-solid fa-check" />}
        </span>
        <span className={`status-step-label ${checked ? 'is-done' : ''}`}>{label}</span>
        <span className="status-step-icon" aria-hidden="true">
          <i className={`fa-solid ${icon}`} />
        </span>
      </div>
      {children}
    </li>
  );
}

function ScoringStep({
  label,
  icon,
  checked,
  active = false,
  scoringActive,
  responses,
  players,
  readOnly,
  onStartScoring,
  scoring,
}) {
  const orderIds = scoring?.orderIds?.length
    ? scoring.orderIds
    : players.filter((p) => !p.eliminated).map((p) => p.id);
  const currentId = scoring?.orderIds?.[scoring?.currentIdx];
  const pending = Object.values(responses).filter((r) => r.status === 'pending').length;
  const total = Object.keys(responses).length;
  const showCta = active && !checked && !scoringActive && !readOnly;

  return (
    <StatusStepRow
      label={label}
      icon={icon}
      checked={checked}
      active={active}
      disabled
    >
      {showCta && (
        <button
          type="button"
          onClick={onStartScoring}
          className="status-scoring-cta"
        >
          <i className="fa-solid fa-crosshairs" aria-hidden="true" />
          <span>Начать достижение целей</span>
        </button>
      )}

      {active && !checked && !scoringActive && readOnly && (
        <p className="status-scoring-hint">Ожидание: хост запускает скоринг целей.</p>
      )}

      {scoringActive && (
        <div className="status-scoring-panel">
          <p className="status-scoring-progress">
            По инициативе · ждут {pending}/{total || players.length}
          </p>
          <ul className="status-scoring-list">
            {orderIds.map((id, idx) => {
              const p = players.find((pl) => pl.id === id);
              if (!p || p.eliminated) return null;
              const r = responses[p.id];
              const isCurrent = p.id === currentId;
              const status = r?.status || 'pending';
              const labelText = status === 'done'
                ? 'готово'
                : status === 'passed'
                  ? 'пас'
                  : isCurrent
                    ? 'скорит…'
                    : 'ждёт';
              return (
                <li
                  key={p.id}
                  className={`status-scoring-row ${isCurrent ? 'is-current' : ''} ${status === 'done' ? 'is-done' : ''} ${status === 'passed' ? 'is-passed' : ''}`}
                >
                  <span className="status-scoring-idx">{idx + 1}.</span>
                  <span
                    className="status-scoring-dot"
                    style={{ backgroundColor: p.color || '#64748b' }}
                  />
                  <span className="status-scoring-name truncate">{p.name}</span>
                  <span className="status-scoring-status">{labelText}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </StatusStepRow>
  );
}
