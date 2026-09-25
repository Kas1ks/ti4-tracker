import { useState } from 'react';
import { breakthroughByFaction } from '../data/breakthroughs';
import { TECH_COLOR_META } from '../data/technologies';
import { TechTypeIcon } from './TechTypeIcon';

/**
 * Expandable breakthrough card for the focused seat (TE games).
 * Shows locked/unlocked state, synergy colors, and full ability text.
 */
export function BreakthroughPanel({
  factionId,
  unlocked = false,
  compact = false,
  defaultOpen = false,
  canToggle = false,
  onToggle,
}) {
  const bt = breakthroughByFaction(factionId);
  const [open, setOpen] = useState(defaultOpen);
  if (!bt) return null;

  const synergy = Array.isArray(bt.synergy) ? bt.synergy : [];

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        unlocked
          ? 'border-amber-600/60 bg-amber-950/25'
          : 'border-slate-700 bg-slate-900/70'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-white/[0.03] transition"
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            unlocked
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
              : 'border-slate-600 bg-slate-950 text-slate-500'
          }`}
          aria-hidden="true"
        >
          <i className={`fa-solid ${unlocked ? 'fa-bolt' : 'fa-lock'} text-sm`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Прорыв
            </span>
            <span className={`text-[10px] font-bold uppercase ${
              unlocked ? 'text-amber-400' : 'text-slate-500'
            }`}>
              {unlocked ? 'открыт' : 'закрыт'}
            </span>
          </div>
          <div className={`font-bold text-sm leading-snug ${unlocked ? 'text-amber-100' : 'text-slate-300'}`}>
            {bt.name}
          </div>
          {synergy.length === 2 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Synergy</span>
              {synergy.map(c => (
                <span key={c} className="inline-flex items-center gap-0.5" title={TECH_COLOR_META[c]?.label}>
                  <TechTypeIcon color={c} size={compact ? 14 : 16} />
                </span>
              ))}
              <span className="text-[10px] text-slate-600">⇋</span>
            </div>
          )}
          {!synergy.length && (
            <div className="text-[10px] text-slate-600 mt-1">Без цветовой synergy</div>
          )}
        </div>
        <i
          className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-slate-500 text-xs mt-1 flex-shrink-0`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-slate-800/80">
          <p className="text-xs text-slate-300 leading-relaxed pt-2.5 whitespace-pre-wrap">
            {bt.text}
          </p>
          {synergy.length === 2 && (
            <p className="text-[11px] text-amber-400/80 mt-2 leading-snug">
              Synergy: при исследовании и tech-целях можете считать{' '}
              {TECH_COLOR_META[synergy[0]]?.label || synergy[0]}
              {' '}как{' '}
              {TECH_COLOR_META[synergy[1]]?.label || synergy[1]}
              {' '}или наоборот (не оба сразу).
            </p>
          )}
          {canToggle && typeof onToggle === 'function' && (
            <button
              type="button"
              onClick={() => onToggle(!unlocked)}
              className={`mt-3 w-full py-2 rounded-lg text-xs font-bold uppercase border transition ${
                unlocked
                  ? 'border-slate-600 bg-slate-900 text-slate-300 hover:border-red-700 hover:text-red-300'
                  : 'border-amber-700/60 bg-amber-950/40 text-amber-300 hover:border-amber-500'
              }`}
            >
              {unlocked ? 'Снять прорыв (хост)' : 'Выдать прорыв (хост)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
