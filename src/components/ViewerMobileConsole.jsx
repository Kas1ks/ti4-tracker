import { useState } from 'react';
import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { areAllStrategiesPlayed, isStrategyCardPlayed } from '../game/selectors';
import { LiveEventTicker } from './LiveEventTicker';
import { PhaseHubChips } from './PhaseHubChips';
import { PlayerTechSheet, TechPips } from './TechSheet';

const TABS = [
  { id: 'turn', label: 'Ход', icon: 'fa-eye' },
  { id: 'objectives', label: 'Цели', icon: 'fa-list-check' },
  { id: 'table', label: 'Стол', icon: 'fa-users' },
];

function factionIconBorder(color) {
  const c = (color || '#3b82f6').toLowerCase();
  const isBlack = c === '#000000' || c === '#000' || c === 'black' || c === '#090d16' || c === '#030712';
  return {
    borderColor: isBlack ? '#334155' : (color || '#3b82f6'),
    borderWidth: 2,
  };
}

/**
 * Mobile-only spectator console (read-only), same shell as PlayerMobileConsole.
 * Desktop viewers keep the full GameBoard.
 */
export function ViewerMobileConsole({
  activePlayer,
  turnOrder = [],
  players = [],
  passed = {},
  turnTime = 0,
  getPlayerScore,
  targetScore,
  speakerId,
  objectives = [],
  completions = {},
  scoring = null,
  roundActive = false,
  strategyResolutionActive = false,
  resolvingCardId = null,
  usePok = false,
  useTe = false,
  phaseHub = [],
  logEvents = [],
}) {
  const [tab, setTab] = useState('turn');
  const [techSheetPlayerId, setTechSheetPlayerId] = useState(null);

  const scoringActive = !!scoring?.active;
  const currentScoringId = scoring?.orderIds?.[scoring?.currentIdx];
  const currentScoringPlayer = currentScoringId != null
    ? players.find(p => p.id === currentScoringId)
    : null;

  return (
    <div className="md:hidden flex flex-col flex-1 min-h-0 h-full w-full relative player-console">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          className={`player-console-panel absolute inset-0 px-3 pt-2 space-y-3 ${
            tab === 'turn'
              ? 'is-active player-console-scroll overflow-y-auto overscroll-y-contain z-[1]'
              : 'is-inactive invisible pointer-events-none opacity-0 overflow-hidden z-0'
          }`}
          aria-hidden={tab !== 'turn'}
        >
          <PhaseHubChips phases={phaseHub} className="mb-1" />
          <LiveEventTicker events={logEvents} />
          <ViewerTurnTab
            turnOrder={turnOrder}
            activePlayer={activePlayer}
            passed={passed}
            turnTime={turnTime}
            strategyResolutionActive={strategyResolutionActive}
            resolvingCardId={resolvingCardId}
            roundActive={roundActive}
            scoringActive={scoringActive}
            currentScoringPlayer={currentScoringPlayer}
          />
        </div>

        <div
          className={`player-console-panel absolute inset-0 px-3 pt-2 space-y-3 ${
            tab === 'objectives'
              ? 'is-active player-console-scroll overflow-y-auto overscroll-y-contain z-[1]'
              : 'is-inactive invisible pointer-events-none opacity-0 overflow-hidden z-0'
          }`}
          aria-hidden={tab !== 'objectives'}
        >
          <ViewerObjectivesTab
            objectives={objectives}
            completions={completions}
            players={players}
            scoring={scoring}
            scoringActive={scoringActive}
            currentScoringPlayer={currentScoringPlayer}
          />
        </div>

        <div
          className={`player-console-panel absolute inset-0 px-3 pt-2 space-y-3 ${
            tab === 'table'
              ? 'is-active player-console-scroll overflow-y-auto overscroll-y-contain z-[1]'
              : 'is-inactive invisible pointer-events-none opacity-0 overflow-hidden z-0'
          }`}
          aria-hidden={tab !== 'table'}
        >
          <ViewerTableTab
            players={players}
            passed={passed}
            activePlayer={activePlayer}
            getPlayerScore={getPlayerScore}
            targetScore={targetScore}
            speakerId={speakerId}
            onOpenPlayerTech={setTechSheetPlayerId}
          />
        </div>
      </div>

      <nav
        className="flex-shrink-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
        aria-label="Навигация зрителя"
      >
        <div className="grid grid-cols-3 gap-1">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl min-h-[52px] transition ${
                  on
                    ? 'bg-violet-950/50 text-violet-200 border border-violet-600/50'
                    : 'text-slate-500 border border-transparent'
                }`}
              >
                <i className={`fa-solid ${t.icon} text-sm`} aria-hidden="true" />
                <span className="text-[10px] font-bold uppercase tracking-wide">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="player-tabbar-safe" aria-hidden="true" />
      </nav>

      {techSheetPlayerId != null && (
        <PlayerTechSheet
          player={players.find(p => p.id === techSheetPlayerId) || null}
          usePok={usePok}
          useTe={useTe}
          onClose={() => setTechSheetPlayerId(null)}
        />
      )}
    </div>
  );
}

function ViewerTurnTab({
  turnOrder = [],
  activePlayer,
  passed,
  turnTime,
  strategyResolutionActive,
  resolvingCardId,
  roundActive,
  scoringActive,
  currentScoringPlayer,
}) {
  const hasActive = !!activePlayer && !passed[activePlayer.id];
  const activeCount = turnOrder.filter(p => p && !passed[p.id]).length;

  return (
    <div className="space-y-3 pt-1 pb-2">
      <div className="rounded-2xl border border-violet-700/50 bg-violet-950/25 px-3 py-2 flex items-center gap-2">
        <i className="fa-solid fa-eye text-violet-300" aria-hidden="true" />
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Режим зрителя</div>
          <div className="text-xs text-slate-400">Только просмотр · без действий</div>
        </div>
      </div>

      {hasActive && (
        <div className="rounded-2xl border border-cyan-500/50 bg-cyan-950/20 px-3 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Сейчас ходит</div>
            <div className="font-bold text-white truncate">{activePlayer.name}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Ход</div>
            <div className="font-orbitron font-bold text-amber-400 text-base">{formatTime(turnTime)}</div>
          </div>
        </div>
      )}

      {!hasActive && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-center">
          <div className="text-xs font-bold uppercase text-slate-500">
            {roundActive ? 'Между ходами' : 'Раунд ещё не начат'}
          </div>
          <div className="font-bold text-slate-300 mt-1 text-sm">
            {scoringActive
              ? `Скоринг: ${currentScoringPlayer?.name || '…'}`
              : roundActive
                ? 'Ожидание следующего игрока'
                : 'Ждите старта раунда'}
          </div>
        </div>
      )}

      {strategyResolutionActive && (
        <div className="rounded-2xl border border-amber-600/50 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-200">
          <span className="font-bold uppercase tracking-wide">Розыгрыш стратегии</span>
          {resolvingCardId != null && (
            <span className="text-amber-400/90">
              {' · '}
              {STRATEGY_CARDS.find(c => c.id === resolvingCardId)?.name || `#${resolvingCardId}`}
            </span>
          )}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="font-orbitron font-bold text-xs uppercase text-slate-400 flex items-center gap-2">
            <i className="fa-solid fa-list-ol text-cyan-400" aria-hidden="true" />
            Очередь хода
          </h3>
          {turnOrder.length > 0 && (
            <span className="text-[10px] font-bold text-slate-500 uppercase font-orbitron">
              Активных: {activeCount} / {turnOrder.length}
            </span>
          )}
        </div>

        {turnOrder.map((p) => {
          if (!p) return null;
          const hasPassed = !!passed[p.id];
          const isCurrent = !!activePlayer && activePlayer.id === p.id && !hasPassed;
          const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
          const isBlack = p.color === '#000000' || p.color === '#090d16' || p.color === '#030712';
          const cardBorderColor = isBlack ? '#f8fafc' : (p.color || '#3b82f6');
          const playerCards = (p.cards || []).slice().sort((a, b) => a.initiative - b.initiative);

          return (
            <div
              key={p.id}
              style={{ borderLeftColor: cardBorderColor, borderLeftWidth: 4 }}
              className={`rounded-2xl border p-3 transition ${
                isCurrent
                  ? 'bg-slate-900 border-cyan-400 shadow-lg shadow-cyan-500/15'
                  : hasPassed
                    ? 'bg-slate-950/50 border-slate-800 opacity-50 grayscale'
                    : 'bg-slate-950/80 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 flex-shrink-0"
                  style={{ boxShadow: `0 0 10px ${cardBorderColor}40` }}
                >
                  <img src={faction?.iconUrl} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-base text-white truncate">{p.name}</div>
                    {hasPassed ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800/50 uppercase flex-shrink-0">
                        ✓ Пас
                      </span>
                    ) : isCurrent ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 uppercase flex-shrink-0">
                        Ход
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm font-semibold mt-0.5 flex flex-wrap items-center gap-1.5">
                    {playerCards.length
                      ? playerCards.map((card) => {
                        const played = isStrategyCardPlayed(p, card.id);
                        const label = card.ruName || card.name || '';
                        const shortName = label.replace(/^\d+\.\s*/, '');
                        return (
                          <span key={card.id} className="inline-flex items-center gap-1 min-w-0">
                            <span className="font-orbitron font-bold text-amber-300/80">
                              #{card.id}
                            </span>
                            {played ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/50 uppercase tracking-wide">
                                Сыграно
                              </span>
                            ) : (
                              <span className="text-amber-300/80 truncate">{shortName}</span>
                            )}
                          </span>
                        );
                      })
                      : <span className="text-amber-300/80">Без карты</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <span>
                      Время:{' '}
                      <span className="font-mono text-slate-400">{formatTime(p.totalTime || 0)}</span>
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-amber-400 font-bold">{formatTime(turnTime)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!turnOrder.length && (
          <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
            Очередь появится после старта раунда
          </div>
        )}
      </section>
    </div>
  );
}

function ViewerObjectivesTab({
  objectives,
  completions,
  players,
  scoring,
  scoringActive,
  currentScoringPlayer,
}) {
  const [expanded, setExpanded] = useState({});
  const activeSeats = players.filter(p => !p.eliminated);
  const stages = [
    { stage: 1, title: 'Этап I · 1 ПО', color: 'text-blue-400' },
    { stage: 2, title: 'Этап II · 2 ПО', color: 'text-rose-400' },
  ];

  return (
    <div className="space-y-4 pt-1 pb-2">
      {scoringActive ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-3 space-y-2">
          <div className="text-xs font-orbitron font-bold uppercase text-amber-300">
            Окно скоринга
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Сейчас отмечает цели{' '}
            <span className="text-amber-200 font-bold">{currentScoringPlayer?.name || '…'}</span>
          </p>
          {Array.isArray(scoring?.orderIds) && scoring.orderIds.length > 0 && (
            <ol className="flex flex-wrap gap-1.5 pt-1">
              {scoring.orderIds.map((id, idx) => {
                const p = players.find(pl => pl.id === id);
                if (!p) return null;
                const status = scoring.responses?.[id]?.status;
                const isCurrent = id === scoring.orderIds[scoring.currentIdx];
                return (
                  <li
                    key={id}
                    className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md border ${
                      isCurrent
                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                        : 'border-slate-700 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600">{idx + 1}</span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || '#64748b' }}
                    />
                    {p.name}
                    {status === 'done' ? ' ✓' : status === 'passed' ? ' —' : ''}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 px-0.5">
          Общие цели на столе. Скоринг открывает хост в фазе статуса.
        </p>
      )}

      {stages.map(({ stage, title, color }) => {
        const list = objectives.filter(o => Number(o.stage) === stage);
        if (!list.length) return null;
        return (
          <section key={stage} className="space-y-2">
            <h3 className={`font-orbitron font-bold text-xs uppercase ${color}`}>{title}</h3>
            {list.map((obj) => {
              const scorers = activeSeats.filter(p => !!completions[`${p.id}_${obj.id}`]);
              const isCompletedByAll = activeSeats.length > 0 && scorers.length === activeSeats.length;
              const isExpanded = expanded[obj.id] ?? !isCompletedByAll;
              return (
                <div
                  key={obj.id}
                  className={`rounded-2xl border p-3 ${
                    isCompletedByAll
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : scorers.length
                        ? 'border-emerald-700/40 bg-slate-900'
                        : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [obj.id]: !isExpanded }))}
                    className="w-full text-left flex items-start gap-2"
                  >
                    {isCompletedByAll ? (
                      <span className="text-emerald-400 font-bold text-xs flex-shrink-0 mt-0.5 uppercase">✓ Все</span>
                    ) : scorers.length > 0 ? (
                      <span className="text-emerald-400/80 font-bold text-xs flex-shrink-0 mt-0.5">
                        {scorers.length}/{activeSeats.length}
                      </span>
                    ) : null}
                    <span
                      className={`text-sm font-bold leading-snug flex-1 ${
                        !isExpanded ? 'text-slate-400 line-through text-xs' : 'text-slate-100'
                      }`}
                    >
                      {obj.desc || obj.title || obj.name || obj.id}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {scorers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {scorers.map(p => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-800/60 bg-emerald-950/40 text-emerald-200"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: p.color || '#64748b' }}
                              />
                              {p.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-600">Ещё никто не взял</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      {!objectives.length && (
        <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
          Общие цели появятся после старта
        </div>
      )}
    </div>
  );
}

function ViewerTableTab({
  players,
  passed,
  activePlayer,
  getPlayerScore,
  targetScore,
  speakerId,
  onOpenPlayerTech,
}) {
  const list = players
    .filter(p => !p.eliminated)
    .slice()
    .sort((a, b) => {
      const diff = getPlayerScore(b.id) - getPlayerScore(a.id);
      return diff !== 0 ? diff : a.id - b.id;
    });

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between px-0.5">
        <h3 className="font-orbitron font-bold text-xs uppercase text-slate-400 flex items-center gap-2">
          <i className="fa-solid fa-trophy text-amber-400" aria-hidden="true" />
          Табло ПО
        </h3>
        <span className="text-xs font-bold text-slate-500 uppercase">
          Цель {targetScore} ПО
        </span>
      </div>

      {list.map((p, idx) => {
        const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
        const score = getPlayerScore(p.id);
        const isCurrent = activePlayer?.id === p.id && !passed[p.id];
        const hasPassed = !!passed[p.id];
        const cardsPlayed = areAllStrategiesPlayed(p);

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpenPlayerTech?.(p.id)}
            className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
              isCurrent
                ? 'border-cyan-500/60 bg-cyan-950/25'
                : 'border-slate-800 bg-slate-950/80'
            }`}
          >
            <div className="text-xs font-orbitron font-bold text-slate-600 w-4">{idx + 1}</div>
            <div
              className="w-10 h-10 rounded-lg bg-slate-900 border-2 p-0.5 flex-shrink-0"
              style={factionIconBorder(p.color)}
            >
              <img src={faction?.iconUrl} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-base text-white truncate">{p.name}</span>
                {p.id === speakerId && (
                  <span className="text-xs font-bold uppercase text-purple-300 border border-purple-800 px-1 rounded">
                    спикер
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 flex-wrap">
                <span>
                  {hasPassed ? 'Пас' : isCurrent ? 'Ходит' : cardsPlayed ? 'Стратегия сыграна' : 'В игре'}
                </span>
                <TechPips techIds={p.techIds} />
              </div>
            </div>
            <div className="font-orbitron font-black text-xl text-amber-400 tabular-nums">{score}</div>
            <i className="fa-solid fa-atom text-sky-500/80 text-sm flex-shrink-0" aria-hidden="true" />
          </button>
        );
      })}
      {!list.length && (
        <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
          Игроки появятся после старта партии
        </div>
      )}
    </div>
  );
}
