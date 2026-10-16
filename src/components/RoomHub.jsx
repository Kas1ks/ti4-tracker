import { useEffect, useState } from 'react';
import brandMark from '../assets/brand-mark.png';
import brandMarkLg from '../assets/brand-mark-lg.png';
import { ALL_FACTIONS } from '../data/gameData';
import { ROLES } from '../sync/permissions';
import { fetchRoomSnapshot } from '../sync/roomApi';
import { loadSeatSecret } from '../sync/seatSecrets';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';
import { PwaInstallBanner } from './PwaInstallBanner';

/**
 * First screen: Create party / Join by code (cinematic hub shell).
 */
export function RoomHub({
  roomStatus,
  roomError,
  onCreateRoom,
  onJoinRoom,
  onPlaySolo,
  importGameToken,
  uiPrompt,
  onOpenStats,
}) {
  const [view, setView] = useState('hub'); // hub | join | extras
  const [joinCode, setJoinCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [soonNote, setSoonNote] = useState(null);

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

  const topbar = (
    <header className="hub-topbar">
      <button type="button" className="hub-topbar-brand" onClick={() => setView('hub')}>
        <img src={brandMark} alt="" width={28} height={28} draggable={false} />
        <span>TI4 TRACKER</span>
      </button>
    </header>
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
        onClick={() => setSoonNote('Руководство скоро')}
      >
        <i className="fa-solid fa-book-open hub-dock-icon" aria-hidden="true" />
        <span className="hub-dock-title">Руководство</span>
        <span className="hub-dock-caption">Правила и подсказки</span>
        <i className="fa-solid fa-chevron-right hub-dock-chevron" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="hub-dock-card"
        onClick={() => setSoonNote('Сообщество скоро')}
      >
        <i className="fa-solid fa-users hub-dock-icon" aria-hidden="true" />
        <span className="hub-dock-title">Сообщество</span>
        <span className="hub-dock-caption">Найдите игроков</span>
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

  if (view === 'join') {
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
              <h1 className="hub-stage-title">Войти в комнату</h1>
              <p className="hub-stage-lead">
                Введите код от хоста, затем выберите своё место за столом.
              </p>
            </header>

            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
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
                    const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={connecting}
                        onClick={() => joinAsPlayer(p.id, { taken })}
                        className={`hub-seat${taken ? ' is-taken' : ''}`}
                      >
                        <span className="hub-seat-icon">
                          <img src={faction?.iconUrl} alt="" />
                        </span>
                        <span className="hub-seat-meta">
                          <span className="hub-seat-num">Место #{idx + 1}</span>
                          <span className="hub-seat-name">{p.name}</span>
                          <span className="hub-seat-faction">{faction?.name || '—'}</span>
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

            {roomError && <p className="hub-stage-msg is-error">{roomError}</p>}
            {connecting && <p className="hub-stage-msg">Подключение…</p>}
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
    <div className="hub-shell hub-shell--column">
      <HubCosmosBackdrop />
      {topbar}
      <div className="hub-home">
        <div className="hub-home-center">
          <div className="hub-home-row">
            <div className="hub-hero">
              <img
                src={brandMarkLg}
                alt=""
                width={56}
                height={56}
                className="hub-hero-mark"
                draggable={false}
              />
              <h1 className="hub-title">TI4 TRACKER</h1>

              <div className="hub-cta-stack">
                <button
                  type="button"
                  disabled={connecting}
                  onClick={onCreateRoom}
                  className="hub-cta-primary"
                >
                  <span className="inline-flex items-center gap-2">
                    <i className="fa-solid fa-users" aria-hidden="true" />
                    {connecting ? 'Создание…' : 'Создать партию'}
                  </span>
                  <i className="fa-solid fa-chevron-right opacity-70" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => setView('join')}
                  className="hub-cta-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    <i className="fa-solid fa-qrcode" aria-hidden="true" />
                    Войти по коду
                  </span>
                  <i className="fa-solid fa-chevron-right opacity-70" aria-hidden="true" />
                </button>
              </div>

              {roomError && <p className="hub-home-error">{roomError}</p>}
              {soonNote && <p className="hub-home-soon" role="status">{soonNote}</p>}

              <p className="hub-quote">
                «В галактике нет друзей, есть только интересы.»
                <span className="hub-quote-attr">— Виннозар Ловорус</span>
              </p>

              <PwaInstallBanner variant="hub" />
            </div>

            <aside className="hub-active hub-panel" aria-label="Активные партии">
              <div className="hub-active-head">
                <h2 className="hub-active-title">
                  Активные партии
                  <span className="hub-active-count">0</span>
                </h2>
                <button type="button" className="hub-active-link" onClick={() => setView('join')}>
                  Войти по коду →
                </button>
              </div>
              <p className="hub-active-empty">
                Пока нет сохранённых партий. Здесь появятся комнаты для быстрого входа.
              </p>
            </aside>
          </div>
        </div>

        <div className="hub-home-bottom">
          <aside className="hub-active hub-active-mobile hub-panel" aria-label="Активные партии">
            <div className="hub-active-head">
              <h2 className="hub-active-title">
                Активные партии
                <span className="hub-active-count">0</span>
              </h2>
              <button type="button" className="hub-active-link" onClick={() => setView('join')}>
                Войти по коду →
              </button>
            </div>
            <p className="hub-active-empty">
              Пока нет сохранённых партий. Здесь появятся комнаты для быстрого входа.
            </p>
          </aside>

          {dock}
          <footer className="hub-foot">
            <span className="hub-foot-status">
              <span className="hub-foot-dot" aria-hidden="true" />
              Онлайн · v1.0.0
            </span>
            <span className="hub-foot-tag">Explore · Plan · Dominate</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
