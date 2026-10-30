import { useState } from 'react';
import { TECH_COLOR_META, techArtUrl, techById } from '../data/technologies';
import { TechPrereqIcons, TechTypeIcon } from './TechTypeIcon';

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
 * Multi-select tech list for starting-tech draft (pick / fromOthers / research).
 * Uses the same tech-card UI as TechModal / TechSheet.
 */
export function StartingTechChoice({
  options = [],
  selected = [],
  pickCount = 1,
  onChange,
  locked = false,
  hint = null,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const cap = Math.min(pickCount, options.length || pickCount);
  const ready = selected.length === cap
    || (options.length === 0 && pickCount > 0 && selected.length === 0);

  const toggle = (techId) => {
    if (locked || !onChange) return;
    if (selected.includes(techId)) {
      onChange(selected.filter((id) => id !== techId));
      return;
    }
    if (selected.length >= pickCount) return;
    onChange([...selected, techId]);
  };

  return (
    <div className="space-y-2">
      <div className="tech-slots-hint !px-0 flex items-baseline justify-between gap-2">
        <span>
          Слоты:{' '}
          <span className={ready ? 'text-emerald-300' : 'text-amber-300'}>
            {selected.length}/{cap}
          </span>
        </span>
        {hint && <span className="text-amber-300/90 font-semibold">{hint}</span>}
      </div>

      {options.length === 0 ? (
        <p className="tech-empty">Нет доступных технологий.</p>
      ) : (
        <ul className="tech-card-list">
          {options.map((techId) => {
            const tech = techById(techId) || { id: techId, name: techId };
            const isOn = selected.includes(techId);
            const atCap = !isOn && selected.length >= pickCount;
            const interactive = !locked && !atCap;
            const expanded = expandedId === tech.id;

            return (
              <li key={techId}>
                <div
                  className={[
                    'tech-card',
                    `color-${tech.color || 'neutral'}`,
                    isOn ? 'is-owned' : '',
                    !isOn && interactive ? 'is-researchable is-interactive' : '',
                    locked || atCap ? 'is-disabled' : '',
                    interactive ? 'is-interactive' : '',
                    expanded ? 'is-expanded' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <button
                    type="button"
                    disabled={locked || atCap}
                    onClick={() => toggle(techId)}
                    className="tech-card-main"
                  >
                    <TechCardArt tech={tech} />
                    <div className="tech-card-body min-w-0">
                      <div className="tech-card-name">{tech.name || techId}</div>
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
                            {tech.kind === 'unit' ? 'Unit' : (tech.kind || 'Tech')}
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
                    <span className="tech-card-action">
                      {isOn ? 'Выбрано ✓' : (atCap || locked ? '' : 'Выбрать')}
                    </span>
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
      )}
    </div>
  );
}
