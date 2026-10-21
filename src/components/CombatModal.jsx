import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_FACTIONS } from '../data/gameData';
import brandMark from '../assets/brand-mark.png';
import {
  NEUTRAL_UNITS,
  emptyNeutralCounts,
  neutralUnitIconUrl,
  rollNeutralCombat,
  summarizeNeutralRoll,
} from '../data/neutralUnits';
import { playDiceRevealSound, playDiceRollSound, vibrateDice } from '../utils/diceSound';
import { formatTime } from '../utils/game';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const ROLL_MS = 900;
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
  onSetHits,
  onAssign,
  onDeclareRetreat,
  onResolveRetreat,
  onDefeat,
  /** Local neutral / legacy scratch (host-only dice path). */
  combatHits,
  setCombatHits,
  combatRound,
  setCombatRound,
  totalCombatDamage,
  setTotalCombatDamage,
  readOnly = false,
}) {
  const [neutralCounts, setNeutralCounts] = useState(emptyNeutralCounts);
  const [lastNeutralRoll, setLastNeutralRoll] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [spinFaces, setSpinFaces] = useState(() => randomFaces(ROLL_DIE_COUNT));
  const audioRef = useRef(null);
  const rollTimerRef = useRef(null);
  const spinTimerRef = useRef(null);

  const attacker = activePlayer || activePlayers?.[0] || null;
  const synced = !!combat?.active;
  const isPvp = synced && combat.mode === 'pvp';
  const isNeutral = synced && combat.mode === 'neutral';
  const picking = synced && (!combat.mode || combat.phase === 'pick') && !isPvp && !isNeutral;

  const opponent = isPvp
    ? activePlayers.find((p) => String(p.id) === String(combat.defenderId))
    : null;
  const hasOpponent = isPvp ? !!opponent : isNeutral;

  const attackerHits = isPvp
    ? (combat.hits?.[combat.attackerId] ?? 0)
    : (combatHits?.attacker ?? 0);
  const defenderHits = isPvp
    ? (combat.hits?.[combat.defenderId] ?? 0)
    : (combatHits?.defender ?? 0);
  const attackerTotal = isPvp
    ? (Number(combat.totals?.[combat.attackerId]) || 0) + (Number(combat.hits?.[combat.attackerId]) || 0)
    : (totalCombatDamage?.attacker || 0) + (combatHits?.attacker || 0);
  const defenderTotal = isPvp
    ? (Number(combat.totals?.[combat.defenderId]) || 0) + (Number(combat.hits?.[combat.defenderId]) || 0)
    : (totalCombatDamage?.defender || 0) + (combatHits?.defender || 0);
  const roundNum = isPvp ? (combat.round || 1) : combatRound;
  const phase = isPvp ? combat.phase : 'input';

  useEscapeKey(onClose, show && !minimized && !!attacker && !rolling);
  useBodyScrollLock(show && !minimized && !!attacker);

  useEffect(() => () => {
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
  }, []);

  const neutralDiceReady = useMemo(
    () => NEUTRAL_UNITS.some((u) => (neutralCounts[u.id] || 0) > 0),
    [neutralCounts],
  );

  if (!show || !attacker) return null;

  const attackerFaction = ALL_FACTIONS.find((f) => f.id === attacker.factionId);
  const defenderFaction = opponent
    ? ALL_FACTIONS.find((f) => f.id === opponent.factionId)
    : null;

  const bumpSyncedHits = (playerId, delta) => {
    if (readOnly || !isPvp || phase !== 'input') return;
    const cur = Number(combat.hits?.[playerId]);
    const base = Number.isFinite(cur) ? cur : 0;
    onSetHits?.(playerId, Math.max(0, base + delta));
  };

  const isResult = isPvp && phase === 'result';
  const isRetreatCheck = isPvp && phase === 'retreat_check';
  const retreatPlayerId = isPvp ? combat.retreatPlayerId : null;
  const retreatPending = retreatPlayerId != null;
  const retreatPlayer = retreatPending
    ? activePlayers.find((p) => String(p.id) === String(retreatPlayerId))
    : null;
  const isRetreatResult = isResult && combat?.resultKind === 'retreat';
  const resultWinner = isResult
    ? activePlayers.find((p) => String(p.id) === String(combat.winnerId))
    : null;
  const resultLoser = isResult
    ? activePlayers.find((p) => String(p.id) === String(combat.loserId))
    : null;
  const resultWinnerFaction = resultWinner
    ? ALL_FACTIONS.find((f) => f.id === resultWinner.factionId)
    : null;
  const resultLoserFaction = resultLoser
    ? ALL_FACTIONS.find((f) => f.id === resultLoser.factionId)
    : null;

  const handleEndCombat = () => {
    if (rolling) return;
    if (isPvp) {
      if (isResult) {
        onClose();
        return;
      }
      onDefeat?.();
      return;
    }
    if (!hasOpponent) return;
    if (isNeutral) {
      onRecordDamage?.({
        [attacker.id]: (totalCombatDamage?.defender || 0) + (combatHits?.defender || 0),
      });
    }
    onClose();
  };

  const handleNextCombatRound = () => {
    if (rolling || readOnly) return;
    if (isPvp) {
      // Host can assign for both seats to advance the round.
      if (phase === 'reveal') {
        if (!combat.assigned?.[combat.attackerId]) onAssign?.(combat.attackerId);
        if (!combat.assigned?.[combat.defenderId]) onAssign?.(combat.defenderId);
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
    const unit = NEUTRAL_UNITS.find((u) => u.id === id);
    const max = unit?.max ?? Infinity;
    setNeutralCounts((prev) => ({
      ...prev,
      [id]: Math.min(max, Math.max(0, (prev[id] || 0) + delta)),
    }));
  };

  const rollForNeutrals = () => {
    if (!neutralDiceReady || readOnly || rolling) return;

    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);

    setRolling(true);
    setLastNeutralRoll(null);
    playDiceRollSound(audioRef);
    vibrateDice('roll');
    spinTimerRef.current = window.setInterval(() => {
      setSpinFaces(randomFaces(ROLL_DIE_COUNT));
    }, 70);

    rollTimerRef.current = window.setTimeout(() => {
      if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
      const result = rollNeutralCombat(neutralCounts);
      setLastNeutralRoll(result);
      setCombatHits((h) => ({ ...h, defender: result.hits }));
      setRolling(false);
      playDiceRevealSound(audioRef);
      vibrateDice('reveal');
    }, ROLL_MS);
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
    setLastNeutralRoll(null);
  };

  const showPick = !isResult && (picking || (!hasOpponent && !isPvp));

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
        className={`game-hud-chassis combat-pick-shell game-combat-pick w-full max-md:overflow-y-auto modal-scroll ${
          isResult || !showPick
            ? `is-combat-fight ${isNeutral ? 'is-neutral-fight' : ''} max-md:max-h-[min(92vh,100dvh)]`
            : 'max-md:max-h-[min(88vh,100dvh)]'
        } relative z-[1] md:max-w-3xl`}
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
                <button type="button" onClick={onMinimize} className="game-btn-ghost text-xs px-2 py-1">
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
                    <strong>{resultLoser?.name || '—'}</strong>
                    {' отступил от '}
                    <strong>{resultWinner?.name || '—'}</strong>
                  </>
                ) : (
                  <>
                    <strong>{resultWinner?.name || '—'}</strong>
                    {' победил '}
                    <strong>{resultLoser?.name || '—'}</strong>
                  </>
                )}
              </p>
              <div className="game-combat-duel">
                <div className="game-combat-panel is-attacker">
                  <div className="game-combat-panel-role">Победитель</div>
                  <img src={resultWinnerFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                  <div className="game-combat-panel-name">{resultWinner?.name || '—'}</div>
                  <div className="game-combat-total">
                    Урон <span>{Number(combat.totals?.[combat.winnerId]) || 0}</span>
                  </div>
                </div>
                <div className="game-combat-panel is-defender">
                  <div className="game-combat-panel-role">{isRetreatResult ? 'Отступление' : 'Поражение'}</div>
                  <img src={resultLoserFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                  <div className="game-combat-panel-name">{resultLoser?.name || '—'}</div>
                  <div className="game-combat-total">
                    Урон <span>{Number(combat.totals?.[combat.loserId]) || 0}</span>
                  </div>
                </div>
              </div>
              <div className="game-combat-actions">
                <button
                  type="button"
                  onClick={handleEndCombat}
                  className="game-btn-primary"
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
                    {retreatPlayer?.name || 'Игрок'} объявил отступление.
                    <br />
                    Раунд сыгран — удалось ли отступить?
                  </p>
                  <div className="game-combat-actions">
                    <button
                      type="button"
                      className="game-btn-primary"
                      disabled={readOnly}
                      onClick={() => onResolveRetreat?.(true)}
                    >
                      Да, отступил
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
                  {isPvp && phase === 'reveal' ? ' · подтверждение' : ''}
                  {isPvp && phase === 'input' ? ' · ввод попаданий' : ''}
                  {isPvp && retreatPending ? ' · отступление' : ''}
                </div>
                <div className="game-combat-round-rule" aria-hidden="true">
                  <span />
                  <div className="game-combat-round-value">{roundNum}</div>
                  <span />
                </div>
              </div>

              <div className="game-combat-duel">
                <div className="game-combat-panel is-attacker">
                  <div className="game-combat-panel-role">Атакующий</div>
                  <img src={attackerFaction?.iconUrl} alt="" className="game-combat-panel-icon" />
                  <div className="game-combat-panel-name">{attacker.name}</div>
                  <div className="game-combat-hits">
                    <button
                      type="button"
                      disabled={readOnly || rolling || (isPvp && phase !== 'input')}
                      onClick={() => {
                        if (isPvp) bumpSyncedHits(combat.attackerId, -1);
                        else setCombatHits((h) => ({ ...h, attacker: Math.max(0, h.attacker - 1) }));
                      }}
                      className="game-combat-step"
                      aria-label="Меньше попаданий атакующего"
                    >
                      −
                    </button>
                    <div className="game-combat-hits-value is-attacker tabular-nums">
                      {isPvp && combat.hits?.[combat.attackerId] == null ? '—' : attackerHits}
                    </div>
                    <button
                      type="button"
                      disabled={readOnly || rolling || (isPvp && phase !== 'input')}
                      onClick={() => {
                        if (isPvp) bumpSyncedHits(combat.attackerId, 1);
                        else setCombatHits((h) => ({ ...h, attacker: h.attacker + 1 }));
                      }}
                      className="game-combat-step"
                      aria-label="Больше попаданий атакующего"
                    >
                      +
                    </button>
                  </div>
                  <div className="game-combat-hits-label">
                    {isPvp ? 'Попаданий (синк)' : 'Попаданий (вручную)'}
                  </div>
                  <div className="game-combat-total">
                    Всего урона в бою:
                    <span>{attackerTotal}</span>
                  </div>
                  {isPvp && phase === 'reveal' && (
                    <button
                      type="button"
                      disabled={readOnly || !!combat.assigned?.[combat.attackerId]}
                      className="game-btn-ghost text-xs mt-2"
                      onClick={() => onAssign?.(combat.attackerId)}
                    >
                      {combat.assigned?.[combat.attackerId] ? 'Присвоено ✓' : 'Присвоил (атака)'}
                    </button>
                  )}
                </div>

                <div className="game-combat-panel is-defender">
                  <div className="game-combat-panel-role">Защищающийся</div>
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
                  <div className="game-combat-hits">
                    <button
                      type="button"
                      disabled={readOnly || rolling || (isPvp && phase !== 'input')}
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
                      key={rolling ? 'spin' : `hits-${defenderHits}`}
                      initial={rolling ? undefined : { scale: 1.25 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      className="game-combat-hits-value is-defender tabular-nums"
                    >
                      {isPvp && combat.hits?.[combat.defenderId] == null ? '—' : defenderHits}
                    </motion.div>
                    <button
                      type="button"
                      disabled={readOnly || rolling || (isPvp && phase !== 'input')}
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
                    {isNeutral ? 'Попаданий нейтралов' : 'Попаданий'}
                  </div>
                  <div className="game-combat-total is-defender">
                    Всего урона в бою:
                    <span>{defenderTotal}</span>
                  </div>
                  {isPvp && phase === 'reveal' && (
                    <button
                      type="button"
                      disabled={readOnly || !!combat.assigned?.[combat.defenderId]}
                      className="game-btn-ghost text-xs mt-2"
                      onClick={() => onAssign?.(combat.defenderId)}
                    >
                      {combat.assigned?.[combat.defenderId] ? 'Присвоено ✓' : 'Присвоил (защита)'}
                    </button>
                  )}
                </div>
              </div>

              {isNeutral && (
                <div className="game-combat-neutral-kit">
                  <div className="game-combat-neutral-kit-head">
                    <div className="game-combat-neutral-kit-title">
                      <i className="fa-solid fa-dice" aria-hidden="true" />
                      Состав нейтралов · Combat
                    </div>
                    <button
                      type="button"
                      onClick={rollForNeutrals}
                      disabled={!neutralDiceReady || readOnly || rolling}
                      className="game-combat-neutral-roll disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <i className={`fa-solid ${rolling ? 'fa-spinner fa-spin' : 'fa-dice'}`} aria-hidden="true" />
                      {rolling ? 'Бросок…' : 'Бросить за нейтралов'}
                    </button>
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
                            </div>
                          </div>
                          <div className="game-combat-neutral-stepper">
                            <button
                              type="button"
                              onClick={() => bumpNeutral(unit.id, -1)}
                              disabled={count <= 0 || rolling || readOnly}
                              className="game-combat-neutral-btn"
                              aria-label={`Убрать ${unit.name}`}
                            >
                              −
                            </button>
                            <div className="game-combat-neutral-count tabular-nums">{count}</div>
                            <button
                              type="button"
                              onClick={() => bumpNeutral(unit.id, 1)}
                              disabled={rolling || atMax || readOnly}
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
                    {lastNeutralRoll && !rolling && (
                      <motion.p
                        key="result"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="game-combat-neutral-result"
                      >
                        {summarizeNeutralRoll(lastNeutralRoll)}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {isPvp && retreatPending && (
                <p className="game-combat-retreat-note">
                  Отступление: {retreatPlayer?.name || '—'} — после присвоения попаданий спросим результат
                </p>
              )}

              <div className="game-combat-actions">
                {!isPvp && (
                  <button
                    type="button"
                    disabled={rolling || readOnly}
                    onClick={() => {
                      onSetOpponent?.({ clear: true });
                      setLastNeutralRoll(null);
                      setRolling(false);
                    }}
                    className="game-btn-ghost disabled:opacity-40"
                  >
                    <i className="fa-solid fa-users" aria-hidden="true" /> Сменить оппонента
                  </button>
                )}
                {isPvp && !retreatPending && (phase === 'input' || phase === 'reveal') && (
                  <>
                    <button
                      type="button"
                      disabled={rolling || readOnly}
                      onClick={() => onDeclareRetreat?.(combat.attackerId)}
                      className="game-btn-ghost disabled:opacity-40"
                    >
                      Отступление: {attacker?.name || 'атака'}
                    </button>
                    <button
                      type="button"
                      disabled={rolling || readOnly}
                      onClick={() => onDeclareRetreat?.(combat.defenderId)}
                      className="game-btn-ghost disabled:opacity-40"
                    >
                      Отступление: {opponent?.name || 'защита'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={rolling || readOnly || (isPvp && phase !== 'reveal')}
                  onClick={handleNextCombatRound}
                  className="game-btn-primary disabled:opacity-40"
                >
                  {isPvp ? 'Присвоить оба → раунд' : 'Следующий раунд'}{' '}
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={rolling || readOnly}
                  onClick={handleEndCombat}
                  className="game-btn-danger disabled:opacity-40"
                >
                  <i className="fa-solid fa-flag-checkered" aria-hidden="true" />{' '}
                  {isPvp ? 'Завершить без победителя' : 'Завершить бой'}
                </button>
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
