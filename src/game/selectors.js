/**
 * Read-only views over the game document. Everything the UI shows is derived
 * here, so no piece of state is stored twice.
 */

export function playerById(state, playerId) {
  return state.players.find(p => p.id === playerId) || null;
}

export function playerScore(state, playerId) {
  const player = playerById(state, playerId);
  if (!player) return 0;

  const fromObjectives = state.objectives.active.reduce((sum, objective) => (
    state.objectives.completions[`${playerId}_${objective.id}`] ? sum + objective.points : sum
  ), 0);

  return player.secrets + player.extra + fromObjectives;
}

export function activePlayers(state) {
  return state.players.filter(p => !p.eliminated);
}

export function objectiveScoring(state) {
  return state.statusPhase?.scoring || { active: false, responses: {}, orderIds: [], currentIdx: 0 };
}

export function isObjectiveScoringActive(state) {
  return !!objectiveScoring(state).active;
}

export function strategyResolution(state) {
  return state.round?.strategyResolution || {
    active: false,
    cardId: null,
    playerId: null,
    responses: {},
  };
}

export function isStrategyResolutionActive(state) {
  return !!strategyResolution(state).active;
}

export function strategyResolutionResponseFor(state, playerId) {
  return strategyResolution(state).responses?.[playerId] ?? null;
}

export function imperialClaim(state) {
  return state.round?.imperialClaim || {
    active: false,
    playerId: null,
    publicId: null,
    mecatol: false,
    secret: false,
  };
}

export function isImperialClaimActive(state) {
  return !!imperialClaim(state).active;
}

export function techResearch(state) {
  return state.round?.techResearch || {
    active: false,
    concurrent: false,
    playerId: null,
    mode: 'primary',
    picks: [],
    ignorePrereq: 0,
    queueIds: [],
    primaryPlayerId: null,
    byPlayer: {},
  };
}

export function isTechResearchActive(state) {
  return !!techResearch(state).active;
}

/** Per-seat view of concurrent Technology (7) research during the shared poll. */
export function techResearchSessionFor(state, playerId) {
  const session = techResearch(state);
  if (!session.active || playerId == null) return null;
  if (!session.concurrent) {
    if (session.playerId !== playerId) return null;
    return session;
  }
  const resolution = strategyResolution(state);
  if (!resolution.active || resolution.cardId !== 7) return null;
  const status = resolution.responses?.[playerId]
    ?? resolution.responses?.[String(playerId)]
    ?? resolution.responses?.[Number(playerId)];
  if (status !== 'pending') return null;
  const entry = session.byPlayer?.[playerId]
    || session.byPlayer?.[String(playerId)]
    || {};
  const player = state.players?.find(p => p.id === playerId);
  const isPrimaryOwner = playerId === session.primaryPlayerId;
  const isJolNarBrilliant = player?.factionId === 'jolnar';
  return {
    active: true,
    concurrent: true,
    playerId,
    mode: (isPrimaryOwner || isJolNarBrilliant) ? 'primary' : 'secondary',
    picks: Array.isArray(entry.picks) ? entry.picks : [],
    ignorePrereq: entry.ignorePrereq ? 1 : 0,
    queueIds: [],
    primaryPlayerId: session.primaryPlayerId,
    brilliant: !isPrimaryOwner && isJolNarBrilliant,
  };
}

export function expedition(state) {
  return state.expedition || {
    slices: {
      resources: null,
      actionCards: null,
      influence: null,
      secret: null,
      techPlanet: null,
      tradeGoods: null,
    },
    completed: false,
    controllerId: null,
    placedById: null,
    awaitingControlPick: false,
  };
}

export function expeditionSliceCounts(state) {
  const counts = {};
  Object.values(expedition(state).slices || {}).forEach(playerId => {
    if (playerId == null) return;
    counts[playerId] = (counts[playerId] || 0) + 1;
  });
  return counts;
}

export function expeditionLeaders(state) {
  const counts = expeditionSliceCounts(state);
  let best = 0;
  Object.values(counts).forEach(n => { if (n > best) best = n; });
  if (best <= 0) return [];
  return Object.entries(counts)
    .filter(([, n]) => n === best)
    .map(([id]) => Number(id));
}

export function claimedExpeditionCount(state) {
  return Object.values(expedition(state).slices || {}).filter(id => id != null).length;
}

export function scoringResponseFor(state, playerId) {
  return objectiveScoring(state).responses?.[playerId] || null;
}

export function currentScoringPlayerId(state) {
  const scoring = objectiveScoring(state);
  if (!scoring.active) return null;
  return scoring.orderIds?.[scoring.currentIdx] ?? null;
}

/** Turn order as player objects, always resolved against the current players. */
export function turnOrder(state) {
  const byId = new Map(state.players.map(p => [p.id, p]));
  return state.round.turnOrderIds.map(id => byId.get(id)).filter(Boolean);
}

export function activePlayer(state) {
  return turnOrder(state)[state.round.activeTurnIdx] || null;
}

function playedIdsOf(player) {
  if (!player) return [];
  if (Array.isArray(player.playedCardIds) && player.playedCardIds.length > 0) {
    return player.playedCardIds;
  }
  // Legacy: single boolean meant every held card was resolved.
  if (player.strategyPlayed && player.cards?.length) {
    return player.cards.map(c => c.id);
  }
  return [];
}

