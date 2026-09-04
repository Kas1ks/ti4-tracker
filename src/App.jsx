import * as select from './game/selectors';
import { useSyncedGame } from './sync/useSyncedGame';
import { useElapsedSeconds } from './hooks/useTurnTimer';
import { useAppDialog } from './hooks/useAppDialog';
import { useCloudGame } from './hooks/useCloudGame';
import { useLocalUi } from './hooks/useLocalUi';
import { useGameDialogs } from './hooks/useGameDialogs';
import { AppDialog } from './components/AppDialog';
import { GameHeader } from './components/GameHeader';
import { GameSummaryModal } from './components/GameSummaryModal';
import { MinimizedModalControls } from './components/MinimizedModalControls';
import { SetupScreen } from './components/SetupScreen';
import { GameBoard } from './components/GameBoard';
import { StatsModal } from './components/StatsModal';
import { StatusPhaseModal } from './components/StatusPhaseModal';
import { EndGameModal } from './components/EndGameModal';
import { DraftModal } from './components/DraftModal';
import { PoliticsModal } from './components/PoliticsModal';
import { CombatModal } from './components/CombatModal';
import { SpeakerSelectionModal } from './components/SpeakerSelectionModal';

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
    leaveRoom,
    resetLocalGame,
    perms,
  } = useSyncedGame();

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
  const { active: roundActive, passed, turnStartedAt, strategyActionTaken } = game.round;
  const {
    queue: draftQueue, assignments: draftAssignments, currentQueueIndex,
    step: draftStep, pickOrder: draftPickOrder, showModal: showDraftModal,
    strategyCardBonuses,
  } = game.draft;
  const {
    showModal: showPoliticsModal, step: politicsStep, agendas, currentAgendaIndex,
    influenceLocked, voteReversed,
  } = game.politics;
  const { show: showStatusPhaseModal, checks: statusPhaseChecks } = game.statusPhase;

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

  const resetGameState = () => {
    resetLocalGame();
    ui.closeEndGameUi();
  };

  const handleCreateRoom = async () => {
    try {
      const created = await startHostRoom();
      await uiAlert(`Комната создана. Код: ${created.roomId}`, {
        title: 'Онлайн-комната',
        variant: 'success',
      });
      try {
        await navigator.clipboard.writeText(created.roomId);
      } catch {
        /* clipboard may be blocked */
      }
    } catch (err) {
      await uiAlert(`Не удалось создать комнату: ${err.message || err}`, {
        title: 'Ошибка',
        variant: 'danger',
      });
    }
  };

  const handleJoinRoom = async (code, joinOpts = {}) => {
    try {
      await joinRoomById(code, joinOpts);
      await uiAlert(`Вы в комнате ${String(code).trim().toUpperCase()}`, {
        title: 'Подключено',
        variant: 'success',
      });
    } catch (err) {
      await uiAlert(`Комната не найдена или недоступна: ${err.message || err}`, {
        title: 'Ошибка',
        variant: 'danger',
      });
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto min-h-screen flex flex-col text-slate-100 px-3 md:px-8">
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
        onPlayStrategy={dialogs.playStrategyCard}
        turnTime={turnTime}
        onNextTurn={() => dispatch({ type: 'NEXT_TURN' })}
        onPassTurn={dialogs.passTurn}
        onOpenCombat={ui.openCombatModal}
        room={room}
        roomStatus={roomStatus}
        perms={perms}
      />

      <main className="py-6 flex-grow space-y-8">
        {!isGameActive && (
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
            importGameToken={cloud.importGameToken}
            handleStartGame={dialogs.handleStartGame}
            room={room}
            roomStatus={roomStatus}
            roomError={roomError}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onLeaveRoom={leaveRoom}
            perms={perms}
          />
        )}

        {isGameActive && (
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
            expandedObjectives={ui.expandedObjectives}
            toggleExpand={ui.toggleExpand}
            removeObjective={(objectiveId) => dispatch({ type: 'REMOVE_OBJECTIVE', objectiveId })}
            addRandomObjective={dialogs.addRandomObjective}
            addCustomObjective={dialogs.addCustomObjective}
            targetScore={targetScore}
            speakerId={speakerId}
            handleAddSecret={dialogs.handleAddSecret}
            eliminatePlayer={dialogs.eliminatePlayer}
            isGameActive={isGameActive}
            perms={perms}
          />
        )}

        <StatusPhaseModal
          show={showStatusPhaseModal}
          minimized={!!ui.minimizedModals.statusPhase}
          roundNumber={roundNumber}
          checks={statusPhaseChecks}
          onCheck={(key) => dispatch({ type: 'TOGGLE_STATUS_CHECK', key })}
          onConfirm={() => dispatch({ type: 'CONFIRM_STATUS_PHASE' })}
          onClose={() => dispatch({ type: 'SET_STATUS_PHASE_VISIBLE', visible: false })}
          onMinimize={() => ui.toggleMinimize('statusPhase')}
          readOnly={!perms.can('statusPhase')}
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

        <GameSummaryModal
          show={ui.showGameSummaryModal}
          onClose={() => { ui.setShowGameSummaryModal(false); resetGameState(); }}
        />
      </main>

      <MinimizedModalControls
        minimizedModals={ui.minimizedModals}
        showDraftModal={showDraftModal}
        showPoliticsModal={showPoliticsModal}
        showCombatModal={ui.showCombatModal}
        showStatusPhaseModal={showStatusPhaseModal}
        onRestore={ui.toggleMinimize}
      />
      <AppDialog dialog={dialog} onClose={close} />
    </div>
  );
}

export default App;
