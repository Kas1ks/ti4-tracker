import { EXPEDITION_SLICE_IDS, emptyExpeditionSlices } from '../data/expedition';
import { breakthroughStartsUnlocked } from '../data/breakthroughs';
import { emptySecretObjectives, putSecretsUnderDeck } from './secretDeck';
import { activePlayer } from './selectors';
import { patchPlayer, withExpedition, withRound } from './stateHelpers';

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function discardSecretFromHand(state, playerId, cardId) {
  const player = state.players.find((p) => sameId(p.id, playerId));
  if (!player) return null;
  const hand = Array.isArray(player.secretHand) ? player.secretHand : [];
  if (!hand.some((id) => sameId(id, cardId))) return null;
  const nextHand = hand.filter((id) => !sameId(id, cardId));
  const deck = putSecretsUnderDeck(state.secretObjectives?.deck || [], [cardId]);
  return {
    ...patchPlayer(state, player.id, () => ({ secretHand: nextHand })),
    secretObjectives: {
      ...(state.secretObjectives || emptySecretObjectives()),
      deck,
    },
  };
}

function expeditionOf(state) {
  return state.expedition || {
    slices: emptyExpeditionSlices(),
    completed: false,
    controllerId: null,
    placedById: null,
    awaitingControlPick: false,
  };
}

function sliceCounts(slices) {
  const counts = {};
  Object.values(slices || {}).forEach((playerId) => {
    if (playerId == null) return;
    counts[playerId] = (counts[playerId] || 0) + 1;
  });
  return counts;
}

function expeditionLeaders(slices) {
  const counts = sliceCounts(slices);
  let best = 0;
  Object.values(counts).forEach((n) => { if (n > best) best = n; });
  if (best <= 0) return [];
  return Object.entries(counts)
    .filter(([, n]) => n === best)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));
}

function claimedSliceCount(slices) {
  return Object.values(slices || {}).filter((id) => id != null).length;
}

export function claimExpeditionSlice(state, playerId, sliceId, cardId = null) {
  if (!state.meta?.useTe || !state.isGameActive) return state;
  if (!state.round?.active) return state;
  if (!EXPEDITION_SLICE_IDS.includes(sliceId)) return state;
  if (!sameId(activePlayer(state)?.id, playerId)) return state;
  if (state.round?.passed?.[playerId] || state.round?.passed?.[String(playerId)]) return state;
  if (state.round?.expeditionClaimedThisTurn) return state;

  const expedition = expeditionOf(state);
  if (expedition.completed || expedition.awaitingControlPick) return state;
  if (expedition.slices?.[sliceId] != null) return state;

  const player = state.players.find((p) => sameId(p.id, playerId));
  if (!player || player.eliminated) return state;

  const hand = Array.isArray(player.secretHand) ? player.secretHand : [];
  // Secret slice: must discard an unscored secret from hand.
  let discardId = cardId;
  if (sliceId === 'secret') {
    if (!hand.length) return state;
    if (!discardId || !hand.some((id) => sameId(id, discardId))) {
      discardId = hand.length === 1 ? hand[0] : null;
    }
    if (!discardId) return state;
  }

  let next = state;
  if (sliceId === 'secret') {
    const discarded = discardSecretFromHand(next, player.id, discardId);
    if (!discarded) return state;
    next = discarded;
  }

  const slices = { ...expedition.slices, [sliceId]: player.id };
  next = withRound(withExpedition(next, { slices }), {
    expeditionClaimedThisTurn: true,
    expeditionClaimedSliceId: sliceId,
  });

  const claimedPlayer = next.players.find((p) => sameId(p.id, player.id));
  if (claimedPlayer && !claimedPlayer.breakthrough) {
    next = patchPlayer(next, player.id, () => ({ breakthrough: true }));
  }

  if (claimedSliceCount(slices) < EXPEDITION_SLICE_IDS.length) {
    return next;
  }

  const leaders = expeditionLeaders(slices);
  if (leaders.length === 1) {
    return withExpedition(next, {
      completed: true,
      placedById: player.id,
      controllerId: leaders[0],
      awaitingControlPick: false,
    });
  }

  return withExpedition(next, {
    completed: false,
    placedById: player.id,
    controllerId: null,
    awaitingControlPick: true,
  });
}

