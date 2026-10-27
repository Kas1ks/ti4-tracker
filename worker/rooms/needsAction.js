/**
 * Who needs to act right now (for Web Push). Pure — no I/O.
 * Returns per-seat reasons; optional host/admin-only prompt.
 */

function activePlayers(state) {
  return (state?.players || []).filter((p) => !p?.eliminated);
}

function turnOrder(state) {
  const byId = new Map((state?.players || []).map((p) => [p.id, p]));
  return (state?.round?.turnOrderIds || []).map((id) => byId.get(id)).filter(Boolean);
}

function activePlayer(state) {
  const order = turnOrder(state);
  const idx = Number(state?.round?.activeTurnIdx) || 0;
  return order[idx] || null;
}

function strategyResolution(state) {
  return state?.round?.strategyResolution || { active: false, responses: {} };
}

function objectiveScoring(state) {
  return state?.statusPhase?.scoring || { active: false, responses: {}, orderIds: [], currentIdx: 0 };
}

function combatOf(state) {
  return state?.round?.combat || { active: false };
}

function politicsOf(state) {
  return state?.politics || {};
}

function currentAgenda(state) {
  const politics = politicsOf(state);
  const agendas = politics.agendas || [];
  const idx = Number(politics.currentAgendaIndex) || 0;
  return agendas[idx] || null;
}

function votingOrderIds(state) {
  // Mirror selectors.votingOrder: clockwise from speaker, speaker last.
  const seats = activePlayers(state);
  if (!seats.length) return [];
  const speakerId = state?.meta?.speakerId;
  const reversed = !!politicsOf(state).voteReversed;
  const ids = seats.map((p) => p.id);
  if (speakerId == null || !ids.some((id) => String(id) === String(speakerId))) {
    return reversed ? [...ids].reverse() : ids;
  }
  const speakerIdx = ids.findIndex((id) => String(id) === String(speakerId));
  const rotated = [
    ...ids.slice(speakerIdx + 1),
    ...ids.slice(0, speakerIdx),
  ];
  const order = reversed ? rotated.reverse() : rotated;
  order.push(ids[speakerIdx]);
  return order;
}

function currentVoterId(state) {
  const agenda = currentAgenda(state);
  if (!agenda?.type) return null;
  const order = votingOrderIds(state);
  return order.find((id) => !agenda.locked?.[id] && !agenda.locked?.[String(id)]) ?? null;
}

function hitEntered(combat, playerId) {
  const v = combat?.hits?.[playerId] ?? combat?.hits?.[String(playerId)];
  return v != null && Number.isFinite(Number(v));
}

function assigned(combat, playerId) {
  return !!(combat?.assigned?.[playerId] ?? combat?.assigned?.[String(playerId)]);
}

function putSeat(map, seatId, entry) {
  if (seatId == null) return;
  const key = String(seatId);
  if (map.has(key)) return;
  map.set(key, { seatPlayerId: seatId, ...entry });
}

/**
 * @param {object|null|undefined} state
 * @returns {{
 *   seats: Map<string, { seatPlayerId: any, reason: string, title: string, body: string }>,
 *   admin: null | { reason: string, title: string, body: string }
 * }}
 */
