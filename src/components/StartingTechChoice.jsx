import { techById } from '../data/technologies';
import { TechTypeIcon } from './TechTypeIcon';

/**
 * Multi-select tech list for starting-tech draft (pick / fromOthers / research).
 * Parent owns selected ids and option list.
 */
export function StartingTechChoice({
  options = [],
  selected = [],
  pickCount = 1,
  onChange,
  locked = false,
  hint = null,
  title = 'Стартовые технологии',
}) {
  const ready = selected.length === Math.min(pickCount, options.length)
    || (options.length === 0 && pickCount > 0 && selected.length === 0);

  const toggle = (techId) => {
    if (locked || !onChange) return;
    if (selected.includes(techId)) {
      onChange(selected.filter(id => id !== techId));
      return;
    }
    if (selected.length >= pickCount) return;
    onChange([...selected, techId]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase">
          {title}
          <span className={ready ? 'text-emerald-400 ml-1' : 'text-amber-400 ml-1'}>
            ({selected.length}/{Math.min(pickCount, options.length || pickCount)})
          </span>
        </span>
        {hint && (
          <span className="text-[10px] font-bold text-amber-400/90">{hint}</span>
        )}
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-slate-500 px-1">Нет доступных технологий.</p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {options.map((techId) => {
            const tech = techById(techId);
            const isOn = selected.includes(techId);
            const atCap = !isOn && selected.length >= pickCount;
            return (
              <button
                key={techId}
                type="button"
                disabled={locked || atCap}
                onClick={() => toggle(techId)}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl border transition ${
                  isOn
                    ? 'border-cyan-500/70 bg-cyan-950/40 text-white'
                    : atCap || locked
                      ? 'border-slate-800 bg-slate-950/40 text-slate-600 cursor-not-allowed'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 text-[10px] ${
                    isOn ? 'border-cyan-400 bg-cyan-500 text-black' : 'border-slate-600'
                  }`}
                >
                  {isOn ? <i className="fa-solid fa-check" /> : null}
                </span>
                {tech?.color && <TechTypeIcon color={tech.color} size={18} />}
                <span className="text-sm font-bold flex-grow">{tech?.name || techId}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