export function resolveThundersEdgeControl(state, pickerId, controllerId) {
  if (!state.meta?.useTe || !state.isGameActive) return state;
  const expedition = expeditionOf(state);
  if (!expedition.awaitingControlPick) return state;
  if (expedition.placedById !== pickerId) return state;

  const leaders = expeditionLeaders(expedition.slices);
  if (!leaders.includes(controllerId)) return state;

  return withExpedition(state, {
    completed: true,
    controllerId,
    awaitingControlPick: false,
  });
}

/**
 * Host correction: set or clear a slice marker, then recompute completion / control.
 * Does not consume the per-turn claim flag when assigning. Clearing the slice claimed
 * this turn restores the claim. Breakthrough follows remaining markers (Crimson keeps
 * the starting unlock).
 */
export function setExpeditionSlice(state, sliceId, playerId) {
  if (!state.meta?.useTe || !state.isGameActive) return state;
  if (!EXPEDITION_SLICE_IDS.includes(sliceId)) return state;

  const expedition = expeditionOf(state);
  const clear = playerId == null || playerId === '';
  let ownerId = null;
  if (!clear) {
    ownerId = Number(playerId);
    if (!Number.isFinite(ownerId)) return state;
    const player = state.players.find((p) => p.id === ownerId);
    if (!player || player.eliminated) return state;
  }

  const prevOwner = expedition.slices?.[sliceId] ?? null;
  if (clear && prevOwner == null) return state;
  if (!clear && prevOwner === ownerId) return state;

  const slices = { ...expedition.slices, [sliceId]: clear ? null : ownerId };
  let next = state;

  const affectedIds = new Set();
  if (prevOwner != null) affectedIds.add(prevOwner);
  if (!clear) affectedIds.add(ownerId);

  affectedIds.forEach((pid) => {
    const player = next.players.find((p) => p.id === pid);
    if (!player) return;
    const remains = Object.values(slices).filter((id) => id === pid).length;
    if (remains > 0) {
      if (!player.breakthrough) {
        next = patchPlayer(next, pid, () => ({ breakthrough: true }));
      }
      return;
    }
    if (player.breakthrough && !breakthroughStartsUnlocked(player.factionId)) {
      next = patchPlayer(next, pid, () => ({ breakthrough: false }));
    }
  });

  if (
    clear
    && state.round?.expeditionClaimedThisTurn
    && (
      state.round?.expeditionClaimedSliceId === sliceId
      || (
        state.round?.expeditionClaimedSliceId == null
        && prevOwner === activePlayer(state)?.id
      )
    )
  ) {
    next = withRound(next, {
      expeditionClaimedThisTurn: false,
      expeditionClaimedSliceId: null,
    });
  }

  const count = claimedSliceCount(slices);
  if (count < EXPEDITION_SLICE_IDS.length) {
    return withExpedition(next, {
      slices,
      completed: false,
      controllerId: null,
      placedById: null,
      awaitingControlPick: false,
    });
  }

  const leaders = expeditionLeaders(slices);
  if (leaders.length === 1) {
    return withExpedition(next, {
      slices,
      completed: true,
      placedById: clear ? expedition.placedById : ownerId,
      controllerId: leaders[0],
      awaitingControlPick: false,
    });
  }

  return withExpedition(next, {
    slices,
    completed: false,
    placedById: clear
      ? (expedition.placedById ?? leaders[0] ?? null)
      : ownerId,
    controllerId: null,
    awaitingControlPick: true,
  });
}