export function isStrategyCardPlayed(player, cardId) {
  return playedIdsOf(player).includes(cardId);
}

/** True once every strategy card the player holds has been played this round. */
export function areAllStrategiesPlayed(player) {
  if (!player) return false;
  if (!player.cards?.length) return !!player.strategyPlayed;
  const played = new Set(playedIdsOf(player));
  return player.cards.every(c => played.has(c.id));
}

/** Strategy cards of the active player, low initiative first. */
export function activePlayerStrategyCards(state) {
  const player = activePlayer(state);
  if (!player?.cards?.length) return [];
  return [...player.cards].sort((a, b) => a.id - b.id);
}

/** Lowest-numbered unplayed strategy card (legacy single-card helpers). */
export function activeStrategyCard(state) {
  const player = activePlayer(state);
  if (!player?.cards?.length) return null;
  const played = new Set(playedIdsOf(player));
  const unplayed = [...player.cards].filter(c => !played.has(c.id)).sort((a, b) => a.id - b.id);
  return unplayed[0] || null;
}

export function isActiveStrategyPlayed(state) {
  return areAllStrategiesPlayed(activePlayer(state));
}

export function playersNotPassed(state) {
  return turnOrder(state).filter(p => !state.round.passed[p.id]);
}

export function playersForBoard(state) {
  return [...state.players].sort((a, b) => {
    const diff = playerScore(state, b.id) - playerScore(state, a.id);
    return diff !== 0 ? diff : a.id - b.id;
  });
}

export function canStartRound(state) {
  const active = activePlayers(state);
  return active.length > 0 && active.every(p => p.cards && p.cards.length > 0);
}

/** Host may end the action phase only after every seat in turn order has passed. */
export function canEndRound(state) {
  if (!state.round?.active) return false;
  const order = turnOrder(state);
  if (order.length === 0) return false;
  return playersNotPassed(state).length === 0;
}

export function isDraftInProgress(state) {
  return state.draft.queue.length > 0;
}

/** True once every non-eliminated player holds cards and no draft is running. */
export function isDraftLocked(state) {
  return canStartRound(state) && !isDraftInProgress(state);
}

export function currentDraftPlayerId(state) {
  return state.draft.queue[state.draft.currentQueueIndex] ?? null;
}

/** Speaker token passes clockwise to the next player still in the game. */
export function nextSpeakerAfter(state, playerId) {
  const seatIndex = state.players.findIndex(p => p.id === playerId);
  if (seatIndex !== -1) {
    for (let offset = 1; offset < state.players.length; offset += 1) {
      const candidate = state.players[(seatIndex + offset) % state.players.length];
      if (candidate.id !== playerId && !candidate.eliminated) return candidate.id;
    }
  }
  return state.players.find(p => p.id !== playerId && !p.eliminated)?.id ?? null;
}

export function currentAgenda(state) {
  return state.politics.agendas[state.politics.currentAgendaIndex] || null;
}

/**
 * Agenda voting order: clockwise (or reverse) from the seat after the speaker,
 * with the speaker always last.
 */
export function votingOrder(state) {
  const seats = activePlayers(state);
  if (seats.length === 0) return [];

  const speakerId = state.meta.speakerId;
  let speakerIdx = seats.findIndex(p => p.id === speakerId);
  if (speakerIdx === -1) speakerIdx = 0;

  const reversed = !!state.politics.voteReversed;
  const others = [];
  for (let i = 1; i < seats.length; i += 1) {
    const idx = reversed
      ? (speakerIdx - i + seats.length) % seats.length
      : (speakerIdx + i) % seats.length;
    others.push(seats[idx]);
  }
  return [...others, seats[speakerIdx]];
}

/** First player in voting order who has not locked their vote on the current agenda. */
export function currentVoterId(state) {
  const agenda = currentAgenda(state);
  if (!agenda?.type) return null;
  const order = votingOrder(state);
  const pending = order.find(p => !agenda.locked?.[p.id]);
  return pending?.id ?? null;
}

export function allInfluenceLocked(state) {
  const seats = activePlayers(state);
  if (seats.length === 0) return false;
  const locked = state.politics.influenceLocked || {};
  return seats.every(p => !!locked[p.id]);
}

export function availableFactions(state, allFactions) {
  return allFactions.filter(faction => {
    if (faction.exp === 'base') return true;
    if (faction.exp === 'pok') return state.meta.usePok;
    if (faction.exp === 'te') return state.meta.useTe;
    return false;
  });
}

export function isFactionTaken(state, factionId, currentPlayerId) {
  return state.players.some(p => p.id !== currentPlayerId && p.factionId === factionId);
}

export function isColorTaken(state, colorHex, currentPlayerId) {
  return state.players.some(p => p.id !== currentPlayerId && p.color === colorHex);
}

export function startingTechDraft(state) {
  return state.startingTechDraft || {
    needed: false,
    active: false,
    responses: {},
  };
}

export function isStartingTechDraftNeeded(state) {
  const draft = startingTechDraft(state);
  return !!draft.needed && !draft.active;
}

export function isStartingTechDraftActive(state) {
  return !!startingTechDraft(state).active;
}

export function startingTechDraftResponseFor(state, playerId) {
  return startingTechDraft(state).responses?.[playerId] ?? null;
}
