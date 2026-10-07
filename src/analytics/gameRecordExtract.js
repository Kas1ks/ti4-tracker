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
    const seat = players.find((p) => p.id === Number(playerId));
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
      if (!agenda?.type) return null;
      const summary = summarizeAgendaVotes(agenda, players);
      if (summary.voters === 0 && !agenda.type) return null;
      const custom = asArray(agenda.customChoices).filter(Boolean);
      return {
        index,
        type: agenda.type,
        label: agenda.type === 'OTHER' && custom[0]
          ? custom[0]
          : agenda.type === 'FOR_AGAINST'
            ? 'За / Против'
            : agenda.type === 'PLAYER_CHOICE'
              ? 'Выбор игрока'
              : agenda.type,
        ...summary,
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
