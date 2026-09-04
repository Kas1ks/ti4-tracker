import { ChecklistItem } from './ChecklistItem';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
  scoring,
  players = [],
  onCheck,
  onStartScoring,
  onConfirm,
  onClose,
  onMinimize,
  readOnly = false,
}) {
  useEscapeKey(onClose, show && !minimized);
  // Players need to scroll the console under a minimized/read-only status view.
  useBodyScrollLock(show && !minimized && !readOnly);
  if (!show) return null;
  const allDone = Object.values(checks).every(Boolean);
  const scoringActive = !!scoring?.active;
  const responses = scoring?.responses || {};

  return (
    <div className={`fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 modal-overlay ${minimized ? 'hidden' : ''}`} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-phase-title"
        className="bg-slate-900 border border-cyan-500/40 p-6 rounded-3xl max-w-2xl w-full space-y-6 shadow-[0_0_40px_rgba(6,182,212,0.25)] max-h-[90vh] overflow-y-auto modal-scroll"
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
            {readOnly
              ? 'Только просмотр — шаги отмечает админ.'
              : 'Сначала запустите достижение целей, затем отметьте остальные шаги.'}
          </p>

          {STATUS_STEPS.map(([key, text]) => {
            if (key === 'scoreObjectives') {
              return (
                <ScoringStep
                  key={key}
                  text={text}
                  checked={!!checks.scoreObjectives}
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
              <ChecklistItem
                key={key}
                checked={!!checks[key]}
                onCheck={readOnly ? undefined : () => onCheck(key)}
                text={text}
                disabled={readOnly}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-2xl text-xs md:text-sm transition">
            {readOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!readOnly && (
          <button
            onClick={onConfirm}
            disabled={!allDone || scoringActive}
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

function ScoringStep({ text, checked, scoringActive, responses, players, readOnly, onStartScoring, scoring }) {
  const orderIds = scoring?.orderIds?.length
    ? scoring.orderIds
    : players.filter(p => !p.eliminated).map(p => p.id);
  const currentId = scoring?.orderIds?.[scoring?.currentIdx];
  const pending = Object.values(responses).filter(r => r.status === 'pending').length;
  const total = Object.keys(responses).length;

  return (
    <div
      className={`p-3 bg-slate-950 border rounded-lg space-y-3 ${
        checked
          ? 'border-emerald-500/50 bg-emerald-950/20'
          : scoringActive
            ? 'border-amber-500/40 bg-amber-950/10'
            : 'border-slate-800'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
          checked ? 'bg-emerald-500 border-emerald-400' : 'border-slate-600'
        }`}>
          {checked && <i className="fa-solid fa-check text-black font-bold" />}
        </div>
        <span className={`font-semibold flex-1 ${checked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
          {text}
        </span>
      </div>

      {!checked && !scoringActive && !readOnly && (
        <button
          type="button"
          onClick={onStartScoring}
          className="w-full py-2.5 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-black font-orbitron font-black text-xs uppercase tracking-wide transition"
        >
          Начать достижение целей
        </button>
      )}

      {!checked && !scoringActive && readOnly && (
        <p className="text-xs text-slate-500 pl-10">Ожидание: хост запускает скоринг целей.</p>
      )}

      {scoringActive && (
        <div className="space-y-2 pl-0 sm:pl-10">
          <p className="text-xs text-amber-300/90 font-bold">
            По инициативе · ждут {pending}/{total || players.length}
          </p>
          <ul className="space-y-1.5">
            {orderIds.map((id, idx) => {
              const p = players.find(pl => pl.id === id);
              if (!p || p.eliminated) return null;
              const r = responses[p.id];
              const isCurrent = p.id === currentId;
              const status = r?.status || 'pending';
              const label = status === 'done'
                ? 'готово'
                : status === 'passed'
                  ? 'пас'
                  : isCurrent
                    ? 'скорит…'
                    : 'ждёт';
              const color = status === 'done'
                ? 'text-emerald-400'
                : status === 'passed'
                  ? 'text-slate-500'
                  : isCurrent
                    ? 'text-amber-400'
                    : 'text-slate-600';
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between text-xs gap-2 rounded-lg px-2 py-1.5 ${
                    isCurrent ? 'bg-amber-500/10 border border-amber-500/30' : ''
                  }`}
                >
                  <span className="font-bold text-slate-200 truncate flex items-center gap-2">
                    <span className="text-slate-600 w-4">{idx + 1}.</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#64748b' }}
                    />
                    {p.name}
                  </span>
                  <span className={`font-bold uppercase tracking-wide ${color}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
