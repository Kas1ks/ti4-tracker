import {
  canConfirmStartingTech,
  isStartingTechWaveAReady,
  startingTechChoice,
  startingTechOptions,
  techById,
} from '../data/technologies';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { StartingTechChoice } from './StartingTechChoice';
import { TechTypeIcon } from './TechTypeIcon';

function statusLabel(status, choice, waveAReady) {
  if (status === 'confirmed') return 'Подтвердил';
  if (choice?.wave === 'C' && !waveAReady) return 'Ожидает';
  if (status === 'picking') {
    return choice?.kind === 'research' ? 'Исследует' : 'Выбирает';
  }
  return choice?.kind === 'research' ? 'Исследует' : 'Ожидает';
}

function pickHint(choice, optionCount) {
  if (!choice) return null;
  if (choice.kind === 'research') return `Исследуйте ${choice.pick} технологий`;
  if (choice.kind === 'fromOthers') return `Выберите ${choice.pick} из технологий других`;
  if (choice.options) return `Выберите ${choice.pick} из ${optionCount}`;
  return `Выберите ${choice.pick}`;
}

/** Host status panel for starting-tech draft; can set picks / confirm for any seat. */
export function StartingTechDraftModal({
  show,
  minimized,
  game,
  players = [],
  canAct = false,
  onSetPicks,
  onConfirm,
  onMinimize,
  onClose,
}) {
  useEscapeKey(onMinimize || onClose, show && !minimized);
  useBodyScrollLock(show && !minimized);
  if (!show) return null;

  const draft = game?.startingTechDraft;
  const seats = players.filter(p => draft?.responses?.[p.id] != null);
  const confirmed = seats.filter(p => draft.responses[p.id]?.status === 'confirmed').length;
  const waveAReady = isStartingTechWaveAReady(game);

  return (
    <div
      className={`fixed inset-0 z-[56] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${minimized ? 'hidden' : ''}`}
      role="presentation"
      onClick={onMinimize || onClose}
    >
      <div
        className="relative w-full max-w-3xl max-md:h-full md:max-h-[92vh] bg-slate-950 border border-cyan-700/60 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="starting-tech-draft-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 md:py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="min-w-0">
            <h2 id="starting-tech-draft-title" className="font-orbitron font-black text-base md:text-xl text-cyan-300 uppercase tracking-wide truncate">
              Стартовые технологии
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Подтвердили {confirmed}/{seats.length}
              {!waveAReady && seats.some(p => startingTechChoice(p.factionId)?.wave === 'C')
                ? ' · Keleres ждёт волну A'
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onMinimize || onClose}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
            title="Свернуть"
            aria-label="Свернуть"
          >
            <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {seats.map((p) => {
            const choice = startingTechChoice(p.factionId);
            const response = draft.responses[p.id] || { status: 'waiting', picks: [] };
            const done = response.status === 'confirmed';
            const lockedWave = choice?.wave === 'C' && !waveAReady;
            const options = lockedWave
              ? []
              : startingTechOptions(p.factionId, game, {
                playerId: p.id,
                sessionPicks: response.picks || [],
              });
            // For research, show catalog options based on current session picks for toggle UX:
            // list all currently researchable + already picked.
            const researchOptions = choice?.kind === 'research' && !lockedWave
              ? [...new Set([
                ...(response.picks || []),
                ...startingTechOptions(p.factionId, game, {
                  playerId: p.id,
                  sessionPicks: response.picks || [],
                }),
              ])]
              : options;
            const canConfirm = canAct && canConfirmStartingTech(p, game);

            return (
              <div
                key={p.id}
                className={`rounded-xl border px-3 md:px-4 py-3 space-y-3 ${
                  done
                    ? 'bg-emerald-950/40 border-emerald-600/70'
                    : lockedWave
                      ? 'bg-slate-900/50 border-slate-800'
                      : 'bg-slate-900/80 border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#64748b' }}
                    />
                    <span className={`font-bold truncate ${done ? 'text-emerald-200' : 'text-slate-200'}`}>
                      {p.name}
                    </span>
                    <span className="text-[10px] uppercase font-orbitron font-bold text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                      {choice?.kind === 'research' ? 'research' : choice?.kind || 'pick'}
                    </span>
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    done ? 'text-emerald-300' : lockedWave ? 'text-slate-500' : 'text-amber-300'
                  }`}>
                    {statusLabel(response.status, choice, waveAReady)}
                  </span>
                </div>

                {done ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(response.picks || []).map((id) => {
                      const tech = techById(id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-100 bg-emerald-900/40 border border-emerald-700/50 rounded-lg px-2 py-1"
                        >
                          {tech?.color && <TechTypeIcon color={tech.color} size={14} />}
                          {tech?.name || id}
                        </span>
                      );
                    })}
                  </div>
                ) : canAct && !lockedWave ? (
                  <>
                    <StartingTechChoice
                      options={choice?.kind === 'research' ? researchOptions : options}
                      selected={response.picks || []}
                      pickCount={choice?.pick || 1}
                      hint={pickHint(choice, options.length)}
                      onChange={(picks) => onSetPicks?.(p.id, picks)}
                    />
                    <button
                      type="button"
                      disabled={!canConfirm}
                      onClick={() => onConfirm?.(p.id)}
                      className="w-full min-h-[44px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-extrabold text-sm border border-cyan-300 disabled:border-slate-700"
                    >
                      Подтвердить
                    </button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(response.picks || []).length === 0 ? (
                      <span className="text-xs text-slate-500">
                        {lockedWave ? 'Ждёт подтверждения волны A' : 'Ещё не выбрал'}
                      </span>
                    ) : (
                      (response.picks || []).map((id) => {
                        const tech = techById(id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1"
                          >
                            {tech?.color && <TechTypeIcon color={tech.color} size={14} />}
                            {tech?.name || id}
                          </span>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
