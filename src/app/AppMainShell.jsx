/* Split from App.jsx — hub / setup / live-game chrome + modals. */
import { Suspense } from 'react';
import * as select from '../game/selectors';
import { ROLES } from '../sync/permissions';
import { buildPhaseHub } from './phaseHub';
import { GameHeader } from '../components/GameHeader';
import { ActiveTurnBar } from '../components/ActiveTurnBar';
import { DevToolsPanel } from '../components/DevToolsPanel';
import { MinimizedModalControls } from '../components/MinimizedModalControls';
import { LazyWhen } from '../components/LazyWhen';
import { RoomHub } from '../components/RoomHub';
import { GuestLobby } from '../components/GuestLobby';
import { SetupScreen } from '../components/SetupScreen';
import { HubCosmosBackdrop } from '../components/HubCosmosBackdrop';
import { StrategyResolutionBanner } from '../components/StrategyResolutionBanner';
import { StartingTechDraftBanner } from '../components/StartingTechDraftBanner';
import { SecretDealBanner } from '../components/SecretDealBanner';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { PushNotificationsSheet } from '../components/PushNotificationsSheet';
import { VictoryLockBanner } from '../components/VictoryLockBanner';
import { canStartSecretDraft, nextSecretReceiveSeat } from '../game/secretDeck';
import { secretObjectiveById } from '../data/secretObjectives';

export function BoardChunkFallback() {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center text-slate-400 text-sm">
      Загрузка доски…
    </div>
  );
}

export function openStatsTab() {
  window.open(`${window.location.origin}/stats`, '_blank', 'noopener,noreferrer');
}

