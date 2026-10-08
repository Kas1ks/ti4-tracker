export function MinimizedModalControls({
  minimizedModals,
  showDraftModal,
  showPoliticsModal,
  showCombatModal,
  showStatusPhaseModal,
  scoringActive = false,
  strategyResolutionActive = false,
  imperialClaimActive = false,
  techResearchActive = false,
  expeditionActive = false,
  startingTechDraftActive = false,
  startingTechPlayerActive = false,
  onRestore,
}) {
  const controls = [
    { id: 'draft', show: showDraftModal, label: 'Драфт карт', icon: 'fa-layer-group', className: 'bg-slate-800 border border-amber-700 text-amber-400' },
    { id: 'politics', show: showPoliticsModal, label: 'Политика', icon: 'fa-gavel', className: 'bg-slate-800 border border-purple-700 text-purple-400' },
    { id: 'combat', show: showCombatModal, label: 'Бой', icon: 'fa-crosshairs', className: 'bg-slate-800 border border-red-700 text-red-400' },
    {
      id: 'strategyResolution',
      show: strategyResolutionActive,
      label: 'Розыгрыш стратегии',
      icon: 'fa-clone',
      className: 'bg-slate-800 border border-amber-500 text-amber-300',
    },
    {
      id: 'startingTechDraft',
      show: startingTechDraftActive,
      label: 'Стартовые tech',
      icon: 'fa-atom',
      className: 'bg-slate-800 border border-cyan-500 text-cyan-300',
    },
    {
      id: 'startingTechPlayer',
      show: startingTechPlayerActive,
      label: 'Мои стартовые tech',
      icon: 'fa-microchip',
      className: 'bg-slate-800 border border-cyan-500 text-cyan-300',
    },
    {
      id: 'imperialClaim',
      show: imperialClaimActive,
      label: 'Экспансия',
      icon: 'fa-globe',
      className: 'bg-slate-800 border border-purple-500 text-purple-300',
    },
    {
      id: 'techResearch',
      show: techResearchActive,
      label: 'Технологии',
      icon: 'fa-atom',
      className: 'bg-slate-800 border border-sky-500 text-sky-300',
    },
    {
      id: 'expedition',
      show: expeditionActive,
      label: 'Экспедиция',
      icon: 'fa-mountain',
      className: 'bg-slate-800 border border-amber-500 text-amber-300',
    },
    {
      id: 'objectiveScoring',
      show: scoringActive,
      label: 'Скоринг целей',
      icon: 'fa-bullseye',
      className: 'bg-slate-800 border border-amber-600 text-amber-300',
    },
    // While scoring runs, keep status tucked away so it doesn't cover the board.
    {
      id: 'statusPhase',
      show: showStatusPhaseModal && !scoringActive,
      label: 'Фаза статуса',
      icon: 'fa-clipboard-check',
      className: 'bg-slate-800 border border-cyan-700 text-cyan-400',
    },
  ];

  return (
    <div className="minimized-modal-dock fixed bottom-4 right-4 z-[65] flex flex-col items-end gap-2 max-md:right-2">
      {controls.filter((control) => minimizedModals[control.id] && control.show).map((control) => (
        <button
          key={control.id}
          type="button"
          aria-label={`Открыть: ${control.label}`}
          onClick={() => onRestore(control.id)}
          className={control.className + ' font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg hover:bg-slate-700 flex items-center gap-2'}
        >
          <i className={'fa-solid ' + control.icon} aria-hidden="true" /><span>{control.label}</span>
        </button>
      ))}
    </div>
  );
}
