export function MinimizedModalControls({ minimizedModals, showDraftModal, showPoliticsModal, showCombatModal, onRestore }) {
  const controls = [
    { id: 'draft', show: showDraftModal, label: 'Драфт карт', icon: 'fa-layer-group', color: 'amber' },
    { id: 'politics', show: showPoliticsModal, label: 'Политика', icon: 'fa-gavel', color: 'purple' },
    { id: 'combat', show: showCombatModal, label: 'Бой', icon: 'fa-crosshairs', color: 'red' },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {controls.filter((control) => minimizedModals[control.id] && control.show).map((control) => (
        <button key={control.id} onClick={() => onRestore(control.id)} className={'bg-slate-800 border border-' + control.color + '-700 text-' + control.color + '-400 font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg hover:bg-slate-700 flex items-center gap-2'}>
          <i className={'fa-solid ' + control.icon} /><span>{control.label}</span>
        </button>
      ))}
    </div>
  );
}
