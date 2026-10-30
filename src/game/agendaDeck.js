import { agendaById, agendaDeckForExp } from '../data/agendas';
import { secretObjectiveById } from '../data/secretObjectives';
import { shuffleArray } from '../utils/game';
import { activePlayers, effectiveVoteAmount } from './selectors';

/** True when any seat has at least one scored secret. */
export function hasAnyScoredSecrets(state) {
  return (state?.players || []).some(
    (p) => Array.isArray(p?.secretScored) && p.secretScored.length > 0,
  );
}

/** Elect labels for Classified Document Leaks (unique titles, fallback to id). */
export function scoredSecretElectChoices(state) {
  const labels = [];
  const seen = new Set();
  for (const p of state?.players || []) {
    for (const id of p?.secretScored || []) {
      if (typeof id !== 'string' || !id || seen.has(id)) continue;
      seen.add(id);
      const card = secretObjectiveById.get(id);
      labels.push(card?.title || id);
    }
  }
  return labels;
}

/** Resolve an elect choice label back to a scored secret card id. */
export function scoredSecretIdFromElectChoice(state, choice) {
  const raw = String(choice || '').trim();
  if (!raw) return null;
  for (const p of state?.players || []) {
    for (const id of p?.secretScored || []) {
      if (id === raw) return id;
      const card = secretObjectiveById.get(id);
      if (card?.title === raw || card?.titleEn === raw) return id;
    }
  }
  return null;
}

/** Shuffled deck of agenda card ids for the current expansion setup. */
export function buildShuffledAgendaDeck(usePok = false) {
  const cards = agendaDeckForExp({ pok: !!usePok });
  return shuffleArray(cards.map((c) => c.id));
}

export function emptyAgenda() {
  return { type: null, votes: {}, locked: {} };
}

/** Snapshot card fields onto an agenda slot and set vote type. */
export function fillAgendaFromCard(agenda, card) {
  if (!card) return { ...emptyAgenda(), ...(agenda || {}) };
  const next = {
    ...(agenda || emptyAgenda()),
    cardId: card.id,
    title: card.title,
    desc: card.desc,
    kind: card.kind,
    elect: card.elect,
    forText: card.forText || undefined,
    againstText: card.againstText || undefined,
    text: card.text || undefined,
    type: card.voteType || 'OTHER',
    /** Face-down until the speaker presses «Открыть закон». */
    revealed: false,
    votes: agenda?.votes && typeof agenda.votes === 'object' ? agenda.votes : {},
    locked: agenda?.locked && typeof agenda.locked === 'object' ? agenda.locked : {},
  };
  if (next.type === 'OTHER' && !Array.isArray(next.customChoices)) {
    next.customChoices = [''];
  }
  if (next.type !== 'OTHER') {
    delete next.customChoices;
  }
  delete next.covert;
  delete next.hidden;
  delete next.hiddenRevealed;
  delete next.miscount;
  delete next.miscountRevote;
  delete next.revote;
  // Miscount Disclosed: speaker picks an active law, then that law is voted again.
  if (card.id === 'miscount_disclosed') {
    next.miscount = true;
    next.miscountRevote = false;
    next.type = null;
    delete next.customChoices;
  }
  return next;
}

/** True when the agenda face is public (or legacy slot without a deck card). */
export function isAgendaFaceUp(agenda) {
  if (!agenda) return false;
  if (!agenda.cardId) return !!agenda.type;
  return agenda.revealed === true;
}

