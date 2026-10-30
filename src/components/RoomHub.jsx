import { useEffect, useState } from 'react';
import brandMark from '../assets/brand-mark.png';
import brandMarkLg from '../assets/brand-mark-lg.png';
import { ALL_FACTIONS } from '../data/gameData';
import { ROLES } from '../sync/permissions';
import { listRecentRooms } from '../sync/recentRooms';
import { fetchActiveRooms, fetchRoomSnapshot } from '../sync/roomApi';
import { loadSeatSecret } from '../sync/seatSecrets';
import { formatTime } from '../utils/game';
import { HubHudBottom, HubHudTop } from './HubChromeFrame';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';
import { PwaInstallBanner } from './PwaInstallBanner';

/** Map server hub card (+ optional local seat meta) into UI party row.
 * Room join codes stay internal — never shown as the party title. */
function partyFromHubCard(card, meta, index = 0) {
  const active = !!card?.isGameActive;
  const startedAt = Number(card?.roundStartedAt);
  const elapsed = active && Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : null;
  const round = Number(card?.roundNumber);
  const roomId = String(card?.roomId || '').toUpperCase();
  const isMine = meta?.seatPlayerId != null
    || meta?.role === ROLES.ADMIN
    || meta?.role === ROLES.PLAYER;
  return {
    id: roomId,
    name: isMine
      ? (active ? 'Ваша партия' : 'Ваша комната')
      : `Партия ${index + 1}`,
    status: active ? 'playing' : 'waiting',
    statusLabel: active
      ? (Number.isFinite(round) && round > 0 ? `Раунд ${round}` : 'В процессе')
      : 'Ожидание игроков',
    players: `${Number(card?.claimedCount) || 0}/${Math.max(Number(card?.playersTotal) || 1, 1)}`,
    timer: elapsed != null ? formatTime(elapsed) : null,
    thumbUrl: card?.thumbUrl || '/hub/cosmos.jpg',
    role: meta?.role || null,
    seatPlayerId: meta?.seatPlayerId ?? null,
  };
}

/**
 * First screen: Create party / Join by code (cinematic hub shell).
 */
