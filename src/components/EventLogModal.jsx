import { useMemo, useState } from 'react';
import { formatGameEvent } from '../game/gameEvents';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const FILTERS = [
  { id: 'all', label: 'Все', icon: null },
  { id: 'round', label: 'Раунд', icon: 'fa-flag', tone: 'green' },
  { id: 'draft', label: 'Драфт', icon: 'fa-layer-group', tone: 'gold' },
  { id: 'strategy', label: 'Стратегии', icon: 'fa-scroll', tone: 'blue' },
  { id: 'combat', label: 'Бой', icon: 'fa-crosshairs', tone: 'red' },
  { id: 'tech', label: 'Технологии', icon: 'fa-gears', tone: 'violet' },
  { id: 'other', label: 'Другое', icon: 'fa-ellipsis', tone: 'muted' },
];

const CATEGORY_META = {
  turn: { label: 'Ход', icon: 'fa-user', tone: 'violet' },
  round: { label: 'Раунд', icon: 'fa-flag', tone: 'blue' },
  draft: { label: 'Драфт', icon: 'fa-layer-group', tone: 'gold' },
  strategy: { label: 'Стратегии', icon: 'fa-file-lines', tone: 'slate' },
  combat: { label: 'Бой', icon: 'fa-crosshairs', tone: 'red' },
  tech: { label: 'Технологии', icon: 'fa-gears', tone: 'violet' },
  other: { label: 'Другое', icon: 'fa-circle-info', tone: 'green' },
};

function eventCategory(type) {
  if (!type) return 'other';
  if (type === 'TURN_STARTED' || type === 'PLAYER_PASSED') return 'turn';
  if (type.startsWith('ROUND_')) return 'round';
  if (type === 'DRAFT_CONFIRMED' || type.startsWith('STARTING_TECH_')) return 'draft';
  if (
    type === 'DRAFT_OPENED'
    || type.startsWith('STRATEGY_')
    || type.startsWith('IMPERIAL_')
    || type.startsWith('OBJECTIVE_')
    || type.startsWith('STATUS_')
    || type.startsWith('AGENDA_')
    || type === 'SPEAKER_CHANGED'
  ) return 'strategy';
  if (type.startsWith('COMBAT_')) return 'combat';
  if (type.startsWith('TECH_') || type.startsWith('BREAKTHROUGH_')) return 'tech';
  return 'other';
}

function formatClock(at) {
  if (!Number.isFinite(at)) return '';
  try {
    return new Date(at).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function eventIcon(type, category) {
  switch (type) {
    case 'GAME_STARTED':
      return 'fa-play';
    case 'GAME_RESET':
      return 'fa-xmark';
    case 'SUPPORT_SET':
      return 'fa-handshake';
    case 'PLAYER_PASSED':
      return 'fa-flag';
    case 'TURN_STARTED':
      return 'fa-user';
    case 'COMBAT_RESOLVED':
      return 'fa-crosshairs';
    default:
      return CATEGORY_META[category]?.icon || 'fa-circle-info';
  }
}

function eventTone(type, category) {
  if (type === 'GAME_RESET' || type === 'PLAYER_ELIMINATED') return 'red';
  if (type === 'GAME_STARTED' || type === 'SUPPORT_SET') return 'green';
  if (category === 'turn') return 'violet';
  return CATEGORY_META[category]?.tone || 'muted';
}

function eventDescription(event, players) {
  const title = formatGameEvent(event, players);
  switch (event?.type) {
    case 'TURN_STARTED':
      return `Начался ход ${title.replace(/^Ход:\s*/, '')}`;
    case 'ROUND_STARTED':
      return 'Новый раунд открыт';
    case 'ROUND_ENDED':
      return 'Раунд закрыт';
    case 'DRAFT_OPENED':
      return 'Игроки выбирают карты стратегии';
    case 'DRAFT_CONFIRMED':
      return 'Карты стратегии распределены';
    case 'GAME_STARTED':
      return 'Партия запущена';
    case 'GAME_RESET':
      return 'Состояние партии очищено';
    case 'COMBAT_RESOLVED':
      return event?.resultKind === 'retreat'
        ? 'Зафиксировано отступление'
        : 'Урон и потери зафиксированы';
    case 'SUPPORT_SET':
      return 'Изменён держатель Support for the Throne';
    default:
      return title;
  }
}

export function EventLogModal({ show, onClose, events = [], players = [] }) {
  useEscapeKey(onClose, show);
  useBodyScrollLock(!!show);
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    const list = [...(events || [])].reverse();
    return list
      .map((event, idx) => {
        const category = eventCategory(event.type);
        const meta = CATEGORY_META[category] || CATEGORY_META.other;
        const title = formatGameEvent(event, players);
        const desc = eventDescription(event, players);
        return {
          key: `${event.at}-${event.type}-${idx}`,
          event,
          category,
          meta,
          title,
          desc: desc === title ? '' : desc,
          tone: eventTone(event.type, category),
          icon: eventIcon(event.type, category),
          clock: formatClock(event.at),
        };
      })
      .filter((row) => {
        if (filter === 'all') return true;
        if (filter === 'other') return row.category === 'other' || row.category === 'turn';
        return row.category === filter;
      });
  }, [events, players, filter]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 game-modal-overlay z-[58] flex items-center justify-center p-3 sm:p-4 modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-log-title"
        className="elog-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="elog-head">
          <div className="elog-head-copy">
            <h2 id="event-log-title" className="elog-title">
              <i className="fa-solid fa-scroll" aria-hidden="true" />
              Журнал партии
            </h2>
            <p className="elog-sub">Полная история событий текущей партии</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="elog-close"
            aria-label="Закрыть журнал"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="elog-filters" role="tablist" aria-label="Фильтр журнала">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`elog-filter ${filter === f.id ? 'is-active' : ''} ${f.tone ? `is-${f.tone}` : ''}`}
            >
              {f.icon ? <i className={`fa-solid ${f.icon}`} aria-hidden="true" /> : null}
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="elog-empty">
            {events?.length
              ? 'В этой категории пока нет событий.'
              : 'Пока пусто — события появятся по ходу партии.'}
          </p>
        ) : (
          <ol className="elog-timeline modal-scroll">
            {rows.map((row) => (
              <li key={row.key} className={`elog-item is-${row.tone}`}>
                <time className="elog-time" dateTime={row.event.at ? new Date(row.event.at).toISOString() : undefined}>
                  {row.clock}
                </time>
                <div className="elog-rail" aria-hidden="true">
                  <span className="elog-dot" />
                </div>
                <div className="elog-card">
                  <span className={`elog-badge is-${row.tone}`} aria-hidden="true">
                    <i className={`fa-solid ${row.icon}`} />
                  </span>
                  <div className="elog-body">
                    <div className="elog-meta">
                      <span className={`elog-tag is-${row.tone}`}>{row.meta.label}</span>
                    </div>
                    <div className="elog-item-title">{row.title}</div>
                    {row.desc ? <div className="elog-item-desc">{row.desc}</div> : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
