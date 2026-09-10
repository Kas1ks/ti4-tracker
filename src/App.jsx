import { useEffect, useState } from 'react';
import * as select from './game/selectors';
import { useSyncedGame } from './sync/useSyncedGame';
import { useElapsedSeconds } from './hooks/useTurnTimer';
import { useYourTurnAlert } from './hooks/useYourTurnAlert';
import { useVisualViewportShell } from './hooks/useVisualViewportShell';
import { useAppDialog } from './hooks/useAppDialog';
import { useCloudGame } from './hooks/useCloudGame';
import { useLocalUi } from './hooks/useLocalUi';
import { useGameDialogs } from './hooks/useGameDialogs';
import { AppDialog } from './components/AppDialog';
import { GameHeader } from './components/GameHeader';
import { GameSummaryModal } from './components/GameSummaryModal';
import { MinimizedModalControls } from './components/MinimizedModalControls';
import { RoomHub } from './components/RoomHub';
import { GuestLobby } from './components/GuestLobby';
import { SetupScreen } from './components/SetupScreen';
import { GameBoard } from './components/GameBoard';
import { PlayerMobileConsole } from './components/PlayerMobileConsole';
import { StatsModal } from './components/StatsModal';
import { StatusPhaseModal } from './components/StatusPhaseModal';
import { ObjectiveScoringModal } from './components/ObjectiveScoringModal';
import { EndGameModal } from './components/EndGameModal';
import { DraftModal } from './components/DraftModal';
import { PoliticsModal } from './components/PoliticsModal';
import { CombatModal } from './components/CombatModal';
import { SpeakerSelectionModal } from './components/SpeakerSelectionModal';
import { StrategyResolutionModal } from './components/StrategyResolutionModal';
import { StrategyResolutionBanner } from './components/StrategyResolutionBanner';
import { ProductionCalculatorModal } from './components/ProductionCalculatorModal';
import { ROLES } from './sync/permissions';

