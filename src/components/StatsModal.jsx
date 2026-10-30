import { useEffect, useMemo, useState } from 'react';
import { STRATEGY_CARDS } from '../data/gameData';
import { formatTime } from '../utils/game';
import { isCloudConfigured } from '../config';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { buildAnalytics } from '../analytics/aggregate';
import { buildFactionProfile, buildPlayerProfile } from '../analytics/profiles';
import {
  avgActionDuration,
  buildDurationTrend,
  buildFactionStrategyMatrix,
  compareFactions,
  comparePlayers,
} from '../analytics/compare';
import { DEFAULT_HISTORY_FILTERS, filterHistory } from '../analytics/filter';
import { downloadCsv, gamesToCsv, playersToCsv } from '../analytics/exportCsv';
import { formatTechList } from '../analytics/techLabels';
import { buildShareCardText } from '../analytics/shareCard';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

const TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'players', label: 'Игроки' },
  { id: 'factions', label: 'Фракции' },
  { id: 'meta', label: 'Мета' },
  { id: 'compare', label: 'Сравнение' },
  { id: 'history', label: 'История' },
];

const EXPANSION_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'base', label: 'База' },
  { value: 'pok', label: 'PoK' },
  { value: 'te', label: 'TE' },
  { value: 'pok_te', label: 'PoK+TE' },
];

const PLAYER_COUNT_OPTIONS = [
  { value: '', label: 'Любое' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
];

const cardNameById = new Map(STRATEGY_CARDS.map((c) => [c.id, c.name]));

function formatAvgTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return formatTime(Math.round(seconds));
}

function Section({ title, icon, children, empty }) {
  return (
    <section className="stats-section">
      <h4 className="stats-section-title">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
        {title}
      </h4>
      {empty ? (
        <p className="stats-muted">{empty}</p>
      ) : children}
    </section>
  );
}

