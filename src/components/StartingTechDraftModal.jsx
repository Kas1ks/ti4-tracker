import { useEffect, useState } from 'react';
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

function statusMeta(status, choice, waveAReady, picks = []) {
  if (status === 'confirmed') {
    return { label: 'Выбрал', tone: 'done' };
  }
  if (choice?.wave === 'C' && !waveAReady) {
    return { label: 'Ждёт', tone: 'wait' };
  }
  if (status === 'picking' || (picks && picks.length > 0)) {
    return {
      label: choice?.kind === 'research' ? 'Исследует' : 'Выбирает',
      tone: 'active',
    };
  }
  return { label: 'Не выбрал', tone: 'pending' };
}

function pickHint(choice, optionCount) {
  if (!choice) return null;
  if (choice.kind === 'research') return `Исследуйте ${choice.pick} технологий`;
  if (choice.kind === 'fromOthers') return `Выберите ${choice.pick} из технологий других`;
  if (choice.options) return `Выберите ${choice.pick} из ${optionCount}`;
  return `Выберите ${choice.pick}`;
}

/** Host status panel for starting-tech draft; open pick-for-seat as a second step. */
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
  const [entered, setEntered] = useState(false);
  const [hostPickPlayerId, setHostPickPlayerId] = useState(null);

  const wantOpen = show && !minimized;
  useEscapeKey(
    () => {
      if (hostPickPlayerId != null) setHostPickPlayerId(null);
      else (onMinimize || onClose)?.();
    },
    wantOpen,
  );
  useBodyScrollLock(wantOpen);

  useEffect(() => {
    if (!wantOpen) {
      setEntered(false);
      setHostPickPlayerId(null);
      return undefined;
    }
    // Double rAF so opacity/transform transitions reliably after un-minimize.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [wantOpen]);

  useEffect(() => {
    if (!show) setHostPickPlayerId(null);
  }, [show]);

  if (!show) return null;

  const draft = game?.startingTechDraft;
  const responseOf = (playerId) => (
    draft?.responses?.[playerId]
    ?? draft?.responses?.[String(playerId)]
    ?? null
  );
  let seats = players.filter((p) => !p.eliminated && responseOf(p.id) != null);
  // Fallback if response keys drifted (string/number) — still show active draft seats.
  if (seats.length === 0 && draft?.active) {
    seats = players.filter((p) => !p.eliminated && !!startingTechChoice(p.factionId));
  }
  const confirmed = seats.filter((p) => responseOf(p.id)?.status === 'confirmed').length;
  const waveAReady = isStartingTechWaveAReady(game);
  const pickPlayer = hostPickPlayerId != null
    ? seats.find((p) => p.id === hostPickPlayerId || String(p.id) === String(hostPickPlayerId)) || null
    : null;

  const openPick = (playerId) => setHostPickPlayerId(playerId);
  const closePick = () => setHostPickPlayerId(null);

  const handleConfirm = (playerId) => {
    onConfirm?.(playerId);
    setHostPickPlayerId(null);
  };

  return (
    <div
      className={`fixed inset-0 z-[56] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-4 modal-overlay tech-overlay ${minimized ? 'hidden' : ''} ${wantOpen ? 'is-open' : ''}`}
      role="presentation"
      onClick={() => {
        if (hostPickPlayerId != null) closePick();
        else (onMinimize || onClose)?.();
      }}
    >
      <div
        className={`tech-shell flex flex-col w-full max-h-[min(92dvh,920px)] md:max-h-[90vh] md:max-w-3xl overflow-hidden ${entered || wantOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="starting-tech-draft-title"
        onClick={(event) => event.stopPropagation()}
      >
        {pickPlayer ? (
          <HostPickStep
            player={pickPlayer}
            game={game}
            draft={draft}
            waveAReady={waveAReady}
            canAct={canAct}
            onBack={closePick}
            onMinimize={onMinimize || onClose}
            onSetPicks={onSetPicks}
            onConfirm={handleConfirm}
          />
        ) : (
          <HostStatusStep
            seats={seats}
            draft={draft}
            confirmed={confirmed}
            waveAReady={waveAReady}
            canAct={canAct}
            onOpenPick={openPick}
            onMinimize={onMinimize || onClose}
          />
        )}
      </div>
    </div>
  );
}

function HostStatusStep({
  seats,
  draft,
  confirmed,
  waveAReady,
  canAct,
  onOpenPick,
  onMinimize,
}) {
  return (
    <>
      <header className="tech-shell-head flex-shrink-0">
        <div className="tech-shell-head-main min-w-0">
          <div className="tech-shell-eyebrow">Стартовые технологии · Хост</div>
          <h2 id="starting-tech-draft-title" className="tech-shell-title">
            Статус выбора
          </h2>
          <p className="tech-shell-sub">
            Подтвердили {confirmed}/{seats.length}
            {!waveAReady && seats.some((p) => startingTechChoice(p.factionId)?.wave === 'C')
              ? ' · Keleres ждёт волну A'
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onMinimize}
          className="tech-icon-btn"
          title="Свернуть"
          aria-label="Свернуть"
        >
          <i className="fa-solid fa-window-minimize" aria-hidden="true" />
        </button>
      </header>

      <div className="tech-shell-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain modal-scroll">
        <ul className="st-host-seat-list">
          {seats.map((p) => {
            const choice = startingTechChoice(p.factionId);
            const response = (
              draft?.responses?.[p.id]
              ?? draft?.responses?.[String(p.id)]
              ?? { status: 'waiting', picks: [] }
            );
            const done = response.status === 'confirmed';
            const lockedWave = choice?.wave === 'C' && !waveAReady;
            const meta = statusMeta(response.status, choice, waveAReady, response.picks);
            const picks = response.picks || [];

            return (
              <li
                key={p.id}
                className={`st-host-seat ${meta.tone === 'done' ? 'is-done' : ''} ${meta.tone === 'wait' ? 'is-wait' : ''} ${meta.tone === 'active' ? 'is-active' : ''}`}
              >
                <div className="st-host-seat-main">
                  <span
                    className="st-host-seat-dot"
                    style={{ backgroundColor: p.color || '#64748b' }}
                    aria-hidden="true"
                  />
                  <div className="st-host-seat-copy min-w-0">
                    <div className="st-host-seat-name truncate">{p.name}</div>
                    <div className="st-host-seat-kind">
                      {choice?.kind === 'research' ? 'Исследование' : choice?.kind === 'fromOthers' ? 'Из чужих' : 'Выбор'}
                    </div>
                  </div>
                  <span className={`st-host-seat-status is-${meta.tone}`}>
                    {meta.label}
                  </span>
                </div>

                {picks.length > 0 && (
                  <div className="st-host-seat-picks">
                    {picks.map((id) => {
                      const tech = techById(id);
                      return (
                        <span key={id} className="st-host-pick-chip">
                          {tech?.color && <TechTypeIcon color={tech.color} size={14} />}
                          {tech?.name || id}
                        </span>
                      );
                    })}
                  </div>
                )}

                {done ? null : lockedWave ? (
                  <p className="st-host-seat-note">Ждёт подтверждения волны A</p>
                ) : canAct ? (
                  <button
                    type="button"
                    className="st-host-seat-action"
                    onClick={() => onOpenPick(p.id)}
                  >
                    Выбрать за игрока
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

function HostPickStep({
  player,
  game,
  draft,
  waveAReady,
  canAct,
  onBack,
  onMinimize,
  onSetPicks,
  onConfirm,
}) {
  const choice = startingTechChoice(player.factionId);
  const response = (
    draft?.responses?.[player.id]
    ?? draft?.responses?.[String(player.id)]
    ?? { status: 'waiting', picks: [] }
  );
  const lockedWave = choice?.wave === 'C' && !waveAReady;
  const options = lockedWave
    ? []
    : startingTechOptions(player.factionId, game, {
      playerId: player.id,
      sessionPicks: response.picks || [],
    });
  const researchOptions = choice?.kind === 'research' && !lockedWave
    ? [...new Set([
      ...(response.picks || []),
      ...startingTechOptions(player.factionId, game, {
        playerId: player.id,
        sessionPicks: response.picks || [],
      }),
    ])]
    : options;
  const canConfirm = canAct && canConfirmStartingTech(player, game);
  const eyebrow = choice?.kind === 'research'
    ? 'Выбор за игрока · Исследование'
    : 'Выбор за игрока';

  return (
    <>
      <header className="tech-shell-head flex-shrink-0">
        <div className="tech-shell-head-main min-w-0">
          <div className="tech-shell-eyebrow">{eyebrow}</div>
          <h2 id="starting-tech-draft-title" className="tech-shell-title truncate">
            {player.name}
          </h2>
          <p className="tech-shell-sub">
            {lockedWave
              ? 'Keleres ждёт волну A'
              : pickHint(choice, options.length)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="tech-icon-btn"
            aria-label="Назад к статусу"
            title="Назад"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onMinimize}
            className="tech-icon-btn"
            aria-label="Свернуть"
          >
            <i className="fa-solid fa-window-minimize" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="tech-shell-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain modal-scroll">
        {lockedWave ? (
          <p className="tech-empty">Ждёт подтверждения волны A</p>
        ) : (
          <StartingTechChoice
            options={choice?.kind === 'research' ? researchOptions : options}
            selected={response.picks || []}
            pickCount={choice?.pick || 1}
            hint={null}
            onChange={(picks) => onSetPicks?.(player.id, picks)}
          />
        )}
      </div>

      <footer className="tech-shell-foot flex-shrink-0 space-y-2">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm?.(player.id)}
          className="tech-foot-btn tech-foot-btn-primary"
        >
          Подтвердить
        </button>
        <button
          type="button"
          onClick={onBack}
          className="tech-foot-btn st-host-back-btn"
        >
          Назад к статусу
        </button>
      </footer>
    </>
  );
}
