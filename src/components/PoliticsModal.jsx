import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_FACTIONS } from '../data/gameData';
import { isAgendaFullyVoted } from '../utils/game';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { ROLES } from '../sync/permissions';
import {
  argentFlightVoteBonus,
  effectiveVoteAmount,
  isArgentFlightPlayer,
  isXxchaPlayer,
} from '../game/selectors';
import { agendaEffectText } from '../data/agendas';
import {
  agendaNeedsSpeakerBreak,
  covertOutcomeLabel,
  electTargetLabel,
  isAgendaFaceUp,
  voteTypeForLaw,
} from '../game/agendaDeck';

function pluralVotes(n) {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return 'голосов';
  if (d === 1) return 'голос';
  if (d >= 2 && d <= 4) return 'голоса';
  return 'голосов';
}

/** Итог За/Против: счётчик «набегает», вспышка и +N при получении голосов. */
function PolFaSideResult({ label, total, tone, iconClass, weight }) {
  const [shown, setShown] = useState(total);
  const [receiving, setReceiving] = useState(false);
  const [delta, setDelta] = useState(null);
  const prevRef = useRef(total);
  const rafRef = useRef(0);
  const clearRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    if (from === total) return undefined;
    prevRef.current = total;
    const gained = total - from;
    window.clearTimeout(clearRef.current);
    cancelAnimationFrame(rafRef.current);

    if (gained > 0) {
      setDelta(gained);
      setReceiving(true);
    }

    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || gained <= 0) {
      setShown(total);
      if (gained > 0) {
        clearRef.current = window.setTimeout(() => {
          setReceiving(false);
          setDelta(null);
        }, 700);
      } else {
        setReceiving(false);
        setDelta(null);
      }
      return () => window.clearTimeout(clearRef.current);
    }

    const start = performance.now();
    const dur = Math.min(720, 260 + Math.abs(gained) * 45);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(from + (total - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setShown(total);
      clearRef.current = window.setTimeout(() => {
        setReceiving(false);
        setDelta(null);
      }, 580);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(clearRef.current);
    };
  }, [total]);

  const pct = weight > 0 ? (total / weight) * 100 : 0;

  return (
    <div
      className={`pol-pc-variant-block tone-${tone}${total > 0 ? ' has-votes' : ''}${receiving ? ' is-receiving' : ''}`}
    >
      <div className="pol-pc-variant-head">
        <span className={`pol-pc-choice-badge is-fa tone-${tone}`} aria-hidden="true">
          <i className={iconClass} />
        </span>
        <div className="pol-pc-variant-text">
          <span className="pol-pc-variant-title">{label}</span>
          <span className="pol-pc-variant-sub">
            {total > 0
              ? `Получает ${total} ${pluralVotes(total)}`
              : 'Не выбран'}
          </span>
        </div>
        <strong className={`pol-pc-variant-count${receiving ? ' is-bump' : ''}`}>
          <span className="pol-pc-variant-count-num">{shown}</span>
          {delta != null && (
            <span className="pol-pc-variant-delta" aria-hidden="true">+{delta}</span>
          )}
        </strong>
      </div>
      <div className="pol-pc-results-bar">
        <span className={`tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Счётчик голосов + OK (колонка «Потрачено» / mobile spent). */
function PolPcSpentControls({
  vote,
  availableInfluence,
  availablePlanets = 0,
  isXxcha = false,
  oneVoteLaw = false,
  disabled = false,
  onAmount,
  onPlanets,
  onConfirm,
}) {
  return (
    <div className={`pol-pc-spent-controls${isXxcha && !oneVoteLaw ? ' has-planets' : ''}`}>
      {!oneVoteLaw ? (
        <label className="pol-pc-amt">
          <span className="pol-pc-amt-label">Голоса</span>
          <input
            type="number"
            min="0"
            max={availableInfluence}
            inputMode="numeric"
            value={vote.amount ? vote.amount : ''}
            placeholder="0"
            disabled={disabled || vote.choice === 'abstain'}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onAmount(0);
                return;
              }
              onAmount(Math.max(0, Math.min(availableInfluence, parseInt(raw, 10) || 0)));
            }}
            onFocus={(e) => e.target.select()}
            className="pol-pc-ctrl pol-pc-amt-input"
          />
        </label>
      ) : (
        <div className="pol-pc-amt">
          <span className="pol-pc-amt-label">Голоса</span>
          <span className="pol-pc-ctrl pol-pc-amt-input is-readonly">
            {vote.choice === 'abstain' ? 0 : 1}
          </span>
        </div>
      )}
      {isXxcha && !oneVoteLaw && (
        <label className="pol-pc-amt tone-planet">
          <span className="pol-pc-amt-label">Планеты</span>
          <input
            type="number"
            min="0"
            max={availablePlanets}
            inputMode="numeric"
            value={vote.planets ? vote.planets : ''}
            placeholder="0"
            disabled={disabled || vote.choice === 'abstain'}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onPlanets(0);
                return;
              }
              onPlanets(Math.max(0, Math.min(availablePlanets, parseInt(raw, 10) || 0)));
            }}
            onFocus={(e) => e.target.select()}
            className="pol-pc-ctrl pol-pc-amt-input"
          />
        </label>
      )}
      <button
        type="button"
        className="pol-pc-ctrl pol-pc-confirm"
        disabled={disabled}
        onClick={onConfirm}
      >
        OK
      </button>
    </div>
  );
}

/**
 * Универсальный picker: игроки или варианты OTHER.
 * options: [{ id, label, iconUrl? }]
 */
function PolPcOptionPicker({
  value,
  options = [],
  onChange,
  disabled = false,
  title = 'Выберите вариант',
}) {
  const [open, setOpen] = useState(false);
  const selected = value !== 'abstain'
    ? options.find(o => String(o.id) === String(value))
    : null;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (choice) => {
    onChange(choice);
    setOpen(false);
  };

  const panel = open
    ? createPortal(
      <>
        <button
          type="button"
          className="pol-pc-picker-backdrop"
          aria-label="Закрыть"
          onClick={() => setOpen(false)}
        />
        <div className="pol-pc-picker-panel" role="listbox">
          <div className="pol-pc-picker-panel-title">{title}</div>
          <button
            type="button"
            role="option"
            aria-selected={value === 'abstain'}
            className={`pol-pc-picker-option tone-abstain${value === 'abstain' ? ' is-selected' : ''}`}
            onClick={() => pick('abstain')}
          >
            <span className="pol-pc-picker-option-icon is-ban">
              <i className="fa-solid fa-ban" aria-hidden="true" />
            </span>
            <span className="pol-pc-picker-option-text">Воздержаться</span>
          </button>
          <div className="pol-pc-picker-list">
            {options.map((opt) => {
              const isOn = String(value) === String(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isOn}
                  className={`pol-pc-picker-option${opt.tone ? ` tone-${opt.tone}` : ''}${isOn ? ' is-selected' : ''}`}
                  onClick={() => pick(opt.id)}
                >
                  {opt.iconUrl ? (
                    <img src={opt.iconUrl} alt="" className="pol-pc-picker-option-icon" />
                  ) : opt.iconClass ? (
                    <span className={`pol-pc-picker-option-icon is-fa${opt.tone ? ` tone-${opt.tone}` : ''}`} aria-hidden="true">
                      <i className={opt.iconClass} />
                    </span>
                  ) : (
                    <span className="pol-pc-picker-option-icon is-num" aria-hidden="true">
                      {opt.badge || '#'}
                    </span>
                  )}
                  <span className="pol-pc-picker-option-text">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <>
      <button
        type="button"
        className={`pol-pc-ctrl pol-pc-picker-btn${open ? ' is-open' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {selected ? (
          <>
            {selected.iconUrl ? (
              <img src={selected.iconUrl} alt="" className="pol-pc-picker-btn-icon" />
            ) : selected.iconClass ? (
              <span className={`pol-pc-picker-btn-ban is-fa${selected.tone ? ` tone-${selected.tone}` : ''}`} aria-hidden="true">
                <i className={selected.iconClass} />
              </span>
            ) : (
              <span className="pol-pc-picker-btn-ban is-num" aria-hidden="true">{selected.badge || '#'}</span>
            )}
            <span className="pol-pc-picker-btn-label">{selected.label}</span>
          </>
        ) : (
          <>
            <i className="fa-solid fa-ban pol-pc-picker-btn-ban" aria-hidden="true" />
            <span className="pol-pc-picker-btn-label">Воздержаться</span>
          </>
        )}
        <i className="fa-solid fa-chevron-down pol-pc-picker-chevron" aria-hidden="true" />
      </button>
      {panel}
    </>
  );
}

function PolPcTargetPicker({ value, players, onChange, disabled = false }) {
  const options = players.map(p => {
    const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
    return { id: p.id, label: p.name, iconUrl: faction?.iconUrl };
  });
  return (
    <PolPcOptionPicker
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      title="Выберите игрока"
    />
  );
}

function PolPcVariantPicker({ value, choices = [], onChange, disabled = false }) {
  const options = choices
    .map((label, index) => (label
      ? { id: String(index), label, badge: String(index + 1) }
      : null))
    .filter(Boolean);
  return (
    <PolPcOptionPicker
      value={value === 'abstain' ? 'abstain' : String(value)}
      options={options}
      onChange={onChange}
      disabled={disabled}
      title="Выберите вариант"
    />
  );
}

const FA_SIDE_OPTIONS = [
  { id: 'for', label: 'За', iconClass: 'fa-solid fa-thumbs-up', tone: 'for' },
  { id: 'against', label: 'Против', iconClass: 'fa-solid fa-thumbs-down', tone: 'against' },
];

/** Сразу кнопки За / Против (без выпадающего списка). Повторный клик → воздержание. */
function PolPcFaButtons({ value, onChange, disabled = false }) {
  const pick = (side) => {
    if (disabled) return;
    onChange(value === side ? 'abstain' : side);
  };
  return (
    <div className="pol-pc-fa-btns" role="group" aria-label="За или против">
      {FA_SIDE_OPTIONS.map((side) => (
        <button
          key={side.id}
          type="button"
          className={`pol-pc-fa-btn tone-${side.tone}${value === side.id ? ' is-on' : ''}`}
          disabled={disabled}
          aria-pressed={value === side.id}
          onClick={() => pick(side.id)}
        >
          <i className={side.iconClass} aria-hidden="true" />
          <span>{side.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Mobile/seat: выбор + счётчик + OK в одном блоке. */
function PolPcVoteRow({
  vote,
  players,
  variantChoices,
  faMode = false,
  availableInfluence,
  availablePlanets = 0,
  isXxcha = false,
  oneVoteLaw = false,
  disabled = false,
  onChoice,
  onAmount,
  onPlanets,
  onConfirm,
}) {
  const useVariants = Array.isArray(variantChoices);
  return (
    <div className={`pol-pc-vote-controls${isXxcha && !oneVoteLaw ? ' has-planets' : ''}`}>
      {faMode ? (
        <PolPcFaButtons
          value={vote.choice}
          disabled={disabled}
          onChange={onChoice}
        />
      ) : useVariants ? (
        <PolPcVariantPicker
          value={vote.choice}
          choices={variantChoices}
          disabled={disabled}
          onChange={onChoice}
        />
      ) : (
        <PolPcTargetPicker
          value={vote.choice}
          players={players}
          disabled={disabled}
          onChange={onChoice}
        />
      )}
      <PolPcSpentControls
        vote={vote}
        availableInfluence={availableInfluence}
        availablePlanets={availablePlanets}
        isXxcha={isXxcha}
        oneVoteLaw={oneVoteLaw}
        disabled={disabled}
        onAmount={onAmount}
        onPlanets={onPlanets}
        onConfirm={onConfirm}
      />
    </div>
  );
}

function PolStepper({
  label,
  value,
  onChange,
  disabled = false,
  tone = 'purple',
}) {
  const n = Math.max(0, Number(value) || 0);
  return (
    <div className={`pol-stepper tone-${tone}`}>
      <div className="pol-stepper-label">{label}</div>
      <div className="pol-stepper-ctrl">
        <button
          type="button"
          className="pol-stepper-btn"
          disabled={disabled || n <= 0}
          onClick={() => onChange(Math.max(0, n - 1))}
          aria-label={`${label}: меньше`}
        >
          −
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          className="pol-stepper-val"
          value={n ? n : ''}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(0);
              return;
            }
            const next = parseInt(raw, 10);
            onChange(Number.isFinite(next) ? Math.max(0, next) : 0);
          }}
          onFocus={(e) => e.target.select()}
          aria-label={label}
        />
        <button
          type="button"
          className="pol-stepper-btn"
          disabled={disabled}
          onClick={() => onChange(n + 1)}
          aria-label={`${label}: больше`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PoliticsModal({
  show,
  minimized,
  onMinimize,
  onClose,
  politicsStep,
  setPoliticsStep,
  agendas,
  currentAgendaIndex,
  activePlayers,
  speakerId,
  onSetAgendaType,
  onSetCustomChoices,
  onSetVote,
  onLockVote,
  onSetInfluence,
  onLockInfluence,
  onUnlockInfluence,
  onToggleVoteReversed,
  onToggleOneVoteLaw,
  onSetSpeaker: _onSetSpeaker,
  onNextAgenda,
  onSkipAgenda,
  onRevealAgenda,
  onSelectMiscountLaw,
  onSpeakerAgendaDecision,
  activeLaws = [],
  onFinish,
  voteOrder = [],
  currentVoterId = null,
  influenceLocked = {},
  voteReversed = false,
  oneVoteLaw = false,
  allInfluenceLocked = false,
  perms,
  readOnly = false,
  /** Full game state — used for Argent Zeal vote bonus. */
  game = null,
}) {
  const role = perms?.role || ROLES.ADMIN;
  const seatId = perms?.seatPlayerId;
  const isAdmin = role === ROLES.ADMIN;
  const canAdmin = isAdmin && !readOnly;
  /** Seated player client (not host/viewer) — on mobile see only own ballot. */
  const isSeatPlayer = !isAdmin && seatId != null;
  /** Speaker handoff after voting is host-only. */
  const openForClient = politicsStep !== 'SPEAKER' || isAdmin;
  const wantOpen = show && !minimized && openForClient;

  const EXIT_MS = 320;
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unveilAnim, setUnveilAnim] = useState(false);

  useEscapeKey(onClose, wantOpen);
  useBodyScrollLock(wantOpen);

  useEffect(() => {
    if (!show || !openForClient) {
      setEntered(false);
      setMounted(false);
      return undefined;
    }
    if (wantOpen) {
      setMounted(true);
      setEntered(false);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(frame);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [wantOpen, show, openForClient]);

  const liveAgenda = agendas?.[currentAgendaIndex];
  const liveFaceKey = liveAgenda?.cardId && liveAgenda?.revealed
    ? `${currentAgendaIndex}:${liveAgenda.cardId}:face`
    : null;
  const liveCovertKey = liveAgenda?.hiddenRevealed
    ? `${currentAgendaIndex}:${liveAgenda.hidden?.cardId || ''}:covert`
    : null;

  // Smooth unveil when speaker opens the law (or Covert nested card).
  useEffect(() => {
    const key = liveCovertKey || liveFaceKey;
    if (!key) {
      setUnveilAnim(false);
      return undefined;
    }
    setUnveilAnim(true);
    const t = window.setTimeout(() => setUnveilAnim(false), 1100);
    return () => window.clearTimeout(t);
  }, [liveFaceKey, liveCovertKey]);

  if (!show || !openForClient || !mounted) return null;

  // Solo / admin can edit any; player only own seat.
  const canEditPlayer = (playerId) => {
    if (readOnly) return false;
    if (isAdmin) return true;
    return seatId != null && playerId === seatId;
  };

  const currentAgenda = agendas[currentAgendaIndex];

  const setAgendaType = onSetAgendaType;
  const setAgendaVotes = onSetVote;
  const lockVote = onLockVote;
  const handleNextAgenda = onNextAgenda;
  const handleSkipAgenda = onSkipAgenda || onNextAgenda;
  const setCustomChoices = onSetCustomChoices;
  /** Speaker seat (not host-by-role) flips laws face-up. */
  const isSpeakerSeat = seatId != null && speakerId != null && String(seatId) === String(speakerId);
  const isCovert = !!(currentAgenda?.covert && currentAgenda?.hidden?.cardId);
  const isMiscount = !!currentAgenda?.miscount;
  const faceUp = isAgendaFaceUp(currentAgenda);
  const miscountReady = !!(isMiscount && currentAgenda.miscountRevote && currentAgenda.revote);
  const miscountNeedsPick = !!(isMiscount && faceUp && !currentAgenda.miscountRevote);
  const covertRevealed = !!(isCovert && currentAgenda.hiddenRevealed);
  /** Nested Covert text: speaker may peek; public only after unveil. */
  const canSeeCovertHidden = isCovert && faceUp && (covertRevealed || isSpeakerSeat);
  const canPickMiscount = miscountNeedsPick
    && !readOnly
    && (isSpeakerSeat || canAdmin)
    && typeof onSelectMiscountLaw === 'function'
    && (activeLaws || []).length > 0;
  const revealedCard = currentAgenda?.cardId && faceUp
    ? (isCovert
      ? {
        title: currentAgenda.title,
        kind: currentAgenda.kind,
        elect: currentAgenda.elect,
        desc: currentAgenda.desc,
        covert: true,
        shrouded: !canSeeCovertHidden,
        outcomeLabel: covertOutcomeLabel(currentAgenda.type || currentAgenda.hidden?.voteType),
        hidden: canSeeCovertHidden
          ? {
            title: currentAgenda.hidden.title,
            kind: currentAgenda.hidden.kind,
            desc: currentAgenda.hidden.desc,
            effect: agendaEffectText({
              voteType: currentAgenda.hidden.voteType || currentAgenda.type,
              forText: currentAgenda.hidden.forText,
              againstText: currentAgenda.hidden.againstText,
              text: currentAgenda.hidden.text,
            }),
          }
          : null,
        speakerHint: isSpeakerSeat && !covertRevealed,
      }
      : {
        title: currentAgenda.title,
        kind: currentAgenda.kind,
        elect: currentAgenda.elect,
        desc: currentAgenda.desc,
        effect: agendaEffectText({
          voteType: currentAgenda.type || 'OTHER',
          forText: currentAgenda.forText,
          againstText: currentAgenda.againstText,
          text: currentAgenda.text,
        }),
        miscount: isMiscount,
        revote: miscountReady
          ? {
            title: currentAgenda.revote.title,
            desc: currentAgenda.revote.desc,
            effect: agendaEffectText({
              voteType: currentAgenda.revote.voteType || currentAgenda.type,
              forText: currentAgenda.revote.forText,
              againstText: currentAgenda.revote.againstText,
              text: currentAgenda.revote.text,
            }),
          }
          : null,
      })
    : null;

  const voteTotals = (() => {
    if (!currentAgenda?.type) return {};
    const totals = {};
    const stateForBonus = game || {
      players: activePlayers,
      meta: {},
    };
    Object.entries(currentAgenda.votes).forEach(([playerId, vote]) => {
      if (!currentAgenda.locked[playerId] || !vote || vote.choice === 'abstain') return;
      const player = activePlayers.find(p => String(p.id) === String(playerId));
      const amount = effectiveVoteAmount(stateForBonus, player, vote);
      if (amount > 0) {
        totals[vote.choice] = (totals[vote.choice] || 0) + amount;
      }
    });
    return totals;
  })();

  const argentBonus = game
    ? argentFlightVoteBonus(game)
    : activePlayers.filter(p => !p.eliminated).length;

  const allVotedOnCurrentAgenda = isAgendaFullyVoted(currentAgenda, activePlayers);
  const completedAgendasCount = agendas.filter((agenda) =>
    isAgendaFullyVoted(agenda, activePlayers)
  ).length;
  const needsFaceReveal = !!(currentAgenda?.cardId && !faceUp);
  const needsCovertUnveil = isCovert && faceUp && !covertRevealed && allVotedOnCurrentAgenda;
  const canRevealAgenda = (needsFaceReveal || needsCovertUnveil)
    && !readOnly
    && (isSpeakerSeat || canAdmin)
    && typeof onRevealAgenda === 'function';
  const waitingAgendaReveal = needsFaceReveal || needsCovertUnveil;

  const currentSpeaker = activePlayers.find(p => p.id === speakerId);
  const orderedForVote = voteOrder.length ? voteOrder : activePlayers;
  const hasXxcha = activePlayers.some(isXxchaPlayer);
  const forVotes = Number(voteTotals.for) || 0;
  const againstVotes = Number(voteTotals.against) || 0;
  const faCastWeight = forVotes + againstVotes;
  const lockedCount = activePlayers.filter((p) => !!influenceLocked[p.id]).length;

  const subtitle = politicsStep === 'SETUP'
    ? (oneVoteLaw
      ? 'Активен закон «1 голос»: влияние не вводится — каждый отдаёт ровно один голос.'
      : 'Каждый игрок указывает своё влияние (голоса) на фазу и подтверждает.')
    : politicsStep === 'VOTE'
      ? (currentAgenda?.type === 'PLAYER_CHOICE'
        ? 'Выберите игрока, на которого будет применён эффект закона'
        : currentAgenda?.type === 'OTHER'
          ? 'Выберите вариант и отдайте голоса'
          : 'Голосование по законам повестки.')
      : 'Передача жетона Спикера.';

  const pcDistributed = Object.values(voteTotals).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const needsSpeakerBreak = !!(
    currentAgenda
    && allVotedOnCurrentAgenda
    && !needsFaceReveal
    && !needsCovertUnveil
    && !miscountNeedsPick
    && (game
      ? agendaNeedsSpeakerBreak(game, currentAgenda)
      : (
        currentAgenda.type === 'FOR_AGAINST'
          ? forVotes === againstVotes
          : (() => {
            const entries = Object.entries(voteTotals).filter(([, w]) => (Number(w) || 0) > 0);
            if (!entries.length) return true;
            const max = Math.max(...entries.map(([, w]) => Number(w) || 0));
            return entries.filter(([, w]) => (Number(w) || 0) === max).length > 1;
          })()
      ))
  );
  const speakerDecisionPending = needsSpeakerBreak
    && (currentAgenda.speakerDecision == null || currentAgenda.speakerDecision === '');
  const canPickSpeakerDecision = needsSpeakerBreak
    && !readOnly
    && (isSpeakerSeat || canAdmin)
    && typeof onSpeakerAgendaDecision === 'function';
  const speakerDecisionReason = !needsSpeakerBreak
    ? ''
    : currentAgenda?.type === 'FOR_AGAINST'
      ? (forVotes === 0 && againstVotes === 0
        ? 'Голосов нет (0–0) — спикер выбирает исход.'
        : `Ничья ${forVotes}:${againstVotes} — спикер выбирает исход.`)
      : (pcDistributed <= 0
        ? 'Голосов нет — спикер выбирает исход.'
        : 'Ничья по вариантам — спикер выбирает исход.');
  const playerPcPool = (p) => {
    if (oneVoteLaw) return 1;
    const spentPrev = agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
      const playerVote = agenda.votes[p.id];
      if (playerVote && agenda.locked[p.id]) return acc + (playerVote.amount || 0);
      return acc;
    }, 0);
    const planetsPrev = agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
      const playerVote = agenda.votes[p.id];
      if (playerVote && agenda.locked[p.id]) return acc + (Number(playerVote.planets) || 0);
      return acc;
    }, 0);
    const availInf = Math.max(0, (p.influence || 0) - spentPrev);
    const availPlanets = isXxchaPlayer(p)
      ? Math.max(0, (p.votePlanets || 0) - planetsPrev)
      : 0;
    return availInf + availPlanets;
  };
  /** Полный пул (для полоски). */
  const pcTotalPool = orderedForVote.reduce((sum, p) => sum + playerPcPool(p), 0);
  /**
   * Осталось отдать: сумма пулов только тех, кто ещё не зафиксировал голос.
   * Проголосовавший игрок в эту сумму не входит целиком.
   */
  const pcRemaining = orderedForVote.reduce((sum, p) => {
    if (currentAgenda?.locked?.[p.id]) return sum;
    return sum + playerPcPool(p);
  }, 0);
  const pcRemainPct = pcTotalPool > 0 ? Math.min(100, (pcRemaining / pcTotalPool) * 100) : 0;

  return (
    <div
      className={`pol-overlay fixed inset-0 z-50 game-modal-overlay flex items-stretch md:items-center justify-center md:p-4 modal-overlay ${entered ? 'is-open' : 'is-tucking'}`}
      role="presentation"
      onClick={wantOpen ? (onMinimize || onClose) : undefined}
      style={entered ? undefined : { pointerEvents: 'none' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="politics-modal-title"
        className={`pol-shell relative w-full max-md:h-full md:w-full flex flex-col overflow-hidden ${entered ? 'is-open' : 'is-tucking'} ${
          politicsStep === 'VOTE' && (
            currentAgenda?.type === 'FOR_AGAINST'
            || currentAgenda?.type === 'PLAYER_CHOICE'
            || currentAgenda?.type === 'OTHER'
          )
            ? 'pol-shell--pc'
            : 'md:max-w-5xl md:h-auto md:max-h-[min(94vh,960px)]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pol-shell-head flex-shrink-0">
          <div className="pol-shell-head-main min-w-0">
            <div className="pol-shell-mark" aria-hidden="true">
              <i className="fa-solid fa-gavel" />
            </div>
            <div className="min-w-0">
              <h2 id="politics-modal-title" className="pol-shell-title">
                Фаза политики
              </h2>
              <p className="pol-shell-sub">{subtitle}</p>
              {politicsStep === 'SETUP' && !oneVoteLaw && hasXxcha && (
                <p className="pol-shell-xxcha">
                  Ззча также указывает число планет: при голосовании каждая перевёрнутая планета даёт +1 голос.
                </p>
              )}
              {canAdmin && (
                <button
                  type="button"
                  onClick={onToggleOneVoteLaw}
                  className={`pol-law-chip ${oneVoteLaw ? 'is-on' : ''}`}
                  title="Закон: каждый игрок голосует ровно 1 голосом без доп. голосов и без ввода влияния"
                >
                  <i className="fa-solid fa-circle-info" aria-hidden="true" />
                  {oneVoteLaw ? 'Закон: 1 голос' : 'Закон: 1 голос — выкл'}
                </button>
              )}
              {!canAdmin && oneVoteLaw && (
                <span className="pol-law-chip is-on is-readonly">Закон: 1 голос</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onMinimize}
            className="pol-icon-btn pol-icon-btn--corner"
            aria-label="Свернуть"
            title="Свернуть"
          >
            <i className="fa-solid fa-window-minimize text-base" aria-hidden="true" />
          </button>
        </header>

        <div className="pol-shell-body min-h-0 flex-1 overflow-y-auto modal-scroll">
          {politicsStep === 'SETUP' && oneVoteLaw && (
            <div className="pol-setup-law">
              <p className="pol-setup-law-text">
                Активен закон «1 голос»: влияние не вводится — каждый отдаёт ровно один голос.
              </p>
            </div>
          )}

          {politicsStep === 'SETUP' && !oneVoteLaw && (
            <ol className="pol-seat-list">
              {activePlayers.map((p, idx) => {
                const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
                const locked = !!influenceLocked[p.id];
                const editable = canEditPlayer(p.id) && !locked;
                const isXxcha = isXxchaPlayer(p);
                const accent = p.color || '#a78bfa';
                const isMine = seatId != null && p.id === seatId;
                // Mobile seat client: only own influence row (host/admin still sees all).
                const hideOnMobile = isSeatPlayer && !isMine;
                return (
                  <li
                    key={p.id}
                    className={`pol-seat-row ${locked ? 'is-locked' : ''}${hideOnMobile ? ' is-other-mobile' : ''}${isXxcha ? ' has-planets' : ''}`}
                    style={{ '--pol-seat-accent': accent }}
                  >
                    <div className="pol-seat-identity">
                      <span className="pol-seat-idx" aria-hidden="true">{idx + 1}</span>
                      <img
                        src={faction?.iconUrl}
                        alt=""
                        className="pol-seat-icon"
                      />
                      <div className="pol-seat-meta min-w-0">
                        <div className="pol-seat-name truncate">{p.name}</div>
                        {isXxcha && !locked && (
                          <span className="pol-seat-xxcha-tag">+1 планета</span>
                        )}
                        {locked && (
                          <span className="pol-seat-ready-tag">
                            <i className="fa-solid fa-check" aria-hidden="true" />
                            Готово
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pol-seat-controls">
                      {isXxcha && (
                        <PolStepper
                          label="Планеты"
                          tone="green"
                          value={p.votePlanets || 0}
                          disabled={!editable}
                          onChange={(next) => onSetInfluence(p.id, p.influence || 0, next)}
                        />
                      )}
                      <PolStepper
                        label="Влияние"
                        tone="purple"
                        value={p.influence || 0}
                        disabled={!editable}
                        onChange={(next) => onSetInfluence(
                          p.id,
                          next,
                          isXxcha ? (p.votePlanets || 0) : undefined,
                        )}
                      />
                      {canEditPlayer(p.id) && !locked && (
                        <button
                          type="button"
                          onClick={() => onLockInfluence(p.id)}
                          className="pol-ok-btn"
                        >
                          OK
                        </button>
                      )}
                      {locked && (
                        canAdmin ? (
                          <button
                            type="button"
                            onClick={() => onUnlockInfluence(p.id)}
                            className="pol-ok-btn is-confirmed"
                            title="Игрок подтвердил — нажмите, чтобы изменить"
                          >
                            Изменить
                          </button>
                        ) : (
                          <span className="pol-ok-btn is-confirmed" aria-hidden="true">
                            <i className="fa-solid fa-check" />
                          </span>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {politicsStep === 'VOTE' && (
            <div className={`pol-vote ${
              currentAgenda?.type === 'FOR_AGAINST'
              || currentAgenda?.type === 'PLAYER_CHOICE'
              || currentAgenda?.type === 'OTHER'
                ? 'pol-vote--pc space-y-3'
                : 'space-y-4'
            }`}>
              <div className="pol-vote-toolbar">
                {canAdmin && !oneVoteLaw ? (
                  <button type="button" onClick={() => setPoliticsStep('SETUP')} className="pol-vote-back">
                    <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                    Назад к голосам
                  </button>
                ) : <span />}
                <div className="pol-vote-law-title">Закон №{currentAgendaIndex + 1}</div>
                {canAdmin && (
                  <button
                    type="button"
                    onClick={onToggleVoteReversed}
                    className={`pol-vote-order-btn ${voteReversed ? 'is-on' : ''}`}
                    title="Обратный порядок от спикера. Серебряная Стая всё равно голосует первой."
                  >
                    <i className={`fa-solid ${voteReversed ? 'fa-arrow-rotate-left' : 'fa-arrows-rotate'}`} aria-hidden="true" />
                    {voteReversed ? 'Обратный порядок' : 'Обычный порядок'}
                  </button>
                )}
              </div>

              {oneVoteLaw && (
                <div className="text-xs text-amber-200/90 bg-amber-950/25 border border-amber-700/40 rounded-xl px-3 py-2">
                  Закон «1 голос»: каждый игрок отдаёт ровно 1 голос (без влияния, Zeal, планет Ззча и других надбавок).
                </div>
              )}

              <div className={`pol-vote-order-bar ${isSeatPlayer ? 'max-md:hidden' : ''}`}>
                <span className="pol-vote-order-label">
                  Порядок голосования{voteReversed ? ' (обратный)' : ''}:
                </span>
                <ol className="pol-vote-order-list">
                  {orderedForVote.map((p, i) => (
                    <li key={p.id} className="pol-vote-order-slot">
                      <div
                        className={`pol-vote-order-chip ${p.id === currentVoterId ? 'is-current' : ''} ${currentAgenda?.locked?.[p.id] ? 'is-done' : ''} ${p.id === speakerId ? 'is-speaker' : ''}`}
                        style={{ '--chip-color': p.color || '#a78bfa' }}
                      >
                        <span className="pol-vote-order-chip-accent" aria-hidden="true" />
                        <span className="pol-vote-order-name">
                          {p.name}
                          {p.factionId === 'argent' ? ' ★' : ''}
                          {p.factionId === 'xxcha' ? ' ◆' : ''}
                        </span>
                        {p.id === speakerId && (
                          <span className="pol-vote-order-chip-tag">спикер</span>
                        )}
                      </div>
                      {i < orderedForVote.length - 1 && (
                        <span className="pol-vote-order-sep" aria-hidden="true">→</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>

              {isSeatPlayer && (
                <div className="md:hidden text-xs text-slate-400 bg-slate-950/70 border border-violet-800/40 rounded-xl px-3 py-2">
                  Сейчас голосует:{' '}
                  <span className="text-amber-300 font-bold">
                    {orderedForVote.find(p => p.id === currentVoterId)?.name || '—'}
                  </span>
                </div>
              )}

              {!currentAgenda?.type && (
                <div className="pol-card-reveal is-pending">
                  <p className="text-center text-sm text-slate-400 py-6">
                    {canAdmin
                      ? 'Колода готовит карту… Если пусто — нажмите «Перейти к голосованию» ещё раз или следующий закон.'
                      : 'Ожидание раскрытия карты повестки…'}
                  </p>
                  {canAdmin && (
                    <div className="pol-type-pick">
                      <h3 className="pol-type-pick-title">Запасной выбор типа (без карты)</h3>
                      <div className="pol-type-grid">
                        <button type="button" onClick={() => setAgendaType('FOR_AGAINST')} className="pol-type-card tone-for">
                          <span className="pol-type-name">За / Против</span>
                        </button>
                        <button type="button" onClick={() => setAgendaType('PLAYER_CHOICE')} className="pol-type-card tone-player">
                          <span className="pol-type-name">Выбор игрока</span>
                        </button>
                        <button type="button" onClick={() => setAgendaType('OTHER')} className="pol-type-card tone-other">
                          <span className="pol-type-name">Другой выбор</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentAgenda?.cardId && !faceUp && (
                <div className="pol-card-reveal is-sealed is-covert">
                  <div className="pol-card-reveal-top">
                    <span className="pol-card-reveal-kind">
                      Повестка
                      {currentAgendaIndex != null ? ` · #${currentAgendaIndex + 1}` : ''}
                    </span>
                    <h3 className="pol-card-reveal-title">Закон ещё не открыт</h3>
                    <p className="pol-card-reveal-desc">
                      Хост начал голосование. Спикер открывает карту для всех.
                    </p>
                  </div>
                  <div className="pol-covert-reveal-bar">
                    {canRevealAgenda ? (
                      <button
                        type="button"
                        className="pol-covert-reveal-btn"
                        onClick={onRevealAgenda}
                      >
                        <i className="fa-solid fa-scroll" aria-hidden="true" />
                        Открыть закон
                      </button>
                    ) : (
                      <p className="pol-covert-reveal-wait">
                        Ожидание спикера — откроет закон…
                      </p>
                    )}
                  </div>
                </div>
              )}

              {currentAgenda?.cardId && faceUp && (
                <>
                  {revealedCard && (
                    <div
                      className={[
                        'pol-card-reveal',
                        revealedCard.kind === 'law' ? 'is-law' : 'is-directive',
                        revealedCard.covert ? 'is-covert' : '',
                        revealedCard.shrouded ? 'is-shrouded' : '',
                        unveilAnim && !needsCovertUnveil ? 'is-unveiling' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="pol-card-reveal-top">
                        <span className="pol-card-reveal-kind">
                          {revealedCard.covert
                            ? 'Тайный законопроект'
                            : revealedCard.miscount
                              ? 'Пересчёт'
                              : (revealedCard.kind === 'law' ? 'Закон' : 'Директива')}
                          {currentAgendaIndex != null ? ` · #${currentAgendaIndex + 1}` : ''}
                        </span>
                        <h3 className="pol-card-reveal-title">{revealedCard.title}</h3>
                        {revealedCard.desc && !revealedCard.shrouded && !revealedCard.hidden && (
                          <p className="pol-card-reveal-desc">{revealedCard.desc}</p>
                        )}
                      </div>
                      {revealedCard.shrouded && (
                        <div className="pol-card-reveal-effect pol-card-reveal-shroud">
                          <p>
                            Скрытая agenda. Текст видит только спикер.
                            Голосуйте по допустимым исходам, не зная эффектов.
                          </p>
                          {revealedCard.outcomeLabel && (
                            <p className="pol-card-reveal-outcomes">
                              Исходы: <strong>{revealedCard.outcomeLabel}</strong>
                            </p>
                          )}
                        </div>
                      )}
                      {revealedCard.speakerHint && (
                        <p className="pol-card-reveal-desc">
                          Вы спикер — ниже скрытая карта. После голосования нажмите «Открыть закон».
                        </p>
                      )}
                      {revealedCard.hidden && (
                        <div
                          className={[
                            'pol-card-reveal',
                            'pol-card-reveal-nested',
                            revealedCard.hidden.kind === 'law' ? 'is-law' : 'is-directive',
                            covertRevealed ? 'is-public' : 'is-speaker-preview',
                            unveilAnim && covertRevealed ? 'is-unveiling' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <div className="pol-card-reveal-top">
                            <span className="pol-card-reveal-kind">
                              {covertRevealed ? 'Раскрыто' : 'Только спикер'}
                              {' · '}
                              {revealedCard.hidden.kind === 'law' ? 'Закон' : 'Директива'}
                            </span>
                            <h3 className="pol-card-reveal-title">{revealedCard.hidden.title}</h3>
                            {revealedCard.hidden.desc && (
                              <p className="pol-card-reveal-desc">{revealedCard.hidden.desc}</p>
                            )}
                          </div>
                          {revealedCard.hidden.effect && (
                            <div className="pol-card-reveal-effect">
                              {revealedCard.hidden.effect.split('\n\n').map((block, i) => (
                                <p key={i}>{block}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {revealedCard.effect && (
                        <div className="pol-card-reveal-effect">
                          {revealedCard.effect.split('\n\n').map((block, i) => (
                            <p key={i}>{block}</p>
                          ))}
                        </div>
                      )}
                      {revealedCard.revote && (
                        <div className="pol-card-reveal pol-card-reveal-nested is-law is-unveiling">
                          <div className="pol-card-reveal-top">
                            <span className="pol-card-reveal-kind">Повторное голосование · Закон</span>
                            <h3 className="pol-card-reveal-title">{revealedCard.revote.title}</h3>
                            {revealedCard.revote.desc && (
                              <p className="pol-card-reveal-desc">{revealedCard.revote.desc}</p>
                            )}
                          </div>
                          <div className="pol-miscount-mode">
                            Режим голосования:{' '}
                            <strong>
                              {currentAgenda.type === 'FOR_AGAINST'
                                ? 'За / Против'
                                : currentAgenda.type === 'PLAYER_CHOICE'
                                  ? 'Избрать игрока'
                                  : `Особый выбор (${electTargetLabel(currentAgenda.revote?.elect || currentAgenda.elect)})`}
                            </strong>
                          </div>
                          {revealedCard.revote.effect && (
                            <div className="pol-card-reveal-effect">
                              {revealedCard.revote.effect.split('\n\n').map((block, i) => (
                                <p key={i}>{block}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {miscountNeedsPick && (
                        <div className="pol-miscount-pick">
                          {(activeLaws || []).length === 0 ? (
                            <p className="pol-covert-reveal-wait">
                              Нет принятых законов — хост нажимает «Пропустить закон».
                            </p>
                          ) : (
                            <>
                              <p className="pol-card-reveal-desc">
                                {canPickMiscount
                                  ? 'Выберите закон для повторного голосования.'
                                  : 'Спикер выбирает закон для пересчёта…'}
                              </p>
                              {canPickMiscount && (
                                <div className="pol-miscount-law-grid">
                                  {(activeLaws || []).map((law) => {
                                    const vt = voteTypeForLaw(law);
                                    const mode = vt === 'FOR_AGAINST'
                                      ? 'За / Против'
                                      : vt === 'PLAYER_CHOICE'
                                        ? 'Избрать игрока'
                                        : `Выбор · ${electTargetLabel(law.elect)}`;
                                    return (
                                      <button
                                        key={law.id}
                                        type="button"
                                        className="pol-miscount-law-btn"
                                        onClick={() => onSelectMiscountLaw(law.id)}
                                      >
                                        <span className="pol-miscount-law-label">Выбрать · {mode}</span>
                                        <span className="pol-miscount-law-title">{law.title}</span>
                                        {law.desc && (
                                          <span className="pol-miscount-law-desc">{law.desc}</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {needsCovertUnveil && (
                        <div className="pol-covert-reveal-bar">
                          {canRevealAgenda ? (
                            <button
                              type="button"
                              className="pol-covert-reveal-btn"
                              onClick={onRevealAgenda}
                            >
                              <i className="fa-solid fa-scroll" aria-hidden="true" />
                              Открыть закон
                            </button>
                          ) : (
                            <p className="pol-covert-reveal-wait">
                              Голоса собраны — спикер открывает закон…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(currentAgenda.type === 'FOR_AGAINST' || currentAgenda.type === 'PLAYER_CHOICE' || currentAgenda.type === 'OTHER')
                    && (!isMiscount || miscountReady)
                    && !isSeatPlayer && (
                    <div className="pol-pc">
                      {currentAgenda.type === 'OTHER' && (canAdmin || isSpeakerSeat) && (
                        <div className="pol-pc-choices-editor">
                          <h4 className="pol-pc-summary-title">
                            Настройка вариантов
                            {miscountReady
                              ? ` · ${electTargetLabel(currentAgenda.revote?.elect || currentAgenda.elect)}`
                              : ''}
                          </h4>
                          <div className="pol-pc-choices-grid">
                            {(currentAgenda.customChoices || []).map((choice, index) => {
                              const letter = String.fromCharCode(65 + (index % 26));
                              const canRemove = (currentAgenda.customChoices || []).length > 1;
                              return (
                                <div key={index} className={`pol-pc-choice-block tone-${index % 4}`}>
                                  <span className="pol-pc-choice-badge" aria-hidden="true">{letter}</span>
                                  <div className="pol-pc-choice-body">
                                    <input
                                      type="text"
                                      value={choice}
                                      onChange={(e) => {
                                        const newChoices = [...currentAgenda.customChoices];
                                        newChoices[index] = e.target.value;
                                        setCustomChoices(newChoices);
                                      }}
                                      placeholder={`Вариант ${letter}`}
                                      className="pol-pc-choice-input"
                                      aria-label={`Вариант ${letter}`}
                                    />
                                    <span className="pol-pc-choice-hint">
                                      {choice.trim() ? 'Готов к голосованию' : 'Введите текст варианта'}
                                    </span>
                                  </div>
                                  {canRemove && (
                                    <button
                                      type="button"
                                      className="pol-pc-choice-remove"
                                      aria-label={`Удалить вариант ${letter}`}
                                      onClick={() => {
                                        const next = currentAgenda.customChoices.filter((_, i) => i !== index);
                                        setCustomChoices(next.length ? next : ['']);
                                      }}
                                    >
                                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            <button
                              type="button"
                              className="pol-pc-choice-add"
                              onClick={() => setCustomChoices([...(currentAgenda.customChoices || []), ''])}
                            >
                              <i className="fa-solid fa-plus" aria-hidden="true" />
                              <span>Добавить вариант</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pol-pc-summary">
                        <div className="pol-pc-results">
                          <h4 className="pol-pc-summary-title">
                            {currentAgenda.type === 'OTHER'
                              ? 'Варианты ответов'
                              : currentAgenda.type === 'FOR_AGAINST'
                                ? 'Итоги голосования'
                                : 'Текущие результаты'}
                          </h4>
                          {currentAgenda.type === 'FOR_AGAINST' ? (
                            <div className="pol-pc-variant-grid pol-pc-variant-grid--fa">
                              <PolFaSideResult
                                label="За"
                                total={forVotes}
                                tone="for"
                                iconClass="fa-solid fa-thumbs-up"
                                weight={faCastWeight}
                              />
                              <PolFaSideResult
                                label="Против"
                                total={againstVotes}
                                tone="against"
                                iconClass="fa-solid fa-thumbs-down"
                                weight={faCastWeight}
                              />
                            </div>
                          ) : currentAgenda.type === 'OTHER' ? (
                            (currentAgenda.customChoices || []).some((c) => String(c || '').trim()) ? (
                              <div className="pol-pc-variant-grid">
                                {(currentAgenda.customChoices || []).map((label, index) => {
                                  if (!String(label || '').trim()) return null;
                                  const total = voteTotals[String(index)] || voteTotals[index] || 0;
                                  const pct = pcDistributed > 0 ? (total / pcDistributed) * 100 : 0;
                                  const letter = String.fromCharCode(65 + (index % 26));
                                  return (
                                    <div
                                      key={index}
                                      className={`pol-pc-variant-block tone-${index % 4}${total > 0 ? ' has-votes' : ''}`}
                                    >
                                      <div className="pol-pc-variant-head">
                                        <span className="pol-pc-choice-badge" aria-hidden="true">{letter}</span>
                                        <div className="pol-pc-variant-text">
                                          <span className="pol-pc-variant-title">{label}</span>
                                          <span className="pol-pc-variant-sub">
                                            {total > 0 ? `Получает ${total} ${pluralVotes(total)}` : 'Не выбран'}
                                          </span>
                                        </div>
                                        <strong className="pol-pc-variant-count">{total}</strong>
                                      </div>
                                      <div className="pol-pc-results-bar">
                                        <span style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="pol-pc-empty">Добавьте варианты ответов выше.</p>
                            )
                          ) : Object.keys(voteTotals).length > 0 ? (
                            <ul className="pol-pc-results-list">
                              {Object.entries(voteTotals).sort((a, b) => b[1] - a[1]).map(([choice, total]) => {
                                const pct = pcDistributed > 0 ? (total / pcDistributed) * 100 : 0;
                                const target = activePlayers.find(pl => String(pl.id) === String(choice));
                                const tf = target ? ALL_FACTIONS.find(f => f.id === target.factionId) : null;
                                return (
                                  <li key={choice} className="pol-pc-results-item">
                                    <div className="pol-pc-results-head">
                                      {target ? (
                                        <>
                                          <img src={tf?.iconUrl} alt="" className="pol-pc-icon sm" />
                                          <span>{target.name}</span>
                                        </>
                                      ) : (
                                        <span>Вариант {choice}</span>
                                      )}
                                      <strong>{total}</strong>
                                    </div>
                                    <div className="pol-pc-results-bar">
                                      <span style={{ width: `${pct}%` }} />
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="pol-pc-empty">Голоса ещё не отданы.</p>
                          )}
                        </div>
                        <div className="pol-pc-total">
                          <h4 className="pol-pc-summary-title">Всего голосов</h4>
                          <div className="pol-pc-total-num">{pcRemaining}</div>
                          <div className="pol-pc-total-caption">осталось</div>
                          <div className="pol-pc-total-bar">
                            <span style={{ width: `${pcRemainPct}%` }} />
                          </div>
                        </div>
                      </div>

                      {needsSpeakerBreak && (
                        <div className="pol-speaker-break">
                          <div className="pol-speaker-break-head">
                            <i className="fa-solid fa-gavel" aria-hidden="true" />
                            <div>
                              <div className="pol-speaker-break-title">Решение спикера</div>
                              <p className="pol-speaker-break-reason">{speakerDecisionReason}</p>
                            </div>
                          </div>
                          {canPickSpeakerDecision ? (
                            <div className="pol-speaker-break-actions">
                              {currentAgenda.type === 'FOR_AGAINST' && (
                                <>
                                  <button
                                    type="button"
                                    className={`pol-speaker-break-btn is-for${currentAgenda.speakerDecision === 'for' ? ' is-on' : ''}`}
                                    onClick={() => onSpeakerAgendaDecision('for')}
                                  >
                                    <i className="fa-solid fa-thumbs-up" aria-hidden="true" />
                                    За
                                  </button>
                                  <button
                                    type="button"
                                    className={`pol-speaker-break-btn is-against${currentAgenda.speakerDecision === 'against' ? ' is-on' : ''}`}
                                    onClick={() => onSpeakerAgendaDecision('against')}
                                  >
                                    <i className="fa-solid fa-thumbs-down" aria-hidden="true" />
                                    Против
                                  </button>
                                </>
                              )}
                              {currentAgenda.type === 'PLAYER_CHOICE' && activePlayers.map((p) => {
                                const faction = ALL_FACTIONS.find((f) => f.id === p.factionId);
                                const on = String(currentAgenda.speakerDecision) === String(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className={`pol-speaker-break-btn is-elect${on ? ' is-on' : ''}`}
                                    onClick={() => onSpeakerAgendaDecision(p.id)}
                                  >
                                    {faction?.iconUrl && (
                                      <img src={faction.iconUrl} alt="" className="pol-speaker-break-ico" />
                                    )}
                                    {p.name}
                                  </button>
                                );
                              })}
                              {currentAgenda.type === 'OTHER' && (currentAgenda.customChoices || []).map((label, index) => {
                                if (!String(label || '').trim()) return null;
                                const on = String(currentAgenda.speakerDecision) === String(index);
                                return (
                                  <button
                                    key={index}
                                    type="button"
                                    className={`pol-speaker-break-btn is-elect${on ? ' is-on' : ''}`}
                                    onClick={() => onSpeakerAgendaDecision(index)}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="pol-speaker-break-wait">
                              {speakerDecisionPending
                                ? 'Ожидание решения спикера…'
                                : `Выбрано: ${
                                  currentAgenda.type === 'FOR_AGAINST'
                                    ? (currentAgenda.speakerDecision === 'for' ? 'За' : 'Против')
                                    : currentAgenda.type === 'PLAYER_CHOICE'
                                      ? (activePlayers.find((p) => String(p.id) === String(currentAgenda.speakerDecision))?.name || '—')
                                      : ((currentAgenda.customChoices || [])[Number(currentAgenda.speakerDecision)] || '—')
                                }`}
                            </p>
                          )}
                          {canPickSpeakerDecision && !speakerDecisionPending && (
                            <p className="pol-speaker-break-picked">
                              Решение принято — можно переходить к следующему закону.
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pol-pc-table-wrap">
                        <table className="pol-pc-table">
                          <thead>
                            <tr>
                              <th className="pol-pc-col-num">#</th>
                              <th className="pol-pc-col-player">Игрок</th>
                              <th className="pol-pc-col-inf">{oneVoteLaw ? 'Голосов' : 'Влияние'}</th>
                              <th className="pol-pc-col-for">
                                {currentAgenda.type === 'FOR_AGAINST'
                                  ? 'Выбор'
                                  : currentAgenda.type === 'OTHER'
                                    ? 'Вариант'
                                    : 'За кого'}
                              </th>
                              <th className="pol-pc-col-spent">Потрачено</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderedForVote.map((p, idx) => {
                              const vote = currentAgenda.votes[p.id] || { choice: 'abstain', amount: 0, planets: 0 };
                              const isLocked = !!currentAgenda.locked[p.id];
                              const isCurrent = currentVoterId === p.id;
                              const canVoteNow = canEditPlayer(p.id) && isCurrent && !isLocked;
                              const votesSpentOnPrevAgendas = oneVoteLaw
                                ? 0
                                : agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                                  const playerVote = agenda.votes[p.id];
                                  if (playerVote && agenda.locked[p.id]) return acc + (playerVote.amount || 0);
                                  return acc;
                                }, 0);
                              const planetsSpentOnPrevAgendas = oneVoteLaw
                                ? 0
                                : agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                                  const playerVote = agenda.votes[p.id];
                                  if (playerVote && agenda.locked[p.id]) return acc + (Number(playerVote.planets) || 0);
                                  return acc;
                                }, 0);
                              const availableInfluence = oneVoteLaw
                                ? 1
                                : (p.influence || 0) - votesSpentOnPrevAgendas;
                              const availablePlanets = oneVoteLaw
                                ? 0
                                : Math.max(0, (p.votePlanets || 0) - planetsSpentOnPrevAgendas);
                              const isXxcha = !oneVoteLaw && isXxchaPlayer(p);
                              const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                              const spent = oneVoteLaw
                                ? (vote.choice === 'abstain' ? 0 : 1)
                                : (Number(vote.amount) || 0);
                              const planetsSpent = oneVoteLaw ? 0 : Math.max(0, Number(vote.planets) || 0);
                              const liveBallot = { ...vote, amount: spent, planets: isXxcha ? planetsSpent : 0 };
                              const countsToward = vote.choice === 'abstain'
                                ? 0
                                : effectiveVoteAmount(
                                  game || { players: activePlayers, politics: { oneVoteLaw } },
                                  p,
                                  liveBallot,
                                );
                              const isFa = currentAgenda.type === 'FOR_AGAINST';
                              const isOther = currentAgenda.type === 'OTHER';
                              const target = !isFa && !isOther && vote.choice !== 'abstain'
                                ? activePlayers.find(pl => String(pl.id) === String(vote.choice))
                                : null;
                              const targetFaction = target
                                ? ALL_FACTIONS.find(f => f.id === target.factionId)
                                : null;
                              const choiceIdx = isOther && vote.choice !== 'abstain'
                                ? parseInt(vote.choice, 10)
                                : NaN;
                              const choiceLabel = Number.isFinite(choiceIdx)
                                ? (currentAgenda.customChoices?.[choiceIdx] || `Вариант ${choiceIdx + 1}`)
                                : null;
                              const faSide = isFa && (vote.choice === 'for' || vote.choice === 'against')
                                ? FA_SIDE_OPTIONS.find(o => o.id === vote.choice)
                                : null;
                              const rowState = isLocked ? 'is-done' : isCurrent ? 'is-current' : 'is-waiting';
                              const onPickChoice = (choice) => {
                                setAgendaVotes(p.id, {
                                  choice,
                                  amount: choice === 'abstain' ? 0 : (oneVoteLaw ? 1 : vote.amount),
                                  planets: choice === 'abstain' ? 0 : (vote.planets || 0),
                                });
                              };

                              return (
                                <tr key={p.id} className={`pol-pc-row ${rowState}`}>
                                  <td className="pol-pc-col-num">{idx + 1}</td>
                                  <td className="pol-pc-col-player">
                                    <div className="pol-pc-player">
                                      <img src={faction?.iconUrl} alt="" className="pol-pc-icon" />
                                      <div className="pol-pc-player-text">
                                        <span className="pol-pc-name">{p.name}</span>
                                        {p.id === speakerId && <span className="pol-pc-tag">Спикер</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="pol-pc-col-inf">
                                    <span className="pol-pc-inf-box">{availableInfluence}</span>
                                    {isXxcha && (
                                      <span className="pol-pc-inf-box tone-planet" title="Планеты">{availablePlanets}</span>
                                    )}
                                  </td>
                                  <td className="pol-pc-col-for">
                                    {canVoteNow ? (
                                      isFa ? (
                                        <PolPcFaButtons
                                          value={vote.choice}
                                          onChange={onPickChoice}
                                        />
                                      ) : isOther ? (
                                        <PolPcVariantPicker
                                          value={vote.choice}
                                          choices={currentAgenda.customChoices || []}
                                          onChange={onPickChoice}
                                        />
                                      ) : (
                                        <PolPcTargetPicker
                                          value={vote.choice}
                                          players={activePlayers}
                                          onChange={onPickChoice}
                                        />
                                      )
                                    ) : isLocked && faSide ? (
                                      <div className={`pol-pc-for tone-${faSide.tone}`}>
                                        <span className={`pol-pc-icon sm is-fa tone-${faSide.tone}`} aria-hidden="true">
                                          <i className={faSide.iconClass} />
                                        </span>
                                        <span>{faSide.label}</span>
                                      </div>
                                    ) : isLocked && target ? (
                                      <div className="pol-pc-for">
                                        <img src={targetFaction?.iconUrl} alt="" className="pol-pc-icon sm" />
                                        <span>{target.name}</span>
                                      </div>
                                    ) : isLocked && choiceLabel ? (
                                      <div className="pol-pc-for">
                                        <span className="pol-pc-icon sm is-num" aria-hidden="true">
                                          {choiceIdx + 1}
                                        </span>
                                        <span>{choiceLabel}</span>
                                      </div>
                                    ) : isLocked && vote.choice === 'abstain' ? (
                                      <span className="pol-pc-abstain">
                                        <i className="fa-solid fa-ban" aria-hidden="true" />
                                        Воздержался
                                      </span>
                                    ) : (
                                      <span className="pol-pc-muted">—</span>
                                    )}
                                  </td>
                                  <td className="pol-pc-col-spent">
                                    {canVoteNow ? (
                                      <PolPcSpentControls
                                        vote={vote}
                                        availableInfluence={availableInfluence}
                                        availablePlanets={availablePlanets}
                                        isXxcha={isXxcha}
                                        oneVoteLaw={oneVoteLaw}
                                        onAmount={(amount) => setAgendaVotes(p.id, { ...vote, amount })}
                                        onPlanets={(planets) => setAgendaVotes(p.id, { ...vote, planets })}
                                        onConfirm={() => lockVote(p.id)}
                                      />
                                    ) : (
                                      <span className="pol-pc-spent">
                                        {isLocked ? countsToward : 0}
                                        <span className="pol-pc-spent-sep"> / </span>
                                        {availableInfluence + (isXxcha ? availablePlanets : 0)}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {isSeatPlayer && currentAgenda.type && (!isMiscount || miscountReady) && (
                  <div className="space-y-3 pt-4 border-t border-violet-800/30">
                    {orderedForVote.map(p => {
                      const vote = currentAgenda.votes[p.id] || { choice: 'abstain', amount: 0, planets: 0 };
                      const isLocked = !!currentAgenda.locked[p.id];
                      const isCurrent = currentVoterId === p.id;
                      const isMine = seatId != null && p.id === seatId;
                      const votesSpentOnPrevAgendas = oneVoteLaw
                        ? 0
                        : agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                          const playerVote = agenda.votes[p.id];
                          if (playerVote && agenda.locked[p.id]) {
                            return acc + (playerVote.amount || 0);
                          }
                          return acc;
                        }, 0);
                      const planetsSpentOnPrevAgendas = oneVoteLaw
                        ? 0
                        : agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                          const playerVote = agenda.votes[p.id];
                          if (playerVote && agenda.locked[p.id]) {
                            return acc + (Number(playerVote.planets) || 0);
                          }
                          return acc;
                        }, 0);
                      const availableInfluence = oneVoteLaw
                        ? 1
                        : (p.influence || 0) - votesSpentOnPrevAgendas;
                      const availablePlanets = oneVoteLaw
                        ? 0
                        : Math.max(0, (p.votePlanets || 0) - planetsSpentOnPrevAgendas);
                      const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                      const canVoteNow = canEditPlayer(p.id) && isCurrent && !isLocked;
                      const isArgent = !oneVoteLaw && isArgentFlightPlayer(p);
                      const isXxcha = !oneVoteLaw && isXxchaPlayer(p);
                      const spent = oneVoteLaw
                        ? (vote.choice === 'abstain' ? 0 : 1)
                        : (Number(vote.amount) || 0);
                      const planetsSpent = oneVoteLaw ? 0 : Math.max(0, Number(vote.planets) || 0);
                      const liveBallot = {
                        ...vote,
                        amount: spent,
                        planets: isXxcha ? planetsSpent : 0,
                      };
                      const countsToward = vote.choice === 'abstain'
                        ? 0
                        : effectiveVoteAmount(
                          game || { players: activePlayers, politics: { oneVoteLaw } },
                          p,
                          liveBallot,
                        );

                      return (
                        <div
                          key={p.id}
                          className={`p-4 bg-slate-950/70 border rounded-xl flex items-center justify-between gap-4 transition max-md:flex-col max-md:items-stretch max-md:gap-3 ${
                            !isMine ? 'hidden md:flex' : ''
                          } ${
                            isLocked
                              ? 'border-purple-700/50 opacity-60'
                              : isCurrent
                                ? 'border-amber-500 shadow-lg shadow-amber-500/10'
                                : 'border-violet-800/40 opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-shrink-0 max-md:min-w-0">
                            <img src={faction?.iconUrl} alt={faction?.name} className="w-9 h-9 object-contain" />
                            <div>
                              <div className="font-bold text-lg text-white flex items-center gap-2">
                                {p.name}
                              </div>
                              {p.id === speakerId && (
                                <div className="text-[10px] text-purple-400 font-bold uppercase">Спикер</div>
                              )}
                              {isArgent && (
                                <div className="text-[10px] text-yellow-400/90 font-bold">
                                  Zeal: +{argentBonus} при ≥1 голосе
                                  {spent > 0 && vote.choice !== 'abstain' ? ` → итог ${countsToward}` : ''}
                                </div>
                              )}
                              {isXxcha && (
                                <div className="text-[10px] text-emerald-400/90 font-bold">
                                  Планеты: +1 голос за каждую
                                  {vote.choice !== 'abstain' && (spent > 0 || planetsSpent > 0)
                                    ? ` → итог ${countsToward}`
                                    : ''}
                                </div>
                              )}
                            </div>
                            <div className="text-center w-20 max-md:ml-auto">
                              <div className="text-xs text-slate-400">{oneVoteLaw ? 'Голосов' : 'Влияние'}</div>
                              <div className="font-orbitron font-black text-3xl text-amber-400 max-md:text-2xl">{availableInfluence}</div>
                            </div>
                            {isXxcha && (
                              <div className="text-center w-20">
                                <div className="text-xs text-emerald-500/80">Планеты</div>
                                <div className="font-orbitron font-black text-3xl text-emerald-300 max-md:text-2xl">{availablePlanets}</div>
                              </div>
                            )}
                          </div>

                          <PolPcVoteRow
                            vote={vote}
                            players={currentAgenda.type === 'PLAYER_CHOICE' ? activePlayers : undefined}
                            variantChoices={currentAgenda.type === 'OTHER' ? (currentAgenda.customChoices || []) : undefined}
                            faMode={currentAgenda.type === 'FOR_AGAINST'}
                            availableInfluence={availableInfluence}
                            availablePlanets={availablePlanets}
                            isXxcha={isXxcha}
                            oneVoteLaw={oneVoteLaw}
                            disabled={!canVoteNow}
                            onChoice={(choice) => {
                              setAgendaVotes(p.id, {
                                choice,
                                amount: choice === 'abstain' ? 0 : (oneVoteLaw ? 1 : vote.amount),
                                planets: choice === 'abstain' ? 0 : (vote.planets || 0),
                              });
                            }}
                            onAmount={(amount) => setAgendaVotes(p.id, { ...vote, amount })}
                            onPlanets={(planets) => setAgendaVotes(p.id, { ...vote, planets })}
                            onConfirm={() => lockVote(p.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  )}
                </>
              )}

              {canAdmin && (
                <div className="pol-vote-footer pt-4 border-t border-violet-800/30 grid grid-cols-3 gap-3 max-md:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => setPoliticsStep('SPEAKER')}
                    disabled={completedAgendasCount < 2 || speakerDecisionPending}
                    className="col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
                    title={
                      speakerDecisionPending
                        ? 'Сначала спикер выбирает исход при ничьей / 0 голосов'
                        : completedAgendasCount < 2
                          ? 'Нужно проголосовать минимум по 2 законам'
                          : 'Перейти к выбору Спикера'
                    }
                  >
                    Завершить голосование
                  </button>
                  <button type="button" onClick={handleSkipAgenda} className="col-span-1 bg-slate-700 hover:bg-slate-600 text-white font-orbitron font-bold py-3 rounded-xl text-sm transition uppercase">
                    Пропустить закон
                  </button>
                  <button
                    type="button"
                    onClick={handleNextAgenda}
                    disabled={
                      !allVotedOnCurrentAgenda
                      || needsCovertUnveil
                      || needsFaceReveal
                      || miscountNeedsPick
                      || speakerDecisionPending
                    }
                    className="col-span-1 bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
                    title={
                      miscountNeedsPick
                        ? 'Сначала спикер выбирает закон для пересчёта'
                        : waitingAgendaReveal
                          ? 'Сначала спикер должен открыть закон'
                          : speakerDecisionPending
                            ? 'Сначала спикер выбирает исход при ничьей / 0 голосов'
                            : undefined
                    }
                  >
                    Следующий закон <i className="fa-solid fa-arrow-right" />
                  </button>
                </div>
              )}
            </div>
          )}

          {politicsStep === 'SPEAKER' && (
            <div className="space-y-4">
              <h3 className="font-orbitron font-bold text-lg text-amber-400 text-center">Передача жетона Спикера</h3>
              <p className="text-sm text-slate-400 text-center">
                Хост выбирает следующего Спикера
                {currentSpeaker ? <> (сейчас: <span className="font-bold text-white">{currentSpeaker.name}</span>)</> : null}.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {activePlayers.map(player => {
                  const faction = ALL_FACTIONS.find(f => f.id === player.factionId);
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={!canAdmin}
                      onClick={() => {
                        if (!canAdmin) return;
                        onFinish(player.id);
                      }}
                      className={`p-4 bg-slate-950/70 border border-violet-800/40 rounded-xl text-center space-y-2 transition ${
                        canAdmin ? 'hover:bg-slate-800 hover:border-purple-500' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                      <div className="font-bold text-purple-400">{player.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {politicsStep === 'SETUP' && (
          <footer className="pol-shell-foot flex-shrink-0">
            <div
              className={`pol-foot-progress ${
                oneVoteLaw
                  ? ''
                  : allInfluenceLocked
                    ? 'is-complete'
                    : lockedCount > 0
                      ? 'is-partial'
                      : ''
              }`}
            >
              {oneVoteLaw ? (
                'Закон «1 голос»'
              ) : (
                <>
                  <span className="pol-foot-progress-count">
                    {lockedCount}/{activePlayers.length}
                  </span>
                  <span className="pol-foot-progress-label">
                    {allInfluenceLocked ? 'все подтвердили' : 'подтвердили'}
                  </span>
                </>
              )}
            </div>
            {canAdmin ? (
              <button
                type="button"
                disabled={!oneVoteLaw && !allInfluenceLocked}
                onClick={() => setPoliticsStep('VOTE')}
                className="pol-cta-btn"
              >
                Перейти к голосованию
                <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </button>
            ) : (
              <p className="pol-foot-hint">
                {oneVoteLaw || allInfluenceLocked
                  ? 'Ожидание админа — открытие законов…'
                  : 'Подтвердите своё влияние и дождитесь остальных.'}
              </p>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
