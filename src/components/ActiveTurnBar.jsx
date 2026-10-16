import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { isStrategyCardPlayed } from '../game/selectors';

export function ActiveTurnBar({
  activePlayer,
  strategyCards = [],
  allStrategiesPlayed,
  strategyActionTaken = false,
  strategyResolutionActive = false,
  resolvingCardId = null,
  onPlayStrategy,
  turnTime,
  onNextTurn,
  onPassTurn,
  onOpenCombat,
  canPlay = true,
  canNextTurn = true,
  canCombat = true,
}) {
  const faction = ALL_FACTIONS.find((f) => f.id === activePlayer.factionId);

  const playerBlock = (
    <div className="flex items-center gap-4 min-w-0">
      <div className="w-14 h-14 max-md:w-11 max-md:h-11 rounded-2xl border border-[var(--game-line)] bg-black/40 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
        <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
      </div>
      <div className="min-w-0">
        <div className="game-turn-label">Сейчас ходит</div>
        <div className="game-turn-name truncate">{activePlayer.name}</div>
      </div>
    </div>
  );

  const timerBlock = (
    <div className="game-turn-timer flex-shrink-0 max-md:gap-3 max-md:px-3">
      <div>
        <div className="game-turn-timer-label">Ход</div>
        <div className="game-turn-timer-value">{formatTime(turnTime)}</div>
      </div>
      <div className="game-turn-sep" />
      <div>
        <div className="game-turn-timer-label">Всего</div>
        <div className="game-turn-timer-value is-muted">{formatTime(activePlayer.totalTime || 0)}</div>
      </div>
    </div>
  );

  return (
    <div className="game-turn-bar max-md:flex-col max-md:items-stretch max-md:gap-3">
      <div className="hidden md:flex items-center gap-4">{playerBlock}</div>
      <div className="flex md:hidden items-center justify-between gap-3 w-full">
        {playerBlock}
        {timerBlock}
      </div>

      {strategyCards.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:grid max-md:grid-cols-1">
          {strategyCards.map((card) => {
            const played = isStrategyCardPlayed(activePlayer, card.id);
            const resolving = strategyResolutionActive && resolvingCardId === card.id;
            const blockedThisTurn = !played && strategyActionTaken && !resolving;
            const disabled = !canPlay || played || blockedThisTurn || resolving;
            return (
              <div
                key={card.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--game-line)] bg-black/35 max-md:justify-between"
              >
                <div>
                  <div className="text-[10px] text-[var(--game-muted)] uppercase font-bold">#{card.id}</div>
                  <div className="font-orbitron font-extrabold text-xs md:text-sm text-[var(--game-gold-bright)] leading-tight">
                    {card.ruName || card.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onPlayStrategy(card.id)}
                  disabled={disabled}
                  title={
                    resolving
                      ? 'Идёт розыгрыш карты'
                      : blockedThisTurn
                        ? 'Вторая карта — на следующем ходу'
                        : undefined
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition whitespace-nowrap max-md:min-h-[40px] max-md:py-2 ${
                    played
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                      : resolving
                        ? 'game-chip is-gold cursor-wait'
                        : blockedThisTurn
                          ? 'bg-black/40 text-[var(--game-muted)] border-[var(--game-line)] cursor-not-allowed'
                          : canPlay
                            ? 'game-btn-primary !py-1.5 !px-3 !text-xs !normal-case !tracking-normal !shadow-none'
                            : 'bg-black/40 text-[var(--game-muted)] border-[var(--game-line)] cursor-not-allowed opacity-60'
                  }`}
                >
                  {played ? '✓ Сыграна' : resolving ? 'Розыгрыш…' : blockedThisTurn ? 'След. ход' : 'Сыграть'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="hidden md:flex">{timerBlock}</div>

      <div className="flex items-center gap-3 max-md:w-full max-md:grid max-md:grid-cols-2">
        {canNextTurn ? (
          <button
            type="button"
            onClick={onNextTurn}
            className="game-btn-primary max-md:col-span-2 max-md:min-h-[48px]"
          >
            Завершить ход <i className="fa-solid fa-forward" aria-hidden="true" />
          </button>
        ) : strategyResolutionActive ? (
          <button
            type="button"
            disabled
            title="Дождитесь окончания розыгрыша карты стратегии"
            className="game-btn-primary max-md:col-span-2 max-md:min-h-[48px]"
          >
            Завершить ход <i className="fa-solid fa-forward" aria-hidden="true" />
          </button>
        ) : null}
        {canPlay && (
          <button
            type="button"
            onClick={() => onPassTurn(activePlayer.id)}
            disabled={!allStrategiesPlayed || strategyResolutionActive}
            title={
              strategyResolutionActive
                ? 'Дождитесь окончания розыгрыша карты стратегии'
                : !allStrategiesPlayed
                  ? 'Сначала сыграйте все карты стратегии!'
                  : ''
            }
            className={`max-md:min-h-[48px] ${
              allStrategiesPlayed && !strategyResolutionActive
                ? 'game-btn-danger'
                : 'game-btn-ghost opacity-60 cursor-not-allowed'
            }`}
          >
            Пас
          </button>
        )}
        {canCombat && (
          <button
            type="button"
            onClick={onOpenCombat}
            className="game-btn-danger max-md:min-h-[48px]"
            title="Открыть окно боя"
          >
            <i className="fa-solid fa-crosshairs" aria-hidden="true" />
            <span className="md:hidden">Бой</span>
          </button>
        )}
      </div>
    </div>
  );
}
