import { useEffect, useMemo, useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  TECH_COLOR_META,
  TECH_COLORS,
  availableTechs,
  canResearch,
  maxResearchSlots,
  prereqGapMessage,
  synergyForPlayer,
  techById,
} from '../data/technologies';
import { BreakthroughPanel } from './BreakthroughPanel';
import { TechPrereqIcons, TechTypeIcon } from './TechTypeIcon';

const COLOR_BTN = {
  green: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200',
  blue: 'border-sky-500/50 bg-sky-950/40 text-sky-200',
  yellow: 'border-amber-500/50 bg-amber-950/40 text-amber-200',
  red: 'border-rose-500/50 bg-rose-950/40 text-rose-200',
};

const COLOR_OWNED = {
  green: 'bg-emerald-500/25 border-emerald-400 text-emerald-100',
  blue: 'bg-sky-500/25 border-sky-400 text-sky-100',
  yellow: 'bg-amber-500/25 border-amber-400 text-amber-100',
  red: 'bg-rose-500/25 border-rose-400 text-rose-100',
};

/** Tab bucket: faction tech (incl. faction unit upgrades) → color → generic unit. */
function sectionKey(tech) {
  if (tech.factionId || tech.kind === 'faction') return 'faction';
  if (tech.kind === 'unit') return 'unit';
  return tech.color || 'other';
}

/**
 * Research session (strategy 7) or browse/grant panel.
 * Prereq failures open an inline error with Cancel / Planet skip / Host force.
 */