export function AppMainShell(p) {
  const {
    ActiveLawsSheet,
    AppDialog,
    BLOCKING_MODAL_IDS,
    BoardChunkFallback,
    CombatModal,
    DraftModal,
    EndGameModal,
    EventLogModal,
    ExpeditionModal,
    GameBoard,
    GameSummaryModal,
    ImperialClaimModal,
    MiltyDraftPage,
    ObjectiveScoringModal,
    PlayerMobileConsole,
    PoliticsModal,
    PoliticsPeekModal,
    ProductionCalculatorModal,
    ROLES,
    ScoredSecretsModal,
    SecretDraftModal,
    SecretReceiveModal,
    SpeakerSelectionModal,
    StartingTechDraftModal,
    StartingTechPlayerModal,
    StatusPhaseModal,
    StrategyResolutionModal,
    TechModal,
    ViewerMobileConsole,
    activeLaws,
    activePlayer,
    activePlayers,
    agendas,
    allStrategiesPlayed,
    canClaimExpedition,
    canEndRound,
    canPickTeController,
    canStartRound,
    canUndo,
    claimHostSeatById,
    cloud,
    close,
    combat,
    combatActive,
    combatSessionTime,
    completions,
    currentAgendaIndex,
    currentQueueIndex,
    dialog,
    dialogs,
    dismissRoomError,
    dispatch,
    draftAssignments,
    draftPickOrder,
    draftPickStartedAt,
    draftQueue,
    draftStep,
    expedition,
    game,
    getPlayerScore,
    handleClaimHost,
    handleCreateRoom,
    handleCreateWithMilty,
    handleImportGameToken,
    handleJoinRoom,
    handleLeaveRoom,
    handleOpenMilty,
    handlePlaySolo,
    hasRoomSession,
    hostPoliticsPeekOpen,
    imperialClaim,
    influenceLocked,
    isDraftLocked,
    isGameActive,
    isHostClient,
    isLive,
    isPlayerClient,
    isPoliticsActive,
    isPoliticsPeekActor,
    isViewerClient,
    miltyLiveDraft,
    mobileShell,
    mySeatPlayer,
    navigate,
    objectiveScoring,
    objectives,
    oneVoteLaw,
    openExpeditionPanel,
    openPhaseModal,
    openStatsTab,
    passed,
    perms,
    players,
    politicsStep,
    promoteMiltyToSetup,
    pushNotify,
    releaseSeatById,
    resetGameState,
    resolveStrategy,
    resumeLiveSync,
    room,
    roomError,
    roomShare,
    roomStatus,
    roundActive,
    roundNumber,
    roundTime,
    secretDraftPending,
    secretExchangeUsed,
    secretOverflow,
    secretPendingReveal,
    secretReceivePlayer,
    secretReceivePlayerId,
    secretScoreNotice,
    setHostPoliticsPeekRestored,
    setSecretScoreNotice,
    setShowActiveLaws,
    setShowExpeditionModal,
    setShowPushSettings,
    setShowScoredSecrets,
    showActiveGame,
    showActiveLaws,
    showAdminSetup,
    showDraftModal,
    showGuestLobby,
    showHub,
    showImperialClaimModal,
    showMiltyPhase,
    showPoliticsModal,
    showPushSettings,
    showRoomBoot,
    showScoredSecrets,
    showSecretDealBanner,
    showSecretDraftHostModal,
    showSecretDraftPlayerModal,
    showSecretReceiveModal,
    showStartingTechBanner,
    showStartingTechHostModal,
    showStartingTechPlayerModal,
    showStatusPhaseModal,
    showTechModal,
    showTechResearchModal,
    soloSetup,
    sortedPlayersForBoard,
    speakerId,
    spotlightObjectiveId,
    spotlightReady,
    startingTechDraft,
    startingTechNeeders,
    startingTechPlayerPending,
    statusPhaseChecks,
    strategyActionTaken,
    strategyCardBonuses,
    strategyCards,
    strategyResolution,
    syncLink,
    targetScore,
    teLeaders,
    techResearch,
    techResearchView,
    techResolutionActive,
    turnOrder,
    turnTime,
    ui,
    uiAlert,
    uiConfirm,
    uiPrompt,
    usePok,
    useTe,
    victoryLocked,
    voteReversed,
    winners
  } = p;

  const fullBleedShell = showHub || showAdminSetup || showGuestLobby || showMiltyPhase || showRoomBoot || showActiveGame;

  return (
    <div
      className={`${fullBleedShell ? 'w-full max-w-none' : 'max-w-[1800px] mx-auto'} flex flex-col text-slate-100 ${
        mobileShell
          ? 'player-app-frame game-shell min-h-screen max-md:min-h-0 md:relative md:h-auto md:max-h-none md:overflow-visible md:px-8 max-md:px-0'
          : fullBleedShell
            ? `min-h-screen px-0${showActiveGame ? ' game-shell' : ''}`
            : 'min-h-screen px-3 md:px-8'
      }`}
    >
      {showActiveGame && <HubCosmosBackdrop />}
      <SyncStatusBanner
        roomError={hasRoomSession ? roomError : null}
        syncLink={hasRoomSession ? syncLink : 'idle'}
        hostOnline={hasRoomSession ? room?.hostOnline !== false : true}
        onDismissError={dismissRoomError}
        onReconnect={hasRoomSession ? () => resumeLiveSync({ forceSse: true }) : undefined}
      />

      {victoryLocked && showActiveGame && (
        <VictoryLockBanner
          winners={winners}
          targetScore={targetScore}
          isHost={isHostClient}
          canUndo={canUndo}
          onUndo={() => dispatch({ type: 'UNDO_LAST' })}
        />
      )}

      {import.meta.env.DEV && isHostClient && isGameActive && !victoryLocked && (
        <DevToolsPanel
          canSkipDraft={
            !roundActive
            && (!canStartRound || select.isDraftInProgress(game))
          }
          canPassAll={
            !!roundActive
            && !showStatusPhaseModal
            && !objectiveScoring?.active
            && !combatActive
            && !strategyResolution?.active
            && !imperialClaim?.active
            && !techResearch?.active
          }
          canSkipStatus={!!showStatusPhaseModal || !!objectiveScoring?.active}
          canSkipSecretDraft={!!game.secretObjectives?.draftPending}
          onSkipDraft={() => dispatch({ type: 'DEV_SKIP_STRATEGY_DRAFT' })}
          onPassAll={() => dispatch({ type: 'DEV_PASS_ALL' })}
          onSkipStatus={() => dispatch({ type: 'DEV_SKIP_STATUS_PHASE' })}
          onSkipSecretDraft={() => dispatch({ type: 'DEV_SKIP_SECRET_DRAFT' })}
        />
      )}

      {/* Keep header (wifi + room/host codes) for live setup and active game.
          Previously hidden for all showAdminSetup — host lost the wifi control. */}
      {!showHub && !showRoomBoot && !showMiltyPhase && !showGuestLobby
        && !(showAdminSetup && !room?.roomId) && (
        <GameHeader
          isGameActive={isGameActive}
          roundNumber={roundNumber}
          roundTime={roundTime}
          isPoliticsActive={isPoliticsActive}
          onTogglePolitics={() => dispatch({ type: 'TOGGLE_POLITICS_ACTIVE' })}
          roundActive={roundActive}
          isDraftLocked={isDraftLocked}
          canStartRound={canStartRound && !victoryLocked}
          onOpenDraft={() => dispatch({ type: 'OPEN_DRAFT' })}
          onStartRound={() => dispatch({ type: 'START_ROUND' })}
          onEndRound={() => dispatch({ type: 'END_ROUND' })}
          canEndRound={canEndRound && !victoryLocked}
          victoryLocked={victoryLocked}
          endRoundDisabledTitle={
            victoryLocked
              ? 'Партия остановлена — достигнута цель ПО'
              : showStatusPhaseModal || objectiveScoring?.active
                ? 'Сначала завершите фазу статуса'
                : 'Сначала все игроки должны спасовать'
          }
          onExport={cloud.exportGameToken}
          onOpenEndGame={() => ui.setShowEndGameModal(true)}
          onOpenStats={openStatsTab}
          onOpenEventLog={() => ui.setShowEventLog(true)}
          onOpenActiveLaws={() => setShowActiveLaws(true)}
          activeLawsCount={(activeLaws || []).length}
          onOpenExpedition={useTe ? openExpeditionPanel : undefined}
          onOpenScoredSecrets={isGameActive ? () => setShowScoredSecrets(true) : undefined}
          onOpenTech={isViewerClient ? undefined : () => {
            ui.setTechViewPlayerId(perms?.seatPlayerId ?? activePlayer?.id ?? players[0]?.id ?? null);
            ui.setShowTechModal(true);
          }}
          onUndoLast={() => dispatch({ type: 'UNDO_LAST' })}
          canUndo={canUndo}
          onOpenCombat={() => {
            dispatch({ type: 'START_COMBAT' });
            ui.openCombatModal();
          }}
          room={room}
          roomShare={roomShare}
          roomStatus={roomStatus}
          perms={perms}
          compactBrand={isPlayerClient || isViewerClient}
          onLeaveRoom={perms?.role === ROLES.VIEWER ? handleLeaveRoom : undefined}
          canUsePush={!!pushNotify.canUse}
          onOpenPushSettings={() => setShowPushSettings(true)}
          onRepublishRoom={isGameActive && !room?.roomId ? handleCreateRoom : undefined}
        />
      )}

      <main
        className={`${showHub || showAdminSetup || showGuestLobby || showMiltyPhase || showRoomBoot ? 'flex-grow p-0' : `py-6 flex-grow space-y-6${showActiveGame ? ' px-3 md:px-8 max-w-[1800px] mx-auto w-full box-border' : ''}`} ${
          mobileShell
            ? 'md:px-0 max-md:py-0 max-md:space-y-0 max-md:flex-1 max-md:min-h-0 max-md:overflow-hidden max-md:flex max-md:flex-col'
            : ''
        }`}
      >
        {showRoomBoot && (
          <div className="hub-shell hub-shell--column min-h-screen relative isolate flex items-center justify-center">
            <HubCosmosBackdrop />
            <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
              <i className="fa-solid fa-spinner fa-spin text-2xl text-amber-200/90" aria-hidden="true" />
              <p className="font-['Montserrat'] text-sm font-semibold tracking-wide text-slate-300">
                Подключение к комнате…
              </p>
              {room?.roomId ? (
                <p className="font-mono text-xs text-amber-200/70 tracking-wider">{room.roomId}</p>
              ) : null}
            </div>
          </div>
        )}

        {showHub && (
          <RoomHub
            roomStatus={roomStatus}
            roomError={roomError}
            onCreateRoom={handleCreateRoom}
            onCreateWithMilty={handleCreateWithMilty}
            onJoinRoom={handleJoinRoom}
            onClaimHost={handleClaimHost}
            onPlaySolo={handlePlaySolo}
            importGameToken={handleImportGameToken}
            uiPrompt={uiPrompt}
            onOpenStats={openStatsTab}
            onOpenGuide={() => navigate('/guide')}
            onOpenMilty={handleOpenMilty}
          />
        )}

        {showMiltyPhase && room?.milty?.draftId && (
          <Suspense
            fallback={(
              <div className="min-h-screen flex items-center justify-center text-slate-400">
                <i className="fa-solid fa-spinner fa-spin text-2xl" aria-hidden="true" />
              </div>
            )}
          >
            <MiltyDraftPage
              liveDraftFromRoom={miltyLiveDraft}
              roomBinding={{
                roomId: room.roomId,
                draftId: room.milty.draftId,
                hostKey: room.hostKey,
                sessionToken: room.sessionToken,
                seatPlayerId: room.seatPlayerId,
                seatSecret: room.seatSecret,
                miltySecret: room.miltySecret,
                miltyAdminSecret: room.miltyAdminSecret,
                onPromote: async () => {
                  await promoteMiltyToSetup();
                  await uiAlert('Драфт перенесён в создание партии. Выберите цвета и запускайте.', {
                    title: 'На стол',
                    variant: 'success',
                  });
                },
                onHostClaimSeat: room.hostKey
                  ? async (seatPlayerId) => claimHostSeatById(seatPlayerId)
                  : null,
                onHostReleaseSeat: room.hostKey
                  ? async (seatPlayerId) => releaseSeatById(seatPlayerId)
                  : null,
                onLeave: handleLeaveRoom,
              }}
            />
          </Suspense>
        )}

        {showGuestLobby && (
          <GuestLobby
            room={room}
            players={players}
            roomError={roomError}
            onLeaveRoom={handleLeaveRoom}
            onPickColor={
              isPlayerClient && room?.seatPlayerId != null
                ? (color) => dispatch({
                  type: 'UPDATE_PLAYER',
                  playerId: room.seatPlayerId,
                  patch: { color },
                })
                : undefined
            }
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
            ensurePlayerCount={dialogs.ensurePlayerCount}
            removePlayer={(playerId) => dispatch({ type: 'REMOVE_PLAYER', playerId })}
            availableFactions={dialogs.availableFactions}
            isFactionTaken={(factionId, playerId) => select.isFactionTaken(game, factionId, playerId)}
            isColorTaken={(colorHex, playerId) => select.isColorTaken(game, colorHex, playerId)}
            handleStartGame={dialogs.handleStartGame}
            room={room}
            roomShare={roomShare}
            roomStatus={roomStatus}
            roomError={roomError}
            claimedSeats={room?.claimedSeats || []}
            onLeaveRoom={handleLeaveRoom}
            onOpenStats={openStatsTab}
            onPlaySolo={handlePlaySolo}
            importGameToken={handleImportGameToken}
            isSolo={soloSetup && !hasRoomSession}
            miltySeeded={room?.milty?.status === 'done'}
          />
        )}

        {showActiveGame && (
          <>
            {activePlayer
              && turnOrder.length > 0
              && !passed[activePlayer.id]
              && (perms?.role === ROLES.ADMIN || perms?.role === ROLES.PLAYER || perms?.role === ROLES.VIEWER)
              && (
              <div className={mobileShell ? 'hidden md:block' : undefined}>
                <ActiveTurnBar
                  activePlayer={activePlayer}
                  strategyCards={strategyCards}
                  allStrategiesPlayed={allStrategiesPlayed}
                  strategyActionTaken={!!strategyActionTaken || !!imperialClaim?.active || !!techResearch?.active}
                  strategyResolutionActive={
                    !!strategyResolution?.active || !!imperialClaim?.active || !!techResearch?.active
                  }
                  resolvingCardId={strategyResolution?.cardId ?? null}
                  onPlayStrategy={dialogs.playStrategyCard}
                  turnTime={turnTime}
                  onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
                  onPassTurn={dialogs.passTurn}
                  onOpenCombat={() => {
                    dispatch({ type: 'START_COMBAT' });
                    ui.openCombatModal();
                  }}
                  canPlay={
                    !victoryLocked
                    && !combatActive
                    && (perms?.role === ROLES.ADMIN || perms?.role === ROLES.PLAYER)
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                  }
                  canNextTurn={
                    !victoryLocked
                    && !combatActive
                    && (perms?.role === ROLES.ADMIN || perms?.role === ROLES.PLAYER)
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                    && !strategyResolution?.active
                    && !imperialClaim?.active
                    && !techResearch?.active
                  }
                  canCombat={perms?.role === ROLES.ADMIN && !victoryLocked}
                />
              </div>
            )}
            {isPlayerClient && (
              <Suspense fallback={<BoardChunkFallback />}>
                <PlayerMobileConsole
                  me={mySeatPlayer}
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
                  activeLaws={activeLaws || []}
                  objectives={objectives}
                  completions={completions}
                  scoring={objectiveScoring}
                  roundActive={roundActive}
                  canPlay={
                    !victoryLocked
                    && !!mySeatPlayer
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                  }
                  canNextTurn={
                    !victoryLocked
                    && !combatActive
                    && !!mySeatPlayer
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                    && !strategyResolution?.active
                    && !imperialClaim?.active
                    && !techResearch?.active
                  }
                  canCombat={
                    !victoryLocked
                    && !combatActive
                    && !!mySeatPlayer
                    && (!perms?.seatPlayerId || activePlayer?.id === perms.seatPlayerId)
                    && !strategyResolution?.active
                    && !imperialClaim?.active
                    && !techResearch?.active
                    && roundActive
                  }
                  combat={combat}
                  combatSessionTime={combatSessionTime}
                  onStartCombat={(defenderId) => dispatch({
                    type: 'START_COMBAT',
                    mode: 'pvp',
                    attackerId: mySeatPlayer?.id,
                    defenderId,
                  })}
                  onStartNeutral={() => dispatch({
                    type: 'START_COMBAT',
                    mode: 'neutral',
                    attackerId: mySeatPlayer?.id,
                  })}
                  onSetNeutralCounts={(counts) => dispatch({
                    type: 'COMBAT_SET_NEUTRAL_COUNTS',
                    counts,
                  })}
                  onBeginNeutral={(counts) => dispatch({
                    type: 'COMBAT_BEGIN_NEUTRAL',
                    counts,
                  })}
                  onCombatSetHits={(playerId, hits, extra) => dispatch({
                    type: 'COMBAT_SET_HITS',
                    playerId,
                    hits,
                    ...(extra?.neutralHits != null ? { neutralHits: extra.neutralHits } : {}),
                    ...(extra?.neutralRoll ? { neutralRoll: extra.neutralRoll } : {}),
                  })}
                  onCombatAssign={(playerId) => dispatch({
                    type: 'COMBAT_ASSIGN',
                    playerId,
                  })}
                  onCombatDeclareRetreat={(playerId) => dispatch({
                    type: 'COMBAT_DECLARE_RETREAT',
                    playerId,
                  })}
                  onCombatResolveRetreat={(success) => dispatch({
                    type: 'COMBAT_RESOLVE_RETREAT',
                    success: !!success,
                  })}
                  onCombatDefeat={(playerId) => dispatch({
                    type: 'COMBAT_DEFEAT',
                    playerId,
                  })}
                  onCombatDismissResult={() => dispatch({ type: 'END_COMBAT' })}
                  onOpenProduction={() => ui.setShowProductionCalculator(true)}
                  usePok={usePok}
                  useTe={useTe}
                  mecatolControllerId={game.vpTrack?.mecatolControllerId ?? null}
                  secretExchangeUsed={!!secretExchangeUsed}
                  onExchangeSecret={(playerId, cardId) => dispatch({
                    type: 'EXCHANGE_SECRET',
                    playerId,
                    cardId,
                  })}
                  isPoliticsActive={!!isPoliticsActive}
                  showPoliticsModal={!!showPoliticsModal}
                  statusPhaseShow={!!showStatusPhaseModal}
                  onScoreSecret={(playerId, cardId) => dispatch({
                    type: 'SCORE_SECRET',
                    playerId,
                    cardId,
                  })}
                  uiConfirm={uiConfirm}
                  phaseHub={buildPhaseHub({
                    showDraftModal,
                    showPoliticsModal,
                    strategyResolutionActive: !!strategyResolution?.active,
                    objectiveScoringActive: !!objectiveScoring?.active,
                    showStatusPhaseModal,
                    includeStatus: true,
                    openPhaseModal,
                  })}
                />
              </Suspense>
            )}
            {isViewerClient && (
              <Suspense fallback={<BoardChunkFallback />}>
                <ViewerMobileConsole
                  activePlayer={activePlayer}
                  turnOrder={turnOrder}
                  players={players}
                  passed={passed}
                  turnTime={turnTime}
                  getPlayerScore={getPlayerScore}
                  targetScore={targetScore}
                  speakerId={speakerId}
                  activeLaws={activeLaws || []}
                  objectives={objectives}
                  completions={completions}
                  scoring={objectiveScoring}
                  roundActive={roundActive}
                  strategyResolutionActive={!!strategyResolution?.active || !!imperialClaim?.active || !!techResearch?.active}
                  resolvingCardId={strategyResolution?.cardId ?? null}
                  usePok={usePok}
                  useTe={useTe}
                  phaseHub={buildPhaseHub({
                    showDraftModal,
                    showPoliticsModal,
                    strategyResolutionActive: !!strategyResolution?.active,
                    objectiveScoringActive: !!objectiveScoring?.active,
                    showStatusPhaseModal,
                    includeStatus: false,
                    openPhaseModal,
                  })}
                />
              </Suspense>
            )}
            <div className={(isPlayerClient || isViewerClient) ? 'hidden md:block' : undefined}>
              <Suspense fallback={<BoardChunkFallback />}>
                <GameBoard
                turnOrder={turnOrder}
                passed={passed}
                activePlayer={activePlayer}
                sortedPlayersForBoard={sortedPlayersForBoard}
                getPlayerScore={getPlayerScore}
                players={players}
                spotlightObjectiveId={spotlightObjectiveId}
                spotlightReady={spotlightReady}
                adjustMecatol={(playerId, delta) => dispatch({ type: 'ADJUST_MECATOL', playerId, delta })}
                vpTrack={game.vpTrack}
                setCustodians={(playerId) => dispatch({ type: 'SET_CUSTODIANS', playerId })}
                setMecatolController={(playerId) => dispatch({
                  type: 'SET_MECATOL_CONTROLLER',
                  playerId,
                })}
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
                removeObjective={dialogs.removeObjective}
                addRandomObjective={dialogs.addRandomObjective}
                addCustomObjective={dialogs.addCustomObjective}
                targetScore={targetScore}
                speakerId={speakerId}
                activeLaws={activeLaws || []}
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
                        'Освободить место? Игрок будет отключён. Место снова можно занять по коду комнаты — код места не нужен.',
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
                canRevealPublic={!!game.secretObjectives?.dealStarted}
                uiConfirm={uiConfirm}
                onRaiseSecretCap={(playerId) => dispatch({ type: 'RAISE_SECRET_CAP', playerId })}
              />
              </Suspense>
            </div>
          </>
        )}

        <LazyWhen active={showStatusPhaseModal && !isViewerClient}>
          <StatusPhaseModal
            show={showStatusPhaseModal && !isViewerClient}
            minimized={!!ui.minimizedModals.statusPhase}
            roundNumber={roundNumber}
            checks={statusPhaseChecks}
            scoring={objectiveScoring}
            players={players}
            onCheck={(key) => dispatch({ type: 'TOGGLE_STATUS_CHECK', key, at: Date.now() })}
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

        <LazyWhen active={!!objectiveScoring?.active && !isViewerClient}>
          <ObjectiveScoringModal
            show={!!objectiveScoring?.active && !isViewerClient}
            minimized={!!ui.minimizedModals.objectiveScoring}
            players={players}
            objectives={objectives}
            completions={completions}
            scoring={objectiveScoring}
            seatPlayerId={perms?.seatPlayerId ?? null}
            canScoreAny={!victoryLocked && perms.can('scoreAny')}
            uiConfirm={uiConfirm}
            onSelectPublic={(playerId, objectiveId) => dispatch({ type: 'SELECT_SCORING_PUBLIC', playerId, objectiveId })}
            onToggleSecret={(playerId, cardId) => dispatch({
              type: 'TOGGLE_SCORING_SECRET',
              playerId,
              cardId,
            })}
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
            canScoreAny={!victoryLocked && perms.can('scoreAny')}
            onSelectPublic={(playerId, objectiveId) => dispatch({ type: 'SELECT_IMPERIAL_PUBLIC', playerId, objectiveId })}
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
              ignorePrereq: opts.ignoreAll ? 'all' : (opts.ignorePrereq ? 1 : 0),
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

        <LazyWhen active={ui.showEndGameModal}>
          <EndGameModal
            showEndGameModal={ui.showEndGameModal}
            setShowEndGameModal={ui.setShowEndGameModal}
            game={game}
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
            pickStartedAt={draftPickStartedAt}
            getPlayerScore={getPlayerScore}
            targetScore={targetScore}
            objectives={objectives}
            completions={completions}
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
            onLockVote={(playerId, vote) => dispatch({ type: 'LOCK_VOTE', playerId, vote })}
            onSetInfluence={(playerId, influence, planets) => dispatch({
              type: 'SET_INFLUENCE',
              playerId,
              influence,
              ...(planets != null ? { planets } : {}),
            })}
            onLockInfluence={(playerId) => dispatch({ type: 'LOCK_INFLUENCE', playerId })}
            onUnlockInfluence={(playerId) => dispatch({ type: 'UNLOCK_INFLUENCE', playerId })}
            onToggleVoteReversed={() => dispatch({ type: 'TOGGLE_VOTE_REVERSED' })}
            onSetSpeaker={(playerId) => dispatch({ type: 'SET_SPEAKER', playerId })}
            onNextAgenda={() => dispatch({ type: 'NEXT_AGENDA' })}
            onSkipAgenda={() => dispatch({ type: 'SKIP_AGENDA' })}
            onRevealAgenda={() => dispatch({ type: 'REVEAL_AGENDA' })}
            onSelectMiscountLaw={(lawId) => dispatch({ type: 'SELECT_MISCOUNT_LAW', lawId })}
            onSpeakerAgendaDecision={(choice) => dispatch({
              type: 'SET_SPEAKER_AGENDA_DECISION',
              choice,
            })}
            onFinish={(playerId) => dispatch({ type: 'FINISH_AGENDA_PHASE', playerId })}
            activeLaws={activeLaws || []}
            voteOrder={select.votingOrder(game)}
            currentVoterId={select.currentVoterId(game)}
            influenceLocked={influenceLocked || {}}
            voteReversed={!!voteReversed}
            oneVoteLaw={!!oneVoteLaw}
            onToggleOneVoteLaw={() => dispatch({ type: 'TOGGLE_ONE_VOTE_LAW' })}
            allInfluenceLocked={select.allInfluenceLocked(game)}
            perms={perms}
            readOnly={perms.role === 'viewer'}
            game={game}
          />
        </LazyWhen>

        <LazyWhen active={showActiveLaws}>
          <ActiveLawsSheet
            show={showActiveLaws}
            onClose={() => setShowActiveLaws(false)}
            laws={activeLaws || []}
            players={players}
            canAdmin={isHostClient}
            onRemoveLaw={async (lawId) => {
              const law = (activeLaws || []).find((l) => String(l.id) === String(lawId));
              if (!law) return;
              const ok = await uiConfirm(
                `Убрать закон «${law.title}» из игры?`,
                { title: 'Удалить закон?', confirmLabel: 'Удалить', variant: 'danger' },
              );
              if (!ok) return;
              dispatch({ type: 'REMOVE_ACTIVE_LAW', lawId });
            }}
          />
        </LazyWhen>

        <LazyWhen active={showScoredSecrets}>
          <ScoredSecretsModal
            show={showScoredSecrets}
            onClose={() => setShowScoredSecrets(false)}
            players={players}
          />
        </LazyWhen>

        <LazyWhen active={ui.showCombatModal || (combatActive && perms?.role === ROLES.ADMIN)}>
          <CombatModal
            show={ui.showCombatModal || (combatActive && perms?.role === ROLES.ADMIN)}
            minimized={!!ui.minimizedModals.combat}
            onMinimize={() => ui.toggleMinimize('combat')}
            onClose={() => {
              if (combat?.active) {
                if (combat.phase === 'result') {
                  dispatch({ type: 'END_COMBAT' });
                } else {
                  dispatch({ type: 'COMBAT_DEFEAT' });
                }
              }
              ui.setShowCombatModal(false);
            }}
            activePlayer={
              combat?.attackerId != null
                ? players.find((p) => String(p.id) === String(combat.attackerId)) || activePlayer
                : activePlayer
            }
            activePlayers={activePlayers}
            combatSessionTime={combatSessionTime}
            combat={combat}
            onSetOpponent={(opts) => {
              if (opts?.neutral) {
                dispatch({ type: 'COMBAT_SET_OPPONENT', neutral: true });
                return;
              }
              if (opts?.clear) {
                dispatch({ type: 'COMBAT_SET_OPPONENT', clear: true });
                return;
              }
              dispatch({
                type: 'COMBAT_SET_OPPONENT',
                attackerId: activePlayer?.id,
                defenderId: opts?.defenderId,
              });
            }}
            onSetNeutralCounts={(counts) => dispatch({
              type: 'COMBAT_SET_NEUTRAL_COUNTS',
              counts,
            })}
            onBeginNeutral={(counts) => dispatch({
              type: 'COMBAT_BEGIN_NEUTRAL',
              counts,
            })}
            onSetHits={(playerId, hits, extra) => dispatch({
              type: 'COMBAT_SET_HITS',
              playerId,
              hits,
              ...(extra?.adjust ? { adjust: true } : {}),
              ...(extra?.neutralHits != null ? { neutralHits: extra.neutralHits } : {}),
              ...(extra?.neutralRoll ? { neutralRoll: extra.neutralRoll } : {}),
            })}
            onAssign={(playerId, extra) => dispatch({
              type: 'COMBAT_ASSIGN',
              playerId,
              ...(extra?.hostAdvance ? { hostAdvance: true } : {}),
              ...(extra?.counts ? { counts: extra.counts } : {}),
            })}
            onDeclareRetreat={(playerId) => dispatch({ type: 'COMBAT_DECLARE_RETREAT', playerId })}
            onResolveRetreat={(success) => dispatch({
              type: 'COMBAT_RESOLVE_RETREAT',
              success: !!success,
            })}
            onDefeat={(loserId) => dispatch({
              type: 'COMBAT_DEFEAT',
              ...(loserId != null ? { playerId: loserId } : {}),
            })}
            onRecordDamage={(damageByPlayerId) => dispatch({ type: 'ADD_COMBAT_DAMAGE', damageByPlayerId })}
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
            speakerId={speakerId}
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

        <LazyWhen active={!!strategyResolution?.active && strategyResolution.phase === 'peek' && !victoryLocked}>
          <PoliticsPeekModal
            show={
              !!strategyResolution?.active
              && strategyResolution.phase === 'peek'
              && !victoryLocked
              && (isPoliticsPeekActor || hostPoliticsPeekOpen)
            }
            minimized={isPoliticsPeekActor ? !!ui.minimizedModals.politicsPeek : false}
            cardIds={strategyResolution?.peekCards || []}
            canAct={isPoliticsPeekActor || perms?.role === ROLES.ADMIN}
            onConfirm={(placements) => dispatch({ type: 'COMMIT_POLITICS_PEEK', placements })}
            onMinimize={() => {
              setHostPoliticsPeekRestored(false);
              ui.ensureMinimized('politicsPeek');
            }}
            onClose={() => {
              setHostPoliticsPeekRestored(false);
              ui.ensureMinimized('politicsPeek');
            }}
          />
        </LazyWhen>

        <LazyWhen active={!!strategyResolution?.active && !victoryLocked && !isPlayerClient && !isViewerClient}>
          <StrategyResolutionModal
            show={!!strategyResolution?.active && !victoryLocked && !isPlayerClient && !isViewerClient}
            minimized={!!ui.minimizedModals.strategyResolution}
            resolution={strategyResolution}
            players={players}
            game={game}
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

        <SecretDealBanner
          show={showSecretDealBanner}
          onStart={() => dispatch({ type: 'START_SECRET_DRAFT' })}
        />

        <LazyWhen active={showSecretDraftPlayerModal || showSecretDraftHostModal}>
          <SecretDraftModal
            show={showSecretDraftPlayerModal || showSecretDraftHostModal}
            player={showSecretDraftPlayerModal ? mySeatPlayer : null}
            players={players}
            draftPending={secretDraftPending}
            isHost={perms?.role === ROLES.ADMIN || roomStatus === 'solo'}
            onKeep={(playerId, cardId) => dispatch({
              type: 'KEEP_SECRET_DRAFT',
              playerId,
              cardId,
            })}
            onMinimize={() => {
              if (showSecretDraftPlayerModal) ui.ensureMinimized('secretDraft');
              else ui.ensureMinimized('secretDraftHost');
            }}
          />
        </LazyWhen>

        <LazyWhen active={showSecretReceiveModal}>
          <SecretReceiveModal
            show={showSecretReceiveModal}
            player={secretReceivePlayer}
            cardId={
              secretPendingReveal
              && String(secretPendingReveal.playerId) === String(secretReceivePlayerId)
                ? secretPendingReveal.cardId
                : null
            }
            needsDiscard={
              !!secretOverflow
              && String(secretOverflow.playerId) === String(secretReceivePlayerId)
            }
            hand={Array.isArray(secretReceivePlayer?.secretHand) ? secretReceivePlayer.secretHand : []}
            onDismiss={() => dispatch({
              type: 'DISMISS_SECRET_REVEAL',
              playerId: secretReceivePlayerId,
            })}
            onDiscard={(cardId) => dispatch({
              type: 'DISCARD_SECRET',
              playerId: secretReceivePlayerId,
              cardId,
            })}
          />
        </LazyWhen>

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
            show={
              !!strategyResolution?.active
              && !victoryLocked
              && strategyResolution.cardId !== 7
              // Politics primary answers only after peek; secondaries as soon as peek opens.
              && strategyResolution.responses?.[perms.seatPlayerId] === 'pending'
            }
            cardId={strategyResolution?.cardId}
            myStatus={strategyResolution?.responses?.[perms.seatPlayerId]}
            startedAt={strategyResolution?.startedAt}
            canPlay={select.canMarkStrategyPlayed(game, perms.seatPlayerId)}
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
            onClaimSlice={(playerId, sliceId, cardId) => dispatch({
              type: 'CLAIM_EXPEDITION_SLICE',
              playerId,
              sliceId,
              cardId,
            })}
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
              ui.setShowExpeditionModal(false);
            }}
          />
        </LazyWhen>

        <LazyWhen active={ui.showGameSummaryModal}>
          <GameSummaryModal
            show={ui.showGameSummaryModal}
            onClose={() => { ui.setShowGameSummaryModal(false); }}
          />
        </LazyWhen>

        <PushNotificationsSheet
          show={showPushSettings}
          onClose={() => setShowPushSettings(false)}
          supported={pushNotify.supported}
          canUse={pushNotify.canUse}
          subscribed={pushNotify.subscribed}
          busy={pushNotify.busy}
          configured={pushNotify.configured}
          categories={pushNotify.categories}
          onEnable={pushNotify.enable}
          onDisable={pushNotify.disable}
          onSetCategory={pushNotify.setCategory}
        />
      </main>

      {showActiveGame && (
        <button
          type="button"
          onClick={() => ui.setShowProductionCalculator(true)}
          className={`fixed z-40 items-center gap-2 rounded-xl border border-cyan-700 bg-slate-900/95 px-3 py-2.5 text-xs font-bold text-cyan-300 shadow-lg hover:bg-slate-800 transition left-4 bottom-4 ${
            (isPlayerClient || isViewerClient) ? 'hidden md:flex' : 'flex'
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
        showCombatModal={
          ui.showCombatModal
          || (!!combatActive && perms?.role === ROLES.ADMIN)
        }
        showStatusPhaseModal={showStatusPhaseModal && !isViewerClient}
        scoringActive={!!objectiveScoring?.active && !isViewerClient}
        strategyResolutionActive={
          !!strategyResolution?.active
          && !isPlayerClient
          && !isViewerClient
        }
        politicsPeekActive={
          !!strategyResolution?.active
          && strategyResolution.phase === 'peek'
          && (isPoliticsPeekActor || perms?.role === ROLES.ADMIN)
        }
        imperialClaimActive={showImperialClaimModal}
        techResearchActive={showTechResearchModal}
        expeditionActive={false}
        startingTechDraftActive={showStartingTechHostModal}
        startingTechPlayerActive={startingTechPlayerPending}
        secretDraftActive={showSecretDraftPlayerModal || (!!secretDraftPending && !!ui.minimizedModals.secretDraft && !!mySeatPlayer)}
        secretDraftHostActive={
          secretDraftPending
          && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
          && !showSecretDraftPlayerModal
        }
        onRestore={(id) => {
          if (id === 'politicsPeek') setHostPoliticsPeekRestored(true);
          if (BLOCKING_MODAL_IDS.includes(id)) ui.focusBlockingModal(id);
          else ui.ensureExpanded(id);
        }}
      />
      <AppDialog dialog={dialog} onClose={close} />

      {isHostClient && secretScoreNotice && (
        <div
          className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-overlay"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="secret-score-notice-title"
            className="game-modal-panel max-w-sm w-full p-5 space-y-3"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/60 bg-violet-500/20 text-violet-200 text-xl">
                <i className="fa-solid fa-user-secret" aria-hidden="true" />
              </span>
              <div>
                <h3 id="secret-score-notice-title" className="game-modal-title text-sm uppercase">
                  Секретная цель
                </h3>
                <p className="text-xs text-[var(--game-muted)] mt-0.5">Игрок засчитал +1 ПО</p>
              </div>
            </div>
            <p className="text-sm text-[var(--game-text)] leading-relaxed">
              <span className="font-bold text-white">{secretScoreNotice.playerName}</span>
              {' '}достиг секретной цели
              {' '}
              <span className="font-semibold text-violet-200">«{secretScoreNotice.cardTitle}»</span>.
            </p>
            <button
              type="button"
              onClick={() => setSecretScoreNotice(null)}
              className="game-btn-primary w-full"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