function App() {
  const { dialog, close, uiAlert, uiConfirm, uiPrompt, uiForm } = useAppDialog();
  const {
    game,
    dispatch,
    room,
    roomStatus,
    roomError,
    startHostRoom,
    joinRoomById,
    releaseSeatById,
    leaveRoom,
    resetLocalGame,
    perms,
  } = useSyncedGame();

  const [soloSetup, setSoloSetup] = useState(false);

  const ui = useLocalUi();
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
  const { active: roundActive, passed, turnStartedAt, strategyActionTaken, strategyResolution } = game.round;
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
  const mySeatPlayer = isPlayerClient && perms?.seatPlayerId != null
    ? players.find(p => p.id === perms.seatPlayerId)
    : null;
  const isMyTurn = !!(
    isGameActive
    && mySeatPlayer
    && activePlayer
    && activePlayer.id === mySeatPlayer.id
    && !passed[mySeatPlayer.id]
  );
  useYourTurnAlert({ enabled: isPlayerClient && isGameActive, isYourTurn: isMyTurn });

  const playerMobileShell = isPlayerClient && isGameActive;
  useVisualViewportShell(playerMobileShell);

  // During objective scoring: tuck status, open scoring modal.
  useEffect(() => {
    if (objectiveScoring?.active) {
      ui.ensureMinimized('statusPhase');
      ui.ensureExpanded('objectiveScoring');
    }
  }, [objectiveScoring?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (strategyResolution?.active) {
      ui.ensureExpanded('strategyResolution');
    }
  }, [strategyResolution?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveStrategy = (playerId, choice) => {
    dispatch({ type: 'RESOLVE_STRATEGY', playerId, choice });
  };

  const resetGameState = async () => {
    setSoloSetup(false);
    await resetLocalGame();
    ui.closeEndGameUi();
  };

  const handleCreateRoom = async () => {
    setSoloSetup(false);
    try {
      const created = await startHostRoom();
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
      await uiAlert(`Не удалось создать комнату: ${err.message || err}`, {
        title: 'Ошибка',
        variant: 'danger',
      });
    }
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
        onExport={cloud.exportGameToken}
        onOpenEndGame={() => ui.setShowEndGameModal(true)}
        onOpenStats={cloud.openStatsModal}
        turnOrder={turnOrder}
        activePlayer={activePlayer}
        passed={passed}
        strategyCards={strategyCards}
        allStrategiesPlayed={allStrategiesPlayed}
        strategyActionTaken={!!strategyActionTaken}
        strategyResolutionActive={!!strategyResolution?.active}
        resolvingCardId={strategyResolution?.cardId ?? null}
        onPlayStrategy={dialogs.playStrategyCard}
        turnTime={turnTime}
        onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
        onPassTurn={dialogs.passTurn}
        onOpenCombat={ui.openCombatModal}
        room={room}
        roomStatus={roomStatus}
        perms={perms}
        hideTurnBarOnMobile={isPlayerClient}
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
            onPlaySolo={() => setSoloSetup(true)}
            importGameToken={cloud.importGameToken}
            uiConfirm={uiConfirm}
            uiPrompt={uiPrompt}
          />
        )}

        {showGuestLobby && (
          <GuestLobby
            room={room}
            players={players}
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
              <PlayerMobileConsole
                me={mySeatPlayer}
                seatSecret={room?.seatSecret || null}
                activePlayer={activePlayer}
                turnOrder={turnOrder}
                players={players}
                passed={passed}
                strategyCards={strategyCards}
                allStrategiesPlayed={allStrategiesPlayed}
                strategyActionTaken={!!strategyActionTaken}
                strategyResolutionActive={!!strategyResolution?.active}
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
                }
                onOpenProduction={() => ui.setShowProductionCalculator(true)}
              />
            )}
            <div className={isPlayerClient ? 'hidden md:block' : undefined}>
              <GameBoard
                turnOrder={turnOrder}
                passed={passed}
                activePlayer={activePlayer}
                sortedPlayersForBoard={sortedPlayersForBoard}
                getPlayerScore={getPlayerScore}
                players={players}
                adjustSecrets={(playerId, delta) => dispatch({ type: 'ADJUST_SECRETS', playerId, delta })}
                adjustMecatol={(playerId, delta) => dispatch({ type: 'ADJUST_MECATOL', playerId, delta })}
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
            </div>
          </>
        )}

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

        <StatsModal
          showStatsModal={cloud.showStatsModal}
          setShowStatsModal={cloud.setShowStatsModal}
          isStatsLoading={cloud.isStatsLoading}
          globalHistory={cloud.globalHistory}
          deleteSingleGame={cloud.deleteSingleGame}
          clearAllStats={cloud.clearAllStats}
        />

        <EndGameModal
          showEndGameModal={ui.showEndGameModal}
          setShowEndGameModal={ui.setShowEndGameModal}
          players={players}
          getPlayerScore={getPlayerScore}
          saveGameToCloud={cloud.saveGameToCloud}
          setShowGameSummaryModal={ui.setShowGameSummaryModal}
          resetGameState={resetGameState}
        />

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
        />

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

        {isPlayerClient && perms?.seatPlayerId != null && (
          <StrategyResolutionBanner
            show={!!strategyResolution?.active}
            cardId={strategyResolution?.cardId}
            myStatus={strategyResolution?.responses?.[perms.seatPlayerId]}
            onResolve={(choice) => resolveStrategy(perms.seatPlayerId, choice)}
          />
        )}

        <ProductionCalculatorModal
          show={!!ui.showProductionCalculator}
          playerColor={mySeatPlayer?.color || activePlayer?.color}
          playerName={mySeatPlayer?.name || activePlayer?.name}
          onClose={() => ui.setShowProductionCalculator(false)}
        />

        <GameSummaryModal
          show={ui.showGameSummaryModal}
          onClose={() => { ui.setShowGameSummaryModal(false); resetGameState(); }}
        />
      </main>

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
        onRestore={ui.toggleMinimize}
      />
      <AppDialog dialog={dialog} onClose={close} />
    </div>
  );
}

export default App;
