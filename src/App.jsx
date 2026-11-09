import { lazy, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as select from './game/selectors';
import { useSyncedGame } from './sync/useSyncedGame';
import { verifyHostSecret } from './sync/roomApi';
import { useElapsedSeconds } from './hooks/useTurnTimer';
import { useYourTurnAlert } from './hooks/useYourTurnAlert';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useVisualViewportShell } from './hooks/useVisualViewportShell';
import { useAppDialog } from './hooks/useAppDialog';
import { useCloudGame } from './hooks/useCloudGame';
import { BLOCKING_MODAL_IDS, useLocalUi } from './hooks/useLocalUi';
import { useGameDialogs } from './hooks/useGameDialogs';
import { AppDialog } from './components/AppDialog';
import { canStartSecretDraft, nextSecretReceiveSeat } from './game/secretDeck';
import { ROLES } from './sync/permissions';
import { playersNeedingStartingTechDraft } from './data/technologies';
import { getTechSession } from './hooks/useTechSession';
import { isVictoryReached, victoryWinners } from './game/victory';
import { isStandalonePath, StandaloneRoutes } from './app/StandaloneRoutes';
import { secretObjectiveById } from './data/secretObjectives';
import { AppMainShell, BoardChunkFallback, openStatsTab } from './app/AppMainShell';

const GameBoard = lazy(() => import('./components/GameBoard').then(m => ({ default: m.GameBoard })));
const PlayerMobileConsole = lazy(() => import('./components/PlayerMobileConsole').then(m => ({ default: m.PlayerMobileConsole })));
const ViewerMobileConsole = lazy(() => import('./components/ViewerMobileConsole').then(m => ({ default: m.ViewerMobileConsole })));
const GameSummaryModal = lazy(() => import('./components/GameSummaryModal').then(m => ({ default: m.GameSummaryModal })));
const StatusPhaseModal = lazy(() => import('./components/StatusPhaseModal').then(m => ({ default: m.StatusPhaseModal })));
const ObjectiveScoringModal = lazy(() => import('./components/ObjectiveScoringModal').then(m => ({ default: m.ObjectiveScoringModal })));
const EndGameModal = lazy(() => import('./components/EndGameModal').then(m => ({ default: m.EndGameModal })));
const DraftModal = lazy(() => import('./components/DraftModal').then(m => ({ default: m.DraftModal })));
const PoliticsModal = lazy(() => import('./components/PoliticsModal').then(m => ({ default: m.PoliticsModal })));
const ActiveLawsSheet = lazy(() => import('./components/ActiveLawsSheet').then(m => ({ default: m.ActiveLawsSheet })));
const ScoredSecretsModal = lazy(() => import('./components/ScoredSecretsBoard').then(m => ({ default: m.ScoredSecretsModal })));
const PoliticsPeekModal = lazy(() => import('./components/PoliticsPeekModal').then(m => ({ default: m.PoliticsPeekModal })));
const CombatModal = lazy(() => import('./components/CombatModal').then(m => ({ default: m.CombatModal })));
const SpeakerSelectionModal = lazy(() => import('./components/SpeakerSelectionModal').then(m => ({ default: m.SpeakerSelectionModal })));
const StrategyResolutionModal = lazy(() => import('./components/StrategyResolutionModal').then(m => ({ default: m.StrategyResolutionModal })));
const StartingTechDraftModal = lazy(() => import('./components/StartingTechDraftModal').then(m => ({ default: m.StartingTechDraftModal })));
const StartingTechPlayerModal = lazy(() => import('./components/StartingTechPlayerModal').then(m => ({ default: m.StartingTechPlayerModal })));
const SecretDraftModal = lazy(() => import('./components/SecretDraftModal').then(m => ({ default: m.SecretDraftModal })));
const SecretReceiveModal = lazy(() => import('./components/SecretReceiveModal').then(m => ({ default: m.SecretReceiveModal })));
const ImperialClaimModal = lazy(() => import('./components/ImperialClaimModal').then(m => ({ default: m.ImperialClaimModal })));
const TechModal = lazy(() => import('./components/TechModal').then(m => ({ default: m.TechModal })));
const ProductionCalculatorModal = lazy(() => import('./components/ProductionCalculatorModal').then(m => ({ default: m.ProductionCalculatorModal })));
const ExpeditionModal = lazy(() => import('./components/ExpeditionModal').then(m => ({ default: m.ExpeditionModal })));
const EventLogModal = lazy(() => import('./components/EventLogModal').then(m => ({ default: m.EventLogModal })));
const MiltyDraftPage = lazy(() => import('./components/MiltyDraftPage').then(m => ({ default: m.MiltyDraftPage })));



