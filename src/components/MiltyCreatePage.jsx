import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brandMark from '../assets/brand-mark.png';
import { randomPartyName } from '../milty/partyNames.js';
import { EDITIONS } from '../milty/tiles.js';
import { defaultMiltySettings, parseCustomSlicesText } from '../milty/settings.js';
import { createMiltyDraft } from '../sync/miltyApi';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';

function sessionKey(id) {
  return `ti4_milty_${String(id).toUpperCase()}`;
}

const EXP_IMG = {
  pok: '/milty/exp-pok.jpg',
  kel: '/milty/exp-keleres.jpg',
  te: '/milty/exp-te.jpg',
};

function Stepper({ label, value, min, max, step = 1, onChange, hint }) {
  const clamp = (n) => Math.min(max, Math.max(min, n));
  return (
    <label className="milty-create-stepper">
      <span className="milty-create-label">{label}</span>
      <div className="milty-create-stepper__ctrl">
        <button
          type="button"
          className="milty-create-stepper__btn"
          disabled={value <= min}
          onClick={() => onChange(clamp(Number(value) - step))}
          aria-label="Меньше"
        >
          <i className="fa-solid fa-minus" aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, '');
            if (raw === '') return;
            onChange(clamp(Number(raw) || min));
          }}
          className="milty-create-stepper__input"
          aria-label={label}
        />
        <button
          type="button"
          className="milty-create-stepper__btn"
          disabled={value >= max}
          onClick={() => onChange(clamp(Number(value) + step))}
          aria-label="Больше"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
      </div>
      {hint ? <span className="milty-create-hint">{hint}</span> : null}
    </label>
  );
}

