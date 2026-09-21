import {
  TECH_COLORS,
  availableTechs,
  techById,
} from '../data/technologies';
import { TechPrereqIcons, TechTypeIcon } from './TechTypeIcon';

const COLOR_OWNED = {
  green: 'bg-emerald-500/25 border-emerald-400 text-emerald-100',
  blue: 'bg-sky-500/25 border-sky-400 text-sky-100',
  yellow: 'bg-amber-500/25 border-amber-400 text-amber-100',
  red: 'bg-rose-500/25 border-rose-400 text-rose-100',
};

/** Compact owned tech-type icons for a player's board / table. */
export function TechPips({ techIds = [] }) {
  const counts = { green: 0, blue: 0, yellow: 0, red: 0 };
  let units = 0;
  for (const id of techIds) {
    const tech = techById(id);
    if (!tech) continue;
    if (tech.kind === 'unit') units += 1;
    else if (tech.color && counts[tech.color] != null) counts[tech.color] += 1;
  }
  const total = techIds.length;
  if (total === 0) return <span className="text-[10px] text-slate-600">0 tech</span>;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums" title={`${total} tech`}>
      {TECH_COLORS.map(c => (
        counts[c] > 0 ? (
          <span key={c} className="inline-flex items-center gap-0.5 rounded bg-slate-800/80 px-1 py-0.5">
            <TechTypeIcon color={c} size={12} />
            <span className="text-slate-300">{counts[c]}</span>
          </span>
        ) : null
      ))}
      {units > 0 && (
        <span className="px-1 rounded bg-slate-700 text-slate-300">U{units}</span>
      )}
    </span>
  );
}

/** Read-only list for mobile table → player sheet. */
export function PlayerTechSheet({ player, usePok, useTe, onClose }) {
  const owned = player?.techIds || [];
  const catalog = availableTechs({
    usePok,
    useTe,
    factionId: player?.factionId,
  });
  const list = owned
    .map(id => techById(id) || catalog.find(t => t.id === id))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-[55] bg-black/85 flex flex-col">
      <header className="flex-shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase text-sky-400">Технологии</div>
          <h2 className="font-orbitron font-black text-xl text-white truncate">{player?.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-2"
          aria-label="Закрыть"
        >
          <i className="fa-solid fa-xmark text-lg" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!list.length && (
          <p className="text-sm text-slate-500 text-center py-10">Пока нет технологий</p>
        )}
        {list.map(tech => (
          <div
            key={tech.id}
            className={`px-3 py-2.5 rounded-xl border text-sm ${
              COLOR_OWNED[tech.color] || 'border-slate-700 bg-slate-900 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {tech.color && <TechTypeIcon color={tech.color} size={18} />}
              <span>{tech.name}</span>
            </div>
            {tech.text && <p className="text-[11px] opacity-70 mt-0.5">{tech.text}</p>}
            {tech.prereqs?.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] opacity-80">
                <span>Пререк</span>
                <TechPrereqIcons prereqs={tech.prereqs} size={14} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
