import { useEffect, useState } from 'react';
import { ALL_FACTIONS, PLAYER_COLORS } from '../data/gameData';
import { ROLE_LABELS, ROLES } from '../sync/permissions';
import { fetchRoomSnapshot } from '../sync/roomApi';

export function SetupScreen({
  targetScore, setTargetScore, usePok, setUsePok, useTe, setUseTe,
  players, updatePlayer, addPlayer, removePlayer, availableFactions,
  isFactionTaken, isColorTaken, importGameToken, handleStartGame,
  room, roomStatus, roomError, onCreateRoom, onJoinRoom, onLeaveRoom,
  perms,
}) {
  const canSetup = perms?.can('setup') !== false;
  const [joinRole, setJoinRole] = useState(ROLES.PLAYER);
  const [joinCode, setJoinCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [seatPlayerId, setSeatPlayerId] = useState('');
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setPreview(null);
      setPreviewError(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const snap = await fetchRoomSnapshot(code);
        if (cancelled) return;
        setPreview(snap);
        setPreviewError(null);
        const free = (snap.state?.players || []).find(p => !(snap.claimedSeats || []).some(id => String(id) === String(p.id)));
        setSeatPlayerId(free ? String(free.id) : '');
      } catch (err) {
        if (cancelled) return;
        setPreview(null);
        setPreviewError(String(err.message || err));
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [joinCode]);

  const roleLabel = room?.role ? (ROLE_LABELS[room.role] || room.role) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-slate-900 border border-emerald-800/50 p-6 rounded-3xl space-y-4">
        <h2 className="font-orbitron font-bold text-lg text-emerald-400 uppercase flex items-center gap-2">
          <i className="fa-solid fa-wifi" /> Онлайн-комната
        </h2>
        <p className="text-sm text-slate-400">
          Админ создаёт комнату и ведёт фазы. Игроки заходят со своего места и делают только свой ход.
          Зрители только смотрят.
        </p>

        {roomStatus === 'live' && room?.roomId ? (
          <div className="flex flex-wrap items-center gap-3 bg-slate-950 border border-emerald-800 rounded-2xl p-4">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500">Код комнаты</div>
              <div className="font-orbitron font-black text-2xl text-emerald-300 tracking-widest">{room.roomId}</div>
              <div className="text-xs text-slate-500 mt-1">
                Роль: {roleLabel}
                {room.seatPlayerId != null && ` · место #${players.findIndex(p => p.id === room.seatPlayerId) + 1 || '?'}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(room.roomId)}
              className="bg-emerald-700 hover:bg-emerald-600 text-black font-bold px-4 py-2 rounded-xl text-sm"
            >
              Копировать
            </button>
            <button
              type="button"
              onClick={onLeaveRoom}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-sm border border-slate-700"
            >
              Выйти в solo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={onCreateRoom}
              disabled={roomStatus === 'connecting'}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-orbitron font-bold px-5 py-3 rounded-xl text-sm uppercase"
            >
              {roomStatus === 'connecting' ? 'Создание…' : 'Создать комнату (я админ)'}
            </button>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase">Войти в комнату</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setJoinRole(ROLES.PLAYER)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border ${joinRole === ROLES.PLAYER ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  Игрок
                </button>
                <button
                  type="button"
                  onClick={() => setJoinRole(ROLES.VIEWER)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border ${joinRole === ROLES.VIEWER ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  Зритель
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Код комнаты"
                  maxLength={8}
                  className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-xl font-orbitron tracking-widest uppercase text-white focus:outline-none focus:border-emerald-400 flex-grow min-w-[10rem]"
                />
                {joinRole === ROLES.PLAYER && preview?.state?.players?.length > 0 && (
                  <select
                    value={seatPlayerId}
                    onChange={(e) => setSeatPlayerId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 px-3 py-3 rounded-xl text-sm text-white"
                  >
                    <option value="">Выберите место</option>
                    {preview.state.players.map((p, idx) => {
                      const taken = (preview.claimedSeats || []).some(id => String(id) === String(p.id));
                      return (
                        <option key={p.id} value={p.id} disabled={taken}>
                          #{idx + 1} {p.name}{taken ? ' (занято)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
                <button
                  type="button"
                  disabled={roomStatus === 'connecting' || (joinRole === ROLES.PLAYER && !seatPlayerId)}
                  onClick={() => onJoinRoom(joinCode, { role: joinRole, seatPlayerId: seatPlayerId || undefined })}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 border border-emerald-800 font-bold px-5 py-3 rounded-xl text-sm"
                >
                  Войти
                </button>
              </div>
              {previewError && <div className="text-sm text-amber-400">Комната: {previewError}</div>}
              {joinRole === ROLES.PLAYER && preview && !(preview.state?.players?.length) && (
                <div className="text-sm text-amber-400">В комнате пока нет игроков — пусть админ добавит их сначала.</div>
              )}
            </div>
          </div>
        )}
        {roomError && (
          <div className="text-sm text-red-400">{roomError}</div>
        )}
      </div>

      {!canSetup && (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl text-sm text-slate-300">
          Настройку партии меняет только админ. Дождитесь старта или смотрите табло, когда игра начнётся.
        </div>
      )}

      <div className={`bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 ${!canSetup ? 'opacity-60 pointer-events-none' : ''}`}>
        <h2 className="font-orbitron font-bold text-lg text-amber-400 uppercase flex items-center gap-2">
          <i className="fa-solid fa-sliders" /> Параметры Партии
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase">Цель Победных Очков (ПО):</label>
            <div className="flex gap-3">
              {[10, 12, 14].map(score => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setTargetScore(score)}
                  className={`flex-1 py-3 rounded-xl font-orbitron font-black text-base border transition ${targetScore === score ? 'bg-amber-500 text-black border-amber-400 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
                >
                  {score} ПО
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase">Используемые Дополнения:</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setUsePok(!usePok)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm border flex items-center justify-between transition ${usePok ? 'bg-purple-950 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
              >
                <span>Prophecy of Kings</span>
                <i className={`fa-solid ${usePok ? 'fa-check-circle text-purple-400' : 'fa-circle text-slate-700'}`} />
              </button>
              <button
                type="button"
                onClick={() => setUseTe(!useTe)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm border flex items-center justify-between transition ${useTe ? 'bg-amber-950 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
              >
                <span>Thunder&apos;s Edge</span>
                <i className={`fa-solid ${useTe ? 'fa-check-circle text-amber-400' : 'fa-circle text-slate-700'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 ${!canSetup ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-orbitron font-bold text-lg text-cyan-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-users" /> Игроки и Фракции ({players.length})
          </h2>
          {canSetup && players.length < 8 && (
            <button
              type="button"
              onClick={addPlayer}
              className="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs md:text-sm transition flex items-center gap-2"
            >
              <i className="fa-solid fa-user-plus" /> Добавить игрока
            </button>
          )}
        </div>

        {players.length === 0 ? (
          <div className="text-center py-8 text-slate-500 font-orbitron text-sm border border-dashed border-slate-800 rounded-2xl">
            Нажмите «Добавить игрока», чтобы начать настройку партии
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players.map((p, idx) => {
              const faction = ALL_FACTIONS.find(f => f.id === p.factionId);

              return (
                <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 relative">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-orbitron font-bold text-sm text-slate-500">#{idx + 1}</span>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                      className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl font-bold text-base text-white focus:outline-none focus:border-cyan-400 flex-grow"
                    />
                    {canSetup && (
                      <button
                        type="button"
                        onClick={() => removePlayer(p.id)}
                        className="text-slate-600 hover:text-red-400 p-1.5 transition"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                      <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-grow">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Фракция:</div>
                      <select
                        value={p.factionId}
                        onChange={(e) => updatePlayer(p.id, { factionId: e.target.value })}
                        className="bg-transparent text-sm font-bold text-amber-400 focus:outline-none w-full"
                      >
                        {availableFactions.map(f => (
                          <option
                            key={f.id}
                            value={f.id}
                            disabled={isFactionTaken(f.id, p.id)}
                            className="bg-slate-900 text-white"
                          >
                            {f.name}{isFactionTaken(f.id, p.id) ? ' 🔒' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Цвет: {!p.color && <span className="text-red-400 ml-1">(обязательно)</span>}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PLAYER_COLORS.map(c => {
                        const taken = isColorTaken(c.hex, p.id);
                        if (taken) return null;
                        const isSelected = p.color === c.hex;

                        return (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => updatePlayer(p.id, { color: c.hex })}
                            className={`w-5 h-5 rounded-full transition transform ${
                              isSelected
                                ? 'scale-125 ring-2 ring-cyan-400 shadow-lg'
                                : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: c.hex,
                              border: c.border ? `1px solid ${c.border}` : '1px solid rgba(255,255,255,0.2)',
                            }}
                            title={c.name}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canSetup && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <h2 className="font-orbitron font-bold text-lg text-cyan-400 uppercase flex items-center gap-2">
            <i className="fa-solid fa-download" /> Загрузка партии
          </h2>

          <div className="flex gap-3">
            <input
              type="text"
              id="importTokenInput"
              placeholder="Вставьте код партии..."
              className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs md:text-sm text-white focus:outline-none focus:border-cyan-400 flex-grow"
            />
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById('importTokenInput');
                importGameToken(input.value);
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition font-orbitron uppercase"
            >
              Загрузить
            </button>
          </div>
        </div>
      )}

      {canSetup && (
        <button
          type="button"
          onClick={handleStartGame}
          className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-black font-orbitron font-black text-xl py-5 rounded-3xl shadow-xl hover:opacity-95 transition transform active:scale-95 uppercase tracking-wider flex items-center justify-center gap-3"
        >
          <i className="fa-solid fa-play" /> Начать партию
        </button>
      )}
    </div>
  );
}
