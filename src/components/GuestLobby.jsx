import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import brandMark from '../assets/brand-mark.png';
import { ALL_FACTIONS, PLAYER_COLORS } from '../data/gameData';
import { ROLE_LABELS } from '../sync/permissions';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

/** Waiting room for player/viewer until the host starts the game. */
export function GuestLobby({
  room,
  players,
  roomError,
  onLeaveRoom,
  onPickColor,
  pushBanner = null,
}) {
  const roleLabel = ROLE_LABELS[room?.role] || room?.role;
  const seatIdx = players.findIndex((p) => String(p.id) === String(room?.seatPlayerId));
  const mySeat = seatIdx >= 0 ? players[seatIdx] : null;
  const myFaction = mySeat ? ALL_FACTIONS.find((f) => f.id === mySeat.factionId) : null;
  const canPickColor = !!mySeat && typeof onPickColor === 'function';
  const takenColors = new Set(
    (players || [])
      .filter((p) => String(p.id) !== String(mySeat?.id) && p.color)
      .map((p) => p.color),
  );

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
          <section
            className={`guest-lobby-seat hub-panel${canPickColor && !mySeat.color ? ' is-need-color' : ''}`}
            aria-label="Ваше место"
          >
            <div className="guest-lobby-seat-main">
              <div
                className="guest-lobby-seat-icon"
                style={mySeat.color ? { borderColor: mySeat.color } : undefined}
              >
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
            </div>
            {canPickColor && (
              <div
                className={`guest-lobby-colors${mySeat.color ? ' is-picked' : ''}`}
                role="group"
                aria-label="Ваш цвет"
                title={mySeat.color ? 'Нажмите, чтобы сменить цвет' : 'Выберите цвет'}
              >
                <span className="guest-lobby-colors-label">
                  {mySeat.color ? 'Цвет' : 'Цвет'}
                </span>
                <div className="guest-lobby-color-grid">
                  <AnimatePresence initial={false} mode="popLayout">
                    {PLAYER_COLORS
                      .filter((c) => {
                        if (mySeat.color) return c.hex === mySeat.color;
                        return !takenColors.has(c.hex);
                      })
                      .map((c) => {
                        const selected = mySeat.color === c.hex;
                        return (
                          <motion.button
                            key={c.hex}
                            type="button"
                            layout
                            className={`guest-lobby-color${selected ? ' is-on' : ''}`}
                            style={{
                              backgroundColor: c.hex,
                              borderColor: c.border || 'rgba(255,255,255,0.28)',
                            }}
                            onClick={() => onPickColor(selected ? '' : c.hex)}
                            aria-label={selected ? `${c.name}: отменить выбор` : c.name}
                            aria-pressed={selected}
                            title={c.name}
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              transition: {
                                type: 'spring',
                                stiffness: 420,
                                damping: 22,
                              },
                            }}
                            exit={{
                              opacity: 0,
                              scale: 0.35,
                              transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
                            }}
                            whileTap={{ scale: 0.9 }}
                          />
                        );
                      })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </section>
        )}

        {roomError && (
          <div className="guest-lobby-error" role="alert">
            {roomError}
          </div>
        )}

        {pushBanner}

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
