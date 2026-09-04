import { ActiveTurnBar } from './ActiveTurnBar';
import { ROLE_LABELS, ROLES } from '../sync/permissions';

export function GameHeader({
  isGameActive,
  roundNumber,
  isPoliticsActive,
  onTogglePolitics,
  roundActive,
  isDraftLocked,
  canStartRound,
  onOpenDraft,
  onStartRound,
  onEndRound,
  onExport,
  onOpenEndGame,
  onOpenStats,
  turnOrder,
  activePlayer,
  passed,
  strategyCards,
  allStrategiesPlayed,
  strategyActionTaken,
  onPlayStrategy,
  turnTime,
  onNextTurn,
  onPassTurn,
  onOpenCombat,
  room,
  roomStatus,
  perms,
}) {
  const role = perms?.role || ROLES.ADMIN;
  const isAdmin = role === ROLES.ADMIN;
  const canPhases = isAdmin;
  const canExport = isAdmin;
  const canEndGame = isAdmin;
  const canCombat = isAdmin;
  const canPlayTurn = isAdmin || role === ROLES.PLAYER;
  const canNextTurn = isAdmin || role === ROLES.PLAYER;

  const seatIsActive = !perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId;
  const showTurnBar = isGameActive && turnOrder.length > 0 && activePlayer && !passed[activePlayer.id]
    && (isAdmin || canPlayTurn || role === ROLES.VIEWER);

  return (
    <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-xl rounded-b-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <i className="fa-solid fa-khanda text-cyan-400 text-2xl md:text-3xl" />
          <span className="font-orbitron font-black text-xl md:text-3xl text-white tracking-wider">TI4 TRACKER</span>
          {roomStatus === 'live' && room?.roomId && (
            <div className="hidden sm:flex items-center gap-2 bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-orbitron font-bold text-xs px-3 py-1.5 rounded-xl">
              <i className="fa-solid fa-wifi" />
              <span>{room.roomId}</span>
              <span className="text-emerald-500/80 font-sans font-semibold normal-case">
                {ROLE_LABELS[room.role] || room.role}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isGameActive ? (
            <>
              <div className="text-sm md:text-base font-bold text-amber-400 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl font-orbitron">
                РАУНД {roundNumber}
              </div>

              {canPhases && (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <span className={`font-bold text-xs uppercase ${isPoliticsActive ? 'text-purple-400' : 'text-slate-500'}`}>Политика</span>
                  <button
                    type="button"
                    onClick={onTogglePolitics}
                    title={isPoliticsActive ? 'Деактивировать фазу политики' : 'Активировать фазу политики (после взятия Мекатола)'}
                    className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${isPoliticsActive ? 'bg-purple-600 justify-end' : 'bg-slate-700 justify-start'}`}
                  >
                    <span className="w-4 h-4 bg-white rounded-full block shadow-md" />
                  </button>
                </div>
              )}

              {canPhases && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onOpenDraft}
                    disabled={roundActive || isDraftLocked}
                    title={isDraftLocked ? 'Карты уже выбраны — дождитесь конца раунда' : undefined}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition border border-amber-400/30 shadow-md flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-layer-group" /> Выбор карт стратегий
                  </button>

                  {!roundActive ? (
                    <button
                      type="button"
                      onClick={onStartRound}
                      disabled={!canStartRound}
                      className={`font-bold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 ${
                        canStartRound
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-play" /> Начать раунд
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onEndRound}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-flag-checkered" /> Завершить раунд
                    </button>
                  )}
                </div>
              )}

              {canExport && (
                <button
                  type="button"
                  onClick={onExport}
                  className="bg-cyan-950/80 hover:bg-cyan-900 text-cyan-400 font-extrabold px-3 py-2 rounded-xl text-xs md:text-sm border border-cyan-800 transition flex items-center gap-1.5 shadow"
                  title="Скопировать токен партии"
                >
                  <i className="fa-solid fa-share-nodes" />
                  <span className="hidden sm:inline">Код игры</span>
                </button>
              )}

              {canEndGame && (
                <button
                  type="button"
                  onClick={onOpenEndGame}
                  className="bg-red-900/80 hover:bg-red-800 text-red-200 font-extrabold px-4 py-2 rounded-xl text-xs md:text-sm border border-red-700 transition flex items-center gap-1.5 shadow"
                >
                  <i className="fa-solid fa-square-xmark" />
                  <span className="hidden sm:inline">Завершить</span>
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenStats}
                className="bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-extrabold px-4 py-2 rounded-xl text-xs md:text-sm border border-purple-800 transition flex items-center gap-1.5 shadow"
              >
                <i className="fa-solid fa-chart-pie" />
                <span>📊 Статистика компании</span>
              </button>
              <div className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-4 py-2 rounded-xl font-bold text-xs md:text-sm uppercase tracking-wider font-orbitron">
                Режим Настройки
              </div>
            </div>
          )}
        </div>
      </div>

      {showTurnBar && (
        <ActiveTurnBar
          activePlayer={activePlayer}
          strategyCards={strategyCards}
          allStrategiesPlayed={allStrategiesPlayed}
          strategyActionTaken={strategyActionTaken}
          onPlayStrategy={onPlayStrategy}
          turnTime={turnTime}
          onNextTurn={onNextTurn}
          onPassTurn={onPassTurn}
          onOpenCombat={onOpenCombat}
          canPlay={canPlayTurn && seatIsActive}
          canNextTurn={canNextTurn && seatIsActive}
          canCombat={canCombat}
        />
      )}
    </header>
  );
}
