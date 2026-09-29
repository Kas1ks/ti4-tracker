/**
 * Core game document types (strict boundary for sync + reducer).
 * JS modules import these only for editors / tsc; runtime stays JS-friendly.
 */

export type TechColor = 'green' | 'blue' | 'yellow' | 'red';

export type Role = 'admin' | 'player' | 'viewer';

export interface Player {
  id: number;
  name: string;
  factionId: string;
  color: string;
  secrets: number;
  extra: number;
  totalTime: number;
  damageDealt: number;
  eliminated: boolean;
  cards: Array<{ id: number; name?: string }>;
  playedCardIds: number[];
  strategyPlayed: boolean;
  breakthrough: boolean;
  techIds: string[];
  startingTechIds: string[];
  passed?: boolean;
}

export interface GameMeta {
  targetScore: number;
  roundNumber: number;
  usePok: boolean;
  useTe: boolean;
  speakerId: number | null;
  isPoliticsActive: boolean;
  isAgendaPhasePending: boolean;
}

export interface GameRound {
  active: boolean;
  turnOrderIds: number[];
  activeTurnIdx: number;
  passed: Record<string | number, boolean>;
  turnTime: number;
  turnStartedAt: number | null;
  turnPausedAccum: number;
  strategyActionTaken: boolean;
  expeditionClaimedThisTurn: boolean;
  expeditionClaimedSliceId: string | null;
  strategyResolution: Record<string, unknown>;
  imperialClaim: Record<string, unknown>;
  techResearch: Record<string, unknown>;
}

export interface ExpeditionState {
  slices: Record<string, number | null>;
  completed: boolean;
  controllerId: number | null;
  placedById: number | null;
  awaitingControlPick: boolean;
}

/** Nested game document stored in rooms and localStorage. */
export interface GameState {
  version: number;
  isGameActive: boolean;
  meta: GameMeta;
  players: Player[];
  objectives: Record<string, unknown>;
  vpTrack: Record<string, unknown>;
  round: GameRound;
  draft: Record<string, unknown>;
  politics: Record<string, unknown>;
  statusPhase: Record<string, unknown>;
  expedition: ExpeditionState;
  startingTechDraft: Record<string, unknown>;
  log: { events: Array<Record<string, unknown>> };
  timestamp?: number;
  updatedAt?: number;
}

/** Client → server action envelope (type required; rest is action-specific). */
export interface GameAction {
  type: string;
  at?: number;
  playerId?: number;
  [key: string]: unknown;
}
