export function ChecklistItem({ checked, onCheck, text, disabled = false }) {
  return (
    <div
      onClick={disabled ? undefined : onCheck}
      className={`p-3 bg-slate-950 border rounded-lg flex items-center gap-4 transition-all ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      } ${
        checked
          ? 'border-emerald-500/50 bg-emerald-950/20 text-slate-300'
          : 'border-slate-800 text-slate-400' + (disabled ? '' : ' hover:bg-slate-800')
      }`}
    >
      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-emerald-500 border-emerald-400' : 'border-slate-600'}`}>
        {checked && <i className="fa-solid fa-check text-black font-bold" />}
      </div>
      <span className={`font-semibold ${checked ? 'line-through text-slate-500' : ''}`}>{text}</span>
    </div>
  );
}