/** Attach a face-down agenda under Covert Legislation; voting uses the hidden card. */
export function applyCovertHidden(covertAgenda, hiddenAgenda) {
  if (!hiddenAgenda?.cardId) return covertAgenda;
  const voteType = hiddenAgenda.type || 'OTHER';
  const next = {
    ...covertAgenda,
    covert: true,
    revealed: false,
    hiddenRevealed: false,
    hidden: {
      cardId: hiddenAgenda.cardId,
      title: hiddenAgenda.title,
      desc: hiddenAgenda.desc,
      kind: hiddenAgenda.kind,
      elect: hiddenAgenda.elect,
      forText: hiddenAgenda.forText,
      againstText: hiddenAgenda.againstText,
      text: hiddenAgenda.text,
      voteType,
    },
    // Public face stays Covert Legislation; ballots follow the hidden card.
    type: voteType,
  };
  if (voteType === 'OTHER') {
    next.customChoices = Array.isArray(hiddenAgenda.customChoices)
      ? [...hiddenAgenda.customChoices]
      : [''];
  } else {
    delete next.customChoices;
  }
  // Don't leak hidden effect copy on the public wrapper fields.
  delete next.forText;
  delete next.againstText;
  return next;
}

/** Agenda fields used for enact / outcome (unwrap Covert / Miscount revote). */
export function effectiveAgendaForResolve(agenda) {
  if (agenda?.miscountRevote && agenda.revote?.id) {
    return {
      ...agenda,
      cardId: agenda.revote.id,
      title: agenda.revote.title,
      desc: agenda.revote.desc,
      kind: 'law',
      elect: agenda.revote.elect,
      forText: agenda.revote.forText,
      againstText: agenda.revote.againstText,
      text: agenda.revote.text,
      type: agenda.type || agenda.revote.voteType,
    };
  }
  if (!agenda?.covert || !agenda.hidden?.cardId) return agenda;
  return {
    ...agenda,
    cardId: agenda.hidden.cardId,
    title: agenda.hidden.title,
    desc: agenda.hidden.desc,
    kind: agenda.hidden.kind,
    elect: agenda.hidden.elect,
    forText: agenda.hidden.forText,
    againstText: agenda.hidden.againstText,
    text: agenda.hidden.text,
    type: agenda.type || agenda.hidden.voteType,
  };
}

/** Vote type for a stored active law (fallback from elect / catalog). */
export function voteTypeForLaw(law) {
  if (!law) return 'OTHER';
  if (law.voteType === 'FOR_AGAINST' || law.voteType === 'PLAYER_CHOICE' || law.voteType === 'OTHER') {
    return law.voteType;
  }
  const card = law.id ? agendaById.get(law.id) : null;
  if (card?.voteType) return card.voteType;
  const elect = String(law.elect || card?.elect || '');
  if (elect === 'for_against' || elect === 'for_or_against') return 'FOR_AGAINST';
  if (elect === 'player') return 'PLAYER_CHOICE';
  return 'OTHER';
}

/** RU label for elect target (Miscount / OTHER choices hint). */
export function electTargetLabel(elect) {
  switch (String(elect || '')) {
    case 'for_against':
    case 'for_or_against':
      return 'За / Против';
    case 'player':
      return 'Игрок';
    case 'planet':
      return 'Планета';
    case 'hazardous_planet':
      return 'Опасная планета';
    case 'cultural_planet':
      return 'Культурная планета';
    case 'industrial_planet':
      return 'Индустриальная планета';
    case 'non_home_planet':
      return 'Планета не из home';
    case 'strategy_card':
      return 'Карта стратегии';
    case 'scored_secret_objective':
      return 'Заскоренный секрет';
    case 'law':
      return 'Закон';
    default:
      return elect ? String(elect) : 'Особый исход';
  }
}

function defaultOtherChoicesForElect(elect) {
  const e = String(elect || '');
  if (e === 'strategy_card') {
    return [
      'Leadership', 'Diplomacy', 'Politics', 'Construction',
      'Trade', 'Warfare', 'Technology', 'Imperial',
    ];
  }
  if (e.includes('planet')) return ['Планета 1', 'Планета 2'];
  if (e === 'scored_secret_objective') return [];
  if (e === 'law') return ['Закон 1', 'Закон 2'];
  return ['Вариант A', 'Вариант B'];
}

