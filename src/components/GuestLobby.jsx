import { ROLE_LABELS } from '../sync/permissions';
import { ALL_FACTIONS } from '../data/gameData';

/** Waiting room for player/viewer until the host starts the game. */
export function GuestLobby({ room, players, roomError, onLeaveRoom }) {
  const roleLabel = ROLE_LABELS[room?.role] || room?.role;
  const seatIdx = players.findIndex(p => String(p.id) === String(room?.seatPlayerId));
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

      {mySeat && room?.seatSecret && (
        <div className="rounded-2xl border border-amber-600/40 bg-amber-950/20 px-5 py-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Код места</div>
          <div className="font-orbitron font-black text-3xl text-amber-200 tracking-[0.35em]">
            {room.seatSecret}
          </div>
          <p className="text-xs text-slate-400">
            Нужен, чтобы сесть сюда с другого телефона или вкладки. Не показывайте посторонним.
          </p>
        </div>
      )}

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

      {roomError && (
        <div className="text-sm text-rose-300 bg-rose-950/40 border border-rose-800 rounded-xl px-4 py-3">
          {roomError}
        </div>
      )}

      <div className="space-y-3 text-slate-400 text-sm">
        <p>Ожидайте, пока хост настроит стол и начнёт партию.</p>
        <p className="text-xs text-slate-500">Экран обновится автоматически.</p>
      </div>

      {onLeaveRoom && (
        <button
          type="button"
          onClick={onLeaveRoom}
          className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-rose-950/40 border border-rose-800/60 text-rose-300 font-bold text-sm transition"
        >
          Выйти
        </button>
      )}
    </div>
  );
}
