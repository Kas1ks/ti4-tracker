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
              ? 'border-[var(--game-line-gold)] bg-[rgba(201,162,39,0.16)] text-[var(--game-gold-bright)] animate-pulse'
              : 'border-[var(--game-line)] bg-[rgba(8,10,16,0.82)] text-[var(--game-text)] hover:border-[var(--game-line-gold)] hover:text-[var(--game-gold-bright)]'
          }`}
        >
          {phase.icon ? <i className={`fa-solid ${phase.icon}`} aria-hidden="true" /> : null}
          <span>{phase.label}</span>
        </button>
      ))}
    </div>
  );
}
