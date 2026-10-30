import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import brandMarkLg from '../assets/brand-mark-lg.png';
import { useAllowPageZoom } from '../hooks/useAllowPageZoom';
import { useAppDialog } from '../hooks/useAppDialog';
import { assembleResult } from '../milty/draftEngine.js';
import { factionReferenceUrl, resolveFaction } from '../milty/factions.js';
import { sliceSpecialties, wormholeSymbol } from '../milty/tiles.js';
import {
  claimMiltySeat,
  fetchMiltyDraft,
  pickMilty,
  regenMilty,
  subscribeMilty,
  unclaimMiltySeat,
  undoMilty,
} from '../sync/miltyApi';
import { pickMiltyInRoom, regenMiltyInRoom, undoMiltyInRoom } from '../sync/roomApi';
import { AppDialog } from './AppDialog';
import { HubCosmosBackdrop } from './HubCosmosBackdrop';
import { MiltyDraftMap } from './MiltyDraftMap';
import { MiltySliceGraph } from './MiltySliceGraph';

const TECH_ICON = {
  biotic: '/tech-icons/biotic.webp',
  propulsion: '/tech-icons/propulsion.webp',
  cybernetic: '/tech-icons/cybernetic.webp',
  warfare: '/tech-icons/warfare.webp',
};

function sessionKey(id) {
  return `ti4_milty_${String(id).toUpperCase()}`;
}

function loadSession(id) {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey(id)) || 'null') || {};
  } catch {
    return {};
  }
}

