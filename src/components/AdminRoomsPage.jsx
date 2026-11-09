import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminCloseRoom,
  adminKickSeat,
  fetchAdminRooms,
} from '../sync/roomApi';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

const PIN_KEY = 'ti4_admin_rooms_pin';

function loadPin() {
  try {
    return sessionStorage.getItem(PIN_KEY) || '';
  } catch {
    return '';
  }
}

function savePin(pin) {
  try {
    if (pin) sessionStorage.setItem(PIN_KEY, pin);
    else sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* private mode */
  }
}

function formatWhen(iso) {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return String(iso);
  try {
    return new Date(ms).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function formatDuration(sec) {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}м ${s % 60}с`;
  const h = Math.floor(m / 60);
  return `${h}ч ${m % 60}м`;
}

function phaseLabel(phase) {
  if (phase === 'game') return 'Игра';
  if (phase === 'milty') return 'Milty';
  return 'Сетап';
}

function roleLabel(role) {
  if (role === 'admin') return 'Хост';
  if (role === 'player') return 'Игрок';
  if (role === 'viewer') return 'Зритель';
  return role || '—';
}

function attentionTone(attention) {
  if (attention === 'problem') return 'is-err';
  if (attention === 'politics' || attention === 'secrets') return 'is-warn';
  return '';
}

function ClientLine({ client }) {
  const seat = client?.seatPlayerId != null ? `место ${client.seatPlayerId}` : null;
  const name = client?.playerName || null;
  const bits = [roleLabel(client?.role), seat, name].filter(Boolean);
  return <li>{bits.join(' · ')}</li>;
}

function secretsBadges(secrets) {
  if (!secrets) return [];
  const out = [];
  if (!secrets.dealStarted) out.push({ key: 'sec-off', text: 'Секретки: не розданы', tone: '' });
  else if (secrets.draftPending) out.push({ key: 'sec-draft', text: 'Секретки: драфт', tone: 'is-warn' });
  else out.push({ key: 'sec-on', text: `Секретки: колода ${secrets.deckCount} · засчитано ${secrets.scoredCount}`, tone: '' });
  if (secrets.pendingRevealCount > 0) {
    out.push({
      key: 'sec-reveal',
      text: `Приём секретки ×${secrets.pendingRevealCount}`,
      tone: 'is-warn',
    });
  }
  if (secrets.discardSeatCount > 0) {
    out.push({
      key: 'sec-discard',
      text: `Сброс секретки ×${secrets.discardSeatCount}`,
      tone: 'is-warn',
    });
  }
  return out;
}

function politicsBadges(politics) {
  if (!politics) return [];
  const out = [];
  if (!politics.active) {
    out.push({ key: 'pol-off', text: 'Политика: выкл', tone: 'is-off' });
    return out;
  }
  out.push({ key: 'pol-on', text: 'Политика: вкл', tone: 'is-on' });
  if (politics.modalOpen || politics.agendaPending) {
    const step = politics.step ? ` · ${politics.step}` : '';
    out.push({ key: 'pol-live', text: `Agenda идёт${step}`, tone: 'is-warn' });
  }
  if (politics.lawsCount > 0) {
    out.push({ key: 'pol-laws', text: `Законы ${politics.lawsCount}`, tone: '' });
  }
  return out;
}

function healthBadges(health) {
  if (!health) return [];
  const out = [];
  if (health.seq != null) out.push({ key: 'seq', text: `seq ${health.seq}`, tone: '' });
  if (health.uptimeSec != null) {
    out.push({ key: 'up', text: `uptime ${formatDuration(health.uptimeSec)}`, tone: '' });
  }
  if (health.idleSec != null) {
    const idleWarn = health.idleSec >= 900;
    out.push({
      key: 'idle',
      text: `idle ${formatDuration(health.idleSec)}`,
      tone: idleWarn ? 'is-warn' : '',
    });
  }
  for (const w of health.warnings || []) {
    const map = {
      'host-offline': 'хост offline',
      'expires-soon': 'скоро истечёт',
      idle: 'долгий idle',
      'no-sse': 'нет SSE',
    };
    out.push({ key: `w-${w}`, text: map[w] || w, tone: 'is-warn' });
  }
  return out;
}

function gameLine(game) {
  if (!game) return null;
  const bits = [];
  bits.push(`раунд ${game.roundNumber || 1}`);
  if (game.activePlayerName) bits.push(`ход: ${game.activePlayerName}`);
  else if (game.roundActive) bits.push('ход: —');
  if (game.speakerName) bits.push(`спикер: ${game.speakerName}`);
  if (game.useTe) bits.push('TE');
  if (game.usePok) bits.push('PoK');
  if (game.mecatolControllerId != null) bits.push(`Мекатол: ${game.mecatolControllerId}`);
  if (game.expeditionClaimed > 0 || game.expeditionCompleted) {
    bits.push(
      game.expeditionCompleted
        ? 'экспедиция ✓'
        : `экспедиция ${game.expeditionClaimed}/${game.expeditionTotal}`,
    );
  }
  if ((game.process || []).length) bits.push(game.process.join(', '));
  return bits.join(' · ');
}

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'game', label: 'Игра' },
  { id: 'milty', label: 'Milty' },
  { id: 'setup', label: 'Сетап' },
  { id: 'problem', label: 'Проблемы' },
  { id: 'politics', label: 'Политика' },
  { id: 'secrets', label: 'Секретки' },
];

/**
 * Host-only monitor: /admin/rooms — live rooms + SSE clients (ADMIN_PIN).
 */
export function AdminRoomsPage({ onBack }) {
  const [pinInput, setPinInput] = useState(() => loadPin());
  const [pin, setPin] = useState(() => loadPin());
  const [rooms, setRooms] = useState([]);
  const [backend, setBackend] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);
  const [authed, setAuthed] = useState(!!loadPin());
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const refresh = useCallback(async (activePin) => {
    const usePin = activePin ?? pin;
    if (!usePin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminRooms(usePin);
      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      setBackend(data?.backend || null);
      setAuthed(true);
      savePin(usePin);
      setPin(usePin);
    } catch (err) {
      const code = String(err?.message || err);
      if (err?.status === 401 || code === 'unauthorized') {
        setAuthed(false);
        savePin('');
        setPin('');
        setRooms([]);
        setError('Неверный ADMIN PIN');
      } else {
        setError(code);
      }
    } finally {
      setLoading(false);
    }
  }, [pin]);

  useEffect(() => {
    if (!pin) return undefined;
    refresh(pin);
    const t = setInterval(() => refresh(pin), 10_000);
    return () => clearInterval(t);
  }, [pin, refresh]);

  const onSubmitPin = (event) => {
    event.preventDefault();
    const next = String(pinInput || '').trim();
    if (!next) {
      setError('Введите ADMIN PIN');
      return;
    }
    refresh(next);
  };

  const logout = () => {
    savePin('');
    setPin('');
    setPinInput('');
    setAuthed(false);
    setRooms([]);
    setError(null);
    setExpandedId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return rooms.filter((room) => {
      if (room.error && filter !== 'all' && filter !== 'problem') return false;
      if (filter === 'game' && room.phase !== 'game') return false;
      if (filter === 'milty' && room.phase !== 'milty') return false;
      if (filter === 'setup' && room.phase && room.phase !== 'setup') return false;
      if (filter === 'problem') {
        const bad = room.error
          || room.attention === 'problem'
          || (room.health?.warnings || []).length > 0
          || room.hostOnline === false;
        if (!bad) return false;
      }
      if (filter === 'politics') {
        const pol = room.politics;
        if (!(pol?.modalOpen || pol?.agendaPending || pol?.active)) return false;
      }
      if (filter === 'secrets') {
        const sec = room.secrets;
        if (!(sec?.discardSeatCount > 0 || sec?.pendingRevealCount > 0 || sec?.draftPending)) {
          return false;
        }
      }
      if (q && !String(room.roomId || '').includes(q)) return false;
      return true;
    });
  }, [rooms, filter, query]);

  const onCloseRoom = async (roomId) => {
    if (!pin || !roomId) return;
    const ok = window.confirm(`Закрыть комнату ${roomId}? Клиенты получат roomEnded.`);
    if (!ok) return;
    setActing(true);
    setError(null);
    try {
      await adminCloseRoom(pin, roomId);
      if (expandedId === roomId) setExpandedId(null);
      await refresh(pin);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setActing(false);
    }
  };

  const onKickSeat = async (roomId, seatPlayerId, seatName) => {
    if (!pin || !roomId || seatPlayerId == null) return;
    const label = seatName ? `${seatName} (${seatPlayerId})` : `место ${seatPlayerId}`;
    const ok = window.confirm(`Освободить ${label} в ${roomId}?`);
    if (!ok) return;
    setActing(true);
    setError(null);
    try {
      await adminKickSeat(pin, roomId, seatPlayerId);
      await refresh(pin);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="hub-shell hub-shell--column min-h-screen admin-rooms-page">
      <HubCosmosBackdrop />
      <div className="hub-main hub-main--focus relative z-10">
        <div className="hub-stage admin-rooms-stage">
          <button type="button" onClick={onBack} className="hub-back">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            Назад
          </button>

          <header className="hub-stage-head">
            <h1 className="hub-stage-title">Админ · комнаты</h1>
            <p className="admin-rooms-lead">
              Живые комнаты, SSE, health и действия. Секреты сессий не показываются.
              Uptime/idle — оценка нагрузки, не Cloudflare Duration.
            </p>
          </header>

          {!authed ? (
            <form className="admin-rooms-pin" onSubmit={onSubmitPin}>
              <label className="admin-rooms-pin-label" htmlFor="adminRoomsPin">
                ADMIN PIN
              </label>
              <div className="admin-rooms-pin-row">
                <input
                  id="adminRoomsPin"
                  type="password"
                  autoComplete="current-password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="admin-rooms-pin-input"
                  placeholder="PIN…"
                />
                <button type="submit" className="admin-rooms-btn" disabled={loading}>
                  {loading ? '…' : 'Войти'}
                </button>
              </div>
              {error ? <p className="admin-rooms-error">{error}</p> : null}
            </form>
          ) : (
            <>
              <div className="admin-rooms-toolbar">
                <span className="admin-rooms-meta">
                  {backend ? `backend: ${backend}` : null}
                  {` · ${filtered.length}/${rooms.length}`}
                  {loading ? ' · обновление…' : null}
                  {acting ? ' · действие…' : null}
                </span>
                <div className="admin-rooms-toolbar-actions">
                  <button
                    type="button"
                    className="admin-rooms-btn is-ghost"
                    onClick={() => refresh(pin)}
                    disabled={loading || acting}
                  >
                    <i className="fa-solid fa-rotate" aria-hidden="true" />
                    Обновить
                  </button>
                  <button type="button" className="admin-rooms-btn is-ghost" onClick={logout}>
                    Выйти
                  </button>
                </div>
              </div>

              <div className="admin-rooms-filters">
                <div className="admin-rooms-filter-chips" role="tablist" aria-label="Фильтр">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === f.id}
                      className={`admin-rooms-chip ${filter === f.id ? 'is-active' : ''}`}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  className="admin-rooms-search"
                  placeholder="Код комнаты…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Поиск по коду"
                />
              </div>

              {error ? <p className="admin-rooms-error">{error}</p> : null}

              {filtered.length === 0 && !loading ? (
                <p className="admin-rooms-empty">Нет комнат по фильтру.</p>
              ) : (
                <ul className="admin-rooms-list">
                  {filtered.map((room) => {
                    const open = expandedId === room.roomId;
                    return (
                      <li
                        key={room.roomId || room.error}
                        className={`admin-rooms-item ${attentionTone(room.attention)}`}
                      >
                        <div className="admin-rooms-item-head">
                          <button
                            type="button"
                            className="admin-rooms-expand"
                            onClick={() => setExpandedId(open ? null : room.roomId)}
                            disabled={!!room.error}
                          >
                            <i
                              className={`fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                              aria-hidden="true"
                            />
                            <span className="admin-rooms-code">{room.roomId || '—'}</span>
                          </button>
                          {room.error ? (
                            <span className="admin-rooms-badge is-err">{room.error}</span>
                          ) : (
                            <>
                              <span className="admin-rooms-badge">{phaseLabel(room.phase)}</span>
                              <span className={`admin-rooms-badge ${room.hostOnline ? 'is-on' : 'is-off'}`}>
                                {room.hostOnline ? 'хост online' : 'хост offline'}
                              </span>
                              <span className="admin-rooms-badge">
                                SSE {room.sseCount ?? 0}
                              </span>
                              <span className="admin-rooms-badge">
                                {room.claimedCount ?? 0}/{room.playersTotal ?? 0} мест
                              </span>
                              {[
                                ...healthBadges(room.health).slice(0, 3),
                                ...politicsBadges(room.politics),
                                ...secretsBadges(room.secrets),
                              ].map((b) => (
                                <span key={b.key} className={`admin-rooms-badge ${b.tone || ''}`}>
                                  {b.text}
                                </span>
                              ))}
                            </>
                          )}
                        </div>
                        {!room.error && (
                          <>
                            <div className="admin-rooms-item-meta">
                              <span>Активность: {formatWhen(room.lastActivityAt)}</span>
                              <span>Истекает: {formatWhen(room.expiresAt)}</span>
                              {room.miltyStatus ? <span>Milty: {room.miltyStatus}</span> : null}
                              {gameLine(room.game) ? <span>{gameLine(room.game)}</span> : null}
                            </div>
                            <div className="admin-rooms-item-actions">
                              <button
                                type="button"
                                className="admin-rooms-btn is-ghost"
                                onClick={() => setExpandedId(open ? null : room.roomId)}
                              >
                                {open ? 'Свернуть' : 'Детали'}
                              </button>
                              <button
                                type="button"
                                className="admin-rooms-btn is-danger"
                                disabled={acting}
                                onClick={() => onCloseRoom(room.roomId)}
                              >
                                Закрыть комнату
                              </button>
                            </div>
                            {open ? (
                              <div className="admin-rooms-detail">
                                <section className="admin-rooms-detail-block">
                                  <h3>Health</h3>
                                  <ul className="admin-rooms-detail-list">
                                    {(healthBadges(room.health) || []).map((b) => (
                                      <li key={b.key}>{b.text}</li>
                                    ))}
                                    {room.health?.expiresInSec != null ? (
                                      <li>
                                        до TTL:
                                        {' '}
                                        {formatDuration(room.health.expiresInSec)}
                                      </li>
                                    ) : null}
                                    <li>
                                      load hint: SSE
                                      {' '}
                                      {room.health?.loadHint?.sseCount ?? room.sseCount ?? 0}
                                      {', '}
                                      uptime
                                      {' '}
                                      {formatDuration(room.health?.loadHint?.uptimeSec)}
                                    </li>
                                  </ul>
                                </section>

                                <section className="admin-rooms-detail-block">
                                  <h3>Места</h3>
                                  {(room.seats || []).length === 0 ? (
                                    <p className="admin-rooms-empty-clients">Нет игроков</p>
                                  ) : (
                                    <ul className="admin-rooms-seats">
                                      {room.seats.map((seat) => (
                                        <li key={seat.id} className="admin-rooms-seat">
                                          <span>
                                            {seat.name}
                                            {' '}
                                            <span className="admin-rooms-seat-meta">
                                              #
                                              {seat.id}
                                              {seat.claimed ? ' · занято' : ' · свободно'}
                                              {seat.online > 0 ? ` · online×${seat.online}` : ''}
                                            </span>
                                          </span>
                                          {seat.claimed ? (
                                            <button
                                              type="button"
                                              className="admin-rooms-btn is-ghost is-compact"
                                              disabled={acting}
                                              onClick={() => onKickSeat(room.roomId, seat.id, seat.name)}
                                            >
                                              Kick
                                            </button>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>

                                <section className="admin-rooms-detail-block">
                                  <h3>SSE клиенты</h3>
                                  {(room.clients || []).length === 0 ? (
                                    <p className="admin-rooms-empty-clients">Нет подключённых клиентов</p>
                                  ) : (
                                    <ul className="admin-rooms-clients">
                                      {room.clients.map((c, i) => (
                                        <ClientLine
                                          // eslint-disable-next-line react/no-array-index-key
                                          key={`${c.role}-${c.seatPlayerId}-${i}`}
                                          client={c}
                                        />
                                      ))}
                                    </ul>
                                  )}
                                </section>

                                <section className="admin-rooms-detail-block">
                                  <h3>События</h3>
                                  {(room.events || []).length === 0 ? (
                                    <p className="admin-rooms-empty-clients">Пока пусто</p>
                                  ) : (
                                    <ul className="admin-rooms-events">
                                      {[...(room.events || [])].reverse().map((ev, i) => (
                                        <li
                                          // eslint-disable-next-line react/no-array-index-key
                                          key={`${ev.at}-${ev.kind}-${i}`}
                                        >
                                          <span className="admin-rooms-event-time">{formatWhen(ev.at)}</span>
                                          <span className={`admin-rooms-event-kind is-${ev.kind || 'action'}`}>
                                            {ev.kind || 'action'}
                                          </span>
                                          <span>{ev.summary}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>
                              </div>
                            ) : null}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
