import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_FACTIONS } from '../data/gameData';
import brandMark from '../assets/brand-mark.png';
import combatHostShellBg from '../assets/combat/host-shell-bg-right.jpg';
import combatAssignBg from '../assets/combat/assign-bg.jpg';
import combatAttackBg from '../assets/combat/attack-bg.jpg';
import {
  NEUTRAL_OPPONENT_ID,
  NEUTRAL_UNITS,
  emptyNeutralCounts,
  neutralUnitIconUrl,
  rollNeutralCombat,
  summarizeNeutralRoll,
} from '../data/neutralUnits';
import {
  DICE_ROLL_MS,
  playDiceRevealSound,
  playDiceRollSound,
  unlockDiceAudio,
  vibrateDice,
} from '../utils/diceSound';
import { formatTime } from '../utils/game';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const ROLL_MS = DICE_ROLL_MS;
const ROLL_DIE_COUNT = 5;

function randomFaces(n) {
  return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 10));
}

export function CombatModal({
  show,
  minimized,
  onMinimize,
  onClose,
  activePlayer,
  activePlayers,
  combatSessionTime = 0,
  onRecordDamage,
  /** Synced combat blob from game.round.combat */
  combat = null,
  onSetOpponent,
  onSetNeutralCounts,
  onBeginNeutral,
  onSetHits,
  onAssign,
  onDeclareRetreat,
  onResolveRetreat,
  onDefeat,
  /** Local scratch only while host still on pick / legacy (unused once synced). */
  combatHits,
  setCombatHits,
  combatRound,
  setCombatRound,
  totalCombatDamage,
  setTotalCombatDamage,
  readOnly = false,
}) {
  const [neutralCounts, setNeutralCounts] = useState(emptyNeutralCounts);
  const [draftAttackerHits, setDraftAttackerHits] = useState(0);
  const [lastNeutralRoll, setLastNeutralRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [spinFaces, setSpinFaces] = useState(() => randomFaces(ROLL_DIE_COUNT));
  const audioRef = useRef(null);
  const rollTimerRef = useRef(null);
  const spinTimerRef = useRef(null);
  /** Prevent double-starting host dice when phone enters phase=rolling. */
  const rollingSpectacleStartedRef = useRef(false);

  const attacker = activePlayer || activePlayers?.[0] || null;
  const synced = !!combat?.active;
  const isPvp = synced && combat.mode === 'pvp';
  const isNeutral = synced && combat.mode === 'neutral';
  const picking = synced && (!combat.mode || combat.phase === 'pick') && !isPvp && !isNeutral;
  const phase = synced ? combat.phase : 'input';
  const isSetup = isNeutral && phase === 'setup';

  const opponent = isPvp
    ? activePlayers.find((p) => String(p.id) === String(combat.defenderId))
    : null;
  const hasOpponent = isPvp ? !!opponent : isNeutral;

  const attackerHits = isPvp || isNeutral
    ? (combat.hits?.[combat.attackerId] ?? (isNeutral ? draftAttackerHits : 0))
    : (combatHits?.attacker ?? 0);
  const defenderHits = isPvp
    ? (combat.hits?.[combat.defenderId] ?? 0)
    : isNeutral
      ? (combat.hits?.[NEUTRAL_OPPONENT_ID] ?? 0)
      : (combatHits?.defender ?? 0);
  const attackerTotal = isPvp || isNeutral
    ? (Number(combat.totals?.[combat.attackerId]) || 0)
      + (Number(combat.hits?.[combat.attackerId]) || (isNeutral && combat.hits?.[combat.attackerId] == null
        ? draftAttackerHits
        : 0))
    : (totalCombatDamage?.attacker || 0) + (combatHits?.attacker || 0);
  const defenderTotal = isPvp
    ? (Number(combat.totals?.[combat.defenderId]) || 0) + (Number(combat.hits?.[combat.defenderId]) || 0)
    : isNeutral
      ? (Number(combat.totals?.[NEUTRAL_OPPONENT_ID]) || 0)
        + (Number(combat.hits?.[NEUTRAL_OPPONENT_ID]) || 0)
      : (totalCombatDamage?.defender || 0) + (combatHits?.defender || 0);
  const roundNum = isPvp || isNeutral ? (combat.round || 1) : combatRound;

  useEscapeKey(onClose, show && !minimized && !!attacker && !rolling);
  useBodyScrollLock(show && !minimized && !!attacker);

  useEffect(() => () => {
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
  }, []);

  // Unlock WebAudio on open / any pointer so synced phone rolls can play sound.
  useEffect(() => {
    if (!show) return undefined;
    unlockDiceAudio(audioRef);
    const unlock = () => { unlockDiceAudio(audioRef); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [show]);

  useEffect(() => {
    if (!isNeutral) return;
    setNeutralCounts({ ...emptyNeutralCounts(), ...(combat.neutralCounts || {}) });
    if (phase === 'input') {
      setLastNeutralRoll(null);
      if (combat.hits?.[combat.attackerId] == null) setDraftAttackerHits(0);
    }
    if (phase === 'rolling') {
      setLastNeutralRoll(null);
      unlockDiceAudio(audioRef);
    }
  }, [isNeutral, combat?.neutralCounts, phase, combat?.hits, combat?.attackerId, combat?.round]);

  const neutralDiceReady = useMemo(
    () => NEUTRAL_UNITS.some((u) => (neutralCounts[u.id] || 0) > 0),
    [neutralCounts],
  );

  const clearRollTimers = () => {
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
    rollTimerRef.current = null;
    spinTimerRef.current = null;
  };

  /** Same row-of-dice spin + sound as before; duration ~ROLL_MS. */
  const playNeutralDiceSpectacle = (onDone) => {
    clearRollTimers();
    setRolling(true);
    setLastNeutralRoll(null);
    unlockDiceAudio(audioRef).then(() => {
      playDiceRollSound(audioRef, ROLL_MS / 1000);
    });
    vibrateDice('roll');
    spinTimerRef.current = window.setInterval(() => {
      setSpinFaces(randomFaces(ROLL_DIE_COUNT));
    }, 70);
    rollTimerRef.current = window.setTimeout(() => {
      if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
      spinTimerRef.current = null;
      onDone?.();
      setRolling(false);
    }, ROLL_MS);
  };

  // Phone submitted hits → phase rolling. Host alone plays dice + sound, then publishes roll.
  useEffect(() => {
    if (!show || !isNeutral || phase !== 'rolling' || readOnly) {
      if (phase !== 'rolling') rollingSpectacleStartedRef.current = false;
      return undefined;
    }
    if (rollingSpectacleStartedRef.current) return undefined;
    rollingSpectacleStartedRef.current = true;

    const playerHits = Number(combat.hits?.[combat.attackerId]) || 0;
    const counts = { ...emptyNeutralCounts(), ...(combat.neutralCounts || {}) };

    playNeutralDiceSpectacle(() => {
      const result = rollNeutralCombat(counts);
      setLastNeutralRoll(result);
      playDiceRevealSound(audioRef, result.hits);
      vibrateDice('reveal');
      onSetHits?.(combat.attackerId, playerHits, {
        neutralHits: result.hits,
        neutralRoll: result,
      });
    });
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, isNeutral, phase, readOnly, combat?.attackerId, combat?.hits, combat?.neutralCounts]);

  if (!show || !attacker) return null;

  const attackerFaction = ALL_FACTIONS.find((f) => f.id === attacker.factionId);
  const defenderFaction = opponent
    ? ALL_FACTIONS.find((f) => f.id === opponent.factionId)
    : null;

  const bumpSyncedHits = (playerId, delta) => {
    if (readOnly || !isPvp || (phase !== 'input' && phase !== 'reveal')) return;
    const raw = combat.hits?.[playerId];
    const base = raw == null || raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
    // Host correction: never auto-lock into reveal on stepper clicks.
    onSetHits?.(playerId, Math.max(0, base + delta), { adjust: true });
  };

  const bothPvpHitsEntered = isPvp
    && combat.hits?.[combat.attackerId] != null
    && combat.hits?.[combat.defenderId] != null
    && Number.isFinite(Number(combat.hits[combat.attackerId]))
    && Number.isFinite(Number(combat.hits[combat.defenderId]));

  const isResult = (isPvp || isNeutral) && phase === 'result';
  const isRetreatCheck = (isPvp || isNeutral) && phase === 'retreat_check';
  const retreatPlayerId = (isPvp || isNeutral) ? combat.retreatPlayerId : null;
  const retreatPending = retreatPlayerId != null;
  const retreatPlayer = retreatPending
    ? activePlayers.find((p) => String(p.id) === String(retreatPlayerId))
    : null;
  const isRetreatResult = isResult && combat?.resultKind === 'retreat';
  const winnerIsNeutral = isResult && String(combat.winnerId) === NEUTRAL_OPPONENT_ID;
  const loserIsNeutral = isResult && String(combat.loserId) === NEUTRAL_OPPONENT_ID;
  const resultWinner = isResult && !winnerIsNeutral
    ? activePlayers.find((p) => String(p.id) === String(combat.winnerId))
    : null;
  const resultLoser = isResult && !loserIsNeutral
    ? activePlayers.find((p) => String(p.id) === String(combat.loserId))
    : null;
  const resultWinnerFaction = resultWinner
    ? ALL_FACTIONS.find((f) => f.id === resultWinner.factionId)
    : null;
  const resultLoserFaction = resultLoser
    ? ALL_FACTIONS.find((f) => f.id === resultLoser.factionId)
    : null;
  const resultWinnerName = winnerIsNeutral ? 'Нейтралы' : (resultWinner?.name || '—');
  const resultLoserName = loserIsNeutral ? 'Нейтралы' : (resultLoser?.name || '—');

  const handleEndCombat = () => {
    if (rolling) return;
    if (isPvp || isNeutral) {
      if (isResult) {
        onClose();
        return;
      }
      onDefeat?.();
      return;
    }
    if (!hasOpponent) return;
    onRecordDamage?.({
      [attacker.id]: (totalCombatDamage?.defender || 0) + (combatHits?.defender || 0),
    });
    onClose();
  };

  const handleNextCombatRound = () => {
    if (rolling || readOnly) return;
    if (isPvp) {
      if (phase === 'reveal' || (phase === 'input' && bothPvpHitsEntered)) {
        if (!combat.assigned?.[combat.attackerId]) {
          onAssign?.(combat.attackerId, phase === 'input' ? { hostAdvance: true } : undefined);
        }
        if (!combat.assigned?.[combat.defenderId]) {
          onAssign?.(combat.defenderId, phase === 'input' ? { hostAdvance: true } : undefined);
        }
      }
      return;
    }
    if (isNeutral) {
      if (phase === 'reveal') {
        // Host can confirm both sides: player seat + neutral casualties.
        if (!combat.assigned?.[combat.attackerId]) onAssign?.(combat.attackerId);
        if (!combat.assigned?.[NEUTRAL_OPPONENT_ID]) {
          onSetNeutralCounts?.(neutralCounts);
          onAssign?.(NEUTRAL_OPPONENT_ID, { counts: neutralCounts });
        }
      }
      return;
    }
    setTotalCombatDamage((prev) => ({
      attacker: prev.attacker + combatHits.attacker,
      defender: prev.defender + combatHits.defender,
    }));
    setCombatHits({ attacker: 0, defender: 0 });
    setLastNeutralRoll(null);
    setCombatRound((prev) => prev + 1);
  };

  const bumpNeutral = (id, delta) => {
    if (rolling || readOnly) return;
    if (isNeutral && phase !== 'setup' && phase !== 'input' && phase !== 'reveal') return;
    const unit = NEUTRAL_UNITS.find((u) => u.id === id);
    const max = unit?.max ?? Infinity;
    setNeutralCounts((prev) => {
      const next = {
        ...prev,
        [id]: Math.min(max, Math.max(0, (prev[id] || 0) + delta)),
      };
      if (isNeutral) onSetNeutralCounts?.(next);
      return next;
    });
  };

  const assignNeutralHits = () => {
    if (!isNeutral || phase !== 'reveal' || readOnly || rolling) return;
    if (combat.assigned?.[NEUTRAL_OPPONENT_ID]) return;
    onSetNeutralCounts?.(neutralCounts);
    onAssign?.(NEUTRAL_OPPONENT_ID, { counts: neutralCounts });
  };

  const submitNeutralHits = () => {
    if (!isNeutral || phase !== 'input' || readOnly || rolling) return;
    if (!neutralDiceReady) return;
    if (combat.hits?.[combat.attackerId] != null) return;
    // Hits only → phase=rolling; dice spectacle runs in the shared host effect.
    unlockDiceAudio(audioRef);
    onSetHits?.(combat.attackerId, draftAttackerHits);
  };

  const selectPlayer = (id) => {
    if (readOnly) return;
    onSetOpponent?.({ defenderId: id });
    setCombatHits({ attacker: 0, defender: 0 });
    setTotalCombatDamage({ attacker: 0, defender: 0 });
    setCombatRound(1);
    setLastNeutralRoll(null);
  };

  const selectNeutral = () => {
    if (readOnly) return;
    onSetOpponent?.({ neutral: true });
    setCombatHits({ attacker: 0, defender: 0 });
    setTotalCombatDamage({ attacker: 0, defender: 0 });
    setCombatRound(1);
    setNeutralCounts(emptyNeutralCounts());
    setDraftAttackerHits(0);
    setLastNeutralRoll(null);
  };

  const showPick = !isResult && (picking || (!hasOpponent && !isPvp && !isNeutral));
  const displayRoll = lastNeutralRoll;
  const attackerHitsLocked = isNeutral && combat.hits?.[combat.attackerId] != null;

  if (minimized) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-modal-title"
        className={`combat-pick-shell game-combat-pick w-full max-md:overflow-y-auto modal-scroll ${
          isResult || !showPick
            ? `is-combat-fight ${isNeutral ? 'is-neutral-fight' : ''} max-md:max-h-[min(92vh,100dvh)]`
            : 'max-md:max-h-[min(88vh,100dvh)]'
        } relative z-[1] md:max-w-3xl`}
        style={
          isResult || !showPick
            ? {
              '--combat-shell-bg': `url(${combatHostShellBg})`,
              '--combat-attacker-bg': `url(${combatAssignBg})`,
              '--combat-defender-bg': `url(${combatAttackBg})`,
            }
            : undefined
        }
        onPointerDown={() => { unlockDiceAudio(audioRef); }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="combat-pick-inner">
          <div className="flex justify-between items-center game-combat-pick-head">
            <h2 id="combat-modal-title" className="game-modal-title text-lg uppercase flex items-center gap-2.5">
              {!showPick && (
                <img src={brandMark} alt="" className="game-combat-pick-mark" draggable={false} />
              )}
              {isResult ? 'Итог боя' : 'Бой'}
              {combatSessionTime > 0 && (
                <span className="game-combat-timer" title="Время боя (отдельно от хода)">
                  <i className="fa-solid fa-stopwatch" aria-hidden="true" />
                  <span>{formatTime(combatSessionTime)}</span>
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              {typeof onMinimize === 'function' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMinimize();
                  }}
                  className="game-btn-ghost text-xs px-2 py-1"
                >
                  Свернуть
                </button>
              )}
              <button type="button" onClick={onClose} className="game-btn-ghost text-xs px-2 py-1">
                ✕
              </button>
            </div>
          </div>

          {isResult ? (
            <div className="game-combat-fight game-combat-result">
              <div className="game-combat-result-badge" aria-hidden="true">
                <i className="fa-solid fa-trophy" />
              </div>
              <p className="game-combat-result-line">
                {isRetreatResult ? (
                  <>
                    <strong>{resultLoserName}</strong>
                    {' отступил от '}
                    <strong>{resultWinnerName}</strong>
                  </>
                ) : (
                  <>
                    <strong>{resultWinnerName}</strong>
                    {' победил '}
                    <strong>{resultLoserName}</strong>
                  </>
                )}
              </p>
              <div className="game-combat-duel is-result">
                <div className="game-combat-panel is-attacker">
                  <div className="game-combat-panel-role">Победитель</div>
                  <div className="game-combat-panel-who">
                    {winnerIsNeutral ? (
                      <div className="game-combat-panel-ghost">
                        <i className="fa-solid fa-ghost" aria-hidden="true" />
                      </div>
                    ) : (
                      <img src={resultWinnerFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                    )}
                    <div className="game-combat-panel-name">{resultWinnerName}</div>
                  </div>
                  <div className="game-combat-total">
                    <span className="game-combat-total-label">Урон</span>
                    <span className="game-combat-total-num">{Number(combat.totals?.[combat.winnerId]) || 0}</span>
                  </div>
                </div>
                <div className="game-combat-panel is-defender">
                  <div className="game-combat-panel-role">{isRetreatResult ? 'Отступление' : 'Поражение'}</div>
                  <div className="game-combat-panel-who">
                    {loserIsNeutral ? (
                      <div className="game-combat-panel-ghost">
                        <i className="fa-solid fa-ghost" aria-hidden="true" />
                      </div>
                    ) : (
                      <img src={resultLoserFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                    )}
                    <div className="game-combat-panel-name">{resultLoserName}</div>
                  </div>
                  <div className="game-combat-total">
                    <span className="game-combat-total-label">Урон</span>
                    <span className="game-combat-total-num">{Number(combat.totals?.[combat.loserId]) || 0}</span>
                  </div>
                </div>
              </div>
              <div className="game-combat-actions is-result">
                <button
                  type="button"
                  onClick={handleEndCombat}
                  className="game-combat-btn is-assign"
                  disabled={readOnly}
                >
                  OK
                </button>
              </div>
            </div>
          ) : showPick ? (
            <div className="game-combat-pick-body">
              <div className="game-combat-pick-prompt">
                Выберите противника
                <div className="game-combat-pick-rule" aria-hidden="true" />
              </div>

              <button type="button" onClick={selectNeutral} className="game-combat-neutral" disabled={readOnly}>
                <span className="game-combat-neutral-glow" aria-hidden="true" />
                <span className="game-combat-neutral-icon">
                  <i className="fa-solid fa-ghost" aria-hidden="true" />
                </span>
                <span className="game-combat-neutral-title">Нейтральные силы</span>
                <span className="game-combat-neutral-sub">TE · автобросок Combat</span>
              </button>

              <div className="game-combat-pick-row">
                {activePlayers
                  .filter((opp) => opp.id !== attacker.id)
                  .map((opp) => {
                    const faction = ALL_FACTIONS.find((f) => f.id === opp.factionId);
                    const isBlack = opp.color === '#000000'
                      || opp.color === '#090d16'
                      || opp.color === '#030712';
                    const accent = isBlack ? '#94a3b8' : opp.color || '#94a3b8';
                    return (
                      <button
                        key={opp.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => selectPlayer(opp.id)}
                        className="game-combat-pick-seat"
                        style={{ '--combat-seat-accent': accent }}
                      >
                        <span className="game-combat-pick-seat-icon">
                          <img src={faction?.iconUrl} alt="" />
                        </span>
                        <span className="game-combat-pick-seat-name">{opp.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="game-combat-fight">
              {isRetreatCheck ? (
                <div className="game-combat-retreat-check">
                  <p className="game-combat-result-line">
                    Ожидаем ответ от {retreatPlayer?.name || 'игрока'} —
                    удалось ли отступить?
                    <br />
                    <span className="opacity-70 text-sm font-normal">
                      (Вопрос видит только отступающий; хост может ответить за него)
                    </span>
                  </p>
                  <div className="game-combat-actions">
                    <button
                      type="button"
                      className="game-btn-primary"
                      disabled={readOnly}
                      onClick={() => onResolveRetreat?.(true)}
                    >
                      Да, отступил (проигрыш боя)
                    </button>
                    <button
                      type="button"
                      className="game-btn-danger"
                      disabled={readOnly}
                      onClick={() => onResolveRetreat?.(false)}
                    >
                      Нет, бой продолжается
                    </button>
                  </div>
                </div>
              ) : null}

              {!isRetreatCheck && (
              <>
              <div className="game-combat-round">
                <div className="game-combat-round-label">
                  Раунд боя
                  {isSetup ? ' • состав нейтралов' : ''}
                  {(isPvp || isNeutral) && phase === 'reveal' ? ' • подтверждение' : ''}
                  {(isPvp || isNeutral) && phase === 'input' ? ' • ввод попаданий' : ''}
                  {isNeutral && phase === 'rolling' ? ' • бросок нейтралов' : ''}
                  {(isPvp || isNeutral) && retreatPending ? ' • отступление' : ''}
                </div>
                <div className="game-combat-round-rule" aria-hidden="true">
                  <span />
                  <div className="game-combat-round-value">{roundNum}</div>
                  <span />
                </div>
              </div>

              <div className="game-combat-duel">
                <div className="game-combat-panel is-attacker">
                  <div className="game-combat-panel-role">
                    <i className="fa-solid fa-crosshairs" aria-hidden="true" />
                    Атакующий
                  </div>
                  <div className="game-combat-panel-who">
                    <img src={attackerFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                    <div className="game-combat-panel-name">{attacker.name}</div>
                  </div>
                  {!isSetup && (
                    <>
                      <div className="game-combat-hits">
                        <button
                          type="button"
                          disabled={
                            readOnly
                            || rolling
                            || (isPvp && phase !== 'input' && phase !== 'reveal')
                            || (isNeutral && (phase !== 'input' || attackerHitsLocked))
                          }
                          onClick={() => {
                            if (isPvp) bumpSyncedHits(combat.attackerId, -1);
                            else if (isNeutral) setDraftAttackerHits((n) => Math.max(0, n - 1));
                            else setCombatHits((h) => ({ ...h, attacker: Math.max(0, h.attacker - 1) }));
                          }}
                          className="game-combat-step"
                          aria-label="Меньше попаданий атакующего"
                        >
                          −
                        </button>
                        <div className="game-combat-hits-value is-attacker tabular-nums">
                          {(isPvp || isNeutral) && combat.hits?.[combat.attackerId] == null && !isNeutral
                            ? '—'
                            : attackerHits}
                        </div>
                        <button
                          type="button"
                          disabled={
                            readOnly
                            || rolling
                            || (isPvp && phase !== 'input' && phase !== 'reveal')
                            || (isNeutral && (phase !== 'input' || attackerHitsLocked))
                          }
                          onClick={() => {
                            if (isPvp) bumpSyncedHits(combat.attackerId, 1);
                            else if (isNeutral) setDraftAttackerHits((n) => n + 1);
                            else setCombatHits((h) => ({ ...h, attacker: h.attacker + 1 }));
                          }}
                          className="game-combat-step"
                          aria-label="Больше попаданий атакующего"
                        >
                          +
                        </button>
                      </div>
                      <div className="game-combat-hits-label">
                        {isPvp || isNeutral ? 'Попаданий' : 'Попаданий (вручную)'}
                      </div>
                      <div className="game-combat-total">
                        <span className="game-combat-total-label">Всего урона в бою:</span>
                        <span className="game-combat-total-num">{attackerTotal}</span>
                      </div>
                    </>
                  )}
                  {(isPvp || isNeutral) && phase === 'reveal' && (
                    <button
                      type="button"
                      disabled={readOnly || !!combat.assigned?.[combat.attackerId]}
                      className="game-combat-btn is-ghost text-xs mt-2"
                      onClick={() => onAssign?.(combat.attackerId)}
                    >
                      {combat.assigned?.[combat.attackerId]
                        ? 'Присвоено ✓'
                        : (isNeutral ? 'Присвоил (игрок)' : 'Присвоил (атака)')}
                    </button>
                  )}
                </div>

                <div className="game-combat-vs" aria-hidden="true">
                  <span />
                  <span className="game-combat-vs-swords">⚔</span>
                  <span />
                </div>

                <div className="game-combat-panel is-defender">
                  <div className="game-combat-panel-role">
                    <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                    Защищающийся
                  </div>
                  <div className="game-combat-panel-who">
                    {isNeutral ? (
                      <div className="game-combat-panel-ghost">
                        <i className="fa-solid fa-ghost" aria-hidden="true" />
                      </div>
                    ) : (
                      <img src={defenderFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                    )}
                    <div className="game-combat-panel-name">
                      {isNeutral ? 'Нейтральные силы' : opponent?.name}
                    </div>
                  </div>
                  {!isSetup && (
                    <>
                      <div className="game-combat-hits">
                        <button
                          type="button"
                          disabled={readOnly || rolling || isNeutral || (isPvp && phase !== 'input' && phase !== 'reveal')}
                          onClick={() => {
                            if (isPvp) bumpSyncedHits(combat.defenderId, -1);
                            else setCombatHits((h) => ({ ...h, defender: Math.max(0, h.defender - 1) }));
                          }}
                          className="game-combat-step"
                          aria-label="Меньше попаданий защищающегося"
                        >
                          −
                        </button>
                        <motion.div
                          key={rolling || phase === 'rolling' ? 'spin' : `hits-${defenderHits}`}
                          initial={rolling ? undefined : { scale: 1.25 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                          className="game-combat-hits-value is-defender tabular-nums"
                        >
                          {isPvp && combat.hits?.[combat.defenderId] == null
                            ? '—'
                            : isNeutral && (rolling || phase === 'rolling' || combat.hits?.[NEUTRAL_OPPONENT_ID] == null)
                              ? ((rolling || phase === 'rolling') ? '…' : '—')
                              : defenderHits}
                        </motion.div>
                        <button
                          type="button"
                          disabled={readOnly || rolling || isNeutral || (isPvp && phase !== 'input' && phase !== 'reveal')}
                          onClick={() => {
                            if (isPvp) bumpSyncedHits(combat.defenderId, 1);
                            else setCombatHits((h) => ({ ...h, defender: h.defender + 1 }));
                          }}
                          className="game-combat-step"
                          aria-label="Больше попаданий защищающегося"
                        >
                          +
                        </button>
                      </div>
                      <div className="game-combat-hits-label">
                        {isNeutral ? 'Автобросок нейтралов' : 'Попаданий'}
                      </div>
                      <div className="game-combat-total is-defender">
                        <span className="game-combat-total-label">Всего урона в бою:</span>
                        <span className="game-combat-total-num">{defenderTotal}</span>
                      </div>
                    </>
                  )}
                  {isPvp && phase === 'reveal' && (
                    <button
                      type="button"
                      disabled={readOnly || !!combat.assigned?.[combat.defenderId]}
                      className="game-combat-btn is-ghost text-xs mt-2"
                      onClick={() => onAssign?.(combat.defenderId)}
                    >
                      {combat.assigned?.[combat.defenderId] ? 'Присвоено ✓' : 'Присвоил (защита)'}
                    </button>
                  )}
                </div>
              </div>

              {isNeutral && (isSetup || phase === 'input' || phase === 'rolling' || phase === 'reveal') && (
                <div className="game-combat-neutral-kit">
                  <div className="game-combat-neutral-kit-head">
                    <div className="game-combat-neutral-kit-title">
                      <i className="fa-solid fa-dice" aria-hidden="true" />
                      {phase === 'reveal'
                        ? 'Присвоение попаданий · состав'
                        : 'Состав нейтралов · Combat'}
                    </div>
                    {isSetup ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!neutralDiceReady || readOnly) return;
                          onBeginNeutral?.(neutralCounts);
                        }}
                        disabled={!neutralDiceReady || readOnly}
                        className="game-combat-neutral-roll disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <i className="fa-solid fa-play" aria-hidden="true" />
                        {neutralDiceReady ? 'В бой' : 'Выберите юнитов'}
                      </button>
                    ) : phase === 'input' && !attackerHitsLocked ? (
                      <button
                        type="button"
                        onClick={submitNeutralHits}
                        disabled={!neutralDiceReady || readOnly || rolling}
                        className="game-combat-neutral-roll disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <i className={`fa-solid ${rolling ? 'fa-spinner fa-spin' : 'fa-dice'}`} aria-hidden="true" />
                        {rolling ? 'Бросок…' : 'Отправить + бросок'}
                      </button>
                    ) : phase === 'reveal' ? (
                      <button
                        type="button"
                        onClick={assignNeutralHits}
                        disabled={readOnly || rolling || !!combat.assigned?.[NEUTRAL_OPPONENT_ID]}
                        className="game-combat-neutral-roll disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                        {combat.assigned?.[NEUTRAL_OPPONENT_ID]
                          ? 'Нейтралы ✓'
                          : 'Присвоить нейтралам'}
                      </button>
                    ) : null}
                  </div>

                  <AnimatePresence mode="wait">
                    {rolling && (
                      <motion.div
                        key="rolling"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="game-combat-neutral-dice"
                      >
                        {spinFaces.map((face, idx) => (
                          <motion.div
                            key={`die-${idx}`}
                            animate={{
                              rotate: [0, -18, 22, -10, 0],
                              scale: [1, 1.12, 0.95, 1.08, 1],
                            }}
                            transition={{ duration: 0.35, repeat: Infinity, delay: idx * 0.04 }}
                            className="game-combat-neutral-die"
                          >
                            {face}
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className={`game-combat-neutral-grid ${rolling ? 'is-rolling' : ''}`}>
                    {NEUTRAL_UNITS.map((unit) => {
                      const count = neutralCounts[unit.id] || 0;
                      const atMax = unit.max != null && count >= unit.max;
                      const diceHint = unit.dice > 1 ? ` · ${unit.dice}d10` : '';
                      const icon = neutralUnitIconUrl(unit);
                      const countsLocked = !(isSetup || phase === 'input' || phase === 'reveal');
                      const steppersOff = rolling || readOnly || countsLocked
                        || (attackerHitsLocked && phase !== 'reveal');
                      return (
                        <div key={unit.id} className="game-combat-neutral-row">
                          {icon ? (
                            <img src={icon} alt="" className="game-combat-neutral-icon-img" />
                          ) : (
                            <span className="game-combat-neutral-icon-fallback" aria-hidden="true">
                              <i className="fa-solid fa-cube" />
                            </span>
                          )}
                          <div className="game-combat-neutral-meta min-w-0">
                            <div className="game-combat-neutral-name truncate">{unit.name}</div>
                            <div className="game-combat-neutral-stat">
                              Combat {unit.combat}{diceHint}
                              {unit.max === 1 ? ' · макс. 1' : ''}
                              {phase === 'reveal' ? ' · потери' : ''}
                            </div>
                          </div>
                          <div className="game-combat-neutral-stepper">
                            <button
                              type="button"
                              onClick={() => bumpNeutral(unit.id, -1)}
                              disabled={count <= 0 || steppersOff}
                              className="game-combat-neutral-btn"
                              aria-label={`Убрать ${unit.name}`}
                            >
                              −
                            </button>
                            <div className="game-combat-neutral-count tabular-nums">{count}</div>
                            <button
                              type="button"
                              onClick={() => bumpNeutral(unit.id, 1)}
                              disabled={atMax || steppersOff}
                              className="game-combat-neutral-btn"
                              aria-label={`Добавить ${unit.name}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <AnimatePresence>
                    {displayRoll && !rolling && (
                      <motion.p
                        key="result"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="game-combat-neutral-result"
                      >
                        {summarizeNeutralRoll(displayRoll)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {(isPvp || isNeutral) && retreatPending && (
                <p className="game-combat-retreat-note">
                  Отступление: {retreatPlayer?.name || '—'} — после присвоения попаданий спросим результат
                </p>
              )}

              <div className="game-combat-actions">
                {isNeutral && isSetup && (
                  <button
                    type="button"
                    disabled={rolling || readOnly}
                    onClick={() => {
                      onSetOpponent?.({ clear: true });
                      setLastNeutralRoll(null);
                      setRolling(false);
                    }}
                    className="game-combat-btn is-ghost disabled:opacity-40"
                  >
                    <i className="fa-solid fa-users" aria-hidden="true" /> Сменить оппонента
                  </button>
                )}
                {(isPvp || isNeutral) && !retreatPending && (phase === 'input' || phase === 'reveal') && (
                  <>
                    <button
                      type="button"
                      disabled={rolling || readOnly}
                      onClick={() => onDeclareRetreat?.(combat.attackerId)}
                      className="game-combat-btn is-retreat is-attacker disabled:opacity-40"
                    >
                      <i className="fa-solid fa-person-walking-arrow-right" aria-hidden="true" />
                      Отступление: {attacker?.name || 'атака'}
                    </button>
                    {isPvp && (
                      <button
                        type="button"
                        disabled={rolling || readOnly}
                        onClick={() => onDeclareRetreat?.(combat.defenderId)}
                        className="game-combat-btn is-retreat is-defender disabled:opacity-40"
                      >
                        <i className="fa-solid fa-person-walking-arrow-right" aria-hidden="true" />
                        Отступление: {opponent?.name || 'защита'}
                      </button>
                    )}
                  </>
                )}
                {!isSetup && (
                  <button
                    type="button"
                    disabled={
                      rolling
                      || readOnly
                      || (isPvp && !(phase === 'reveal' || (phase === 'input' && bothPvpHitsEntered)))
                      || (isNeutral && phase !== 'reveal')
                    }
                    onClick={handleNextCombatRound}
                    className="game-combat-btn is-assign disabled:opacity-40"
                  >
                    <i className="fa-solid fa-dice" aria-hidden="true" />
                    {isPvp || isNeutral
                      ? 'Присвоить оба → раунд →'
                      : 'Следующий раунд'}
                  </button>
                )}
                {isNeutral && !isSetup && !isResult && !isRetreatCheck && (
                  <button
                    type="button"
                    disabled={rolling || readOnly}
                    onClick={() => onDefeat?.(NEUTRAL_OPPONENT_ID)}
                    className="game-combat-btn is-abort disabled:opacity-40"
                  >
                    <i className="fa-solid fa-ghost" aria-hidden="true" />
                    Поражение нейтралов
                  </button>
                )}
              </div>
              </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CombatModal;
