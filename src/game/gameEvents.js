import { STRATEGY_CARDS } from '../data/gameData';
import { techById } from '../data/technologies';
import { gameReducer } from './gameReducer';
import { activePlayer, playerById } from './selectors';

function strategyLabel(cardId) {
  const card = STRATEGY_CARDS.find(c => c.id === Number(cardId));
  if (!card) return cardId != null ? `#${cardId}` : '—';
  return card.name.replace(/^\d+\.\s*/, '');
}

function techLabel(techId) {
  if (!techId) return 'tech';
  return techById(techId)?.name || techId;
}

export const MAX_GAME_EVENTS = 200;

const asFinite = (value, fallback = Date.now()) =>
  (Number.isFinite(value) ? value : fallback);

function baseEvent(type, action, extra = {}) {
  return {
    type,
    at: asFinite(action?.at, Date.now()),
    ...extra,
  };
}

/**
 * Domain events derived from a successful state transition.
 * Keep this focused on table-visible moments (not every +/- secret).
 */
export function deriveGameEvents(prev, action, next) {
  if (!action || prev === next) return [];
  const type = action.type;
  const at = asFinite(action.at, Date.now());

  switch (type) {
    case 'START_GAME':
      return [baseEvent('GAME_STARTED', action, { at })];

    case 'START_STARTING_TECH_DRAFT':
      return [baseEvent('STARTING_TECH_DRAFT_STARTED', action, { at })];

    case 'CONFIRM_STARTING_TECH': {
      const picks = prev.startingTechDraft?.responses?.[action.playerId]?.picks ?? [];
      const events = [baseEvent('STARTING_TECH_CONFIRMED', action, {
        at,
        playerId: action.playerId,
        picks,
      })];
      if (prev.startingTechDraft?.active && !next.startingTechDraft?.active) {
        events.push(baseEvent('STARTING_TECH_DRAFT_COMPLETED', action, { at }));
      }
      return events;
    }

    case 'RESET_GAME':
      return [baseEvent('GAME_RESET', action, { at })];

    case 'START_ROUND':
      return [baseEvent('ROUND_STARTED', action, {
        at,
        roundNumber: next.meta?.roundNumber,
      })];

    case 'END_ROUND':
      return [baseEvent('ROUND_ENDED', action, {
        at,
        roundNumber: prev.meta?.roundNumber,
      })];

    case 'NEXT_TURN': {
      const from = activePlayer(prev);
      const to = activePlayer(next);
      if (!to || from?.id === to.id) return [];
      return [baseEvent('TURN_STARTED', action, {
        at,
        playerId: to.id,
        fromPlayerId: from?.id ?? null,
      })];
    }

    case 'PASS_TURN':
      return [baseEvent('PLAYER_PASSED', action, {
        at,
        playerId: action.playerId,
      })];

    case 'PLAY_STRATEGY': {
      const player = activePlayer(prev);
      if (next.round?.techResearch?.active
        && next.round?.strategyResolution?.active
        && next.round.strategyResolution.cardId === 7) {
        return [
          baseEvent('STRATEGY_RESOLUTION_STARTED', action, {
            at,
            playerId: player?.id ?? next.round.strategyResolution.playerId,
            cardId: 7,
          }),
          baseEvent('TECH_RESEARCH_STARTED', action, {
            at,
            playerId: player?.id ?? next.round.techResearch.primaryPlayerId,
            cardId: 7,
            mode: 'primary',
          }),
        ];
      }
      if (next.round?.imperialClaim?.active && !next.round?.strategyResolution?.active) {
        return [baseEvent('IMPERIAL_CLAIM_STARTED', action, {
          at,
          playerId: player?.id ?? next.round.imperialClaim.playerId,
          cardId: 8,
        })];
      }
      const cardId = next.round?.strategyResolution?.cardId ?? action.cardId ?? null;
      if (!player || cardId == null || !next.round?.strategyResolution?.active) return [];
      return [baseEvent('STRATEGY_RESOLUTION_STARTED', action, {
        at,
        playerId: player.id,
        cardId,
      })];
    }

    case 'RESOLVE_STRATEGY': {
      const wasActive = !!prev.round?.strategyResolution?.active;
      const stillActive = !!next.round?.strategyResolution?.active;
      if (!wasActive || stillActive) return [];
      const cardId = prev.round?.strategyResolution?.cardId ?? null;
      const playerId = prev.round?.strategyResolution?.playerId ?? null;
      return [baseEvent('STRATEGY_PLAYED', action, {
        at,
        playerId,
        cardId,
      })];
    }

    case 'SET_SPEAKER':
      if (prev.meta?.speakerId === next.meta?.speakerId) return [];
      return [baseEvent('SPEAKER_CHANGED', action, {
        at,
        playerId: action.playerId,
        fromPlayerId: prev.meta?.speakerId ?? null,
      })];

    case 'ELIMINATE_PLAYER':
      return [baseEvent('PLAYER_ELIMINATED', action, {
        at,
        playerId: action.playerId,
      })];

    case 'CONFIRM_DRAFT':
      return [baseEvent('DRAFT_CONFIRMED', action, { at })];

    case 'CONFIRM_OBJECTIVE_SCORING':
      return [baseEvent('OBJECTIVE_SCORING_DONE', action, {
        at,
        playerId: action.playerId,
        publicId: prev.statusPhase?.scoring?.responses?.[action.playerId]?.publicId ?? null,
        secret: !!prev.statusPhase?.scoring?.responses?.[action.playerId]?.secret,
      })];

    case 'PASS_OBJECTIVE_SCORING':
      return [baseEvent('OBJECTIVE_SCORING_PASSED', action, {
        at,
        playerId: action.playerId,
      })];

    case 'START_OBJECTIVE_SCORING':
      return [baseEvent('OBJECTIVE_SCORING_STARTED', action, { at })];

    case 'CONFIRM_STATUS_PHASE':
      return [baseEvent('STATUS_PHASE_CONFIRMED', action, { at })];

    case 'FINISH_AGENDA_PHASE':
      return [baseEvent('AGENDA_PHASE_FINISHED', action, {
        at,
        playerId: action.playerId ?? next.meta?.speakerId ?? null,
      })];

    case 'ADD_COMBAT_DAMAGE':
      return [baseEvent('COMBAT_RESOLVED', action, { at })];

    case 'CONFIRM_IMPERIAL_CLAIM': {
      const events = [baseEvent('IMPERIAL_CLAIMED', action, {
        at,
        playerId: action.playerId,
        publicId: prev.round?.imperialClaim?.publicId ?? null,
        mecatol: !!prev.round?.imperialClaim?.mecatol,
        secret: !!prev.round?.imperialClaim?.secret,
      })];
      if (next.round?.strategyResolution?.active) {
        events.push(baseEvent('STRATEGY_RESOLUTION_STARTED', action, {
          at,
          playerId: action.playerId,
          cardId: 8,
        }));
      }
      return events;
    }

    case 'RESEARCH_TECH': {
      const events = [];
      const prevIds = prev.players?.find(p => p.id === action.playerId)?.techIds || [];
      const nextIds = next.players?.find(p => p.id === action.playerId)?.techIds || [];
      if (nextIds.length > prevIds.length) {
        events.push(baseEvent('TECH_RESEARCHED', action, {
          at,
          playerId: action.playerId,
          techId: action.techId,
        }));
      }
      if (prev.round?.strategyResolution?.active
        && !next.round?.strategyResolution?.active
        && (next.players?.find(p => p.id === prev.round.strategyResolution.playerId)
          ?.playedCardIds || []).includes(7)) {
        events.push(baseEvent('STRATEGY_PLAYED', action, {
          at,
          playerId: prev.round.strategyResolution.playerId,
          cardId: 7,
        }));
      }
      return events;
    }

    case 'PASS_TECH_RESEARCH': {
      const events = [baseEvent('TECH_RESEARCH_PASSED', action, {
        at,
        playerId: action.playerId,
        mode: (() => {
          const session = prev.round?.techResearch;
          if (!session?.concurrent) return session?.mode ?? null;
          if (action.playerId === session.primaryPlayerId) return 'primary';
          const seat = prev.players?.find(p => p.id === action.playerId);
          return seat?.factionId === 'jolnar' ? 'primary' : 'secondary';
        })(),
      })];
      if (prev.round?.strategyResolution?.active
        && !next.round?.strategyResolution?.active
        && (next.players?.find(p => p.id === prev.round.strategyResolution.playerId)
          ?.playedCardIds || []).includes(7)) {
        events.push(baseEvent('STRATEGY_PLAYED', action, {
          at,
          playerId: prev.round.strategyResolution.playerId,
          cardId: 7,
        }));
      }
      return events;
    }

    case 'GRANT_TECH':
      return [baseEvent('TECH_GAINED', action, {
        at,
        playerId: action.playerId,
        techId: action.techId,
        byHost: true,
      })];

    case 'REVOKE_TECH':
      return [baseEvent('TECH_REMOVED', action, {
        at,
        playerId: action.playerId,
        techId: action.techId,
        byHost: true,
      })];

    case 'GRANT_BREAKTHROUGH':
      return [baseEvent('BREAKTHROUGH_GRANTED', action, {
        at,
        playerId: action.playerId,
        byHost: true,
      })];

    case 'REVOKE_BREAKTHROUGH':
      return [baseEvent('BREAKTHROUGH_REVOKED', action, {
        at,
        playerId: action.playerId,
        byHost: true,
      })];

    case 'SET_CUSTODIANS':
      return [baseEvent('CUSTODIANS_SET', action, {
        at,
        playerId: action.playerId ?? null,
      })];

    case 'SET_SUPPORT':
      return [baseEvent('SUPPORT_SET', action, {
        at,
        fromPlayerId: action.fromPlayerId,
        holderPlayerId: action.holderPlayerId ?? null,
      })];

    case 'TOGGLE_TECH': {
      const prevHas = (prev.players?.find(p => p.id === action.playerId)?.techIds || [])
        .includes(action.techId);
      const nextHas = (next.players?.find(p => p.id === action.playerId)?.techIds || [])
        .includes(action.techId);
      if (prevHas === nextHas) return [];
      return [baseEvent(nextHas ? 'TECH_GAINED' : 'TECH_REMOVED', action, {
        at,
        playerId: action.playerId,
        techId: action.techId,
        byHost: !!action.byHost,
      })];
    }

    case 'PASS_IMPERIAL_CLAIM': {
      const events = [baseEvent('IMPERIAL_PASSED', action, {
        at,
        playerId: action.playerId,
      })];
      if (next.round?.strategyResolution?.active) {
        events.push(baseEvent('STRATEGY_RESOLUTION_STARTED', action, {
          at,
          playerId: action.playerId,
          cardId: 8,
        }));
      }
      return events;
    }

    case 'CLAIM_EXPEDITION_SLICE': {
      if (prev.expedition === next.expedition
        && prev.players === next.players) return [];
      const sliceId = action.sliceId;
      const events = [baseEvent('EXPEDITION_SLICE_CLAIMED', action, {
        at,
        playerId: action.playerId,
        sliceId,
        breakthrough: !prev.players?.find(p => p.id === action.playerId)?.breakthrough
          && !!next.players?.find(p => p.id === action.playerId)?.breakthrough,
      })];
      if (next.expedition?.awaitingControlPick && !prev.expedition?.awaitingControlPick) {
        events.push(baseEvent('EXPEDITION_CONTROL_PENDING', action, {
          at,
          playerId: action.playerId,
          placedById: next.expedition.placedById,
        }));
      } else if (next.expedition?.completed && !prev.expedition?.completed) {
        events.push(baseEvent('EXPEDITION_COMPLETED', action, {
          at,
          playerId: action.playerId,
          controllerId: next.expedition.controllerId,
          placedById: next.expedition.placedById,
        }));
      }
      return events;
    }

    case 'RESOLVE_THUNDERS_EDGE_CONTROL': {
      if (!next.expedition?.completed || prev.expedition?.completed) return [];
      return [baseEvent('EXPEDITION_COMPLETED', action, {
        at,
        playerId: action.playerId,
        controllerId: next.expedition.controllerId,
        placedById: next.expedition.placedById,
      })];
    }

    case 'SET_EXPEDITION_SLICE': {
      if (prev.expedition === next.expedition && prev.players === next.players) return [];
      const events = [baseEvent('EXPEDITION_SLICE_EDITED', action, {
        at,
        sliceId: action.sliceId,
        playerId: action.playerId ?? null,
        byHost: true,
      })];
      if (next.expedition?.awaitingControlPick && !prev.expedition?.awaitingControlPick) {
        events.push(baseEvent('EXPEDITION_CONTROL_PENDING', action, {
          at,
          playerId: action.playerId,
          placedById: next.expedition.placedById,
        }));
      } else if (next.expedition?.completed && !prev.expedition?.completed) {
        events.push(baseEvent('EXPEDITION_COMPLETED', action, {
          at,
          playerId: action.playerId,
          controllerId: next.expedition.controllerId,
          placedById: next.expedition.placedById,
        }));
      }
      return events;
    }

    case 'OPEN_DRAFT':
      if (!next.draft?.showModal || prev.draft?.queue?.length) return [];
      return [baseEvent('DRAFT_OPENED', action, { at })];

    default:
      return [];
  }
}

