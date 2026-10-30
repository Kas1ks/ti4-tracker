import { useState } from 'react';
import {
  TECH_COLOR_META,
  TECH_COLORS,
  availableTechs,
  techArtUrl,
  techById,
} from '../data/technologies';
import { agendaEffectText } from '../data/agendas';
import { lawsOwnedByPlayer } from '../game/agendaDeck';
import { TechPrereqIcons, TechTypeIcon } from './TechTypeIcon';
import { BreakthroughPanel } from './BreakthroughPanel';

/** Compact owned tech-type icons for a player's board / table. */
export function TechPips({ techIds = [] }) {
  const counts = { green: 0, blue: 0, yellow: 0, red: 0 };
  let units = 0;
  for (const id of techIds) {
    const tech = techById(id);
    if (!tech) continue;
    if (tech.kind === 'unit') units += 1;
    else if (tech.color && counts[tech.color] != null) counts[tech.color] += 1;
  }
  const total = techIds.length;
  if (total === 0) return <span className="text-[10px] text-slate-600">0 tech</span>;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums" title={`${total} tech`}>
      {TECH_COLORS.map(c => (
        counts[c] > 0 ? (
          <span key={c} className="inline-flex items-center gap-0.5 rounded bg-slate-800/80 px-1 py-0.5">
            <TechTypeIcon color={c} size={12} />
            <span className="text-slate-300">{counts[c]}</span>
          </span>
        ) : null
      ))}
      {units > 0 && (
        <span className="px-1 rounded bg-slate-700 text-slate-300">U{units}</span>
      )}
    </span>
  );
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

/** Read-only mobile table → player sheet: Technologies (default) + Laws. */
export function PlayerTechSheet({ player, usePok, useTe, activeLaws = [], onClose }) {
  const [sheetTab, setSheetTab] = useState('tech');
  const [expandedId, setExpandedId] = useState(null);
  const owned = player?.techIds || [];
  const catalog = availableTechs({
    usePok,
    useTe,
    factionId: player?.factionId,
  });
  const list = owned
    .map(id => techById(id) || catalog.find(t => t.id === id))
    .filter(Boolean);
  const playerLaws = lawsOwnedByPlayer(activeLaws, player?.id);

  return (
    <div className="fixed inset-0 z-[55] bg-black/85 backdrop-blur-md flex flex-col tech-overlay is-open">
      <div className="tech-shell is-open flex flex-col w-full h-full max-h-[100dvh] overflow-hidden">
        <header className="tech-shell-head flex-shrink-0">
          <div className="tech-shell-head-main min-w-0">
            <div className="tech-shell-eyebrow">Карточка игрока</div>
            <h2 className="tech-shell-title truncate">{player?.name || '…'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tech-icon-btn"
            aria-label="Закрыть"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>

        <div className="tech-sheet-tabs" role="tablist" aria-label="Разделы игрока">
          <button
            type="button"
            role="tab"
            aria-selected={sheetTab === 'tech'}
            onClick={() => setSheetTab('tech')}
            className={`tech-sheet-tab ${sheetTab === 'tech' ? 'is-active' : ''}`}
          >
            <i className="fa-solid fa-atom" aria-hidden="true" />
            Технологии
            {list.length > 0 && <span className="tech-sheet-tab-count">{list.length}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sheetTab === 'laws'}
            onClick={() => setSheetTab('laws')}
            className={`tech-sheet-tab ${sheetTab === 'laws' ? 'is-active' : ''}`}
          >
            <i className="fa-solid fa-scroll" aria-hidden="true" />
            Законы
            {playerLaws.length > 0 && <span className="tech-sheet-tab-count">{playerLaws.length}</span>}
          </button>
        </div>

        <div className="tech-shell-body min-h-0 flex-1 overflow-y-auto overscroll-y-contain modal-scroll">
          {sheetTab === 'tech' ? (
            <>
              {useTe && player?.factionId && (
                <div className="mb-3">
                  <BreakthroughPanel
                    factionId={player.factionId}
                    unlocked={!!player.breakthrough}
                    defaultOpen={!!player.breakthrough}
                  />
                </div>
              )}
              {!list.length && (
                <p className="tech-empty">Пока нет технологий</p>
              )}
              <ul className="tech-card-list">
                {list.map(tech => {
                  const expanded = expandedId === tech.id;
                  return (
                    <li key={tech.id}>
                      <div
                        className={[
                          'tech-card',
                          `color-${tech.color || 'neutral'}`,
                          'is-owned',
                          expanded ? 'is-expanded' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="tech-card-main">
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
                          <span className="tech-card-action">Исследована ✓</span>
                        </div>
                        {tech.text && (
                          <button
                            type="button"
                            className="tech-card-expand"
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Свернуть описание' : 'Развернуть описание'}
                            onClick={() => setExpandedId(expanded ? null : tech.id)}
                          >
                            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              {!playerLaws.length && (
                <p className="tech-empty">На этого игрока нет принятых законов</p>
              )}
              <ul className="player-law-list">
                {playerLaws.map((law) => {
                  const effect = agendaEffectText({
                    voteType: law.elect === 'for_against' ? 'FOR_AGAINST' : 'OTHER',
                    forText: law.forText,
                    againstText: law.againstText,
                    text: law.text || law.desc,
                  });
                  return (
                    <li key={`${law.id}-${law.enactedRound ?? ''}`} className="player-law-card">
                      <div className="player-law-kind">
                        Закон
                        {law.enactedRound != null ? ` · раунд ${law.enactedRound}` : ''}
                      </div>
                      <h3 className="player-law-title">{law.title}</h3>
                      {law.desc && <p className="player-law-desc">{law.desc}</p>}
                      {effect && <p className="player-law-effect">{effect}</p>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <footer className="tech-shell-foot flex-shrink-0">
          <button type="button" onClick={onClose} className="tech-foot-btn tech-foot-btn-primary">
            Закрыть
          </button>
        </footer>
      </div>
    </div>
  );
}
