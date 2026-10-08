import type { GameState, Role } from '../game/types';

/** Public HTTP/SSE payload for a live room (never includes hostKey / undoStack). */
export interface RoomPublicView {
  roomId: string;
  seq: number;
  state: GameState;
  updatedAt: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  expiresAt: string | null;
  claimedSeats: Array<number | string>;
  canUndo: boolean;
}

/** Successful POST /actions response body. */
export interface RoomActionResult {
  seq: number;
  state: GameState;
  noop: boolean;
  canUndo: boolean;
}

/** Fields allowed on join / hello beyond the public view. */
export interface RoomSessionJoin extends RoomPublicView {
  sessionToken?: string;
  hostKey?: string;
  role?: Role;
  seatPlayerId?: number | null;
  seatSecret?: string | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Soft validate a public room snapshot. Returns null when unusable.
 * Does not deep-validate the full game tree — normalizeGameState handles that.
 */
export function parseRoomPublicView(raw: unknown): RoomPublicView | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.roomId !== 'string' || !raw.roomId || raw.roomId.length > 32) return null;
  if (typeof raw.seq !== 'number' || !Number.isFinite(raw.seq) || raw.seq < 0) return null;
  if (!isRecord(raw.state)) return null;

  // Soft shape check — full normalize happens in gameState.
  const state = raw.state;
  if (state.players != null && !Array.isArray(state.players)) return null;
  if (state.players && state.players.length > 16) return null;
  if (state.meta != null && !isRecord(state.meta)) return null;
  if (state.version != null && typeof state.version !== 'number') return null;

  const claimedSeats = Array.isArray(raw.claimedSeats) ? raw.claimedSeats.slice(0, 16) : [];

  return {
    roomId: raw.roomId,
    seq: raw.seq,
    state: state as unknown as GameState,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    lastActivityAt: typeof raw.lastActivityAt === 'string' ? raw.lastActivityAt : null,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : null,
    claimedSeats: claimedSeats as Array<number | string>,
    canUndo: !!raw.canUndo,
  };
}

export function parseRoomActionResult(raw: unknown): RoomActionResult | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.seq !== 'number' || !Number.isFinite(raw.seq)) return null;
  if (!isRecord(raw.state)) return null;
  return {
    seq: raw.seq,
    state: raw.state as unknown as GameState,
    noop: !!raw.noop,
    canUndo: !!raw.canUndo,
  };
}
