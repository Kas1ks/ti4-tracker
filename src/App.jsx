import { lazy, Suspense, useEffect, useState } from 'react';
import * as select from './game/selectors';
import { useSyncedGame } from './sync/useSyncedGame';
import { verifyHostSecret } from './sync/roomApi';
import { useElapsedSeconds } from './hooks/useTurnTimer';
import { useYourTurnAlert } from './hooks/useYourTurnAlert';
import { useVisualViewportShell } from './hooks/useVisualViewportShell';
import { useAppDialog } from './hooks/useAppDialog';
import { useCloudGame } from './hooks/useCloudGame';
import { useLocalUi } from './hooks/useLocalUi';
import { useGameDialogs } from './hooks/useGameDialogs';
import { AppDialog } from './components/AppDialog';
import { GameHeader } from './components/GameHeader';
import { MinimizedModalControls } from './components/MinimizedModalControls';
import { LazyWhen } from './components/LazyWhen';
import { RoomHub } from './components/RoomHub';
import { GuestLobby } from './components/GuestLobby';
import { SetupScreen } from './components/SetupScreen';
import { StrategyResolutionBanner } from './components/StrategyResolutionBanner';
import { StartingTechDraftBanner } from './components/StartingTechDraftBanner';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { ROLES } from './sync/permissions';
import { playersNeedingStartingTechDraft } from './data/technologies';
import { getTechSession } from './hooks/useTechSession';

const GameBoard = lazy(() => import('./components/GameBoard').then(m => ({ default: m.GameBoard })));
const PlayerMobileConsole = lazy(() => import('./components/PlayerMobileConsole').then(m => ({ default: m.PlayerMobileConsole })));
const GameSummaryModal = lazy(() => import('./components/GameSummaryModal').then(m => ({ default: m.GameSummaryModal })));
const StatsModal = lazy(() => import('./components/StatsModal').then(m => ({ default: m.StatsModal })));
const StatusPhaseModal = lazy(() => import('./components/StatusPhaseModal').then(m => ({ default: m.StatusPhaseModal })));
const ObjectiveScoringModal = lazy(() => import('./components/ObjectiveScoringModal').then(m => ({ default: m.ObjectiveScoringModal })));
const EndGameModal = lazy(() => import('./components/EndGameModal').then(m => ({ default: m.EndGameModal })));
const DraftModal = lazy(() => import('./components/DraftModal').then(m => ({ default: m.DraftModal })));
const PoliticsModal = lazy(() => import('./components/PoliticsModal').then(m => ({ default: m.PoliticsModal })));
const CombatModal = lazy(() => import('./components/CombatModal').then(m => ({ default: m.CombatModal })));
const SpeakerSelectionModal = lazy(() => import('./components/SpeakerSelectionModal').then(m => ({ default: m.SpeakerSelectionModal })));
const StrategyResolutionModal = lazy(() => import('./components/StrategyResolutionModal').then(m => ({ default: m.StrategyResolutionModal })));
const StartingTechDraftModal = lazy(() => import('./components/StartingTechDraftModal').then(m => ({ default: m.StartingTechDraftModal })));
const StartingTechPlayerModal = lazy(() => import('./components/StartingTechPlayerModal').then(m => ({ default: m.StartingTechPlayerModal })));
const ImperialClaimModal = lazy(() => import('./components/ImperialClaimModal').then(m => ({ default: m.ImperialClaimModal })));
const TechModal = lazy(() => import('./components/TechModal').then(m => ({ default: m.TechModal })));
const ProductionCalculatorModal = lazy(() => import('./components/ProductionCalculatorModal').then(m => ({ default: m.ProductionCalculatorModal })));
const ExpeditionModal = lazy(() => import('./components/ExpeditionModal').then(m => ({ default: m.ExpeditionModal })));
const EventLogModal = lazy(() => import('./components/EventLogModal').then(m => ({ default: m.EventLogModal })));

function BoardChunkFallback() {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center text-slate-400 text-sm">
      Загрузка доски…
    </div>
  );
}

