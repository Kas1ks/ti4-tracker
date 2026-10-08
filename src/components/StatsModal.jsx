import { useMemo, useState } from 'react';
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

const TABS = [
  { id: 'analytics', label: 'Аналитика' },
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
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
      <h4 className="font-orbitron font-bold text-sm uppercase mb-1 flex items-center gap-2 text-slate-200">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
        {title}
      </h4>
      {empty ? (
        <p className="text-xs text-slate-500 py-2">{empty}</p>
      ) : children}
    </div>
  );
}

function FilterBar({ filters, onChange, filteredCount, totalCount }) {
  return (
    <div className="flex flex-wrap items-end gap-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Дополнения
        <select
          value={filters.expansions}
          onChange={(e) => onChange({ ...filters, expansions: e.target.value })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 min-w-[7rem]"
        >
          {EXPANSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Игроков
        <select
          value={filters.playerCount ?? ''}
          onChange={(e) => onChange({
            ...filters,
            playerCount: e.target.value === '' ? null : Number(e.target.value),
          })}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 min-w-[5rem]"
        >
          {PLAYER_COUNT_OPTIONS.map((o) => (
            <option key={o.value || 'any'} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex-1 min-w-[8rem]">
        Победитель
        <input
          type="search"
          value={filters.winner}
          onChange={(e) => onChange({ ...filters, winner: e.target.value })}
          placeholder="Имя…"
          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
        />
      </label>
      <div className="text-[11px] text-slate-500 pb-1.5 ml-auto">
        Показано <span className="text-slate-300 font-bold">{filteredCount}</span>
        {' / '}
        {totalCount}
      </div>
    </div>
  );
}

function ExportBar({ history }) {
  const disabled = !history.length;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => downloadCsv('ti4-games.csv', gamesToCsv(history))}
        className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <i className="fa-solid fa-file-csv mr-1.5" aria-hidden="true" />
        CSV партий
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => downloadCsv('ti4-players.csv', playersToCsv(history))}
        className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        <i className="fa-solid fa-file-csv mr-1.5" aria-hidden="true" />
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
  if (!parts.length) return <span className="text-slate-600">—</span>;
  return <span className="text-slate-500">{parts.join(' · ')}</span>;
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
        const color = item.color || 'bg-cyan-500';
        return (
          <li key={item.id || item[labelKey]} className="space-y-1">
            <div className="flex justify-between gap-2 text-[11px]">
              <span className="text-slate-300 truncate">{item[labelKey]}</span>
              <span className="text-slate-500 flex-shrink-0 font-mono">
                {value}{suffix}
                {item.right != null ? ` · ${item.right}` : ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pctWidth}%` }} />
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
    { id: 'obj', label: 'Цели', value: vpMix.avgObjectives, share: vpMix.shareObjectives, color: 'bg-amber-400' },
    { id: 'sec', label: 'Секретки', value: vpMix.avgSecrets, share: vpMix.shareSecrets, color: 'bg-violet-400' },
    { id: 'cus', label: 'Хранители', value: vpMix.avgCustodians, share: vpMix.shareCustodians, color: 'bg-cyan-400' },
    { id: 'sup', label: 'Support', value: vpMix.avgSupport, share: vpMix.shareSupport, color: 'bg-emerald-400' },
    { id: 'ext', label: 'Прочее', value: vpMix.avgExtra, share: vpMix.shareExtra, color: 'bg-slate-400' },
  ].map((b) => ({ ...b, right: `${b.share}%` }));

  return (
    <Section title={title} icon="fa-chart-pie">
      <p className="text-[11px] text-slate-500 -mt-1">
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
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-cyan-300 transition mb-2 inline-flex items-center gap-1.5"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            К аналитике
          </button>
          <h4 className="font-orbitron font-black text-xl text-white">
            {isPlayer ? profile.name : profile.name}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {isPlayer ? 'Профиль игрока' : 'Профиль фракции'}
            {' · '}
            {isPlayer ? `${profile.games} игр` : `${profile.picks} пиков`}
            {' · '}
            WR {isPlayer ? profile.winRate : profile.winRate}%
          </p>
        </div>
        <div className="text-right text-xs space-y-1">
          <div className="text-amber-400 font-orbitron font-bold text-2xl">
            {isPlayer ? profile.avgScore : profile.avgVp}
            <span className="text-sm text-slate-500 ml-1">ср. ПО</span>
          </div>
          <div className="text-slate-500">⏱ {formatAvgTime(profile.avgGameTime)}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase text-[10px]">Победы</div>
          <div className="font-orbitron font-bold text-amber-400 text-lg">{profile.wins}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase text-[10px]">Урон</div>
          <div className="font-orbitron font-bold text-red-400 text-lg">{profile.avgDamage}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase text-[10px]">Breakthrough</div>
          <div className="font-orbitron font-bold text-violet-300 text-lg">{profile.breakthroughRate}%</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="text-slate-500 uppercase text-[10px]">2° стратегии</div>
          <div className="font-orbitron font-bold text-cyan-300 text-lg">
            {profile.secondary?.gamesWithPlays
              ? `${profile.secondary.engagementRate}%`
              : '—'}
          </div>
          {profile.secondary?.gamesWithPlays > 0 && (
            <div className="text-[10px] text-slate-600 mt-0.5">
              {profile.secondary.secondaryPlays}/{profile.secondary.secondaryPlays + profile.secondary.secondaryPasses}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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
              color: 'bg-cyan-500',
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
            color: 'bg-sky-500',
          }))}
        />
      </Section>

      {isPlayer && profile.factions?.length > 0 && (
        <Section title="Фракции" icon="fa-planet-ringed">
          <ul className="space-y-1.5 text-xs">
            {profile.factions.map((f) => (
              <li key={f.id || f.name} className="flex justify-between gap-2 border-b border-slate-800/50 py-1.5">
                <button
                  type="button"
                  onClick={() => onOpenFaction?.(f.id || f.name)}
                  className="text-slate-200 hover:text-cyan-300 font-bold truncate text-left"
                >
                  {f.name}
                </button>
                <span className="text-slate-500 flex-shrink-0">{f.games} игр · WR {f.winRate}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!isPlayer && profile.players?.length > 0 && (
        <Section title="Игроки на фракции" icon="fa-users">
          <ul className="space-y-1.5 text-xs">
            {profile.players.map((p) => (
              <li key={p.key} className="flex justify-between gap-2 border-b border-slate-800/50 py-1.5">
                <button
                  type="button"
                  onClick={() => onOpenPlayer?.(p.key)}
                  className="text-slate-200 hover:text-cyan-300 font-bold truncate text-left"
                >
                  {p.name}
                </button>
                <span className="text-slate-500 flex-shrink-0">{p.games} игр · WR {p.winRate}%</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Недавние партии" icon="fa-clock-rotate-left" empty={!profile.recentGames?.length ? 'Нет партий.' : null}>
        <ul className="space-y-1.5 text-xs">
          {(profile.recentGames || []).map((g, idx) => (
            <li
              key={`${g.id}-${idx}`}
              className="flex justify-between gap-2 border-b border-slate-800/50 py-1.5"
            >
              <span className="text-slate-400 truncate">
                {g.date || '—'}
                {isPlayer ? ` · ${g.faction || '—'}` : ` · ${g.player || '—'}`}
              </span>
              <span className={`flex-shrink-0 font-mono ${g.isWinner ? 'text-amber-400' : 'text-slate-500'}`}>
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
      <p className="text-[11px] text-slate-500 -mt-1">
        Частота пиков в драфте · {matrix.gamesWithPicks} парт. · насыщенность = число пиков
      </p>
      <div className="overflow-x-auto">
        <table className="text-[10px] border-collapse min-w-full">
          <thead>
            <tr>
              <th className="p-1 text-left text-slate-500 sticky left-0 bg-slate-950 z-10">Фракция</th>
              {cards.map((c) => (
                <th key={c.id} className="p-1 text-center text-slate-500 font-mono w-8" title={c.name}>
                  {c.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factions.map((f) => (
              <tr key={f.key} className="border-t border-slate-800/60">
                <td className="p-1 pr-2 text-slate-300 font-bold truncate max-w-[7rem] sticky left-0 bg-slate-950 z-10">
                  {f.name}
                </td>
                {cards.map((c) => {
                  const cell = cellAt(f.key, c.id);
                  const n = cell?.picks || 0;
                  const intensity = maxPicks > 0 ? n / maxPicks : 0;
                  const title = cell
                    ? `${f.name} · ${c.name}: ${n} пик., WR ${cell.winRate}%`
                    : '';
                  return (
                    <td key={c.id} className="p-0.5">
                      <div
                        className="h-7 min-w-[1.75rem] rounded-md flex items-center justify-center font-mono text-[10px] border border-slate-800/80"
                        style={{
                          backgroundColor: n
                            ? `rgba(34, 211, 238, ${0.12 + intensity * 0.75})`
                            : 'rgba(15, 23, 42, 0.5)',
                          color: n ? '#a5f3fc' : '#334155',
                        }}
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
      <p className="text-[11px] text-slate-500 -mt-1">
        Сумма времени фаз действий · ср. {formatAvgTime(avgSeconds)} на партию
      </p>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto modal-scroll">
        {trend.map((row) => (
          <li key={row.id} className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-500 w-20 truncate flex-shrink-0">{row.date || '—'}</span>
            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500/80"
                style={{ width: `${(row.actionSeconds / maxSec) * 100}%` }}
              />
            </div>
            <span className="font-mono text-slate-400 w-14 text-right flex-shrink-0">
              {formatTime(row.actionSeconds)}
            </span>
            <span className="text-slate-600 w-8 text-right flex-shrink-0">{row.rounds}R</span>
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
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold uppercase text-slate-500">Сравнить</span>
        {['player', 'faction'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setSelected([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === m
                ? 'bg-purple-950/70 text-purple-300 border border-purple-700/50'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            {m === 'player' ? 'Игроков' : 'Фракции'}
          </button>
        ))}
        <span className="text-[10px] text-slate-600 ml-auto">до 3</span>
      </div>

      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto modal-scroll">
        {options.map((o) => {
          const active = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                active
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <p className="text-sm text-slate-500 text-center py-8">Выберите минимум двух для сравнения.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                <th className="py-2 pr-3">Метрика</th>
                {profiles.map((p) => (
                  <th key={p.key} className="py-2 text-center px-2">
                    <button
                      type="button"
                      className="text-cyan-300 hover:text-white font-bold"
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
                <tr key={m.label} className="border-b border-slate-800/50">
                  <td className="py-2 text-slate-500">{m.label}</td>
                  {profiles.map((p) => (
                    <td key={p.key} className="py-2 text-center font-mono text-slate-200 px-2">
                      {m.get(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-slate-800/50">
                <td className="py-2 text-slate-500">Цели (ср.)</td>
                {profiles.map((p) => (
                  <td key={p.key} className="py-2 text-center text-amber-300/90 px-2">
                    {p.vpMix?.gamesWithDetail ? p.vpMix.avgObjectives : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 text-slate-500">Секретки (ср.)</td>
                {profiles.map((p) => (
                  <td key={p.key} className="py-2 text-center text-violet-300/90 px-2">
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

function AnalyticsTables({ analytics, onOpenPlayer, onOpenFaction, durationTrend, avgDurationSec, factionMatrix }) {
  const {
    players, factions, objectives, strategy, vpSources, techs, politics, strategyExecution,
  } = analytics;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <DurationTrendChart trend={durationTrend} avgSeconds={avgDurationSec} />
        <VpMixBars vpMix={vpSources} title="Состав ПО (компания)" />
      </div>

      <FactionStrategyHeatmap matrix={factionMatrix} />

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Пики стратегий"
          icon="fa-chart-simple"
          empty={!strategy.cards?.length ? 'Нет данных о драфте.' : null}
        >
          <BarList
            items={(strategy.cards || []).slice(0, 8).map((c) => ({
              id: c.cardId,
              label: c.name,
              value: c.picks,
              right: `WR ${c.winRateWhenPicked}%`,
              color: 'bg-amber-500',
            }))}
          />
        </Section>
      </div>

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
            <p className="text-[11px] text-slate-500 -mt-1">
              На основе {techs.gamesWithTechs} парт. с зафиксированными техами
            </p>
            <BarList
              items={(techs.top || []).map((t) => ({
                id: t.id,
                label: t.name,
                value: t.games,
                right: `WR ${t.winRate}%`,
                color: 'bg-sky-500',
              }))}
            />
          </>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
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
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-500">Партий с политикой</span>
                <span className="font-mono">{politics.gamesWithPolitics}</span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-500">WR спикера = победитель</span>
                <span className="font-orbitron text-cyan-400">{politics.speakerWinRate}%</span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-1.5">
                <span className="text-slate-500">Ср. законов / партия</span>
                <span className="font-mono">{politics.avgAgendasPerGame}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-500">Закон «1 голос»</span>
                <span className="font-mono">{politics.oneVoteGames} парт.</span>
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
              <p className="text-[11px] text-slate-500 -mt-1">
                Primary + secondary · {strategyExecution.gamesWithPlays} парт.
              </p>
              <BarList
                items={(strategyExecution.cards || []).slice(0, 8).map((c) => ({
                  id: c.cardId,
                  label: c.name.replace(/^\d+\.\s*/, ''),
                  value: c.primaryPlays,
                  right: `2° ${c.secondaryPlays}/${c.secondaryPlays + c.secondaryPasses}`,
                  color: 'bg-purple-500',
                }))}
              />
            </>
          )}
        </Section>
      </div>

      <Section title="Игроки" icon="fa-users" empty={players.length === 0 ? 'Нет данных об игроках.' : null}>
        <p className="text-[11px] text-slate-500 -mt-1">Нажмите имя, чтобы открыть профиль</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                <th className="py-2 pr-2">Игрок</th>
                <th className="py-2 text-center">Игр</th>
                <th className="py-2 text-center">Поб.</th>
                <th className="py-2 text-center">WR</th>
                <th className="py-2 text-center">Ср. ПО</th>
                <th className="py-2 text-center">Урон</th>
                <th className="py-2 text-center">BT%</th>
                <th className="py-2 text-right">Ср. время</th>
                <th className="py-2 text-right">Ср. / раунд</th>
                <th className="py-2 text-center">Хран.</th>
                <th className="py-2 text-center">Элим.</th>
                <th className="py-2 text-left pl-2">Фракции</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.key} className="border-b border-slate-800/50 align-top">
                  <td className="py-2.5 font-bold pr-2">
                    <button
                      type="button"
                      onClick={() => onOpenPlayer?.(p.key)}
                      className="text-white hover:text-cyan-300 transition"
                    >
                      {p.name}
                    </button>
                  </td>
                  <td className="py-2.5 text-center text-slate-400">{p.games}</td>
                  <td className="py-2.5 text-center text-amber-400 font-bold">{p.wins}</td>
                  <td className="py-2.5 text-center font-orbitron text-cyan-400">{p.winRate}%</td>
                  <td className="py-2.5 text-center text-slate-300">{p.avgScore}</td>
                  <td className="py-2.5 text-center text-red-400/90">{p.avgDamage}</td>
                  <td className="py-2.5 text-center text-violet-300">{p.breakthroughRate}%</td>
                  <td className="py-2.5 text-right font-mono text-slate-300">{formatAvgTime(p.avgGameTime)}</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">{formatAvgTime(p.avgTurnTime)}</td>
                  <td className="py-2.5 text-center text-cyan-400/80">{p.custodiansGames || '—'}</td>
                  <td className="py-2.5 text-center text-slate-400">
                    {p.avgElimRound != null ? p.avgElimRound : '—'}
                  </td>
                  <td className="py-2.5 text-left text-[11px] text-slate-400 pl-2 max-w-[180px]">
                    {p.factions.slice(0, 3).map((f) => (
                      <div key={f.id || f.name} className="truncate">
                        <button
                          type="button"
                          onClick={() => onOpenFaction?.(f.id || String(f.name || '').toLowerCase())}
                          className="hover:text-cyan-300 transition"
                        >
                          {f.name}
                        </button>
                        <span className="text-slate-600"> · {f.games}/{f.wins}</span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Фракции" icon="fa-planet-ringed" empty={factions.length === 0 ? 'Нет данных о фракциях.' : null}>
        <p className="text-[11px] text-slate-500 -mt-1">Нажмите название, чтобы открыть профиль</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                <th className="py-2">Фракция</th>
                <th className="py-2 text-center">Пиков</th>
                <th className="py-2 text-center">Поб.</th>
                <th className="py-2 text-center">WR</th>
                <th className="py-2 text-center">Ср. ПО</th>
                <th className="py-2 text-center">Урон</th>
                <th className="py-2 text-center">BT%</th>
                <th className="py-2 text-center">Ср. раунд</th>
                <th className="py-2 text-right">Ср. время</th>
              </tr>
            </thead>
            <tbody>
              {factions.map((f) => (
                <tr key={f.key} className="border-b border-slate-800/50">
                  <td className="py-2.5 font-bold">
                    <button
                      type="button"
                      onClick={() => onOpenFaction?.(f.key)}
                      className="text-slate-200 hover:text-cyan-300 transition"
                    >
                      {f.name}
                    </button>
                  </td>
                  <td className="py-2.5 text-center text-slate-400">{f.picks}</td>
                  <td className="py-2.5 text-center text-amber-400 font-bold">{f.wins}</td>
                  <td className="py-2.5 text-center font-orbitron text-emerald-400">{f.winRate}%</td>
                  <td className="py-2.5 text-center text-slate-300">{f.avgVp}</td>
                  <td className="py-2.5 text-center text-red-400/90">{f.avgDamage}</td>
                  <td className="py-2.5 text-center text-violet-300">{f.breakthroughRate}%</td>
                  <td className="py-2.5 text-center text-slate-400">{f.avgRounds}</td>
                  <td className="py-2.5 text-right font-mono text-slate-300">{formatAvgTime(f.avgGameTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Section
          title="Цели — чаще всего"
          icon="fa-bullseye"
          empty={objectives.mostScored.length === 0 ? 'Нет данных по целям.' : null}
        >
          <ul className="space-y-1.5 text-xs">
            {objectives.mostScored.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 border-b border-slate-800/60 py-1.5">
                <span className="text-slate-200 truncate" title={o.title}>{o.title}</span>
                <span className="text-slate-500 flex-shrink-0">
                  {o.scoreEvents}× · {o.scoreRatePct}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section
          title="Цели — редко"
          icon="fa-ghost"
          empty={objectives.rarelyScored.length === 0 ? 'Нет данных по целям.' : null}
        >
          <ul className="space-y-1.5 text-xs">
            {objectives.rarelyScored.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 border-b border-slate-800/60 py-1.5">
                <span className="text-slate-200 truncate" title={o.title}>{o.title}</span>
                <span className="text-slate-500 flex-shrink-0">
                  {o.revealed} показ. · {o.scoreRatePct}%
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section
        title="Карты стратегий"
        icon="fa-layer-group"
        empty={
          strategy.gamesWithPicks === 0
            ? 'Нет данных о драфте стратегий. Появятся после новых партий (сбор strategyPicks).'
            : null
        }
      >
        {strategy.gamesWithPicks > 0 && (
          <div className="overflow-x-auto">
            <p className="text-[11px] text-slate-500 mb-2">
              На основе {strategy.gamesWithPicks} парт. с историей драфта
            </p>
            <table className="w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                  <th className="py-2">Карта</th>
                  <th className="py-2 text-center">Пиков</th>
                  <th className="py-2 text-center">Ср. раунд</th>
                  <th className="py-2 text-right">WR при пике</th>
                </tr>
              </thead>
              <tbody>
                {strategy.cards.map((c) => (
                  <tr key={c.cardId} className="border-b border-slate-800/50">
                    <td className="py-2.5 font-bold text-slate-200">{c.name}</td>
                    <td className="py-2.5 text-center text-slate-400">{c.picks}</td>
                    <td className="py-2.5 text-center text-slate-300">
                      {c.avgRoundPicked != null ? c.avgRoundPicked : '—'}
                    </td>
                    <td className="py-2.5 text-right font-orbitron text-cyan-400">{c.winRateWhenPicked}%</td>
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
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-slate-500 uppercase border-b border-slate-800">
              <th className="py-1.5 pr-2">Игрок</th>
              <th className="py-1.5">Фракция</th>
              <th className="py-1.5 text-center">ПО</th>
              <th className="py-1.5 text-left">Состав</th>
              <th className="py-1.5 text-center">Секр.</th>
              <th className="py-1.5 text-center">Урон</th>
              <th className="py-1.5 text-center">BT</th>
              <th className="py-1.5 text-right">Время</th>
            </tr>
          </thead>
          <tbody>
            {[...(game.players || [])]
              .sort((a, b) => (b.score || 0) - (a.score || 0))
              .map((p) => (
                <tr key={p.name} className="border-b border-slate-800/40">
                  <td className={`py-1.5 font-bold pr-2 ${p.isWinner ? 'text-amber-400' : 'text-slate-200'}`}>
                    {p.name}
                    {p.eliminated && <span className="ml-1 text-rose-400/80 font-normal">элим.</span>}
                  </td>
                  <td className="py-1.5 text-slate-400">{p.faction || '—'}</td>
                  <td className="py-1.5 text-center font-orbitron text-cyan-400">{p.score}</td>
                  <td className="py-1.5"><ScoreBreakdownInline breakdown={p.scoreBreakdown} /></td>
                  <td className="py-1.5 text-center text-violet-300/90 font-mono">
                    {p.secretsScoredVp > 0 || p.secretsHeld > 0
                      ? `${p.secretsScoredVp ?? 0}/${p.secretsHeld ?? 0}`
                      : '—'}
                  </td>
                  <td className="py-1.5 text-center text-red-400">{p.damageDealt || 0}</td>
                  <td className="py-1.5 text-center text-violet-300">{p.breakthrough ? '✓' : '—'}</td>
                  <td className="py-1.5 text-right font-mono text-slate-400">{formatTime(p.totalTime || 0)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {scoredObjectives.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Заскоренные цели</div>
          <ul className="space-y-1 text-[11px]">
            {scoredObjectives.map((o) => (
              <li key={o.id} className="flex justify-between gap-2 text-slate-300">
                <span className="truncate">{o.title}</span>
                <span className="text-slate-500 flex-shrink-0">{(o.scoredBy || []).join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picksByRound.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Драфт стратегий</div>
          <div className="space-y-2">
            {picksByRound.map(([round, picks]) => (
              <div key={round} className="text-[11px]">
                <div className="text-slate-500 font-bold mb-0.5">Раунд {round}</div>
                <div className="flex flex-wrap gap-1.5">
                  {picks.map((pick, idx) => (
                    <span
                      key={`${round}-${pick.cardId}-${pick.player}-${idx}`}
                      className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {cardNameById.get(pick.cardId) || `#${pick.cardId}`}
                      <span className="text-slate-600"> · {pick.player}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(game.supports || []).length > 0 && (
        <div className="text-[11px] text-slate-400">
          <span className="text-slate-500 font-bold uppercase text-[10px] mr-2">Support</span>
          {game.supports.map((s) => `${s.from} → ${s.holder}`).join(' · ')}
        </div>
      )}

      {game.politics?.finalSpeaker && (
        <div className="text-[11px] space-y-1.5">
          <div className="text-[10px] font-bold uppercase text-slate-500">Политика</div>
          <div className="text-slate-300">
            Спикер: <span className="text-cyan-300 font-bold">{game.politics.finalSpeaker}</span>
            {game.politics.oneVoteLaw && (
              <span className="ml-2 text-amber-400/90">· закон 1 голос</span>
            )}
          </div>
          {(game.politics.agendas || []).length > 0 && (
            <ul className="space-y-1 text-slate-400">
              {game.politics.agendas.map((a) => (
                <li key={a.index} className="flex justify-between gap-2">
                  <span className="truncate">{a.label}</span>
                  <span className="flex-shrink-0 font-mono text-slate-500">
                    {a.for}/{a.against} · {a.voters} гол.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(game.strategyPlays || []).length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Розыгрыш стратегий</div>
          <ul className="space-y-1 text-[11px] text-slate-400 max-h-40 overflow-y-auto modal-scroll">
            {game.strategyPlays.map((play, idx) => (
              <li key={`${play.round}-${play.cardId}-${play.player}-${idx}`} className="flex justify-between gap-2">
                <span className="truncate text-slate-300">
                  {play.round != null && <span className="text-slate-600">R{play.round} · </span>}
                  {play.card?.replace(/^\d+\.\s*/, '') || play.card}
                </span>
                <span className="flex-shrink-0">
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
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Время по раундам</div>
          <div className="flex flex-wrap gap-1.5">
            {game.roundTimes.map((entry) => (
              <span
                key={entry.round}
                className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300/90"
              >
                R{entry.round}: {formatTime(entry.seconds || 0)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(game.eventDigest || []).length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Журнал (фрагмент)</div>
          <ul className="space-y-0.5 text-[10px] text-slate-500 max-h-36 overflow-y-auto modal-scroll font-mono">
            {game.eventDigest.slice(-20).map((e, idx) => (
              <li key={`${e.type}-${e.at}-${idx}`} className="truncate">
                {e.round != null && <span className="text-slate-600">R{e.round} </span>}
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(game.players || []).some((p) => (p.techs || []).length > 0) && (
        <div>
          <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">Технологии</div>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {(game.players || [])
              .filter((p) => (p.techs || []).length > 0)
              .map((p) => (
                <li key={p.name}>
                  <span className="text-slate-300 font-bold">{p.name}:</span>{' '}
                  {formatTechList(p.techs)}
                </li>
              ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
        onClick={() => {
          try {
            navigator.clipboard.writeText(buildShareCardText(game));
          } catch {
            /* ignore */
          }
        }}
      >
        <i className="fa-solid fa-share-nodes mr-1" aria-hidden="true" />
        Скопировать карточку партии
      </button>
    </div>
  );
}

function HistoryList({ globalHistory, deleteSingleGame }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-3">
      {globalHistory.map((g) => {
        const open = expandedId === g.id;
        return (
          <div key={g.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2 gap-2">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : g.id)}
                className="text-left min-w-0 flex-1 hover:text-white transition"
              >
                <span className="font-bold text-white">{g.date}</span>
                <span className="text-slate-500 ml-2">
                  ({g.roundsCount} раунд., {g.playerCount || (g.players || []).length} игр., цель {g.targetScore} ПО)
                </span>
                {(g.expansions?.pok || g.expansions?.te) && (
                  <span className="ml-2 text-slate-500">
                    {[g.expansions.pok && 'PoK', g.expansions.te && 'TE'].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="ml-2 text-slate-600">
                  <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-[10px]`} aria-hidden="true" />
                </span>
              </button>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-amber-400 font-bold">
                  🏆 {g.winner}{g.winningFaction ? ` (${g.winningFaction})` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSingleGame(g.id)}
                  className="text-slate-600 hover:text-red-400 p-1 transition"
                  title="Удалить партию (Требуется PIN)"
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true" />
                </button>
              </div>
            </div>
            {(g.teController || g.custodians || (g.objectives && g.objectives.length > 0)) && (
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                {g.teController && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/60 text-amber-300">
                    TE: {g.teController.name}
                  </span>
                )}
                {g.custodians && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-800/60 text-cyan-300">
                    Хранители: {g.custodians}
                  </span>
                )}
                {(g.objectives || []).filter((o) => (o.scoredBy || []).length > 0).slice(0, 4).map((o) => (
                  <span
                    key={o.id}
                    className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 truncate max-w-[160px]"
                    title={o.title}
                  >
                    {o.title}
                  </span>
                ))}
              </div>
            )}
            {!open && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {(g.players || []).map((p, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 p-1.5 rounded-lg border border-slate-800/50 flex items-center justify-between gap-1"
                  >
                    <span className="text-slate-300 truncate">{p.name}</span>
                    <span className="font-mono text-slate-400 flex-shrink-0">
                      {p.score} ПО
                      {p.damageDealt > 0 && <span className="text-red-400/80 ml-1">⚔{p.damageDealt}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {open && <GameDetail game={g} />}
          </div>
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
  deleteSingleGame,
  clearAllStats,
}) {
  useEscapeKey(() => onBack?.(), true);
  const [tab, setTab] = useState('analytics');
  const [filters, setFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [profileTarget, setProfileTarget] = useState(null);

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

  const openPlayer = (key) => {
    setTab('analytics');
    setProfileTarget({ type: 'player', key });
  };
  const openFaction = (key) => {
    setTab('analytics');
    setProfileTarget({ type: 'faction', key });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-20 border-b border-purple-500/30 bg-slate-950/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад к игре"
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-bold transition"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            <span>Назад</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 id="stats-page-title" className="font-orbitron font-black text-lg md:text-2xl text-purple-400 uppercase truncate">
              Статистика Компании
            </h1>
            <p className="text-[11px] md:text-xs text-slate-500 truncate">
              Аналитика игроков, фракций, целей и стратегий · {analytics.gameCount} парт.
              {filteredHistory.length !== globalHistory.length && (
                <span> (из {globalHistory.length})</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-5">
        {isStatsLoading ? (
          <div className="text-center py-16 text-slate-400 font-orbitron">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-purple-400" aria-hidden="true" />
            <div>Загрузка данных из облака...</div>
          </div>
        ) : globalHistory.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            {isCloudConfigured
              ? 'История игр пока пуста. Завершите хотя бы одну партию!'
              : 'Облачная статистика выключена (VITE_CLOUD_ENABLED=false).'}
          </div>
        ) : (
          <div className="space-y-5">
            <FilterBar
              filters={filters}
              onChange={(next) => {
                setFilters(next);
                setProfileTarget(null);
              }}
              filteredCount={filteredHistory.length}
              totalCount={globalHistory.length}
            />
            <ExportBar history={filteredHistory} />

            <div className="flex gap-2 border-b border-slate-800 pb-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    if (t.id !== 'analytics') setProfileTarget(null);
                  }}
                  className={`px-4 py-2 rounded-t-xl text-xs font-orbitron font-bold uppercase tracking-wide transition flex-shrink-0 ${
                    tab === t.id
                      ? 'bg-purple-950/60 text-purple-300 border border-b-0 border-purple-700/50'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Нет партий по выбранным фильтрам.
              </div>
            ) : tab === 'analytics' ? (
              profile ? (
                <ProfilePanel
                  profile={profile}
                  onBack={() => setProfileTarget(null)}
                  onOpenPlayer={openPlayer}
                  onOpenFaction={openFaction}
                />
              ) : (
                <AnalyticsTables
                  analytics={analytics}
                  onOpenPlayer={openPlayer}
                  onOpenFaction={openFaction}
                  durationTrend={durationTrend}
                  avgDurationSec={avgDurationSec}
                  factionMatrix={factionMatrix}
                />
              )
            ) : tab === 'compare' ? (
              <CompareTab
                history={filteredHistory}
                analytics={analytics}
                onOpenPlayer={openPlayer}
                onOpenFaction={openFaction}
              />
            ) : (
              <HistoryList globalHistory={filteredHistory} deleteSingleGame={deleteSingleGame} />
            )}

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={clearAllStats}
                className="bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/60 text-xs px-4 py-2 rounded-xl transition flex items-center gap-2"
              >
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>Сбросить всю статистику (PIN)</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** @deprecated Use StatsPage — kept for import compatibility. */
export const StatsModal = StatsPage;
