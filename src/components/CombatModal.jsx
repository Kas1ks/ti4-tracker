import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ALL_FACTIONS } from '../data/gameData';
import {
  NEUTRAL_OPPONENT_ID,
  NEUTRAL_UNITS,
  emptyNeutralCounts,
  rollNeutralCombat,
  summarizeNeutralRoll,
} from '../data/neutralUnits';
import { playDiceRevealSound, playDiceRollSound, vibrateDice } from '../utils/diceSound';
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
  onRecordDamage,
  combatOpponentId,
  setCombatOpponentId,
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

  useEscapeKey(onClose, show && !minimized && !!attacker && !rolling);
  useBodyScrollLock(show && !minimized && !!attacker);

  useEffect(() => () => {
    if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    if (spinTimerRef.current) window.clearInterval(spinTimerRef.current);
  }, []);

  const isNeutral = combatOpponentId === NEUTRAL_OPPONENT_ID;
  const opponent = isNeutral
    ? null
    : activePlayers.find(p => p.id === combatOpponentId);
  const hasOpponent = isNeutral || !!opponent;

  const neutralDiceReady = useMemo(
    () => NEUTRAL_UNITS.some(u => (neutralCounts[u.id] || 0) > 0),
    [neutralCounts],
  );

  if (!show || !attacker) return null;

  const handleEndCombat = () => {
    if (!hasOpponent || rolling) return;

    if (isNeutral) {
      onRecordDamage({
        [attacker.id]: totalCombatDamage.defender + combatHits.defender,
      });
    } else {
      onRecordDamage({
        [attacker.id]: totalCombatDamage.attacker + combatHits.attacker,
        [opponent.id]: totalCombatDamage.defender + combatHits.defender,
      });
    }

    onClose();
  };

  const handleNextCombatRound = () => {
    if (rolling) return;
    setTotalCombatDamage(prev => ({
      attacker: prev.attacker + combatHits.attacker,
      defender: prev.defender + combatHits.defender,
    }));
    setCombatHits({ attacker: 0, defender: 0 });
    setLastNeutralRoll(null);
    setCombatRound(prev => prev + 1);
  };

  const bumpNeutral = (id, delta) => {
    if (rolling) return;
    const unit = NEUTRAL_UNITS.find(u => u.id === id);
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
    setSpinFaces(randomFaces(ROLL_DIE_COUNT));
    playDiceRollSound(audioRef);
    vibrateDice();

    spinTimerRef.current = window.setInterval(() => {
      setSpinFaces(randomFaces(ROLL_DIE_COUNT));
    }, 70);

    rollTimerRef.current = window.setTimeout(() => {
      if (spinTimerRef.current) {
        window.clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
      }
      const result = rollNeutralCombat(neutralCounts);
      setLastNeutralRoll(result);
      setCombatHits(h => ({ ...h, defender: result.hits }));
      setRolling(false);
      playDiceRevealSound(audioRef, result.hits);
    }, ROLL_MS);
  };

  const selectNeutral = () => {
    setCombatOpponentId(NEUTRAL_OPPONENT_ID);
    setNeutralCounts(emptyNeutralCounts());
    setLastNeutralRoll(null);
    setRolling(false);
    setCombatHits({ attacker: 0, defender: 0 });
  };

  const attackerFaction = ALL_FACTIONS.find(f => f.id === attacker.factionId);
  const defenderFaction = opponent ? ALL_FACTIONS.find(f => f.id === opponent.factionId) : null;

  return (
    <div className={`fixed inset-0 game-modal-overlay z-[62] flex items-center justify-center p-4 max-md:items-end max-md:p-2 modal-overlay ${minimized ? 'hidden' : ''}`} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-modal-title"
        className={`game-modal-panel max-w-4xl w-full p-6 max-md:p-4 max-md:max-h-[min(92vh,100dvh)] max-md:overflow-y-auto modal-scroll ${readOnly ? '[&_button:not([aria-label])]:pointer-events-none [&_button:not([aria-label])]:opacity-60' : ''}`}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--game-line-gold)]">
          <h2 id="combat-modal-title" className="game-modal-title text-lg uppercase flex items-center gap-2">
            <i className="fa-solid fa-crosshairs" aria-hidden="true" /> Окно сражения
          </h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onMinimize} aria-label="Свернуть" className="text-[var(--game-muted)] hover:text-[var(--game-gold-bright)] transition">
              <i className="fa-solid fa-window-minimize text-base" />
            </button>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="text-[var(--game-muted)] hover:text-[var(--game-text)] transition">
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        </div>

        {!hasOpponent ? (
          <div className="space-y-3">
            <h3 className="text-center font-bold text-[var(--game-muted)]">Выберите защищающегося:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={selectNeutral}
                className="p-4 bg-black/35 hover:bg-[rgba(201,162,39,0.1)] border border-[var(--game-line)] hover:border-[var(--game-line-gold)] rounded-xl text-center space-y-2 transition col-span-2 md:col-span-4"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-black/50 border border-[var(--game-line-gold)] flex items-center justify-center text-[var(--game-gold-bright)] text-2xl">
                  <i className="fa-solid fa-ghost" aria-hidden="true" />
                </div>
                <div className="font-bold text-[var(--game-gold-bright)]">Нейтральные силы</div>
                <div className="text-[11px] text-[var(--game-muted)]">TE · автобросок Combat</div>
              </button>
              {activePlayers.filter(p => p.id !== attacker.id).map(opp => {
                const faction = ALL_FACTIONS.find(f => f.id === opp.factionId);
                const accent = opp.color || '#94a3b8';
                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => setCombatOpponentId(opp.id)}
                    className="p-4 bg-black/35 hover:bg-black/50 border border-[var(--game-line)] rounded-xl text-center space-y-2 transition"
                    style={{ borderColor: `${accent}66` }}
                  >
                    <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                    <div className="font-bold text-[var(--game-text)]">{opp.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div className="col-span-2 max-md:col-span-1 text-center">
                <div className="text-sm text-[var(--game-muted)] uppercase tracking-wider font-bold">Раунд боя</div>
                <div className="font-orbitron font-black text-3xl text-[var(--game-gold-bright)]">{combatRound}</div>
              </div>

              <div className="game-combat-side is-attacker p-4 rounded-xl text-center space-y-3">
                <div className="text-xs font-bold text-[var(--game-gold-bright)] uppercase tracking-wide">Атакующий</div>
                <img src={attackerFaction?.iconUrl} alt={attackerFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                <div className="font-bold text-lg text-[var(--game-text)]">{attacker.name}</div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: Math.max(0, h.attacker - 1) }))} className="game-combat-step">-</button>
                  <div className="font-orbitron font-black text-5xl text-[var(--game-gold-bright)] w-24 tabular-nums">{combatHits.attacker}</div>
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: h.attacker + 1 }))} className="game-combat-step">+</button>
                </div>
                <div className="text-xs font-bold text-[var(--game-muted)] uppercase">Попаданий (вручную)</div>
                <div className="text-xs text-[var(--game-muted)] pt-2 border-t border-[var(--game-line)]">
                  Всего урона в бою:
                  <span className="font-bold text-base text-[var(--game-gold-bright)] ml-1">{totalCombatDamage.attacker + combatHits.attacker}</span>
                </div>
              </div>

              <div className="game-combat-side is-defender p-4 rounded-xl text-center space-y-3">
                <div className="text-xs font-bold text-red-300/90 uppercase tracking-wide">Защищающийся</div>
                {isNeutral ? (
                  <div className="w-20 h-20 mx-auto rounded-full bg-black/50 border border-[var(--game-line-gold)] flex items-center justify-center text-[var(--game-gold-bright)] text-3xl">
                    <i className="fa-solid fa-ghost" aria-hidden="true" />
                  </div>
                ) : (
                  <img src={defenderFaction?.iconUrl} alt={defenderFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                )}
                <div className="font-bold text-lg text-[var(--game-text)]">
                  {isNeutral ? 'Нейтральные силы' : opponent.name}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" disabled={rolling} onClick={() => setCombatHits(h => ({ ...h, defender: Math.max(0, h.defender - 1) }))} className="game-combat-step">-</button>
                  <motion.div
                    key={rolling ? 'spin' : `hits-${combatHits.defender}`}
                    initial={rolling ? undefined : { scale: 1.25 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                    className="font-orbitron font-black text-5xl text-red-300 w-24 tabular-nums"
                  >
                    {combatHits.defender}
                  </motion.div>
                  <button type="button" disabled={rolling} onClick={() => setCombatHits(h => ({ ...h, defender: h.defender + 1 }))} className="game-combat-step">+</button>
                </div>
                <div className="text-xs font-bold text-[var(--game-muted)] uppercase">
                  {isNeutral ? 'Попаданий нейтралов' : 'Попаданий'}
                </div>
                <div className="text-xs text-[var(--game-muted)] pt-2 border-t border-[var(--game-line)]">
                  Всего урона в бою:
                  <span className="font-bold text-base text-red-300 ml-1">{totalCombatDamage.defender + combatHits.defender}</span>
                </div>
              </div>
            </div>

            {isNeutral && (
              <div className="rounded-xl border border-[var(--game-line-gold)] bg-black/30 p-3 md:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--game-gold-bright)]">
                    Состав нейтралов · Combat
                  </div>
                  <button
                    type="button"
                    onClick={rollForNeutrals}
                    disabled={!neutralDiceReady || readOnly || rolling}
                    className="game-btn-primary !py-2 !px-4 !text-xs disabled:opacity-40 disabled:pointer-events-none"
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
                      className="flex items-center justify-center gap-2 py-3"
                    >
                      {spinFaces.map((face, idx) => (
                        <motion.div
                          key={`die-${idx}`}
                          animate={{
                            rotate: [0, -18, 22, -10, 0],
                            scale: [1, 1.12, 0.95, 1.08, 1],
                          }}
                          transition={{ duration: 0.35, repeat: Infinity, delay: idx * 0.04 }}
                          className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[var(--game-gold-bright)] to-[var(--game-gold)] border border-[rgba(255,255,255,0.35)] shadow-[0_0_16px_rgba(201,162,39,0.35)] flex items-center justify-center font-orbitron font-black text-xl text-[#1a1408] tabular-nums"
                        >
                          {face}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${rolling ? 'opacity-50 pointer-events-none' : ''}`}>
                  {NEUTRAL_UNITS.map((unit) => {
                    const count = neutralCounts[unit.id] || 0;
                    const atMax = unit.max != null && count >= unit.max;
                    const diceHint = unit.dice > 1 ? ` · ${unit.dice}d10` : '';
                    return (
                      <div
                        key={unit.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--game-line)] bg-black/35 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[var(--game-text)] truncate">{unit.name}</div>
                          <div className="text-[10px] text-[var(--game-muted)]">
                            Combat {unit.combat}{diceHint}
                            {unit.max === 1 ? ' · макс. 1' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => bumpNeutral(unit.id, -1)}
                          disabled={count <= 0 || rolling}
                          className="game-combat-step !w-8 !h-8 !text-base"
                          aria-label={`Убрать ${unit.name}`}
                        >
                          −
                        </button>
                        <div className="w-7 text-center font-orbitron font-black text-[var(--game-gold-bright)] tabular-nums">{count}</div>
                        <button
                          type="button"
                          onClick={() => bumpNeutral(unit.id, 1)}
                          disabled={rolling || atMax}
                          className="game-btn-primary !w-8 !h-8 !p-0 !text-base"
                          aria-label={`Добавить ${unit.name}`}
                        >
                          +
                        </button>
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
                      className="text-[11px] text-[var(--game-muted)] leading-snug break-words"
                    >
                      {summarizeNeutralRoll(lastNeutralRoll)}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-[var(--game-line-gold)] max-md:flex-col max-md:items-stretch">
              <button
                type="button"
                disabled={rolling}
                onClick={() => {
                  setCombatOpponentId(null);
                  setLastNeutralRoll(null);
                  setRolling(false);
                }}
                className="game-btn-ghost disabled:opacity-40"
              >
                <i className="fa-solid fa-users" aria-hidden="true" /> Сменить оппонента
              </button>
              <button
                type="button"
                disabled={rolling}
                onClick={handleNextCombatRound}
                className="game-btn-primary disabled:opacity-40"
              >
                Следующий раунд <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={rolling}
                onClick={handleEndCombat}
                className="game-btn-danger disabled:opacity-40"
              >
                <i className="fa-solid fa-flag-checkered" aria-hidden="true" /> Завершить бой
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
