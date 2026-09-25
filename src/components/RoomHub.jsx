import { useEffect, useState } from 'react';
import { ALL_FACTIONS } from '../data/gameData';
import { ROLES } from '../sync/permissions';
import { fetchRoomSnapshot } from '../sync/roomApi';
import { loadSeatSecret } from '../sync/seatSecrets';

/**
 * First screen: Create party / Join by code.
 * Join uses seat cards from a room snapshot; viewer is a secondary action.
 */
export function RoomHub({
  roomStatus,
  roomError,
  onCreateRoom,
  onJoinRoom,
  onPlaySolo,
  importGameToken,
  uiPrompt,
}) {
  const [view, setView] = useState('hub'); // hub | join | extras
  const [joinCode, setJoinCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [joining, setJoining] = useState(false);

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

  const connecting = roomStatus === 'connecting' || joining;
  const previewPlayers = preview?.state?.players || [];
  const claimed = preview?.claimedSeats || [];

  const joinAsPlayer = async (seatPlayerId, { taken = false } = {}) => {
    let seatSecret;
    if (taken) {
      const remembered = loadSeatSecret(joinCode.trim().toUpperCase(), seatPlayerId);
      const entered = uiPrompt
        ? await uiPrompt(
          'Введите код места (выдан при первом входе). Без него чужое место занять нельзя.',
          {
            title: 'Код места',
            defaultValue: remembered || '',
            placeholder: 'Напр. K7M2',
            confirmLabel: 'Занять',
            variant: 'info',
          },
        )
        : window.prompt('Код места', remembered || '');
      if (entered == null) return;
      seatSecret = String(entered).trim().toUpperCase();
      if (!seatSecret) return;
    } else {
      seatSecret = loadSeatSecret(joinCode.trim().toUpperCase(), seatPlayerId) || undefined;
    }
    setJoining(true);
    try {
      await onJoinRoom(joinCode, { role: ROLES.PLAYER, seatPlayerId, seatSecret });
    } finally {
      setJoining(false);
    }
  };

  const joinAsViewer = async () => {
    setJoining(true);
    try {
      await onJoinRoom(joinCode, { role: ROLES.VIEWER });
    } finally {
      setJoining(false);
    }
  };

  if (view === 'join') {
    return (
      <div className="max-w-xl mx-auto py-8 md:py-16 space-y-8">
        <button
          type="button"
          onClick={() => setView('hub')}
          className="text-sm text-slate-400 hover:text-white font-bold flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left" /> Назад
        </button>

        <div className="space-y-2">
          <h1 className="font-orbitron font-black text-3xl md:text-4xl text-white tracking-wide">
            Войти в комнату
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            Введите код от хоста, затем выберите своё место за столом.
          </p>
        </div>

        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="КОД"
          maxLength={8}
          autoFocus
          className="w-full bg-slate-950 border border-slate-700 px-5 py-4 rounded-2xl font-orbitron font-black text-2xl md:text-3xl tracking-[0.35em] uppercase text-center text-emerald-300 focus:outline-none focus:border-emerald-400"
        />

        {previewError && (
          <div className="text-sm text-amber-400 text-center">{previewError}</div>
        )}

        {preview && previewPlayers.length === 0 && (
          <div className="text-sm text-amber-400 text-center border border-dashed border-slate-700 rounded-2xl p-4">
            В комнате ещё нет игроков — подождите, пока хост настроит стол.
          </div>
        )}

        {previewPlayers.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Выберите место
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {previewPlayers.map((p, idx) => {
                const taken = claimed.some(id => String(id) === String(p.id));
                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={connecting}
                    onClick={() => joinAsPlayer(p.id, { taken })}
                    className={`text-left p-4 rounded-2xl border transition flex items-center gap-3 ${
                      taken
                        ? 'bg-slate-900/80 border-amber-700/50 hover:border-amber-500 hover:bg-amber-950/20 cursor-pointer'
                        : 'bg-slate-900 border-slate-700 hover:border-cyan-500 hover:bg-slate-800/80 cursor-pointer'
                    } ${connecting ? 'opacity-50' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1 flex-shrink-0">
                      <img src={faction?.iconUrl} alt={faction?.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-grow">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Место #{idx + 1}</div>
                      <div className="font-bold text-white truncate">{p.name}</div>
                      <div className="text-xs text-amber-400/80 truncate">{faction?.name || '—'}</div>
                    </div>
                    {taken ? (
                      <span className="text-[10px] font-bold uppercase text-amber-400 text-right leading-tight">
                        Занято
                        <br />
                        <span className="text-amber-200/80 normal-case">код места</span>
                      </span>
                    ) : (
                      <i className="fa-solid fa-chevron-right text-cyan-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {preview && (
          <button
            type="button"
            disabled={connecting}
            onClick={joinAsViewer}
            className="w-full py-3 text-sm font-bold text-slate-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 rounded-2xl transition disabled:opacity-50"
          >
            Войти зрителем
          </button>
        )}

        {roomError && <div className="text-sm text-red-400 text-center">{roomError}</div>}
        {connecting && (
          <div className="text-center text-sm text-slate-400 font-orbitron">Подключение…</div>
        )}
      </div>
    );
  }

  if (view === 'extras') {
    return (
      <div className="max-w-xl mx-auto py-8 md:py-16 space-y-8">
        <button
          type="button"
          onClick={() => setView('hub')}
          className="text-sm text-slate-400 hover:text-white font-bold flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left" /> Назад
        </button>

        <h1 className="font-orbitron font-black text-2xl text-white">Дополнительно</h1>

        <button
          type="button"
          onClick={onPlaySolo}
          className="w-full text-left p-5 rounded-2xl border border-slate-700 bg-slate-900 hover:border-cyan-500 transition space-y-1"
        >
          <div className="font-orbitron font-bold text-cyan-400 uppercase text-sm">Играть без комнаты</div>
          <div className="text-sm text-slate-400">Solo на этом устройстве — без синхронизации с телефонами.</div>
        </button>

        <div className="space-y-3 p-5 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="font-orbitron font-bold text-amber-400 uppercase text-sm">Загрузить партию</div>
          <div className="flex gap-2">
            <input
              type="text"
              id="hubImportToken"
              placeholder="Код партии…"
              className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-cyan-400 flex-grow"
            />
            <button
              type="button"
              onClick={() => {
                const input = document.getElementById('hubImportToken');
                importGameToken(input?.value);
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm font-orbitron uppercase"
            >
              Загрузить
            </button>
          </div>
        </div>
      </div>
    );
  }

  // hub
  return (
    <div className="max-w-2xl mx-auto min-h-[70vh] flex flex-col justify-center py-10 md:py-16 space-y-10">
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center justify-center gap-3">
          <i className="fa-solid fa-khanda text-cyan-400 text-4xl md:text-5xl" />
          <h1 className="font-orbitron font-black text-4xl md:text-5xl text-white tracking-wider">
            TI4 TRACKER
          </h1>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          disabled={connecting}
          onClick={onCreateRoom}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-orbitron font-black text-lg md:text-xl py-5 rounded-3xl uppercase tracking-wide shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
        >
          {connecting ? 'Создание…' : 'Создать партию'}
        </button>
        <button
          type="button"
          disabled={connecting}
          onClick={() => setView('join')}
          className="w-full bg-slate-900 hover:bg-slate-800 border border-cyan-700/60 text-cyan-300 font-orbitron font-bold text-lg md:text-xl py-5 rounded-3xl uppercase tracking-wide transition active:scale-[0.98]"
        >
          Войти по коду
        </button>
      </div>

      <button
        type="button"
        onClick={() => setView('extras')}
        className="text-center text-sm text-slate-500 hover:text-slate-300 font-semibold transition"
      >
        Дополнительно
      </button>

      {roomError && <div className="text-sm text-red-400 text-center">{roomError}</div>}
    </div>
  );
}
