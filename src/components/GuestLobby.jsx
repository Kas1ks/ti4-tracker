import { useEffect } from 'react';
import brandMark from '../assets/brand-mark.png';
import { ROLE_LABELS } from '../sync/permissions';
import { ALL_FACTIONS } from '../data/gameData';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

/** Waiting room for player/viewer until the host starts the game. */
export function GuestLobby({ room, players, roomError, onLeaveRoom }) {
  const roleLabel = ROLE_LABELS[room?.role] || room?.role;
  const seatIdx = players.findIndex((p) => String(p.id) === String(room?.seatPlayerId));
  const mySeat = seatIdx >= 0 ? players[seatIdx] : null;
  const myFaction = mySeat ? ALL_FACTIONS.find((f) => f.id === mySeat.factionId) : null;

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  return (
    <div className="hub-shell hub-shell--column guest-lobby-shell">
      <HubCosmosBackdrop />

      <main className="guest-lobby">
        <header className="guest-lobby-hero">
          <img
            src={brandMark}
            alt=""
            width={40}
            height={40}
            className="guest-lobby-mark"
            draggable={false}
          />
          <p className="guest-lobby-eyebrow">TI4 Tracker</p>
          <h1 className="guest-lobby-title">Ожидание партии</h1>
        </header>

        <section className="guest-lobby-room hub-panel" aria-label="Комната">
          <div className="guest-lobby-room-label">Код комнаты</div>
          <div className="guest-lobby-room-code">{room?.roomId || '—'}</div>
          <div className="guest-lobby-room-meta">
            Роль: <strong>{roleLabel}</strong>
            {mySeat ? ` · ${mySeat.name}` : null}
          </div>
        </section>

        {mySeat && room?.seatSecret && (
          <section className="guest-lobby-secret hub-panel" aria-label="Код места">
            <div className="guest-lobby-room-label">Код места</div>
            <div className="guest-lobby-secret-code">{room.seatSecret}</div>
            <p className="guest-lobby-hint">
              Нужен, чтобы сесть сюда с другого телефона или вкладки. Не показывайте посторонним.
            </p>
          </section>
        )}

        {mySeat && (
          <section className="guest-lobby-seat hub-panel" aria-label="Ваше место">
            <div className="guest-lobby-seat-icon">
              <img
                src={myFaction?.iconUrl}
                alt=""
                width={56}
                height={56}
              />
            </div>
            <div className="guest-lobby-seat-copy">
              <div className="guest-lobby-seat-name">{mySeat.name}</div>
              <div className="guest-lobby-seat-faction">{myFaction?.name || 'Фракция не выбрана'}</div>
            </div>
          </section>
        )}

        {roomError && (
          <div className="guest-lobby-error" role="alert">
            {roomError}
          </div>
        )}

        <p className="guest-lobby-status">
          Ожидайте, пока хост настроит стол и начнёт партию.
          <span>Экран обновится автоматически.</span>
        </p>

        {onLeaveRoom && (
          <button type="button" className="guest-lobby-leave" onClick={onLeaveRoom}>
            Выйти
          </button>
        )}
      </main>
    </div>
  );
}
