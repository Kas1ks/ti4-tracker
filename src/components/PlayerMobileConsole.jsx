import { useEffect, useState } from 'react';
import { ALL_FACTIONS, STRATEGY_CARDS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { areAllStrategiesPlayed, isStrategyCardPlayed } from '../game/selectors';
import { FactionGuideSheet } from './FactionGuideSheet';
import { PhaseHubChips } from './PhaseHubChips';
import { PlayerCombatSheet } from './PlayerCombatSheet';
import { PlayerTechSheet, TechPips } from './TechSheet';
import { PushNotificationsBanner } from './PushNotificationsBanner';
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
  roundActive,
  canPlay,
  canNextTurn,
  canCombat = false,
  combat = null,
  combatSessionTime = 0,
  onStartCombat,
  onStartNeutral,
  onSetNeutralCounts,
  onBeginNeutral,
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
  pushNotify = null,
}) {
  const [tab, setTab] = useState('turn');
  const [objView, setObjView] = useState('personal');
  const [tableSortMode, setTableSortMode] = useState('initiative');
  const [techSheetPlayerId, setTechSheetPlayerId] = useState(null);
  const scoringActive = !!scoring?.active;
  const myResponse = me ? scoring?.responses?.[me.id] : null;
  const isMyTurn = !!(me && activePlayer && activePlayer.id === me.id && !passed[me.id]);

  const openObjectives = (view = 'personal') => {
    setObjView(view);
    setTab('objectives');
  };

  useEffect(() => {
    if (scoringActive) return;
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
            onStartNeutral={onStartNeutral}
            onSetNeutralCounts={onSetNeutralCounts}
            onBeginNeutral={onBeginNeutral}
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
          {pushNotify?.canUse && !pushNotify.showPrompt && (
            <PushNotificationsBanner
              showPrompt={false}
              supported={pushNotify.supported}
              canUse={pushNotify.canUse}
              subscribed={pushNotify.subscribed}
              busy={pushNotify.busy}
              configured={pushNotify.configured}
              onEnable={pushNotify.enable}
              onDismiss={pushNotify.dismissPrompt}
              onDisable={pushNotify.disable}
              compact
            />
          )}
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

function strategyShortName(card) {
  return String(card.ruName || card.name || '').replace(/^\d+\.\s*/, '');
}

/**
 * Краткие тексты КС (базовая / PoK формулировка, сжато под UI).
 * Правки текстов — сюда; имена карт из STRATEGY_CARDS.
 */
const STRATEGY_ABILITY_BLURBS = {
  1: {
    // Лидерство
    primary: 'Получите 3 жетона приказов. Можете потратить влияние: +1 жетон за каждые 3 потраченных влияния.',
    secondary: 'Потратьте 1 жетон приказа из пула стратегии → получите +1 жетон за каждые 3 потраченных влияния.',
  },
  2: {
    // Дипломатия
    primary: 'Выберите систему (не Мекатол). Каждый другой игрок кладёт туда жетон приказа из подкреплений. Подготовьте до 2-х своих истощённых планет.',
    secondary: 'Потратьте 1 жетон из пула стратегии → Подготовьте до 2-х своих истощённых планет.',
  },
  3: {
    // Политика
    primary: 'Выберите игрока (не текущего спикера) — он получает жетон спикера. Возьмите 2 карты действий, посмотри 2 карты политики и верните обратно в колодну в нужном вам порядке.',
    secondary: 'Потратьте 1 жетон из пула стратегии → возьмите 2 карты действий.',
  },
  4: {
    // Строительство
    primary: 'Используйте ПРОИЗВОДТВО одной из ваших баз и постройте одну постройку или постройте 2 постройки.',
    secondary: 'Потратьте 1 жетон из пула стратегии → разместите 1 постройку на своей планете.',
  },
  5: {
    // Торговля
    primary: 'Получите 3 товара. Пополните продукцию, выберите количество игроков которые могут использовать второстепенное свойство бесплатно.',
    secondary: 'Потратьте 1 жетон из пула стратегии → пополните продукцию.',
  },
  6: {
    // Война
    primary: 'Выполните тактическое действие не размещая жетон, даже если жетон есть система будет считать активной, может перераспределить жетоны стратегии',
    secondary: 'Потратьте 1 жетон из пула стратегии → Используйте производство всех юнитов в родной системе.',
  },
  7: {
    // Технологии
    primary: 'Исследуйте 1 технологию. Можете потратить 6 ресурсов, чтобы исследовать ещё 1.',
    secondary: 'Потратьте 1 жетон из пула стратегии и 4 ресурса → исследуйте 1 технологию.',
  },
  8: {
    // Империя / Экспансия
    primary: 'Если контролируете Мекатол Рекс — получите 1 ПО. Возьмите 1 секретную цель.',
    secondary: 'Потратьте 1 жетон из пула стратегии → возьмите 1 секретную цель.',
  },
};

function TurnTab({
  me,
  meFaction,
  myScore,
  targetScore,
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
  onStartNeutral,
  onSetNeutralCounts,
  onBeginNeutral,
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
  const resolvingCard = strategyResolutionActive && resolvingCardId != null
    ? (strategyCards.find(c => c.id === resolvingCardId)
      || STRATEGY_CARDS.find(c => c.id === resolvingCardId))
    : null;
  const passReady = canPlay && allStrategiesPlayed && !strategyResolutionActive;

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
  const heroAvatar = isMyTurn ? meFaction : waiting ? activeFaction : null;
  const heroColor = isMyTurn ? me?.color : waiting ? activePlayer?.color : null;

  const renderHeroTimer = () => (
    <div className="pt-hero-side">
      <div className="pt-clock-label">ход</div>
      <div className="pt-clock">{formatTime(turnTime)}</div>
    </div>
  );

  return (
    <div className="player-turn">
      <section
        className={`pt-hero ${isMyTurn ? 'is-mine' : waiting ? 'is-wait' : 'is-idle'}${
          heroOpenable ? ' is-openable' : ''
        }${strategyResolutionActive && isMyTurn ? ' is-resolving' : ''}`}
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
          <div className="pt-hero-main">
            <div className="pt-avatar" style={factionIconBorder(heroColor)}>
              <img src={heroAvatar?.iconUrl} alt="" />
            </div>
            <div className="pt-hero-copy">
              <div className="pt-kicker is-gold">Ваш ход</div>
              <div className="pt-hero-title truncate">{me?.name || 'Вы'}</div>
              {strategyResolutionActive ? (
                <div className="pt-hero-sub is-busy">
                  Розыгрыш
                  {resolvingCard ? `: ${strategyShortName(resolvingCard)}` : ' стратегии'}
                </div>
              ) : (
                <div className="pt-hero-sub truncate">{meFaction?.name || ''}</div>
              )}
            </div>
            {renderHeroTimer()}
          </div>
        ) : waiting ? (
          <div className="pt-hero-main">
            <div className="pt-avatar" style={factionIconBorder(activePlayer.color)}>
              <img src={activeFaction?.iconUrl} alt="" />
            </div>
            <div className="pt-hero-copy">
              <div className="pt-kicker">Сейчас ходит</div>
              <div className="pt-hero-title truncate">{activePlayer.name}</div>
              <div className="pt-hero-sub truncate">{activeFaction?.name || ''}</div>
            </div>
            {renderHeroTimer()}
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
        <div className="pt-stats is-compact is-two" aria-label="Ваши показатели">
          <div className="pt-stat-chip is-cyan">
            <i className="fa-solid fa-trophy pt-stat-chip-ico" aria-hidden="true" />
            <span className="pt-stat-chip-k">ПО</span>
            <span className="pt-stat-chip-v">{myScore}<small> / {targetScore}</small></span>
          </div>
          <div className="pt-stat-chip is-violet">
            <i className="fa-solid fa-scroll pt-stat-chip-ico" aria-hidden="true" />
            <span className="pt-stat-chip-k">Секреты</span>
            <span className="pt-stat-chip-v">{me.secrets ?? 0}</span>
          </div>
        </div>
      )}

      {isMyTurn && strategyCards.length > 0 && (
        <div className="pt-cards">
          <div className="pt-section-head">
            <span className="pt-kicker is-gold">
              {strategyCards.length === 1 ? 'Карта стратегии' : 'Карты стратегии'}
            </span>
            <i className="fa-solid fa-circle-info pt-section-info" aria-hidden="true" title="Основное и вторичное действие" />
          </div>
          {strategyCards.map(card => {
            const livePlayed = isStrategyCardPlayed(activePlayer || me, card.id);
            const resolving = strategyResolutionActive && resolvingCardId === card.id;
            const blockedThisTurn = !livePlayed && strategyActionTaken && !resolving;
            const disabled = !canPlay || livePlayed || blockedThisTurn || resolving;
            const btnClass = livePlayed
              ? 'is-done'
              : resolving
                ? 'is-busy'
                : blockedThisTurn || !canPlay
                  ? 'is-off'
                  : 'is-play';
            const btnLabel = livePlayed
              ? 'Сыграна'
              : resolving
                ? 'Розыгрыш…'
                : blockedThisTurn
                  ? 'Позже'
                  : 'Сыграть карту';
            const blurbs = STRATEGY_ABILITY_BLURBS[card.id];
            return (
              <div
                key={card.id}
                className={`pt-card is-block${livePlayed ? ' is-played' : ''}${resolving ? ' is-resolving' : ''}`}
              >
                <div className="pt-card-body">
                  <img
                    src={card.imageUrl || STRATEGY_CARDS.find(c => c.id === card.id)?.imageUrl}
                    alt=""
                    className="pt-card-art"
                  />
                  <div className="pt-card-meta">
                    <div className="pt-card-title">
                      <span className="pt-card-id">#{card.id}</span>
                      {' '}
                      {strategyShortName(card)}
                    </div>
                    {blurbs && (
                      <div className="pt-card-abilities">
                        <div className="pt-ability">
                          <i className="fa-solid fa-users pt-ability-ico is-primary" aria-hidden="true" />
                          <p>{blurbs.primary}</p>
                        </div>
                        <div className="pt-ability">
                          <i className="fa-solid fa-arrow-right-arrow-left pt-ability-ico is-secondary" aria-hidden="true" />
                          <p>{blurbs.secondary}</p>
                        </div>
                      </div>
                    )}
                    {blockedThisTurn && (
                      <div className="pt-card-hint">Вторая карта — на следующем ходу</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPlayStrategy(card.id)}
                  className={`pt-card-btn ${btnClass}`}
                >
                  {!livePlayed && !resolving && !blockedThisTurn && canPlay && (
                    <i className="fa-solid fa-play" aria-hidden="true" />
                  )}
                  {livePlayed && <i className="fa-solid fa-check" aria-hidden="true" />}
                  {btnLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isMyTurn && (
        <>
          <div className="pt-section-head">
            <span className="pt-kicker">Быстрые действия</span>
          </div>
          <div className="pt-actions is-quick">
            <PlayerCombatSheet
              me={me}
              players={players}
              combat={combat}
              combatSessionTime={combatSessionTime}
              canStartCombat={canCombat && !strategyResolutionActive}
              onStartCombat={onStartCombat}
              onStartNeutral={onStartNeutral}
              onSetNeutralCounts={onSetNeutralCounts}
              onBeginNeutral={onBeginNeutral}
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
                disabled={!passReady}
                title={
                  strategyResolutionActive
                    ? 'Дождитесь окончания розыгрыша карты стратегии'
                    : !allStrategiesPlayed
                      ? 'Сначала сыграйте все карты стратегии'
                      : ''
                }
                className={`pt-action is-pass${passReady ? '' : ' is-off'}`}
              >
                <i className="fa-solid fa-forward-fast" aria-hidden="true" />
                Пас
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={canNextTurn ? onNextTurn : undefined}
            disabled={!canNextTurn}
            title={
              !canNextTurn && strategyResolutionActive
                ? 'Дождитесь окончания розыгрыша карты стратегии'
                : !canNextTurn
                  ? 'Сначала завершите действия хода'
                  : undefined
            }
            className={`pt-action is-primary is-wide${!canNextTurn ? ' is-off' : ''}`}
          >
            Завершить ход
            <i className="fa-solid fa-forward" aria-hidden="true" />
          </button>
        </>
      )}

      {!isMyTurn && (
        <PlayerCombatSheet
          me={me}
          players={players}
          combat={combat}
          combatSessionTime={combatSessionTime}
          canStartCombat={false}
          onStartNeutral={onStartNeutral}
          onSetNeutralCounts={onSetNeutralCounts}
          onBeginNeutral={onBeginNeutral}
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
        <div className="pt-tools">
          <div className="pt-section-head">
            <span className="pt-kicker">Инструменты</span>
          </div>
          <button type="button" onClick={onOpenProduction} className="pt-prod">
            <i className="fa-solid fa-industry" aria-hidden="true" />
            <span className="pt-prod-copy">
              <span className="pt-prod-title">Калькулятор производства</span>
              <span className="pt-prod-sub">Расчёт стоимости и планирование</span>
            </span>
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
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
}) {
  const [expanded, setExpanded] = useState({});

  if (!me) {
    return <div className="text-sm text-slate-500 text-center py-8">Место не назначено</div>;
  }

  const activeSeats = players.filter(p => !p.eliminated);
  const stages = [
    { stage: 1, title: 'Этап I · 1 ПО', color: 'text-blue-400' },
    { stage: 2, title: 'Этап II · 2 ПО', color: 'text-rose-400' },
  ];
  const isPersonal = objView !== 'general';

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

      <p className="text-xs text-slate-500 px-0.5">
        {isPersonal
          ? 'Ваши отметки по открытым целям. Чужие достижения — во вкладке «Общая».'
          : 'Справочник открытых целей и кто их уже засчитал.'}
      </p>

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
                  const scoredThisWindow = scoringActive && myResponse?.publicId === obj.id;
                  const done = mine || scoredThisWindow;
                  const collapsed = mine && !scoredThisWindow;

                  return (
                    <div
                      key={obj.id}
                      className={`pm-obj-card is-personal is-stage${stage}${done ? ' is-done' : ''}${
                        collapsed ? ' is-collapsed' : ''
                      }`}
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
                          {mine && !scoredThisWindow && !collapsed && (
                            <div className="text-xs text-slate-500 mt-1 font-bold uppercase">
                              Уже засчитано
                            </div>
                          )}
                          {scoredThisWindow && !mine && (
                            <div className="text-xs text-amber-400/90 mt-1 font-bold uppercase">
                              Выбрано в окне скоринга
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