/** Attach an active law as the Miscount Disclosed revote target. */
export function applyMiscountRevote(agenda, law) {
  if (!agenda || !law?.id) return agenda;
  const card = agendaById.get(law.id) || null;
  const voteType = voteTypeForLaw({ ...card, ...law });
  const elect = law.elect || card?.elect || null;
  const forText = law.forText || card?.forText || '';
  const againstText = law.againstText || card?.againstText || '';
  const text = law.text || card?.text || '';
  const title = law.title || card?.title || 'Закон';
  const desc = law.desc || card?.desc || '';

  const next = {
    ...agenda,
    miscount: true,
    miscountRevote: true,
    // Voting surface must match the original law exactly.
    type: voteType,
    elect,
    revote: {
      id: law.id,
      title,
      desc,
      elect,
      forText,
      againstText,
      text,
      voteType,
      ownerPlayerId: law.ownerPlayerId,
    },
    votes: {},
    locked: {},
  };

  if (voteType === 'FOR_AGAINST') {
    delete next.customChoices;
  } else if (voteType === 'PLAYER_CHOICE') {
    delete next.customChoices;
  } else {
    const prior = Array.isArray(law.customChoices)
      ? law.customChoices.filter((c) => String(c || '').trim())
      : [];
    next.customChoices = prior.length ? prior : defaultOtherChoicesForElect(elect);
  }
  return next;
}

export function covertOutcomeLabel(voteType) {
  if (voteType === 'FOR_AGAINST') return 'За / Против';
  if (voteType === 'PLAYER_CHOICE') return 'Избрать игрока';
  return 'Особый выбор';
}

/**
 * Draw top card into the current agenda. Reshuffles discard into deck if empty.
 * Covert Legislation also pulls the next card face-down for the speaker.
 * @returns {{ agenda: object, agendaDeck: string[], agendaDiscard: string[] }}
 */
export function drawIntoAgenda(agenda, agendaDeck = [], agendaDiscard = [], {
  allowCovert = true,
  state = null,
  /** Internal: prevent infinite CDL skip when discard reshuffles into itself. */
  _cdlSkips = 0,
} = {}) {
  let deck = Array.isArray(agendaDeck) ? [...agendaDeck] : [];
  let discard = Array.isArray(agendaDiscard) ? [...agendaDiscard] : [];
  if (deck.length === 0 && discard.length > 0) {
    deck = shuffleArray(discard);
    discard = [];
  }
  if (deck.length === 0) {
    return { agenda: agenda || emptyAgenda(), agendaDeck: deck, agendaDiscard: discard };
  }
  const cardId = deck[0];
  const rest = deck.slice(1);
  const card = agendaById.get(cardId);

  // Classified Document Leaks: if no scored secrets when revealed, discard and draw next.
  if (state && card?.id === 'classified_document_leaks' && !hasAnyScoredSecrets(state)) {
    const maxSkips = Math.max(8, deck.length + discard.length + rest.length + 2);
    if (_cdlSkips >= maxSkips) {
      // Entire reshuffled pool is unplayable CDL — leave slot empty.
      return {
        agenda: agenda || emptyAgenda(),
        agendaDeck: rest,
        agendaDiscard: [...discard, cardId],
      };
    }
    return drawIntoAgenda(agenda, rest, [...discard, cardId], {
      allowCovert,
      state,
      _cdlSkips: _cdlSkips + 1,
    });
  }

  let filled = fillAgendaFromCard(agenda || emptyAgenda(), card);

  if (filled.elect === 'scored_secret_objective' && state) {
    const choices = scoredSecretElectChoices(state);
    filled = {
      ...filled,
      customChoices: choices.length ? choices : [''],
    };
  }

  if (allowCovert && card?.id === 'covert_legislation') {
    const nested = drawIntoAgenda(emptyAgenda(), rest, discard, { allowCovert: false, state });
    if (nested.agenda?.cardId) {
      filled = applyCovertHidden(filled, nested.agenda);
      return {
        agenda: filled,
        agendaDeck: nested.agendaDeck,
        agendaDiscard: nested.agendaDiscard,
      };
    }
  }

  return {
    agenda: filled,
    agendaDeck: rest,
    agendaDiscard: discard,
  };
}

