import { STRATEGY_CARDS } from '../data/gameData';
import { formatGameEvent } from '../game/gameEvents';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cardLabel(cardId) {
  const card = STRATEGY_CARDS.find((c) => c.id === Number(cardId));
  return card?.name || `#${cardId}`;
}

function playerName(players, playerId) {
  const p = players.find((x) => x.id === playerId);
  return p?.name || (playerId != null ? String(playerId) : '—');
}

/** Walk log with running round number from ROUND_* events. */
export function eventsWithRound(events) {
  let round = 0;
  return asArray(events).map((event) => {
    if (event?.type === 'ROUND_STARTED' && Number.isFinite(event.roundNumber)) {
      round = event.roundNumber;
    }
    if (event?.type === 'ROUND_ENDED' && Number.isFinite(event.roundNumber)) {
      round = event.roundNumber;
    }
    return { ...event, roundNumber: event.roundNumber ?? round };
  });
}

/** Strategy card usage: primary play + secondary played/passed. */
export function extractStrategyPlays(state) {
  const players = asArray(state?.players);
  const enriched = eventsWithRound(state?.log?.events);
  const plays = [];
  const seenPrimary = new Set();

  enriched.forEach((event) => {
    const round = Number.isFinite(event.roundNumber) ? event.roundNumber : null;
    const cardId = Number(event.cardId);
    if (!Number.isFinite(cardId)) return;

    if (event.type === 'STRATEGY_PLAYED') {
      const key = `${event.playerId}:${cardId}:${round}`;
      if (seenPrimary.has(key)) return;
      seenPrimary.add(key);
      plays.push({
        round,
        cardId,
        card: cardLabel(cardId),
        playerId: event.playerId,
        player: playerName(players, event.playerId),
        role: 'primary',
        outcome: 'played',
      });
    }

    if (event.type === 'STRATEGY_SECONDARY_PLAYED') {
      plays.push({
        round,
        cardId,
        card: cardLabel(cardId),
        playerId: event.playerId,
        player: playerName(players, event.playerId),
        role: 'secondary',
        outcome: 'played',
        ownerPlayerId: event.ownerPlayerId ?? null,
        owner: playerName(players, event.ownerPlayerId),
      });
    }

    if (event.type === 'STRATEGY_SECONDARY_PASSED') {
      plays.push({
        round,
        cardId,
        card: cardLabel(cardId),
        playerId: event.playerId,
        player: playerName(players, event.playerId),
        role: 'secondary',
        outcome: 'passed',
        ownerPlayerId: event.ownerPlayerId ?? null,
        owner: playerName(players, event.ownerPlayerId),
      });
    }
  });

  return plays.sort((a, b) => {
    const ra = a.round ?? 0;
    const rb = b.round ?? 0;
    return ra - rb || a.cardId - b.cardId || a.player.localeCompare(b.player, 'ru');
  });
}

function summarizeAgendaVotes(agenda, players) {
  const votes = agenda?.votes || {};
  let forCount = 0;
  let againstCount = 0;
  let abstain = 0;
  let spentInfluence = 0;
  const voters = [];

  Object.entries(votes).forEach(([playerId, vote]) => {
    if (!agenda?.locked?.[playerId]) return;
    const seat = players.find((p) => p.id === Number(playerId) || String(p.id) === String(playerId));
    const name = seat?.name || String(playerId);
    voters.push(name);
    if (vote?.choice === 'for') forCount += 1;
    else if (vote?.choice === 'against') againstCount += 1;
    else abstain += 1;
    spentInfluence += Number(vote?.amount) || 0;
  });

  return {
    voters: voters.length,
    for: forCount,
    against: againstCount,
    abstain,
    spentInfluence,
    voterNames: voters,
  };
}

function serializeOutcome(outcome) {
  if (outcome == null) return null;
  if (outcome === 'for' || outcome === 'against') return outcome;
  if (typeof outcome === 'object' && outcome.choice != null) {
    return { choice: String(outcome.choice) };
  }
  return null;
}

function agendaTypeLabel(agenda) {
  const custom = asArray(agenda?.customChoices).filter(Boolean);
  if (agenda?.type === 'OTHER' && custom[0]) return String(custom[0]);
  if (agenda?.type === 'FOR_AGAINST') return 'За / Против';
  if (agenda?.type === 'PLAYER_CHOICE') return 'Выбор игрока';
  return agenda?.type || '—';
}

