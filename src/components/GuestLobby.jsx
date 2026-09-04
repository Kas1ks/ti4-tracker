import { ROLE_LABELS } from '../sync/permissions';
import { ALL_FACTIONS } from '../data/gameData';

/** Waiting room for player/viewer until the host starts the game. */
export function GuestLobby({ room, players, onLeaveRoom }) {
  const roleLabel = ROLE_LABELS[room?.role] || room?.role;
  const seatIdx = players.findIndex(p => p.id === room?.seatPlayerId);
  const mySeat = seatIdx >= 0 ? players[seatIdx] : null;
  const myFaction = mySeat ? ALL_FACTIONS.find(f => f.id === mySeat.factionId) : null;

  return (
    <div className="max-w-lg mx-auto py-12 md:py-20 space-y-8 text-center">
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">Комната</div>
        <div className="font-orbitron font-black text-4xl text-emerald-300 tracking-[0.3em]">
          {room?.roomId}
        </div>
        <div className="text-sm text-slate-400">
          Роль: <span className="text-white font-semibold">{roleLabel}</span>
          {mySeat && ` · ${mySeat.name}`}
        </div>
      </div>

      {mySeat && (
        <div className="inline-flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4">
          <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 p-1">
            <img src={myFaction?.iconUrl} alt={myFaction?.name} className="w-full h-full object-contain" />
          </div>
          <div className="text-left">
            <div className="font-bold text-white text-lg">{mySeat.name}</div>
            <div className="text-sm text-amber-400">{myFaction?.name}</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-cyan-400">
          <i className="fa-solid fa-spinner fa-spin" />
          <span className="font-orbitron font-bold uppercase text-sm">Ожидание старта</span>
        </div>
        <p className="text-slate-500 text-sm">
          Хост настраивает стол. Когда партия начнётся, табло откроется автоматически.
        </p>
      </div>

      <div className="space-y-2 pt-4">
        <div className="text-[10px] font-bold text-slate-600 uppercase">За столом ({players.length})</div>
        <div className="flex flex-wrap justify-center gap-2">
          {players.map((p, i) => (
            <span
              key={p.id}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                p.id === room?.seatPlayerId
                  ? 'border-cyan-500 text-cyan-300 bg-cyan-950/40'
                  : 'border-slate-700 text-slate-400 bg-slate-900'
              }`}
            >
              #{i + 1} {p.name}
            </span>
          ))}
          {players.length === 0 && (
            <span className="text-sm text-slate-600">Пока никого…</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onLeaveRoom}
        className="text-sm text-slate-500 hover:text-red-400 font-bold transition"
      >
        Выйти из комнаты
      </button>
    </div>
  );
}
