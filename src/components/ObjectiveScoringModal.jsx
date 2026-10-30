import { useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { getObjectiveIcon, SECRET_OBJECTIVE_ICON } from '../data/objectiveIcons';
import { secretObjectiveById } from '../data/secretObjectives';

/** Keep secret row order stable while a card is scored (removed from hand). */
function mergeSecretDisplayOrder(prevOrder, hand, selectedSecretId) {
  const known = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    known.push(id);
  };
  (prevOrder || []).forEach(push);
  (hand || []).forEach(push);
  push(selectedSecretId);
  return known.filter((id) => (hand || []).includes(id) || id === selectedSecretId);
}

/**
 * Objective scoring modal — layout matches the scoring mock:
 * cosmos cover shell, queue left (gold active), goals right, asset-faced actions.
 */
export function ObjectiveScoringModal({
  show,
  minimized,
  players = [],
  objectives = [],
  completions = {},
  scoring,
  seatPlayerId = null,
  canScoreAny = false,
  uiConfirm,
  onSelectPublic,
  onToggleSecret,
  onConfirm,
  onPass,
  onMinimize,
  onClose,
}) {
  const [entered, setEntered] = useState(false);
  /** Host-only: player ids whose secret hands were explicitly revealed this window. */
  const [revealedSecretPlayerIds, setRevealedSecretPlayerIds] = useState(() => new Set());
  const wantOpen = show && !minimized;

  useEscapeKey(onMinimize || onClose, wantOpen);
  useBodyScrollLock(wantOpen);

  useEffect(() => {
    if (wantOpen) {
      setEntered(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    return undefined;
  }, [wantOpen]);

  useEffect(() => {
    if (!show) setRevealedSecretPlayerIds(new Set());
  }, [show]);

  if (!show) return null;

  const orderIds = scoring?.orderIds?.length
    ? scoring.orderIds
    : players.filter((p) => !p.eliminated).map((p) => p.id);
  const currentId = scoring?.orderIds?.[scoring?.currentIdx] ?? orderIds[0] ?? null;
  const currentPlayer = players.find((p) => p.id === currentId) || null;
  const currentResponse = currentId != null ? scoring?.responses?.[currentId] : null;

  const isMySeat = seatPlayerId != null && seatPlayerId === currentId;
  const canActOnCurrent = !!currentPlayer
    && currentResponse?.status === 'pending'
    && (canScoreAny || isMySeat);

  const viewingSelf = seatPlayerId != null && !canScoreAny;
  const myResponse = viewingSelf ? scoring?.responses?.[seatPlayerId] : null;
  const waitingMyTurn = viewingSelf
    && myResponse?.status === 'pending'
    && seatPlayerId !== currentId;
  const iAmDone = viewingSelf && (myResponse?.status === 'done' || myResponse?.status === 'passed');

  const stages = [
    { stage: 1, title: 'Этап I · 1 ПО' },
    { stage: 2, title: 'Этап II · 2 ПО' },
  ];

  const focusPlayerId = canActOnCurrent && canScoreAny && !isMySeat
    ? currentId
    : (seatPlayerId ?? currentId);
  const focusPlayer = players.find((p) => p.id === focusPlayerId) || null;
  const focusResponse = focusPlayerId != null ? scoring?.responses?.[focusPlayerId] : null;

  const targetPlayer = canActOnCurrent ? currentPlayer : null;
  const targetResponse = canActOnCurrent ? currentResponse : null;
  const displayPlayer = canActOnCurrent ? targetPlayer : focusPlayer;
  const displayResponse = canActOnCurrent ? targetResponse : focusResponse;

  const answered = Object.values(scoring?.responses || {}).filter(
    (r) => r.status === 'done' || r.status === 'passed',
  ).length;

  const subline = waitingMyTurn
    ? 'Сейчас скорит другой игрок — ваши цели ниже'
    : iAmDone
      ? (myResponse?.status === 'done' ? 'Вы подтвердили достижение' : 'Вы спасовали')
      : canActOnCurrent && isMySeat
        ? '1 общая · 1 секретная · затем подтвердите'
        : canActOnCurrent && canScoreAny
          ? `Отметка за: ${currentPlayer?.name || '…'}`
          : 'По инициативе · 1 общая + 1 секретная';

  const ownsDisplayedSecrets = !!(
    displayPlayer
    && seatPlayerId != null
    && String(seatPlayerId) === String(displayPlayer.id)
  );
  const secretsVisible = ownsDisplayedSecrets
    || (!!displayPlayer && revealedSecretPlayerIds.has(displayPlayer.id));

  const revealSecretsForDisplay = async () => {
    if (!displayPlayer || secretsVisible) return;
    const ok = typeof uiConfirm === 'function'
      ? await uiConfirm(
        `Показать секретные цели игрока ${displayPlayer.name}? Их увидит только хост на этом экране.`,
        {
          title: 'Показать секретки',
          confirmLabel: 'Показать',
          cancelLabel: 'Отмена',
          variant: 'danger',
        },
      )
      : window.confirm(`Показать секретные цели игрока ${displayPlayer.name}?`);
    if (!ok) return;
    setRevealedSecretPlayerIds((prev) => {
      const next = new Set(prev);
      next.add(displayPlayer.id);
      return next;
    });
  };

  const bodyProps = {
    canActOnCurrent,
    displayPlayer,
    displayResponse,
    stages,
    objectives,
    completions,
    onToggleSecret,
    onSelectPublic,
    secretsVisible,
    canRevealSecrets: !!canScoreAny && !ownsDisplayedSecrets,
    onRevealSecrets: revealSecretsForDisplay,
  };

  const queueProps = {
    orderIds,
    players,
    scoring,
    currentId,
    seatPlayerId,
    answered,
  };

  return (
    <div
      className={`osc-overlay fixed inset-0 z-[55] game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${minimized ? 'hidden' : ''} ${entered ? 'is-open' : ''}`}
      role="presentation"
      style={entered ? undefined : { pointerEvents: 'none' }}
    >
      {/* —— Mobile —— */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-scoring-title-mobile"
        className={`osc-shell osc-shell--mobile md:hidden flex flex-col w-full h-full max-h-[100dvh] ${entered ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="osc-head flex-shrink-0">
          <div className="osc-head-main min-w-0">
            <div className="osc-mark" aria-hidden="true">
              <i className="fa-solid fa-bullseye" />
            </div>
            <div className="min-w-0">
              <h2 id="objective-scoring-title-mobile" className="osc-title">
                Достижение целей
              </h2>
              <p className="osc-sub">{subline}</p>
            </div>
          </div>
          {onMinimize && (
            <button type="button" onClick={onMinimize} className="osc-icon-btn" aria-label="Свернуть">
              <i className="fa-solid fa-window-minimize" aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="osc-mobile-queue">
          <QueueStrip {...queueProps} />
          <div className="osc-answered">{answered}/{orderIds.length || 0} ответили</div>
        </div>

        <div className="osc-body-scroll flex-1 min-h-0 overflow-y-auto overscroll-y-contain modal-scroll">
          {currentPlayer && (
            <div className="osc-now">
              <div className="osc-now-label">Сейчас скорит</div>
              <div className="osc-now-name">{currentPlayer.name}</div>
            </div>
          )}
          <ScoringBody {...bodyProps} />
        </div>

        {canActOnCurrent && targetPlayer && (
          <footer className="osc-foot flex-shrink-0">
            <ActionButtons
              onConfirm={() => onConfirm(targetPlayer.id)}
              onPass={() => onPass(targetPlayer.id)}
            />
          </footer>
        )}
      </div>

      {/* —— Desktop —— */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-scoring-title"
        className={`osc-shell osc-shell--desktop hidden md:flex w-full flex-col overflow-hidden ${entered ? 'is-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="osc-head flex-shrink-0">
          <div className="osc-head-main min-w-0">
            <div className="osc-mark" aria-hidden="true">
              <i className="fa-solid fa-bullseye" />
            </div>
            <div className="min-w-0">
              <h2 id="objective-scoring-title" className="osc-title">
                Достижение целей
              </h2>
              <p className="osc-sub">По инициативе · 1 общая + 1 секретная</p>
            </div>
          </div>
          <div className="osc-head-actions">
            {onMinimize && (
              <button type="button" onClick={onMinimize} className="osc-icon-btn" aria-label="Свернуть">
                <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} className="osc-icon-btn" aria-label="Закрыть">
                <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <div className="osc-desktop-body flex-1 min-h-0 flex flex-row">
          <aside className="osc-queue flex-shrink-0 flex flex-col">
            <div className="osc-queue-label">Очередь</div>
            <ul className="osc-queue-list flex-1 overflow-y-auto modal-scroll">
              {orderIds.map((id, idx) => {
                const p = players.find((pl) => pl.id === id);
                if (!p) return null;
                const r = scoring?.responses?.[id];
                const isCurrent = id === currentId;
                const status = r?.status || 'pending';
                const label = status === 'done'
                  ? 'готово'
                  : status === 'passed'
                    ? 'пас'
                    : isCurrent
                      ? 'скорит'
                      : 'ждёт';
                return (
                  <li
                    key={id}
                    className={[
                      'osc-queue-row',
                      isCurrent ? 'is-active' : '',
                      status === 'done' ? 'is-done' : '',
                      status === 'passed' ? 'is-passed' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="osc-queue-idx">{idx + 1}</span>
                    <span
                      className="osc-queue-dot"
                      style={{ backgroundColor: p.color || '#64748b' }}
                    />
                    <span className="osc-queue-name truncate">{p.name}</span>
                    <span className="osc-queue-status">{label}</span>
                  </li>
                );
              })}
            </ul>
            <div className="osc-answered">{answered}/{orderIds.length || 0} ответили</div>
          </aside>

          <div className="osc-main flex-1 min-h-0 flex flex-col min-w-0">
            <div className="osc-now flex-shrink-0">
              {currentPlayer ? (
                <>
                  <div className="osc-now-label">Сейчас скорит</div>
                  <div className="osc-now-name">{currentPlayer.name}</div>
                  <p className="osc-now-sub">{subline}</p>
                </>
              ) : (
                <div className="osc-now-sub">Очередь пуста</div>
              )}
            </div>

            <div className="osc-body-scroll flex-1 min-h-0 overflow-y-auto modal-scroll">
              <ScoringBody {...bodyProps} />
            </div>

            {canActOnCurrent && targetPlayer && (
              <footer className="osc-foot flex-shrink-0">
                <ActionButtons
                  onConfirm={() => onConfirm(targetPlayer.id)}
                  onPass={() => onPass(targetPlayer.id)}
                />
              </footer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButtons({ onConfirm, onPass }) {
  return (
    <div className="osc-actions">
      <button type="button" onClick={onConfirm} className="osc-btn osc-btn--confirm">
        <i className="fa-solid fa-check" aria-hidden="true" />
        Подтвердить
      </button>
      <button type="button" onClick={onPass} className="osc-btn osc-btn--pass">
        Пас
      </button>
    </div>
  );
}

function QueueStrip({ orderIds, players, scoring, currentId, seatPlayerId }) {
  const count = orderIds.length;
  return (
    <div className="osc-queue-strip" data-count={count}>
      {orderIds.map((id, idx) => {
        const p = players.find((pl) => pl.id === id);
        if (!p) return null;
        const r = scoring?.responses?.[id];
        const isCurrent = id === currentId;
        const done = r?.status === 'done' || r?.status === 'passed';
        const isYou = seatPlayerId != null && id === seatPlayerId;
        return (
          <span
            key={id}
            className={[
              'osc-queue-chip',
              isCurrent ? 'is-active' : '',
              done ? 'is-done' : '',
            ].filter(Boolean).join(' ')}
          >
            <span
              className="osc-queue-dot"
              style={{ backgroundColor: p.color || '#64748b' }}
            />
            <span className="osc-queue-chip-label">
              {idx + 1}. {isYou ? 'Вы' : p.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function GoalIconBadge({ icon, tone, active = false }) {
  return (
    <span
      className={`osc-goal-icon tone-${tone}${active ? ' is-lit' : ''}`}
      aria-hidden="true"
    >
      <i className={`fa-solid ${icon}`} />
    </span>
  );
}

function ScoringBody({
  canActOnCurrent,
  displayPlayer,
  displayResponse,
  stages,
  objectives,
  completions,
  onToggleSecret,
  onSelectPublic,
  secretsVisible = true,
  canRevealSecrets = false,
  onRevealSecrets,
}) {
  const secretOrderRef = useRef([]);
  const secretOrderPlayerRef = useRef(null);

  const hand = Array.isArray(displayPlayer?.secretHand) ? displayPlayer.secretHand : [];
  const selectedSecretId = displayResponse?.secret ? displayResponse?.secretId : null;

  if (displayPlayer?.id !== secretOrderPlayerRef.current) {
    secretOrderPlayerRef.current = displayPlayer?.id ?? null;
    secretOrderRef.current = [];
  }
  if (canActOnCurrent && displayPlayer) {
    secretOrderRef.current = mergeSecretDisplayOrder(
      secretOrderRef.current,
      hand,
      selectedSecretId,
    );
  }

  const secretDisplayIds = canActOnCurrent && displayPlayer
    ? secretOrderRef.current
    : [];

  return (
    <div className="osc-goals">
      {canActOnCurrent && displayPlayer && (() => {
        const cap = Number(displayPlayer.secretCap) === 4 ? 4 : 3;
        const scored = displayPlayer.secrets ?? 0;
        const selectedOffHand = !!(
          selectedSecretId && !hand.includes(selectedSecretId)
        );
        const hasSecretsUi = secretDisplayIds.length > 0 || selectedOffHand;

        if (!secretsVisible && hasSecretsUi) {
          return (
            <div className="space-y-2">
              <div className="osc-goal is-secret is-hidden-secret" aria-label="Секретные цели скрыты">
                <span className="osc-goal-check" aria-hidden="true">
                  <i className="fa-solid fa-eye-slash" />
                </span>
                <span className="osc-goal-text">
                  <span className="osc-goal-title">Секретки скрыты</span>
                  <span className="osc-goal-meta">
                    В руке: {hand.length}
                    {selectedOffHand ? ' · секрет уже отмечен игроком' : ''}
                    {' · сыграно '}{scored}/{cap}
                  </span>
                </span>
                <span className="osc-secret-emblem" aria-hidden="true">
                  <span className="osc-secret-ring" />
                  <span className="osc-secret-ring is-outer" />
                  <span className="osc-secret-card">
                    <i className={`fa-solid ${SECRET_OBJECTIVE_ICON.icon}`} />
                  </span>
                </span>
              </div>
              {canRevealSecrets && (
                <button
                  type="button"
                  className="osc-btn osc-btn--reveal-secrets"
                  onClick={() => onRevealSecrets?.()}
                >
                  <i className="fa-solid fa-eye" aria-hidden="true" />
                  Показать секретки
                </button>
              )}
            </div>
          );
        }

        if (secretDisplayIds.length > 0) {
          return (
            <div className="space-y-2">
              <div className="osc-goal-meta px-1 flex items-center justify-between gap-2">
                <span>Секретки в руке · сыграно {scored}/{cap}</span>
                {canRevealSecrets && secretsVisible && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-300/90 font-bold">
                    Показаны хосту
                  </span>
                )}
              </div>
              {secretDisplayIds.map((cardId) => {
                const card = secretObjectiveById.get(cardId);
                const selected = !!(displayResponse?.secret && displayResponse?.secretId === cardId);
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => onToggleSecret(displayPlayer.id, cardId)}
                    className={`osc-goal is-secret${selected ? ' is-checked' : ''}`}
                  >
                    <span className={`osc-goal-check ${selected ? 'is-on' : ''}`} aria-hidden="true">
                      {selected && <i className="fa-solid fa-check" />}
                    </span>
                    <span className="osc-goal-text">
                      <span className="osc-goal-title">{card?.title || cardId}</span>
                      <span className="osc-goal-meta">
                        {selected
                          ? 'Выбрано · нажмите, чтобы отменить'
                          : (card?.desc || 'Секретная цель (+1 ПО)')}
                      </span>
                    </span>
                    <span className="osc-secret-emblem" aria-hidden="true">
                      <span className="osc-secret-ring" />
                      <span className="osc-secret-ring is-outer" />
                      <span className="osc-secret-card">
                        <i className={`fa-solid ${SECRET_OBJECTIVE_ICON.icon}`} />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <button
            type="button"
            onClick={() => onToggleSecret(displayPlayer.id)}
            className={`osc-goal is-secret${displayResponse?.secret ? ' is-checked' : ''}`}
          >
            <span className={`osc-goal-check ${displayResponse?.secret ? 'is-on' : ''}`} aria-hidden="true">
              {displayResponse?.secret && <i className="fa-solid fa-check" />}
            </span>
            <span className="osc-goal-text">
              <span className="osc-goal-title">Секретная цель (+1 ПО)</span>
              <span className="osc-goal-meta">
                Сейчас секретов: {scored}/{cap}
                {scored >= cap && !displayResponse?.secret ? ' · лимит' : ''}
              </span>
            </span>
            <span className="osc-secret-emblem" aria-hidden="true">
              <span className="osc-secret-ring" />
              <span className="osc-secret-ring is-outer" />
              <span className="osc-secret-card">
                <i className={`fa-solid ${SECRET_OBJECTIVE_ICON.icon}`} />
              </span>
            </span>
          </button>
        );
      })()}

      {stages.map(({ stage, title }) => {
        // Keep full stage order — do not hide already-scored rows (selection must not reshuffle).
        const list = objectives.filter((o) => Number(o.stage) === stage);
        if (!list.length) return null;
        return (
          <section key={stage} className="osc-goal-stage">
            <h3 className="osc-goal-stage-title">{title}</h3>
            {list.map((obj) => {
              const mine = displayPlayer
                ? !!completions[`${displayPlayer.id}_${obj.id}`]
                : false;
              const scoredThisWindow = displayResponse?.publicId === obj.id;
              const lockedOwned = mine && !scoredThisWindow;
              const selected = mine || scoredThisWindow;
              const interactive = !!(canActOnCurrent && displayPlayer && !lockedOwned);
              const { icon, tone } = getObjectiveIcon(obj);

              return (
                <button
                  key={obj.id}
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && onSelectPublic(displayPlayer.id, obj.id)}
                  className={`osc-goal ${selected ? 'is-selected' : ''} ${interactive ? 'is-interactive' : ''}${lockedOwned ? ' is-locked' : ''}`}
                >
                  <span className={`osc-goal-check ${selected ? 'is-on' : ''}`} aria-hidden="true">
                    {selected && <i className="fa-solid fa-check" />}
                  </span>
                  <span className="osc-goal-text">
                    <span className="osc-goal-title">{obj.desc}</span>
                    {lockedOwned && (
                      <span className="osc-goal-meta">Уже засчитано ранее</span>
                    )}
                  </span>
                  <GoalIconBadge icon={icon} tone={tone} active={selected} />
                </button>
              );
            })}
          </section>
        );
      })}

      {!objectives.length && (
        <div className="osc-goals-empty">
          Публичные цели ещё не раскрыты — можно засчитать секрет или спасовать
        </div>
      )}
    </div>
  );
}
