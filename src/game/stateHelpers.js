/** Shared immutable game-state patch helpers (used by reducer slices). */

export const mapPlayers = (state, fn) => ({
  ...state,
  players: state.players.map(fn),
});

export const patchPlayer = (state, playerId, patch) => mapPlayers(state, (player) => (
  player.id === playerId ? { ...player, ...patch(player) } : player
));

export const withRound = (state, round) => ({
  ...state,
  round: { ...state.round, ...round },
});

export const withDraft = (state, draft) => ({
  ...state,
  draft: { ...state.draft, ...draft },
});

export const withMeta = (state, meta) => ({
  ...state,
  meta: { ...state.meta, ...meta },
});

export const withPolitics = (state, politics) => ({
  ...state,
  politics: { ...state.politics, ...politics },
});

export const withObjectives = (state, objectives) => ({
  ...state,
  objectives: { ...state.objectives, ...objectives },
});

export const withStatusPhase = (state, statusPhase) => ({
  ...state,
  statusPhase: { ...state.statusPhase, ...statusPhase },
});

export const withExpedition = (state, expedition) => ({
  ...state,
  expedition: { ...state.expedition, ...expedition },
});
