import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { clearGameState, loadGameState, saveGameState, stampGameState } from '../game/gameState';
import { reduceGame } from '../game/gameEvents';
import { can, ROLES, authorizeAction } from './permissions';
import {
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
} from './roomSession';
import {
  LOCAL_ONLY_ACTIONS,
  createRoom,
  claimHostSession,
  fetchRoomSnapshot,
  joinRoom,
  postRoomAction,
  promoteMiltyRoom,
  releaseSeat as releaseSeatApi,
  claimHostSeat as claimHostSeatApi,
  subscribeRoom,
} from './roomApi';
import { loadSeatSecret, saveSeatSecret, clearSeatSecret } from './seatSecrets';
import { rememberRecentRoom } from './recentRooms';
import {
  popUndoSnapshot,
  pushUndoSnapshot,
  undoStackDepth,
} from './undoStack';
import { parseRoomActionResult, parseRoomPublicView } from './roomContract';
import { shouldApplySeq, softAuthorizeOptimistic } from './seqGate';

function syncedReducer(state, action) {
  if (action?.type === '__REPLACE__') return action.state;
  return reduceGame(state, action);
}

function playerGateMessage(error) {
  switch (error) {
    case 'victory-locked':
      return 'Партия остановлена: достигнута цель ПО. Дождитесь хоста.';
    case 'not-your-turn':
      return 'Сейчас не ваш ход.';
    case 'strategy-required':
      return 'Сначала нужно сыграть все карты стратегий.';
    case 'strategy-resolving':
      return 'Сначала завершите розыгрыш стратегии.';
    case 'imperial-claim':
      return 'Сначала завершите заявку Imperial.';
    case 'color-taken':
      return 'Этот цвет уже занят.';
    case 'game-active':
      return 'Цвет можно выбрать только до начала партии.';
    case 'not-your-seat':
      return 'Можно менять только своё место.';
    case 'forbidden':
      return 'Это действие сейчас недоступно.';
    default:
      return error ? String(error) : 'Действие отклонено.';
  }
}

/**
 * Solo or live-room session with roles (admin / player / viewer).
 */
