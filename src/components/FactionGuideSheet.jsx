import { ALL_FACTIONS } from '../data/gameData';
import { factionWikiUrl, getFactionGuide } from '../data/factionGuide';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

function shortOf(item, fallback = '') {
  if (!item) return fallback;
  if (typeof item === 'string') return item;
  return item.short || item.text || fallback;
}

function DifficultyPips({ level = 1 }) {
  const n = Math.max(1, Math.min(3, Number(level) || 1));
  return (
    <span className="frc-diff" aria-label={`Сложность ${n} из 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={`frc-diff-pip ${i <= n ? 'is-on' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function Col({ title, children, className = '' }) {
  return (
    <section className={`frc-col ${className}`.trim()}>
      <h3 className="frc-col-title">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Landscape faction reference card (print-sheet layout), no HUD frame.
 * Scrolls inside the card when content overflows.
 */
export function FactionGuideSheet({
  show,
  factionId = null,
  playerName = null,
  onClose,
}) {
  useEscapeKey(onClose, show);
  useBodyScrollLock(show);

  if (!show) return null;

  const meta = factionId ? ALL_FACTIONS.find((f) => f.id === factionId) : null;
  const guide = factionId ? getFactionGuide(factionId) : null;
  const accent = meta?.color || '#38bdf8';

  return (
    <div className="frc-overlay" role="presentation" onClick={onClose}>
      <button type="button" className="frc-dismiss" onClick={onClose} aria-label="Закрыть">
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="frc-title"
        className="frc-stage"
        onClick={(e) => e.stopPropagation()}
      >
        {!guide || !meta ? (
          <div className="frc-empty">Справка по этой расе ещё не заполнена.</div>
        ) : (
          <article className="frc-card" style={{ '--frc-accent': accent }}>
            <header className="frc-head">
              <div className="frc-crest" style={{ borderColor: accent }}>
                <img src={meta.iconUrl} alt="" />
              </div>
              <div className="frc-head-copy">
                <h2 id="frc-title" className="frc-name">{meta.name}</h2>
                {playerName ? <p className="frc-player">{playerName}</p> : null}
                {guide.blurb ? <p className="frc-blurb">{guide.blurb}</p> : null}
              </div>
              <div className="frc-comm" title="Commodities">
                <strong>{guide.commodities}</strong>
              </div>
            </header>

            <div className="frc-scroll">
              <div className="frc-mid">
                <Col title="Способности">
                  <ul className="frc-bullets">
                    {guide.abilities?.map((a) => (
                      <li key={a.name}>
                        <b>{a.name}.</b>
                        {' '}
                        {shortOf(a)}
                      </li>
                    ))}
                  </ul>
                </Col>

                <Col title="Лидеры фракции">
                  <ol className="frc-leaders">
                    {guide.leaders?.agent && (
                      <li>
                        <em>I</em>
                        <span>{shortOf(guide.leaders.agent)}</span>
                      </li>
                    )}
                    {guide.leaders?.commander && (
                      <li>
                        <em>II</em>
                        <span>{shortOf(guide.leaders.commander)}</span>
                      </li>
                    )}
                    {guide.leaders?.hero && (
                      <li>
                        <em>III</em>
                        <span>{shortOf(guide.leaders.hero)}</span>
                      </li>
                    )}
                  </ol>
                </Col>

                <Col title="Прорыв" className={!guide.breakthrough ? 'is-empty' : ''}>
                  {guide.breakthrough ? (
                    <p className="frc-note">
                      <b>{guide.breakthrough.name}.</b>
                      {' '}
                      {shortOf(guide.breakthrough)}
                    </p>
                  ) : (
                    <p className="frc-note is-muted">—</p>
                  )}
                </Col>
              </div>

              <div className="frc-foot">
                <Col title="Обещание">
                  <p className="frc-note">
                    <b>{guide.promissory.name}.</b>
                    {' '}
                    {shortOf(guide.promissory)}
                  </p>
                </Col>
                <Col title="Флагман">
                  <p className="frc-note">
                    <b>{guide.flagship.name}.</b>
                    {' '}
                    {shortOf(guide.flagship, guide.flagship.abilities)}
                  </p>
                </Col>
                <Col title="Мех">
                  <p className="frc-note">
                    <b>{guide.mech.name}.</b>
                    {' '}
                    {shortOf(guide.mech)}
                  </p>
                </Col>
                <Col title="Родная система">
                  <ul className="frc-list">
                    {guide.homePlanets?.map((p) => (
                      <li key={p.name}>
                        {p.name}
                        {' '}
                        <span className="frc-ri">{p.resources}/{p.influence}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="frc-diff-row">
                    <span>Сложность</span>
                    <DifficultyPips level={guide.complexityLevel} />
                  </div>
                </Col>
              </div>

              <a
                className="frc-wiki"
                href={factionWikiUrl(guide.wikiSlug)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Wiki
              </a>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
