import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_FACTIONS } from '../data/gameData';
import { formatTime } from '../utils/game';
import combatDealArt from '../assets/combat/attack-bg.jpg';
import combatHitsArt from '../assets/combat/hits-bg.jpg';
import combatTakeArt from '../assets/objectives/stage2-bg.jpg';

function factionOf(player) {
  return player ? ALL_FACTIONS.find((f) => f.id === player.factionId) : null;
}

function CrossedSwordsIcon() {
  return (
    <svg className="pcbat-btn-ico" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        <g transform="rotate(-42 12 12)">
          <polygon points="12,1 13.2,2.6 10.8,2.6" />
          <rect x="11.05" y="2.4" width="1.9" height="13.2" rx="0.35" />
          <rect x="8.4" y="14.2" width="7.2" height="1.9" rx="0.35" />
          <rect x="11.2" y="16" width="1.6" height="4.2" rx="0.3" />
        </g>
        <g transform="rotate(42 12 12)">
          <polygon points="12,1 13.2,2.6 10.8,2.6" />
          <rect x="11.05" y="2.4" width="1.9" height="13.2" rx="0.35" />
          <rect x="8.4" y="14.2" width="7.2" height="1.9" rx="0.35" />
          <rect x="11.2" y="16" width="1.6" height="4.2" rx="0.3" />
        </g>
      </g>
    </svg>
  );
}

function DefeatXIcon() {
  return (
    <svg className="pcbat-btn-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.2 4.8 12 10.6l5.8-5.8 1.4 1.4L13.4 12l5.8 5.8-1.4 1.4L12 13.4l-5.8 5.8-1.4-1.4L10.6 12 4.8 6.2z"
      />
    </svg>
  );
}

function RetreatIcon() {
  return (
    <svg className="pcbat-btn-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 5.5 5.5 11 11 16.5V13h5.5v-4H11zm7.5 1.5v10H21V7z"
      />
    </svg>
  );
}

function CombatBtn({ className, onClick, icon, children }) {
  return (
    <button type="button" className={`pcbat-btn ${className || ''}`} onClick={onClick}>
      <span className="pcbat-btn-frame" aria-hidden="true" />
      <span className="pcbat-btn-shell">
        {icon}
        <span className="pcbat-btn-label">{children}</span>
      </span>
    </button>
  );
}

function FighterCard({ player, label, tone }) {
  return (
    <article className={`pcbat-fighter is-${tone}`}>
      <div className="pcbat-fighter-glyph" aria-hidden="true">
        <img src={factionOf(player)?.iconUrl} alt="" />
      </div>
      <span className="pcbat-fighter-name">{player?.name || '—'}</span>
      <span className={`pcbat-fighter-role is-${tone}`}>{label}</span>
    </article>
  );
}

/**
 * Mobile PvP combat sheet — glass neon panels matching the combat mockup
 * (not the host HUD chassis).
 */
