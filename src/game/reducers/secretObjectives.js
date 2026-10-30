import { shuffleArray } from '../../utils/game';
import {
  buildShuffledSecretDeck,
  canStartSecretDraft,
  drawRandomSecretsFromDeck,
  drawSecretsFromDeck,
  emptySecretObjectives,
  isSecretOverCap,
  overflowForPlayer,
  putSecretsUnderDeck,
  secretCapOf,
  withOverflow,
  withoutOverflow,
  withPendingReveal,
  withoutPendingReveal,
} from '../secretDeck';
import { patchPlayer, withRound, withStatusPhase } from '../stateHelpers';

const SECRET_ACTIONS = new Set([
  'START_SECRET_DRAFT',
  'KEEP_SECRET_DRAFT',
  'DRAW_SECRET',
  'DISCARD_SECRET',
  'DISMISS_SECRET_REVEAL',
  'SCORE_SECRET',
  'UNSCORE_SECRET',
  'RAISE_SECRET_CAP',
  'EXCHANGE_SECRET',
  'DEV_SKIP_SECRET_DRAFT',
]);

export function withSecretObjectives(state, patch) {
  return {
    ...state,
    secretObjectives: {
      ...(state.secretObjectives || emptySecretObjectives()),
      ...patch,
    },
  };
}

function secretOf(state) {
  return state.secretObjectives || emptySecretObjectives();
}

function activeSeats(state) {
  return (state.players || []).filter((p) => p && !p.eliminated);
}

function reshuffleRemainingDeck(deck, scoredIds) {
  const scored = new Set(scoredIds || []);
  const pool = (deck || []).filter((id) => typeof id === 'string' && id && !scored.has(id));
  const unique = [];
  const seen = new Set();
  pool.forEach((id) => {
    if (seen.has(id)) return;
    seen.add(id);
    unique.push(id);
  });
  return shuffleArray(unique);
}

function closeDraftIfComplete(state) {
  const seats = activeSeats(state);
  const stillDrafting = seats.some((p) => Array.isArray(p.secretDraft) && p.secretDraft.length > 0);
  if (stillDrafting) return state;

  const sec = secretOf(state);
  const deck = reshuffleRemainingDeck(sec.deck, sec.scored);
  return withSecretObjectives({
    ...state,
    players: state.players.map((p) => ({ ...p, secretDraft: null })),
  }, {
    deck,
    draftPending: false,
    dealStarted: true,
  });
}

function startSecretDraft(state) {
  if (!canStartSecretDraft(state)) return state;
  const usePok = !!state.meta?.usePok || !!state.meta?.useTe;
  let deck = buildShuffledSecretDeck(usePok);
  const seats = activeSeats(state);
  if (deck.length < seats.length * 2) return state;

  // Opening deal: random positions from the pool (not top draws).
  // Second shuffle happens later in closeDraftIfComplete after rejects return.
  const players = state.players.map((p) => {
    if (p.eliminated) {
      return {
        ...p,
        secretDraft: null,
        secretHand: Array.isArray(p.secretHand) ? p.secretHand : [],
      };
    }
    const drawn = drawRandomSecretsFromDeck(deck, 2);
    deck = drawn.deck;
    return {
      ...p,
      secretDraft: drawn.drawn,
      secretHand: Array.isArray(p.secretHand) ? p.secretHand : [],
      secretCap: secretCapOf(p),
    };
  });

  return withSecretObjectives({
    ...state,
    players,
  }, {
    deck,
    scored: [],
    dealStarted: true,
    draftPending: true,
  });
}

function keepSecretDraft(state, playerId, keepId) {
  const sec = secretOf(state);
  if (!sec.draftPending || !sec.dealStarted) return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;
  const draft = Array.isArray(player.secretDraft) ? player.secretDraft : [];
  if (!keepId || !draft.includes(keepId)) return state;

  const rejected = draft.filter((id) => id !== keepId);
  const hand = Array.isArray(player.secretHand) ? [...player.secretHand] : [];
  if (!hand.includes(keepId)) hand.push(keepId);

  let next = patchPlayer(state, playerId, () => ({
    secretDraft: null,
    secretHand: hand,
  }));
  next = withSecretObjectives(next, {
    deck: putSecretsUnderDeck(secretOf(next).deck, rejected),
  });
  return closeDraftIfComplete(next);
}

/**
 * Draw one secret. Cap is soft: over-cap is allowed, then overflow forces a discard
 * of any hand card (including the new one) until slotsUsed ≤ cap.
 */
