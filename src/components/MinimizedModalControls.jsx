export function MinimizedModalControls({ minimizedModals, showDraftModal, showPoliticsModal, showCombatModal, showStatusPhaseModal, onRestore }) {
  const controls = [
    { id: 'draft', show: showDraftModal, label: 'Драфт карт', icon: 'fa-layer-group', className: 'bg-slate-800 border border-amber-700 text-amber-400' },
    { id: 'politics', show: showPoliticsModal, label: 'Политика', icon: 'fa-gavel', className: 'bg-slate-800 border border-purple-700 text-purple-400' },
    { id: 'combat', show: showCombatModal, label: 'Бой', icon: 'fa-crosshairs', className: 'bg-slate-800 border border-red-700 text-red-400' },
    { id: 'statusPhase', show: showStatusPhaseModal, label: 'Фаза статуса', icon: 'fa-clipboard-check', className: 'bg-slate-800 border border-cyan-700 text-cyan-400' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {controls.filter((control) => minimizedModals[control.id] && control.show).map((control) => (
        <button key={control.id} onClick={() => onRestore(control.id)} className={control.className + ' font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg hover:bg-slate-700 flex items-center gap-2'}>
          <i className={'fa-solid ' + control.icon} /><span>{control.label}</span>
        </button>
      ))}
    </div>
  );
}