function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dialog, close, uiAlert, uiConfirm, uiPrompt, uiForm } = useAppDialog();
  const {
    game,
    dispatch,
    room,
    roomShare,
    roomStatus,
    roomError,
    syncLink,
    resumeLiveSync,
    dismissRoomError,
    startHostRoom,
    promoteMiltyToSetup,
    joinRoomById,
    claimHostByKey,
    releaseSeatById,
    claimHostSeatById,
    leaveRoom,
    resetLocalGame,
    perms,
    canUndo,
    miltyLiveDraft,
  } = useSyncedGame();

  const [soloSetup, setSoloSetup] = useState(false);
  const [showPushSettings, setShowPushSettings] = useState(false);

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
  const {
    active: roundActive,
    passed,
    turnStartedAt,
    turnPausedAccum,
    strategyActionTaken,
    secretExchangeUsed,
    strategyResolution,
    imperialClaim,
    techResearch,
    combat,
  } = game.round;
  const combatActive = !!combat?.active;
  const isPoliticsPeekActor = strategyResolution?.phase === 'peek'
    && (
      roomStatus === 'solo'
      || (perms?.seatPlayerId != null
        && String(perms.seatPlayerId) === String(strategyResolution.playerId))
    );
  // Host never auto-opens peek; only after dock restore in this peek session.
  const [hostPoliticsPeekRestored, setHostPoliticsPeekRestored] = useState(false);
  const hostPoliticsPeekOpen = perms?.role === ROLES.ADMIN && hostPoliticsPeekRestored;
  const roundStartedAt = game.round?.roundStartedAt ?? null;
  const {
    queue: draftQueue, assignments: draftAssignments, currentQueueIndex,
    step: draftStep, pickOrder: draftPickOrder, showModal: showDraftModal,
    strategyCardBonuses, pickStartedAt: draftPickStartedAt,
  } = game.draft;
  const {
    showModal: showPoliticsModal, step: politicsStep, agendas, currentAgendaIndex,
    influenceLocked, voteReversed, oneVoteLaw, activeLaws = [],
  } = game.politics;
  const [showActiveLaws, setShowActiveLaws] = useState(false);
  const [showScoredSecrets, setShowScoredSecrets] = useState(false);
  const {
    show: showStatusPhaseModal,
    checks: statusPhaseChecks,
    scoring: objectiveScoring,
    revealShow: statusRevealShow,
  } = game.statusPhase;
  const [spotlightObjectiveId, setSpotlightObjectiveId] = useState(null);
  const [spotlightReady, setSpotlightReady] = useState(false);

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
    && Number.isFinite(turnStartedAt)
    && !strategyResolution?.active
    && !combatActive
    && !isVictoryReached(game);
  const liveTurnSecs = useElapsedSeconds(turnStartedAt, clockRunning);
  const turnTime = Math.max(0, turnPausedAccum || 0) + liveTurnSecs;

  const combatSessionTime = useElapsedSeconds(
    combat?.startedAt,
    combatActive && Number.isFinite(combat?.startedAt),
  );

  const roundClockRunning = isGameActive && Number.isFinite(roundStartedAt) && !isVictoryReached(game);
  const liveRoundSecs = useElapsedSeconds(roundStartedAt, roundClockRunning);
  const roundTime = select.currentRoundDisplayTime(game, liveRoundSecs);
  const victoryLocked = isGameActive && isVictoryReached(game);
  const winners = victoryLocked ? victoryWinners(game) : [];
  const isHostClient = perms?.role === ROLES.ADMIN || roomStatus === 'solo';

  const isLive = roomStatus === 'live' && !!room?.roomId;
  const isConnecting = roomStatus === 'connecting';
  const hasRoomSession = isLive || isConnecting || !!room?.roomId;
  // Any connecting state (fresh join before roomId is set, or refresh restore).
  // Previously required roomId and left a blank black frame on mobile join.
  const roomBooting = isConnecting;
  const miltyDrafting = !roomBooting && hasRoomSession && (
    room?.phase === 'milty' || room?.milty?.status === 'drafting'
  );
  const canSetup = perms?.can('setup') !== false;
  const showHub = !isGameActive && !soloSetup && !hasRoomSession;
  const showMiltyPhase = !isGameActive && miltyDrafting;
  const showAdminSetup = !isGameActive && !roomBooting && canSetup && (soloSetup || hasRoomSession) && !miltyDrafting;
  const showGuestLobby = !isGameActive && !roomBooting && !canSetup && hasRoomSession && !miltyDrafting;
  const showRoomBoot = roomBooting;
  const showActiveGame = isGameActive && !roomBooting;
  const isPlayerClient = perms?.role === ROLES.PLAYER;
  const isViewerClient = perms?.role === ROLES.VIEWER;
  const showImperialClaimModal = !!imperialClaim?.active && !victoryLocked && (
    roomStatus === 'solo'
    || perms?.role === ROLES.ADMIN
    || (perms?.seatPlayerId != null && perms.seatPlayerId === imperialClaim.playerId)
  );
  const startingTechDraft = game.startingTechDraft;
  const startingTechNeeders = playersNeedingStartingTechDraft(players);
  const showStartingTechBanner = !!(
    isGameActive
    && !victoryLocked
    && startingTechDraft?.needed
    && !startingTechDraft?.active
    && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
  );
  const showStartingTechHostModal = !!(
    startingTechDraft?.active
    && !victoryLocked
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
    && (perms?.role === ROLES.ADMIN
      || String(perms?.seatPlayerId) === String(activePlayer.id))
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
    ? players.find((p) => String(p.id) === String(perms.seatPlayerId))
    : null;
  const myStartingTechResponse = mySeatPlayer && startingTechDraft?.active
    ? startingTechDraft.responses?.[mySeatPlayer.id]
    : null;
  const startingTechPlayerPending = !!(
    !victoryLocked
    && isPlayerClient
    && mySeatPlayer
    && startingTechDraft?.active
    && myStartingTechResponse
    && myStartingTechResponse.status !== 'confirmed'
  );
  const showStartingTechPlayerModal = startingTechPlayerPending
    && !ui.minimizedModals.startingTechPlayer;
  const showSecretDealBanner = !!(
    isGameActive
    && !victoryLocked
    && canStartSecretDraft(game)
    && !showStartingTechBanner
    && !startingTechDraft?.active
    && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
  );
  const secretDraftPending = !!game.secretObjectives?.draftPending;
  const mySecretDraft = mySeatPlayer && Array.isArray(mySeatPlayer.secretDraft)
    ? mySeatPlayer.secretDraft
    : [];
  const showSecretDraftPlayerModal = !!(
    secretDraftPending
    && mySeatPlayer
    && mySecretDraft.length > 0
    && !ui.minimizedModals.secretDraft
  );
  const showSecretDraftHostModal = !!(
    secretDraftPending
    && (perms?.role === ROLES.ADMIN || roomStatus === 'solo')
    && !showSecretDraftPlayerModal
    && !ui.minimizedModals.secretDraftHost
  );
  // Per-seat pending receives: each phone shows only its own; solo queues one at a time.
  const secretReceiveSeat = nextSecretReceiveSeat(
    game.secretObjectives,
    roomStatus === 'solo' ? null : (perms?.seatPlayerId ?? null),
  );
  const secretReceivePlayerId = secretReceiveSeat?.playerId ?? null;
  const secretPendingReveal = secretReceiveSeat?.cardId
    ? { playerId: secretReceivePlayerId, cardId: secretReceiveSeat.cardId }
    : null;
  const secretOverflow = secretReceiveSeat?.overflow
    ? {
      playerId: secretReceivePlayerId,
      resolveStrategy: !!secretReceiveSeat.resolveStrategy,
    }
    : null;
  const secretReceivePlayer = secretReceivePlayerId != null
    ? players.find(p => String(p.id) === String(secretReceivePlayerId))
    : null;
  const showSecretReceiveModal = !!(
    !victoryLocked
    && secretReceivePlayer
    && secretReceiveSeat
    && (
      (perms?.seatPlayerId != null
        && String(perms.seatPlayerId) === String(secretReceivePlayerId))
      || roomStatus === 'solo'
    )
  );
  const isMyTurn = !!(
    isGameActive
    && mySeatPlayer
    && activePlayer
    && activePlayer.id === mySeatPlayer.id
    && !passed[mySeatPlayer.id]
  );
  useYourTurnAlert({ enabled: isPlayerClient && isGameActive, isYourTurn: isMyTurn });

  const [secretScoreNotice, setSecretScoreNotice] = useState(null);
  const secretLogSeenLenRef = useRef(null);
  useEffect(() => {
    if (!isHostClient || !isGameActive) {
      secretLogSeenLenRef.current = null;
      return;
    }
    const events = Array.isArray(game.log?.events) ? game.log.events : [];
    if (secretLogSeenLenRef.current == null) {
      secretLogSeenLenRef.current = events.length;
      return;
    }
    if (events.length < secretLogSeenLenRef.current) {
      secretLogSeenLenRef.current = events.length;
      return;
    }
    if (events.length === secretLogSeenLenRef.current) return;
    const fresh = events.slice(secretLogSeenLenRef.current);
    secretLogSeenLenRef.current = events.length;
    // Host toast only for mid-phase action/politics secrets — not status scoring.
    const scored = [...fresh].reverse().find((ev) => {
      if (ev?.type !== 'SECRET_SCORED' || ev.scoringWindow) return false;
      const phase = ev.phase
        || (ev.cardId ? secretObjectiveById.get(ev.cardId)?.phase : null);
      return phase === 'action' || phase === 'agenda';
    });
    if (!scored) return;
    const player = players.find((p) => p.id === scored.playerId);
    const card = scored.cardId ? secretObjectiveById.get(scored.cardId) : null;
    setSecretScoreNotice({
      playerName: player?.name || (scored.playerId != null ? `#${scored.playerId}` : 'Игрок'),
      cardTitle: card?.title || 'Секретная цель',
    });
  }, [game.log?.events, isHostClient, isGameActive, players]);

  const pushNotify = usePushNotifications({
    roomId: room?.roomId || null,
    sessionToken: room?.sessionToken || null,
    role: perms?.role || null,
    enabled: roomStatus === 'live' && (isPlayerClient || isHostClient),
  });

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
    // Dock other process modals; expedition only expands/collapses manually.
    ui.focusBlockingModal(null);
    ui.ensureExpanded('expedition');
    setShowExpeditionModal(true);
  };

  const openPhaseModal = (id, extra) => {
    ui.focusBlockingModal(id);
    extra?.();
  };

  const mobileShell = (isPlayerClient || isViewerClient) && showActiveGame;
  useVisualViewportShell(mobileShell);

  // Keep cinematic body tokens during the live game (setup/hub screens set this themselves).
  useEffect(() => {
    if (!isGameActive) return undefined;
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, [isGameActive]);

  // During objective scoring: tuck status checklist, open scoring modal.
  // When scoring finishes: restore the status checklist.
  useEffect(() => {
    if (objectiveScoring?.active) {
      ui.focusBlockingModal('objectiveScoring');
      return;
    }
    if (showStatusPhaseModal) {
      ui.focusBlockingModal('statusPhase');
    }
  }, [objectiveScoring?.active, showStatusPhaseModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft / politics open from game state — must re-expand. Otherwise a prior
  // focusBlockingModal('statusPhase'|…) left them stuck minimized=true.
  useEffect(() => {
    if (showDraftModal) {
      ui.focusBlockingModal('draft');
    }
  }, [showDraftModal, draftStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showPoliticsModal) {
      ui.focusBlockingModal('politics');
    }
  }, [showPoliticsModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host checked «Раскрытие новой цели»:
  // collapse status → deal new card → hold → expand status again.
  const STATUS_EXIT_MS = 380;
  const REVEAL_SPOTLIGHT_MS = 7000;
  useEffect(() => {
    if (!statusRevealShow?.at || !showStatusPhaseModal || objectiveScoring?.active) {
      setSpotlightObjectiveId(null);
      setSpotlightReady(false);
      return undefined;
    }
    const elapsed = Date.now() - statusRevealShow.at;
    if (elapsed >= REVEAL_SPOTLIGHT_MS) {
      setSpotlightObjectiveId(null);
      setSpotlightReady(false);
      return undefined;
    }

    ui.ensureMinimized('statusPhase');
    setSpotlightObjectiveId(statusRevealShow.objectiveId || null);
    setSpotlightReady(elapsed >= STATUS_EXIT_MS);

    const timers = [];
    const cardDelay = Math.max(0, STATUS_EXIT_MS - elapsed);
    if (cardDelay > 0) {
      timers.push(window.setTimeout(() => setSpotlightReady(true), cardDelay));
    }

    timers.push(window.setTimeout(() => {
      setSpotlightReady(false);
      setSpotlightObjectiveId(null);
      if (!objectiveScoring?.active) {
        ui.ensureExpanded('statusPhase');
      }
    }, REVEAL_SPOTLIGHT_MS - elapsed));

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [statusRevealShow?.at, statusRevealShow?.objectiveId, showStatusPhaseModal, objectiveScoring?.active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!strategyResolution?.active) {
      setHostPoliticsPeekRestored(false);
      return;
    }
    if (strategyResolution.phase === 'peek') {
      const isPeekActor = roomStatus === 'solo'
        || (perms?.seatPlayerId != null
          && String(perms.seatPlayerId) === String(strategyResolution.playerId));
      // Politics seat: peek first. Host: main played/pass window; peek stays docked.
      setHostPoliticsPeekRestored(false);
      if (isPeekActor) ui.focusBlockingModal('politicsPeek');
      else if (!isPlayerClient && !isViewerClient) {
        ui.ensureMinimized('politicsPeek');
        ui.focusBlockingModal('strategyResolution');
      }
      return;
    }
    setHostPoliticsPeekRestored(false);
    if (!isPlayerClient && !isViewerClient) {
      ui.focusBlockingModal('strategyResolution');
    }
  }, [strategyResolution?.active, strategyResolution?.phase, strategyResolution?.playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showStartingTechHostModal) {
      ui.focusBlockingModal('startingTechDraft');
    }
  }, [showStartingTechHostModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showStartingTechPlayerModal) {
      ui.focusBlockingModal('startingTechPlayer');
    }
  }, [startingTechDraft?.active, mySeatPlayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!secretDraftPending) return;
    if (isPlayerClient && mySecretDraft.length > 0) {
      ui.focusBlockingModal('secretDraft');
    } else if (perms?.role === ROLES.ADMIN || roomStatus === 'solo') {
      ui.focusBlockingModal('secretDraftHost');
    }
  }, [secretDraftPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showImperialClaimModal) {
      ui.focusBlockingModal('imperialClaim');
    }
  }, [showImperialClaimModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showTechResearchModal) {
      ui.focusBlockingModal('techResearch');
      ui.setShowTechModal(false);
    }
  }, [showTechResearchModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (combatActive && perms?.role === ROLES.ADMIN) {
      ui.setShowCombatModal(true);
      ui.focusBlockingModal('combat');
    }
    if (!combatActive) {
      ui.setShowCombatModal(false);
    }
  }, [combatActive, perms?.role]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const unlockAsHost = async ({ title, forcePrompt = false, softSolo = false } = {}) => {
    const { getHostWriteToken, setHostWriteToken } = await import('./sync/hostWriteToken');
    const cached = getHostWriteToken();
    if (!forcePrompt && cached) {
      try {
        await verifyHostSecret(cached);
        return cached;
      } catch {
        setHostWriteToken('');
      }
    }
    const createSecret = await uiPrompt(
      softSolo
        ? 'Код доступа хоста (запрашивается один раз за сессию браузера):'
        : 'Введите код доступа',
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
      setHostWriteToken(String(createSecret));
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
    const createSecret = await unlockAsHost({ title: 'Создать партию', forcePrompt: true });
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

  const handleCreateWithMilty = async () => {
    const createSecret = await unlockAsHost({ title: 'Создать партию с Milty', forcePrompt: true });
    if (!createSecret) return;
    navigate('/milty', { state: { party: true, createSecret } });
  };

  const handleOpenMilty = async () => {
    const createSecret = await unlockAsHost({ title: 'Milty Draft', forcePrompt: true });
    if (!createSecret) return;
    navigate('/milty', { state: { createSecret } });
  };

  const handleCreatePartyWithMilty = async (miltySettings, createSecretFromNav) => {
    setSoloSetup(false);
    let createSecret = createSecretFromNav || null;
    if (!createSecret) {
      createSecret = await unlockAsHost({ title: 'Создать партию с Milty', forcePrompt: true });
    }
    if (!createSecret) return;
    try {
      const created = await startHostRoom(createSecret, { milty: miltySettings });
      try {
        await navigator.clipboard.writeText(created.roomId);
      } catch {
        /* ignore */
      }
      navigate('/');
      await uiAlert(
        `Драфт создан. Код комнаты: ${created.roomId}\nИгроки входят по коду (в хабе не видна, пока идёт драфт).`,
        { title: 'Milty Draft', variant: 'success' },
      );
    } catch (err) {
      const code = String(err.message || err);
      await uiAlert(
        hostSecretErrorMessage(code) || `Не удалось создать: ${code}`,
        { title: 'Ошибка', variant: 'danger' },
      );
      throw err;
    }
  };

  const handlePlaySolo = async () => {
    const createSecret = await unlockAsHost({
      title: 'Играть без комнаты',
      softSolo: true,
    });
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
        ? 'Место уже занято. Код места нужен только чтобы перенести его на другое устройство.'
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

  const handleClaimHost = async (roomId, hostKey) => {
    setSoloSetup(false);
    try {
      const claimed = await claimHostByKey(roomId, hostKey);
      await uiAlert(
        claimed?.reclaimed
          ? 'Вы снова хост на этом устройстве. Старое устройство отключено.'
          : 'Вы хост на этом устройстве.',
        { title: 'Хост перенесён', variant: 'success' },
      );
      return claimed;
    } catch (err) {
      const codeErr = String(err.message || err);
      const message = codeErr === 'bad-host-key'
        ? 'Неверный код хоста.'
        : codeErr === 'party-ended'
          ? 'Партия уже завершена.'
          : codeErr === 'not-found'
            ? 'Комната не найдена.'
            : `Не удалось стать хостом: ${codeErr}`;
      await uiAlert(message, { title: 'Ошибка', variant: 'danger' });
      throw err;
    }
  };

  const handleLeaveRoom = async () => {
    setSoloSetup(false);
    await pushNotify.unsubscribeServer();
    await leaveRoom();
  };

  useEffect(() => {
    if (location.pathname !== '/stats') return undefined;
    cloud.loadStatsHistory();
    return undefined;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isStandalonePath(location.pathname)) {
    return (
      <StandaloneRoutes
        location={location}
        navigate={navigate}
        dialogSlot={<AppDialog dialog={dialog} onClose={close} />}
        cloud={cloud}
        unlockAsHost={unlockAsHost}
        onCreatePartyWithMilty={handleCreatePartyWithMilty}
      />
    );
  }

  return (
    <AppMainShell
      {...{
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
        winners,
      }}
    />
  );
}

export default App;