export function MiltyCreatePage({ partyMode = false, onCreateParty = null } = {}) {
  const navigate = useNavigate();
  const [numPlayers, setNumPlayers] = useState(6);
  const [names, setNames] = useState(() => Array.from({ length: 6 }, (_, i) => `Игрок ${i + 1}`));
  const [usePok, setUsePok] = useState(true);
  const [useTe, setUseTe] = useState(false);
  const [includeKeleres, setIncludeKeleres] = useState(false);
  const [numberOfSlices, setNumberOfSlices] = useState(6);
  const [numberOfFactions, setNumberOfFactions] = useState(9);
  const [seed, setSeed] = useState('');
  const [minInf, setMinInf] = useState(4);
  const [minRes, setMinRes] = useState(2.5);
  const [minTotal, setMinTotal] = useState(9);
  const [maxTotal, setMaxTotal] = useState(13);
  const [minLegendaries, setMinLegendaries] = useState(0);
  const [minTwoWormholes, setMinTwoWormholes] = useState(false);
  const [maxOneWormhole, setMaxOneWormhole] = useState(false);
  const [customSlices, setCustomSlices] = useState('');
  const [gameName, setGameName] = useState(() => randomPartyName());
  const [keepListOrder, setKeepListOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  const setPlayerCount = (n) => {
    const count = Math.min(8, Math.max(3, Number(n) || 6));
    setNumPlayers(count);
    setNames((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(`Игрок ${next.length + 1}`);
      return next.slice(0, count);
    });
    setNumberOfSlices((s) => Math.max(count, s));
    setNumberOfFactions((f) => Math.max(count, f));
  };

  const toggleTe = () => {
    if (useTe) {
      setUseTe(false);
      return;
    }
    setUseTe(true);
    setUsePok(true);
    setIncludeKeleres(true);
  };

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const tileSets = [EDITIONS.BaseGame];
      if (usePok) tileSets.push(EDITIONS.PoK);
      if (useTe) tileSets.push(EDITIONS.TE);
      const factionSets = ['base'];
      if (usePok) factionSets.push('pok');
      if (useTe) factionSets.push('te');

      const settings = defaultMiltySettings({
        playerNames: names.map((n, i) => n.trim() || `Игрок ${i + 1}`),
        numberOfSlices: Math.max(numPlayers, Number(numberOfSlices) || numPlayers),
        numberOfFactions: Math.max(numPlayers, Number(numberOfFactions) || numPlayers),
        tileSets,
        factionSets,
        includeKeleres,
        seed: seed.trim() ? Number(seed) : undefined,
        minInf: Number(minInf),
        minRes: Number(minRes),
        minTotal: Number(minTotal),
        maxTotal: Number(maxTotal),
        minLegendaries: Number(minLegendaries) || 0,
        minTwoWormholes,
        maxOneWormhole,
        gameName: gameName.trim() || randomPartyName(),
        customSlices: parseCustomSlicesText(customSlices),
        presetDraftOrder: keepListOrder,
      });

      if (partyMode && typeof onCreateParty === 'function') {
        await onCreateParty(settings);
        return;
      }

      const result = await createMiltyDraft(settings);
      try {
        sessionStorage.setItem(sessionKey(result.id), JSON.stringify({
          adminSecret: result.adminSecret,
        }));
      } catch {
        /* ignore */
      }
      navigate(`/milty/${result.id}?admin=${encodeURIComponent(result.adminSecret)}`);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="milty-create hub-shell hub-shell--column">
      <HubCosmosBackdrop />

      <div className="milty-create__stage">
        <header className="milty-create__top">
          <button type="button" className="hub-back" onClick={() => navigate('/')}>
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            Назад
          </button>
          <div className="milty-create__brand">
            <img src={brandMark} alt="" width={28} height={28} draggable={false} />
            <div>
              <h1 className="milty-create__title">
                {partyMode ? 'Партия с Milty' : 'Milty Draft'}
              </h1>
              <p className="milty-create__lead">
                {partyMode
                  ? 'Создаётся комната: игроки входят по коду. В хабе партия появится после драфта.'
                  : 'Генерация слайсов и live snake-драфт фракций, слайсов и мест за столом.'}
              </p>
            </div>
          </div>
        </header>

        <div className="milty-create__grid">
          <section className="milty-create__panel milty-create__settings">
            <div className="milty-create-field">
              <span className="milty-create-label">Название партии</span>
              <div className="milty-create-name-row">
                <input
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  className="milty-create-input"
                  placeholder="Сгенерировать или ввести"
                  aria-label="Название партии"
                />
                <button
                  type="button"
                  className="milty-create-name-dice"
                  onClick={() => setGameName(randomPartyName())}
                  title="Случайное название"
                  aria-label="Случайное название"
                >
                  <i className="fa-solid fa-dice" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="milty-create-field">
              <span className="milty-create-label">Игроки: {numPlayers}</span>
              <div className="milty-create-player-btns" role="group" aria-label="Число игроков">
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`milty-create-player-btn${n === numPlayers ? ' is-on' : ''}`}
                    onClick={() => setPlayerCount(n)}
                    aria-pressed={n === numPlayers}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="milty-create-field">
              <span className="milty-create-label">Включить расширения</span>
              <div className="milty-create-exp">
                <button
                  type="button"
                  className={`milty-create-exp-card milty-create-exp-card--pok${usePok ? ' is-on' : ''}`}
                  disabled={useTe && usePok}
                  title={useTe ? "PoK обязателен при Thunder's Edge" : undefined}
                  onClick={() => {
                    if (useTe && usePok) return;
                    setUsePok(!usePok);
                  }}
                >
                  <img src={EXP_IMG.pok} alt="" className="milty-create-exp-card__img" draggable={false} />
                  <span className="milty-create-exp-card__shade" aria-hidden="true" />
                  <span className="milty-create-exp-card__check" aria-hidden="true">
                    {usePok ? <i className="fa-solid fa-check" /> : null}
                  </span>
                  <span className="milty-create-exp-card__title">PoK тайлы/фракции</span>
                </button>
                <button
                  type="button"
                  className={`milty-create-exp-card milty-create-exp-card--kel${includeKeleres ? ' is-on' : ''}`}
                  onClick={() => setIncludeKeleres(!includeKeleres)}
                >
                  <img src={EXP_IMG.kel} alt="" className="milty-create-exp-card__img" draggable={false} />
                  <span className="milty-create-exp-card__shade" aria-hidden="true" />
                  <span className="milty-create-exp-card__check" aria-hidden="true">
                    {includeKeleres ? <i className="fa-solid fa-check" /> : null}
                  </span>
                  <span className="milty-create-exp-card__title">Келерес</span>
                </button>
                <button
                  type="button"
                  className={`milty-create-exp-card milty-create-exp-card--te${useTe ? ' is-on' : ''}`}
                  onClick={toggleTe}
                >
                  <img src={EXP_IMG.te} alt="" className="milty-create-exp-card__img" draggable={false} />
                  <span className="milty-create-exp-card__shade" aria-hidden="true" />
                  <span className="milty-create-exp-card__check" aria-hidden="true">
                    {useTe ? <i className="fa-solid fa-check" /> : null}
                  </span>
                  <span className="milty-create-exp-card__title">Thunder&apos;s Edge</span>
                </button>
              </div>
            </div>

            <div className="milty-create-pool">
              <Stepper
                label="Слайсов в пуле"
                value={numberOfSlices}
                min={numPlayers}
                max={12}
                onChange={setNumberOfSlices}
                hint="Не меньше числа игроков; лишние — выбор в драфте"
              />
              <Stepper
                label="Фракций в пуле"
                value={numberOfFactions}
                min={numPlayers}
                max={24}
                onChange={(v) => setNumberOfFactions(Math.max(numPlayers, v))}
              />
            </div>

            <div className="milty-create-advanced">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="milty-create-advanced__toggle"
                aria-expanded={showAdvanced}
              >
                <span>
                  <i className="fa-solid fa-gear" aria-hidden="true" />
                  Дополнительные настройки
                </span>
                <i
                  className={`fa-solid fa-chevron-${showAdvanced ? 'up' : 'down'}`}
                  aria-hidden="true"
                />
              </button>
              {showAdvanced && (
                <div className="milty-create-advanced__body">
                  <div className="milty-create-checks">
                    <label className="milty-create-check">
                      <input
                        type="checkbox"
                        checked={keepListOrder}
                        onChange={(e) => setKeepListOrder(e.target.checked)}
                      />
                      Порядок игроков как в списке (без рандома)
                    </label>
                  </div>

                  <div className="milty-create-adv-grid">
                    <label className="milty-create-field">
                      <span className="milty-create-label">Seed</span>
                      <input
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                        placeholder="авто"
                        className="milty-create-input"
                      />
                    </label>
                    <label className="milty-create-field">
                      <span className="milty-create-label">Min inf</span>
                      <input
                        type="number"
                        step="0.5"
                        value={minInf}
                        onChange={(e) => setMinInf(e.target.value)}
                        className="milty-create-input"
                      />
                    </label>
                    <label className="milty-create-field">
                      <span className="milty-create-label">Min res</span>
                      <input
                        type="number"
                        step="0.5"
                        value={minRes}
                        onChange={(e) => setMinRes(e.target.value)}
                        className="milty-create-input"
                      />
                    </label>
                    <label className="milty-create-field">
                      <span className="milty-create-label">Min total</span>
                      <input
                        type="number"
                        step="0.5"
                        value={minTotal}
                        onChange={(e) => setMinTotal(e.target.value)}
                        className="milty-create-input"
                      />
                    </label>
                    <label className="milty-create-field">
                      <span className="milty-create-label">Max total</span>
                      <input
                        type="number"
                        step="0.5"
                        value={maxTotal}
                        onChange={(e) => setMaxTotal(e.target.value)}
                        className="milty-create-input"
                      />
                    </label>
                    <label className="milty-create-field">
                      <span className="milty-create-label">Min legendary</span>
                      <input
                        type="number"
                        min={0}
                        value={minLegendaries}
                        onChange={(e) => setMinLegendaries(e.target.value)}
                        className="milty-create-input"
                      />
                    </label>
                  </div>

                  <div className="milty-create-checks">
                    <label className="milty-create-check">
                      <input
                        type="checkbox"
                        checked={minTwoWormholes}
                        onChange={(e) => setMinTwoWormholes(e.target.checked)}
                      />
                      ≥2 α и ≥2 β в пуле
                    </label>
                    <label className="milty-create-check">
                      <input
                        type="checkbox"
                        checked={maxOneWormhole}
                        onChange={(e) => setMaxOneWormhole(e.target.checked)}
                      />
                      Max 1 wormhole на слайс
                    </label>
                  </div>

                  <label className="milty-create-field">
                    <span className="milty-create-label">Custom slices</span>
                    <textarea
                      value={customSlices}
                      onChange={(e) => setCustomSlices(e.target.value)}
                      rows={3}
                      placeholder={'26,19,39,41,44\n27,20,...'}
                      className="milty-create-input milty-create-input--mono"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="milty-create__panel milty-create__roster">
            <div className="milty-create-roster-head">
              <h2 className="milty-create-roster-title">
                <i className="fa-solid fa-users" aria-hidden="true" />
                Игроки
              </h2>
              <span className="milty-create-roster-count">{names.length}</span>
            </div>
            <ul className="milty-create-roster-list">
              {names.map((name, i) => (
                <li key={i} className="milty-create-roster-row">
                  <span className="milty-create-roster-idx" aria-hidden="true">{i + 1}</span>
                  <input
                    value={name}
                    onChange={(e) => {
                      const next = [...names];
                      next[i] = e.target.value;
                      setNames(next);
                    }}
                    className="milty-create-roster-input"
                    placeholder={`Игрок ${i + 1}`}
                    aria-label={`Игрок ${i + 1}`}
                  />
                </li>
              ))}
            </ul>
            <p className="milty-create-hint milty-create-hint--roster">
              {keepListOrder
                ? 'Порядок списка сохранится при создании драфта.'
                : 'При создании порядок игроков перемешается случайно.'}
            </p>
          </section>
        </div>

        {error && (
          <p className="milty-create-error" role="alert">{error}</p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onCreate}
          className="milty-create-cta"
        >
          {busy ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
              Генерация…
            </>
          ) : (
            <>
              <i className="fa-solid fa-dice-d20" aria-hidden="true" />
              {partyMode ? 'Создать партию с драфтом' : 'Создать драфт'}
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>

        <p className="milty-create-foot">
          Inspired by miltydraft / shenanigans-be. Seeds не совместимы с milty.shenanigans.be.
        </p>
      </div>
    </div>
  );
}