export function RoomHub({
  roomStatus,
  roomError,
  onCreateRoom,
  onJoinRoom,
  onClaimHost,
  onPlaySolo,
  importGameToken,
  uiPrompt,
  onOpenStats,
  onOpenGuide,
  onOpenMilty,
  onCreateWithMilty,
}) {
  const [view, setView] = useState('hub'); // hub | join | claim-host | extras | create-choose
  const [joinCode, setJoinCode] = useState('');
  /** Room chosen from «Активные партии» — kept private, never shown in the code field. */
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [hostKeyInput, setHostKeyInput] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [soonNote, setSoonNote] = useState(null);
  const [activeParties, setActiveParties] = useState([]);

  const typedCode = joinCode.trim().toUpperCase();
  const effectiveRoomId = typedCode || (selectedRoomId ? String(selectedRoomId).toUpperCase() : '');
  const fromActiveParty = !!selectedRoomId && !typedCode;

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  useEffect(() => {
    if (!soonNote) return undefined;
    const t = setTimeout(() => setSoonNote(null), 2200);
    return () => clearTimeout(t);
  }, [soonNote]);

  useEffect(() => {
    const code = effectiveRoomId;
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
    }, fromActiveParty ? 0 : 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [effectiveRoomId, fromActiveParty]);

  useEffect(() => {
    if (view !== 'hub') return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const { rooms } = await fetchActiveRooms();
        if (cancelled) return;
        const metaById = Object.fromEntries(listRecentRooms().map((r) => [r.roomId, r]));
        setActiveParties(
          rooms
            .map((card, index) => partyFromHubCard(
              card,
              metaById[String(card?.roomId || '').toUpperCase()],
              index,
            ))
            .filter((p) => p.id),
        );
      } catch {
        if (!cancelled) setActiveParties([]);
      }
    };

    load();
    const poll = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [view]);

  const connecting = roomStatus === 'connecting' || joining;
  const previewPlayers = preview?.state?.players || [];
  const claimed = preview?.claimedSeats || [];

  const resetJoinState = () => {
    setJoinCode('');
    setSelectedRoomId(null);
    setHostKeyInput('');
    setPreview(null);
    setPreviewError(null);
  };

  const goHub = () => {
    resetJoinState();
    setView('hub');
  };

  const openJoinByCode = () => {
    resetJoinState();
    setView('join');
  };

  const openClaimHost = () => {
    resetJoinState();
    setView('claim-host');
  };

  const claimAsHost = async () => {
    if (!onClaimHost || !typedCode || !hostKeyInput.trim()) return;
    setJoining(true);
    try {
      await onClaimHost(typedCode, hostKeyInput.trim());
    } finally {
      setJoining(false);
    }
  };

  const openRecentParty = async (party) => {
    const roomId = party?.id;
    if (!roomId || connecting) return;
    // From the party list: guest can enter without the room code.
    // Claiming a seat always requires typing the room code on the join screen.
    setJoinCode('');
    setSelectedRoomId(roomId);
    setView('join');
  };

  const joinAsPlayer = async (seatPlayerId, { needsCode = false } = {}) => {
    // Seat claim is only allowed after the room code was typed — never via selectedRoomId alone.
    const roomId = typedCode;
    if (!roomId) return;
    let seatSecret;
    if (needsCode) {
      // Taken seat: code is for moving the same seat to another device.
      const remembered = loadSeatSecret(roomId, seatPlayerId);
      const entered = uiPrompt
        ? await uiPrompt(
          'Место уже занято. Код места нужен, чтобы перенести его на это устройство.',
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
      // Free seat after kick/leave: room code is enough; do not reuse a stale seat code.
      seatSecret = undefined;
    }
    setJoining(true);
    try {
      await onJoinRoom(roomId, { role: ROLES.PLAYER, seatPlayerId, seatSecret });
    } finally {
      setJoining(false);
    }
  };

  const joinAsViewer = async () => {
    const roomId = effectiveRoomId;
    if (!roomId) return;
    setJoining(true);
    try {
      await onJoinRoom(roomId, { role: ROLES.VIEWER });
    } finally {
      setJoining(false);
    }
  };

  const renderActiveParties = (extraClass = '') => {
    if (activeParties.length === 0) return null;

    return (
      <aside className={`hub-active hub-panel ${extraClass}`.trim()} aria-label="Активные партии">
        <div className="hub-active-head">
          <h2 className="hub-active-title">
            Активные партии
            <span className="hub-active-count">{activeParties.length}</span>
          </h2>
          <button type="button" className="hub-active-link" onClick={openJoinByCode}>
            <i className="fa-solid fa-border-all" aria-hidden="true" />
            Войти по коду
          </button>
        </div>
        <ul className="hub-party-list">
          {activeParties.map((party) => (
            <li key={party.id}>
              <button
                type="button"
                className="hub-party-row"
                disabled={connecting}
                onClick={() => openRecentParty(party)}
              >
                <span className="hub-party-thumb" aria-hidden="true">
                  {party.thumbUrl ? (
                    <img src={party.thumbUrl} alt="" />
                  ) : (
                    <span className="hub-party-thumb-fallback" />
                  )}
                </span>
                <span className="hub-party-meta">
                  <span className="hub-party-name truncate">{party.name}</span>
                  <span className="hub-party-stats">
                    <span className={`hub-party-status is-${party.status}`}>
                      <span className="hub-party-status-dot" aria-hidden="true" />
                      {party.statusLabel}
                    </span>
                    <span className="hub-party-players">{party.players}</span>
                    {party.timer ? (
                      <span className="hub-party-timer">
                        <i className="fa-regular fa-clock" aria-hidden="true" />
                        {party.timer}
                      </span>
                    ) : null}
                  </span>
                </span>
                <i className="fa-solid fa-chevron-right hub-party-chevron" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  };

  const topbar = (
    <HubHudTop>
      <button type="button" className="hub-topbar-brand" onClick={goHub}>
        <img src={brandMark} alt="" width={28} height={28} draggable={false} />
        <span>TI4 TRACKER</span>
      </button>
    </HubHudTop>
  );

  const dock = (
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
        onClick={() => (onOpenGuide ? onOpenGuide() : setSoonNote('Руководство скоро'))}
      >
        <i className="fa-solid fa-book-open hub-dock-icon" aria-hidden="true" />
        <span className="hub-dock-title">Руководство</span>
        <span className="hub-dock-caption">Расы и подсказки</span>
        <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="hub-dock-card"
        onClick={() => (onOpenMilty ? onOpenMilty() : setSoonNote('Milty Draft скоро'))}
      >
        <i className="fa-solid fa-map hub-dock-icon" aria-hidden="true" />
        <span className="hub-dock-title">Milty Draft</span>
        <span className="hub-dock-caption">Слайсы и драфт карты</span>
        <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="hub-dock-card"
        onClick={() => setView('extras')}
      >
        <i className="fa-solid fa-gear hub-dock-icon" aria-hidden="true" />
        <span className="hub-dock-title">Настройки</span>
        <span className="hub-dock-caption">Персонализация</span>
        <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
      </button>
    </nav>
  );

  if (view === 'claim-host') {
    return (
      <div className="hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        {topbar}
        <div className="hub-main hub-main--focus">
          <div className="hub-stage">
            <button type="button" onClick={goHub} className="hub-back">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              Назад
            </button>

            <header className="hub-stage-head">
              <h1 className="hub-stage-title">Продолжить как хост</h1>
              <p className="hub-stage-lead">
                Перенос стола на это устройство. Нужны код комнаты и код хоста
                (в шапке партии на старом устройстве → кнопка Wi‑Fi).
              </p>
            </header>

            <label className="hub-field-label" htmlFor="hub-host-room">
              Код комнаты
            </label>
            <input
              id="hub-host-room"
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="КОД"
              maxLength={8}
              autoFocus
              className="hub-input"
              aria-label="Код комнаты"
            />

            <label className="hub-field-label" htmlFor="hub-host-key">
              Код хоста
            </label>
            <input
              id="hub-host-key"
              type="text"
              value={hostKeyInput}
              onChange={(e) => setHostKeyInput(e.target.value.trim())}
              placeholder="Длинный ключ с другого устройства"
              className="hub-input hub-input--host-key"
              autoComplete="off"
              spellCheck={false}
              aria-label="Код хоста"
            />

            <button
              type="button"
              className="hub-cta-primary"
              disabled={connecting || !typedCode || !hostKeyInput.trim() || !onClaimHost}
              onClick={claimAsHost}
            >
              <span className="hub-cta-label">
                <i className="fa-solid fa-right-left" aria-hidden="true" />
                {connecting ? 'Подключение…' : 'Стать хостом здесь'}
              </span>
              <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
            </button>

            {roomError && <p className="hub-stage-msg is-error">{roomError}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        {topbar}
        <div className="hub-main hub-main--focus">
          <div className="hub-stage">
            <button type="button" onClick={goHub} className="hub-back">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              Назад
            </button>

            <header className="hub-stage-head">
              <h1 className="hub-stage-title">Войти в комнату</h1>
              <p className="hub-stage-lead">
                {fromActiveParty
                  ? 'Введите код комнаты, чтобы занять место. Гость может войти без кода.'
                  : 'Введите код от хоста, затем выберите своё место за столом.'}
              </p>
            </header>

            {fromActiveParty ? (
              <>
                <button
                  type="button"
                  className="hub-cta-primary"
                  onClick={openJoinByCode}
                >
                  <span className="hub-cta-label">
                    <i className="fa-solid fa-key" aria-hidden="true" />
                    Войти по коду
                  </span>
                  <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={connecting || !effectiveRoomId}
                  onClick={joinAsViewer}
                  className="hub-cta-secondary hub-guest-enter"
                >
                  <span className="hub-cta-label">
                    <i className="fa-solid fa-eye" aria-hidden="true" />
                    {connecting ? 'Подключение…' : 'Войти гостем'}
                  </span>
                  <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
                </button>
                {previewError && (
                  <p className="hub-stage-msg is-warn">{previewError}</p>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setSelectedRoomId(null);
                    setJoinCode(e.target.value.toUpperCase());
                  }}
                  placeholder="КОД"
                  maxLength={8}
                  autoFocus
                  className="hub-input"
                  aria-label="Код комнаты"
                />

                {previewError && (
                  <p className="hub-stage-msg is-warn">{previewError}</p>
                )}

                {preview && previewPlayers.length === 0 && (
                  <p className="hub-stage-msg is-info">
                    В комнате ещё нет игроков — подождите, пока хост настроит стол.
                  </p>
                )}

                {previewPlayers.length > 0 && (
                  <section className="hub-seats" aria-label="Места за столом">
                    <h2 className="hub-seats-label">Выберите место</h2>
                    <div className="hub-seats-grid">
                      {previewPlayers.map((p, idx) => {
                        const taken = claimed.some((id) => String(id) === String(p.id));
                        const faction = p.factionId
                          ? ALL_FACTIONS.find((f) => f.id === p.factionId)
                          : null;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={connecting || !typedCode}
                            onClick={() => joinAsPlayer(p.id, { needsCode: taken })}
                            className={`hub-seat${taken ? ' is-taken' : ''}`}
                          >
                            <span className="hub-seat-icon">
                              {faction?.iconUrl ? (
                                <img src={faction.iconUrl} alt="" />
                              ) : (
                                <i className="fa-solid fa-user" aria-hidden="true" />
                              )}
                            </span>
                            <span className="hub-seat-meta">
                              <span className="hub-seat-num">Место #{idx + 1}</span>
                              <span className="hub-seat-name">{p.name}</span>
                              <span className="hub-seat-faction">{faction?.name || 'Драфт / цвет позже'}</span>
                            </span>
                            {taken ? (
                              <span className="hub-seat-badge">
                                Занято
                                <span>код места</span>
                              </span>
                            ) : (
                              <i className="fa-solid fa-chevron-right hub-seat-chevron" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {preview && (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={joinAsViewer}
                    className="hub-viewer-btn"
                  >
                    Войти зрителем
                  </button>
                )}
              </>
            )}

            {roomError && <p className="hub-stage-msg is-error">{roomError}</p>}
            {connecting && <p className="hub-stage-msg">Подключение…</p>}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'create-choose') {
    return (
      <div className="hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        {topbar}
        <div className="hub-main hub-main--focus">
          <div className="hub-stage">
            <button type="button" onClick={() => setView('hub')} className="hub-back">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              Назад
            </button>
            <header className="hub-stage-head">
              <h1 className="hub-stage-title">Создать партию</h1>
              <p className="hub-stage-sub">С драфтом слайсов или сразу к столу</p>
            </header>
            <div className="hub-cta-stack" style={{ gap: '0.75rem' }}>
              <button
                type="button"
                disabled={connecting}
                className="hub-cta-primary"
                onClick={() => {
                  if (onCreateWithMilty) onCreateWithMilty();
                  else if (onOpenMilty) onOpenMilty();
                }}
              >
                <span className="hub-cta-label">
                  <i className="fa-solid fa-map" aria-hidden="true" />
                  С Milty Draft
                </span>
                <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={connecting}
                className="hub-cta-secondary"
                onClick={onCreateRoom}
              >
                <span className="hub-cta-label">
                  <i className="fa-solid fa-users" aria-hidden="true" />
                  Без драфта
                </span>
                <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'extras') {
    return (
      <div className="hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        {topbar}
        <div className="hub-main hub-main--focus">
          <div className="hub-stage">
            <button type="button" onClick={() => setView('hub')} className="hub-back">
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              Назад
            </button>

            <header className="hub-stage-head">
              <h1 className="hub-stage-title">Настройки</h1>
            </header>

            <button type="button" onClick={onPlaySolo} className="hub-extra-card">
              <span className="hub-extra-card-title">Играть без комнаты</span>
              <span className="hub-extra-card-text">
                Solo на этом устройстве — без синхронизации с телефонами.
              </span>
            </button>

            {typeof onClaimHost === 'function' && (
              <button
                type="button"
                disabled={connecting}
                onClick={openClaimHost}
                className="hub-extra-card"
              >
                <span className="hub-extra-card-title">Я хост — другое устройство</span>
                <span className="hub-extra-card-text">
                  Перенести стол на телефон или планшет: код комнаты + код хоста из Wi‑Fi в шапке.
                </span>
              </button>
            )}

            <div className="hub-extra-card is-static">
              <span className="hub-extra-card-title">Загрузить партию</span>
              <div className="hub-extra-import">
                <input
                  type="text"
                  id="hubImportToken"
                  placeholder="Код партии…"
                  className="hub-extra-import-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('hubImportToken');
                    importGameToken(input?.value);
                  }}
                  className="hub-extra-import-btn"
                >
                  Загрузить
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-shell hub-shell--column hub-shell--home">
      <HubCosmosBackdrop />
      {topbar}
      <div className="hub-home">
        <div className="hub-home-center">
          <div className={`hub-home-row${activeParties.length === 0 ? ' hub-home-row--solo' : ''}`}>
            <div className="hub-hero">
              <div className="hub-hero-brand">
                <img
                  src={brandMarkLg}
                  alt=""
                  width={104}
                  height={104}
                  className="hub-hero-mark"
                  draggable={false}
                />
                <h1 className="hub-title">TI4 TRACKER</h1>
                <p className="hub-tagline">Ваш компаньон в галактических партиях</p>
                <div className="hub-hero-rule" aria-hidden="true" />
              </div>

              <div className="hub-cta-stack">
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => setView('create-choose')}
                  className="hub-cta-primary"
                >
                  <span className="hub-cta-label">
                    <i className="fa-solid fa-users" aria-hidden="true" />
                    {connecting ? 'Создание…' : 'Создать партию'}
                  </span>
                  <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={openJoinByCode}
                  className="hub-cta-secondary"
                >
                  <span className="hub-cta-label">
                    <i className="fa-solid fa-border-all" aria-hidden="true" />
                    Войти по коду
                  </span>
                  <i className="fa-solid fa-chevron-right hub-cta-chevron" aria-hidden="true" />
                </button>
              </div>

              {roomError && <p className="hub-home-error">{roomError}</p>}
              {soonNote && <p className="hub-home-soon" role="status">{soonNote}</p>}
            </div>

            {renderActiveParties()}
          </div>
        </div>

        <div className="hub-home-bottom">
          <PwaInstallBanner variant="hub" />
          {renderActiveParties('hub-active-mobile')}
          {dock}
        </div>
      </div>
      <HubHudBottom />
    </div>
  );
}