function saveSession(id, patch) {
  try {
    const prev = loadSession(id);
    sessionStorage.setItem(sessionKey(id), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* ignore */
  }
}

function draftIdFromPath(pathname) {
  const m = String(pathname || '').match(/^\/milty\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Russian masculine ordinal label: 2-ой, 3-ий, 4-ый… */
function seatOrdinalLabel(n) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n}-ый`;
  if (mod10 === 2) return `${n}-ой`;
  if (mod10 === 3) return `${n}-ий`;
  if (mod10 === 6 || mod10 === 7 || mod10 === 8) return `${n}-ой`;
  return `${n}-ый`;
}

function FactionIcon({ faction, size = 28 }) {
  const f = resolveFaction(faction);
  if (!f?.iconUrl) {
    return (
      <span
        className="milty-draft-fac-icon milty-draft-fac-icon--ph"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={f.iconUrl}
      alt=""
      className="milty-draft-fac-icon"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

function SliceMeta({ slice }) {
  const specs = sliceSpecialties(slice.tileIds);
  const worms = slice.wormholes || [];
  const legends = slice.legendaryPlanets || [];
  return (
    <div className="milty-draft-slice-meta">
      {specs.map((s, i) =>
        TECH_ICON[s] ? (
          <img
            key={`${s}-${i}`}
            src={TECH_ICON[s]}
            alt={s}
            title={s}
            className="milty-draft-slice-meta__tech"
            draggable={false}
          />
        ) : (
          <span key={`${s}-${i}`} className="milty-draft-slice-meta__letter" title={s}>
            {s.slice(0, 1)}
          </span>
        ),
      )}
      {legends.map((l, i) => (
        <img
          key={i}
          src="/milty/legendary.png"
          alt="Legendary"
          title={l}
          className="milty-draft-slice-meta__leg"
          draggable={false}
        />
      ))}
      {worms.map((w) => {
        const kind = String(w).toLowerCase();
        return (
          <span
            key={w}
            className={`milty-draft-slice-meta__wh milty-draft-slice-meta__wh--${kind}`}
            title={w}
            aria-label={`Wormhole ${kind}`}
          >
            {wormholeSymbol(w)}
          </span>
        );
      })}
    </div>
  );
}

/** Yellow resources + blue influence pills like miltydraft. */
function SliceResourceCount({ label, resources, influence }) {
  const fmt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return Number.isInteger(v) ? String(v) : String(v);
  };
  return (
    <div className="milty-res-row">
      <span className="milty-res-label">{label}</span>
      <span className="milty-res-pair" title={`Resources ${fmt(resources)} / Influence ${fmt(influence)}`}>
        <abbr className="milty-res milty-res--resources" title="resources">{fmt(resources)}</abbr>
        <abbr className="milty-res milty-res--influence" title="influence">{fmt(influence)}</abbr>
      </span>
    </div>
  );
}

/**
 * @param {{
 *   roomBinding?: null | {
 *     roomId: string,
 *     draftId: string,
 *     hostKey?: string|null,
 *     sessionToken?: string|null,
 *     seatPlayerId?: string|number|null,
 *     miltySecret?: string|null,
 *     miltyAdminSecret?: string|null,
 *     onPromote?: () => Promise<void>,
 *     onHostClaimSeat?: (seatPlayerId: string|number) => Promise<void>,
 *     onHostReleaseSeat?: (seatPlayerId: string|number) => Promise<void>,
 *     onLeave?: () => void,
 *   }
 * }} [props]
 */
export function MiltyDraftPage({ roomBinding = null } = {}) {
  const location = useLocation();
  const pathId = draftIdFromPath(location.pathname);
  const id = roomBinding?.draftId || pathId;
  const inRoom = !!roomBinding?.roomId;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { dialog, close, uiConfirm } = useAppDialog();
  useAllowPageZoom(true);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageTab, setPageTab] = useState('draft');
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenSel, setRegenSel] = useState({ slices: false, factions: false, order: false });
  const [referenceFaction, setReferenceFaction] = useState(null);
  const [auth, setAuth] = useState(() => {
    if (roomBinding) {
      return {
        playerId: roomBinding.seatPlayerId != null ? String(roomBinding.seatPlayerId) : null,
        secret: roomBinding.miltySecret || null,
        adminSecret: roomBinding.miltyAdminSecret || null,
      };
    }
    const draftId = draftIdFromPath(window.location.pathname);
    const stored = draftId ? loadSession(draftId) : {};
    const params = new URLSearchParams(window.location.search);
    return {
      playerId: stored.playerId || null,
      secret: stored.secret || null,
      adminSecret: params.get('admin') || stored.adminSecret || null,
    };
  });

  useEffect(() => {
    document.body.classList.add('hub-cinematic');
    return () => document.body.classList.remove('hub-cinematic');
  }, []);

  useEffect(() => {
    if (roomBinding) {
      setAuth({
        playerId: roomBinding.seatPlayerId != null ? String(roomBinding.seatPlayerId) : null,
        secret: roomBinding.miltySecret || null,
        adminSecret: roomBinding.miltyAdminSecret || null,
      });
    }
  }, [
    roomBinding?.seatPlayerId,
    roomBinding?.miltySecret,
    roomBinding?.miltyAdminSecret,
  ]);

  useEffect(() => {
    if (inRoom || !id) return;
    if (search.get('admin')) {
      saveSession(id, { adminSecret: search.get('admin') });
      setAuth((a) => ({ ...a, adminSecret: search.get('admin') }));
    }
  }, [id, search, inRoom]);

  useEffect(() => {
    if (!id) {
      setError('not-found');
      return undefined;
    }
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const data = await fetchMiltyDraft(id, {
          playerId: auth.playerId,
          secret: auth.secret,
          adminSecret: auth.adminSecret,
        });
        if (!cancelled) setDraft(data.draft);
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      }
    })();
    const unsub = subscribeMilty(id, async (ev) => {
      if (ev?.type !== 'state' && ev?.type !== 'milty') return;
      try {
        const data = await fetchMiltyDraft(id, {
          playerId: auth.playerId,
          secret: auth.secret,
          adminSecret: auth.adminSecret,
        });
        if (!cancelled) setDraft(data.draft);
      } catch {
        if (!cancelled && ev.draft) setDraft(ev.draft);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id, auth.playerId, auth.secret, auth.adminSecret]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (inRoom && roomBinding?.roomId) {
      return String(roomBinding.roomId);
    }
    if (!id) return '';
    return `${window.location.origin}/milty/${id}`;
  }, [id, inRoom, roomBinding?.roomId]);

  const currentName = draft?.players?.[draft.currentPlayerId]?.name;
  const pickTotal = draft?.playerOrder?.length ? draft.playerOrder.length * 3 : 0;
  const pickNow = draft
    ? (draft.done ? pickTotal : Math.min((draft.log?.length || 0) + 1, pickTotal || 1))
    : 0;
  const turnIdx = draft?.currentPlayerId != null && draft?.playerOrder
    ? Math.max(1, draft.playerOrder.indexOf(draft.currentPlayerId) + 1)
    : 1;
  const statusProgress = pickTotal > 0
    ? (draft?.done ? 1 : (draft.log?.length || 0) / pickTotal)
    : 0;
  const currentPlayer = draft?.currentPlayerId ? draft?.players?.[draft.currentPlayerId] : null;
  // In a room, seat session is enough — miltySecret is resolved server-side.
  const mySeatId = inRoom
    ? (roomBinding?.seatPlayerId ?? auth.playerId)
    : auth.playerId;
  // Host+player keeps full admin powers (undo/regen/pick for any turn).
  const isHost = !!(auth.adminSecret || (inRoom && roomBinding?.hostKey));
  const canPick = !!(
    draft
    && !draft.done
    && (
      isHost
      || (inRoom && mySeatId != null && String(draft.currentPlayerId) === String(mySeatId))
      || (!inRoom && draft?.you?.canPick)
    )
  );
  const myPlayer = (mySeatId != null ? draft?.players?.[mySeatId] : null)
    || (auth.playerId ? draft?.players?.[auth.playerId] : null);
  const pickPlayer = currentPlayer;

  const onClaim = async (playerId) => {
    setBusy(true);
    setError(null);
    try {
      if (inRoom) {
        if (typeof roomBinding?.onHostClaimSeat !== 'function') {
          throw new Error('Только хост может сесть за место');
        }
        await roomBinding.onHostClaimSeat(playerId);
        return;
      }
      // Host may already have adminSecret — keep it and also sit as player.
      const res = await claimMiltySeat(id, { playerId });
      const next = { playerId: res.playerId, secret: res.secret };
      setAuth((a) => ({ ...a, ...next }));
      saveSession(id, next);
      setDraft(res.draft);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const onUnclaim = async (playerId) => {
    const ok = await uiConfirm('Освободить это место?', {
      title: 'Отменить занятие',
      confirmLabel: 'Освободить',
      cancelLabel: 'Отмена',
      variant: 'info',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      if (inRoom) {
        if (typeof roomBinding?.onHostReleaseSeat !== 'function') {
          throw new Error('Только хост может освободить место');
        }
        await roomBinding.onHostReleaseSeat(playerId);
        return;
      }
      const res = await unclaimMiltySeat(id, {
        playerId,
        secret: auth.secret,
        adminSecret: auth.adminSecret,
      });
      const wasMine = String(auth.playerId) === String(playerId);
      if (wasMine) {
        setAuth((a) => ({ ...a, playerId: null, secret: null }));
        saveSession(id, { playerId: null, secret: null });
      }
      setDraft(res.draft);
    } catch (err) {
      const msg = String(err?.message || err);
      setError(msg === 'has-picks'
        ? 'Сначала отмените выборы этого игрока (Undo)'
        : msg);
    } finally {
      setBusy(false);
    }
  };

  const pickLabel = (category, value) => {
    if (category === 'faction') {
      const f = resolveFaction(draft?.factionPool?.find((x) => x.id === value) || value);
      return `фракцию «${f?.displayName || f?.name || value}»`;
    }
    if (category === 'slice') {
      return `слайс ${Number(value) + 1}`;
    }
    if (category === 'position') {
      const n = Number(value) + 1;
      return n === 1 ? 'место 1 (Speaker)' : `место ${n}`;
    }
    return String(value);
  };

  const onPick = async (category, value) => {
    if (!draft) return;
    const ok = await uiConfirm(`Точно выбрать ${pickLabel(category, value)}?`, {
      title: 'Подтверждение пика',
      confirmLabel: 'Выбрать',
      cancelLabel: 'Отмена',
      variant: 'info',
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      // Host always acts for the current turn player; sitting as a player must not steal picks.
      const pickAsId = isHost
        ? draft.currentPlayerId
        : (mySeatId != null ? mySeatId : draft.currentPlayerId);
      if (inRoom) {
        const res = await pickMiltyInRoom(roomBinding.roomId, {
          sessionToken: roomBinding.sessionToken,
          hostKey: roomBinding.hostKey,
          playerId: pickAsId,
          category,
          value,
          logIndex: draft.log?.length ?? 0,
        });
        setDraft(res.draft);
      } else {
        const res = await pickMilty(id, {
          playerId: pickAsId,
          secret: auth.secret,
          adminSecret: auth.adminSecret,
          category,
          value,
          logIndex: draft.log?.length ?? 0,
        });
        setDraft(res.draft);
      }
    } catch (err) {
      setError(String(err?.message || err?.data?.error || err));
    } finally {
      setBusy(false);
    }
  };

  const onUndo = async () => {
    setBusy(true);
    try {
      if (inRoom) {
        const res = await undoMiltyInRoom(roomBinding.roomId, { hostKey: roomBinding.hostKey });
        setDraft(res.draft);
      } else {
        const res = await undoMilty(id, { adminSecret: auth.adminSecret });
        setDraft(res.draft);
      }
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const toggleRegenPart = (part) => {
    setRegenSel((prev) => ({ ...prev, [part]: !prev[part] }));
  };

  const onRegenConfirm = async () => {
    const parts = ['slices', 'factions', 'order'].filter((key) => regenSel[key]);
    if (!parts.length) {
      setError('Выберите, что перегенерировать');
      return;
    }
    if ((draft?.log?.length || 0) > 0) {
      setError('Перегенерация только до первого выбора');
      return;
    }
    const labels = {
      slices: 'слайсы',
      factions: 'расы',
      order: 'порядок игроков',
    };
    const list = parts.map((p) => labels[p]).join(', ');
    const ok = await uiConfirm(`Перегенерировать: ${list}?`, {
      title: 'Подтверждение перегенерации',
      confirmLabel: 'Подтвердить',
      cancelLabel: 'Отмена',
      variant: 'info',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      if (inRoom) {
        const res = await regenMiltyInRoom(roomBinding.roomId, {
          hostKey: roomBinding.hostKey,
          parts,
        });
        setDraft(res.draft);
      } else {
        const res = await regenMilty(id, {
          adminSecret: auth.adminSecret,
          parts,
        });
        setDraft(res.draft);
      }
      setRegenSel({ slices: false, factions: false, order: false });
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const onPromote = async () => {
    if (!roomBinding?.onPromote) return;
    setBusy(true);
    setError(null);
    try {
      await roomBinding.onPromote();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const result = draft?.done ? assembleResult(draft) : null;

  if (error && !draft) {
    return (
      <div className="milty-draft hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        <div className="milty-draft__stage milty-draft__stage--center">
          <p className="milty-draft-error">{error}</p>
          <button type="button" className="milty-draft-tool" onClick={() => navigate('/milty')}>
            Создать новый
          </button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="milty-draft hub-shell hub-shell--column">
        <HubCosmosBackdrop />
        <div className="milty-draft__stage milty-draft__stage--center">
          <i className="fa-solid fa-spinner fa-spin milty-draft-spinner" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const takenFactions = new Set(draft.taken?.factions || []);
  const takenSlices = new Set(draft.taken?.slices || []);
  const takenPositions = new Set(draft.taken?.positions || []);
  const factionById = Object.fromEntries(
    (draft.factionPool || []).map((f) => [f.id, resolveFaction(f)]),
  );
  const claimedBy = { faction: {}, slice: {}, position: {} };
  for (const p of Object.values(draft.players || {})) {
    if (p.faction != null) claimedBy.faction[p.faction] = p.name;
    if (p.slice != null) claimedBy.slice[p.slice] = p.name;
    if (p.position != null) claimedBy.position[p.position] = p.name;
  }
  const pageTabs = [
    { id: 'draft', label: 'Драфт' },
    { id: 'map', label: 'Карта' },
    { id: 'log', label: 'Лог' },
    ...(isHost ? [{ id: 'regen', label: 'Перегенерация' }] : []),
  ];
  const activePage = pageTabs.some((t) => t.id === pageTab) ? pageTab : 'draft';
  const draftTitle = draft.settings?.gameName
    || (inRoom ? `Комната ${roomBinding.roomId}` : `Milty ${draft.id}`);
  const draftCode = inRoom ? String(roomBinding.roomId) : String(draft.id);

  const copyRoomCode = async () => {
    const text = inRoom ? draftCode : (shareUrl || draftCode);
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 1600);
    }
  };

  return (
    <div className="milty-draft hub-shell hub-shell--column">
      <HubCosmosBackdrop />
      <div className={`milty-draft__stage${activePage === 'map' ? ' milty-draft__stage--map' : ''}`}>
        <header className="milty-draft__topbar">
          <div className="milty-draft__brand">
            <img
              className="milty-draft__brand-mark"
              src={brandMarkLg}
              alt=""
              width={64}
              height={64}
              draggable={false}
            />
            <div className="min-w-0">
              <h1 className="milty-draft__title">Milty Draft</h1>
              <p className="milty-draft__lead truncate" title={draftTitle}>{draftTitle}</p>
            </div>
          </div>

          <nav className="milty-page-tabs" role="tablist" aria-label="Разделы драфта">
            {pageTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activePage === t.id}
                onClick={() => setPageTab(t.id)}
                className={`milty-page-tab${activePage === t.id ? ' is-active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="milty-draft__tools">
            <span className="milty-draft-code" title={draftCode}>{draftCode}</span>
            <button
              type="button"
              className={`milty-draft-tool milty-draft-tool--share${codeCopied ? ' is-copied' : ''}`}
              onClick={copyRoomCode}
              title={inRoom ? `Скопировать код ${draftCode}` : 'Скопировать ссылку'}
            >
              <i className={`fa-solid ${codeCopied ? 'fa-check' : 'fa-link'}`} aria-hidden="true" />
              {codeCopied
                ? 'Скопировано'
                : (inRoom ? 'Код' : 'Ссылка')}
            </button>
            {isHost && (
              <button
                type="button"
                disabled={busy || !draft.log?.length}
                onClick={onUndo}
                className="milty-draft-tool milty-draft-tool--undo"
              >
                <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                Undo
              </button>
            )}
            {inRoom && draft.done && roomBinding?.onPromote && roomBinding?.hostKey && (
              <button
                type="button"
                disabled={busy}
                onClick={onPromote}
                className="milty-draft-tool milty-draft-tool--accent milty-draft-tool--promote"
              >
                На стол
              </button>
            )}
            <button
              type="button"
              className="milty-draft-tool milty-draft-tool--exit"
              onClick={() => (roomBinding?.onLeave ? roomBinding.onLeave() : navigate('/'))}
            >
              <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
              {inRoom ? 'Выйти' : 'Назад'}
            </button>
          </div>
        </header>

        {activePage === 'draft' && (
          <>
            <div className="milty-draft__overview">
              <section className="milty-draft__panel milty-draft__status">
                <h2 className="milty-draft-label">Статус</h2>
                <div
                  className={`milty-draft-status__body${draft.done ? ' is-done' : ''}`}
                  style={{ '--status-progress': statusProgress }}
                >
                  <div className="milty-draft-status__row">
                    <div className="milty-draft-status__dial" aria-hidden="true">
                      <span className="milty-draft-status__dial-num">
                        {draft.done ? '✓' : turnIdx}
                      </span>
                    </div>
                    <div className="milty-draft-status__copy">
                      {draft.done ? (
                        <p className="milty-draft-status__done">Драфт завершён</p>
                      ) : (
                        <p className="milty-draft-status__turn">
                          Ход: <strong>{currentName || '…'}</strong>
                          <span className="milty-draft-status__pick">
                            {' '}· Пик {pickNow}/{pickTotal}
                          </span>
                        </p>
                      )}
                      {(myPlayer || isHost) && (
                        <div className="milty-draft-status__meta">
                          {myPlayer ? <span>Вы: {myPlayer.name}</span> : null}
                          {myPlayer && isHost ? (
                            <span className="milty-draft-status__sep" aria-hidden="true">·</span>
                          ) : null}
                          {isHost ? (
                            <span>
                              {inRoom
                                ? <>Хост · <code>{draftCode}</code></>
                                : 'Админ'}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="milty-draft-status__bar" aria-hidden="true" />
                </div>
                {error && <p className="milty-draft-error" role="alert">{error}</p>}
              </section>

              <section className="milty-draft__panel milty-draft__queue">
                <h2 className="milty-draft-label">Очередь драфта</h2>
                <div className="milty-turn-order">
                  {draft.playerOrder.map((pid, i) => {
                    const p = draft.players[pid];
                    const fac = p.faction ? (factionById[p.faction] || resolveFaction(p.faction)) : null;
                    const isTurn = pid === draft.currentPlayerId && !draft.done;
                    const isYou = String(pid) === String(auth.playerId)
                      || (inRoom && mySeatId != null && String(pid) === String(mySeatId));
                    const seatTaken = !!p.claimed;
                    const hostCanSit = isHost
                      && (
                        inRoom
                          ? typeof roomBinding?.onHostClaimSeat === 'function'
                          : !!auth.adminSecret
                      );
                    // Host may sit / switch free seats; guest only if not yet seated.
                    const canClaimHere = !seatTaken && (
                      hostCanSit
                      || (!inRoom && !auth.secret)
                    );
                    const noPicks = p.faction == null && p.slice == null && p.position == null;
                    const canFreeHere = seatTaken && noPicks && (
                      isYou
                      || (hostCanSit && (isYou || !!auth.adminSecret || !!roomBinding?.hostKey))
                    );
                    const dotActive = !busy && (canClaimHere || canFreeHere);
                    const dotAction = () => {
                      if (seatTaken && canFreeHere) onUnclaim(pid);
                      else if (!seatTaken && canClaimHere) onClaim(pid);
                    };
                    return (
                      <article
                        key={pid}
                        className={`milty-turn-card${isTurn ? ' is-current' : ''}${isYou ? ' is-you' : ''}${seatTaken ? ' is-claimed' : ' is-open'}`}
                      >
                        <span className="milty-turn-card__idx">{i + 1}</span>
                        <span className="milty-turn-card__fac">
                          {fac ? (
                            <FactionIcon faction={fac} size={26} />
                          ) : (
                            <span className="milty-turn-card__fac-ph" aria-hidden="true" />
                          )}
                        </span>
                        <div className="milty-turn-card__main min-w-0">
                          <div className="milty-turn-card__name">
                            <span className="milty-turn-card__name-text">{p.name}</span>
                            {isYou ? <span className="milty-turn-card__you">вы</span> : null}
                            {isTurn ? <span className="milty-turn-card__badge">ход</span> : null}
                            <button
                              type="button"
                              className={`milty-turn-card__seat-dot${seatTaken ? ' is-on' : ''}${dotActive ? ' is-clickable' : ''}`}
                              title={
                                seatTaken
                                  ? (canFreeHere ? 'Освободить место' : 'Место занято')
                                  : (canClaimHere
                                    ? (hostCanSit ? 'Сесть как игрок (хост+игрок)' : 'Занять место')
                                    : 'Место свободно')
                              }
                              aria-label={
                                seatTaken
                                  ? (canFreeHere ? 'Освободить место' : 'Место занято')
                                  : (canClaimHere ? 'Занять место' : 'Место свободно')
                              }
                              disabled={!dotActive}
                              onClick={dotAction}
                            />
                          </div>
                          <div className="milty-turn-card__meta">
                            {!fac ? (
                              <>
                                <span className="is-empty">раса —</span>
                                <span className="milty-turn-card__sep" aria-hidden="true">|</span>
                              </>
                            ) : null}
                            <span className={p.slice != null ? '' : 'is-empty'}>
                              {p.slice != null ? `слайс ${p.slice + 1}` : 'слайс —'}
                            </span>
                            <span className="milty-turn-card__sep" aria-hidden="true">|</span>
                            <span className={p.position != null ? '' : 'is-empty'}>
                              {p.position != null
                                ? (p.position === 0 ? 'Speaker' : seatOrdinalLabel(p.position + 1))
                                : 'место —'}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="milty-draft__board">
              <section className="milty-draft__panel milty-draft__col milty-draft__col--factions">
                <h2 className="milty-draft-label">Фракции</h2>
                <div className="milty-draft-factions">
                  {draft.factionPool.map((raw) => {
                    const f = resolveFaction(raw);
                    const taken = takenFactions.has(f.id);
                    const locked = busy || draft.done || !canPick || pickPlayer?.faction != null;
                    const by = claimedBy.faction[f.id];
                    const wiki = f?.wiki || null;
                    const refUrl = factionReferenceUrl(f?.id);
                    return (
                      <div
                        key={f.id}
                        className={`milty-pick milty-draft-fac${taken ? ' milty-pick--taken' : ''}`}
                      >
                        <button
                          type="button"
                          disabled={taken || locked}
                          onClick={() => onPick('faction', f.id)}
                          className="milty-draft-fac__pick"
                        >
                          <FactionIcon faction={f} size={56} />
                          <span className="milty-draft-fac__name">{f.displayName || f.name}</span>
                        </button>
                        <div className="milty-draft-fac__links">
                          {wiki ? (
                            <a
                              href={wiki}
                              target="_blank"
                              rel="noreferrer"
                              className="milty-draft-fac__link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              [wiki]
                            </a>
                          ) : null}
                          {refUrl ? (
                            <button
                              type="button"
                              className="milty-draft-fac__link"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReferenceFaction({
                                  id: f.id,
                                  name: f.displayName || f.name,
                                  url: refUrl,
                                });
                              }}
                            >
                              [reference]
                            </button>
                          ) : null}
                        </div>
                        {by ? <span className="milty-pick-tag" title={by}>{by}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="milty-draft__panel milty-draft__panel--overflow milty-draft__col milty-draft__col--slices">
                <h2 className="milty-draft-label">Слайсы</h2>
                <div className="milty-draft-slices">
                  {draft.slicePool.map((s, idx) => {
                    const taken = takenSlices.has(idx);
                    const locked = busy || draft.done || !canPick || pickPlayer?.slice != null;
                    const canSelect = !taken && !locked;
                    const by = claimedBy.slice[idx];
                    return (
                      <div
                        key={idx}
                        role={canSelect ? 'button' : undefined}
                        tabIndex={canSelect ? 0 : undefined}
                        onClick={() => {
                          if (!canSelect) return;
                          onPick('slice', idx);
                        }}
                        onKeyDown={(e) => {
                          if (!canSelect) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onPick('slice', idx);
                          }
                        }}
                        className={`milty-pick milty-slice-card milty-draft-slice${
                          taken ? ' milty-pick--taken' : ''
                        }${canSelect ? ' is-pickable' : ''}`}
                      >
                        {by ? <span className="milty-pick-tag" title={by}>{by}</span> : null}
                        <div className="milty-draft-slice__title">Слайс {idx + 1}</div>
                        <div className="milty-draft-slice__visual">
                          <MiltySliceGraph tileIds={s.tileIds} />
                        </div>
                        <div className="milty-slice-card__body">
                          <div className="milty-slice-stats-rail">
                            <div className="milty-slice-stats-rail__icons">
                              <SliceMeta slice={s} />
                            </div>
                            <div className="milty-res-block">
                              <SliceResourceCount
                                label="Total:"
                                resources={s.totalResources}
                                influence={s.totalInfluence}
                              />
                              <SliceResourceCount
                                label="Optimal:"
                                resources={s.optimalResources}
                                influence={s.optimalInfluence}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="milty-draft__panel milty-draft__col milty-draft__col--seats">
                <h2 className="milty-draft-label">Места за столом</h2>
                <div className="milty-draft-seats">
                  {draft.playerOrder.map((_, idx) => {
                    const taken = takenPositions.has(idx);
                    const locked = busy || draft.done || !canPick || pickPlayer?.position != null;
                    const by = claimedBy.position[idx];
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={taken || locked}
                        onClick={() => onPick('position', idx)}
                        className={`milty-pick milty-draft-seat${taken ? ' milty-pick--taken' : ''}`}
                      >
                        {by ? <span className="milty-pick-tag" title={by}>{by}</span> : null}
                        <span className="milty-draft-seat__title">
                          {idx === 0 ? 'Speaker' : seatOrdinalLabel(idx + 1)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {draft.done && result && (
              <section className="milty-draft__panel milty-draft__panel--result">
                <div className="milty-draft-result-head">
                  <h2 className="milty-draft-label">Итог</h2>
                  {inRoom && roomBinding?.onPromote && roomBinding?.hostKey && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onPromote}
                      className="milty-draft-cta"
                    >
                      На стол — создать партию
                    </button>
                  )}
                </div>
                <div className="milty-draft-result-grid">
                  {result.map((seat, idx) => {
                    const fac = seat?.faction ? resolveFaction(seat.faction) : null;
                    return (
                      <div key={idx} className="milty-draft-result-card">
                        <div className="milty-draft-label">
                          Место {idx + 1}
                          {idx === 0 ? ' · Speaker' : ''}
                        </div>
                        {seat ? (
                          <>
                            <div className="milty-draft-result-card__name">{seat.name}</div>
                            <div className="milty-draft-result-card__fac">
                              {fac && <FactionIcon faction={fac} size={28} />}
                              <span>{fac?.displayName || fac?.name || '—'}</span>
                            </div>
                            {seat.slice?.tileIds && (
                              <div className="milty-draft-result-card__slice">
                                <MiltySliceGraph tileIds={seat.slice.tileIds} />
                                <div className="milty-res-block">
                                  <SliceResourceCount
                                    label="Optimal:"
                                    resources={seat.slice.optimalResources}
                                    influence={seat.slice.optimalInfluence}
                                  />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="milty-draft-seat__empty">пусто</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="milty-draft-hint">Seed: {draft.settings?.seed}</p>
              </section>
            )}
          </>
        )}

        {activePage === 'map' && (
          <section className="milty-draft__panel milty-draft__panel--overflow milty-draft__panel--map">
            <h2 className="milty-draft-label">Общая карта</h2>
            <MiltyDraftMap draft={draft} />
            <p className="milty-draft-hint milty-draft-hint--center milty-draft-hint--map">
              Карта собирается по мере выбора позиции и слайса.
              {' '}Для 3–5 игроков пустой сектор закрывают гиперлинии.
            </p>
          </section>
        )}

        {activePage === 'log' && (
          <section className="milty-draft__panel">
            <h2 className="milty-draft-label">Лог ходов</h2>
            {!(draft.log?.length) ? (
              <p className="milty-draft-hint">Пока пусто</p>
            ) : (
              <ol className="milty-log">
                {[...draft.log].map((entry, i) => {
                  const name = draft.players?.[entry.playerId]?.name || '—';
                  return (
                    <li
                      key={`${i}-${entry.playerId}-${entry.category}`}
                      className="milty-log__item"
                    >
                      <span className="milty-log__n">{i + 1}.</span>
                      <strong className="milty-log__who">{name}</strong>
                      <span className="milty-log__what"> выбрал {pickLabel(entry.category, entry.value)}</span>
                    </li>
                  );
                }).reverse()}
              </ol>
            )}
          </section>
        )}

        {activePage === 'regen' && (
          <section className="milty-draft__panel">
            <h2 className="milty-draft-label">Перегенерация</h2>
            {draft.done ? (
              <p className="milty-draft-hint">Драфт завершён — перегенерация недоступна.</p>
            ) : (draft.log?.length || 0) > 0 ? (
              <p className="milty-draft-hint">
                Перегенерация доступна только до первого выбора. Уже есть пики — сбросить можно через Undo.
              </p>
            ) : (
              <>
                <p className="milty-draft-hint">
                  Отметьте, что нужно обновить, затем подтвердите. Можно выбрать несколько пунктов.
                  При перегенерации рас новые расы стараются не повторять текущий пул.
                </p>
                <div className="milty-draft-regen" role="group" aria-label="Что перегенерировать">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={regenSel.slices}
                    onClick={() => toggleRegenPart('slices')}
                    className={`milty-draft-tool milty-draft-tool--wide milty-draft-regen__opt${
                      regenSel.slices ? ' is-active' : ''
                    }`}
                  >
                    <i className={`fa-solid ${regenSel.slices ? 'fa-square-check' : 'fa-square'}`} aria-hidden="true" />
                    Слайсы
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={regenSel.factions}
                    onClick={() => toggleRegenPart('factions')}
                    className={`milty-draft-tool milty-draft-tool--wide milty-draft-regen__opt${
                      regenSel.factions ? ' is-active' : ''
                    }`}
                  >
                    <i className={`fa-solid ${regenSel.factions ? 'fa-square-check' : 'fa-square'}`} aria-hidden="true" />
                    Расы
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={regenSel.order}
                    onClick={() => toggleRegenPart('order')}
                    className={`milty-draft-tool milty-draft-tool--wide milty-draft-regen__opt${
                      regenSel.order ? ' is-active' : ''
                    }`}
                  >
                    <i className={`fa-solid ${regenSel.order ? 'fa-square-check' : 'fa-square'}`} aria-hidden="true" />
                    Порядок игроков
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy || !(regenSel.slices || regenSel.factions || regenSel.order)}
                  onClick={onRegenConfirm}
                  className="milty-draft-tool milty-draft-tool--wide milty-draft-tool--accent milty-draft-regen__confirm"
                >
                  Подтвердить перегенерацию
                </button>
              </>
            )}
          </section>
        )}

        <p className="milty-draft-foot">
          Inspired by miltydraft / shenanigans-be. Неофициальный фанатский инструмент. Тайлы: milty.shenanigans.be.
        </p>
      </div>

      {referenceFaction ? (
        <div
          className="milty-ref-popup"
          role="dialog"
          aria-modal="true"
          aria-label={`Reference: ${referenceFaction.name}`}
          onClick={() => setReferenceFaction(null)}
        >
          <button
            type="button"
            className="milty-ref-popup__close"
            aria-label="Закрыть"
            onClick={() => setReferenceFaction(null)}
          >
            ×
          </button>
          <img
            src={referenceFaction.url}
            alt={referenceFaction.name}
            className="milty-ref-popup__img"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      ) : null}

      <AppDialog dialog={dialog} onClose={close} />
    </div>
  );
}
