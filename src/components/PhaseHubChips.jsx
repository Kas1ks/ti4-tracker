/**
 * Mobile phase shortcuts — surface active processes buried in fullscreen modals.
 */
export function PhaseHubChips({
  phases = [],
  className = '',
}) {
  const visible = phases.filter((p) => p?.show);
  if (!visible.length) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Активные фазы">
      {visible.map((phase) => (
        <button
          key={phase.id}
          type="button"
          onClick={phase.onOpen}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
            phase.urgent
              ? 'border-amber-500/70 bg-amber-950/50 text-amber-200 animate-pulse'
              : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
          }`}
        >
          {phase.icon ? <i className={`fa-solid ${phase.icon}`} aria-hidden="true" /> : null}
          <span>{phase.label}</span>
        </button>
      ))}
    </div>
  );
}
