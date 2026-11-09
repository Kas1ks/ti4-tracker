/** Shared loading splash for lazy route pages. */
export function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-[var(--hub-muted)] bg-[var(--hub-ink)]">
      <i className="fa-solid fa-spinner fa-spin text-2xl text-[var(--hub-gold-bright)]" aria-hidden="true" />
    </div>
  );
}
