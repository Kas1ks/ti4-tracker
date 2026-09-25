import { clearGameSummary } from '../game/gameState';
import { formatTime } from '../utils/game';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

function readGameSummary() {
  try {
    const raw = localStorage.getItem('ti4_gameSummary');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function GameSummaryModal({ show, onClose }) {
  const summary = show ? readGameSummary() : null;

  const handleClose = () => {
    clearGameSummary();
    onClose();
  };

  useEscapeKey(handleClose, !!(show && summary));
  useBodyScrollLock(!!(show && summary));

  if (!show || !summary) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-summary-title"
        className="bg-slate-900 border border-amber-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-amber-500/10 max-h-[90vh] overflow-y-auto modal-scroll"
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
          <h2 id="game-summary-title" className="font-orbitron text-lg font-bold text-amber-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-trophy" aria-hidden="true" /> Итоги Партии
          </h2>
          <button type="button" onClick={handleClose} className="text-slate-500 hover:text-slate-300 transition" aria-label="Закрыть итоги партии">
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-sm text-slate-400">Победитель</div>
            <div className="font-orbitron font-black text-3xl text-amber-400">{summary.winner}</div>
            <div className="font-bold text-lg text-slate-300">{summary.winningFaction}</div>
            {(summary.expansions?.pok || summary.expansions?.te || summary.teController || summary.custodians) && (
              <div className="mt-2 flex flex-wrap justify-center gap-2 text-[11px] text-slate-400">
                {(summary.expansions?.pok || summary.expansions?.te) && (
                  <span>
                    {[summary.expansions.pok && 'PoK', summary.expansions.te && 'TE'].filter(Boolean).join(' · ')}
                  </span>
                )}
                {summary.teController && (
                  <span className="text-amber-400/90">TE контроль: {summary.teController.name}</span>
                )}
                {summary.custodians && (
                  <span className="text-cyan-400/90">Хранители: {summary.custodians}</span>
                )}
              </div>
            )}
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron text-xs">
                  <th className="py-2">Игрок</th>
                  <th className="py-2 text-center">Фракция</th>
                  <th className="py-2 text-center">Счет</th>
                  <th className="py-2 text-center">Нанесено урона</th>
                  <th className="py-2 text-right">Общее время</th>
                </tr>
              </thead>
              <tbody>
                {[...(summary.players || [])].sort((a, b) => b.score - a.score).map((player) => (
                  <tr key={player.name} className="border-b border-slate-800/50 last:border-b-0">
                    <td className={'py-3 font-bold ' + (player.isWinner ? 'text-amber-400' : 'text-white')}>{player.name}</td>
                    <td className="py-3 text-center text-slate-400 text-xs">{player.faction}</td>
                    <td className="py-3 text-center font-orbitron font-bold text-xl text-cyan-400">{player.score}</td>
                    <td className="py-3 text-center font-orbitron font-bold text-xl text-red-400">{player.damageDealt || 0}</td>
                    <td className="py-3 text-right font-mono text-slate-300">{formatTime(player.totalTime || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center pt-2">
            <button type="button" onClick={handleClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-6 py-2 rounded-xl text-xs transition">
              В главное меню
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