export function appendGameEvents(state, newEvents) {
  if (!newEvents?.length) return state;
  const prev = Array.isArray(state.log?.events) ? state.log.events : [];
  const events = [...prev, ...newEvents].slice(-MAX_GAME_EVENTS);
  return {
    ...state,
    log: { events },
  };
}

/** Reducer entry used by UI sync + room server (adds bounded domain log). */
export function reduceGame(state, action) {
  const next = gameReducer(state, action);
  if (next === state) return state;

  if (action?.type === 'RESET_GAME') {
    const resetEvents = deriveGameEvents(state, action, next);
    return {
      ...next,
      log: { events: resetEvents.slice(-MAX_GAME_EVENTS) },
    };
  }

  return appendGameEvents(next, deriveGameEvents(state, action, next));
}

export function playerName(players, playerId) {
  return playerById({ players }, playerId)?.name || (playerId != null ? `#${playerId}` : '—');
}

/** Short Russian line for the journal UI. */
export function formatGameEvent(event, players = []) {
  if (!event?.type) return '';
  const name = (id) => playerName(players, id);

  switch (event.type) {
    case 'GAME_STARTED':
      return 'Партия начата';
    case 'GAME_RESET':
      return 'Партия сброшена';
    case 'ROUND_STARTED':
      return `Раунд ${event.roundNumber ?? '—'} начат`;
    case 'ROUND_ENDED':
      return `Раунд ${event.roundNumber ?? '—'} завершён`;
    case 'TURN_STARTED':
      return `Ход: ${name(event.playerId)}`;
    case 'PLAYER_PASSED':
      return `${name(event.playerId)} пасует`;
    case 'STRATEGY_RESOLUTION_STARTED':
      return `${name(event.playerId)} разыгрывает «${strategyLabel(event.cardId)}»`;
    case 'STRATEGY_PLAYED':
      return `${name(event.playerId)} сыграл «${strategyLabel(event.cardId)}»`;
    case 'SPEAKER_CHANGED':
      return `Спикер: ${name(event.playerId)}`;
    case 'PLAYER_ELIMINATED':
      return `${name(event.playerId)} устранён`;
    case 'DRAFT_OPENED':
      return 'Открыт драфт стратегий';
    case 'DRAFT_CONFIRMED':
      return 'Драфт подтверждён';
    case 'OBJECTIVE_SCORING_STARTED':
      return 'Начат скоринг целей';
    case 'OBJECTIVE_SCORING_DONE':
      return `${name(event.playerId)} подтвердил цели`;
    case 'OBJECTIVE_SCORING_PASSED':
      return `${name(event.playerId)} спасовал в скоринге`;
    case 'STATUS_PHASE_CONFIRMED':
      return 'Фаза статуса подтверждена';
    case 'AGENDA_PHASE_FINISHED':
      return 'Фаза политики завершена';
    case 'COMBAT_RESOLVED':
      return 'Зафиксирован бой';
    case 'IMPERIAL_CLAIM_STARTED':
      return `${name(event.playerId)} использует Экспансию`;
    case 'IMPERIAL_CLAIMED': {
      const parts = [];
      if (event.mecatol) parts.push('Мекатол');
      if (event.secret) parts.push('секретка');
      if (event.publicId) parts.push('общая цель');
      const detail = parts.length ? ` (${parts.join(' + ')})` : '';
      return `${name(event.playerId)} использовал Экспансию${detail}`;
    }
    case 'IMPERIAL_PASSED':
      return `${name(event.playerId)} пропустил способность Экспансии`;
    case 'TECH_RESEARCH_STARTED':
      return event.mode === 'secondary'
        ? `${name(event.playerId)} исследует (вторичная)`
        : `${name(event.playerId)} исследует технологии`;
    case 'TECH_RESEARCHED':
      return `${name(event.playerId)} исследовал ${techLabel(event.techId)}`;
    case 'TECH_RESEARCH_PASSED':
      return `${name(event.playerId)} завершил исследование`;
    case 'TECH_GAINED':
      return event.byHost
        ? `Хост выдал ${techLabel(event.techId)} → ${name(event.playerId)}`
        : `${name(event.playerId)} получил ${techLabel(event.techId)}`;
    case 'TECH_REMOVED':
      return event.byHost
        ? `Хост снял ${techLabel(event.techId)} у ${name(event.playerId)}`
        : `${name(event.playerId)} снял ${techLabel(event.techId)}`;
    case 'BREAKTHROUGH_GRANTED':
      return `Хост выдал прорыв → ${name(event.playerId)}`;
    case 'BREAKTHROUGH_REVOKED':
      return `Хост снял прорыв у ${name(event.playerId)}`;
    case 'CUSTODIANS_SET':
      return event.playerId == null
        ? 'Токен Хранителей сброшен'
        : `${name(event.playerId)} взял Хранителей (+1 ПО)`;
    case 'SUPPORT_SET':
      return event.holderPlayerId == null
        ? `Support ${name(event.fromPlayerId)} возвращён`
        : `${name(event.holderPlayerId)} держит Support ${name(event.fromPlayerId)}`;
    case 'STARTING_TECH_DRAFT_STARTED':
      return 'Начат выбор стартовых технологий';
    case 'STARTING_TECH_CONFIRMED': {
      const picks = (event.picks || []).map(techLabel).join(', ');
      return picks
        ? `${name(event.playerId)} подтвердил стартовые технологии: ${picks}`
        : `${name(event.playerId)} подтвердил стартовые технологии`;
    }
    case 'STARTING_TECH_DRAFT_COMPLETED':
      return 'Стартовые технологии распределены';
    case 'EXPEDITION_SLICE_CLAIMED': {
      const bt = event.breakthrough ? ' · прорыв' : '';
      return `${name(event.playerId)} занял слот экспедиции${bt}`;
    }
    case 'EXPEDITION_SLICE_EDITED':
      return event.playerId == null
        ? `Хост снял метку экспедиции (${event.sliceId || 'слот'})`
        : `Хост поставил метку экспедиции → ${name(event.playerId)}`;
    case 'EXPEDITION_CONTROL_PENDING':
      return `Экспедиция: ничья — ${name(event.placedById ?? event.playerId)} выбирает контроль`;
    case 'EXPEDITION_COMPLETED':
      return `Грозовой рубеж: контроль у ${name(event.controllerId)}`;
    default:
      return event.type;
  }
}