export function PlayerCombatSheet({
  me,
  players = [],
  combat,
  combatSessionTime = 0,
  canStartCombat = false,
  onStartCombat,
  onSetHits,
  onAssign,
  onDeclareRetreat,
  onResolveRetreat,
  onDefeat,
  onDismissResult,
}) {
  const [picking, setPicking] = useState(false);
  const [draftHits, setDraftHits] = useState(0);

  const active = !!combat?.active && combat.mode === 'pvp';
  const phase = combat?.phase;
  const isResult = active && phase === 'result';
  const isRetreatCheck = active && phase === 'retreat_check';
  const isTake = phase === 'reveal'
    || (isResult && me && String(combat.loserId) === String(me.id));
  const inFight = active
    && me
    && (String(combat.attackerId) === String(me.id) || String(combat.defenderId) === String(me.id));
  const retreatPlayerId = combat?.retreatPlayerId ?? null;
  const retreatPending = retreatPlayerId != null;
  const retreatPlayer = retreatPending
    ? players.find((p) => String(p.id) === String(retreatPlayerId))
    : null;
  const iDeclaredRetreat = retreatPending && me && String(retreatPlayerId) === String(me.id);
  const isRetreatResult = isResult && combat?.resultKind === 'retreat';

  const attacker = inFight
    ? players.find((p) => String(p.id) === String(combat.attackerId))
    : null;
  const defender = inFight
    ? players.find((p) => String(p.id) === String(combat.defenderId))
    : null;
  const opponentId = inFight
    ? (String(combat.attackerId) === String(me.id) ? combat.defenderId : combat.attackerId)
    : null;
  const opponent = opponentId != null
    ? players.find((p) => String(p.id) === String(opponentId))
    : null;

  const myHits = inFight ? combat.hits?.[me.id] : null;
  const oppHits = inFight && opponentId != null ? combat.hits?.[opponentId] : null;
  const myAssigned = inFight ? !!combat.assigned?.[me.id] : false;
  const round = combat?.round || 1;
  const dealtNow = myHits != null ? Number(myHits) : draftHits;
  const dealtTotal = (Number(combat?.totals?.[me.id]) || 0) + (Number(dealtNow) || 0);
  const receivedNow = oppHits == null ? null : Number(oppHits) || 0;
  const receivedTotal = (Number(combat?.totals?.[opponentId]) || 0) + (Number(receivedNow) || 0);

  const iWon = isResult && me && String(combat.winnerId) === String(me.id);
  const iLost = isResult && me && String(combat.loserId) === String(me.id);
  const winner = isResult
    ? players.find((p) => String(p.id) === String(combat.winnerId))
    : null;
  const loser = isResult
    ? players.find((p) => String(p.id) === String(combat.loserId))
    : null;

  useEffect(() => {
    if (phase === 'input' && myHits == null) setDraftHits(0);
    if (phase === 'input' && myHits != null) setDraftHits(Number(myHits) || 0);
  }, [phase, myHits, combat?.round]);

  const opponents = (players || []).filter(
    (p) => me && String(p.id) !== String(me.id) && !p.eliminated,
  );

  if (!me) return null;

  const tone = isTake ? 'is-take' : 'is-deal';
  const art = isTake ? combatTakeArt : combatDealArt;

  const panel = ({ titleId, title, subtitle, children, onClose }) => (
    <div
      className={`pcbat-panel ${tone}`}
      style={{ '--pcbat-art': `url(${art})` }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="pcbat-panel-art" aria-hidden="true" />
      <div className="pcbat-panel-glass" aria-hidden="true" />
      <div className="pcbat-panel-body">
        <header className="pcbat-head">
          <div className="pcbat-head-row">
            <span className="pcbat-kicker">Раунд {round}</span>
            <div className="pcbat-head-tools">
              <span className="pcbat-timer">
                <i className="fa-solid fa-stopwatch" aria-hidden="true" />
                {formatTime(combatSessionTime)}
              </span>
              {typeof onClose === 'function' && (
                <button type="button" className="pcbat-x" onClick={onClose} aria-label="Закрыть">
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <h2 id={titleId} className="pcbat-title">{title}</h2>
          {subtitle ? <p className="pcbat-sub">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );

  const duel = (left, right, leftLabel, rightLabel) => (
    <div className="pcbat-duel">
      <FighterCard player={left} label={leftLabel} tone="atk" />
      <span className="pcbat-vs">VS</span>
      <FighterCard player={right} label={rightLabel} tone="def" />
    </div>
  );

  const dmgBlock = ({ label, value, editable, onDec, onInc, hint }) => (
    <div
      className="pcbat-dmg"
      style={{ '--pcbat-hits-art': `url(${combatHitsArt})` }}
    >
      <div className="pcbat-dmg-art" aria-hidden="true" />
      <div className="pcbat-dmg-veil" aria-hidden="true" />
      <div className="pcbat-dmg-inner">
        <div className="pcbat-dmg-label">{label}</div>
        <div className="pcbat-hits">
          <button
            type="button"
            className="pcbat-step"
            disabled={!editable}
            onClick={onDec}
            aria-label="Меньше"
          >
            <i className="fa-solid fa-minus" aria-hidden="true" />
          </button>
          <div className="pcbat-hits-value tabular-nums">{value}</div>
          <button
            type="button"
            className="pcbat-step"
            disabled={!editable}
            onClick={onInc}
            aria-label="Больше"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
          </button>
        </div>
        <p className="pcbat-hint">{hint}</p>
      </div>
    </div>
  );

  return (
    <>
      {canStartCombat && !active && (
        <button
          type="button"
          className="pt-action is-combat"
          onClick={() => setPicking(true)}
        >
          <i className="fa-solid fa-burst" aria-hidden="true" />
          Бой
        </button>
      )}

      {picking && !active && (
        <div className="pcbat-pick" role="dialog" aria-labelledby="pcbat-pick-title">
          <header className="pcbat-pick-head">
            <h2 id="pcbat-pick-title" className="pcbat-pick-title">Кого атакуете?</h2>
            <button type="button" className="pcbat-x" onClick={() => setPicking(false)} aria-label="Закрыть">
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </header>
          <div className="pcbat-list">
            {opponents.map((p) => {
              const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="pcbat-seat"
                  style={{ '--pcbat-accent': p.color || '#64748b' }}
                  onClick={() => {
                    setPicking(false);
                    onStartCombat?.(p.id);
                  }}
                >
                  <span className="pcbat-seat-icon">
                    <img src={faction?.iconUrl} alt="" />
                  </span>
                  <span className="pcbat-seat-name">{p.name}</span>
                  <i className="fa-solid fa-chevron-right" aria-hidden="true" />
                </button>
              );
            })}
            {opponents.length === 0 && (
              <p className="pcbat-empty">Нет доступных противников</p>
            )}
          </div>
        </div>
      )}

      {inFight && isResult && createPortal(
        <div className="pcbat-overlay">
          {panel({
            titleId: 'pcbat-result-title',
            title: isRetreatResult
              ? (iLost ? 'Отступление' : iWon ? 'Противник отступил' : 'Отступление')
              : (iWon ? 'Победа' : iLost ? 'Поражение' : 'Бой завершён'),
            subtitle: winner && loser
              ? (isRetreatResult
                ? `${loser.name} отступил от ${winner.name}`
                : `${winner.name} победил ${loser.name}`)
              : 'Результат зафиксирован',
            children: (
              <>
                {duel(
                  winner,
                  loser,
                  'Победитель',
                  isRetreatResult ? 'Отступление' : 'Поражение',
                )}
                <div className="pcbat-dmg is-summary">
                  <div className="pcbat-dmg-inner">
                    <p className="pcbat-hint">
                      Урон: <strong>{Number(combat.totals?.[combat.winnerId]) || 0}</strong>
                      {' : '}
                      <strong>{Number(combat.totals?.[combat.loserId]) || 0}</strong>
                    </p>
                  </div>
                </div>
                <CombatBtn className="is-primary" onClick={() => onDismissResult?.()}>
                  OK
                </CombatBtn>
              </>
            ),
          })}
        </div>,
        document.body,
      )}

      {inFight && isRetreatCheck && createPortal(
        <div className="pcbat-overlay">
          {panel({
            titleId: 'pcbat-retreat-title',
            title: 'Отступление',
            subtitle: retreatPlayer
              ? `${retreatPlayer.name} объявил отступление. Удалось ли уйти?`
              : 'Удалось ли отступить?',
            children: (
              <>
                {duel(attacker, defender, 'Атака', 'Защита')}
                <p className="pcbat-retreat-ask">
                  Раунд завершён. Получилось отступить?
                </p>
                <div className="pcbat-btn-row">
                  <CombatBtn
                    className="is-primary"
                    onClick={() => onResolveRetreat?.(true)}
                    icon={<RetreatIcon />}
                  >
                    Да
                  </CombatBtn>
                  <CombatBtn
                    className="is-danger"
                    onClick={() => onResolveRetreat?.(false)}
                    icon={<DefeatXIcon />}
                  >
                    Нет
                  </CombatBtn>
                </div>
              </>
            ),
          })}
        </div>,
        document.body,
      )}

      {inFight && !isResult && !isRetreatCheck && createPortal(
        <div className="pcbat-overlay">
          {panel({
            titleId: 'pcbat-fight-title',
            title: phase === 'reveal' ? 'Полученный урон' : 'Нанесённый урон',
            subtitle: retreatPending
              ? (iDeclaredRetreat
                ? 'Вы объявили отступление — сыграйте этот раунд'
                : `${retreatPlayer?.name || 'Противник'} объявил отступление — сыграйте раунд`)
              : (phase === 'reveal'
                ? 'Отметьте количество полученных попаданий'
                : 'Выберите количество попаданий'),
            children: (
              <>
                {duel(attacker, defender, 'Атака', 'Защита')}

                {retreatPending && (
                  <p className="pcbat-retreat-banner">
                    <RetreatIcon />
                    <span>
                      После присвоения попаданий спросим, удалось ли отступить
                    </span>
                  </p>
                )}

                {phase === 'input' && (
                  <>
                    {dmgBlock({
                      label: 'Попаданий нанесено',
                      value: dealtNow,
                      editable: myHits == null,
                      onDec: () => setDraftHits((n) => Math.max(0, n - 1)),
                      onInc: () => setDraftHits((n) => n + 1),
                      hint: (
                        <>
                          Вы нанесли <strong>{dealtNow}</strong>
                          {' · '}
                          всего в бою: <strong>{dealtTotal}</strong>
                        </>
                      ),
                    })}
                    {myHits == null ? (
                      <CombatBtn
                        className="is-primary"
                        onClick={() => onSetHits?.(me.id, draftHits)}
                        icon={<CrossedSwordsIcon />}
                      >
                        Отправить
                      </CombatBtn>
                    ) : (
                      <p className="pcbat-wait">
                        {oppHits == null
                          ? `Ожидаем ввод: ${opponent?.name || 'противник'}…`
                          : 'Оба ввели попадания'}
                      </p>
                    )}
                  </>
                )}

                {phase === 'reveal' && (
                  <>
                    {dmgBlock({
                      label: 'Получено попаданий',
                      value: receivedNow == null ? '—' : receivedNow,
                      editable: false,
                      hint: (
                        <>
                          Вы получили <strong>{receivedNow ?? 0}</strong>
                          {' · '}
                          всего в бою: <strong>{receivedTotal}</strong>
                        </>
                      ),
                    })}
                    {!myAssigned ? (
                      <CombatBtn
                        className="is-primary"
                        onClick={() => onAssign?.(me.id)}
                        icon={<i className="fa-solid fa-shield-halved pcbat-btn-ico" aria-hidden="true" />}
                      >
                        Присвоил
                      </CombatBtn>
                    ) : (
                      <p className="pcbat-wait">Ожидаем подтверждение противника…</p>
                    )}
                  </>
                )}

                <div className="pcbat-btn-row">
                  {!retreatPending ? (
                    <CombatBtn
                      className="is-retreat"
                      onClick={() => onDeclareRetreat?.(me.id)}
                      icon={<RetreatIcon />}
                    >
                      Отступить
                    </CombatBtn>
                  ) : (
                    <div className="pcbat-retreat-locked">
                      Отступление объявлено
                    </div>
                  )}
                  <CombatBtn
                    className="is-danger"
                    onClick={() => onDefeat?.(me.id)}
                    icon={<DefeatXIcon />}
                  >
                    Поражение
                  </CombatBtn>
                </div>
              </>
            ),
          })}
        </div>,
        document.body,
      )}
    </>
  );
}