/** Tallied vote weights by choice key for a locked agenda. */
export function agendaVoteTotals(state, agenda) {
  const totals = {};
  if (!agenda?.type) return totals;
  const seats = activePlayers(state);
  seats.forEach((player) => {
    if (!agenda.locked?.[player.id]) return;
    const vote = agenda.votes?.[player.id];
    if (!vote || vote.choice === 'abstain') return;
    const amount = effectiveVoteAmount(state, player, vote);
    if (amount <= 0) return;
    const key = String(vote.choice);
    totals[key] = (totals[key] || 0) + amount;
  });
  return totals;
}

/**
 * True when vote totals do not produce a unique winner (tie or all zero).
 * Speaker must pick the outcome (TI4).
 */
export function agendaNeedsSpeakerBreak(state, agenda) {
  if (!agenda?.type) return false;
  const totals = agendaVoteTotals(state, agenda);

  if (agenda.type === 'FOR_AGAINST') {
    const forVotes = Number(totals.for) || 0;
    const againstVotes = Number(totals.against) || 0;
    return forVotes === againstVotes;
  }

  let bestVotes = -1;
  let leaders = 0;
  Object.values(totals).forEach((weight) => {
    const w = Number(weight) || 0;
    if (w <= 0) return;
    if (w > bestVotes) {
      bestVotes = w;
      leaders = 1;
    } else if (w === bestVotes) {
      leaders += 1;
    }
  });
  // No non-abstain votes, or two+ options share the lead.
  return bestVotes <= 0 || leaders > 1;
}

/** Fully voted + tie/zero, but speaker has not locked a decision yet. */
export function agendaSpeakerDecisionPending(state, agenda) {
  if (!agenda?.type) return false;
  if (!agendaNeedsSpeakerBreak(state, agenda)) return false;
  return agenda.speakerDecision == null || agenda.speakerDecision === '';
}

/**
 * Resolve FOR_AGAINST / PLAYER_CHOICE / OTHER outcome.
 * Ties or zero votes: use agenda.speakerDecision; otherwise null until speaker picks.
 * @returns {'for'|'against'|{ choice: string }|null}
 */
export function resolveAgendaOutcome(state, agenda) {
  if (!agenda?.type) return null;

  if (agenda.speakerDecision != null && agenda.speakerDecision !== '') {
    if (agenda.type === 'FOR_AGAINST') {
      return agenda.speakerDecision === 'for' || agenda.speakerDecision === 'against'
        ? agenda.speakerDecision
        : null;
    }
    return { choice: String(agenda.speakerDecision) };
  }

  const totals = agendaVoteTotals(state, agenda);

  if (agenda.type === 'FOR_AGAINST') {
    const forVotes = Number(totals.for) || 0;
    const againstVotes = Number(totals.against) || 0;
    if (forVotes > againstVotes) return 'for';
    if (againstVotes > forVotes) return 'against';
    return null;
  }

  let bestChoice = null;
  let bestVotes = -1;
  let tied = false;
  Object.entries(totals).forEach(([choice, weight]) => {
    const w = Number(weight) || 0;
    if (w > bestVotes) {
      bestVotes = w;
      bestChoice = choice;
      tied = false;
    } else if (w === bestVotes && w > 0) {
      tied = true;
    }
  });
  if (bestChoice == null || bestVotes <= 0 || tied) return null;
  return { choice: bestChoice };
}

/**
 * Whether this resolved agenda should become an active lasting law.
 * - FOR_AGAINST laws: only on "for"
 * - elect laws: when an outcome exists
 * - directives: never
 */
export function shouldEnactLaw(agenda, outcome) {
  if (!agenda || agenda.kind !== 'law' || outcome == null) return false;
  if (agenda.type === 'FOR_AGAINST') return outcome === 'for';
  if (agenda.type === 'PLAYER_CHOICE' || agenda.type === 'OTHER') {
    return typeof outcome === 'object' && outcome.choice != null;
  }
  return false;
}

