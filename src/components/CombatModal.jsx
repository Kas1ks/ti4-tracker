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

  useEscapeKey(onClose, show && !minimized && !!activePlayer && !rolling);
  useBodyScrollLock(show && !minimized && !!activePlayer);

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

  if (!show || !activePlayer) return null;

  const handleEndCombat = () => {
    if (!hasOpponent || rolling) return;

    if (isNeutral) {
      onRecordDamage({
        [activePlayer.id]: totalCombatDamage.defender + combatHits.defender,
      });
    } else {
      onRecordDamage({
        [activePlayer.id]: totalCombatDamage.attacker + combatHits.attacker,
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

  const attackerFaction = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);
  const defenderFaction = opponent ? ALL_FACTIONS.find(f => f.id === opponent.factionId) : null;

  return (
    <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 max-md:items-end max-md:p-2 modal-overlay ${minimized ? 'hidden' : ''}`} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="combat-modal-title"
        className={`bg-slate-900 border border-red-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-red-500/10 max-md:p-4 max-md:max-h-[min(92vh,100dvh)] max-md:overflow-y-auto modal-scroll ${readOnly ? '[&_button:not([aria-label])]:pointer-events-none [&_button:not([aria-label])]:opacity-60' : ''}`}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <h2 id="combat-modal-title" className="font-orbitron text-lg font-bold text-red-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-crosshairs" /> Окно Сражения
          </h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={onMinimize} aria-label="Свернуть" className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-window-minimize text-base" />
            </button>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="text-slate-500 hover:text-white transition">
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          </div>
        </div>

        {!hasOpponent ? (
          <div className="space-y-3">
            <h3 className="text-center font-bold text-slate-300">Выберите защищающегося:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={selectNeutral}
                className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-amber-500 col-span-2 md:col-span-4"
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-amber-300 text-2xl">
                  <i className="fa-solid fa-ghost" aria-hidden="true" />
                </div>
                <div className="font-bold text-amber-300">Нейтральные силы</div>
                <div className="text-[11px] text-slate-500">TE · автобросок Combat</div>
              </button>
              {activePlayers.filter(p => p.id !== activePlayer.id).map(opp => {
                const faction = ALL_FACTIONS.find(f => f.id === opp.factionId);
                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => setCombatOpponentId(opp.id)}
                    className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-red-500"
                  >
                    <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                    <div className="font-bold text-red-400">{opp.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <div className="col-span-2 max-md:col-span-1 text-center">
                <div className="text-sm text-slate-400">Раунд боя</div>
                <div className="font-orbitron font-black text-3xl text-amber-400">{combatRound}</div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-700 text-center space-y-3">
                <div className="text-xs font-bold text-cyan-400 uppercase">АТАКУЮЩИЙ</div>
                <img src={attackerFaction?.iconUrl} alt={attackerFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                <div className="font-bold text-lg text-white">{activePlayer.name}</div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: Math.max(0, h.attacker - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">-</button>
                  <div className="font-orbitron font-black text-5xl text-cyan-400 w-24">{combatHits.attacker}</div>
                  <button type="button" onClick={() => setCombatHits(h => ({ ...h, attacker: h.attacker + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">+</button>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">Попаданий (вручную)</div>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  Всего урона в бою:
                  <span className="font-bold text-base text-cyan-300 ml-1">{totalCombatDamage.attacker + combatHits.attacker}</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-red-700 text-center space-y-3">
                <div className="text-xs font-bold text-red-400 uppercase">ЗАЩИЩАЮЩИЙСЯ</div>
                {isNeutral ? (
                  <div className="w-20 h-20 mx-auto rounded-full bg-slate-800 border border-amber-700/50 flex items-center justify-center text-amber-300 text-3xl">
                    <i className="fa-solid fa-ghost" aria-hidden="true" />
                  </div>
                ) : (
                  <img src={defenderFaction?.iconUrl} alt={defenderFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                )}
                <div className="font-bold text-lg text-white">
                  {isNeutral ? 'Нейтральные силы' : opponent.name}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" disabled={rolling} onClick={() => setCombatHits(h => ({ ...h, defender: Math.max(0, h.defender - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition disabled:opacity-40">-</button>
                  <motion.div
                    key={rolling ? 'spin' : `hits-${combatHits.defender}`}
                    initial={rolling ? undefined : { scale: 1.25 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                    className="font-orbitron font-black text-5xl text-red-400 w-24"
                  >
                    {combatHits.defender}
                  </motion.div>
                  <button type="button" disabled={rolling} onClick={() => setCombatHits(h => ({ ...h, defender: h.defender + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition disabled:opacity-40">+</button>
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase">
                  {isNeutral ? 'Попаданий нейтралов' : 'Попаданий'}
                </div>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                  Всего урона в бою:
                  <span className="font-bold text-base text-red-300 ml-1">{totalCombatDamage.defender + combatHits.defender}</span>
                </div>
              </div>
            </div>

            {isNeutral && (
              <div className="rounded-xl border border-amber-800/50 bg-slate-950/80 p-3 md:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Состав нейтралов · Combat
                  </div>
                  <button
                    type="button"
                    onClick={rollForNeutrals}
                    disabled={!neutralDiceReady || readOnly || rolling}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:pointer-events-none text-black font-orbitron font-bold px-4 py-2 rounded-xl text-xs transition"
                  >
                    <i className={`fa-solid ${rolling ? 'fa-spinner fa-spin' : 'fa-dice'} mr-1.5`} aria-hidden="true" />
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
                          className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 border-2 border-amber-200/70 shadow-lg flex items-center justify-center font-orbitron font-black text-xl text-slate-950 tabular-nums"
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
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-200 truncate">{unit.name}</div>
                          <div className="text-[10px] text-slate-500">
                            Combat {unit.combat}{diceHint}
                            {unit.max === 1 ? ' · макс. 1' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => bumpNeutral(unit.id, -1)}
                          disabled={count <= 0 || rolling}
                          className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-black disabled:opacity-40"
                          aria-label={`Убрать ${unit.name}`}
                        >
                          −
                        </button>
                        <div className="w-7 text-center font-orbitron font-black text-amber-300 tabular-nums">{count}</div>
                        <button
                          type="button"
                          onClick={() => bumpNeutral(unit.id, 1)}
                          disabled={rolling || atMax}
                          className="w-8 h-8 rounded-lg bg-amber-700/80 hover:bg-amber-600 border border-amber-500 text-black font-black disabled:opacity-40"
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
                      className="text-[11px] text-slate-400 leading-snug break-words"
                    >
                      {summarizeNeutralRoll(lastNeutralRoll)}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-800 max-md:flex-col max-md:items-stretch">
              <button
                type="button"
                disabled={rolling}
                onClick={() => {
                  setCombatOpponentId(null);
                  setLastNeutralRoll(null);
                  setRolling(false);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-xs transition disabled:opacity-40"
              >
                <i className="fa-solid fa-users mr-1" /> Сменить оппонента
              </button>
              <button
                type="button"
                disabled={rolling}
                onClick={handleNextCombatRound}
                className="bg-amber-600 hover:bg-amber-500 text-black font-orbitron font-bold px-5 py-3 rounded-xl text-sm transition disabled:opacity-40"
              >
                Следующий раунд <i className="fa-solid fa-arrow-right ml-1" />
              </button>
              <button
                type="button"
                disabled={rolling}
                onClick={handleEndCombat}
                className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-xs transition border border-red-800 disabled:opacity-40"
              >
                <i className="fa-solid fa-flag-checkered mr-1" /> Завершить бой
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