export function drawSecret(state, playerId, { resolveStrategy = false } = {}) {
  const sec = secretOf(state);
  if (!sec.dealStarted || sec.draftPending) return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;
  // Must finish the previous over-cap discard before drawing again.
  if (overflowForPlayer(sec, playerId)) return state;
  if (!(sec.deck || []).length) return state;

  const { drawn, deck } = drawSecretsFromDeck(sec.deck, 1);
  if (!drawn.length) return state;
  const cardId = drawn[0];
  const hand = [...(Array.isArray(player.secretHand) ? player.secretHand : []), cardId];
  let next = withSecretObjectives(
    patchPlayer(state, playerId, () => ({ secretHand: hand })),
    {
      deck,
      pendingReveals: withPendingReveal(sec, playerId, cardId),
    },
  );

  const updated = next.players.find((p) => p.id === playerId);
  if (isSecretOverCap(updated)) {
    next = withSecretObjectives(next, {
      overflows: withOverflow(secretOf(next), playerId, { resolveStrategy }),
    });
  }
  return next;
}

/** Draw up to `count` secrets for a seat (stops early if deck/overflow blocks). */
export function drawSecretsForPlayer(state, playerId, count = 1) {
  const n = Math.max(0, Number(count) || 0);
  let next = state;
  for (let i = 0; i < n; i += 1) {
    const after = drawSecret(next, playerId);
    if (after === next) break;
    next = after;
  }
  return next;
}

/** Put a hand secret under the deck; required while over cap. */
export function discardSecret(state, playerId, cardId) {
  const sec = secretOf(state);
  const overflow = overflowForPlayer(sec, playerId);
  if (!overflow) return state;
  if (typeof cardId !== 'string' || !cardId) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;
  const hand = Array.isArray(player.secretHand) ? [...player.secretHand] : [];
  const idx = hand.indexOf(cardId);
  if (idx < 0) return state;

  hand.splice(idx, 1);
  const patch = {
    deck: putSecretsUnderDeck(sec.deck, [cardId]),
  };
  const reveal = sec.pendingReveals?.[String(playerId)] ?? sec.pendingReveals?.[playerId];
  if (reveal === cardId) {
    patch.pendingReveals = withoutPendingReveal(sec, playerId);
  }

  let next = withSecretObjectives(
    patchPlayer(state, playerId, () => ({ secretHand: hand })),
    patch,
  );
  const updated = next.players.find((p) => p.id === playerId);
  if (!isSecretOverCap(updated)) {
    const cleared = secretOf(next);
    next = withSecretObjectives(next, {
      overflows: withoutOverflow(cleared, playerId),
      pendingReveals: withoutPendingReveal(cleared, playerId),
    });
  }
  return next;
}

function dismissSecretReveal(state, playerId) {
  const sec = secretOf(state);
  const reveal = sec.pendingReveals?.[String(playerId)] ?? sec.pendingReveals?.[playerId];
  if (typeof reveal !== 'string' || !reveal) return state;
  // Still over cap → keep overflow; only clear the flip prompt for this seat.
  return withSecretObjectives(state, {
    pendingReveals: withoutPendingReveal(sec, playerId),
  });
}

export function scoreSecret(state, playerId, cardId, { scoringWindow = false } = {}) {
  const sec = secretOf(state);
  if (!sec.dealStarted) return state;
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;

  const hand = Array.isArray(player.secretHand) ? [...player.secretHand] : [];
  const idx = hand.indexOf(cardId);
  if (idx < 0) return state;

  const cap = secretCapOf(player);
  if ((player.secrets || 0) + 1 > cap) return state;

  hand.splice(idx, 1);
  const scored = [...(sec.scored || []), cardId];
  const secretScored = [
    ...(Array.isArray(player.secretScored) ? player.secretScored : []),
    cardId,
  ];
  let next = withSecretObjectives(
    patchPlayer(state, playerId, (p) => ({
      secretHand: hand,
      secretScored,
      secrets: Math.min(cap, (p.secrets || 0) + 1),
    })),
    { scored },
  );

  if (scoringWindow) {
    const scoring = next.statusPhase?.scoring;
    if (scoring?.active) {
      const responses = { ...(scoring.responses || {}) };
      const prev = responses[playerId] || { status: 'pending', publicId: null, secret: false };
      responses[playerId] = { ...prev, secret: true, secretId: cardId };
      next = withStatusPhase(next, { scoring: { ...scoring, responses } });
    }
  }
  return next;
}

