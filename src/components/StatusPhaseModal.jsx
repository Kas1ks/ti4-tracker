import { ChecklistItem } from './ChecklistItem';
import { useEscapeKey } from '../hooks/useEscapeKey';

const STATUS_STEPS = [
  ['scoreObjectives', '1. Достижение целей'],
  ['revealObjective', '2. Раскрытие новой цели'],
  ['drawActionCards', '3. Добор карт действий'],
  ['gainCommandTokens', '4. Возвращение и получение жетонов приказов'],
  ['refreshAndRepair', '5. Возобновление карт и ремонт отрядов'],
  ['returnStrategyCards', '6. Возврат карт стратегий'],
];

export function StatusPhaseModal({
  show,
  minimized,
  roundNumber,
  checks,
  onCheck,
  onConfirm,
  onClose,
  onMinimize,
  readOnly = false,
}) {
  useEscapeKey(onClose, show && !minimized);
  if (!show) return null;
  const allDone = Object.values(checks).every(Boolean);

  return (
    <div className={`fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 ${minimized ? 'hidden' : ''}`} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-phase-title"
        className="bg-slate-900 border border-cyan-500/40 p-6 rounded-3xl max-w-2xl w-full space-y-6 shadow-[0_0_40px_rgba(6,182,212,0.25)]"
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 id="status-phase-title" className="font-orbitron font-bold text-lg text-cyan-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
            <span>Фаза статуса (Раунд {roundNumber})</span>
          </h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onMinimize} className="text-slate-500 hover:text-white transition" aria-label="Свернуть">
              <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
            </button>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition" aria-label="Закрыть">
              <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="space-y-3 text-left">
          <p className="text-sm text-slate-400 text-center -mt-4 mb-4">
            {readOnly ? 'Только просмотр — шаги отмечает админ.' : 'Выполните все шаги в указанном порядке.'}
          </p>
          {STATUS_STEPS.map(([key, text]) => (
            <ChecklistItem
              key={key}
              checked={!!checks[key]}
              onCheck={readOnly ? undefined : () => onCheck(key)}
              text={text}
              disabled={readOnly}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-2xl text-xs md:text-sm transition">
            {readOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!readOnly && (
          <button
            onClick={onConfirm}
            disabled={!allDone}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-orbitron font-black py-3.5 rounded-2xl text-xs md:text-sm shadow-lg transition transform active:scale-95 uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Продолжить
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