export function collectNeedsAction(state) {
  const seats = new Map();
  let admin = null;

  if (!state?.isGameActive) {
    return { seats, admin };
  }

  const combat = combatOf(state);
  if (combat.active) {
    if (combat.mode === 'pvp' && combat.phase === 'input') {
      for (const id of [combat.attackerId, combat.defenderId]) {
        if (id == null || hitEntered(combat, id)) continue;
        putSeat(seats, id, {
          reason: 'combat-hits',
          title: 'Введите попадания',
          body: 'В бою нужно указать число попаданий.',
        });
      }
    } else if (combat.mode === 'pvp' && combat.phase === 'reveal') {
      for (const id of [combat.attackerId, combat.defenderId]) {
        if (id == null || assigned(combat, id)) continue;
        putSeat(seats, id, {
          reason: 'combat-assign',
          title: 'Распределите попадания',
          body: 'Подтвердите назначение урона в бою.',
        });
      }
    } else if (combat.mode === 'neutral') {
      if (combat.phase === 'setup' || combat.phase === 'input') {
        if (combat.attackerId != null && (combat.phase === 'setup' || !hitEntered(combat, combat.attackerId))) {
          putSeat(seats, combat.attackerId, {
            reason: combat.phase === 'setup' ? 'combat-setup' : 'combat-hits',
            title: combat.phase === 'setup' ? 'Состав нейтралов' : 'Введите попадания',
            body: combat.phase === 'setup'
              ? 'Задайте состав нейтрального флота.'
              : 'Укажите попадания по нейтралам.',
          });
        }
      } else if (combat.phase === 'reveal') {
        if (combat.attackerId != null && !assigned(combat, combat.attackerId)) {
          putSeat(seats, combat.attackerId, {
            reason: 'combat-assign',
            title: 'Распределите попадания',
            body: 'Подтвердите назначение урона.',
          });
        }
        admin = {
          reason: 'combat-host',
          title: 'Бой: действие хоста',
          body: 'Нужно назначить потери нейтралам / продолжить бой.',
        };
      } else if (combat.phase === 'rolling') {
        admin = {
          reason: 'combat-host',
          title: 'Бой: бросок хоста',
          body: 'Нужно завершить бросок нейтралов.',
        };
      }
    }
    if (combat.phase === 'retreat_check' && combat.retreatPlayerId != null) {
      // Host resolves retreat; notify admin.
      admin = admin || {
        reason: 'combat-host',
        title: 'Отступление',
        body: 'Нужно разрешить проверку отступления.',
      };
    }
    // Combat blocks the normal turn clock — don't also ping "your turn".
    return { seats, admin };
  }

  const resolution = strategyResolution(state);
  if (resolution.active) {
    for (const p of activePlayers(state)) {
      const status = resolution.responses?.[p.id]
        ?? resolution.responses?.[String(p.id)];
      if (status === 'pending') {
        putSeat(seats, p.id, {
          reason: 'strategy-resolution',
          title: 'Ответ по стратегии',
          body: 'Нужно подтвердить или отказаться от эффекта карты.',
        });
      }
    }
    // Resolution poll owns attention — skip plain "your turn".
    return { seats, admin };
  }

  const scoring = objectiveScoring(state);
  if (scoring.active) {
    const currentId = scoring.orderIds?.[scoring.currentIdx];
    if (currentId != null) {
      const resp = scoring.responses?.[currentId] ?? scoring.responses?.[String(currentId)];
      if (!resp || resp.status === 'pending') {
        putSeat(seats, currentId, {
          reason: 'scoring',
          title: 'Скоринг целей',
          body: 'Ваш ход заявить цели.',
        });
      }
    }
  }

  const imperial = state?.round?.imperialClaim;
  if (imperial?.active && imperial.playerId != null) {
    putSeat(seats, imperial.playerId, {
      reason: 'imperial',
      title: 'Imperial',
      body: 'Нужно выбрать, что заявляете по Imperial.',
    });
  }

  const tech = state?.round?.techResearch;
  if (tech?.active) {
    if (tech.concurrent) {
      for (const p of activePlayers(state)) {
        const status = resolution.responses?.[p.id]
          ?? resolution.responses?.[String(p.id)];
        if (status === 'pending') {
          putSeat(seats, p.id, {
            reason: 'tech',
            title: 'Исследование технологий',
            body: 'Выберите технологии или пропустите.',
          });
        }
      }
    } else if (tech.playerId != null) {
      putSeat(seats, tech.playerId, {
        reason: 'tech',
        title: 'Исследование технологий',
        body: 'Выберите технологии.',
      });
    }
  }

  const politics = politicsOf(state);
  if (politics.showModal) {
    if (politics.step === 'VOTE') {
      const voterId = currentVoterId(state);
      if (voterId != null) {
        putSeat(seats, voterId, {
          reason: 'politics-vote',
          title: 'Голосование',
          body: 'Ваш ход голосовать по повестке.',
        });
      }
    } else if (politics.step === 'SETUP') {
      const locked = politics.influenceLocked || {};
      for (const p of activePlayers(state)) {
        if (!locked[p.id] && !locked[String(p.id)]) {
          putSeat(seats, p.id, {
            reason: 'politics-influence',
            title: 'Политика: влияние',
            body: 'Задайте и зафиксируйте влияние для голосования.',
          });
        }
      }
    } else if (politics.step === 'SPEAKER') {
      const speakerId = state?.meta?.speakerId;
      if (speakerId != null) {
        putSeat(seats, speakerId, {
          reason: 'politics-speaker',
          title: 'Выбор спикера',
          body: 'Нужно выбрать следующего спикера.',
        });
      }
    }
  }

  const draft = state?.startingTechDraft;
  if (draft?.active && draft.responses) {
    for (const [id, resp] of Object.entries(draft.responses)) {
      if (resp?.status && resp.status !== 'confirmed') {
        putSeat(seats, Number.isNaN(Number(id)) ? id : Number(id), {
          reason: 'starting-tech',
          title: 'Стартовые технологии',
          body: 'Выберите стартовые технологии.',
        });
      }
    }
  }

  const expedition = state?.expedition;
  if (expedition?.awaitingControlPick && expedition.placedById != null) {
    putSeat(seats, expedition.placedById, {
      reason: 'expedition',
      title: 'Экспедиция',
      body: 'Выберите, кто контролирует Thunder\'s Edge.',
    });
  }

  // Main action turn (only if nothing higher-priority already listed for that seat).
  const ap = activePlayer(state);
  if (ap) {
    const passed = state?.round?.passed || {};
    if (!passed[ap.id] && !passed[String(ap.id)]) {
      putSeat(seats, ap.id, {
        reason: 'turn',
        title: 'Ваш ход',
        body: 'Нужно сыграть стратегию или сделать действие.',
      });
    }
  }

  return { seats, admin };
}

/**
 * Edge-detect: who newly needs action after a state transition.
 * @returns {Array<{ target: 'seat'|'admin', seatPlayerId?: any, reason: string, title: string, body: string }>}
 */
export function newlyNeedingAction(prevState, nextState) {
  const prev = collectNeedsAction(prevState);
  const next = collectNeedsAction(nextState);
  const out = [];

  for (const [key, entry] of next.seats) {
    if (prev.seats.has(key)) continue;
    out.push({
      target: 'seat',
      seatPlayerId: entry.seatPlayerId,
      reason: entry.reason,
      title: entry.title,
      body: entry.body,
    });
  }

  if (next.admin && (!prev.admin || prev.admin.reason !== next.admin.reason)) {
    // Fire when admin prompt appears or reason changes (new host task).
    if (!prev.admin) {
      out.push({
        target: 'admin',
        reason: next.admin.reason,
        title: next.admin.title,
        body: next.admin.body,
      });
    }
  }

  return out;
}