export function useSyncedGame() {
  const [game, setGame] = useReducer(syncedReducer, null, loadGameState);
  const [room, setRoom] = useState(() => {
    const saved = loadRoomSession();
    if (!saved?.roomId) return null;
    return {
      roomId: saved.roomId,
      hostKey: saved.hostKey,
      sessionToken: saved.sessionToken,
      role: saved.role || ROLES.VIEWER,
      seatPlayerId: saved.seatPlayerId ?? null,
      seatSecret: loadSeatSecret(saved.roomId, saved.seatPlayerId),
      seq: saved.seq || 0,
      claimedSeats: [],
    };
  });
  const [roomStatus, setRoomStatus] = useState(() => (loadRoomSession()?.roomId ? 'connecting' : 'solo'));
  const [roomError, setRoomError] = useState(null);
  /** SSE link: 'idle' | 'open' | 'reconnecting' | 'closed' */
  const [syncLink, setSyncLink] = useState('idle');
  /** Bump to tear down + recreate EventSource (phone unlock / zombie SSE). */
  const [sseGeneration, setSseGeneration] = useState(0);
  const hiddenAtRef = useRef(0);
  const resumeInFlightRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const seqRef = useRef(loadRoomSession()?.seq || 0);
  const roomRef = useRef(null);
  const gameRef = useRef(game);
  const soloUndoStackRef = useRef([]);
  /** Bumped on leave / reset so in-flight join/restore cannot reattach. */
  const sessionGenRef = useRef(0);
  gameRef.current = game;

  const clearSoloUndo = useCallback(() => {
    soloUndoStackRef.current = [];
    setCanUndo(false);
  }, []);

  /** Apply server/SSE state only if seq is not older than what we already have. */
  const applyAuthoritativeState = useCallback((seq, state, extras = {}) => {
    if (!state) return false;
    if (!roomRef.current?.roomId) return false;
    if (!shouldApplySeq(seq, seqRef.current)) return false;
    if (typeof seq === 'number') {
      seqRef.current = seq;
    }
    setGame({ type: '__REPLACE__', state });
    if (typeof extras.canUndo === 'boolean') {
      setCanUndo(extras.canUndo);
    }
    setRoom(prev => (prev ? {
      ...prev,
      seq: typeof seq === 'number' ? seq : prev.seq,
      claimedSeats: extras.claimedSeats ?? prev.claimedSeats,
      securedSeats: extras.securedSeats ?? prev.securedSeats,
      milty: extras.milty !== undefined ? extras.milty : prev.milty,
      phase: extras.phase !== undefined ? extras.phase : prev.phase,
      hostOnline: typeof extras.hostOnline === 'boolean' ? extras.hostOnline : prev.hostOnline,
    } : prev));
    return true;
  }, []);

  // Debounce + idle persist so rapid dispatches don't thrash localStorage.
  useEffect(() => {
    let idleId = 0;
    const timeoutId = window.setTimeout(() => {
      const persist = () => saveGameState(stampGameState(game));
      if (typeof requestIdleCallback === 'function') {
        idleId = requestIdleCallback(persist, { timeout: 400 });
      } else {
        persist();
      }
    }, 250);
    return () => {
      window.clearTimeout(timeoutId);
      if (idleId && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
    };
  }, [game]);

  // Flush latest state on leave / unmount so debounced writes are not lost.
  useEffect(() => {
    const flush = () => {
      try {
        saveGameState(stampGameState(gameRef.current));
      } catch {
        /* ignore quota / private-mode failures */
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  useEffect(() => {
    roomRef.current = room;
    if (room?.roomId) {
      saveRoomSession(room);
    }
  }, [room]);

  // After refresh: pull latest snapshot for the saved room (keep same sessionToken).
  useEffect(() => {
    const saved = loadRoomSession();
    if (!saved?.roomId) return undefined;

    const gen = sessionGenRef.current;
    let cancelled = false;
    setRoomStatus('connecting');

    fetchRoomSnapshot(saved.roomId, { sessionToken: saved.sessionToken })
      .then((snap) => {
        if (cancelled || sessionGenRef.current !== gen) return;
        const still = loadRoomSession();
        if (!still?.roomId || still.roomId !== saved.roomId) return;
        if (!snap?.state) throw new Error('not-found');
        if (snap.partyEnded) throw new Error('party-ended');
        const view = parseRoomPublicView(snap);
        seqRef.current = typeof snap.seq === 'number' ? snap.seq : (saved.seq || 0);
        setGame({ type: '__REPLACE__', state: snap.state });
        if (typeof snap.canUndo === 'boolean') setCanUndo(snap.canUndo);
        else if (view) setCanUndo(view.canUndo);
        const next = {
          roomId: saved.roomId,
          hostKey: saved.hostKey,
          sessionToken: saved.sessionToken,
          role: saved.role || ROLES.VIEWER,
          seatPlayerId: saved.seatPlayerId ?? null,
          seatSecret: loadSeatSecret(saved.roomId, saved.seatPlayerId),
          seq: seqRef.current,
          claimedSeats: snap.claimedSeats || [],
          milty: snap.milty || null,
          phase: snap.phase || (snap.milty?.status === 'drafting' ? 'milty' : 'setup'),
          miltySecret: saved.miltySecret || null,
          miltyAdminSecret: saved.miltyAdminSecret || null,
          hostOnline: snap.hostOnline !== false,
        };
        roomRef.current = next;
        setRoom(next);
        setRoomStatus('live');
        setRoomError(null);
      })
      .catch((err) => {
        if (cancelled || sessionGenRef.current !== gen) return;
        const wasAdmin = !!(saved.hostKey || saved.role === ROLES.ADMIN);
        const localMidGame = !!(gameRef.current?.isGameActive);
        clearRoomSession();
        roomRef.current = null;
        setRoom(null);
        setRoomStatus('solo');
        // Don't wipe a mid-game host local copy when the live room is gone.
        if (!(wasAdmin && localMidGame)) {
          setGame({ type: 'RESET_GAME' });
        }
        setRoomError(
          wasAdmin && localMidGame
            ? `Комната недоступна (${err.message || err}). Локальная партия сохранена — можно экспортировать код или продолжить соло.`
            : `Комната недоступна: ${err.message || err}`,
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room?.roomId) return undefined;

    const ejectStaleSession = (message, { clearSeat = false } = {}) => {
      const current = roomRef.current;
      if (clearSeat && current?.roomId && current.seatPlayerId != null) {
        // Drop saved seat code so a host kick cannot silent-rejoin without typing it.
        clearSeatSecret(current.roomId, current.seatPlayerId);
        rememberRecentRoom({
          roomId: current.roomId,
          role: null,
          seatPlayerId: null,
        });
      }
      sessionGenRef.current += 1;
      roomRef.current = null;
      clearRoomSession();
      setRoom(null);
      setRoomStatus('solo');
      clearSoloUndo();
      setGame({ type: 'RESET_GAME' });
      setRoomError(message);
      setSyncLink('idle');
    };

    const unsubscribe = subscribeRoom(
      room.roomId,
      (msg) => {
      if (msg.type === 'seats') {
        const current = roomRef.current;
        const revoked = msg.revokedSessionToken
          && current?.sessionToken === msg.revokedSessionToken;
        if (revoked && current?.role === ROLES.ADMIN) {
          clearGameState();
          ejectStaleSession(
            msg.hostMoved
              ? 'Хост перенесён на другое устройство.'
              : 'Сессия хоста устарела. Войдите снова с кодом хоста.',
          );
          return;
        }
        const kicked = current?.role === ROLES.PLAYER && revoked;
        if (kicked) {
          clearGameState();
          ejectStaleSession(
            msg.seatRemoved
              ? 'Хост удалил ваше место.'
              : msg.released
                ? 'Хост освободил ваше место. Войдите снова по коду комнаты.'
                : 'Место занято с другого устройства. Войдите снова со своим кодом места.',
            { clearSeat: !!msg.released || !!msg.seatRemoved },
          );
          return;
        }
        setRoom(prev => (prev ? {
          ...prev,
          claimedSeats: msg.claimedSeats ?? prev.claimedSeats,
          securedSeats: msg.securedSeats ?? prev.securedSeats,
        } : prev));
        return;
      }

      if (msg.type === 'host') {
        if (typeof msg.hostOnline === 'boolean') {
          setRoom((prev) => (prev ? { ...prev, hostOnline: msg.hostOnline } : prev));
        }
        return;
      }

      if ((msg.type === 'hello' || msg.type === 'state') && msg.state) {
        const current = roomRef.current;
        const endedByHost = msg.type === 'state'
          && (msg.roomEnded || msg.action?.type === 'RESET_GAME');
        if (endedByHost && current && current.role !== ROLES.ADMIN) {
          clearGameState();
          ejectStaleSession('Партия завершена хостом.');
          return;
        }
        // Soft host-offline must never look like a party end.
        if (endedByHost && current?.role === ROLES.ADMIN && current.hostKey) {
          // Keep local mid-game; drop live session only if server wiped party.
          if (msg.roomEnded || !msg.state?.isGameActive) {
            const keepLocal = !!gameRef.current?.isGameActive;
            clearRoomSession();
            roomRef.current = null;
            setRoom(null);
            setRoomStatus('solo');
            clearSoloUndo();
            if (!keepLocal) setGame({ type: 'RESET_GAME' });
            setRoomError(keepLocal
              ? 'Партия на сервере завершена. Локальная копия сохранена.'
              : 'Партия завершена.');
            setSyncLink('idle');
          }
          return;
        }

        const seatGone = msg.type === 'state'
          && current?.role === ROLES.PLAYER
          && current.seatPlayerId != null
          && !msg.state.players.some(p => String(p.id) === String(current.seatPlayerId));
        if (seatGone
          || (msg.revokedSessionToken && current?.sessionToken === msg.revokedSessionToken)) {
          clearGameState();
          ejectStaleSession(
            msg.seatRemoved || seatGone
              ? 'Хост удалил ваше место.'
              : 'Сессия места устарела. Войдите снова.',
            { clearSeat: !!(msg.seatRemoved || seatGone || msg.released) },
          );
          return;
        }

        applyAuthoritativeState(msg.seq, msg.state, {
          claimedSeats: msg.claimedSeats,
          securedSeats: msg.securedSeats,
          canUndo: typeof msg.canUndo === 'boolean' ? msg.canUndo : undefined,
          milty: msg.milty,
          phase: msg.phase,
          hostOnline: typeof msg.hostOnline === 'boolean' ? msg.hostOnline : undefined,
        });
        return;
      }

      if (msg.type === 'milty') {
        setRoom((prev) => (prev ? {
          ...prev,
          milty: msg.milty ?? prev.milty,
          phase: msg.milty?.status === 'drafting' ? 'milty' : (msg.phase || prev.phase),
        } : prev));
      }
      },
      (status) => {
        // Ignore link events after leave (cleanup close) or mid-reattach.
        if (!roomRef.current?.roomId) return;
        if (status === 'open') setSyncLink('open');
        else if (status === 'reconnecting') setSyncLink('reconnecting');
        else if (status === 'closed') setSyncLink('closed');
      },
      { sessionToken: room.sessionToken },
    );

    return unsubscribe;
  }, [room?.roomId, room?.sessionToken, sseGeneration, applyAuthoritativeState, clearSoloUndo]);

  /**
   * After phone unlock / tab resume: catch up via snapshot and force a fresh SSE.
   * Mobile browsers often leave EventSource half-dead while readyState still looks fine.
   */
  const resumeLiveSync = useCallback(async ({ forceSse = true } = {}) => {
    const current = roomRef.current;
    if (!current?.roomId || resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    setSyncLink((prev) => (prev === 'closed' ? 'reconnecting' : prev));
    try {
      const snap = await fetchRoomSnapshot(current.roomId, {
        sessionToken: current.sessionToken,
      });
      if (roomRef.current?.roomId !== current.roomId) return;
      if (snap?.state) {
        applyAuthoritativeState(snap.seq, snap.state, {
          claimedSeats: snap.claimedSeats,
          canUndo: typeof snap.canUndo === 'boolean' ? snap.canUndo : undefined,
          hostOnline: typeof snap.hostOnline === 'boolean' ? snap.hostOnline : undefined,
        });
        setRoomError(null);
        setRoomStatus('live');
      }
    } catch (err) {
      if (roomRef.current?.roomId === current.roomId) {
        setRoomError(`Не удалось обновить комнату: ${err.message || err}`);
      }
    } finally {
      resumeInFlightRef.current = false;
      if (forceSse && roomRef.current?.roomId === current.roomId) {
        setSseGeneration((g) => g + 1);
      }
    }
  }, [applyAuthoritativeState]);

  useEffect(() => {
    if (!room?.roomId) return undefined;

    const onHidden = () => {
      hiddenAtRef.current = Date.now();
    };

    const onResume = () => {
      if (document.visibilityState === 'hidden') {
        onHidden();
        return;
      }
      const awayMs = hiddenAtRef.current
        ? Date.now() - hiddenAtRef.current
        : Number.POSITIVE_INFINITY;
      hiddenAtRef.current = 0;
      // Ignore quick tab flickers; phone lock / long background usually >2s.
      if (awayMs < 2000) return;
      resumeLiveSync({ forceSse: true });
    };

    document.addEventListener('visibilitychange', onResume);
    // iOS Safari bfcache restore
    window.addEventListener('pageshow', onResume);
    window.addEventListener('online', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener('online', onResume);
    };
  }, [room?.roomId, resumeLiveSync]);

  const dispatch = useCallback((action) => {
    if (!action || typeof action !== 'object') return;

    const CLOCK_ACTIONS = new Set([
      'START_ROUND',
      'NEXT_TURN',
      'PASS_TURN',
      'ELIMINATE_PLAYER',
      'END_ROUND',
      'CONFIRM_STATUS_PHASE',
      'FINISH_AGENDA_PHASE',
      'OPEN_DRAFT',
      'PICK_CARD',
      'UNDO_PICK',
      'PLAY_STRATEGY',
      'RESOLVE_STRATEGY',
      'CONFIRM_IMPERIAL_CLAIM',
      'PASS_IMPERIAL_CLAIM',
      'RESEARCH_TECH',
      'PASS_TECH_RESEARCH',
    ]);
    const stamped = CLOCK_ACTIONS.has(action.type) && !Number.isFinite(action.at)
      ? { ...action, at: Date.now() }
      : action;

    const current = roomRef.current;

    // Solo, or local-only ticks
    if (!current?.roomId || LOCAL_ONLY_ACTIONS.has(stamped.type)) {
      if (stamped.type === 'UNDO_LAST') {
        const { stack, state: prev } = popUndoSnapshot(soloUndoStackRef.current);
        if (!prev) return;
        soloUndoStackRef.current = stack;
        setCanUndo(undoStackDepth(stack) > 0);
        setGame({ type: '__REPLACE__', state: prev });
        return;
      }
      if (stamped.type !== 'TICK') {
        const before = gameRef.current;
        const after = reduceGame(before, stamped);
        if (after !== before) {
          soloUndoStackRef.current = stamped.type === 'RESET_GAME'
            ? []
            : pushUndoSnapshot(soloUndoStackRef.current, before);
          setCanUndo(undoStackDepth(soloUndoStackRef.current) > 0);
        }
      }
      setGame(stamped);
      return;
    }

    // Viewer: ignore mutations client-side
    if (current.role === ROLES.VIEWER) {
      setRoomError('Зритель не может менять игру');
      return;
    }

    // Soft client gate (server still enforces) + mirror authorizeAction to avoid
    // optimistic UI flashes for forbidden PASS_TURN / SET_SPEAKER / etc.
    if (current.role === ROLES.PLAYER) {
      const soft = [
        'PICK_CARD', 'UNDO_PICK', 'PLAY_STRATEGY', 'RESOLVE_STRATEGY', 'COMMIT_POLITICS_PEEK',
        'PASS_TURN', 'NEXT_TURN',
        'SELECT_SCORING_PUBLIC', 'TOGGLE_SCORING_SECRET',
        'SCORE_SECRET', 'UNSCORE_SECRET',
        'CONFIRM_OBJECTIVE_SCORING', 'PASS_OBJECTIVE_SCORING',
        'SELECT_IMPERIAL_PUBLIC', 'TOGGLE_IMPERIAL_MECATOL', 'TOGGLE_IMPERIAL_SECRET',
        'CONFIRM_IMPERIAL_CLAIM', 'PASS_IMPERIAL_CLAIM',
        'RESEARCH_TECH', 'PASS_TECH_RESEARCH', 'SET_TECH_IGNORE_PREREQ', 'TOGGLE_TECH',
        'CLAIM_EXPEDITION_SLICE', 'RESOLVE_THUNDERS_EDGE_CONTROL',
        'SET_SPEAKER',
        'SET_INFLUENCE', 'LOCK_INFLUENCE', 'SET_VOTE', 'LOCK_VOTE',
        'REVEAL_AGENDA',
        'REVEAL_COVERT_AGENDA',
        'SELECT_MISCOUNT_LAW',
        'SET_SPEAKER_AGENDA_DECISION',
        'FINISH_AGENDA_PHASE',
        'SET_STARTING_TECH_PICK', 'CONFIRM_STARTING_TECH',
        'KEEP_SECRET_DRAFT', 'DRAW_SECRET', 'DISCARD_SECRET', 'DISMISS_SECRET_REVEAL', 'EXCHANGE_SECRET',
        'UPDATE_PLAYER',
        'START_COMBAT', 'COMBAT_SET_OPPONENT', 'COMBAT_SET_NEUTRAL_COUNTS', 'COMBAT_BEGIN_NEUTRAL',
        'COMBAT_SET_HITS', 'COMBAT_ASSIGN',
        'COMBAT_DECLARE_RETREAT', 'COMBAT_RESOLVE_RETREAT', 'COMBAT_DEFEAT',
        'END_COMBAT',
      ];
      if (!soft.includes(stamped.type)) {
        setRoomError('Только админ может это сделать');
        return;
      }
      const gate = softAuthorizeOptimistic(authorizeAction({
        role: current.role,
        seatPlayerId: current.seatPlayerId,
        action: stamped,
        state: gameRef.current,
      }));
      if (!gate.ok) {
        setRoomError(playerGateMessage(gate.error));
        return;
      }
    }

    if (current.role === ROLES.ADMIN) {
      const gate = softAuthorizeOptimistic(authorizeAction({
        role: current.role,
        seatPlayerId: current.seatPlayerId ?? null,
        action: stamped,
        state: gameRef.current,
      }));
      if (!gate.ok) {
        setRoomError(
          gate.error === 'victory-locked'
            ? 'Партия на паузе победы: процессы заблокированы. Откатите ПО или правьте табло.'
            : playerGateMessage(gate.error),
        );
        return;
      }
    }

    // Live undo: wait for server snapshot (no local optimistic reduce).
    if (stamped.type !== 'UNDO_LAST') {
      setGame(stamped);
    }
    const roomId = current.roomId;
    postRoomAction(roomId, stamped, {
      sessionToken: current.sessionToken,
      hostKey: current.hostKey,
    })
      .then((result) => {
        const parsed = parseRoomActionResult(result) || result;
        applyAuthoritativeState(parsed.seq, parsed.state, {
          canUndo: typeof parsed.canUndo === 'boolean' ? parsed.canUndo : undefined,
        });
        setRoomError(null);
      })
      .catch((err) => {
        console.error('[room] action failed', err);
        const message = String(err.message || err);
        if (message === 'unauthorized' || message.includes('unauthorized')) {
          sessionGenRef.current += 1;
          roomRef.current = null;
          clearRoomSession();
          setRoom(null);
          setRoomStatus('solo');
          clearSoloUndo();
          setGame({ type: 'RESET_GAME' });
          setRoomError('Сессия места устарела. Войдите в комнату снова со своим кодом места.');
          setSyncLink('idle');
          return;
        }
        setRoomError(message);
        fetchRoomSnapshot(roomId, { sessionToken: current.sessionToken })
          .then((snap) => {
            applyAuthoritativeState(snap?.seq, snap?.state, {
              claimedSeats: snap?.claimedSeats,
              canUndo: typeof snap?.canUndo === 'boolean' ? snap.canUndo : undefined,
            });
          })
          .catch(() => {});
      });
  }, [applyAuthoritativeState, clearSoloUndo]);

  const startHostRoom = useCallback(async (createSecret, { milty } = {}) => {
    const gen = sessionGenRef.current;
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const created = await createRoom(milty ? null : game, { createSecret, milty });
      if (sessionGenRef.current !== gen) return created;
      seqRef.current = created.seq || 0;
      clearSoloUndo();
      setCanUndo(typeof created.canUndo === 'boolean' ? created.canUndo : false);
      if (created.state) {
        setGame({ type: '__REPLACE__', state: created.state });
      }
      const next = {
        roomId: created.roomId,
        hostKey: created.hostKey,
        sessionToken: created.sessionToken,
        seq: created.seq || 0,
        role: ROLES.ADMIN,
        seatPlayerId: null,
        claimedSeats: created.claimedSeats || [],
        milty: created.milty || null,
        phase: created.phase || (created.milty?.status === 'drafting' ? 'milty' : 'setup'),
        miltyAdminSecret: created.miltyAdminSecret || null,
        miltySecret: null,
        hostOnline: true,
      };
      roomRef.current = next;
      setRoom(next);
      saveRoomSession(next);
      rememberRecentRoom({ roomId: next.roomId, role: ROLES.ADMIN, seatPlayerId: null });
      setRoomStatus('live');
      return created;
    } catch (err) {
      if (sessionGenRef.current !== gen) throw err;
      setRoomStatus('error');
      setRoomError(String(err.message || err));
      throw err;
    }
  }, [game, clearSoloUndo]);

  const promoteMiltyToSetup = useCallback(async () => {
    const current = roomRef.current;
    if (!current?.roomId || !current.hostKey) throw new Error('no-room');
    const view = await promoteMiltyRoom(current.roomId, { hostKey: current.hostKey });
    if (view?.state) {
      setGame({ type: '__REPLACE__', state: view.state });
    }
    setRoom((prev) => (prev ? {
      ...prev,
      seq: view.seq ?? prev.seq,
      milty: view.milty ?? prev.milty,
      phase: view.phase || 'setup',
      claimedSeats: view.claimedSeats ?? prev.claimedSeats,
    } : prev));
    return view;
  }, []);

  const claimHostByKey = useCallback(async (roomId, hostKey) => {
    const id = String(roomId || '').trim().toUpperCase();
    const key = String(hostKey || '').trim();
    if (!id) throw new Error('missing-room');
    if (!key) throw new Error('missing-host-key');
    const gen = sessionGenRef.current;
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const claimed = await claimHostSession(id, { hostKey: key });
      if (sessionGenRef.current !== gen) return claimed;
      seqRef.current = claimed.seq || 0;
      if (claimed.state) {
        setGame({ type: '__REPLACE__', state: claimed.state });
      }
      clearSoloUndo();
      setCanUndo(typeof claimed.canUndo === 'boolean' ? claimed.canUndo : false);
      if (claimed.seatSecret && claimed.seatPlayerId != null) {
        saveSeatSecret(claimed.roomId || id, claimed.seatPlayerId, claimed.seatSecret);
      }
      const next = {
        roomId: claimed.roomId || id,
        hostKey: claimed.hostKey || key,
        sessionToken: claimed.sessionToken,
        seq: claimed.seq || 0,
        role: ROLES.ADMIN,
        seatPlayerId: claimed.seatPlayerId ?? null,
        seatSecret: claimed.seatSecret || null,
        claimedSeats: claimed.claimedSeats || [],
        milty: claimed.milty || null,
        phase: claimed.phase || (claimed.milty?.status === 'drafting' ? 'milty' : 'setup'),
        miltySecret: null,
        miltyAdminSecret: claimed.miltyAdminSecret || null,
        hostOnline: true,
      };
      roomRef.current = next;
      setRoom(next);
      saveRoomSession(next);
      rememberRecentRoom({
        roomId: next.roomId,
        role: ROLES.ADMIN,
        seatPlayerId: next.seatPlayerId,
      });
      setRoomStatus('live');
      return claimed;
    } catch (err) {
      if (sessionGenRef.current !== gen) throw err;
      setRoomStatus('error');
      setRoomError(String(err.message || err));
      throw err;
    }
  }, [clearSoloUndo]);

  const joinRoomById = useCallback(async (roomId, { role, seatPlayerId, seatSecret } = {}) => {
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('missing-room');
    const joinRole = role === ROLES.VIEWER ? ROLES.VIEWER : ROLES.PLAYER;
    const gen = sessionGenRef.current;
    // Status-only: do not stub `room` here — a roomId without sessionToken
    // would save to sessionStorage and open SSE too early.
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const joined = await joinRoom(id, {
        role: joinRole,
        seatPlayerId: joinRole === ROLES.PLAYER ? seatPlayerId : undefined,
        seatSecret: joinRole === ROLES.PLAYER ? seatSecret : undefined,
      });
      if (sessionGenRef.current !== gen) return joined;
      seqRef.current = joined.seq || 0;
      setGame({ type: '__REPLACE__', state: joined.state });
      clearSoloUndo();
      setCanUndo(typeof joined.canUndo === 'boolean' ? joined.canUndo : false);
      if (joined.seatSecret && joined.seatPlayerId != null) {
        saveSeatSecret(joined.roomId || id, joined.seatPlayerId, joined.seatSecret);
      }
      const next = {
        roomId: joined.roomId || id,
        hostKey: null,
        sessionToken: joined.sessionToken,
        seq: joined.seq || 0,
        role: joined.role,
        seatPlayerId: joined.seatPlayerId ?? null,
        seatSecret: joined.seatSecret || null,
        claimedSeats: joined.claimedSeats || [],
        milty: joined.milty || null,
        phase: joined.phase || (joined.milty?.status === 'drafting' ? 'milty' : 'setup'),
        miltySecret: joined.miltySecret || null,
        miltyAdminSecret: null,
        hostOnline: joined.hostOnline !== false,
      };
      roomRef.current = next;
      setRoom(next);
      saveRoomSession(next);
      rememberRecentRoom({
        roomId: next.roomId,
        role: next.role,
        seatPlayerId: next.seatPlayerId,
      });
      setRoomStatus('live');
      return joined;
    } catch (err) {
      if (sessionGenRef.current !== gen) throw err;
      setRoomStatus('error');
      setRoomError(String(err.message || err));
      throw err;
    }
  }, [clearSoloUndo]);

  const releaseSeatById = useCallback(async (seatPlayerId) => {
    const current = roomRef.current;
    if (!current?.roomId) throw new Error('no-room');
    const result = await releaseSeatApi(current.roomId, {
      seatPlayerId,
      sessionToken: current.sessionToken,
      hostKey: current.hostKey,
    });
    setRoom(prev => (prev ? {
      ...prev,
      claimedSeats: result.claimedSeats ?? prev.claimedSeats,
      seatPlayerId: String(prev.seatPlayerId) === String(seatPlayerId) ? null : prev.seatPlayerId,
      seatSecret: String(prev.seatPlayerId) === String(seatPlayerId) ? null : prev.seatSecret,
      miltySecret: String(prev.seatPlayerId) === String(seatPlayerId) ? null : prev.miltySecret,
    } : prev));
    return result;
  }, []);

  const claimHostSeatById = useCallback(async (seatPlayerId) => {
    const current = roomRef.current;
    if (!current?.roomId || !current.hostKey) throw new Error('no-host');
    const result = await claimHostSeatApi(current.roomId, {
      seatPlayerId,
      sessionToken: current.sessionToken,
      hostKey: current.hostKey,
    });
    if (result.seatSecret && result.seatPlayerId != null) {
      saveSeatSecret(current.roomId, result.seatPlayerId, result.seatSecret);
    }
    setRoom(prev => (prev ? {
      ...prev,
      claimedSeats: result.claimedSeats ?? prev.claimedSeats,
      seatPlayerId: result.seatPlayerId ?? null,
      seatSecret: result.seatSecret || prev.seatSecret,
      miltySecret: result.miltySecret || prev.miltySecret,
      role: ROLES.ADMIN,
    } : prev));
    return result;
  }, []);

  const leaveRoom = useCallback(async () => {
    const current = roomRef.current;

    // Host leave ends the party so the hub drops the room.
    if (current?.roomId && (current.role === ROLES.ADMIN || current.hostKey)) {
      try {
        await postRoomAction(current.roomId, { type: 'RESET_GAME' }, {
          sessionToken: current.sessionToken,
          hostKey: current.hostKey,
        });
      } catch (err) {
        console.error('[room] end party on host leave failed', err);
      }
    } else if (
      // Player leave must free the seat so the host stops seeing "online".
      current?.roomId
      && current.role === ROLES.PLAYER
      && current.seatPlayerId != null
      && current.sessionToken
    ) {
      try {
        await releaseSeatApi(current.roomId, {
          seatPlayerId: current.seatPlayerId,
          sessionToken: current.sessionToken,
        });
      } catch (err) {
        console.error('[room] release seat on leave failed', err);
      }
      clearSeatSecret(current.roomId, current.seatPlayerId);
    }

    sessionGenRef.current += 1;
    roomRef.current = null;
    clearRoomSession();
    clearGameState();
    clearSoloUndo();
    setGame({ type: 'RESET_GAME' });
    setRoom(null);
    setRoomStatus('solo');
    setRoomError(null);
    setSyncLink('idle');
    seqRef.current = 0;
  }, [clearSoloUndo]);

  const dismissRoomError = useCallback(() => {
    setRoomError(null);
  }, []);

  /** End the live party for everyone, then return this client to the hub. */
  const resetLocalGame = useCallback(async () => {
    await leaveRoom();
  }, [leaveRoom]);

  const role = roomStatus === 'solo'
    ? ROLES.ADMIN
    : (room?.role || ROLES.VIEWER);
  const perms = {
    role,
    seatPlayerId: room?.seatPlayerId ?? null,
    isSolo: roomStatus === 'solo',
    isLive: roomStatus === 'live',
    can: (capability) => can(role, capability),
  };

  return {
    game,
    dispatch,
    room,
    roomStatus,
    roomError,
    syncLink,
    resumeLiveSync,
    dismissRoomError,
    perms,
    canUndo,
    startHostRoom,
    promoteMiltyToSetup,
    joinRoomById,
    claimHostByKey,
    releaseSeatById,
    claimHostSeatById,
    leaveRoom,
    resetLocalGame,
  };
}