export function unscoreSecret(state, playerId) {
  const scoring = state.statusPhase?.scoring;
  if (!scoring?.active) return state;
  const response = scoring.responses?.[playerId];
  if (!response?.secret) return state;

  const secretId = response.secretId;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return state;

  let next = state;
  const sec = secretOf(state);

  if (secretId && (sec.scored || []).includes(secretId)) {
    const scored = (sec.scored || []).filter((id) => id !== secretId);
    const hand = [...(Array.isArray(player.secretHand) ? player.secretHand : []), secretId];
    const secretScored = (Array.isArray(player.secretScored) ? player.secretScored : [])
      .filter((id) => id !== secretId);
    next = withSecretObjectives(
      patchPlayer(next, playerId, (p) => ({
        secretHand: hand,
        secretScored,
        secrets: Math.max(0, (p.secrets || 0) - 1),
      })),
      { scored },
    );
  } else {
    next = patchPlayer(next, playerId, (p) => ({
      secrets: Math.max(0, (p.secrets || 0) - 1),
    }));
  }

  const responses = { ...(scoring.responses || {}) };
  responses[playerId] = {
    ...(responses[playerId] || {}),
    secret: false,
    secretId: null,
  };
  return withStatusPhase(next, { scoring: { ...scoring, responses } });
}

function raiseSecretCap(state, playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;
  if (secretCapOf(player) >= 4) return state;
  return patchPlayer(state, playerId, () => ({ secretCap: 4 }));
}

function exchangeSecret(state, playerId, cardId) {
  const sec = secretOf(state);
  if (!sec.dealStarted || sec.draftPending) return state;
  if (state.round?.secretExchangeUsed) return state;
  const controllerId = state.vpTrack?.mecatolControllerId ?? null;
  if (controllerId !== playerId) return state;

  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated) return state;
  const hand = Array.isArray(player.secretHand) ? [...player.secretHand] : [];
  const idx = hand.indexOf(cardId);
  if (idx < 0) return state;
  if (!(sec.deck || []).length) return state;

  hand.splice(idx, 1);
  let deck = putSecretsUnderDeck(sec.deck, [cardId]);
  const drawn = drawSecretsFromDeck(deck, 1);
  deck = drawn.deck;
  if (!drawn.drawn.length) return state;
  hand.push(drawn.drawn[0]);
  return withRound(
    withSecretObjectives(
      patchPlayer(state, playerId, () => ({ secretHand: hand })),
      { deck },
    ),
    { secretExchangeUsed: true },
  );
}

function devSkipSecretDraft(state) {
  const sec = secretOf(state);
  if (!sec.dealStarted || !sec.draftPending) return state;

  const rejected = [];
  const players = state.players.map((p) => {
    const draft = Array.isArray(p.secretDraft) ? p.secretDraft : [];
    if (!draft.length) return { ...p, secretDraft: null };
    const keep = draft[0];
    rejected.push(...draft.slice(1));
    const hand = Array.isArray(p.secretHand) ? [...p.secretHand] : [];
    if (keep && !hand.includes(keep)) hand.push(keep);
    return { ...p, secretDraft: null, secretHand: hand };
  });

  const deck = reshuffleRemainingDeck(
    [...(sec.deck || []), ...rejected],
    sec.scored,
  );

  return withSecretObjectives({
    ...state,
    players,
  }, {
    deck,
    draftPending: false,
    dealStarted: true,
  });
}

export function reduceSecretObjectives(state, action) {
  if (!SECRET_ACTIONS.has(action?.type)) return null;

  switch (action.type) {
    case 'START_SECRET_DRAFT':
      return startSecretDraft(state);
    case 'KEEP_SECRET_DRAFT':
      return keepSecretDraft(state, action.playerId, action.cardId ?? action.keepId);
    case 'DRAW_SECRET':
      return drawSecret(state, action.playerId, {
        resolveStrategy: !!action.resolveStrategy,
      });
    case 'DISCARD_SECRET':
      return discardSecret(state, action.playerId, action.cardId);
    case 'DISMISS_SECRET_REVEAL':
      return dismissSecretReveal(state, action.playerId);
    case 'SCORE_SECRET':
      return scoreSecret(state, action.playerId, action.cardId, {
        scoringWindow: !!action.scoringWindow,
      });
    case 'UNSCORE_SECRET':
      return unscoreSecret(state, action.playerId);
    case 'RAISE_SECRET_CAP':
      return raiseSecretCap(state, action.playerId);
    case 'EXCHANGE_SECRET':
      return exchangeSecret(state, action.playerId, action.cardId);
    case 'DEV_SKIP_SECRET_DRAFT':
      return devSkipSecretDraft(state);
    default:
      return null;
  }
}
