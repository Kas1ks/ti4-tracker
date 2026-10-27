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
  techArtUrl,
  techById,
} from '../data/technologies';
import { BreakthroughPanel } from './BreakthroughPanel';
import { TechPrereqIcons, TechTypeIcon } from './TechTypeIcon';

/** Tab bucket: faction tech (incl. faction unit upgrades) → color → generic unit. */
function sectionKey(tech) {
  if (tech.factionId || tech.kind === 'faction') return 'faction';
  if (tech.kind === 'unit') return 'unit';
  return tech.color || 'other';
}

function TechCardArt({ tech }) {
  const [broken, setBroken] = useState(false);
  const src = techArtUrl(tech.id);
  const showImg = src && !broken;

  return (
    <div className={`tech-card-art color-${tech.color || 'neutral'}`} aria-hidden="true">
      {showImg ? (
        <img
          src={src}
          alt=""
          className="tech-card-art-img"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="tech-card-art-fallback">
          {tech.color ? (
            <TechTypeIcon color={tech.color} size={28} />
          ) : (
            <i className={`fa-solid ${tech.kind === 'unit' ? 'fa-rocket' : 'fa-flag'}`} />
          )}
        </div>
      )}
      <span className="tech-card-art-badge">
        {tech.color ? (
          <TechTypeIcon color={tech.color} size={16} />
        ) : (
          <i className={`fa-solid ${tech.kind === 'unit' ? 'fa-rocket' : 'fa-flag'}`} />
        )}
      </span>
    </div>
  );
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
  const [expandedId, setExpandedId] = useState(null);
  const [entered, setEntered] = useState(false);

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
      setExpandedId(null);
    }
  }, [show, session?.active]);

  useEffect(() => {
    if (!show || minimized) {
      setEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [show, minimized]);

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
    { id: 'all', label: 'Все', short: 'Все', icon: null },
    ...TECH_COLORS.map(c => ({
      id: c,
      label: TECH_COLOR_META[c].label,
      short: TECH_COLOR_META[c].short,
      icon: c,
    })),
    { id: 'unit', label: 'Unit', short: 'Unit', icon: null },
    { id: 'faction', label: 'Фракция', short: 'Фрак.', icon: null },
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
    const isCabalUnit = player.factionId === 'vuilraith' && tech.kind === 'unit';
    const okWithPlastic = isCabalUnit && canResearch(tech, owned, {
      synergyColors: synergy,
      ignoreCount: Math.max((tech.prereqs || []).length, 1),
    });
    setPrereqError({
      techId,
      techName: tech.name,
      message: prereqGapMessage(tech, owned, { synergyColors: synergy })
        || 'Не выполнены пререквизиты',
      canPlanet: okWithPlanet,
      canPlastic: okWithPlastic,
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

  const eyebrow = researching
    ? (session.brilliant
      ? 'Стратегия · Технологии · Brilliant'
      : session.mode === 'primary'
        ? 'Стратегия · Технологии · Primary'
        : 'Стратегия · Технологии · Secondary')
    : 'Технологии';

  const title = researching
    ? (player?.name || '…')
    : (browseScope === 'mine' ? 'Мои технологии' : 'Все технологии');

  const showFilters = researching || browseScope === 'catalog';

  return (
    <div
      className={`fixed inset-0 z-[55] bg-black/85 backdrop-blur-md flex items-stretch md:items-center justify-center md:p-4 modal-overlay tech-overlay ${entered ? 'is-open' : ''}`}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-modal-title"
        className={`tech-shell flex flex-col w-full h-full max-h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-2xl overflow-hidden ${entered ? 'is-open' : ''}`}
      >
        <header className="tech-shell-head flex-shrink-0">
          <div className="tech-shell-head-main min-w-0">
            <div className="tech-shell-eyebrow">{eyebrow}</div>
            <h2 id="tech-modal-title" className="tech-shell-title">
              {title}
            </h2>
            {costHint && <p className="tech-shell-sub">{costHint}</p>}
          </div>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="tech-icon-btn"
              aria-label="Свернуть"
            >
              <i className="fa-solid fa-window-minimize" aria-hidden="true" />
            </button>
          )}
        </header>

        {useTe && player?.factionId && (
          <div className="tech-shell-breakthrough px-4 md:px-5 pt-2">
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
          <div className="tech-scope-tabs" role="tablist" aria-label="Область технологий">
            <button
              type="button"
              role="tab"
              aria-selected={browseScope === 'mine'}
              onClick={() => { setBrowseScope('mine'); setTab('all'); setExpandedId(null); }}
              className={`tech-scope-tab ${browseScope === 'mine' ? 'is-active' : ''}`}
            >
              Мои
              <span className="tech-scope-count">{owned.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={browseScope === 'catalog'}
              onClick={() => { setBrowseScope('catalog'); setTab('all'); setExpandedId(null); }}
              className={`tech-scope-tab ${browseScope === 'catalog' ? 'is-active' : ''}`}
            >
              Все технологии
            </button>
          </div>
        )}

        {researching && pendingSeats.length > 1 && isHost && onSelectViewPlayer && (
          <div className="tech-pending-seats">
            {pendingSeats.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectViewPlayer(p.id)}
                className={`tech-pending-chip ${p.id === focusPlayerId ? 'is-active' : ''}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {researching && (
          <div className="tech-slots-hint">
            Слоты: {picksDone}/{maxSlots}
          </div>
        )}

        {showFilters && (
          <div className="tech-filters" role="tablist" aria-label="Фильтр технологий">
            {colorTabs.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => { setTab(t.id); setExpandedId(null); }}
                title={t.label}
                className={`tech-filter-chip ${tab === t.id ? 'is-active' : ''}`}
              >
                {t.icon ? <TechTypeIcon color={t.icon} size={22} /> : null}
                <span className="tech-filter-label-full">{t.label}</span>
                <span className="tech-filter-label-short">{t.short}</span>
              </button>
            ))}
          </div>
        )}

        <div className="tech-shell-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain modal-scroll">
          {!visibleTechs.length && (
            <p className="tech-empty">
              {browseScope === 'mine' && !researching
                ? 'Пока нет изученных технологий'
                : 'Нет технологий в этом разделе'}
            </p>
          )}
          <ul className="tech-card-list">
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
              const interactive = researching
                ? (canActResearch && !has)
                : (canActToggle && (browseScope === 'catalog' || has));
              const expanded = expandedId === tech.id;
              const actionLabel = has
                ? 'Исследована ✓'
                : researching
                  ? (researchable ? 'Взять' : almost ? '!' : '')
                  : (canActToggle && browseScope === 'catalog' ? '+' : '');

              return (
                <li key={tech.id}>
                  <div
                    className={[
                      'tech-card',
                      `color-${tech.color || 'neutral'}`,
                      has ? 'is-owned' : '',
                      researchable && !has ? 'is-researchable' : '',
                      almost && !has ? 'is-almost' : '',
                      interactive ? 'is-interactive' : '',
                      researching && !interactive ? 'is-disabled' : '',
                      expanded ? 'is-expanded' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <button
                      type="button"
                      disabled={researching && !interactive}
                      onClick={() => {
                        if (!interactive) return;
                        if (researching) tryResearch(tech.id);
                        else if (has) onRevokeTech?.(player.id, tech.id);
                        else onGrantTech?.(player.id, tech.id);
                      }}
                      className="tech-card-main"
                    >
                      <TechCardArt tech={tech} />
                      <div className="tech-card-body min-w-0">
                        <div className="tech-card-name">{tech.name}</div>
                        {tech.text && (
                          <p className={`tech-card-text ${expanded ? 'is-open' : ''}`}>
                            {tech.text}
                          </p>
                        )}
                        <div className="tech-card-meta">
                          {tech.color ? (
                            <span className="tech-card-tag">
                              <TechTypeIcon color={tech.color} size={14} />
                              {TECH_COLOR_META[tech.color]?.label}
                            </span>
                          ) : tech.factionId ? (
                            <span className="tech-card-tag">
                              {tech.kind === 'unit' ? 'Фракция · Unit' : 'Фракция'}
                            </span>
                          ) : (
                            <span className="tech-card-tag">
                              {tech.kind === 'unit' ? 'Unit' : tech.kind}
                            </span>
                          )}
                          {tech.omega && <span className="tech-card-tag">Ω</span>}
                          {tech.prereqs?.length > 0 && (
                            <span className="tech-card-tag tech-card-prereq">
                              <span className="opacity-60">Пререк</span>
                              <TechPrereqIcons prereqs={tech.prereqs} size={14} />
                            </span>
                          )}
                        </div>
                      </div>
                      {actionLabel && (
                        <span className="tech-card-action">{actionLabel}</span>
                      )}
                    </button>
                    {tech.text && (
                      <button
                        type="button"
                        className="tech-card-expand"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Свернуть описание' : 'Развернуть описание'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expanded ? null : tech.id);
                        }}
                      >
                        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="tech-shell-foot flex-shrink-0">
          {researching ? (
            <button
              type="button"
              disabled={!canActResearch}
              onClick={() => canActResearch && onPass?.(session.playerId)}
              className="tech-foot-btn tech-foot-btn-primary"
            >
              {session.mode === 'secondary' && picksDone === 0 ? 'Пропуск' : 'Готово'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="tech-foot-btn tech-foot-btn-primary"
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
            className="tech-prereq-dialog w-full max-w-md space-y-4"
          >
            <div>
              <h3 id="prereq-error-title" className="tech-prereq-title">
                Нельзя изучить
              </h3>
              <p className="tech-prereq-body">
                <span className="font-bold text-white">{prereqError.techName}</span>
                {' — '}
                {prereqError.message}
              </p>
              <p className="tech-prereq-hint">
                Обход: метка tech на планете (игнор 1 пререка)
                {prereqError.canPlastic
                  ? '; Кабала — вернуть захваченный пластик того же типа (Riftmeld: игнор всех пререков unit upgrade).'
                  : '.'}
                {' '}Хост может добавить технологию вручную вне карты.
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
                  className="tech-prereq-btn tech-prereq-btn-amber"
                >
                  Игнор 1 пререка (планета / метка)
                </button>
              )}
              {prereqError.canPlastic && (
                <button
                  type="button"
                  onClick={() => {
                    onResearch?.(session.playerId, prereqError.techId, { ignoreAll: true });
                    setPrereqError(null);
                  }}
                  className="tech-prereq-btn tech-prereq-btn-rose"
                >
                  Игнор всех пререков (пластик / Riftmeld)
                </button>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    onResearch?.(session.playerId, prereqError.techId, { force: true });
                    setPrereqError(null);
                  }}
                  className="tech-prereq-btn tech-prereq-btn-slate"
                >
                  Хост: добавить всё равно
                </button>
              )}
              <button
                type="button"
                onClick={() => setPrereqError(null)}
                className="tech-prereq-btn tech-prereq-btn-ghost"
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