function FilterBar({ filters, onChange, filteredCount, totalCount }) {
  return (
    <div className="stats-filter-bar">
      <label className="stats-field">
        Дополнения
        <select
          value={filters.expansions}
          onChange={(e) => onChange({ ...filters, expansions: e.target.value })}
        >
          {EXPANSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="stats-field">
        Игроков
        <select
          value={filters.playerCount ?? ''}
          onChange={(e) => onChange({
            ...filters,
            playerCount: e.target.value === '' ? null : Number(e.target.value),
          })}
        >
          {PLAYER_COUNT_OPTIONS.map((o) => (
            <option key={o.value || 'any'} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="stats-field stats-field--grow">
        Победитель
        <input
          type="search"
          value={filters.winner}
          onChange={(e) => onChange({ ...filters, winner: e.target.value })}
          placeholder="Имя…"
        />
      </label>
      <div className="stats-filter-count">
        Показано <strong>{filteredCount}</strong>
        {' / '}
        {totalCount}
      </div>
    </div>
  );
}

function ExportBar({ history }) {
  const disabled = !history.length;
  return (
    <div className="stats-export-bar">
      <button
        type="button"
        disabled={disabled}
        onClick={() => downloadCsv('ti4-games.csv', gamesToCsv(history))}
        className="stats-chip-btn"
      >
        <i className="fa-solid fa-file-csv" aria-hidden="true" />
        CSV партий
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => downloadCsv('ti4-players.csv', playersToCsv(history))}
        className="stats-chip-btn"
      >
        <i className="fa-solid fa-file-csv" aria-hidden="true" />
        CSV игроков
      </button>
    </div>
  );
}

function ScoreBreakdownInline({ breakdown }) {
  if (!breakdown) return null;
  const parts = [
    breakdown.objectives ? `цел. ${breakdown.objectives}` : null,
    breakdown.secrets ? `секр. ${breakdown.secrets}` : null,
    breakdown.custodians ? `хран. ${breakdown.custodians}` : null,
    breakdown.support ? `supp. ${breakdown.support}` : null,
    breakdown.extra ? `др. ${breakdown.extra}` : null,
  ].filter(Boolean);
  if (!parts.length) return <span className="is-muted">—</span>;
  return <span className="is-muted">{parts.join(' · ')}</span>;
}

/** Simple horizontal bar chart — no chart library. */
function BarList({ items, valueKey = 'value', labelKey = 'label', max: maxOverride, suffix = '' }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const max = maxOverride || Math.max(...list.map((item) => Number(item[valueKey]) || 0), 1);
  return (
    <ul className="space-y-2">
      {list.map((item) => {
        const value = Number(item[valueKey]) || 0;
        const pctWidth = Math.max(0, Math.min(100, (value / max) * 100));
        const color = item.color || 'stats-bar-fill';
        return (
          <li key={item.id || item[labelKey]} className="stats-bar-item">
            <div className="stats-bar-meta">
              <span className="stats-bar-label">{item[labelKey]}</span>
              <span className="stats-bar-value">
                {value}{suffix}
                {item.right != null ? ` · ${item.right}` : ''}
              </span>
            </div>
            <div className="stats-bar-track">
              <div className={`stats-bar-fill-el ${color}`} style={{ width: `${pctWidth}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VpMixBars({ vpMix, title = 'Состав ПО' }) {
  if (!vpMix || !vpMix.gamesWithDetail) {
    return (
      <Section title={title} icon="fa-chart-pie" empty="Появится после партий со схемой v3 (разбивка ПО).">
        {null}
      </Section>
    );
  }
  const bars = [
    { id: 'obj', label: 'Цели', value: vpMix.avgObjectives, share: vpMix.shareObjectives, color: 'stats-bar-fill' },
    { id: 'sec', label: 'Секретки', value: vpMix.avgSecrets, share: vpMix.shareSecrets, color: 'stats-bar-fill is-soft' },
    { id: 'cus', label: 'Хранители', value: vpMix.avgCustodians, share: vpMix.shareCustodians, color: 'stats-bar-fill' },
    { id: 'sup', label: 'Support', value: vpMix.avgSupport, share: vpMix.shareSupport, color: 'stats-bar-fill is-soft' },
    { id: 'ext', label: 'Прочее', value: vpMix.avgExtra, share: vpMix.shareExtra, color: 'stats-bar-fill is-muted' },
  ].map((b) => ({ ...b, right: `${b.share}%` }));

  return (
    <Section title={title} icon="fa-chart-pie">
      <p className="stats-note">
        Среднее по {vpMix.gamesWithDetail} сиденьям · итог ≈ {vpMix.avgTotal} ПО
      </p>
      <BarList items={bars} />
    </Section>
  );
}

function ProfilePanel({ profile, onBack, onOpenPlayer, onOpenFaction }) {
  if (!profile) return null;
  const isPlayer = profile.type === 'player';

  return (
    <div className="stats-body stats-stack">
      <div className="stats-profile-head">
        <div>
          <button type="button" onClick={onBack} className="stats-text-btn">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            {isPlayer ? 'К игрокам' : 'К фракциям'}
          </button>
          <h4 className="stats-profile-name">{profile.name}</h4>
          <p className="stats-note">
            {isPlayer ? 'Профиль игрока' : 'Профиль фракции'}
            {' · '}
            {isPlayer ? `${profile.games} игр` : `${profile.picks} пиков`}
            {' · '}
            WR {profile.winRate}%
          </p>
        </div>
        <div className="stats-profile-score">
          <div className="stats-profile-score-value">
            {isPlayer ? profile.avgScore : profile.avgVp}
            <span>ср. ПО</span>
          </div>
          <div className="stats-note">{formatAvgTime(profile.avgGameTime)}</div>
        </div>
      </div>

      <div className="stats-kpi-grid">
        <div className="stats-kpi">
          <div className="stats-kpi-label">Победы</div>
          <div className="stats-kpi-value is-gold">{profile.wins}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Урон</div>
          <div className="stats-kpi-value is-danger">{profile.avgDamage}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Breakthrough</div>
          <div className="stats-kpi-value">{profile.breakthroughRate}%</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">2° стратегии</div>
          <div className="stats-kpi-value is-gold">
            {profile.secondary?.gamesWithPlays
              ? `${profile.secondary.engagementRate}%`
              : '—'}
          </div>
          {profile.secondary?.gamesWithPlays > 0 && (
            <div className="stats-kpi-sub">
              {profile.secondary.secondaryPlays}/{profile.secondary.secondaryPlays + profile.secondary.secondaryPasses}
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid-2">
        <VpMixBars vpMix={profile.vpMix} title="Откуда ПО" />
        <Section
          title="Стратегии"
          icon="fa-layer-group"
          empty={!profile.strategies?.length ? 'Нет данных о драфте.' : null}
        >
          <BarList
            items={(profile.strategies || []).map((s) => ({
              id: s.cardId,
              label: s.name,
              value: s.picks,
              right: `WR ${s.winRate}%`,
              color: 'stats-bar-fill',
            }))}
          />
        </Section>
      </div>

      <Section
        title="Технологии"
        icon="fa-microchip"
        empty={!profile.techs?.length ? 'Нет данных о технологиях (нужны партии v3).' : null}
      >
        <BarList
          items={(profile.techs || []).map((t) => ({
            id: t.id,
            label: t.name,
            value: t.games,
            right: `WR ${t.winRate}%`,
            color: 'stats-bar-fill',
          }))}
        />
      </Section>

      {isPlayer && profile.factions?.length > 0 && (
        <Section title="Фракции" icon="fa-planet-ringed">
          <ul className="stats-list">
            {profile.factions.map((f) => (
              <li key={f.id || f.name} className="stats-list-row">
                <button
                  type="button"
                  onClick={() => onOpenFaction?.(f.id || f.name)}
                  className="stats-link"
                >
                  {f.name}
                </button>
                <span className="stats-list-meta">{f.games} игр · WR {f.winRate}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!isPlayer && profile.players?.length > 0 && (
        <Section title="Игроки на фракции" icon="fa-users">
          <ul className="stats-list">
            {profile.players.map((p) => (
              <li key={p.key} className="stats-list-row">
                <button
                  type="button"
                  onClick={() => onOpenPlayer?.(p.key)}
                  className="stats-link"
                >
                  {p.name}
                </button>
                <span className="stats-list-meta">{p.games} игр · WR {p.winRate}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Недавние партии" icon="fa-clock-rotate-left" empty={!profile.recentGames?.length ? 'Нет партий.' : null}>
        <ul className="stats-list">
          {(profile.recentGames || []).map((g, idx) => (
            <li key={`${g.id}-${idx}`} className="stats-list-row">
              <span className="stats-list-main">
                {g.date || '—'}
                {isPlayer ? ` · ${g.faction || '—'}` : ` · ${g.player || '—'}`}
              </span>
              <span className={`stats-list-meta mono${g.isWinner ? ' is-win' : ''}`}>
                {g.score} ПО{g.isWinner ? ' ★' : ''}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function FactionStrategyHeatmap({ matrix }) {
  if (!matrix?.gamesWithPicks || !matrix.cells?.length) {
    return (
      <Section title="Фракция × стратегия" icon="fa-table-cells" empty="Нужны партии с history драфта (strategyPicks).">
        {null}
      </Section>
    );
  }

  const { factions, cards, cells, maxPicks } = matrix;
  const cellAt = (fKey, cardId) => cells.find((c) => c.factionKey === fKey && c.cardId === cardId);

  return (
    <Section title="Фракция × стратегия" icon="fa-table-cells">
      <p className="stats-note">
        Частота пиков в драфте · {matrix.gamesWithPicks} парт. · насыщенность = число пиков
      </p>
      <div className="stats-scroll">
        <table className="stats-heatmap">
          <thead>
            <tr>
              <th className="stats-heatmap-sticky">Фракция</th>
              {cards.map((c) => (
                <th key={c.id} title={c.name}>{c.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factions.map((f) => (
              <tr key={f.key}>
                <td className="stats-heatmap-sticky is-name">{f.name}</td>
                {cards.map((c) => {
                  const cell = cellAt(f.key, c.id);
                  const n = cell?.picks || 0;
                  const intensity = maxPicks > 0 ? n / maxPicks : 0;
                  const title = cell
                    ? `${f.name} · ${c.name}: ${n} пик., WR ${cell.winRate}%`
                    : '';
                  return (
                    <td key={c.id}>
                      <div
                        className={`stats-heat-cell${n ? ' has-value' : ''}`}
                        style={n ? {
                          backgroundColor: `rgba(201, 162, 39, ${0.12 + intensity * 0.72})`,
                          color: intensity > 0.45 ? '#1a1408' : 'var(--hub-gold-bright)',
                        } : undefined}
                        title={title}
                      >
                        {n || '·'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function DurationTrendChart({ trend, avgSeconds }) {
  if (!trend?.length) {
    return (
      <Section title="Длительность партий" icon="fa-hourglass-half" empty="Нет данных roundTimes.">
        {null}
      </Section>
    );
  }
  const maxSec = Math.max(...trend.map((t) => t.actionSeconds), 1);
  return (
    <Section title="Длительность партий" icon="fa-hourglass-half">
      <p className="stats-note">
        Сумма времени фаз действий · ср. {formatAvgTime(avgSeconds)} на партию
      </p>
      <ul className="stats-trend-list modal-scroll">
        {trend.map((row) => (
          <li key={row.id} className="stats-trend-row">
            <span className="stats-trend-date">{row.date || '—'}</span>
            <div className="stats-bar-track">
              <div
                className="stats-bar-fill-el stats-bar-fill"
                style={{ width: `${(row.actionSeconds / maxSec) * 100}%` }}
              />
            </div>
            <span className="stats-trend-time">{formatTime(row.actionSeconds)}</span>
            <span className="stats-trend-rounds">{row.rounds}R</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CompareTab({ history, analytics, onOpenPlayer, onOpenFaction }) {
  const [mode, setMode] = useState('player');
  const [selected, setSelected] = useState([]);

  const options = mode === 'player'
    ? (analytics.players || []).map((p) => ({ key: p.key, label: p.name }))
    : (analytics.factions || []).map((f) => ({ key: f.key, label: f.name }));

  const toggle = (key) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  const profiles = useMemo(() => (
    mode === 'player'
      ? comparePlayers(history, selected)
      : compareFactions(history, selected)
  ), [history, mode, selected]);

  const metrics = [
    { label: 'Игр', get: (p) => p.games ?? p.picks },
    { label: 'Побед', get: (p) => p.wins },
    { label: 'WR', get: (p) => `${p.winRate}%` },
    { label: 'Ср. ПО', get: (p) => p.avgScore ?? p.avgVp },
    { label: 'Урон', get: (p) => p.avgDamage },
    { label: 'BT%', get: (p) => `${p.breakthroughRate}%` },
    { label: 'Время', get: (p) => formatAvgTime(p.avgGameTime) },
  ];

  return (
    <div className="stats-body stats-stack">
      <div className="stats-compare-toolbar">
        <span className="stats-toolbar-label">Сравнить</span>
        {['player', 'faction'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setSelected([]); }}
            className={`stats-pill${mode === m ? ' is-on' : ''}`}
          >
            {m === 'player' ? 'Игроков' : 'Фракции'}
          </button>
        ))}
        <span className="stats-toolbar-hint">до 3</span>
      </div>

      <div className="stats-pill-cloud modal-scroll">
        {options.map((o) => {
          const active = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              className={`stats-pill${active ? ' is-on' : ''}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <p className="stats-state stats-state--compact">Выберите минимум двух для сравнения.</p>
      ) : (
        <div className="stats-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>Метрика</th>
                {profiles.map((p) => (
                  <th key={p.key} className="is-center">
                    <button
                      type="button"
                      className="stats-link"
                      onClick={() => (
                        mode === 'player'
                          ? onOpenPlayer?.(p.key)
                          : onOpenFaction?.(p.key)
                      )}
                    >
                      {p.name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.label}>
                  <td className="is-muted">{m.label}</td>
                  {profiles.map((p) => (
                    <td key={p.key} className="is-center mono">{m.get(p)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="is-muted">Цели (ср.)</td>
                {profiles.map((p) => (
                  <td key={p.key} className="is-center is-gold">
                    {p.vpMix?.gamesWithDetail ? p.vpMix.avgObjectives : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="is-muted">Секретки (ср.)</td>
                {profiles.map((p) => (
                  <td key={p.key} className="is-center is-gold">
                    {p.vpMix?.gamesWithDetail ? p.vpMix.avgSecrets : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OverviewPanel({
  analytics,
  durationTrend,
  avgDurationSec,
  recentGames,
  onOpenPlayer,
  onOpenFaction,
  onGoTab,
}) {
  const { players = [], factions = [], gameCount } = analytics;
  const topPlayers = players.slice(0, 5);
  const topFactions = factions.slice(0, 5);
  const recent = (recentGames || []).slice(0, 4);
  const leader = players[0];

  return (
    <div className="stats-body stats-stack">
      <div className="stats-overview-kpis">
        <div className="stats-kpi">
          <div className="stats-kpi-label">Партий</div>
          <div className="stats-kpi-value is-gold">{gameCount}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Игроков</div>
          <div className="stats-kpi-value">{players.length}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Фракций</div>
          <div className="stats-kpi-value">{factions.length}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Ср. длительность</div>
          <div className="stats-kpi-value">{formatAvgTime(avgDurationSec)}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Лидер WR</div>
          <div className="stats-kpi-value is-gold">
            {leader ? (
              <button type="button" className="stats-link" onClick={() => onOpenPlayer?.(leader.key)}>
                {leader.name}
              </button>
            ) : '—'}
          </div>
          {leader && <div className="stats-kpi-sub">WR {leader.winRate}% · {leader.wins} поб.</div>}
        </div>
      </div>

      <div className="stats-grid-2">
        <Section title="Топ игроков" icon="fa-trophy" empty={!topPlayers.length ? 'Нет данных.' : null}>
          <ul className="stats-list">
            {topPlayers.map((p, idx) => (
              <li key={p.key} className="stats-list-row">
                <button type="button" className="stats-link" onClick={() => onOpenPlayer?.(p.key)}>
                  <span className="stats-rank">{idx + 1}.</span> {p.name}
                </button>
                <span className="stats-list-meta">
                  {p.wins} поб. · WR {p.winRate}% · {p.avgScore} ПО
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Топ фракций" icon="fa-planet-ringed" empty={!topFactions.length ? 'Нет данных.' : null}>
          <ul className="stats-list">
            {topFactions.map((f, idx) => (
              <li key={f.key} className="stats-list-row">
                <button type="button" className="stats-link" onClick={() => onOpenFaction?.(f.key)}>
                  <span className="stats-rank">{idx + 1}.</span> {f.name}
                </button>
                <span className="stats-list-meta">
                  {f.wins} поб. · WR {f.winRate}% · {f.picks} пик.
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="stats-grid-2">
        <DurationTrendChart trend={durationTrend} avgSeconds={avgDurationSec} />
        <VpMixBars vpMix={analytics.vpSources} title="Состав ПО (компания)" />
      </div>

      <Section title="Недавние партии" icon="fa-clock-rotate-left" empty={!recent.length ? 'Нет партий.' : null}>
        <ul className="stats-list">
          {recent.map((g) => (
            <li key={g.id} className="stats-list-row">
              <span className="stats-list-main">
                {g.date}
                <span className="is-muted">
                  {' · '}{g.playerCount || (g.players || []).length} игр. · {g.roundsCount}R
                </span>
              </span>
              <span className="stats-list-meta is-gold">
                {g.winner}{g.winningFaction ? ` (${g.winningFaction})` : ''}
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="stats-text-btn" onClick={() => onGoTab?.('history')}>
          Открыть всю историю
          <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </Section>
    </div>
  );
}

function PlayersPanel({ players, onOpenPlayer, onOpenFaction }) {
  return (
    <div className="stats-body stats-stack">
      <Section title="Игроки" icon="fa-users" empty={!players?.length ? 'Нет данных об игроках.' : null}>
        <p className="stats-note">
          Главные показатели компании. Нажмите имя — профиль с уроном, стратегиями и партиями.
        </p>
        <div className="stats-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th className="is-center">Игр</th>
                <th className="is-center">Поб.</th>
                <th className="is-center">WR</th>
                <th className="is-center">Ср. ПО</th>
                <th className="is-center">Урон</th>
                <th className="is-center">BT%</th>
                <th className="is-center">Cust.</th>
                <th className="is-center">Elim</th>
                <th className="is-right">Ср. время</th>
                <th>Топ фракции</th>
              </tr>
            </thead>
            <tbody>
              {(players || []).map((p, idx) => (
                <tr key={p.key}>
                  <td className="is-center stats-rank">{idx + 1}</td>
                  <td>
                    <button type="button" onClick={() => onOpenPlayer?.(p.key)} className="stats-link">
                      {p.name}
                    </button>
                  </td>
                  <td className="is-center is-muted">{p.games}</td>
                  <td className="is-center is-gold">{p.wins}</td>
                  <td className="is-center is-gold">{p.winRate}%</td>
                  <td className="is-center">{p.avgScore}</td>
                  <td className="is-center is-danger">{p.avgDamage ?? 0}</td>
                  <td className="is-center">{p.breakthroughRate ?? 0}%</td>
                  <td className="is-center is-muted">{p.custodiansGames ?? 0}</td>
                  <td className="is-center is-muted">
                    {p.avgElimRound != null ? p.avgElimRound : '—'}
                  </td>
                  <td className="is-right mono">{formatAvgTime(p.avgGameTime)}</td>
                  <td className="stats-factions-cell">
                    {(p.factions || []).slice(0, 2).map((f) => (
                      <div key={f.id || f.name}>
                        <button
                          type="button"
                          onClick={() => onOpenFaction?.(f.id || String(f.name || '').toLowerCase())}
                          className="stats-link is-soft"
                        >
                          {f.name}
                        </button>
                        <span className="is-muted"> · {f.wins}/{f.games}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function FactionsPanel({ factions, onOpenFaction }) {
  return (
    <div className="stats-body stats-stack">
      <Section title="Фракции" icon="fa-planet-ringed" empty={!factions?.length ? 'Нет данных о фракциях.' : null}>
        <p className="stats-note">
          Пики и win rate. Нажмите фракцию — профиль с игроками, стратегиями и недавними партиями.
        </p>
        <div className="stats-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Фракция</th>
                <th className="is-center">Пиков</th>
                <th className="is-center">Поб.</th>
                <th className="is-center">WR</th>
                <th className="is-center">Ср. ПО</th>
                <th className="is-center">Урон</th>
                <th className="is-center">BT%</th>
                <th className="is-center">Ср. раунд</th>
                <th className="is-right">Ср. время</th>
              </tr>
            </thead>
            <tbody>
              {(factions || []).map((f, idx) => (
                <tr key={f.key}>
                  <td className="is-center stats-rank">{idx + 1}</td>
                  <td>
                    <button type="button" onClick={() => onOpenFaction?.(f.key)} className="stats-link">
                      {f.name}
                    </button>
                  </td>
                  <td className="is-center is-muted">{f.picks}</td>
                  <td className="is-center is-gold">{f.wins}</td>
                  <td className="is-center is-gold">{f.winRate}%</td>
                  <td className="is-center">{f.avgVp}</td>
                  <td className="is-center is-danger">{f.avgDamage ?? 0}</td>
                  <td className="is-center">{f.breakthroughRate ?? 0}%</td>
                  <td className="is-center is-muted">{f.avgRounds}</td>
                  <td className="is-right mono">{formatAvgTime(f.avgGameTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function MetaPanel({ analytics, factionMatrix }) {
  const {
    objectives = {},
    strategy = {},
    techs,
    politics,
    strategyExecution,
  } = analytics;
  const mostScored = objectives.mostScored || [];
  const rarelyScored = objectives.rarelyScored || [];
  const strategyCards = strategy.cards || [];

  return (
    <div className="stats-body stats-stack">
      <p className="stats-note">
        Глубже по метаигре: стратегии, цели, технологии и политика. Для людей и фракций — вкладки выше.
      </p>

      <div className="stats-grid-2">
        <Section
          title="Пики стратегий"
          icon="fa-chart-simple"
          empty={!strategyCards.length ? 'Нет данных о драфте.' : null}
        >
          <BarList
            items={strategyCards.slice(0, 8).map((c) => ({
              id: c.cardId,
              label: c.name,
              value: c.picks,
              right: `WR ${c.winRateWhenPicked}%`,
              color: 'stats-bar-fill',
            }))}
          />
        </Section>
        <Section
          title="Технологии"
          icon="fa-microchip"
          empty={
            !techs?.gamesWithTechs
              ? 'Нет данных о технологиях. Появятся после новых партий (schema v3 + techIds).'
              : null
          }
        >
          {techs?.gamesWithTechs > 0 && (
            <>
              <p className="stats-note">
                На основе {techs.gamesWithTechs} парт. с зафиксированными техами
              </p>
              <BarList
                items={(techs.top || []).map((t) => ({
                  id: t.id,
                  label: t.name,
                  value: t.games,
                  right: `WR ${t.winRate}%`,
                  color: 'stats-bar-fill is-soft',
                }))}
              />
            </>
          )}
        </Section>
      </div>

      <FactionStrategyHeatmap matrix={factionMatrix} />

      <div className="stats-grid-2">
        <Section
          title="Цели — чаще всего"
          icon="fa-bullseye"
          empty={mostScored.length === 0 ? 'Нет данных по целям.' : null}
        >
          <ul className="stats-list">
            {mostScored.map((o) => (
              <li key={o.id} className="stats-list-row">
                <span className="stats-list-main" title={o.title}>{o.title}</span>
                <span className="stats-list-meta">
                  {o.scoreEvents}× · {o.scoreRatePct}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section
          title="Цели — редко"
          icon="fa-ghost"
          empty={rarelyScored.length === 0 ? 'Нет данных по целям.' : null}
        >
          <ul className="stats-list">
            {rarelyScored.map((o) => (
              <li key={o.id} className="stats-list-row">
                <span className="stats-list-main" title={o.title}>{o.title}</span>
                <span className="stats-list-meta">
                  {o.revealed} показ. · {o.scoreRatePct}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="stats-grid-2">
        <Section
          title="Политика"
          icon="fa-gavel"
          empty={
            !politics?.gamesWithPolitics
              ? 'Нет данных о политике (появятся после партий с фазой agenda).'
              : null
          }
        >
          {politics?.gamesWithPolitics > 0 && (
            <ul className="stats-list">
              <li className="stats-list-row">
                <span className="stats-list-main is-muted">Партий с политикой</span>
                <span className="stats-list-meta mono">{politics.gamesWithPolitics}</span>
              </li>
              <li className="stats-list-row">
                <span className="stats-list-main is-muted">WR спикера = победитель</span>
                <span className="stats-list-meta is-gold">{politics.speakerWinRate}%</span>
              </li>
              <li className="stats-list-row">
                <span className="stats-list-main is-muted">Ср. законов / партия</span>
                <span className="stats-list-meta mono">{politics.avgAgendasPerGame}</span>
              </li>
              <li className="stats-list-row">
                <span className="stats-list-main is-muted">Закон «1 голос»</span>
                <span className="stats-list-meta mono">{politics.oneVoteGames} парт.</span>
              </li>
            </ul>
          )}
        </Section>
        <Section
          title="Стратегии в игре"
          icon="fa-bolt"
          empty={
            !strategyExecution?.gamesWithPlays
              ? 'Нет данных о розыгрыше карт (нужны новые партии с журналом).'
              : null
          }
        >
          {strategyExecution?.gamesWithPlays > 0 && (
            <>
              <p className="stats-note">
                Primary + secondary · {strategyExecution.gamesWithPlays} парт.
              </p>
              <BarList
                items={(strategyExecution.cards || []).slice(0, 8).map((c) => ({
                  id: c.cardId,
                  label: c.name.replace(/^\d+\.\s*/, ''),
                  value: c.primaryPlays,
                  right: `2° ${c.secondaryPlays}/${c.secondaryPlays + c.secondaryPasses}`,
                  color: 'stats-bar-fill',
                }))}
              />
            </>
          )}
        </Section>
      </div>

      <Section
        title="Карты стратегий"
        icon="fa-layer-group"
        empty={
          !strategy.gamesWithPicks
            ? 'Нет данных о драфте стратегий. Появятся после новых партий (сбор strategyPicks).'
            : null
        }
      >
        {strategy.gamesWithPicks > 0 && (
          <div className="stats-scroll">
            <p className="stats-note">
              На основе {strategy.gamesWithPicks} парт. с историей драфта
            </p>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Карта</th>
                  <th className="is-center">Пиков</th>
                  <th className="is-center">Ср. раунд</th>
                  <th className="is-right">WR при пике</th>
                </tr>
              </thead>
              <tbody>
                {strategyCards.map((c) => (
                  <tr key={c.cardId}>
                    <td className="is-strong">{c.name}</td>
                    <td className="is-center is-muted">{c.picks}</td>
                    <td className="is-center">
                      {c.avgRoundPicked != null ? c.avgRoundPicked : '—'}
                    </td>
                    <td className="is-right is-gold">{c.winRateWhenPicked}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function GameDetail({ game }) {
  const picksByRound = useMemo(() => {
    const map = new Map();
    (game.strategyPicks || []).forEach((pick) => {
      const r = pick.round || 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(pick);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [game.strategyPicks]);

  const scoredObjectives = (game.objectives || []).filter((o) => (o.scoredBy || []).length > 0);

  return (
    <div className="stats-game-detail">
      <div className="stats-scroll">
        <table className="stats-table is-compact">
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Фракция</th>
              <th className="is-center">ПО</th>
              <th>Состав</th>
              <th className="is-center">Секр.</th>
              <th className="is-center">Урон</th>
              <th className="is-center">BT</th>
              <th className="is-right">Время</th>
            </tr>
          </thead>
          <tbody>
            {[...(game.players || [])]
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .map((p) => (
                <tr key={p.name}>
                  <td className={p.isWinner ? 'is-gold is-strong' : 'is-strong'}>
                    {p.name}
                    {p.eliminated && <span className="stats-elim"> элим.</span>}
                  </td>
                  <td className="is-muted">{p.faction || '—'}</td>
                  <td className="is-center is-gold">{p.score}</td>
                  <td><ScoreBreakdownInline breakdown={p.scoreBreakdown} /></td>
                  <td className="is-center mono">
                    {p.secretsScoredVp > 0 || p.secretsHeld > 0
                      ? `${p.secretsScoredVp ?? 0}/${p.secretsHeld ?? 0}`
                      : '—'}
                  </td>
                  <td className="is-center is-danger">{p.damageDealt || 0}</td>
                  <td className="is-center">{p.breakthrough ? '✓' : '—'}</td>
                  <td className="is-right mono is-muted">{formatTime(p.totalTime || 0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {scoredObjectives.length > 0 && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Заскоренные цели</div>
          <ul className="stats-list">
            {scoredObjectives.map((o) => (
              <li key={o.id} className="stats-list-row">
                <span className="stats-list-main">{o.title}</span>
                <span className="stats-list-meta">{(o.scoredBy || []).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picksByRound.length > 0 && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Драфт стратегий</div>
          <div className="stats-stack-sm">
            {picksByRound.map(([round, picks]) => (
              <div key={round}>
                <div className="stats-note is-strong">Раунд {round}</div>
                <div className="stats-chip-row">
                  {picks.map((pick, idx) => (
                    <span
                      key={`${round}-${pick.cardId}-${pick.player}-${idx}`}
                      className="stats-tag"
                    >
                      {cardNameById.get(pick.cardId) || `#${pick.cardId}`}
                      <span> · {pick.player}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(game.supports || []).length > 0 && (
        <div className="stats-detail-block">
          <span className="stats-detail-label">Support</span>
          <span className="stats-note">
            {game.supports.map((s) => `${s.from} → ${s.holder}`).join(' · ')}
          </span>
        </div>
      )}

      {game.politics?.finalSpeaker && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Политика</div>
          <div className="stats-note">
            Спикер: <strong className="is-gold">{game.politics.finalSpeaker}</strong>
            {game.politics.oneVoteLaw && <span> · закон 1 голос</span>}
          </div>
          {(game.politics.agendas || []).length > 0 && (
            <ul className="stats-list">
              {game.politics.agendas.map((a) => (
                <li key={a.index} className="stats-list-row">
                  <span className="stats-list-main">{a.label}</span>
                  <span className="stats-list-meta mono">
                    {a.for}/{a.against} · {a.voters} гол.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(game.strategyPlays || []).length > 0 && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Розыгрыш стратегий</div>
          <ul className="stats-list modal-scroll stats-list--scroll">
            {game.strategyPlays.map((play, idx) => (
              <li key={`${play.round}-${play.cardId}-${play.player}-${idx}`} className="stats-list-row">
                <span className="stats-list-main">
                  {play.round != null && <span className="is-muted">R{play.round} · </span>}
                  {play.card?.replace(/^\d+\.\s*/, '') || play.card}
                </span>
                <span className="stats-list-meta">
                  {play.role === 'secondary' ? '2° ' : ''}
                  {play.player}
                  {play.outcome === 'passed' ? ' · пас' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(game.roundTimes) && game.roundTimes.length > 0 && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Время по раундам</div>
          <div className="stats-chip-row">
            {game.roundTimes.map((entry) => (
              <span key={entry.round} className="stats-tag stats-tag--gold mono">
                R{entry.round}: {formatTime(entry.seconds || 0)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(game.eventDigest || []).length > 0 && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Журнал (фрагмент)</div>
          <ul className="stats-digest modal-scroll">
            {game.eventDigest.slice(-20).map((e, idx) => (
              <li key={`${e.type}-${e.at}-${idx}`}>
                {e.round != null && <span className="is-muted">R{e.round} </span>}
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(game.players || []).some((p) => (p.techs || []).length > 0) && (
        <div className="stats-detail-block">
          <div className="stats-detail-label">Технологии</div>
          <ul className="stats-list">
            {(game.players || [])
              .filter((p) => (p.techs || []).length > 0)
              .map((p) => (
                <li key={p.name} className="stats-list-row">
                  <span className="stats-list-main">
                    <strong>{p.name}:</strong> {formatTechList(p.techs)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="stats-text-btn"
        onClick={() => {
          try {
            navigator.clipboard.writeText(buildShareCardText(game));
          } catch {
            /* ignore */
          }
        }}
      >
        <i className="fa-solid fa-share-nodes" aria-hidden="true" />
        Скопировать карточку партии
      </button>
    </div>
  );
}

function HistoryList({ globalHistory, deleteSingleGame }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="stats-history">
      {globalHistory.map((g) => {
        const open = expandedId === g.id;
        return (
          <article key={g.id} className="stats-history-card">
            <div className="stats-history-head">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : g.id)}
                className="stats-history-toggle"
              >
                <span className="stats-history-date">{g.date}</span>
                <span className="stats-muted">
                  ({g.roundsCount} раунд., {g.playerCount || (g.players || []).length} игр., цель {g.targetScore} ПО)
                </span>
                {(g.expansions?.pok || g.expansions?.te) && (
                  <span className="stats-muted">
                    {[g.expansions.pok && 'PoK', g.expansions.te && 'TE'].filter(Boolean).join(' · ')}
                  </span>
                )}
                <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} stats-history-chevron`} aria-hidden="true" />
              </button>
              <div className="stats-history-actions">
                <span className="stats-history-winner">
                  {g.winner}{g.winningFaction ? ` (${g.winningFaction})` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSingleGame(g.id)}
                  className="stats-icon-danger"
                  title="Удалить партию (Требуется PIN)"
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
            {(g.teController || g.custodians || (g.objectives && g.objectives.length > 0)) && (
              <div className="stats-chip-row">
                {g.teController && (
                  <span className="stats-tag stats-tag--gold">
                    TE: {g.teController.name}
                  </span>
                )}
                {g.custodians && (
                  <span className="stats-tag">
                    Хранители: {g.custodians}
                  </span>
                )}
                {(g.objectives || []).filter((o) => (o.scoredBy || []).length > 0).slice(0, 4).map((o) => (
                  <span
                    key={o.id}
                    className="stats-tag"
                    title={o.title}
                  >
                    {o.title}
                  </span>
                ))}
              </div>
            )}
            {!open && (
              <div className="stats-player-grid">
                {(g.players || []).map((p, i) => (
                  <div key={i} className="stats-player-chip">
                    <span className="truncate">{p.name}</span>
                    <span className="stats-player-score">
                      {p.score} ПО
                      {p.damageDealt > 0 && <span className="stats-dmg">⚔{p.damageDealt}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {open && <GameDetail game={g} />}
          </article>
        );
      })}
    </div>
  );
}

/** Full-page company stats (route `/stats`). */
export function StatsPage({
  onBack,
  isStatsLoading,
  globalHistory,
  pendingLocalCount = 0,
  isPendingUploading = false,
  onUploadPending = null,
  deleteSingleGame,
  clearAllStats,
}) {
  useEscapeKey(() => onBack?.(), true);
  const [tab, setTab] = useState('overview');
  const [filters, setFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [profileTarget, setProfileTarget] = useState(null);

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  const filteredHistory = useMemo(
    () => filterHistory(globalHistory, filters),
    [globalHistory, filters],
  );
  const analytics = useMemo(() => buildAnalytics(filteredHistory), [filteredHistory]);
  const durationTrend = useMemo(
    () => buildDurationTrend(filteredHistory),
    [filteredHistory],
  );
  const avgDurationSec = useMemo(
    () => avgActionDuration(filteredHistory),
    [filteredHistory],
  );
  const factionMatrix = useMemo(
    () => buildFactionStrategyMatrix(filteredHistory),
    [filteredHistory],
  );

  const profile = useMemo(() => {
    if (!profileTarget) return null;
    if (profileTarget.type === 'player') {
      return buildPlayerProfile(filteredHistory, profileTarget.key);
    }
    return buildFactionProfile(filteredHistory, profileTarget.key);
  }, [filteredHistory, profileTarget]);

  const goTab = (next) => {
    setTab(next);
    setProfileTarget(null);
  };

  const openPlayer = (key) => {
    setTab('players');
    setProfileTarget({ type: 'player', key });
  };
  const openFaction = (key) => {
    setTab('factions');
    setProfileTarget({ type: 'faction', key });
  };

  return (
    <div className="hub-shell hub-shell--column stats-shell">
      <HubCosmosBackdrop />
      <header className="stats-topbar">
        <div className="stats-topbar-inner">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="stats-back"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            <span>Назад</span>
          </button>
          <div className="stats-topbar-copy">
            <h1 id="stats-page-title" className="stats-title">
              Статистика
            </h1>
            <p className="stats-subtitle">
              Игроки, фракции, цели и стратегии · {analytics.gameCount} парт.
              {filteredHistory.length !== globalHistory.length && (
                <span> (из {globalHistory.length})</span>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="stats-main">
        {pendingLocalCount > 0 && (
          <div className="stats-local-banner" role="status">
            <div className="stats-local-banner__copy">
              <strong>Локальные партии:</strong>
              {' '}
              {pendingLocalCount}
              {' '}
              ещё не в облаке — уже учтены в этой странице.
            </div>
            {isCloudConfigured && typeof onUploadPending === 'function' ? (
              <button
                type="button"
                className="stats-local-banner__btn"
                disabled={isPendingUploading}
                onClick={onUploadPending}
              >
                {isPendingUploading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    Загрузка…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
                    Загрузить в облако
                  </>
                )}
              </button>
            ) : null}
          </div>
        )}
        {isStatsLoading ? (
          <div className="stats-state">
            <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            <div>Загрузка данных из облака…</div>
          </div>
        ) : globalHistory.length === 0 ? (
          <div className="stats-state">
            {isCloudConfigured
              ? 'История игр пока пуста. Завершите хотя бы одну партию!'
              : 'Облачная статистика выключена (VITE_CLOUD_ENABLED=false). Локальные итоги появятся здесь после партии.'}
          </div>
        ) : (
          <div className="stats-content">
            <FilterBar
              filters={filters}
              onChange={(next) => {
                setFilters(next);
                setProfileTarget(null);
              }}
              filteredCount={filteredHistory.length}
              totalCount={globalHistory.length}
            />

            <div className="stats-tabs" role="tablist" aria-label="Разделы статистики">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => goTab(t.id)}
                  className={`stats-tab${tab === t.id ? ' is-active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="stats-state stats-state--compact">
                Нет партий по выбранным фильтрам.
              </div>
            ) : profile && (tab === 'players' || tab === 'factions') ? (
              <ProfilePanel
                profile={profile}
                onBack={() => setProfileTarget(null)}
                onOpenPlayer={openPlayer}
                onOpenFaction={openFaction}
              />
            ) : tab === 'overview' ? (
              <OverviewPanel
                analytics={analytics}
                durationTrend={durationTrend}
                avgDurationSec={avgDurationSec}
                recentGames={filteredHistory}
                onOpenPlayer={openPlayer}
                onOpenFaction={openFaction}
                onGoTab={goTab}
              />
            ) : tab === 'players' ? (
              <PlayersPanel
                players={analytics.players}
                onOpenPlayer={openPlayer}
                onOpenFaction={openFaction}
              />
            ) : tab === 'factions' ? (
              <FactionsPanel
                factions={analytics.factions}
                onOpenFaction={openFaction}
              />
            ) : tab === 'meta' ? (
              <MetaPanel
                analytics={analytics}
                factionMatrix={factionMatrix}
              />
            ) : tab === 'compare' ? (
              <CompareTab
                history={filteredHistory}
                analytics={analytics}
                onOpenPlayer={openPlayer}
                onOpenFaction={openFaction}
              />
            ) : (
              <>
                <ExportBar history={filteredHistory} />
                <HistoryList globalHistory={filteredHistory} deleteSingleGame={deleteSingleGame} />
              </>
            )}

            {tab === 'history' && (
              <div className="stats-footer-actions">
                <button
                  type="button"
                  onClick={clearAllStats}
                  className="stats-danger-btn"
                >
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                  <span>Сбросить всю статистику (PIN)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** @deprecated Use StatsPage — kept for import compatibility. */
export const StatsModal = StatsPage;
