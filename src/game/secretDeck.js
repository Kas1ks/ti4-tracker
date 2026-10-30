import { secretDeckForExp } from '../data/secretObjectives';
import { shuffleArray } from '../utils/game';

/** Empty secret-objectives slice (before host starts the deal). */
export function emptySecretObjectives() {
  return {
    deck: [],
    scored: [],
    dealStarted: false,
    draftPending: false,
    /** Per-seat face-down receive: { [playerId]: cardId } */
    pendingReveals: {},
    /** Per-seat over-cap discard: { [playerId]: { resolveStrategy? } } */
    overflows: {},
  };
}

function asIdKey(playerId) {
  return String(playerId);
}

/** Pending reveal entry for one seat, or null. */
export function pendingRevealForPlayer(sec, playerId) {
  if (playerId == null || !sec) return null;
  const map = sec.pendingReveals && typeof sec.pendingReveals === 'object'
    ? sec.pendingReveals
    : null;
  const cardId = map?.[playerId] ?? map?.[asIdKey(playerId)];
  if (typeof cardId !== 'string' || !cardId) return null;
  const id = Number(playerId);
  return { playerId: Number.isFinite(id) ? id : playerId, cardId };
}

/** Over-cap discard entry for one seat, or null. */
export function overflowForPlayer(sec, playerId) {
  if (playerId == null || !sec) return null;
  const map = sec.overflows && typeof sec.overflows === 'object'
    ? sec.overflows
    : null;
  const entry = map?.[playerId] ?? map?.[asIdKey(playerId)];
  if (!entry || typeof entry !== 'object') return null;
  const id = Number(playerId);
  return {
    playerId: Number.isFinite(id) ? id : playerId,
    resolveStrategy: !!entry.resolveStrategy,
  };
}

export function withPendingReveal(sec, playerId, cardId) {
  const pendingReveals = { ...(sec?.pendingReveals || {}) };
  pendingReveals[asIdKey(playerId)] = cardId;
  return pendingReveals;
}

export function withoutPendingReveal(sec, playerId) {
  const pendingReveals = { ...(sec?.pendingReveals || {}) };
  delete pendingReveals[asIdKey(playerId)];
  delete pendingReveals[playerId];
  return pendingReveals;
}

export function withOverflow(sec, playerId, meta = {}) {
  const overflows = { ...(sec?.overflows || {}) };
  overflows[asIdKey(playerId)] = { resolveStrategy: !!meta.resolveStrategy };
  return overflows;
}

export function withoutOverflow(sec, playerId) {
  const overflows = { ...(sec?.overflows || {}) };
  delete overflows[asIdKey(playerId)];
  delete overflows[playerId];
  return overflows;
}

/**
 * Seat that still needs a receive UI (reveal and/or overflow).
 * When `preferId` is set (seated client), only that seat — never another player's card.
 * When null (solo host), returns the first pending seat in map order.
 */
export function nextSecretReceiveSeat(sec, preferId = null) {
  if (!sec) return null;

  const seatPayload = (playerId) => {
    const reveal = pendingRevealForPlayer(sec, playerId);
    const overflow = overflowForPlayer(sec, playerId);
    if (!reveal && !overflow) return null;
    return {
      playerId: reveal?.playerId ?? overflow.playerId,
      cardId: reveal?.cardId ?? null,
      overflow: !!overflow,
      resolveStrategy: !!overflow?.resolveStrategy,
    };
  };

  if (preferId != null) return seatPayload(preferId);

  const reveals = sec.pendingReveals || {};
  for (const key of Object.keys(reveals)) {
    const payload = seatPayload(key);
    if (payload) return payload;
  }
  const overflows = sec.overflows || {};
  for (const key of Object.keys(overflows)) {
    const payload = seatPayload(key);
    if (payload) return payload;
  }
  return null;
}

/** Shuffled list of secret card ids for the expansion setup. */
export function buildShuffledSecretDeck(usePok = false) {
  const cards = secretDeckForExp({ pok: !!usePok });
  return shuffleArray(cards.map((c) => c.id));
}

/** Mid-game returns: append ids to the bottom of the deck (no shuffle). */
export function putSecretsUnderDeck(deck, ids) {
  const base = Array.isArray(deck) ? [...deck] : [];
  const add = (Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === 'string' && id);
  if (!add.length) return base;
  return [...base, ...add];
}

/** Draw up to `n` cards from the front (top) of the deck. Mid-game draws. */
export function drawSecretsFromDeck(deck, n = 1) {
  const next = Array.isArray(deck) ? [...deck] : [];
  const count = Math.max(0, Math.min(Number(n) || 0, next.length));
  const drawn = next.splice(0, count);
  return { drawn, deck: next };
}

/**
 * Opening deal only: take `n` cards from random positions (not the top).
 * Remaining deck order is otherwise preserved until the caller reshuffles.
 */
export function drawRandomSecretsFromDeck(deck, n = 1) {
  const next = Array.isArray(deck) ? [...deck] : [];
  const count = Math.max(0, Math.min(Number(n) || 0, next.length));
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(Math.random() * next.length);
    drawn.push(next.splice(idx, 1)[0]);
  }
  return { drawn, deck: next };
}

export function secretCapOf(player) {
  const cap = Number(player?.secretCap);
  return cap === 4 ? 4 : 3;
}

/** Scored VP + cards still in hand (draft picks do not count until kept). */
export function secretSlotsUsed(player) {
  const scored = Math.max(0, Number(player?.secrets) || 0);
  const hand = Array.isArray(player?.secretHand) ? player.secretHand.length : 0;
  return scored + hand;
}

/** Soft check: under the hand+scored cap (draw still allowed over-cap with mandatory discard). */
export function canDrawSecret(player) {
  if (!player || player.eliminated) return false;
  return secretSlotsUsed(player) < secretCapOf(player);
}

export function isSecretOverCap(player) {
  if (!player || player.eliminated) return false;
  return secretSlotsUsed(player) > secretCapOf(player);
}

export function canRevealPublicObjectives(state) {
  return !!state?.secretObjectives?.dealStarted;
}

/** Starting-tech draft finished or never required. */
export function canStartSecretDraft(state) {
  if (!state?.isGameActive) return false;
  if (state.secretObjectives?.dealStarted) return false;
  if (state.startingTechDraft?.needed) return false;
  return true;
}
