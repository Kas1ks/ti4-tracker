import { useEffect, useState } from 'react';
import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { areAllStrategiesPlayed, isStrategyCardPlayed } from '../game/selectors';
import { PlayerTechSheet, TechPips } from './TechSheet';

const TABS = [
  { id: 'turn', label: 'Ход', icon: 'fa-play' },
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
 * Mobile-only player console: Turn / Objectives / Table.
 * Desktop players keep the full GameBoard.
 */
export function PlayerMobileConsole({
  me,
  seatSecret,
  activePlayer,
  turnOrder,
  players = [],
  passed,
  strategyCards = [],
  allStrategiesPlayed,
  strategyActionTaken = false,
  strategyResolutionActive = false,
  resolvingCardId = null,
  turnTime,
  onPlayStrategy,
  onNextTurn,
  onPassTurn,
  getPlayerScore,
  targetScore,
  speakerId,
  objectives,
  completions,
  scoring,
  onSelectPublic,
  onToggleSecret,
  onConfirmScoring,
  onPassScoring,
  roundActive,
  canPlay,
  canNextTurn,
  onOpenProduction,
  usePok = false,
  useTe = false,
}) {
  const [tab, setTab] = useState('turn');
  const [tableSortMode, setTableSortMode] = useState('initiative');
  const [techSheetPlayerId, setTechSheetPlayerId] = useState(null);
  const scoringActive = !!scoring?.active;
  const myResponse = me ? scoring?.responses?.[me.id] : null;
  const currentScoringId = scoring?.orderIds?.[scoring?.currentIdx];
  const isMyScoringTurn = scoringActive && me && me.id === currentScoringId;
  const isMyTurn = !!(me && activePlayer && activePlayer.id === me.id && !passed[me.id]);

  useEffect(() => {
    if (scoringActive) {
      setTab('objectives');
      return;
    }
    if (isMyTurn) setTab('turn');
  }, [scoringActive, isMyTurn]);

  const waiting = !!activePlayer && !isMyTurn;
  const meFaction = me ? ALL_FACTIONS.find(f => f.id === me.factionId) : null;
  const myScore = me ? getPlayerScore(me.id) : 0;

  return (
    <div className="md:hidden flex flex-col flex-1 min-h-0 h-full w-full relative player-console">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Absolute panels so each tab scrolls independently (keeps local UI state).
            Inactive panels must leave the paint stack immediately on mobile
            (visibility alone leaves composited scroll layers on top for ~1s). */}
        <div
          className={`player-console-panel absolute inset-0 px-3 pt-2 space-y-3 ${
            tab === 'turn'
              ? 'is-active player-console-scroll overflow-y-auto overscroll-y-contain z-[1]'
              : 'is-inactive invisible pointer-events-none opacity-0 overflow-hidden z-0'
          }`}
          aria-hidden={tab !== 'turn'}
        >
          <TurnTab
            me={me}
            seatSecret={seatSecret}
            meFaction={meFaction}
            myScore={myScore}
            targetScore={targetScore}
            speakerId={speakerId}
            isMyTurn={isMyTurn}
            waiting={waiting}
            activePlayer={activePlayer}
            passed={passed}
            turnTime={turnTime}
            strategyCards={strategyCards}
            strategyActionTaken={strategyActionTaken}
            strategyResolutionActive={strategyResolutionActive}
            resolvingCardId={resolvingCardId}
            allStrategiesPlayed={allStrategiesPlayed}
            roundActive={roundActive}
            onPlayStrategy={onPlayStrategy}
            onNextTurn={onNextTurn}
            onPassTurn={onPassTurn}
            canPlay={canPlay && isMyTurn}
            canNextTurn={canNextTurn && isMyTurn}
            onOpenProduction={onOpenProduction}
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
          <ObjectivesTab
            me={me}
            objectives={objectives}
            completions={completions}
            players={players}
            scoringActive={scoringActive}
            myResponse={myResponse}
            isMyScoringTurn={isMyScoringTurn}
            currentScoringId={currentScoringId}
            scoringOrderIds={scoring?.orderIds || []}
            onSelectPublic={onSelectPublic}
            onToggleSecret={onToggleSecret}
            onConfirmScoring={onConfirmScoring}
            onPassScoring={onPassScoring}
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
          <TableTab
            me={me}
            turnOrder={turnOrder}
            players={players}
            passed={passed}
            activePlayer={activePlayer}
            getPlayerScore={getPlayerScore}
            targetScore={targetScore}
            speakerId={speakerId}
            sortMode={tableSortMode}
            onSortModeChange={setTableSortMode}
            onOpenPlayerTech={(playerId) => setTechSheetPlayerId(playerId)}
          />
        </div>
      </div>

      {techSheetPlayerId != null && (
        <PlayerTechSheet
          player={players.find(p => p.id === techSheetPlayerId)}
          usePok={usePok}
          useTe={useTe}
          onClose={() => setTechSheetPlayerId(null)}
        />
      )}

      {/* In-flow spacer so scroll panels end above the fixed tab bar */}
      <div className="player-tabbar-spacer" aria-hidden="true" />

      <nav className="player-tabbar" aria-label="Навигация игрока">
        <div className="grid grid-cols-3 w-full">
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-1 pt-2.5 pb-2 text-xs font-bold uppercase tracking-wide transition ${
                  on ? 'text-cyan-400' : 'text-slate-500'
                }`}
              >
                <i className={`fa-solid ${t.icon} text-base leading-none`} aria-hidden="true" />
                <span className="leading-tight">{t.label}</span>
                <span className={`w-6 h-0.5 rounded-full mt-0.5 ${on ? 'bg-cyan-400' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
        <div className="player-tabbar-safe" aria-hidden="true" />
      </nav>
    </div>
  );
}

function TurnTab({
  me,
  seatSecret,
  meFaction,
  myScore,
  targetScore,
  speakerId,
  isMyTurn,
  waiting,
  activePlayer,
  passed,
  turnTime,
  strategyCards,
  strategyActionTaken,
  strategyResolutionActive = false,
  resolvingCardId = null,
  allStrategiesPlayed,
  roundActive,
  onPlayStrategy,
  onNextTurn,
  onPassTurn,
  canPlay,
  canNextTurn,
  onOpenProduction,
}) {
  const activeFaction = activePlayer
    ? ALL_FACTIONS.find(f => f.id === activePlayer.factionId)
    : null;

  return (
    <div className="space-y-3 pt-1">
      <div
        className={`rounded-2xl border p-4 ${
          isMyTurn
            ? 'border-cyan-500/70 bg-cyan-950/30'
            : 'border-slate-800 bg-slate-900'
        }`}
      >
        {isMyTurn ? (
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Ваш ход</div>
            <div className="flex items-end justify-between gap-3">
              <div className="font-orbitron font-black text-2xl text-white leading-none">Действуйте</div>
              <div className="text-right">
                <div className="text-[11px] text-slate-500 uppercase font-bold">Ход</div>
                <div className="font-orbitron font-black text-amber-400 text-xl">{formatTime(turnTime)}</div>
              </div>
            </div>
          </div>
        ) : waiting ? (
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl bg-slate-950 border-2 p-1 flex-shrink-0"
              style={factionIconBorder(activePlayer.color)}
            >
              <img src={activeFaction?.iconUrl} alt="" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Сейчас ходит</div>
              <div className="font-bold text-lg text-white truncate">{activePlayer.name}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[11px] text-slate-500 uppercase font-bold">Ход</div>
              <div className="font-orbitron font-bold text-slate-300 text-base">{formatTime(turnTime)}</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="text-xs font-bold uppercase text-slate-500">
              {roundActive ? 'Ожидание хода' : 'Раунд ещё не начат'}
            </div>
            <div className="font-bold text-slate-300 mt-1">
              {roundActive ? 'Скоро ваш ход' : 'Ждите старта раунда'}
            </div>
          </div>
        )}
      </div>

      {me && (
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="ПО" value={myScore} sub={`/ ${targetScore}`} accent />
          <StatCell label="Секр" value={me.secrets ?? 0} />
          <StatCell
            label="Статус"
            value={me.id === speakerId ? 'Спикер' : passed[me.id] ? 'Пас' : 'В игре'}
            small
          />
        </div>
      )}

      {me && seatSecret && (
        <div className="rounded-2xl border border-amber-700/40 bg-amber-950/15 px-3 py-2.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Код места</div>
            <div className="text-[11px] text-slate-500">Для входа с другого устройства</div>
          </div>
          <div className="font-orbitron font-black text-xl text-amber-300 tracking-[0.2em]">{seatSecret}</div>
        </div>
      )}

      {me && (
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <div
            className="w-11 h-11 rounded-xl bg-slate-950 border-2 p-1 flex-shrink-0"
            style={factionIconBorder(me.color)}
          >
            <img src={meFaction?.iconUrl} alt={meFaction?.name} className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white truncate">{me.name}</div>
            <div className="text-xs text-amber-400/90 truncate">{meFaction?.name}</div>
          </div>
          <div className="ml-auto text-right flex-shrink-0">
            <div className="text-[11px] text-slate-500 uppercase font-bold">Всего</div>
            <div className="font-orbitron font-bold text-slate-300 text-sm">
              {formatTime(me.totalTime || 0)}
            </div>
          </div>
        </div>
      )}

      {isMyTurn && strategyCards.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
            Карты стратегии
          </div>
          {strategyCards.map(card => {
            const livePlayed = isStrategyCardPlayed(activePlayer || me, card.id);
            const resolving = strategyResolutionActive && resolvingCardId === card.id;
            const blockedThisTurn = !livePlayed && strategyActionTaken && !resolving;
            const disabled = !canPlay || livePlayed || blockedThisTurn || resolving;
            return (
              <div
                key={card.id}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3"
              >
                <img
                  src={card.imageUrl || STRATEGY_CARDS.find(c => c.id === card.id)?.imageUrl}
                  alt={card.ruName || card.name}
                  className="w-12 h-16 object-cover rounded-lg border border-slate-700 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500 font-bold">#{card.id}</div>
                  <div className="font-orbitron font-extrabold text-sm text-amber-300 leading-tight">
                    {card.ruName || card.name}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPlayStrategy(card.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border min-h-[44px] flex-shrink-0 ${
                    livePlayed
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : resolving
                        ? 'bg-amber-950 border-amber-500 text-amber-300'
                        : blockedThisTurn
                          ? 'bg-slate-950 text-slate-500 border-slate-700'
                          : canPlay
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-slate-950 text-slate-600 border-slate-800'
                  }`}
                >
                  {livePlayed ? '✓' : resolving ? '…' : blockedThisTurn ? 'Позже' : 'Сыграть'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isMyTurn && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {canNextTurn ? (
            <button
              type="button"
              onClick={onNextTurn}
              className="col-span-2 bg-cyan-500 hover:bg-cyan-400 text-black font-orbitron font-black py-3.5 rounded-2xl text-sm uppercase min-h-[52px]"
            >
              Завершить ход <i className="fa-solid fa-forward ml-1" />
            </button>
          ) : strategyResolutionActive ? (
            <button
              type="button"
              disabled
              title="Дождитесь окончания розыгрыша карты стратегии"
              className="col-span-2 bg-slate-900 text-slate-500 border border-slate-700 font-orbitron font-black py-3.5 rounded-2xl text-sm uppercase min-h-[52px] cursor-not-allowed opacity-70"
            >
              Завершить ход <i className="fa-solid fa-forward ml-1" />
            </button>
          ) : null}
          {canPlay && (
            <button
              type="button"
              onClick={() => onPassTurn(me.id)}
              disabled={!allStrategiesPlayed || strategyResolutionActive}
              title={
                strategyResolutionActive
                  ? 'Дождитесь окончания розыгрыша карты стратегии'
                  : !allStrategiesPlayed
                    ? 'Сначала сыграйте все карты стратегии'
                    : ''
              }
              className={`col-span-2 font-bold py-3.5 rounded-2xl text-sm border min-h-[48px] ${
                allStrategiesPlayed && !strategyResolutionActive
                  ? 'bg-red-950 text-red-300 border-red-800'
                  : 'bg-slate-900 text-slate-600 border-slate-800 opacity-60'
              }`}
            >
              Пас
            </button>
          )}
        </div>
      )}

      {!isMyTurn && me && !passed[me.id] && (
        <div className="text-center text-xs text-slate-500 py-4 px-2">
          Когда снова будет ваш ход, здесь появятся карты и действия.
        </div>
      )}

      {typeof onOpenProduction === 'function' && (
        <button
          type="button"
          onClick={onOpenProduction}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-cyan-700/70 bg-cyan-950/80 px-3 py-3 text-sm font-bold text-cyan-300 min-h-[48px]"
        >
          <i className="fa-solid fa-industry" aria-hidden="true" />
          Калькулятор производства
        </button>
      )}
    </div>
  );
}

function StatCell({ label, value, sub, accent, small }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 px-2 py-2.5 text-center ${accent ? 'border-amber-700/50' : ''}`}>
      <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">{label}</div>
      <div className={`font-orbitron font-black leading-tight ${accent ? 'text-amber-400' : 'text-white'} ${small ? 'text-sm mt-1' : 'text-xl'}`}>
        {value}
        {sub && <span className="text-slate-500 text-xs font-bold ml-0.5">{sub}</span>}
      </div>
    </div>
  );
}

function ObjectivesTab({
  me,
  objectives,
  completions,
  players,
  scoringActive,
  myResponse,
  isMyScoringTurn,
  currentScoringId,
  scoringOrderIds,
  onSelectPublic,
  onToggleSecret,
  onConfirmScoring,
  onPassScoring,
}) {
  const [expanded, setExpanded] = useState({});

  if (!me) {
    return <div className="text-sm text-slate-500 text-center py-8">Место не назначено</div>;
  }

  const canScore = scoringActive && isMyScoringTurn && myResponse?.status === 'pending';
  const currentPlayer = currentScoringId != null
    ? players.find(p => p.id === currentScoringId)
    : null;
  const activeSeats = players.filter(p => !p.eliminated);
  const stages = [
    { stage: 1, title: 'Этап I · 1 ПО', color: 'text-blue-400' },
    { stage: 2, title: 'Этап II · 2 ПО', color: 'text-rose-400' },
  ];

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4 pt-1 pb-2">
      {scoringActive ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-3 space-y-2">
          <div className="text-xs font-orbitron font-bold uppercase text-amber-300">
            Окно скоринга · по инициативе
          </div>
          {canScore ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Ваш ход. Можно отметить <span className="text-slate-200 font-bold">1 общую</span> и{' '}
              <span className="text-slate-200 font-bold">1 секретную</span>, затем подтвердить или спасовать.
            </p>
          ) : myResponse?.status === 'pending' ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Сейчас скорит{' '}
              <span className="text-amber-200 font-bold">{currentPlayer?.name || '…'}</span>
              . Ожидайте своей очереди.
            </p>
          ) : null}
          {myResponse?.status === 'done' && (
            <p className="text-xs text-emerald-400 font-bold">Вы подтвердили достижение.</p>
          )}
          {myResponse?.status === 'passed' && (
            <p className="text-xs text-slate-500 font-bold">Вы спасовали.</p>
          )}
          {scoringOrderIds.length > 0 && (
            <ol className="flex flex-wrap gap-1.5 pt-1">
              {scoringOrderIds.map((id, idx) => {
                const p = players.find(pl => pl.id === id);
                if (!p) return null;
                const isCurrent = id === currentScoringId;
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
                    {id === me.id && myResponse?.status === 'done' ? ' ✓' : ''}
                    {id === me.id && myResponse?.status === 'passed' ? ' —' : ''}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 px-0.5">
          Скоринг доступен только когда хост открывает «Достижение целей» в фазе статуса.
        </p>
      )}

      {canScore && (
        <button
          type="button"
          onClick={() => onToggleSecret(me.id)}
          className={`w-full text-left rounded-2xl border p-3 transition active:scale-[0.99] ${
            myResponse?.secret
              ? 'border-purple-500/60 bg-purple-950/30'
              : 'border-slate-800 bg-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center text-xs flex-shrink-0 ${
                myResponse?.secret
                  ? 'bg-purple-500 border-purple-400 text-black'
                  : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-bold ${myResponse?.secret ? 'text-purple-200' : 'text-slate-100'}`}>
                Секретная цель (+1 ПО)
              </div>
              <div className="text-xs text-slate-500 mt-1 font-bold uppercase">
                Сейчас секретов: {me.secrets ?? 0}/3
                {me.secrets >= 3 && !myResponse?.secret ? ' · лимит' : ''}
              </div>
            </div>
          </div>
        </button>
      )}

      {stages.map(({ stage, title, color }) => {
        const list = objectives.filter(o => o.stage === stage);
        if (!list.length) return null;
        return (
          <section key={stage} className="space-y-2">
            <h3 className={`font-orbitron font-bold text-xs uppercase ${color}`}>{title}</h3>
            {list.map(obj => {
              const mine = !!completions[`${me.id}_${obj.id}`];
              const scoredThisWindow = myResponse?.publicId === obj.id;
              const ownedBefore = mine && !scoredThisWindow;
              const interactive = canScore && !ownedBefore;
              const isCompletedByAll = activeSeats.length > 0
                && activeSeats.every(p => !!completions[`${p.id}_${obj.id}`]);
              const canCollapse = mine || isCompletedByAll;
              const isExpanded = expanded[obj.id] ?? !isCompletedByAll;

              return (
                <div
                  key={obj.id}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  onClick={() => {
                    if (interactive) onSelectPublic(me.id, obj.id);
                  }}
                  onKeyDown={(e) => {
                    if (!interactive) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPublic(me.id, obj.id);
                    }
                  }}
                  className={`rounded-2xl border transition-all duration-300 ${
                    isCompletedByAll
                      ? 'border-emerald-500/40 bg-emerald-950/10 p-3'
                      : mine
                        ? 'border-emerald-600/60 bg-emerald-950/30 p-3'
                        : 'border-slate-800 bg-slate-900 p-3'
                  } ${ownedBefore && !isCompletedByAll ? 'opacity-80' : ''} ${
                    interactive ? 'active:scale-[0.99] cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center text-xs flex-shrink-0 ${
                        mine
                          ? 'bg-emerald-500 border-emerald-400 text-black'
                          : 'border-slate-600 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            if (canCollapse) {
                              e.stopPropagation();
                              toggleExpand(obj.id);
                            }
                          }}
                          className={`min-w-0 flex-1 text-left flex items-start gap-2 ${
                            canCollapse ? 'cursor-pointer select-none' : interactive ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          {isCompletedByAll ? (
                            <span className="text-emerald-400 font-bold text-xs flex-shrink-0 mt-0.5 animate-pulse uppercase">
                              ✓ Все
                            </span>
                          ) : mine ? (
                            <span className="text-emerald-400 font-bold text-xs flex-shrink-0 mt-0.5 uppercase">
                              ✓ Вы
                            </span>
                          ) : null}
                          <span
                            className={`text-sm font-bold leading-snug transition-all duration-300 ${
                              canCollapse && !isExpanded
                                ? 'text-slate-400 line-through text-xs decoration-slate-600'
                                : mine
                                  ? 'text-emerald-200'
                                  : 'text-slate-100'
                            }`}
                          >
                            {obj.desc}
                          </span>
                        </button>
                        {canCollapse && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(obj.id);
                            }}
                            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 transition flex-shrink-0"
                            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </div>

                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${
                          isExpanded
                            ? 'max-h-96 opacity-100 mt-2 pt-2 border-t border-slate-800/80'
                            : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0'
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-1.5">
                          {activeSeats.map(p => {
                            const isDone = !!completions[`${p.id}_${obj.id}`];
                            const pColor = p.color || '#3b82f6';
                            const isBlack = pColor.toLowerCase() === '#000000'
                              || pColor.toLowerCase() === '#000'
                              || pColor.toLowerCase() === 'black';
                            return (
                              <div
                                key={p.id}
                                style={{
                                  borderColor: isDone ? (isBlack ? '#ffffff' : pColor) : undefined,
                                }}
                                className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between gap-1 border ${
                                  isDone
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'bg-slate-950/80 text-slate-400 border-slate-800'
                                } ${isDone && isBlack ? 'ring-2 ring-white/80' : ''}`}
                              >
                                <span className="truncate">{p.name}</span>
                                {isDone && (
                                  <span
                                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[11px] text-black font-extrabold flex-shrink-0"
                                    style={{ backgroundColor: isBlack ? '#ffffff' : pColor }}
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {ownedBefore && (
                          <div className="text-xs text-slate-500 mt-1.5 font-bold uppercase">
                            Уже засчитано ранее
                          </div>
                        )}
                      </div>
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
          Цели ещё не раскрыты
        </div>
      )}

      {canScore && (
        <div className="sticky bottom-0 pt-2 space-y-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
          <button
            type="button"
            onClick={() => onConfirmScoring(me.id)}
            className="w-full py-3 rounded-2xl bg-emerald-500 text-black font-orbitron font-black text-xs uppercase tracking-wide"
          >
            Подтвердить достижение
          </button>
          <button
            type="button"
            onClick={() => onPassScoring(me.id)}
            className="w-full py-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wide"
          >
            Пас (не достигаю)
          </button>
        </div>
      )}
    </div>
  );
}

function TableTab({
  me,
  turnOrder,
  players,
  passed,
  activePlayer,
  getPlayerScore,
  targetScore,
  speakerId,
  sortMode,
  onSortModeChange,
  onOpenPlayerTech,
}) {
  const activeSeats = players.filter(p => !p.eliminated);

  const listByInitiative = () => {
    if (turnOrder.length) return turnOrder.filter(p => !p.eliminated);
    return [...activeSeats].sort((a, b) => {
      const aInit = a.lastMinInitiative ?? 99;
      const bInit = b.lastMinInitiative ?? 99;
      if (aInit !== bInit) return aInit - bInit;
      return a.id - b.id;
    });
  };

  const listFromSpeaker = () => {
    if (!activeSeats.length) return [];
    let speakerIdx = activeSeats.findIndex(p => p.id === speakerId);
    if (speakerIdx === -1) speakerIdx = 0;
    return [...activeSeats.slice(speakerIdx), ...activeSeats.slice(0, speakerIdx)];
  };

  const listByScore = () => (
    [...activeSeats].sort((a, b) => {
      const diff = getPlayerScore(b.id) - getPlayerScore(a.id);
      return diff !== 0 ? diff : a.id - b.id;
    })
  );

  const list = sortMode === 'speaker'
    ? listFromSpeaker()
    : sortMode === 'score'
      ? listByScore()
      : listByInitiative();

  const modes = [
    { id: 'initiative', label: 'Инициатива' },
    { id: 'speaker', label: 'От спикера' },
    { id: 'score', label: 'ПО' },
  ];

  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
        {modes.map(m => {
          const on = sortMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSortModeChange(m.id)}
              className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition ${
                on ? 'bg-slate-800 text-cyan-300' : 'text-slate-500'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
        Цель {targetScore} ПО
      </div>

      {list.map((p, idx) => {
        const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
        const score = getPlayerScore(p.id);
        const isCurrent = activePlayer?.id === p.id && !passed[p.id];
        const isMe = me?.id === p.id;
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
                : isMe
                  ? 'border-slate-600 bg-slate-900'
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
                {isMe && (
                  <span className="text-xs font-bold uppercase text-cyan-400 border border-cyan-800 px-1 rounded">
                    вы
                  </span>
                )}
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
