import { useEffect, useState } from 'react';
import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { areAllStrategiesPlayed, isStrategyCardPlayed } from '../game/selectors';
import { FactionGuideSheet } from './FactionGuideSheet';
import { PhaseHubChips } from './PhaseHubChips';
import { PlayerCombatSheet } from './PlayerCombatSheet';
import { PlayerTechSheet, TechPips } from './TechSheet';
import objStage1Bg from '../assets/objectives/stage1-bg.jpg';
import objStage2Bg from '../assets/objectives/stage2-bg.jpg';
import tableRowBg from '../assets/table-row-bg.jpg';

const OBJ_STAGE_BG = {
  1: objStage1Bg,
  2: objStage2Bg,
};

/** Base stage slots; each manual (custom) objective raises the stage max by 1. */
const OBJ_STAGE_BASE_MAX = 5;

function stageObjectiveMax(objectives, stage) {
  const open = objectives.filter((o) => Number(o.stage) === stage);
  const customCount = open.filter((o) => String(o.id || '').startsWith('custom_')).length;
  return Math.max(OBJ_STAGE_BASE_MAX + customCount, open.length);
}

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
  canCombat = false,
  combat = null,
  combatSessionTime = 0,
  onStartCombat,
  onCombatSetHits,
  onCombatAssign,
  onCombatDeclareRetreat,
  onCombatResolveRetreat,
  onCombatDefeat,
  onCombatDismissResult,
  onOpenProduction,
  usePok = false,
  useTe = false,
  phaseHub = [],
}) {
  const [tab, setTab] = useState('turn');
  const [objView, setObjView] = useState('personal');
  const [tableSortMode, setTableSortMode] = useState('initiative');
  const [techSheetPlayerId, setTechSheetPlayerId] = useState(null);
  const scoringActive = !!scoring?.active;
  const myResponse = me ? scoring?.responses?.[me.id] : null;
  const currentScoringId = scoring?.orderIds?.[scoring?.currentIdx];
  const isMyScoringTurn = scoringActive && me && me.id === currentScoringId;
  const isMyTurn = !!(me && activePlayer && activePlayer.id === me.id && !passed[me.id]);

  const openObjectives = (view = 'personal') => {
    setObjView(view);
    setTab('objectives');
  };

  useEffect(() => {
    if (scoringActive) {
      setObjView('personal');
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
          <PhaseHubChips phases={phaseHub} className="mb-1" />
          <TurnTab
            me={me}
            meFaction={meFaction}
            myScore={myScore}
            targetScore={targetScore}
            speakerId={speakerId}
            isMyTurn={isMyTurn}
            waiting={waiting}
            activePlayer={activePlayer}
            players={players}
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
            canCombat={canCombat && isMyTurn}
            combat={combat}
            combatSessionTime={combatSessionTime}
            onStartCombat={onStartCombat}
            onCombatSetHits={onCombatSetHits}
            onCombatAssign={onCombatAssign}
            onCombatDeclareRetreat={onCombatDeclareRetreat}
            onCombatResolveRetreat={onCombatResolveRetreat}
            onCombatDefeat={onCombatDefeat}
            onCombatDismissResult={onCombatDismissResult}
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
            objView={objView}
            onObjViewChange={setObjView}
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
        <div className="game-mobile-tabs mx-2 mt-1.5 mb-1 grid grid-cols-3 !gap-1">
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === 'objectives') openObjectives('personal');
                  else setTab(t.id);
                }}
                className={`game-mobile-tab flex flex-col items-center justify-center gap-0.5 !py-2 ${
                  on ? 'is-active' : ''
                }`}
              >
                <i className={`fa-solid ${t.icon} text-base leading-none`} aria-hidden="true" />
                <span className="leading-tight text-[10px]">{t.label}</span>
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
  canCombat = false,
  players = [],
  combat = null,
  combatSessionTime = 0,
  onStartCombat,
  onCombatSetHits,
  onCombatAssign,
  onCombatDeclareRetreat,
  onCombatResolveRetreat,
  onCombatDefeat,
  onCombatDismissResult,
  onOpenProduction,
}) {
  const [guideFactionId, setGuideFactionId] = useState(null);
  const [guidePlayerName, setGuidePlayerName] = useState(null);

  const activeFaction = activePlayer
    ? ALL_FACTIONS.find(f => f.id === activePlayer.factionId)
    : null;

  const activeAccent = activePlayer?.color || '#f87171';
  const meAccent = me?.color || '#38bdf8';
  const statusLabel = me?.id === speakerId ? 'Спикер' : passed[me?.id] ? 'Пас' : 'В игре';
  const statusIcon = me?.id === speakerId
    ? 'fa-landmark'
    : passed[me?.id]
      ? 'fa-flag'
      : 'fa-user';

  const openGuideFor = (factionId, playerName) => {
    if (!factionId) return;
    setGuideFactionId(factionId);
    setGuidePlayerName(playerName || null);
  };

  const heroFactionId = isMyTurn
    ? me?.factionId
    : waiting
      ? activePlayer?.factionId
      : null;
  const heroPlayerName = isMyTurn
    ? me?.name
    : waiting
      ? activePlayer?.name
      : null;
  const heroOpenable = !!heroFactionId;

  return (
    <div className="player-turn">
      <section
        className={`pt-hero ${isMyTurn ? 'is-mine' : waiting ? 'is-wait' : 'is-idle'}${
          heroOpenable ? ' is-openable' : ''
        }`}
        style={{
          '--pt-accent': isMyTurn ? '#e8c547' : waiting ? activeAccent : '#64748b',
        }}
        role={heroOpenable ? 'button' : undefined}
        tabIndex={heroOpenable ? 0 : undefined}
        aria-label={heroOpenable ? 'Открыть справку по расе' : undefined}
        onClick={() => {
          if (heroOpenable) openGuideFor(heroFactionId, heroPlayerName);
        }}
        onKeyDown={(event) => {
          if (!heroOpenable) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openGuideFor(heroFactionId, heroPlayerName);
          }
        }}
      >
        {isMyTurn ? (
          <>
            <div className="pt-hero-main">
              <div className="pt-hero-copy">
                <div className="pt-hero-title">Ваш ход</div>
              </div>
              <div className="pt-hero-side">
                <div className="pt-clock">{formatTime(turnTime)}</div>
              </div>
            </div>
          </>
        ) : waiting ? (
          <div className="pt-hero-main">
            <div className="pt-avatar" style={factionIconBorder(activePlayer.color)}>
              <img src={activeFaction?.iconUrl} alt="" />
            </div>
            <div className="pt-hero-copy">
              <div className="pt-kicker">Сейчас ходит</div>
              <div className="pt-hero-title truncate">{activePlayer.name}</div>
            </div>
            <div className="pt-hero-side">
              <div className="pt-clock">{formatTime(turnTime)}</div>
            </div>
          </div>
        ) : (
          <div className="pt-hero-idle">
            <div className="pt-kicker">
              {roundActive ? 'Ожидание хода' : 'Раунд ещё не начат'}
            </div>
            <div className="pt-hero-title is-sm">
              {roundActive ? 'Скоро ваш ход' : 'Ждите старта раунда'}
            </div>
          </div>
        )}
      </section>

      <FactionGuideSheet
        show={!!guideFactionId}
        factionId={guideFactionId}
        playerName={guidePlayerName}
        onClose={() => {
          setGuideFactionId(null);
          setGuidePlayerName(null);
        }}
      />

      {me && (
        <div className="pt-stats">
          <div className="pt-stat is-cyan">
            <div className="pt-stat-label">ПО</div>
            <div className="pt-stat-value">
              <span>{myScore}</span>
              <small>/ {targetScore}</small>
            </div>
          </div>
          <div className="pt-stat is-violet">
            <div className="pt-stat-label">Секреты</div>
            <div className="pt-stat-value">
              <i className="fa-solid fa-lock pt-stat-ico" aria-hidden="true" />
              <span>{me.secrets ?? 0}</span>
            </div>
          </div>
          <div className="pt-stat is-gold">
            <div className="pt-stat-label">Статус</div>
            <div className="pt-stat-value is-sm">
              <i className={`fa-solid ${statusIcon} pt-stat-ico`} aria-hidden="true" />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>
      )}

      {me && (
        <section className="pt-me" style={{ '--pt-accent': meAccent }}>
          <div className="pt-avatar" style={factionIconBorder(me.color)}>
            <img src={meFaction?.iconUrl} alt={meFaction?.name || ''} />
          </div>
          <div className="pt-me-copy">
            <div className="pt-me-name truncate">{me.name}</div>
            <div className="pt-me-faction truncate">{meFaction?.name}</div>
          </div>
          <div className="pt-me-side">
            <div className="pt-me-total-label">Всего</div>
            <div className="pt-me-total">{formatTime(me.totalTime || 0)}</div>
          </div>
          <i className="fa-solid fa-chevron-right pt-me-chev" aria-hidden="true" />
        </section>
      )}

      {isMyTurn && strategyCards.length > 0 && (
        <div className="pt-cards">
          <div className="pt-kicker">Карты стратегии</div>
          {strategyCards.map(card => {
            const livePlayed = isStrategyCardPlayed(activePlayer || me, card.id);
            const resolving = strategyResolutionActive && resolvingCardId === card.id;
            const blockedThisTurn = !livePlayed && strategyActionTaken && !resolving;
            const disabled = !canPlay || livePlayed || blockedThisTurn || resolving;
            return (
              <div key={card.id} className="pt-card">
                <img
                  src={card.imageUrl || STRATEGY_CARDS.find(c => c.id === card.id)?.imageUrl}
                  alt={card.ruName || card.name}
                  className="pt-card-art"
                />
                <div className="pt-card-meta">
                  <div className="pt-card-id">#{card.id}</div>
                  <div className="pt-card-name">{card.ruName || card.name}</div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPlayStrategy(card.id)}
                  className={`pt-card-btn ${
                    livePlayed ? 'is-done' : resolving ? 'is-busy' : blockedThisTurn || !canPlay ? 'is-off' : 'is-play'
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
        <div className="pt-actions">
          {canNextTurn ? (
            <button type="button" onClick={onNextTurn} className="pt-action is-primary">
              Завершить ход <i className="fa-solid fa-forward" aria-hidden="true" />
            </button>
          ) : strategyResolutionActive ? (
            <button type="button" disabled className="pt-action is-off" title="Дождитесь окончания розыгрыша карты стратегии">
              Завершить ход <i className="fa-solid fa-forward" aria-hidden="true" />
            </button>
          ) : null}
          <PlayerCombatSheet
            me={me}
            players={players}
            combat={combat}
            combatSessionTime={combatSessionTime}
            canStartCombat={canCombat && !strategyResolutionActive}
            onStartCombat={onStartCombat}
            onSetHits={onCombatSetHits}
            onAssign={onCombatAssign}
            onDeclareRetreat={onCombatDeclareRetreat}
            onResolveRetreat={onCombatResolveRetreat}
            onDefeat={onCombatDefeat}
            onDismissResult={onCombatDismissResult}
          />
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
              className={`pt-action ${allStrategiesPlayed && !strategyResolutionActive ? 'is-danger' : 'is-off'}`}
            >
              Пас
            </button>
          )}
        </div>
      )}

      {!isMyTurn && (
        <PlayerCombatSheet
          me={me}
          players={players}
          combat={combat}
          combatSessionTime={combatSessionTime}
          canStartCombat={false}
          onSetHits={onCombatSetHits}
          onAssign={onCombatAssign}
          onDeclareRetreat={onCombatDeclareRetreat}
          onResolveRetreat={onCombatResolveRetreat}
          onDefeat={onCombatDefeat}
          onDismissResult={onCombatDismissResult}
        />
      )}

      {!isMyTurn && me && !passed[me.id] && (
        <div className="pt-hint">
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
          <span>Когда снова будет ваш ход, здесь появятся карты и действия.</span>
        </div>
      )}

      {typeof onOpenProduction === 'function' && (
        <button type="button" onClick={onOpenProduction} className="pt-prod">
          <i className="fa-solid fa-industry" aria-hidden="true" />
          <span>Калькулятор производства</span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const OBJ_VIEWS = [
  { id: 'personal', label: 'Личная', icon: 'fa-user' },
  { id: 'general', label: 'Общая', icon: 'fa-users' },
];

function ObjectivesTab({
  me,
  objectives,
  completions,
  players,
  objView = 'personal',
  onObjViewChange,
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
  const isPersonal = objView !== 'general';

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scoringBanner = scoringActive ? (
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
      {isPersonal
        ? 'Ваши отметки по открытым целям. Чужие достижения — во вкладке «Общая».'
        : 'Скоринг доступен только когда хост открывает «Достижение целей» в фазе статуса.'}
    </p>
  );

  const secretToggle = canScore && isPersonal ? (
    <button
      type="button"
      onClick={() => onToggleSecret(me.id)}
      className={`w-full text-left rounded-2xl border p-3 transition active:scale-[0.99] ${
        myResponse?.secret
          ? 'border-[var(--game-line-gold)] bg-[rgba(201,162,39,0.12)]'
          : 'border-[var(--game-line)] bg-[rgba(8,10,16,0.82)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center text-xs flex-shrink-0 ${
            myResponse?.secret
              ? 'bg-[var(--game-gold)] border-[var(--game-gold-bright)] text-black'
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
  ) : null;

  const scoreActions = canScore && isPersonal ? (
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
  ) : null;

  return (
    <div className="space-y-4 pt-1 pb-2">
      <div className="obj-subtabs" role="tablist" aria-label="Разделы целей">
        {OBJ_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={objView === v.id}
            onClick={() => onObjViewChange?.(v.id)}
            className={`obj-subtab ${objView === v.id ? 'is-active' : ''}`}
          >
            <i className={`fa-solid ${v.icon}`} aria-hidden="true" />
            <span>{v.label}</span>
          </button>
        ))}
      </div>

      {scoringBanner}
      {secretToggle}

      {isPersonal ? (
        <>
          {stages.map(({ stage, title, color }) => {
            const list = objectives.filter((o) => Number(o.stage) === stage);
            if (!list.length) return null;
            const doneCount = list.filter((o) => !!completions[`${me.id}_${o.id}`]).length;
            const openCount = list.length;
            const stageMax = stageObjectiveMax(objectives, stage);

            return (
              <section key={stage} className="space-y-2">
                <div className="pm-obj-stage-head">
                  <h3 className={`font-orbitron font-bold text-xs uppercase ${color}`}>{title}</h3>
                  <span className="pm-obj-stage-count" title="Выполнено / открыто (максимум этапа)">
                    {doneCount}/{openCount}
                    <span className="pm-obj-stage-max"> ({stageMax})</span>
                  </span>
                </div>
                {list.map((obj) => {
                  const mine = !!completions[`${me.id}_${obj.id}`];
                  const scoredThisWindow = myResponse?.publicId === obj.id;
                  const ownedBefore = mine && !scoredThisWindow;
                  const interactive = canScore && !ownedBefore;
                  const selectedNow = canScore && scoredThisWindow;
                  const done = mine || selectedNow;
                  /* Выполненные — узкая полоска; выбор в окне скоринга остаётся развёрнутым */
                  const collapsed = mine && !selectedNow;

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
                      className={`pm-obj-card is-personal is-stage${stage}${done ? ' is-done' : ''}${
                        collapsed ? ' is-collapsed' : ''
                      }${interactive ? ' is-interactive' : ''}`}
                      style={{ '--pm-obj-bg': `url(${OBJ_STAGE_BG[stage]})` }}
                    >
                      <div className="flex gap-3 items-center">
                        <span
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs flex-shrink-0 ${
                            done
                              ? 'bg-emerald-500 border-emerald-400 text-black'
                              : 'border-slate-600 text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`pm-obj-desc text-sm font-bold leading-snug ${
                              collapsed
                                ? 'text-slate-400 line-through text-xs decoration-slate-600 block truncate'
                                : done
                                  ? 'text-emerald-200'
                                  : 'text-slate-100'
                            }`}
                          >
                            {obj.desc}
                          </span>
                          {ownedBefore && !collapsed && (
                            <div className="text-xs text-slate-500 mt-1 font-bold uppercase">
                              Уже засчитано
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </>
      ) : (
        <>
          {stages.map(({ stage, title, color }) => {
            const list = objectives.filter((o) => o.stage === stage);
            if (!list.length) return null;
            return (
              <section key={stage} className="space-y-2">
                <h3 className={`font-orbitron font-bold text-xs uppercase ${color}`}>{title}</h3>
                {list.map((obj) => {
                  const mine = !!completions[`${me.id}_${obj.id}`];
                  const isCompletedByAll = activeSeats.length > 0
                    && activeSeats.every(p => !!completions[`${p.id}_${obj.id}`]);
                  const canCollapse = mine || isCompletedByAll;
                  const isExpanded = expanded[obj.id] ?? !isCompletedByAll;

                  return (
                    <div
                      key={obj.id}
                      className={`pm-obj-card is-stage${stage}${
                        isCompletedByAll || mine ? ' is-done' : ''
                      }${!isExpanded ? ' is-collapsed' : ''}`}
                      style={{ '--pm-obj-bg': `url(${OBJ_STAGE_BG[stage]})` }}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (canCollapse) toggleExpand(obj.id);
                          }}
                          className={`min-w-0 flex-1 text-left flex items-start gap-2 ${
                            canCollapse ? 'cursor-pointer select-none' : 'cursor-default'
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
                            className={`pm-obj-desc text-sm font-bold leading-snug transition-all duration-300 ${
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
                            onClick={() => toggleExpand(obj.id)}
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
                          {activeSeats.map((p) => {
                            const isDone = !!completions[`${p.id}_${obj.id}`];
                            const pColor = p.color || '#3b82f6';
                            const isBlack = pColor.toLowerCase() === '#000000'
                              || pColor.toLowerCase() === '#000'
                              || pColor.toLowerCase() === 'black';
                            const accent = isBlack ? '#94a3b8' : pColor;
                            return (
                              <div
                                key={p.id}
                                style={{ '--player-accent': accent }}
                                className={`game-obj-seat text-[11px] ${isDone ? 'is-done' : ''}`}
                              >
                                <span className="truncate">{p.name}</span>
                                {isDone && (
                                  <span className="game-obj-seat-check" aria-hidden="true">✓</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </>
      )}

      {!objectives.length && (
        <div className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-800 rounded-2xl">
          Цели ещё не раскрыты
        </div>
      )}

      {scoreActions}
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
    { id: 'initiative', label: 'Иниц.', icon: 'fa-list-ol' },
    { id: 'speaker', label: 'Спикер', icon: 'fa-landmark' },
    { id: 'score', label: 'ПО', icon: 'fa-trophy' },
  ];

  return (
    <div className="tbl-board">
      <div className="tbl-sort" role="tablist" aria-label="Сортировка стола">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={sortMode === m.id}
            onClick={() => onSortModeChange(m.id)}
            className={`tbl-sort-btn ${sortMode === m.id ? 'is-active' : ''}`}
          >
            <i className={`fa-solid ${m.icon}`} aria-hidden="true" />
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="tbl-meta">
        <span className="tbl-meta-kicker">Стол</span>
        <span className="tbl-meta-target">
          Цель <strong>{targetScore}</strong> ПО
        </span>
      </div>

      <div className="tbl-list">
        {list.map((p, idx) => {
          const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
          const score = getPlayerScore(p.id);
          const isCurrent = activePlayer?.id === p.id && !passed[p.id];
          const isMe = me?.id === p.id;
          const hasPassed = !!passed[p.id];
          const cardsPlayed = areAllStrategiesPlayed(p);
          const status = hasPassed
            ? 'Пас'
            : isCurrent
              ? 'Ходит'
              : cardsPlayed
                ? 'Стратегия сыграна'
                : 'В игре';
          const accent = p.color || '#64748b';

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpenPlayerTech?.(p.id)}
              className={[
                'tbl-row',
                isCurrent ? 'is-current' : '',
                isMe ? 'is-me' : '',
                hasPassed ? 'is-passed' : '',
              ].filter(Boolean).join(' ')}
              style={{
                '--tbl-accent': accent,
                '--tbl-bg': `url(${tableRowBg})`,
              }}
            >
              <span className="tbl-rank">{idx + 1}</span>
              <div className="tbl-crest" style={factionIconBorder(p.color)}>
                <img src={faction?.iconUrl} alt="" />
              </div>
              <div className="tbl-copy">
                <div className="tbl-name-row">
                  <span className="tbl-name">{p.name}</span>
                  {isMe && <span className="tbl-chip is-you">вы</span>}
                  {p.id === speakerId && <span className="tbl-chip is-speaker">спикер</span>}
                </div>
                <div className="tbl-sub">
                  <span className={`tbl-status ${isCurrent ? 'is-live' : ''} ${hasPassed ? 'is-out' : ''}`}>
                    {status}
                  </span>
                  <TechPips techIds={p.techIds} />
                </div>
              </div>
              <div className="tbl-score">
                <span className="tbl-score-num">{score}</span>
                <i className="fa-solid fa-atom tbl-score-ico" aria-hidden="true" />
              </div>
            </button>
          );
        })}
      </div>

      {!list.length && (
        <div className="tbl-empty">Игроки появятся после старта партии</div>
      )}
    </div>
  );
}