function outcomeLabel(agenda, players) {
  const outcome = agenda?.outcome;
  if (outcome === 'for') return 'За';
  if (outcome === 'against') return 'Против';
  const choice = typeof outcome === 'object' && outcome != null
    ? outcome.choice
    : (agenda?.speakerDecision != null && agenda?.type !== 'FOR_AGAINST'
      ? agenda.speakerDecision
      : null);
  if (choice == null || choice === '') {
    if (agenda?.speakerDecision === 'for') return 'За';
    if (agenda?.speakerDecision === 'against') return 'Против';
    return null;
  }
  const seat = players.find((p) => String(p.id) === String(choice));
  if (seat) return seat.name;
  const idx = Number(choice);
  const custom = asArray(agenda?.customChoices);
  if (Number.isInteger(idx) && custom[idx] != null && String(custom[idx]).trim()) {
    return String(custom[idx]);
  }
  return String(choice);
}

/** Politics snapshot from final state + speaker timeline from log. */
export function extractPolitics(state) {
  const players = asArray(state?.players);
  const meta = state?.meta || {};
  const politicsState = state?.politics || {};
  const enriched = eventsWithRound(state?.log?.events);

  const speakerTimeline = enriched
    .filter((e) => e.type === 'SPEAKER_CHANGED' && e.playerId != null)
    .map((e) => ({
      round: e.roundNumber ?? null,
      playerId: e.playerId,
      player: playerName(players, e.playerId),
    }));

  const agendaPhasesCompleted = enriched.filter((e) => e.type === 'AGENDA_PHASE_FINISHED').length;

  const agendas = asArray(politicsState.agendas)
    .map((agenda, index) => {
      if (!agenda?.type && !agenda?.cardId) return null;
      if (!agenda?.type) return null;
      const summary = summarizeAgendaVotes(agenda, players);
      const ownerId = agenda.ownerPlayerId ?? (
        typeof agenda.outcome === 'object' && agenda.outcome?.choice != null
        && agenda.type === 'PLAYER_CHOICE'
          ? agenda.outcome.choice
          : null
      );
      return {
        index,
        cardId: agenda.cardId || null,
        title: agenda.title || null,
        kind: agenda.kind === 'directive' ? 'directive' : (agenda.kind === 'law' ? 'law' : null),
        type: agenda.type,
        label: agenda.title || agendaTypeLabel(agenda),
        typeLabel: agendaTypeLabel(agenda),
        outcome: serializeOutcome(agenda.outcome),
        outcomeLabel: outcomeLabel(agenda, players),
        speakerBreak: agenda.speakerDecision != null && agenda.speakerDecision !== '',
        speakerDecision: agenda.speakerDecision ?? null,
        covert: !!agenda.covert,
        miscount: !!agenda.miscount,
        ownerPlayerId: ownerId != null ? ownerId : null,
        owner: ownerId != null ? playerName(players, ownerId) : null,
        ...summary,
      };
    })
    .filter(Boolean);

  const activeLaws = asArray(politicsState.activeLaws)
    .map((law) => {
      if (!law?.id && !law?.title) return null;
      const ownerId = law.ownerPlayerId ?? null;
      return {
        id: law.id != null ? String(law.id) : null,
        title: law.title || law.id || 'Закон',
        kind: 'law',
        elect: law.elect || null,
        voteType: law.voteType || null,
        outcome: serializeOutcome(law.outcome),
        enactedRound: law.enactedRound ?? null,
        ownerPlayerId: ownerId,
        owner: ownerId != null ? playerName(players, ownerId) : null,
      };
    })
    .filter(Boolean);

  const finalSpeakerId = meta.speakerId ?? null;
  return {
    finalSpeakerId,
    finalSpeaker: finalSpeakerId != null ? playerName(players, finalSpeakerId) : null,
    oneVoteLaw: !!politicsState.oneVoteLaw,
    voteReversed: !!politicsState.voteReversed,
    agendaPhasesCompleted,
    agendas,
    activeLaws,
    speakerTimeline,
  };
}

/** Compact digest for game detail (newest last). */
export function extractEventDigest(state, limit = 40) {
  const players = asArray(state?.players);
  const events = asArray(state?.log?.events).slice(-limit);
  const withRound = eventsWithRound(events);
  return withRound.map((e) => ({
    type: e.type,
    at: e.at ?? null,
    round: e.roundNumber ?? null,
    text: formatGameEvent(e, players) || e.type,
    playerId: e.playerId ?? null,
    player: e.playerId != null ? playerName(players, e.playerId) : null,
    cardId: e.cardId ?? null,
  }));
}

export function enrichPlayerAnalytics(state, playerRow, playerId) {
  const player = asArray(state?.players).find((p) => p.id === playerId);
  if (!player) return playerRow;

  const scoringPasses = asArray(state?.log?.events).filter(
    (e) => e.type === 'OBJECTIVE_SCORING_DONE' && e.playerId === playerId,
  ).length;

  return {
    ...playerRow,
    secretsHeld: Number(player.secrets) || 0,
    secretsScoredVp: playerRow.scoreBreakdown?.secrets ?? 0,
    objectiveScoringTurns: scoringPasses,
  };
}
