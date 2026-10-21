import { useEffect, useMemo, useState } from 'react';
import { ALL_FACTIONS } from '../data/gameData';
import { factionWikiUrl, getFactionGuide, listGuidedFactions } from '../data/factionGuide';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

function AbilityBlock({ name, text, meta }) {
  return (
    <div className="guide-ability">
      <div className="guide-ability-head">
        <span className="guide-ability-name">{name}</span>
        {meta ? <span className="guide-ability-meta">{meta}</span> : null}
      </div>
      {text ? <p className="guide-ability-text">{text}</p> : null}
    </div>
  );
}

function FactionDetail({ factionId }) {
  const meta = ALL_FACTIONS.find((f) => f.id === factionId);
  const guide = getFactionGuide(factionId);
  if (!meta || !guide) {
    return (
      <div className="guide-empty">
        Лист этой расы ещё не заполнен. Скоро добавим.
      </div>
    );
  }

  return (
    <article className="guide-detail">
      <header className="guide-detail-head">
        <div className="guide-detail-icon" style={{ borderColor: meta.color || '#64748b' }}>
          <img src={meta.iconUrl} alt="" />
        </div>
        <div className="min-w-0">
          <h2 className="guide-detail-title">{meta.name}</h2>
          <p className="guide-detail-sub">
            Commodities {guide.commodities}
            {guide.complexity ? ` · ${guide.complexity}` : ''}
          </p>
          {guide.blurb ? <p className="guide-detail-blurb">{guide.blurb}</p> : null}
        </div>
        <a
          className="guide-wiki-btn"
          href={factionWikiUrl(guide.wikiSlug)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Wiki
          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
        </a>
      </header>

      <div className="guide-detail-grid">
        <section className="guide-panel">
          <h3 className="guide-panel-title">Способности</h3>
          {guide.abilities?.map((a) => (
            <AbilityBlock key={a.name} name={a.name} text={a.text} />
          ))}
        </section>

        <section className="guide-panel">
          <h3 className="guide-panel-title">Промиссорная записка</h3>
          <AbilityBlock name={guide.promissory.name} text={guide.promissory.text} />
        </section>

        <section className="guide-panel">
          <h3 className="guide-panel-title">Старт</h3>
          <div className="guide-chips">
            {guide.homePlanets?.map((p) => (
              <span key={p.name} className="guide-chip">
                {p.name} · {p.resources}/{p.influence}
              </span>
            ))}
          </div>
          <p className="guide-kv">
            <span>Технологии</span>
            <span>{guide.startingTech?.join(', ')}</span>
          </p>
          <p className="guide-kv">
            <span>Юниты</span>
            <span>{guide.startingUnits?.join(' · ')}</span>
          </p>
        </section>

        <section className="guide-panel">
          <h3 className="guide-panel-title">Лидеры</h3>
          {guide.leaders?.agent && (
            <AbilityBlock
              name={`Агент · ${guide.leaders.agent.name}`}
              meta={guide.leaders.agent.unlock}
              text={guide.leaders.agent.text}
            />
          )}
          {guide.leaders?.commander && (
            <AbilityBlock
              name={`Командир · ${guide.leaders.commander.name}`}
              meta={guide.leaders.commander.unlock}
              text={guide.leaders.commander.text}
            />
          )}
          {guide.leaders?.hero && (
            <AbilityBlock
              name={`Герой · ${guide.leaders.hero.name}`}
              meta={guide.leaders.hero.unlock}
              text={guide.leaders.hero.text}
            />
          )}
        </section>

        <section className="guide-panel">
          <h3 className="guide-panel-title">Флагман · {guide.flagship.name}</h3>
          <p className="guide-statline">
            C{guide.flagship.cost} · бой {guide.flagship.combat} · ход {guide.flagship.move} · вмест. {guide.flagship.capacity}
          </p>
          <p className="guide-ability-text">{guide.flagship.abilities}</p>
        </section>

        <section className="guide-panel">
          <h3 className="guide-panel-title">Мех · {guide.mech.name}</h3>
          <p className="guide-statline">
            C{guide.mech.cost} · бой {guide.mech.combat}
          </p>
          <p className="guide-ability-text">{guide.mech.text}</p>
        </section>

        {guide.breakthrough && (
          <section className="guide-panel guide-panel--wide">
            <h3 className="guide-panel-title">Прорыв</h3>
            <AbilityBlock name={guide.breakthrough.name} text={guide.breakthrough.text} />
          </section>
        )}
      </div>
    </article>
  );
}

/** Full-page guidebook (desktop + hub), same shell language as Stats. */
export function GuidePage({ onBack }) {
  useEscapeKey(() => onBack?.(), true);
  const guided = useMemo(() => listGuidedFactions(), []);
  const [selectedId, setSelectedId] = useState(guided[0]?.id || null);

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  return (
    <div className="hub-shell hub-shell--column stats-shell guide-shell">
      <HubCosmosBackdrop />
      <header className="stats-topbar">
        <div className="stats-topbar-inner">
          <button type="button" onClick={onBack} aria-label="Назад" className="stats-back">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            <span>Назад</span>
          </button>
          <div className="stats-topbar-copy">
            <h1 className="stats-title">Руководство</h1>
            <p className="stats-subtitle">
              Расы и подсказки · {guided.length} листа
              {ALL_FACTIONS.length > guided.length
                ? ` из ${ALL_FACTIONS.length}`
                : ''}
            </p>
          </div>
        </div>
      </header>

      <main className="stats-main guide-main">
        <aside className="guide-rail" aria-label="Расы">
          <ul className="guide-rail-list">
            {guided.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={`guide-rail-item ${selectedId === f.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <span className="guide-rail-icon" style={{ borderColor: f.color || '#64748b' }}>
                    <img src={f.iconUrl} alt="" />
                  </span>
                  <span className="guide-rail-copy min-w-0">
                    <span className="guide-rail-name truncate">{f.name}</span>
                    <span className="guide-rail-meta">Commodities {f.guide.commodities}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {ALL_FACTIONS.length > guided.length && (
            <p className="guide-rail-note">
              Остальные расы появятся здесь по мере наполнения.
            </p>
          )}
        </aside>

        <div className="guide-content">
          {selectedId ? (
            <FactionDetail factionId={selectedId} />
          ) : (
            <div className="guide-empty">Выберите расу слева.</div>
          )}
        </div>
      </main>
    </div>
  );
}