function App() {
  const { dialog, close, uiAlert, uiConfirm, uiPrompt, uiForm } = useAppDialog();
  const {
    game,
    dispatch,
    room,
    roomStatus,
    roomError,
    syncLink,
    dismissRoomError,
    startHostRoom,
    joinRoomById,
    releaseSeatById,
    leaveRoom,
    resetLocalGame,
    perms,
    canUndo,
  } = useSyncedGame();

  const [soloSetup, setSoloSetup] = useState(false);

  const ui = useLocalUi();
  const { setShowExpeditionModal } = ui;
  const getPlayerScore = (playerId) => select.playerScore(game, playerId);

  const cloud = useCloudGame({ game, dispatch, getPlayerScore, uiAlert, uiConfirm, uiPrompt });
  const dialogs = useGameDialogs({
    game,
    dispatch,
    uiAlert,
    uiConfirm,
    uiForm,
    onNeedSpeakerPick: () => ui.setShowSpeakerSelectionModal(true),
  });

  const { isGameActive, players } = game;
  const { targetScore, roundNumber, usePok, useTe, speakerId, isPoliticsActive } = game.meta;
  const { active: objectives, completions } = game.objectives;
  const { active: roundActive, passed, turnStartedAt, strategyActionTaken, strategyResolution, imperialClaim, techResearch } = game.round;
  const {
    queue: draftQueue, assignments: draftAssignments, currentQueueIndex,
    step: draftStep, pickOrder: draftPickOrder, showModal: showDraftModal,
    strategyCardBonuses,
  } = game.draft;
  const {
    showModal: showPoliticsModal, step: politicsStep, agendas, currentAgendaIndex,
    influenceLocked, voteReversed,
  } = game.politics;
  const { show: showStatusPhaseModal, checks: statusPhaseChecks, scoring: objectiveScoring } = game.statusPhase;

  const turnOrder = select.turnOrder(game);
  const activePlayer = select.activePlayer(game);
  const strategyCards = select.activePlayerStrategyCards(game);
  const allStrategiesPlayed = select.isActiveStrategyPlayed(game);
  const activePlayers = select.activePlayers(game);
  const sortedPlayersForBoard = select.playersForBoard(game);
  const canStartRound = select.canStartRound(game);
  const canEndRound = select.canEndRound(game);
  const isDraftLocked = select.isDraftLocked(game);

  const clockRunning = isGameActive && !!activePlayer && !passed[activePlayer.id]
    && Number.isFinite(turnStartedAt);
  const turnTime = useElapsedSeconds(turnStartedAt, clockRunning);

  const isLive = roomStatus === 'live' && !!room?.roomId;
  const isConnecting = roomStatus === 'connecting';
  const hasRoomSession = isLive || isConnecting || !!room?.roomId;
  const canSetup = perms?.can('setup') !== false;
  const showHub = !isGameActive && !soloSetup && !hasRoomSession;
  const showAdminSetup = !isGameActive && canSetup && (soloSetup || hasRoomSession);
  const showGuestLobby = !isGameActive && !canSetup && hasRoomSession;
  const isPlayerClient = perms?.role === ROLES.PLAYER;
  const showImperialClaimModal = !!imperialClaim?.active && (
    roomStatus === 'solo'
    || perms?.role === ROLES.ADMIN
    || (perms?.seatPlayerId != null && perms.seatPlayerId === imperialClaim.playerId)
  );
  const startingTechDraft = game.startingTechDraft;
  const startingTechNeeders = playersNeedingStartingTechDraft(players);
  const showStartingTechBanner = !!(
    isGameActive
    && startingTechDraft?.needed
    && !startingTechDraft?.active
    && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
  );
  const showStartingTechHostModal = !!(
    startingTechDraft?.active
    && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
  );
  const {
    techResolutionActive,
    techResearchView,
    showTechResearchModal,
  } = getTechSession({
    game,
    players,
    perms,
    roomStatus,
    isPlayerClient,
    techViewPlayerId: ui.techViewPlayerId,
  });
  const showTechBrowseModal = !!ui.showTechModal && !techResearch?.active;
  const showTechModal = showTechResearchModal || showTechBrowseModal;
  const expedition = game.expedition;
  const canClaimExpedition = !!(
    useTe
    && isGameActive
    && roundActive
    && activePlayer
    && !passed[activePlayer.id]
    && !expedition?.completed
    && !expedition?.awaitingControlPick
    && !game.round?.expeditionClaimedThisTurn
    && !strategyResolution?.active
    && !imperialClaim?.active
    && !techResearch?.active
    && (perms?.role === ROLES.ADMIN || perms?.seatPlayerId === activePlayer.id)
  );
  const canPickTeController = !!(
    useTe
    && expedition?.awaitingControlPick
    && (
      perms?.role === ROLES.ADMIN
      || (perms?.seatPlayerId != null && perms.seatPlayerId === expedition.placedById)
    )
  );
  const teLeaders = select.expeditionLeaders(game);
  const mySeatPlayer = isPlayerClient && perms?.seatPlayerId != null
    ? players.find(p => p.id === perms.seatPlayerId)
    : null;
  const myStartingTechResponse = mySeatPlayer && startingTechDraft?.active
    ? startingTechDraft.responses?.[mySeatPlayer.id]
    : null;
  const startingTechPlayerPending = !!(
    isPlayerClient
    && mySeatPlayer
    && startingTechDraft?.active
    && myStartingTechResponse
    && myStartingTechResponse.status !== 'confirmed'
  );
  const showStartingTechPlayerModal = startingTechPlayerPending
    && !ui.minimizedModals.startingTechPlayer;
  const isMyTurn = !!(
    isGameActive
    && mySeatPlayer
    && activePlayer
    && activePlayer.id === mySeatPlayer.id
    && !passed[mySeatPlayer.id]
  );
  useYourTurnAlert({ enabled: isPlayerClient && isGameActive, isYourTurn: isMyTurn });

  // Desktop: keep expedition dock available during TE games (non-blocking).
  // Mobile: open only via the header button.
  useEffect(() => {
    if (!useTe || !isGameActive) {
      setShowExpeditionModal(false);
      return undefined;
    }
    const mq = window.matchMedia('(min-width: 768px)');
    const syncDesktopDock = () => {
      if (mq.matches) setShowExpeditionModal(true);
      else setShowExpeditionModal(false);
    };
    syncDesktopDock();
    mq.addEventListener('change', syncDesktopDock);
    return () => mq.removeEventListener('change', syncDesktopDock);
  }, [useTe, isGameActive, setShowExpeditionModal]);

  const openExpeditionPanel = () => {
    ui.ensureExpanded('expedition');
    setShowExpeditionModal(true);
  };

  const playerMobileShell = isPlayerClient && isGameActive;
  useVisualViewportShell(playerMobileShell);

  // During objective scoring: tuck status checklist, open scoring modal.
  // When scoring finishes: restore the status checklist.
  useEffect(() => {
    if (objectiveScoring?.active) {
      ui.ensureMinimized('statusPhase');
      ui.ensureExpanded('objectiveScoring');
      return;
    }
    if (showStatusPhaseModal) {
      ui.ensureExpanded('statusPhase');
    }
  }, [objectiveScoring?.active, showStatusPhaseModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (strategyResolution?.active) {
      ui.ensureExpanded('strategyResolution');
    }
  }, [strategyResolution?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showStartingTechHostModal) {
      ui.ensureExpanded('startingTechDraft');
    }
  }, [showStartingTechHostModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showStartingTechPlayerModal) {
      ui.ensureExpanded('startingTechPlayer');
    }
  }, [startingTechDraft?.active, mySeatPlayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showImperialClaimModal) {
      ui.ensureExpanded('imperialClaim');
    }
  }, [showImperialClaimModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showTechResearchModal) {
      ui.ensureExpanded('techResearch');
      ui.setShowTechModal(false);
    }
  }, [showTechResearchModal]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveStrategy = (playerId, choice) => {
    dispatch({ type: 'RESOLVE_STRATEGY', playerId, choice });
  };

  const resetGameState = async () => {
    setSoloSetup(false);
    await resetLocalGame();
    ui.closeEndGameUi();
  };

  const hostSecretErrorMessage = (code) => {
    if (code === 'forbidden') return 'Неверный код доступа.';
    if (code === 'create-secret-not-configured') {
      return 'На сервере не задан ROOM_CREATE_SECRET. Добавьте его в Worker Secrets (не Pages) / .dev.vars.';
    }
    return null;
  };

  /** Prompt + server check for ROOM_CREATE_SECRET. Returns secret or null if cancelled/failed. */
  const unlockAsHost = async ({ title } = {}) => {
    const createSecret = await uiPrompt(
      'Введите код доступа',
      {
        title: title || 'Код доступа',
        inputType: 'password',
        placeholder: 'Код доступа',
        confirmLabel: 'Продолжить',
        variant: 'info',
      },
    );
    if (createSecret === null) return null;
    if (!String(createSecret).trim()) {
      await uiAlert('Код доступа не может быть пустым.', { title: 'Ошибка', variant: 'danger' });
      return null;
    }
    try {
      await verifyHostSecret(String(createSecret));
      return String(createSecret);
    } catch (err) {
      const code = String(err.message || err);
      await uiAlert(hostSecretErrorMessage(code) || `Не удалось проверить код: ${code}`, {
        title: 'Ошибка',
        variant: 'danger',
      });
      return null;
    }
  };

  const handleCreateRoom = async () => {
    setSoloSetup(false);
    const createSecret = await unlockAsHost({ title: 'Создать партию' });
    if (!createSecret) return;
    try {
      const created = await startHostRoom(createSecret);
      try {
        await navigator.clipboard.writeText(created.roomId);
      } catch {
        /* clipboard may be blocked */
      }
      await uiAlert(`Комната создана. Код: ${created.roomId}`, {
        title: 'Онлайн-комната',
        variant: 'success',
      });
    } catch (err) {
      const code = String(err.message || err);
      await uiAlert(
        hostSecretErrorMessage(code) || `Не удалось создать комнату: ${code}`,
        { title: 'Ошибка', variant: 'danger' },
      );
    }
  };

  const handlePlaySolo = async () => {
    const createSecret = await unlockAsHost({ title: 'Играть без комнаты' });
    if (!createSecret) return;
    setSoloSetup(true);
  };

  const handleImportGameToken = async (saveId) => {
    const createSecret = await unlockAsHost({ title: 'Загрузить партию' });
    if (!createSecret) return;
    return cloud.importGameToken(saveId);
  };

  const handleJoinRoom = async (code, joinOpts = {}) => {
    setSoloSetup(false);
    try {
      const joined = await joinRoomById(code, joinOpts);
      if (joined?.seatSecret) {
        await uiAlert(
          joined.reclaimed
            ? `Место перенесено на это устройство.\nКод места: ${joined.seatSecret}`
            : `Сохраните код места — он нужен, чтобы сесть сюда с другого устройства.\n\nКод места: ${joined.seatSecret}`,
          { title: joined.reclaimed ? 'Место перенесено' : 'Код места', variant: 'success' },
        );
      }
      return joined;
    } catch (err) {
      const codeErr = String(err.message || err);
      const message = codeErr === 'seat-secret-required'
        ? 'Место занято. Нужен код места (выдаётся при первом входе).'
        : codeErr === 'bad-seat-secret'
          ? 'Неверный код места.'
          : `Комната не найдена или недоступна: ${codeErr}`;
      await uiAlert(message, {
        title: 'Ошибка',
        variant: 'danger',
      });
      throw err;
    }
  };

  const handleLeaveRoom = () => {
    setSoloSetup(false);
    leaveRoom();
  };

  return (
    <div
      className={`max-w-[1800px] mx-auto flex flex-col text-slate-100 ${
        playerMobileShell
          ? 'player-app-frame min-h-screen max-md:min-h-0 md:relative md:h-auto md:max-h-none md:overflow-visible md:px-8 max-md:px-0'
          : 'min-h-screen px-3 md:px-8'
      }`}
    >
      <SyncStatusBanner
        roomError={hasRoomSession ? roomError : null}
        syncLink={hasRoomSession ? syncLink : 'idle'}
        onDismissError={dismissRoomError}
      />

      <GameHeader
        isGameActive={isGameActive}
        roundNumber={roundNumber}
        isPoliticsActive={isPoliticsActive}
        onTogglePolitics={() => dispatch({ type: 'TOGGLE_POLITICS_ACTIVE' })}
        roundActive={roundActive}
        isDraftLocked={isDraftLocked}
        canStartRound={canStartRound}
        onOpenDraft={() => dispatch({ type: 'OPEN_DRAFT' })}
        onStartRound={() => dispatch({ type: 'START_ROUND' })}
        onEndRound={() => dispatch({ type: 'END_ROUND' })}
        canEndRound={canEndRound}
        endRoundDisabledTitle={
          showStatusPhaseModal || objectiveScoring?.active
            ? 'Сначала завершите фазу статуса'
            : 'Сначала все игроки должны спасовать'
        }
        onExport={cloud.exportGameToken}
        onOpenEndGame={() => ui.setShowEndGameModal(true)}
        onOpenStats={cloud.openStatsModal}
        onOpenEventLog={() => ui.setShowEventLog(true)}
        onOpenExpedition={useTe ? openExpeditionPanel : undefined}
        onOpenTech={() => {
          ui.setTechViewPlayerId(perms?.seatPlayerId ?? activePlayer?.id ?? players[0]?.id ?? null);
          ui.setShowTechModal(true);
        }}
        onUndoLast={() => dispatch({ type: 'UNDO_LAST' })}
        canUndo={canUndo}
        turnOrder={turnOrder}
        activePlayer={activePlayer}
        passed={passed}
        strategyCards={strategyCards}
        allStrategiesPlayed={allStrategiesPlayed}
        strategyActionTaken={!!strategyActionTaken || !!imperialClaim?.active || !!techResearch?.active}
        strategyResolutionActive={!!strategyResolution?.active}
        resolvingCardId={strategyResolution?.cardId ?? null}
        imperialClaimActive={!!imperialClaim?.active}
        techResearchActive={!!techResearch?.active}
        onPlayStrategy={dialogs.playStrategyCard}
        turnTime={turnTime}
        onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
        onPassTurn={dialogs.passTurn}
        onOpenCombat={ui.openCombatModal}
        room={room}
        roomStatus={roomStatus}
        perms={perms}
        hideTurnBarOnMobile={isPlayerClient}
        onLeaveRoom={perms?.role === ROLES.VIEWER ? handleLeaveRoom : undefined}
      />

      <main
        className={`py-6 flex-grow space-y-8 ${
          playerMobileShell
            ? 'md:px-0 max-md:py-0 max-md:space-y-0 max-md:flex-1 max-md:min-h-0 max-md:overflow-hidden max-md:flex max-md:flex-col'
            : ''
        }`}
      >
        {showHub && (
          <RoomHub
            roomStatus={roomStatus}
            roomError={roomError}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onPlaySolo={handlePlaySolo}
            importGameToken={handleImportGameToken}
            uiPrompt={uiPrompt}
          />
        )}

        {showGuestLobby && (
          <GuestLobby
            room={room}
            players={players}
            roomError={roomError}
            onLeaveRoom={handleLeaveRoom}
          />
        )}

        {showAdminSetup && (
          <SetupScreen
            targetScore={targetScore}
            setTargetScore={(value) => dispatch({ type: 'SET_TARGET_SCORE', value })}
            usePok={usePok}
            setUsePok={(enabled) => dispatch({ type: 'SET_EXPANSION', expansion: 'pok', enabled })}
            useTe={useTe}
            setUseTe={(enabled) => dispatch({ type: 'SET_EXPANSION', expansion: 'te', enabled })}
            players={players}
            updatePlayer={(playerId, patch) => dispatch({ type: 'UPDATE_PLAYER', playerId, patch })}
            addPlayer={dialogs.addPlayer}
            removePlayer={(playerId) => dispatch({ type: 'REMOVE_PLAYER', playerId })}
            availableFactions={dialogs.availableFactions}
            isFactionTaken={(factionId, playerId) => select.isFactionTaken(game, factionId, playerId)}
            isColorTaken={(colorHex, playerId) => select.isColorTaken(game, colorHex, playerId)}
            handleStartGame={dialogs.handleStartGame}
            room={room}
            roomStatus={roomStatus}
            roomError={roomError}
            claimedSeats={room?.claimedSeats || []}
            onLeaveRoom={handleLeaveRoom}
            isSolo={soloSetup && !hasRoomSession}
          />
        )}

        {isGameActive && (
          <>
            {isPlayerClient && (
              <Suspense fallback={<BoardChunkFallback />}>
                <PlayerMobileConsole
                  me={mySeatPlayer}
                  seatSecret={room?.seatSecret || null}
                  activePlayer={activePlayer}
                  turnOrder={turnOrder}
                  players={players}
                  passed={passed}
                  strategyCards={strategyCards}
                  allStrategiesPlayed={allStrategiesPlayed}
                  strategyActionTaken={!!strategyActionTaken || !!imperialClaim?.active || !!techResearch?.active}
                  strategyResolutionActive={!!strategyResolution?.active || !!imperialClaim?.active || !!techResearch?.active}
                  resolvingCardId={strategyResolution?.cardId ?? null}
                  turnTime={turnTime}
                  onPlayStrategy={dialogs.playStrategyCard}
                  onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
                  onPassTurn={dialogs.passTurn}
                  getPlayerScore={getPlayerScore}
                  targetScore={targetScore}
                  speakerId={speakerId}
                  objectives={objectives}
                  completions={completions}
                  scoring={objectiveScoring}
                  onSelectPublic={(playerId, objectiveId) => dispatch({ type: 'SELECT_SCORING_PUBLIC', playerId, objectiveId })}
                  onToggleSecret={(playerId) => dispatch({ type: 'TOGGLE_SCORING_SECRET', playerId })}
                  onConfirmScoring={(playerId) => dispatch({ type: 'CONFIRM_OBJECTIVE_SCORING', playerId })}
                  onPassScoring={(playerId) => dispatch({ type: 'PASS_OBJECTIVE_SCORING', playerId })}
                  roundActive={roundActive}
                  canPlay={!!mySeatPlayer && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)}
                  canNextTurn={
                    !!mySeatPlayer
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                    && !strategyResolution?.active
                    && !imperialClaim?.active
                    && !techResearch?.active
                  }
                  onOpenProduction={() => ui.setShowProductionCalculator(true)}
                  usePok={usePok}
                  useTe={useTe}
                />
              </Suspense>
            )}
            <div className={isPlayerClient ? 'hidden md:block' : undefined}>
              <Suspense fallback={<BoardChunkFallback />}>
                <GameBoard
                turnOrder={turnOrder}
                passed={passed}
                activePlayer={activePlayer}
                sortedPlayersForBoard={sortedPlayersForBoard}
                getPlayerScore={getPlayerScore}
                players={players}
                adjustSecrets={(playerId, delta) => dispatch({ type: 'ADJUST_SECRETS', playerId, delta })}
                adjustMecatol={(playerId, delta) => dispatch({ type: 'ADJUST_MECATOL', playerId, delta })}
                vpTrack={game.vpTrack}
                setCustodians={(playerId) => dispatch({ type: 'SET_CUSTODIANS', playerId })}
                setSupport={(fromPlayerId, holderPlayerId) => dispatch({
                  type: 'SET_SUPPORT',
                  fromPlayerId,
                  holderPlayerId,
                })}
                objectives={objectives}
                completions={completions}
                toggleCompletion={(playerId, objectiveId) => dispatch({ type: 'TOGGLE_COMPLETION', playerId, objectiveId })}
                scoring={objectiveScoring}
                expandedObjectives={ui.expandedObjectives}
                toggleExpand={ui.toggleExpand}
                removeObjective={(objectiveId) => dispatch({ type: 'REMOVE_OBJECTIVE', objectiveId })}
                addRandomObjective={dialogs.addRandomObjective}
                addCustomObjective={dialogs.addCustomObjective}
                targetScore={targetScore}
                speakerId={speakerId}
                handleAddSecret={dialogs.handleAddSecret}
                eliminatePlayer={dialogs.eliminatePlayer}
                setSpeaker={
                  perms?.role === ROLES.ADMIN
                    ? (playerId) => dispatch({ type: 'SET_SPEAKER', playerId })
                    : undefined
                }
                onOpenPlayerTech={(playerId) => {
                  ui.setTechViewPlayerId(playerId);
                  ui.setShowTechModal(true);
                }}
                releaseSeat={
                  perms?.isLive && perms?.role === ROLES.ADMIN
                    ? async (playerId) => {
                      const ok = await uiConfirm(
                        'Освободить место? Игрок на устройстве будет отключён, код места сбросится — можно занять место заново без старого кода.',
                        { title: 'Освободить место', confirmLabel: 'Освободить', variant: 'danger' },
                      );
                      if (!ok) return;
                      try {
                        await releaseSeatById(playerId);
                      } catch (err) {
                        await uiAlert(`Не удалось освободить место: ${err.message || err}`, {
                          title: 'Ошибка',
                          variant: 'danger',
                        });
                      }
                    }
                    : undefined
                }
                claimedSeats={room?.claimedSeats || []}
                isGameActive={isGameActive}
                perms={perms}
              />
              </Suspense>
            </div>
          </>
        )}

        <LazyWhen active={showStatusPhaseModal}>
          <StatusPhaseModal
            show={showStatusPhaseModal}
            minimized={!!ui.minimizedModals.statusPhase}
            roundNumber={roundNumber}
            checks={statusPhaseChecks}
            scoring={objectiveScoring}
            players={players}
            onCheck={(key) => dispatch({ type: 'TOGGLE_STATUS_CHECK', key })}
            onStartScoring={() => {
              ui.ensureMinimized('statusPhase');
              dispatch({ type: 'START_OBJECTIVE_SCORING' });
            }}
            onConfirm={() => dispatch({ type: 'CONFIRM_STATUS_PHASE' })}
            onClose={() => dispatch({ type: 'SET_STATUS_PHASE_VISIBLE', visible: false })}
            onMinimize={() => ui.toggleMinimize('statusPhase')}
            readOnly={!perms.can('statusPhase')}
          />
        </LazyWhen>

        <LazyWhen active={!!objectiveScoring?.active}>
          <ObjectiveScoringModal
            show={!!objectiveScoring?.active}
            minimized={!!ui.minimizedModals.objectiveScoring}
            players={players}
            objectives={objectives}
            completions={completions}
            scoring={objectiveScoring}
            seatPlayerId={perms?.seatPlayerId ?? null}
            canScoreAny={perms.can('scoreAny')}
            onSelectPublic={(playerId, objectiveId) => dispatch({ type: 'SELECT_SCORING_PUBLIC', playerId, objectiveId })}
            onToggleSecret={(playerId) => dispatch({ type: 'TOGGLE_SCORING_SECRET', playerId })}
            onConfirm={(playerId) => dispatch({ type: 'CONFIRM_OBJECTIVE_SCORING', playerId })}
            onPass={(playerId) => dispatch({ type: 'PASS_OBJECTIVE_SCORING', playerId })}
            onMinimize={() => ui.toggleMinimize('objectiveScoring')}
            onClose={() => ui.ensureMinimized('objectiveScoring')}
          />
        </LazyWhen>

        <LazyWhen active={showImperialClaimModal}>
          <ImperialClaimModal
            show={showImperialClaimModal}
            minimized={!!ui.minimizedModals.imperialClaim}
            claim={imperialClaim}
            players={players}
            objectives={objectives}
            completions={completions}
            seatPlayerId={perms?.seatPlayerId ?? null}
            canScoreAny={perms.can('scoreAny')}
            onSelectPublic={(playerId, objectiveId) => dispatch({ type: 'SELECT_IMPERIAL_PUBLIC', playerId, objectiveId })}
            onToggleMecatol={(playerId) => dispatch({ type: 'TOGGLE_IMPERIAL_MECATOL', playerId })}
            onToggleSecret={(playerId) => dispatch({ type: 'TOGGLE_IMPERIAL_SECRET', playerId })}
            onConfirm={(playerId) => dispatch({ type: 'CONFIRM_IMPERIAL_CLAIM', playerId })}
            onPass={(playerId) => dispatch({ type: 'PASS_IMPERIAL_CLAIM', playerId })}
            onMinimize={() => ui.toggleMinimize('imperialClaim')}
            onClose={() => ui.ensureMinimized('imperialClaim')}
          />
        </LazyWhen>

        <LazyWhen active={showTechModal}>
          <TechModal
            show={showTechModal}
            minimized={!!ui.minimizedModals.techResearch && showTechResearchModal}
            session={showTechResearchModal ? techResearchView : null}
            players={players}
            viewPlayerId={ui.techViewPlayerId}
            seatPlayerId={perms?.seatPlayerId ?? null}
            usePok={usePok}
            useTe={useTe}
            isHost={perms?.role === ROLES.ADMIN || roomStatus === 'solo'}
            canEdit={
              roomStatus === 'solo'
              || perms?.role === ROLES.ADMIN
            }
            canResearchAct={perms?.role === ROLES.ADMIN || roomStatus === 'solo'}
            pendingPlayerIds={
              techResolutionActive
                ? players
                  .filter(p => strategyResolution.responses?.[p.id] === 'pending')
                  .map(p => p.id)
                : null
            }
            onSelectViewPlayer={(id) => ui.setTechViewPlayerId(id)}
            onResearch={(playerId, techId, opts = {}) => dispatch({
              type: 'RESEARCH_TECH',
              playerId,
              techId,
              force: !!opts.force,
              ignorePrereq: opts.ignorePrereq ? 1 : 0,
            })}
            onPass={(playerId) => dispatch({ type: 'PASS_TECH_RESEARCH', playerId })}
            onGrantTech={(playerId, techId) => dispatch({ type: 'GRANT_TECH', playerId, techId })}
            onRevokeTech={(playerId, techId) => dispatch({ type: 'REVOKE_TECH', playerId, techId })}
            onGrantBreakthrough={(playerId) => dispatch({ type: 'GRANT_BREAKTHROUGH', playerId })}
            onRevokeBreakthrough={(playerId) => dispatch({ type: 'REVOKE_BREAKTHROUGH', playerId })}
            onMinimize={() => {
              if (showTechResearchModal) ui.toggleMinimize('techResearch');
              else ui.setShowTechModal(false);
            }}
            onClose={() => {
              if (showTechResearchModal) ui.ensureMinimized('techResearch');
              else ui.setShowTechModal(false);
            }}
          />
        </LazyWhen>

        <LazyWhen active={cloud.showStatsModal}>
          <StatsModal
            showStatsModal={cloud.showStatsModal}
            setShowStatsModal={cloud.setShowStatsModal}
            isStatsLoading={cloud.isStatsLoading}
            globalHistory={cloud.globalHistory}
            deleteSingleGame={cloud.deleteSingleGame}
            clearAllStats={cloud.clearAllStats}
          />
        </LazyWhen>

        <LazyWhen active={ui.showEndGameModal}>
          <EndGameModal
            showEndGameModal={ui.showEndGameModal}
            setShowEndGameModal={ui.setShowEndGameModal}
            players={players}
            getPlayerScore={getPlayerScore}
            saveGameToCloud={cloud.saveGameToCloud}
            setShowGameSummaryModal={ui.setShowGameSummaryModal}
            resetGameState={resetGameState}
          />
        </LazyWhen>

        <LazyWhen active={showDraftModal}>
          <DraftModal
            showDraftModal={showDraftModal}
            minimizedModals={ui.minimizedModals}
            toggleMinimize={ui.toggleMinimize}
            setShowDraftModal={(visible) => dispatch({ type: 'SET_DRAFT_VISIBLE', visible })}
            draftStep={draftStep}
            draftQueue={draftQueue}
            players={activePlayers}
            currentQueueIndex={currentQueueIndex}
            draftAssignments={draftAssignments}
            draftPickOrder={draftPickOrder}
            strategyCardBonuses={strategyCardBonuses}
            handleSelectCard={(cardId) => dispatch({ type: 'PICK_CARD', cardId })}
            handleUndoLastPick={() => dispatch({ type: 'UNDO_PICK' })}
            handleReassignCard={(cardId, playerId) => dispatch({ type: 'REASSIGN_CARD', cardId, playerId })}
            confirmDraft={() => dispatch({ type: 'CONFIRM_DRAFT' })}
            perms={perms}
          />
        </LazyWhen>

        <LazyWhen active={showPoliticsModal}>
          <PoliticsModal
            show={showPoliticsModal}
            minimized={!!ui.minimizedModals.politics}
            onMinimize={() => ui.toggleMinimize('politics')}
            onClose={() => dispatch({ type: 'SET_POLITICS_VISIBLE', visible: false })}
            politicsStep={politicsStep}
            setPoliticsStep={(step) => dispatch({ type: 'SET_POLITICS_STEP', step })}
            agendas={agendas}
            currentAgendaIndex={currentAgendaIndex}
            activePlayers={activePlayers}
            speakerId={speakerId}
            onSetAgendaType={(agendaType) => dispatch({ type: 'SET_AGENDA_TYPE', agendaType })}
            onSetCustomChoices={(choices) => dispatch({ type: 'SET_AGENDA_CUSTOM_CHOICES', choices })}
            onSetVote={(playerId, vote) => dispatch({ type: 'SET_VOTE', playerId, vote })}
            onLockVote={(playerId) => dispatch({ type: 'LOCK_VOTE', playerId })}
            onSetInfluence={(playerId, influence) => dispatch({ type: 'SET_INFLUENCE', playerId, influence })}
            onLockInfluence={(playerId) => dispatch({ type: 'LOCK_INFLUENCE', playerId })}
            onUnlockInfluence={(playerId) => dispatch({ type: 'UNLOCK_INFLUENCE', playerId })}
            onToggleVoteReversed={() => dispatch({ type: 'TOGGLE_VOTE_REVERSED' })}
            onSetSpeaker={(playerId) => dispatch({ type: 'SET_SPEAKER', playerId })}
            onNextAgenda={() => dispatch({ type: 'NEXT_AGENDA' })}
            onFinish={(playerId) => dispatch({ type: 'FINISH_AGENDA_PHASE', playerId })}
            voteOrder={select.votingOrder(game)}
            currentVoterId={select.currentVoterId(game)}
            influenceLocked={influenceLocked || {}}
            voteReversed={!!voteReversed}
            allInfluenceLocked={select.allInfluenceLocked(game)}
            perms={perms}
            readOnly={perms.role === 'viewer'}
            game={game}
          />
        </LazyWhen>

        <LazyWhen active={ui.showCombatModal}>
          <CombatModal
            show={ui.showCombatModal}
            minimized={!!ui.minimizedModals.combat}
            onMinimize={() => ui.toggleMinimize('combat')}
            onClose={() => ui.setShowCombatModal(false)}
            activePlayer={activePlayer}
            activePlayers={activePlayers}
            onRecordDamage={(damageByPlayerId) => dispatch({ type: 'ADD_COMBAT_DAMAGE', damageByPlayerId })}
            combatOpponentId={ui.combatOpponentId}
            setCombatOpponentId={ui.setCombatOpponentId}
            combatHits={ui.combatHits}
            setCombatHits={ui.setCombatHits}
            combatRound={ui.combatRound}
            setCombatRound={ui.setCombatRound}
            totalCombatDamage={ui.totalCombatDamage}
            setTotalCombatDamage={ui.setTotalCombatDamage}
            readOnly={!perms.can('combat')}
          />
        </LazyWhen>

        <LazyWhen active={ui.showSpeakerSelectionModal}>
          <SpeakerSelectionModal
            show={ui.showSpeakerSelectionModal}
            activePlayer={activePlayer}
            activePlayers={activePlayers}
            onSelectSpeaker={(playerId) => {
              dispatch({ type: 'SET_SPEAKER', playerId });
              dispatch({ type: 'PLAY_STRATEGY', cardId: 3 });
              ui.setShowSpeakerSelectionModal(false);
            }}
            readOnly={
              !perms.can('politics')
              && !(perms.can('playTurn') && perms.seatPlayerId != null && activePlayer?.id === perms.seatPlayerId)
            }
          />
        </LazyWhen>

        <LazyWhen active={!!strategyResolution?.active && !isPlayerClient}>
          <StrategyResolutionModal
            show={!!strategyResolution?.active && !isPlayerClient}
            minimized={!!ui.minimizedModals.strategyResolution}
            resolution={strategyResolution}
            players={players}
            canResolveAny={perms.can('phases') || perms.role === ROLES.ADMIN}
            onResolve={resolveStrategy}
            onMinimize={() => ui.toggleMinimize('strategyResolution')}
            onClose={() => ui.ensureMinimized('strategyResolution')}
          />
        </LazyWhen>

        <StartingTechDraftBanner
          show={showStartingTechBanner}
          count={startingTechNeeders.length}
          onStart={() => dispatch({ type: 'START_STARTING_TECH_DRAFT' })}
        />

        <LazyWhen active={showStartingTechHostModal}>
          <StartingTechDraftModal
            show={showStartingTechHostModal}
            minimized={!!ui.minimizedModals.startingTechDraft}
            game={game}
            players={players}
            canAct={perms.can('phases') || perms.role === ROLES.ADMIN || roomStatus === 'solo'}
            onSetPicks={(playerId, picks) => dispatch({
              type: 'SET_STARTING_TECH_PICK',
              playerId,
              picks,
            })}
            onConfirm={(playerId) => dispatch({ type: 'CONFIRM_STARTING_TECH', playerId })}
            onMinimize={() => ui.toggleMinimize('startingTechDraft')}
            onClose={() => ui.ensureMinimized('startingTechDraft')}
          />
        </LazyWhen>

        <LazyWhen active={showStartingTechPlayerModal}>
          <StartingTechPlayerModal
            show={showStartingTechPlayerModal}
            player={mySeatPlayer}
            game={game}
            onSetPicks={(playerId, picks) => dispatch({
              type: 'SET_STARTING_TECH_PICK',
              playerId,
              picks,
            })}
            onConfirm={(playerId) => dispatch({ type: 'CONFIRM_STARTING_TECH', playerId })}
            onMinimize={() => ui.ensureMinimized('startingTechPlayer')}
          />
        </LazyWhen>

        {isPlayerClient && perms?.seatPlayerId != null && (
          <StrategyResolutionBanner
            show={!!strategyResolution?.active && strategyResolution.cardId !== 7}
            cardId={strategyResolution?.cardId}
            myStatus={strategyResolution?.responses?.[perms.seatPlayerId]}
            onResolve={(choice) => resolveStrategy(perms.seatPlayerId, choice)}
          />
        )}

        <LazyWhen active={!!ui.showProductionCalculator}>
          <ProductionCalculatorModal
            show={!!ui.showProductionCalculator}
            playerColor={mySeatPlayer?.color || activePlayer?.color}
            playerName={mySeatPlayer?.name || activePlayer?.name}
            factionId={mySeatPlayer?.factionId || activePlayer?.factionId || null}
            techIds={mySeatPlayer?.techIds || activePlayer?.techIds || []}
            onClose={() => ui.setShowProductionCalculator(false)}
          />
        </LazyWhen>

        <LazyWhen active={!!ui.showEventLog}>
          <EventLogModal
            show={!!ui.showEventLog}
            onClose={() => ui.setShowEventLog(false)}
            events={game.log?.events}
            players={players}
          />
        </LazyWhen>

        <LazyWhen active={!!ui.showExpeditionModal && useTe}>
          <ExpeditionModal
            show={!!ui.showExpeditionModal && useTe}
            minimized={!!ui.minimizedModals.expedition}
            expedition={expedition}
            players={players}
            activePlayer={activePlayer}
            seatPlayerId={perms?.seatPlayerId ?? null}
            canClaim={canClaimExpedition}
            claimedThisTurn={!!game.round?.expeditionClaimedThisTurn}
            canPickController={canPickTeController}
            canEdit={roomStatus === 'solo' || perms?.role === ROLES.ADMIN}
            leaders={teLeaders}
            onClaimSlice={(playerId, sliceId) => dispatch({ type: 'CLAIM_EXPEDITION_SLICE', playerId, sliceId })}
            onSetSlice={(sliceId, playerId) => dispatch({
              type: 'SET_EXPEDITION_SLICE',
              sliceId,
              playerId,
            })}
            onPickController={(playerId, controllerId) => dispatch({
              type: 'RESOLVE_THUNDERS_EDGE_CONTROL',
              playerId,
              controllerId,
            })}
            onMinimize={() => ui.toggleMinimize('expedition')}
            onClose={() => {
              ui.ensureExpanded('expedition');
              ui.setShowExpeditionModal(false);
            }}
          />
        </LazyWhen>

        <LazyWhen active={ui.showGameSummaryModal}>
          <GameSummaryModal
            show={ui.showGameSummaryModal}
            onClose={() => { ui.setShowGameSummaryModal(false); }}
          />
        </LazyWhen>      </main>

      {isGameActive && (
        <button
          type="button"
          onClick={() => ui.setShowProductionCalculator(true)}
          className={`fixed z-40 items-center gap-2 rounded-xl border border-cyan-700 bg-slate-900/95 px-3 py-2.5 text-xs font-bold text-cyan-300 shadow-lg hover:bg-slate-800 transition left-4 bottom-4 ${
            isPlayerClient ? 'hidden md:flex' : 'flex'
          }`}
          title="Калькулятор производства"
        >
          <i className="fa-solid fa-industry" aria-hidden="true" />
          <span>Производство</span>
        </button>
      )}

      <MinimizedModalControls
        minimizedModals={ui.minimizedModals}
        showDraftModal={showDraftModal && (draftStep !== 'CONFIRM' || perms.can('confirmDraft'))}
        showPoliticsModal={showPoliticsModal && (politicsStep !== 'SPEAKER' || perms.can('politics'))}
        showCombatModal={ui.showCombatModal}
        showStatusPhaseModal={showStatusPhaseModal}
        scoringActive={!!objectiveScoring?.active}
        strategyResolutionActive={!!strategyResolution?.active && !isPlayerClient}
        imperialClaimActive={showImperialClaimModal}
        techResearchActive={showTechResearchModal}
        expeditionActive={false}
        startingTechDraftActive={showStartingTechHostModal}
        startingTechPlayerActive={startingTechPlayerPending}
        onRestore={ui.toggleMinimize}
      />
      <AppDialog dialog={dialog} onClose={close} />
    </div>
  );
}

export default App;
