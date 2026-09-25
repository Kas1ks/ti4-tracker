import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { clearGameState, loadGameState, saveGameState, stampGameState } from '../game/gameState';
import { reduceGame } from '../game/gameEvents';
import { can, ROLES } from './permissions';
import {
  clearRoomSession,
  loadRoomSession,
  saveRoomSession,
} from './roomSession';
import {
  LOCAL_ONLY_ACTIONS,
  createRoom,
  fetchRoomSnapshot,
  joinRoom,
  postRoomAction,
  releaseSeat as releaseSeatApi,
  subscribeRoom,
} from './roomApi';
import { loadSeatSecret, saveSeatSecret } from './seatSecrets';
import {
  popUndoSnapshot,
  pushUndoSnapshot,
  undoStackDepth,
} from './undoStack';

function syncedReducer(state, action) {
  if (action?.type === '__REPLACE__') return action.state;
  return reduceGame(state, action);
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
  const [canUndo, setCanUndo] = useState(false);
  const seqRef = useRef(loadRoomSession()?.seq || 0);
  const roomRef = useRef(null);
  const gameRef = useRef(game);
  const soloUndoStackRef = useRef([]);
  gameRef.current = game;

  const clearSoloUndo = useCallback(() => {
    soloUndoStackRef.current = [];
    setCanUndo(false);
  }, []);

  /** Apply server/SSE state only if seq is not older than what we already have. */
  const applyAuthoritativeState = useCallback((seq, state, extras = {}) => {
    if (!state) return false;
    if (typeof seq === 'number') {
      if (seq < seqRef.current) return false;
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

    let cancelled = false;
    setRoomStatus('connecting');

    fetchRoomSnapshot(saved.roomId)
      .then((snap) => {
        if (cancelled) return;
        if (!snap?.state) throw new Error('not-found');
        seqRef.current = typeof snap.seq === 'number' ? snap.seq : (saved.seq || 0);
        setGame({ type: '__REPLACE__', state: snap.state });
        if (typeof snap.canUndo === 'boolean') setCanUndo(snap.canUndo);
        setRoom({
          roomId: saved.roomId,
          hostKey: saved.hostKey,
          sessionToken: saved.sessionToken,
          role: saved.role || ROLES.VIEWER,
          seatPlayerId: saved.seatPlayerId ?? null,
          seatSecret: loadSeatSecret(saved.roomId, saved.seatPlayerId),
          seq: seqRef.current,
          claimedSeats: snap.claimedSeats || [],
        });
        setRoomStatus('live');
        setRoomError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        clearRoomSession();
        setRoom(null);
        setRoomStatus('solo');
        setRoomError(`Комната недоступна: ${err.message || err}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room?.roomId) return undefined;

    const ejectStaleSession = (message) => {
      clearRoomSession();
      setRoom(null);
      setRoomStatus('solo');
      clearSoloUndo();
      setGame({ type: 'RESET_GAME' });
      setRoomError(message);
    };

    const unsubscribe = subscribeRoom(room.roomId, (msg) => {
      if (msg.type === 'seats') {
        const current = roomRef.current;
        const kicked = current?.role === ROLES.PLAYER
          && msg.revokedSessionToken
          && current.sessionToken === msg.revokedSessionToken;
        if (kicked) {
          clearGameState();
          ejectStaleSession(
            msg.seatRemoved
              ? 'Хост удалил ваше место.'
              : msg.released
                ? 'Хост освободил ваше место. Войдите снова, когда будете готовы.'
                : 'Место занято с другого устройства. Войдите снова со своим кодом места.',
          );
          return;
        }
        setRoom(prev => (prev ? {
          ...prev,
          claimedSeats: msg.claimedSeats ?? prev.claimedSeats,
        } : prev));
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
          );
          return;
        }

        applyAuthoritativeState(msg.seq, msg.state, {
          claimedSeats: msg.claimedSeats,
          canUndo: typeof msg.canUndo === 'boolean' ? msg.canUndo : undefined,
        });
      }
    });

    return unsubscribe;
  }, [room?.roomId, applyAuthoritativeState, clearSoloUndo]);

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

    // Soft client gate (server still enforces)
    if (current.role === ROLES.PLAYER) {
      const soft = [
        'PICK_CARD', 'UNDO_PICK', 'PLAY_STRATEGY', 'RESOLVE_STRATEGY', 'PASS_TURN', 'NEXT_TURN',
        'SELECT_SCORING_PUBLIC', 'TOGGLE_SCORING_SECRET',
        'CONFIRM_OBJECTIVE_SCORING', 'PASS_OBJECTIVE_SCORING',
        'SELECT_IMPERIAL_PUBLIC', 'TOGGLE_IMPERIAL_MECATOL', 'TOGGLE_IMPERIAL_SECRET',
        'CONFIRM_IMPERIAL_CLAIM', 'PASS_IMPERIAL_CLAIM',
        'RESEARCH_TECH', 'PASS_TECH_RESEARCH', 'SET_TECH_IGNORE_PREREQ', 'TOGGLE_TECH',
        'CLAIM_EXPEDITION_SLICE', 'RESOLVE_THUNDERS_EDGE_CONTROL',
        'SET_SPEAKER',
        'SET_INFLUENCE', 'LOCK_INFLUENCE', 'SET_VOTE', 'LOCK_VOTE',
        'FINISH_AGENDA_PHASE',
        'SET_STARTING_TECH_PICK', 'CONFIRM_STARTING_TECH',
      ];
      if (!soft.includes(stamped.type)) {
        setRoomError('Только админ может это сделать');
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
        applyAuthoritativeState(result.seq, result.state, {
          canUndo: typeof result.canUndo === 'boolean' ? result.canUndo : undefined,
        });
        setRoomError(null);
      })
      .catch((err) => {
        console.error('[room] action failed', err);
        const message = String(err.message || err);
        if (message === 'unauthorized' || message.includes('unauthorized')) {
          clearRoomSession();
          setRoom(null);
          setRoomStatus('solo');
          clearSoloUndo();
          setGame({ type: 'RESET_GAME' });
          setRoomError('Сессия места устарела. Войдите в комнату снова со своим кодом места.');
          return;
        }
        setRoomError(message);
        fetchRoomSnapshot(roomId)
          .then((snap) => {
            applyAuthoritativeState(snap?.seq, snap?.state, {
              claimedSeats: snap?.claimedSeats,
              canUndo: typeof snap?.canUndo === 'boolean' ? snap.canUndo : undefined,
            });
          })
          .catch(() => {});
      });
  }, [applyAuthoritativeState, clearSoloUndo]);

  const startHostRoom = useCallback(async (createSecret) => {
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const created = await createRoom(game, { createSecret });
      seqRef.current = created.seq || 0;
      clearSoloUndo();
      setCanUndo(typeof created.canUndo === 'boolean' ? created.canUndo : false);
      const next = {
        roomId: created.roomId,
        hostKey: created.hostKey,
        sessionToken: created.sessionToken,
        seq: created.seq || 0,
        role: ROLES.ADMIN,
        seatPlayerId: null,
        claimedSeats: created.claimedSeats || [],
      };
      setRoom(next);
      saveRoomSession(next);
      setRoomStatus('live');
      return created;
    } catch (err) {
      setRoomStatus('error');
      setRoomError(String(err.message || err));
      throw err;
    }
  }, [game, clearSoloUndo]);

  const joinRoomById = useCallback(async (roomId, { role, seatPlayerId, seatSecret } = {}) => {
    const id = String(roomId || '').trim().toUpperCase();
    if (!id) throw new Error('missing-room');
    const joinRole = role === ROLES.VIEWER ? ROLES.VIEWER : ROLES.PLAYER;
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const joined = await joinRoom(id, {
        role: joinRole,
        seatPlayerId: joinRole === ROLES.PLAYER ? seatPlayerId : undefined,
        seatSecret: joinRole === ROLES.PLAYER ? seatSecret : undefined,
      });
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
      };
      setRoom(next);
      saveRoomSession(next);
      setRoomStatus('live');
      return joined;
    } catch (err) {
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
    } : prev));
    return result;
  }, []);

  const leaveRoom = useCallback(() => {
    clearRoomSession();
    clearGameState();
    clearSoloUndo();
    setGame({ type: 'RESET_GAME' });
    setRoom(null);
    setRoomStatus('solo');
    setRoomError(null);
    seqRef.current = 0;
  }, [clearSoloUndo]);

  /** End the live party for everyone, then return this client to the hub. */
  const resetLocalGame = useCallback(async () => {
    const current = roomRef.current;

    if (current?.roomId && (current.role === ROLES.ADMIN || current.hostKey)) {
      try {
        await postRoomAction(current.roomId, { type: 'RESET_GAME' }, {
          sessionToken: current.sessionToken,
          hostKey: current.hostKey,
        });
      } catch (err) {
        console.error('[room] end party failed', err);
      }
    }

    leaveRoom();
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
    perms,
    canUndo,
    startHostRoom,
    joinRoomById,
    releaseSeatById,
    leaveRoom,
    resetLocalGame,
  };
}
