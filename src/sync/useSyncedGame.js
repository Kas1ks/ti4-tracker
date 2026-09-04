import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { clearGameState, loadGameState, saveGameState, stampGameState } from '../game/gameState';
import { gameReducer } from '../game/gameReducer';
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

function syncedReducer(state, action) {
  if (action?.type === '__REPLACE__') return action.state;
  return gameReducer(state, action);
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
  const seqRef = useRef(loadRoomSession()?.seq || 0);
  const roomRef = useRef(null);

  useEffect(() => {
    saveGameState(stampGameState(game));
  }, [game]);

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
          ejectStaleSession(
            msg.released
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
        if (typeof msg.seq === 'number') {
          if (msg.seq < seqRef.current) return;
          seqRef.current = msg.seq;
        }
        setGame({ type: '__REPLACE__', state: msg.state });
        setRoom(prev => (prev ? {
          ...prev,
          seq: msg.seq ?? prev.seq,
          claimedSeats: msg.claimedSeats ?? prev.claimedSeats,
        } : prev));
      }
    });

    return unsubscribe;
  }, [room?.roomId]);

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
        'PICK_CARD', 'UNDO_PICK', 'PLAY_STRATEGY', 'PASS_TURN', 'NEXT_TURN',
        'SELECT_SCORING_PUBLIC', 'TOGGLE_SCORING_SECRET',
        'CONFIRM_OBJECTIVE_SCORING', 'PASS_OBJECTIVE_SCORING',
        'SET_SPEAKER',
        'SET_INFLUENCE', 'LOCK_INFLUENCE', 'SET_VOTE', 'LOCK_VOTE',
        'FINISH_AGENDA_PHASE',
      ];
      if (!soft.includes(stamped.type)) {
        setRoomError('Только админ может это сделать');
        return;
      }
    }

    setGame(stamped);
    const roomId = current.roomId;
    postRoomAction(roomId, stamped, {
      sessionToken: current.sessionToken,
      hostKey: current.hostKey,
    })
      .then((result) => {
        if (typeof result.seq === 'number') seqRef.current = result.seq;
        if (result.state) setGame({ type: '__REPLACE__', state: result.state });
        setRoomError(null);
      })
      .catch((err) => {
        console.error('[room] action failed', err);
        const message = String(err.message || err);
        if (message === 'unauthorized' || message.includes('unauthorized')) {
          clearRoomSession();
          setRoom(null);
          setRoomStatus('solo');
          setGame({ type: 'RESET_GAME' });
          setRoomError('Сессия места устарела. Войдите в комнату снова со своим кодом места.');
          return;
        }
        setRoomError(message);
        fetchRoomSnapshot(roomId)
          .then((snap) => {
            if (snap?.state) setGame({ type: '__REPLACE__', state: snap.state });
            if (typeof snap?.seq === 'number') seqRef.current = snap.seq;
          })
          .catch(() => {});
      });
  }, []);

  const startHostRoom = useCallback(async () => {
    setRoomStatus('connecting');
    setRoomError(null);
    try {
      const created = await createRoom(game);
      seqRef.current = created.seq || 0;
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
  }, [game]);

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
  }, []);

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
    setRoom(null);
    setRoomStatus('solo');
    setRoomError(null);
    seqRef.current = 0;
  }, []);

  const resetLocalGame = useCallback(() => {
    clearGameState();
    setGame({ type: 'RESET_GAME' });
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
    startHostRoom,
    joinRoomById,
    releaseSeatById,
    leaveRoom,
    resetLocalGame,
  };
}
