import { useMemo, useState } from 'react';
import { formatTime } from '../utils/game';
import { isCloudConfigured } from '../config';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { buildAnalytics } from '../analytics/aggregate';

const TABS = [
  { id: 'analytics', label: 'Аналитика' },
  { id: 'history', label: 'История' },
];

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

function AnalyticsTables({ analytics }) {
  const { players, factions, objectives, strategy } = analytics;

  return (
    <div className="space-y-6">
      <Section title="Игроки" icon="fa-users" empty={players.length === 0 ? 'Нет данных об игроках.' : null}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                <th className="py-2 pr-2">Игрок</th>
                <th className="py-2 text-center">Игр</th>
                <th className="py-2 text-center">Поб.</th>
                <th className="py-2 text-center">WR</th>
                <th className="py-2 text-center">Ср. ПО</th>
                <th className="py-2 text-right">Ср. время</th>
                <th className="py-2 text-right">Ср. / раунд</th>
                <th className="py-2 text-center">Элим.</th>
                <th className="py-2 text-left pl-2">Фракции</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.key} className="border-b border-slate-800/50 align-top">
                  <td className="py-2.5 font-bold text-white pr-2">{p.name}</td>
                  <td className="py-2.5 text-center text-slate-400">{p.games}</td>
                  <td className="py-2.5 text-center text-amber-400 font-bold">{p.wins}</td>
                  <td className="py-2.5 text-center font-orbitron text-cyan-400">{p.winRate}%</td>
                  <td className="py-2.5 text-center text-slate-300">{p.avgScore}</td>
                  <td className="py-2.5 text-right font-mono text-slate-300">{formatAvgTime(p.avgGameTime)}</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">{formatAvgTime(p.avgTurnTime)}</td>
                  <td className="py-2.5 text-center text-slate-400">
                    {p.avgElimRound != null ? p.avgElimRound : '—'}
                  </td>
                  <td className="py-2.5 text-left text-[11px] text-slate-400 pl-2 max-w-[180px]">
                    {p.factions.slice(0, 3).map((f) => (
                      <div key={f.id || f.name} className="truncate">
                        {f.name}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase font-orbitron">
                <th className="py-2">Фракция</th>
                <th className="py-2 text-center">Пиков</th>
                <th className="py-2 text-center">Поб.</th>
                <th className="py-2 text-center">WR</th>
                <th className="py-2 text-center">Ср. ПО</th>
                <th className="py-2 text-center">Ср. раунд</th>
                <th className="py-2 text-right">Ср. время</th>
              </tr>
            </thead>
            <tbody>
              {factions.map((f) => (
                <tr key={f.key} className="border-b border-slate-800/50">
                  <td className="py-2.5 font-bold text-slate-200">{f.name}</td>
                  <td className="py-2.5 text-center text-slate-400">{f.picks}</td>
                  <td className="py-2.5 text-center text-amber-400 font-bold">{f.wins}</td>
                  <td className="py-2.5 text-center font-orbitron text-emerald-400">{f.winRate}%</td>
                  <td className="py-2.5 text-center text-slate-300">{f.avgVp}</td>
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

function HistoryList({ globalHistory, deleteSingleGame }) {
  return (
    <div className="space-y-3">
      {globalHistory.map((g) => (
        <div key={g.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <div>
              <span className="font-bold text-white">{g.date}</span>
              <span className="text-slate-500 ml-2">
                ({g.roundsCount} раунд., цель {g.targetScore} ПО)
              </span>
              {(g.expansions?.pok || g.expansions?.te) && (
                <span className="ml-2 text-slate-500">
                  {[g.expansions.pok && 'PoK', g.expansions.te && 'TE'].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-amber-400 font-bold">
                🏆 {g.winner} ({g.winningFaction})
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            {(g.players || []).map((p, i) => (
              <div
                key={i}
                className="bg-slate-900 p-1.5 rounded-lg border border-slate-800/50 flex items-center justify-between"
              >
                <span className="text-slate-300 truncate">{p.name}</span>
                <span className="font-mono text-slate-400">
                  {p.score} ПО / ⏱{formatTime(p.totalTime || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsModal({
  showStatsModal,
  setShowStatsModal,
  isStatsLoading,
  globalHistory,
  deleteSingleGame,
  clearAllStats,
}) {
  useEscapeKey(() => setShowStatsModal(false), showStatsModal);
  useBodyScrollLock(showStatsModal);
  const [tab, setTab] = useState('analytics');

  const analytics = useMemo(() => buildAnalytics(globalHistory), [globalHistory]);

  if (!showStatsModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 modal-overlay"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
        className="bg-slate-900 border border-purple-500/40 p-6 md:p-8 rounded-3xl max-w-5xl w-full space-y-5 shadow-[0_0_40px_rgba(168,85,247,0.2)] max-h-[90vh] overflow-y-auto relative modal-scroll"
      >
        <button
          type="button"
          onClick={() => setShowStatsModal(false)}
          aria-label="Закрыть статистику"
          className="absolute top-5 right-5 text-slate-400 hover:text-white text-xl"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        <div className="text-center space-y-1 pr-8">
          <h3 id="stats-modal-title" className="font-orbitron font-black text-2xl md:text-3xl text-purple-400 uppercase">
            Статистика Компании
          </h3>
          <p className="text-xs md:text-sm text-slate-400">
            Аналитика игроков, фракций, целей и стратегий · {analytics.gameCount} парт.
          </p>
        </div>

        {isStatsLoading ? (
          <div className="text-center py-12 text-slate-400 font-orbitron">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-purple-400" aria-hidden="true" />
            <div>Загрузка данных из облака...</div>
          </div>
        ) : globalHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {isCloudConfigured
              ? 'История игр пока пуста. Завершите хотя бы одну партию!'
              : 'Облачная статистика выключена (VITE_CLOUD_ENABLED=false).'}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex gap-2 border-b border-slate-800 pb-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-t-xl text-xs font-orbitron font-bold uppercase tracking-wide transition ${
                    tab === t.id
                      ? 'bg-purple-950/60 text-purple-300 border border-b-0 border-purple-700/50'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'analytics' ? (
              <AnalyticsTables analytics={analytics} />
            ) : (
              <HistoryList globalHistory={globalHistory} deleteSingleGame={deleteSingleGame} />
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
      </div>
    </div>
  );
}
