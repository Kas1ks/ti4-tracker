import {
  canConfirmStartingTech,
  isStartingTechWaveAReady,
  startingTechChoice,
  startingTechOptions,
} from '../data/technologies';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { StartingTechChoice } from './StartingTechChoice';

/** Seated player pick / research window during starting-tech draft. */
export function StartingTechPlayerModal({
  show,
  player,
  game,
  onSetPicks,
  onConfirm,
  onMinimize,
}) {
  useEscapeKey(onMinimize, show);
  useBodyScrollLock(show);
  if (!show || !player) return null;

  const choice = startingTechChoice(player.factionId);
  const draft = game?.startingTechDraft;
  const response = draft?.responses?.[player.id] || { status: 'waiting', picks: [] };
  if (response.status === 'confirmed') return null;

  const waveAReady = isStartingTechWaveAReady(game);
  const lockedWave = choice?.wave === 'C' && !waveAReady;
  const picks = response.picks || [];
  const options = lockedWave
    ? []
    : choice?.kind === 'research'
      ? [...new Set([
        ...picks,
        ...startingTechOptions(player.factionId, game, {
          playerId: player.id,
          sessionPicks: picks,
        }),
      ])]
      : startingTechOptions(player.factionId, game, { playerId: player.id });
  const canConfirm = canConfirmStartingTech(player, game);
  const title = choice?.kind === 'research'
    ? 'Исследуйте стартовые технологии'
    : 'Выберите стартовые технологии';

  return (
    <div
      className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
    >
      <div
        className="relative w-full max-w-lg max-md:h-full md:max-h-[92vh] bg-slate-950 border border-cyan-700/60 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="starting-tech-player-title"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div className="min-w-0">
            <h2 id="starting-tech-player-title" className="font-orbitron font-black text-base text-cyan-300 uppercase tracking-wide truncate">
              {title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{player.name}</p>
          </div>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-slate-300"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {lockedWave ? (
            <p className="text-sm text-slate-400">
              Keleres выбирает после того, как остальные подтвердят стартовые технологии.
            </p>
          ) : (
            <StartingTechChoice
              options={options}
              selected={picks}
              pickCount={choice?.pick || 1}
              hint={
                choice?.kind === 'research'
                  ? `Исследуйте ${choice.pick} (вторая может опираться на первую)`
                  : choice?.kind === 'fromOthers'
                    ? `2 технологии, которые уже есть у других`
                    : choice?.options
                      ? `Выберите ${choice.pick} из ${choice.options.length}`
                      : `Выберите ${choice?.pick || 1}`
              }
              onChange={(next) => onSetPicks?.(player.id, next)}
            />
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm?.(player.id)}
            className="w-full min-h-[48px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-extrabold text-sm border border-cyan-300 disabled:border-slate-700"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