export function TechModal({
  show,
  minimized,
  session = null,
  players = [],
  viewPlayerId = null,
  seatPlayerId = null,
  usePok = false,
  useTe = false,
  canEdit = false,
  canResearchAct = false,
  isHost = false,
  pendingPlayerIds = null,
  onSelectViewPlayer,
  onResearch,
  onPass,
  onGrantTech,
  onRevokeTech,
  onGrantBreakthrough,
  onRevokeBreakthrough,
  onMinimize,
  onClose,
}) {
  const researching = !!session?.active;
  const [tab, setTab] = useState('all');
  const [browseScope, setBrowseScope] = useState('mine'); // 'mine' | 'catalog'
  const [prereqError, setPrereqError] = useState(null);
  useEscapeKey(
    prereqError ? () => setPrereqError(null) : (onMinimize || onClose),
    show && !minimized,
  );
  useBodyScrollLock(show && !minimized);

  useEffect(() => {
    if (show && !session?.active) {
      setBrowseScope('mine');
      setTab('all');
      setPrereqError(null);
    }
  }, [show, session?.active]);

  const focusPlayerId = researching
    ? session.playerId
    : (viewPlayerId ?? seatPlayerId ?? players[0]?.id ?? null);
  const player = players.find(p => p.id === focusPlayerId) || null;
  const owned = useMemo(() => player?.techIds || [], [player?.techIds]);
  const ownedSet = useMemo(() => new Set(owned), [owned]);

  const synergy = synergyForPlayer(player?.factionId, player?.breakthrough, useTe);
  const maxSlots = researching ? maxResearchSlots(session.mode) : 0;
  const picksDone = researching ? (session.picks?.length || 0) : 0;
  const pendingSeats = Array.isArray(pendingPlayerIds)
    ? players.filter(p => pendingPlayerIds.includes(p.id))
    : [];

  const catalog = useMemo(
    () => availableTechs({ usePok, useTe, factionId: player?.factionId }),
    [usePok, useTe, player?.factionId],
  );

  const ownedTechs = useMemo(
    () => owned.map(id => techById(id)).filter(Boolean),
    [owned],
  );

  const colorTabs = [
    { id: 'all', label: 'Все', icon: null },
    ...TECH_COLORS.map(c => ({
      id: c,
      label: TECH_COLOR_META[c].label,
      icon: c,
    })),
    { id: 'unit', label: 'Unit', icon: null },
    { id: 'faction', label: 'Фракция', icon: null },
  ];

  const visibleTechs = useMemo(() => {
    const base = (() => {
      if (researching) {
        if (tab === 'all') return catalog;
        return catalog.filter(t => sectionKey(t) === tab);
      }
      if (browseScope === 'mine') {
        if (tab === 'all') return ownedTechs;
        return ownedTechs.filter(t => sectionKey(t) === tab);
      }
      if (tab === 'all') return catalog;
      return catalog.filter(t => sectionKey(t) === tab);
    })();
    if (tab !== 'faction') return base;
    // Faction tab: color/faction cards first, then faction unit upgrades.
    return [...base].sort((a, b) => {
      const au = a.kind === 'unit' ? 1 : 0;
      const bu = b.kind === 'unit' ? 1 : 0;
      if (au !== bu) return au - bu;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [researching, browseScope, tab, catalog, ownedTechs]);

  if (!show) return null;

  const isMySeat = seatPlayerId != null && seatPlayerId === session?.playerId;
  const canActResearch = researching && !!player && (canResearchAct || isMySeat || isHost);
  const canActToggle = !researching && canEdit && !!player;

  const tryResearch = (techId) => {
    if (!canActResearch || !player) return;
    const tech = techById(techId);
    if (!tech || ownedSet.has(techId)) return;

    const ok = canResearch(tech, owned, {
      synergyColors: synergy,
      ignoreCount: 0,
    });
    if (ok) {
      onResearch?.(session.playerId, techId, { ignorePrereq: false });
      return;
    }

    const okWithPlanet = canResearch(tech, owned, {
      synergyColors: synergy,
      ignoreCount: 1,
    });
    setPrereqError({
      techId,
      techName: tech.name,
      message: prereqGapMessage(tech, owned, { synergyColors: synergy })
        || 'Не выполнены пререквизиты',
      canPlanet: okWithPlanet,
    });
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onMinimize}
        className="fixed z-[60] right-3 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] md:bottom-4 md:right-4 flex items-center gap-2 rounded-xl border border-sky-500 bg-slate-900/95 px-4 py-2.5 text-xs font-bold text-sky-300 shadow-lg"
      >
        <i className="fa-solid fa-atom" aria-hidden="true" />
        <span>Технологии</span>
      </button>
    );
  }

  const costHint = researching
    ? (session.mode === 'primary'
      ? (session.brilliant
        ? (picksDone === 0
          ? 'Brilliant: primary вместо secondary · 1 бесплатно · 2-я за 6 ресурсов'
          : 'Можно взять 2-ю за 6 ресурсов или «Готово»')
        : (picksDone === 0
          ? 'Primary: 1 бесплатно · 2-я за 6 ресурсов (учёт вручную)'
          : 'Можно взять 2-ю за 6 ресурсов или «Готово»'))
      : 'Secondary: 1 технология за 4 ресурса · или «Пропуск»')
    : null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-modal-title"
        className="flex flex-col w-full h-full max-h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-2xl bg-slate-950 md:rounded-3xl md:border md:border-sky-500/40 shadow-2xl"
      >
        <header className="flex-shrink-0 px-4 md:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400/90">
                {researching
                  ? (session.brilliant
                    ? 'Стратегия · Технологии · Brilliant (Primary)'
                    : session.mode === 'primary'
                      ? 'Стратегия · Технологии · Primary'
                      : 'Стратегия · Технологии · Secondary')
                  : 'Технологии'}
              </div>
              <h2
                id="tech-modal-title"
                className="font-orbitron font-black text-xl md:text-2xl text-sky-100 leading-tight mt-0.5 truncate"
              >
                {researching
                  ? (player?.name || '…')
                  : (browseScope === 'mine' ? 'Мои технологии' : 'Все технологии')}
              </h2>
              {costHint && (
                <p className="text-xs text-slate-400 mt-1 leading-snug">{costHint}</p>
              )}
            </div>
            {onMinimize && (
              <button
                type="button"
                onClick={onMinimize}
                className="text-slate-500 hover:text-white transition p-2 -mr-1 flex-shrink-0"
                aria-label="Свернуть"
              >
                <i className="fa-solid fa-window-minimize" aria-hidden="true" />
              </button>
            )}
          </div>

          {useTe && player?.factionId && (
            <div className="mt-3">
              <BreakthroughPanel
                factionId={player.factionId}
                unlocked={!!player.breakthrough}
                defaultOpen={false}
                canToggle={!!isHost && typeof onGrantBreakthrough === 'function'}
                onToggle={(enable) => {
                  if (enable) onGrantBreakthrough?.(player.id);
                  else onRevokeBreakthrough?.(player.id);
                }}
              />
            </div>
          )}

          {!researching && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setBrowseScope('mine'); setTab('all'); }}
                className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border transition ${
                  browseScope === 'mine'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                Мои
                <span className="ml-1 opacity-70 normal-case">{owned.length}</span>
              </button>
              <button
                type="button"
                onClick={() => { setBrowseScope('catalog'); setTab('all'); }}
                className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border transition ${
                  browseScope === 'catalog'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-400'
                }`}
              >
                Все технологии
              </button>
            </div>
          )}

          {researching && pendingSeats.length > 1 && isHost && onSelectViewPlayer && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto">
              {pendingSeats.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectViewPlayer(p.id)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                    p.id === focusPlayerId
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {researching && (
            <div className="mt-3 text-xs text-slate-400">
              Слоты: {picksDone}/{maxSlots}
            </div>
          )}
        </header>

        {(researching || browseScope === 'catalog') && (
          <div className="flex-shrink-0 px-4 md:px-6 pt-3 flex gap-1.5 overflow-x-auto">
            {colorTabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                title={t.label}
                className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition ${
                  tab === t.id
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-800 bg-slate-900/80 text-slate-500'
                }`}
              >
                {t.icon ? <TechTypeIcon color={t.icon} size={18} /> : t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 md:px-6 py-4 space-y-2 modal-scroll">
          {!visibleTechs.length && (
            <p className="text-sm text-slate-500 text-center py-10">
              {browseScope === 'mine' && !researching
                ? 'Пока нет изученных технологий'
                : 'Нет технологий в этом разделе'}
            </p>
          )}
          {visibleTechs.map(tech => {
            const has = ownedSet.has(tech.id);
            const researchable = researching && canResearch(tech, owned, {
              synergyColors: synergy,
              ignoreCount: 0,
            });
            const almost = researching && !researchable && !has && canResearch(tech, owned, {
              synergyColors: synergy,
              ignoreCount: 1,
            });
            const baseCls = has
              ? (COLOR_OWNED[tech.color] || 'bg-slate-700/40 border-slate-500 text-slate-100')
              : (COLOR_BTN[tech.color] || 'border-slate-700 bg-slate-900/60 text-slate-300');

            const interactive = researching
              ? (canActResearch && !has)
              : (canActToggle && (browseScope === 'catalog' || has));

            return (
              <button
                key={tech.id}
                type="button"
                disabled={researching && !interactive}
                onClick={() => {
                  if (!interactive) return;
                  if (researching) tryResearch(tech.id);
                  else if (has) onRevokeTech?.(player.id, tech.id);
                  else onGrantTech?.(player.id, tech.id);
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl border transition ${baseCls} ${
                  researching && (researchable || almost) && !has
                    ? 'ring-1 ring-cyan-400/40'
                    : ''
                } ${interactive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'} ${
                  researching && !interactive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm leading-snug">{tech.name}</div>
                    {tech.text && (
                      <p className="text-[11px] opacity-70 mt-0.5 leading-snug line-clamp-2">{tech.text}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-90">
                      {tech.color ? (
                        <span className="inline-flex items-center gap-1 normal-case">
                          <TechTypeIcon color={tech.color} size={16} />
                          <span className="opacity-70">{TECH_COLOR_META[tech.color]?.label}</span>
                        </span>
                      ) : tech.factionId ? (
                        <span>{tech.kind === 'unit' ? 'Фракция · Unit' : 'Фракция'}</span>
                      ) : (
                        <span>{tech.kind === 'unit' ? 'Unit' : tech.kind}</span>
                      )}
                      {tech.omega && <span>Ω</span>}
                      {tech.prereqs?.length > 0 && (
                        <span className="inline-flex items-center gap-1 normal-case opacity-80">
                          <span className="opacity-60">Пререк</span>
                          <TechPrereqIcons prereqs={tech.prereqs} size={15} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[11px] font-bold">
                    {has ? '✓' : researching ? (researchable ? 'Взять' : almost ? '!' : '') : (canActToggle && browseScope === 'catalog' ? '+' : '')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <footer className="flex-shrink-0 px-4 md:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-800 flex gap-2">
          {researching ? (
            <button
              type="button"
              disabled={!canActResearch}
              onClick={() => canActResearch && onPass?.(session.playerId)}
              className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-sm transition"
            >
              {session.mode === 'secondary' && picksDone === 0 ? 'Пропуск' : 'Готово'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition"
            >
              Закрыть
            </button>
          )}
        </footer>
      </div>

      {prereqError && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-labelledby="prereq-error-title"
            className="w-full max-w-md rounded-2xl border border-rose-500/50 bg-slate-950 p-5 shadow-2xl space-y-4"
          >
            <div>
              <h3 id="prereq-error-title" className="font-orbitron font-black text-rose-200 text-lg">
                Нельзя изучить
              </h3>
              <p className="text-sm text-slate-300 mt-2">
                <span className="font-bold text-white">{prereqError.techName}</span>
                {' — '}
                {prereqError.message}
              </p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Обход: метка tech на планете (игнор 1 пререка) или уже исследованные цвета.
                Хост может добавить технологию вручную вне карты.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {prereqError.canPlanet && (
                <button
                  type="button"
                  onClick={() => {
                    onResearch?.(session.playerId, prereqError.techId, { ignorePrereq: true });
                    setPrereqError(null);
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-sm"
                >
                  Игнор 1 пререка (планета / метка)
                </button>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    onResearch?.(session.playerId, prereqError.techId, { force: true });
                    setPrereqError(null);
                  }}
                  className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm"
                >
                  Хост: добавить всё равно
                </button>
              )}
              <button
                type="button"
                onClick={() => setPrereqError(null)}
                className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