export function lawRecordFromAgenda(state, agenda, outcome) {
  const card = agenda.cardId ? agendaById.get(agenda.cardId) : null;
  const voteType = agenda.type || card?.voteType || voteTypeForLaw({ ...card, ...agenda });
  const record = {
    id: agenda.cardId || `law_${Date.now()}`,
    title: agenda.title || card?.title || 'Закон',
    desc: agenda.desc || card?.desc || '',
    text: agenda.text || card?.text || '',
    forText: agenda.forText || card?.forText || '',
    againstText: agenda.againstText || card?.againstText || '',
    elect: agenda.elect || card?.elect || null,
    voteType,
    kind: 'law',
    outcome,
    enactedRound: state.meta?.roundNumber ?? null,
  };
  if (voteType === 'OTHER' && Array.isArray(agenda.customChoices)) {
    record.customChoices = [...agenda.customChoices];
  }
  if (agenda.type === 'PLAYER_CHOICE' && outcome && typeof outcome === 'object') {
    const raw = outcome.choice;
    const asNum = Number(raw);
    record.ownerPlayerId = Number.isFinite(asNum) ? asNum : raw;
  }
  return record;
}

/** Active laws currently attached to a specific player (elect player). */
export function lawsOwnedByPlayer(activeLaws, playerId) {
  if (playerId == null) return [];
  return (activeLaws || []).filter(
    (law) => law?.ownerPlayerId != null && String(law.ownerPlayerId) === String(playerId),
  );
}

/**
 * Card id whose For/Against outcome drives side-effects (Covert unwraps to hidden).
 * Miscount revote resolves the elected law, not Miscount itself.
 */
export function resolutionEffectCardId(agenda) {
  if (!agenda) return null;
  if (agenda.miscountRevote && agenda.revote?.id) return agenda.revote.id;
  if (agenda.covert && agenda.hidden?.cardId) return agenda.hidden.cardId;
  return agenda.cardId || null;
}

/** Apply resolution: maybe push activeLaws, move card to discard. */
export function resolveAndDiscardAgenda(state, agenda, activeLaws, agendaDiscard) {
  const discard = [...(agendaDiscard || [])];
  if (agenda?.cardId) discard.push(agenda.cardId);
  if (agenda?.covert && agenda.hidden?.cardId) discard.push(agenda.hidden.cardId);

  const enactAgenda = effectiveAgendaForResolve(agenda);
  let laws = Array.isArray(activeLaws) ? [...activeLaws] : [];
  const outcome = resolveAgendaOutcome(state, enactAgenda);

  // Miscount Disclosed revote: re-resolve the elected law in place.
  if (agenda?.miscountRevote && agenda.revote?.id) {
    const lawId = String(agenda.revote.id);
    if (enactAgenda.type === 'FOR_AGAINST' && outcome === 'against') {
      laws = laws.filter((l) => String(l.id) !== lawId);
      if (!discard.includes(lawId)) discard.push(lawId);
    } else if (shouldEnactLaw(enactAgenda, outcome)) {
      const record = lawRecordFromAgenda(state, enactAgenda, outcome);
      laws = laws.filter((l) => String(l.id) !== String(record.id));
      laws.push(record);
    }
    return { activeLaws: laws, agendaDiscard: discard, outcome };
  }

  if (shouldEnactLaw(enactAgenda, outcome)) {
    const record = lawRecordFromAgenda(state, enactAgenda, outcome);
    // Replace existing copy of same law id if re-enacted.
    laws = laws.filter((l) => l.id !== record.id);
    laws.push(record);
  }

  // Judicial abolishment elects a law: if OTHER/PLAYER elects a law id that is active, remove it.
  if (
    enactAgenda?.elect === 'law'
    && enactAgenda.kind === 'directive'
    && !agenda?.miscountRevote
    && outcome
    && typeof outcome === 'object'
    && outcome.choice != null
  ) {
    const electedId = String(outcome.choice);
    laws = laws.filter((l) => String(l.id) !== electedId && String(l.title) !== electedId);
  }

  return { activeLaws: laws, agendaDiscard: discard, outcome };
}
