import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { isStrategyCardPlayed } from '../game/selectors';

function strategyShortName(card) {
  return String(card.ruName || card.name || '').replace(/^\d+\.\s*/, '');
}

/** Accent hex per strategy card id (TI4 palette). */
const STRATEGY_ACCENT = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#eab308',
  4: '#22c55e',
  5: '#14b8a6',
  6: '#06b6d4',
  7: '#3b82f6',
  8: '#a855f7',
};

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
  const isBlack =
    activePlayer.color === '#000000' ||
    activePlayer.color === '#090d16' ||
    activePlayer.color === '#030712';
  const accent = isBlack ? '#94a3b8' : activePlayer.color || '#3b82f6';

  return (
    <div className="game-turn-bar" style={{ '--player-accent': accent }}>
      <div className="game-turn-side game-turn-side--left">
        <div className="game-turn-player">
          <div
            className="game-turn-faction-mark"
            style={{ boxShadow: `0 0 16px color-mix(in srgb, ${accent} 55%, transparent)` }}
          >
            <img src={faction?.iconUrl} alt="" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="game-turn-label">Сейчас ходит</div>
            <div className="game-turn-name truncate">{activePlayer.name}</div>
          </div>
        </div>
      </div>

      <div className="game-turn-side game-turn-side--center">
        {strategyCards.length > 0 && (
          <div className="game-turn-strategy">
            {strategyCards.map((card) => {
              const played = isStrategyCardPlayed(activePlayer, card.id);
              const resolving = strategyResolutionActive && resolvingCardId === card.id;
              const blockedThisTurn = !played && strategyActionTaken && !resolving;
              const disabled = !canPlay || played || blockedThisTurn || resolving;
              const cardAccent = STRATEGY_ACCENT[card.id] || '#ef4444';
              return (
                <div key={card.id} className="game-turn-strategy-row">
                  <span
                    className="game-turn-strategy-id"
                    style={{
                      borderColor: cardAccent,
                      boxShadow: `0 0 10px color-mix(in srgb, ${cardAccent} 35%, transparent)`,
                    }}
                  >
                    {card.id}
                  </span>
                  <span className="game-turn-strategy-name truncate">{strategyShortName(card)}</span>
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
                    className={
                      played
                        ? 'game-turn-played'
                        : resolving
                          ? 'game-turn-strategy-action is-resolving'
                          : blockedThisTurn || !canPlay
                            ? 'game-turn-strategy-action is-blocked'
                            : 'game-turn-strategy-action is-play'
                    }
                  >
                    {played ? (
                      <>
                        <i className="fa-solid fa-check" aria-hidden="true" />
                        Сыграна
                      </>
                    ) : resolving ? (
                      'Розыгрыш…'
                    ) : blockedThisTurn ? (
                      'След. ход'
                    ) : (
                      'Сыграть'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="game-turn-side game-turn-side--right">
        <div className="game-turn-timer">
          <div className="game-turn-timer-cell">
            <div className="game-turn-timer-label">Ход</div>
            <div className="game-turn-timer-value">{formatTime(turnTime)}</div>
          </div>
          <div className="game-turn-sep" aria-hidden="true" />
          <div className="game-turn-timer-cell">
            <div className="game-turn-timer-label">Всего</div>
            <div className="game-turn-timer-value is-muted">{formatTime(activePlayer.totalTime || 0)}</div>
          </div>
        </div>

        <div className="game-turn-actions">
          {(canNextTurn || strategyResolutionActive) && (
            <button
              type="button"
              onClick={canNextTurn ? onNextTurn : undefined}
              disabled={!canNextTurn}
              title={
                !canNextTurn && strategyResolutionActive
                  ? 'Дождитесь окончания розыгрыша карты стратегии'
                  : undefined
              }
              className="game-turn-end"
            >
              Завершить ход
            </button>
          )}
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
              className={`game-turn-pass ${
                allStrategiesPlayed && !strategyResolutionActive ? 'is-ready' : 'is-disabled'
              }`}
            >
              Пас
            </button>
          )}
          {canCombat && (
            <button
              type="button"
              onClick={onOpenCombat}
              className="game-turn-gear"
              title="Бой"
              aria-label="Бой"
            >
              <i className="fa-solid fa-crosshairs" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
