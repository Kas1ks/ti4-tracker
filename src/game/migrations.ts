/**
 * Explicit game-document migrations between GAME_STATE_VERSION values.
 * normalizeGameState always produces the latest shape; these helpers document
 * and test version steps for long-lived rooms / local saves.
 */

/** Bump when the nested document shape changes in a load-bearing way. */
export const GAME_STATE_VERSION = 2;

type LooseState = Record<string, unknown>;

function asRecord(value: unknown): LooseState {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseState
    : {};
}

/** v1 → v2: track which expedition slice was claimed this turn for host undo. */
function migrateV1ToV2(state: LooseState): LooseState {
  const round = asRecord(state.round);
  return {
    ...state,
    version: 2,
    round: {
      ...round,
      expeditionClaimedThisTurn: !!round.expeditionClaimedThisTurn,
      expeditionClaimedSliceId: round.expeditionClaimedSliceId ?? null,
    },
  };
}

const MIGRATIONS: Array<{
  from: number;
  to: number;
  run: (state: LooseState) => LooseState;
}> = [
  { from: 1, to: 2, run: migrateV1ToV2 },
];

/**
 * Walk version steps until GAME_STATE_VERSION. Unknown / missing version → treat as 1.
 */
export function migrateGameState(raw: unknown): LooseState {
  let state: LooseState = asRecord(raw);
  let version = typeof state.version === 'number' && Number.isFinite(state.version)
    ? state.version
    : 1;

  while (version < GAME_STATE_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) break;
    state = step.run(state);
    version = step.to;
    state.version = version;
  }

  if (typeof state.version !== 'number') {
    state = { ...state, version: GAME_STATE_VERSION };
  }

  return state;
}
