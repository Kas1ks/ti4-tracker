import { useEffect, useState } from 'react';
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
  const [entered, setEntered] = useState(false);

  useEscapeKey(onMinimize, show);
  useBodyScrollLock(show);

  useEffect(() => {
    if (!show) {
      setEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [show]);

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
  const eyebrow = choice?.kind === 'research'
    ? 'Стартовые технологии · Исследование'
    : 'Стартовые технологии · Выбор';
  const hint = lockedWave
    ? 'Keleres выбирает после того, как остальные подтвердят стартовые технологии.'
    : choice?.kind === 'research'
      ? `Исследуйте ${choice.pick} (вторая может опираться на первую)`
      : choice?.kind === 'fromOthers'
        ? `2 технологии, которые уже есть у других`
        : choice?.options
          ? `Выберите ${choice.pick} из ${choice.options.length}`
          : `Выберите ${choice?.pick || 1}`;

  return (
    <div
      className={`fixed inset-0 z-[58] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-4 modal-overlay tech-overlay ${show ? 'is-open' : ''}`}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="starting-tech-player-title"
        className={`tech-shell flex flex-col w-full max-h-[min(92dvh,900px)] md:max-h-[90vh] md:max-w-2xl overflow-hidden ${entered || show ? 'is-open' : ''}`}
      >
        <header className="tech-shell-head flex-shrink-0">
          <div className="tech-shell-head-main min-w-0">
            <div className="tech-shell-eyebrow">{eyebrow}</div>
            <h2 id="starting-tech-player-title" className="tech-shell-title truncate">
              {player.name}
            </h2>
            <p className="tech-shell-sub">{hint}</p>
          </div>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="tech-icon-btn"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="tech-shell-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain modal-scroll">
          {lockedWave ? (
            <p className="tech-empty">{hint}</p>
          ) : (
            <StartingTechChoice
              options={options}
              selected={picks}
              pickCount={choice?.pick || 1}
              hint={null}
              onChange={(next) => onSetPicks?.(player.id, next)}
            />
          )}
        </div>

        <footer className="tech-shell-foot flex-shrink-0">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm?.(player.id)}
            className="tech-foot-btn tech-foot-btn-primary"
          >
            Подтвердить
          </button>
        </footer>
      </div>
    </div>
  );
}
