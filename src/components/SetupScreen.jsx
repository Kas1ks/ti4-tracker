import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import brandMark from '../assets/brand-mark.png';
import { ALL_FACTIONS, PLAYER_COLORS } from '../data/gameData';
import { ROLE_LABELS } from '../sync/permissions';
import { HubHudBottom, HubHudTop } from './HubChromeFrame';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

const playerMotion = {
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

/** Compact create-party setup: one settings strip + players list. */
export function SetupScreen({
  targetScore,
  setTargetScore,
  usePok,
  setUsePok,
  useTe,
  setUseTe,
  players,
  updatePlayer,
  addPlayer,
  ensurePlayerCount,
  removePlayer,
  availableFactions,
  isFactionTaken,
  isColorTaken,
  handleStartGame,
  room,
  roomStatus,
  roomError,
  claimedSeats = [],
  onLeaveRoom,
  onOpenStats,
  onPlaySolo,
  importGameToken,
  isSolo = false,
  miltySeeded = false,
}) {
  const [panel, setPanel] = useState('setup'); // setup | settings
  const [soonNote, setSoonNote] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  useEffect(() => {
    if (!soonNote) return undefined;
    const t = setTimeout(() => setSoonNote(''), 2600);
    return () => clearTimeout(t);
  }, [soonNote]);

  useEffect(() => {
    if (!codeCopied) return undefined;
    const t = setTimeout(() => setCodeCopied(false), 1800);
    return () => clearTimeout(t);
  }, [codeCopied]);

  const copyRoomCode = async () => {
    const code = room?.roomId;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
    } catch {
      /* clipboard may be blocked */
      setCodeCopied(true);
    }
  };

  const roleLabel = room?.role ? (ROLE_LABELS[room.role] || room.role) : null;
  const inLiveRoom = roomStatus === 'live' && room?.roomId;
  const connectedCount = players.filter((p) =>
    claimedSeats.some((id) => String(id) === String(p.id)),
  ).length;

  const setPlayerCount = (count) => {
    if (typeof ensurePlayerCount === 'function') {
      ensurePlayerCount(count);
      return;
    }
    const n = Math.max(3, Math.min(8, count));
    if (players.length < n) addPlayer();
    if (players.length > n) players.slice(n).forEach((p) => removePlayer(p.id));
  };

  const randomizeFactions = () => {
    const pool = [...availableFactions]
      .map((f) => f.id)
      .sort(() => Math.random() - 0.5);
    players.forEach((p, idx) => {
      const factionId = pool[idx];
      if (factionId) updatePlayer(p.id, { factionId, startingTechIds: [] });
    });
  };

  return (
    <div className="hub-shell hub-shell--column setup-shell">
      <HubCosmosBackdrop />

      <HubHudTop>
        <button type="button" className="hub-topbar-brand" onClick={onLeaveRoom}>
          <img src={brandMark} alt="" width={28} height={28} draggable={false} />
          <span>TI4 TRACKER</span>
        </button>
      </HubHudTop>

      <div className="setup-stage">
        {panel === 'settings' ? (
          <div className="setup-panel setup-settings">
            <button type="button" className="hub-back" onClick={() => setPanel('setup')}>
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              Назад
            </button>
            <header className="hub-stage-head">
              <h1 className="hub-stage-title">Настройки</h1>
            </header>
            {typeof onPlaySolo === 'function' && !inLiveRoom && (
              <button type="button" onClick={onPlaySolo} className="hub-extra-card">
                <span className="hub-extra-card-title">Играть без комнаты</span>
                <span className="hub-extra-card-text">
                  Solo на этом устройстве — без синхронизации с телефонами.
                </span>
              </button>
            )}
            {typeof importGameToken === 'function' && (
              <div className="hub-extra-card is-static">
                <span className="hub-extra-card-title">Загрузить партию</span>
                <div className="hub-extra-import">
                  <input
                    type="text"
                    id="setupImportToken"
                    placeholder="Код партии…"
                    className="hub-extra-import-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('setupImportToken');
                      importGameToken(input?.value);
                    }}
                    className="hub-extra-import-btn"
                  >
                    Загрузить
                  </button>
                </div>
              </div>
            )}
            {!onPlaySolo && !importGameToken && (
              <p className="hub-stage-msg is-info">Дополнительные настройки появятся здесь.</p>
            )}
          </div>
        ) : (
          <div className="setup-panel setup-center">
            <div className="setup-top">
              <div className="setup-top-lead">
                <button type="button" className="hub-back" onClick={onLeaveRoom}>
                  <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                  Назад
                </button>
                <h1 className="setup-title">Создание партии</h1>
              </div>

              <div className="setup-top-meta">
                {inLiveRoom && (
                  <>
                    <div className="setup-room-chip">
                      <span className="setup-room-label">Код</span>
                      <strong className="setup-room-code">{room.roomId}</strong>
                      <button
                        type="button"
                        className={`setup-room-copy${codeCopied ? ' is-copied' : ''}`}
                        onClick={copyRoomCode}
                        aria-live="polite"
                      >
                        {codeCopied ? (
                          <>
                            <i className="fa-solid fa-check" aria-hidden="true" />
                            Скопировано
                          </>
                        ) : (
                          <>
                            <i className="fa-regular fa-copy" aria-hidden="true" />
                            Копировать
                          </>
                        )}
                      </button>
                    </div>
                    {roleLabel && (
                      <div className="setup-room-chip setup-room-chip--role">
                        <span className="setup-room-role">
                          <i className="fa-solid fa-crown" aria-hidden="true" />
                          {roleLabel}
                        </span>
                      </div>
                    )}
                    {players.length > 0 && (
                      <div className="setup-room-chip setup-room-chip--online">
                        <span className="setup-room-online">
                          <span className="setup-room-online-dot" aria-hidden="true" />
                          Онлайн {connectedCount}/{players.length}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {isSolo && <div className="setup-solo-chip">Solo</div>}
              </div>
            </div>

            {roomError && <div className="setup-error">{roomError}</div>}
            {soonNote && <p className="setup-soon" role="status">{soonNote}</p>}

            <section className="setup-bar">
              <div className="setup-bar-group">
                <span className="setup-label">Игроки</span>
                <div className="setup-chip-row">
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`setup-chip ${players.length === n ? 'is-on' : ''}`}
                      disabled={miltySeeded}
                      onClick={() => setPlayerCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-bar-group">
                <span className="setup-label">ПО</span>
                <div className="setup-chip-row">
                  {[10, 12, 14].map((score) => (
                    <button
                      key={score}
                      type="button"
                      className={`setup-chip ${targetScore === score ? 'is-on' : ''}`}
                      onClick={() => setTargetScore(score)}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-bar-group">
                <span className="setup-label">Дополнения</span>
                <div className="setup-chip-row">
                  <button
                    type="button"
                    className={`setup-chip setup-chip-wide setup-chip-exp ${usePok ? 'is-on' : ''}`}
                    disabled={useTe && usePok}
                    title={useTe ? "PoK обязателен при Thunder's Edge" : undefined}
                    onClick={() => {
                      if (useTe && usePok) return;
                      setUsePok(!usePok);
                    }}
                  >
                    PoK
                  </button>
                  <button
                    type="button"
                    className={`setup-chip setup-chip-wide setup-chip-exp ${useTe ? 'is-on' : ''}`}
                    onClick={() => setUseTe(!useTe)}
                  >
                    TE
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="setup-ghost-btn setup-ghost-btn--gold compact setup-bar-action"
                disabled={players.length === 0}
                onClick={randomizeFactions}
              >
                <i className="fa-solid fa-shuffle" aria-hidden="true" />
                Случайно
              </button>
            </section>

            <section className="setup-roster">
              <div className="setup-card-head">
                <h2 className="setup-card-title">Состав ({players.length})</h2>
                <div className="setup-card-head-actions">
                  {inLiveRoom && players.length > 0 && (
                    <span className="setup-link-status">
                      Подключено к местам: {connectedCount}/{players.length}
                    </span>
                  )}
                  {players.length < 8 && (
                    <button
                      type="button"
                      className="setup-ghost-btn setup-ghost-btn--gold compact"
                      onClick={addPlayer}
                    >
                      <i className="fa-solid fa-plus" aria-hidden="true" />
                      Игрок
                    </button>
                  )}
                </div>
              </div>

              <div className="setup-players">
                <AnimatePresence initial={false} mode="popLayout">
                  {players.length === 0 && (
                    <motion.div
                      key="setup-empty"
                      className="setup-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      Выберите число игроков сверху — места появятся здесь.
                    </motion.div>
                  )}
                  {players.map((p, idx) => {
                    const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
                    const isConnected = claimedSeats.some((id) => String(id) === String(p.id));
                    return (
                      <motion.div
                        key={p.id}
                        layout
                        className="setup-player-motion"
                        {...playerMotion}
                      >
                        <div className={`setup-player${isConnected ? ' is-online' : ''}`}>
                          <span
                            className="setup-player-num"
                            style={{ backgroundColor: p.color || '#334155' }}
                          >
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                            className="setup-player-name"
                            aria-label={`Имя игрока ${idx + 1}`}
                          />
                          {inLiveRoom && (
                            <span
                              className={`setup-player-link${isConnected ? ' is-on' : ''}`}
                              title={isConnected ? 'Игрок подключился к этому месту' : 'Место ещё свободно'}
                            >
                              {isConnected ? (
                                <>
                                  <i className="fa-solid fa-wifi" aria-hidden="true" />
                                  В сети
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-hourglass-half" aria-hidden="true" />
                                  Ждёт
                                </>
                              )}
                            </span>
                          )}
                          <div className="setup-player-faction">
                            <img src={faction?.iconUrl} alt="" />
                            {miltySeeded ? (
                              <span className="setup-player-faction-locked truncate" title="Фракция из Milty">
                                {faction?.name || p.factionId || '—'}
                              </span>
                            ) : (
                              <select
                                value={p.factionId || ''}
                                onChange={(e) => updatePlayer(p.id, {
                                  factionId: e.target.value,
                                  startingTechIds: [],
                                })}
                              >
                                {availableFactions.map((f) => (
                                  <option
                                    key={f.id}
                                    value={f.id}
                                    disabled={isFactionTaken(f.id, p.id)}
                                  >
                                    {f.name}{isFactionTaken(f.id, p.id) ? ' 🔒' : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div
                            className={`setup-player-colors${p.color ? ' is-picked' : ''}`}
                            title={p.color ? 'Нажмите, чтобы сменить цвет' : 'Цвет'}
                          >
                            <AnimatePresence initial={false} mode="popLayout">
                              {PLAYER_COLORS
                                .filter((c) => {
                                  if (p.color) return c.hex === p.color;
                                  return !isColorTaken(c.hex, p.id);
                                })
                                .map((c) => {
                                  const selected = p.color === c.hex;
                                  return (
                                    <motion.button
                                      key={c.hex}
                                      type="button"
                                      layout
                                      className={`setup-color${selected ? ' is-on' : ''}`}
                                      style={{
                                        backgroundColor: c.hex,
                                        borderColor: c.border || 'rgba(255,255,255,0.25)',
                                      }}
                                      onClick={() => updatePlayer(p.id, {
                                        color: selected ? '' : c.hex,
                                      })}
                                      aria-label={selected ? `${c.name}: отменить выбор` : c.name}
                                      aria-pressed={selected}
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
                          <button
                            type="button"
                            className="setup-player-remove"
                            onClick={() => removePlayer(p.id)}
                            aria-label="Удалить игрока"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>

            <footer className="setup-footer">
              <p className="setup-footer-note">
                {inLiveRoom ? `Комната: ${room.roomId}` : isSolo ? 'Solo' : 'Параметры готовы'}
              </p>
              <button type="button" className="hub-cta-primary setup-start" onClick={handleStartGame}>
                <span>Создать партию</span>
                <i className="fa-solid fa-chevron-right opacity-70" aria-hidden="true" />
              </button>
            </footer>
          </div>
        )}
      </div>

      <div className="setup-bottom">
        <div className="setup-dock-wrap">
          <nav className="hub-dock" aria-label="Разделы">
            <button
              type="button"
              className="hub-dock-card"
              onClick={() => (onOpenStats ? onOpenStats() : setSoonNote('Статистика скоро'))}
            >
              <i className="fa-solid fa-chart-simple hub-dock-icon" aria-hidden="true" />
              <span className="hub-dock-title">Статистика</span>
              <span className="hub-dock-caption">Аналитика ваших игр</span>
              <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-dock-card"
              onClick={() => {
                setPanel('setup');
                setSoonNote('Руководство скоро');
              }}
            >
              <i className="fa-solid fa-book-open hub-dock-icon" aria-hidden="true" />
              <span className="hub-dock-title">Руководство</span>
              <span className="hub-dock-caption">Правила и подсказки</span>
              <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hub-dock-card"
              onClick={() => {
                setPanel('setup');
                setSoonNote('Сообщество скоро');
              }}
            >
              <i className="fa-solid fa-users hub-dock-icon" aria-hidden="true" />
              <span className="hub-dock-title">Сообщество</span>
              <span className="hub-dock-caption">Найдите игроков</span>
              <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`hub-dock-card${panel === 'settings' ? ' is-active' : ''}`}
              aria-current={panel === 'settings' ? 'page' : undefined}
              onClick={() => setPanel('settings')}
            >
              <i className="fa-solid fa-gear hub-dock-icon" aria-hidden="true" />
              <span className="hub-dock-title">Настройки</span>
              <span className="hub-dock-caption">Персонализация</span>
              <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
            </button>
          </nav>
        </div>
        <HubHudBottom />
      </div>
    </div>
  );
}
