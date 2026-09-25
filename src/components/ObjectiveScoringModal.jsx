import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

/**
 * Objective scoring modal:
 * - Desktop: two columns (queue | objectives)
 * - Mobile: step layout — chip queue, large goals, sticky actions
 * Objectives are always shown for the viewing seat (or current seat for host acts).
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
  onSelectPublic,
  onToggleSecret,
  onConfirm,
  onPass,
  onMinimize,
  onClose,
}) {
  useEscapeKey(onMinimize || onClose, show && !minimized);
  useBodyScrollLock(show && !minimized);
  if (!show) return null;

  const orderIds = scoring?.orderIds?.length
    ? scoring.orderIds
    : players.filter(p => !p.eliminated).map(p => p.id);
  const currentId = scoring?.orderIds?.[scoring?.currentIdx] ?? orderIds[0] ?? null;
  const currentPlayer = players.find(p => p.id === currentId) || null;
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
    { stage: 1, title: 'Этап I · 1 ПО', color: 'text-blue-400' },
    { stage: 2, title: 'Этап II · 2 ПО', color: 'text-rose-400' },
  ];

  // Players always see / edit their own seat. Host, while helping, sees the current scorer.
  const focusPlayerId = canActOnCurrent && canScoreAny && !isMySeat
    ? currentId
    : (seatPlayerId ?? currentId);
  const focusPlayer = players.find(p => p.id === focusPlayerId) || null;
  const focusResponse = focusPlayerId != null ? scoring?.responses?.[focusPlayerId] : null;

  const targetPlayer = canActOnCurrent ? currentPlayer : null;
  const targetResponse = canActOnCurrent ? currentResponse : null;
  // When acting, selections apply to the acting seat; display focus matches that.
  const displayPlayer = canActOnCurrent ? targetPlayer : focusPlayer;
  const displayResponse = canActOnCurrent ? targetResponse : focusResponse;

  const answered = Object.values(scoring?.responses || {}).filter(
    r => r.status === 'done' || r.status === 'passed',
  ).length;

  const headline = isMySeat && canActOnCurrent
    ? 'Ваш ход'
    : canActOnCurrent && canScoreAny
      ? (currentPlayer?.name || '…')
      : waitingMyTurn
        ? 'Ожидание очереди'
        : iAmDone
          ? 'Готово'
          : (currentPlayer?.name || '…');

  const subline = waitingMyTurn
    ? 'Сейчас скорит другой игрок — ваши цели ниже'
    : iAmDone
      ? (myResponse?.status === 'done' ? 'Вы подтвердили достижение' : 'Вы спасовали')
      : canActOnCurrent && isMySeat
        ? '1 общая · 1 секретная · затем подтвердите'
        : canActOnCurrent && canScoreAny
          ? `Отметка за: ${currentPlayer?.name || '…'}`
          : 'По инициативе · 1 общая + 1 секретная';

  const bodyProps = {
    canActOnCurrent,
    displayPlayer,
    displayResponse,
    stages,
    objectives,
    completions,
    onToggleSecret,
    onSelectPublic,
  };

  return (
    <div
      className={`fixed inset-0 z-[55] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${minimized ? 'hidden' : ''}`}
      role="presentation"
    >
      {/* —— Mobile: step layout —— */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-scoring-title-mobile"
        className="md:hidden flex flex-col w-full h-full max-h-[100dvh] bg-slate-950 border-0"
      >
        <header className="flex-shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500/80">
                Достижение целей
              </div>
              <h2
                id="objective-scoring-title-mobile"
                className="font-orbitron font-black text-2xl text-amber-200 leading-tight mt-0.5 truncate"
              >
                {headline}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-snug">{subline}</p>
            </div>
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="text-slate-500 hover:text-white transition p-2 -mr-1 flex-shrink-0"
                aria-label="Свернуть"
              >
                <i className="fa-solid fa-window-minimize" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {orderIds.map((id, idx) => {
              const p = players.find(pl => pl.id === id);
              if (!p) return null;
              const r = scoring?.responses?.[id];
              const isCurrent = id === currentId;
              const done = r?.status === 'done' || r?.status === 'passed';
              const isYou = seatPlayerId != null && id === seatPlayerId;
              const label = r?.status === 'passed'
                ? `${idx + 1} ${isYou ? 'Вы' : p.name} —`
                : done
                  ? `${idx + 1} ${isYou ? 'Вы' : p.name} ✓`
                  : isCurrent
                    ? `${idx + 1} ${isYou ? 'Вы' : p.name}`
                    : `${idx + 1} ${isYou ? 'Вы' : p.name}`;
              return (
                <span
                  key={id}
                  className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border whitespace-nowrap ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : done
                        ? 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            {answered}/{orderIds.length || 0} ответили
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-3 modal-scroll">
          <ScoringBody {...bodyProps} dense={false} />
        </div>

        {canActOnCurrent && targetPlayer && (
          <div className="flex-shrink-0 flex gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-800 bg-slate-950">
            <button
              type="button"
              onClick={() => onConfirm(targetPlayer.id)}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-black font-orbitron font-black text-sm uppercase tracking-wide"
            >
              Подтвердить
            </button>
            <button
              type="button"
              onClick={() => onPass(targetPlayer.id)}
              className="flex-1 py-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm uppercase tracking-wide"
            >
              Пас
            </button>
          </div>
        )}
      </div>

      {/* —— Desktop: two columns —— */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-scoring-title"
        className="hidden md:flex bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.2)] flex-col"
      >
        <div className="flex justify-between items-center gap-3 px-5 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="min-w-0">
            <h2
              id="objective-scoring-title"
              className="font-orbitron font-bold text-lg text-amber-300 uppercase flex items-center gap-2"
            >
              <i className="fa-solid fa-bullseye" aria-hidden="true" />
              <span className="truncate">Достижение целей</span>
            </h2>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              По инициативе · 1 общая + 1 секретная
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {onMinimize && (
              <button type="button" onClick={onMinimize} className="text-slate-500 hover:text-white transition" aria-label="Свернуть">
                <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
              </button>
            )}
            {onClose && (
              <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition" aria-label="Закрыть">
                <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-row">
          <aside className="w-56 lg:w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950/50 flex flex-col">
            <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800/80">
              Очередь
            </div>
            <ul className="flex-1 overflow-y-auto modal-scroll p-2 space-y-1.5">
              {orderIds.map((id, idx) => {
                const p = players.find(pl => pl.id === id);
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
                    className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 border text-xs ${
                      isCurrent
                        ? 'border-amber-500/50 bg-amber-950/30'
                        : 'border-slate-800 bg-slate-950'
                    }`}
                  >
                    <span className="font-bold text-slate-200 truncate flex items-center gap-2 min-w-0">
                      <span className="text-slate-600 font-orbitron w-4 flex-shrink-0">{idx + 1}</span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.color || '#64748b' }}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span
                      className={`font-bold uppercase tracking-wide flex-shrink-0 ${
                        status === 'done'
                          ? 'text-emerald-400'
                          : status === 'passed'
                            ? 'text-slate-500'
                            : isCurrent
                              ? 'text-amber-400'
                              : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="px-3 py-2 border-t border-slate-800 text-[10px] text-slate-500 font-bold">
              {answered}/{orderIds.length || 0} ответили
            </div>
          </aside>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0 space-y-1">
              {currentPlayer ? (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
                    Сейчас скорит
                  </div>
                  <div className="font-orbitron font-black text-xl text-amber-200 truncate">
                    {currentPlayer.name}
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">Очередь пуста</div>
              )}
              <p className="text-xs text-slate-400">{subline}</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-4 py-3 space-y-3">
              <ScoringBody {...bodyProps} dense />
            </div>

            {canActOnCurrent && targetPlayer && (
              <div className="flex-shrink-0 flex gap-3 p-4 border-t border-slate-800 bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => onConfirm(targetPlayer.id)}
                  className="flex-1 py-3.5 rounded-2xl bg-emerald-500 text-black font-orbitron font-black text-xs uppercase tracking-wide"
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  onClick={() => onPass(targetPlayer.id)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wide"
                >
                  Пас
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
  dense,
}) {
  return (
    <>
      {canActOnCurrent && displayPlayer && (
        <button
          type="button"
          onClick={() => onToggleSecret(displayPlayer.id)}
          className={`w-full text-left rounded-2xl border transition active:scale-[0.99] ${
            dense ? 'p-3' : 'p-4'
          } ${
            displayResponse?.secret
              ? 'border-purple-500/60 bg-purple-950/30'
              : 'border-slate-800 bg-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                dense ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'
              } ${
                displayResponse?.secret
                  ? 'bg-purple-500 border-purple-400 text-black'
                  : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-bold ${dense ? 'text-sm' : 'text-base'} ${
                displayResponse?.secret ? 'text-purple-200' : 'text-slate-100'
              }`}>
                Секретная цель (+1 ПО)
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-bold uppercase">
                Сейчас секретов: {displayPlayer.secrets ?? 0}/3
                {(displayPlayer.secrets ?? 0) >= 3 && !displayResponse?.secret ? ' · лимит' : ''}
              </div>
            </div>
          </div>
        </button>
      )}

      {stages.map(({ stage, title, color }) => {
        const list = objectives.filter((o) => {
          if (o.stage !== stage) return false;
          if (!displayPlayer) return true;
          const alreadyOwned = !!completions[`${displayPlayer.id}_${o.id}`];
          const scoredThisWindow = displayResponse?.publicId === o.id;
          // Hide goals the player already scored in a previous round/window.
          if (alreadyOwned && !scoredThisWindow) return false;
          return true;
        });
        if (!list.length) return null;
        return (
          <section key={stage} className="space-y-2">
            <h3 className={`font-orbitron font-bold uppercase ${color} ${dense ? 'text-xs' : 'text-sm'}`}>
              {title}
            </h3>
            {list.map(obj => {
              const mine = displayPlayer
                ? !!completions[`${displayPlayer.id}_${obj.id}`]
                : false;
              const scoredThisWindow = displayResponse?.publicId === obj.id;
              const interactive = canActOnCurrent && displayPlayer;

              return (
                <div
                  key={obj.id}
                  className={`rounded-2xl border ${dense ? 'p-3' : 'p-4'} ${
                    mine || scoredThisWindow
                      ? 'border-emerald-600/60 bg-emerald-950/30'
                      : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={!interactive}
                      onClick={() => interactive && onSelectPublic(displayPlayer.id, obj.id)}
                      className={`mt-0.5 rounded-lg border flex items-center justify-center flex-shrink-0 transition ${
                        dense ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'
                      } ${
                        mine || scoredThisWindow
                          ? 'bg-emerald-500 border-emerald-400 text-black'
                          : 'border-slate-600 text-transparent'
                      } ${interactive ? 'active:scale-95 cursor-pointer' : 'cursor-default'}`}
                      aria-label={mine || scoredThisWindow ? 'Снять отметку' : 'Отметить цель'}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!interactive}
                        onClick={() => interactive && onSelectPublic(displayPlayer.id, obj.id)}
                        className={`w-full text-left font-bold leading-snug ${
                          dense ? 'text-sm' : 'text-base'
                        } ${mine || scoredThisWindow ? 'text-emerald-200' : 'text-slate-100'} ${
                          interactive ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        {obj.desc}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {!objectives.length && (
        <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
          Публичные цели ещё не раскрыты — можно засчитать секрет или спасовать
        </div>
      )}
    </>
  );
}
