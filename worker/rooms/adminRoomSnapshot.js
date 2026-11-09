import { publicRoomView } from './roomCore.js';

function countKeys(map) {
  if (!map || typeof map !== 'object') return 0;
  return Object.keys(map).length;
}

/** Counts/flags only — never card ids or hand contents. */
function secretsSummary(state) {
  const sec = state?.secretObjectives || {};
  const overflows = sec.overflows || {};
  let discardSeats = 0;
  for (const key of Object.keys(overflows)) {
    const row = overflows[key];
    if (row) discardSeats += 1;
  }
  return {
    dealStarted: !!sec.dealStarted,
    draftPending: !!sec.draftPending,
    deckCount: Array.isArray(sec.deck) ? sec.deck.length : 0,
    scoredCount: Array.isArray(sec.scored) ? sec.scored.length : 0,
    pendingRevealCount: countKeys(sec.pendingReveals),
    discardSeatCount: discardSeats,
  };
}

function politicsSummary(state) {
  const meta = state?.meta || {};
  const pol = state?.politics || {};
  return {
    active: !!meta.isPoliticsActive,
    agendaPending: !!meta.isAgendaPhasePending,
    modalOpen: !!pol.showModal,
    step: pol.step || null,
    agendasOpen: Array.isArray(pol.agendas) ? pol.agendas.length : 0,
    lawsCount: Array.isArray(pol.activeLaws) ? pol.activeLaws.length : 0,
  };
}

function processSummary(state) {
  const round = state?.round || {};
  const draft = state?.draft || {};
  const status = state?.statusPhase || {};
  const bits = [];
  if (draft?.showModal) bits.push('strategy-draft');
  if (status?.show) bits.push('status');
  if (state?.politics?.showModal || state?.meta?.isAgendaPhasePending) bits.push('agenda');
  if (round?.strategyResolution?.active) bits.push('strategy-resolve');
  if (round?.objectiveScoring?.active) bits.push('obj-scoring');
  if (round?.combat?.active) bits.push('combat');
  if (round?.active) bits.push('action');
  return bits;
}

function gameSummary(state) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const order = Array.isArray(state?.round?.turnOrderIds) ? state.round.turnOrderIds : [];
  const idx = Number(state?.round?.activeTurnIdx);
  const activeId = Number.isFinite(idx) && order[idx] != null ? order[idx] : null;
  const active = activeId != null
    ? players.find((p) => String(p.id) === String(activeId))
    : null;
  const speakerId = state?.meta?.speakerId ?? null;
  const speaker = speakerId != null
    ? players.find((p) => String(p.id) === String(speakerId))
    : null;
  const exp = state?.expedition || {};
  const slices = exp.slices || {};
  const claimedSlices = Object.values(slices).filter((v) => v != null).length;
  return {
    roundNumber: Number(state?.meta?.roundNumber) || 1,
    targetScore: Number(state?.meta?.targetScore) || null,
    roundActive: !!state?.round?.active,
    activePlayerId: active?.id ?? null,
    activePlayerName: active?.name || null,
    speakerId: speaker?.id ?? null,
    speakerName: speaker?.name || null,
    useTe: !!state?.meta?.useTe,
    usePok: !!state?.meta?.usePok,
    mecatolControllerId: state?.vpTrack?.mecatolControllerId ?? null,
    custodiansPlayerId: state?.vpTrack?.custodiansPlayerId ?? null,
    expeditionClaimed: claimedSlices,
    expeditionTotal: 6,
    expeditionCompleted: !!exp.completed,
    process: processSummary(state),
  };
}

function seatsSummary(state, clients, claimedSeats) {
  const players = Array.isArray(state?.players) ? state.players : [];
  const claimed = new Set((claimedSeats || []).map((id) => String(id)));
  const onlineBySeat = new Map();
  for (const c of clients || []) {
    if (c?.seatPlayerId == null) continue;
    const key = String(c.seatPlayerId);
    onlineBySeat.set(key, (onlineBySeat.get(key) || 0) + 1);
  }
  return players
    .filter((p) => p && !p.eliminated)
    .map((p) => {
      const id = p.id;
      const key = String(id);
      return {
        id,
        name: String(p.name || '').trim() || `Игрок ${id}`,
        claimed: claimed.has(key),
        online: onlineBySeat.get(key) || 0,
      };
    });
}

function healthSummary(room, view, sseCount) {
  const now = Date.now();
  const lastMs = Date.parse(view.lastActivityAt || 0);
  const createdMs = Date.parse(view.createdAt || 0);
  const expMs = Date.parse(view.expiresAt || 0);
  const idleSec = Number.isFinite(lastMs) ? Math.max(0, Math.floor((now - lastMs) / 1000)) : null;
  const uptimeSec = Number.isFinite(createdMs) ? Math.max(0, Math.floor((now - createdMs) / 1000)) : null;
  const expiresInSec = Number.isFinite(expMs) ? Math.floor((expMs - now) / 1000) : null;
  const hostOnline = view.hostOnline !== false;
  const warnings = [];
  if (!hostOnline) warnings.push('host-offline');
  if (expiresInSec != null && expiresInSec <= 3600) warnings.push('expires-soon');
  if (idleSec != null && idleSec >= 900) warnings.push('idle');
  if (sseCount === 0 && !!room.state?.isGameActive) warnings.push('no-sse');
  return {
    seq: typeof room.seq === 'number' ? room.seq : 0,
    idleSec,
    uptimeSec,
    expiresInSec,
    warnings,
    /** Rough load proxy — not Cloudflare Duration billing. */
    loadHint: {
      sseCount,
      uptimeSec,
      idleSec,
    },
  };
}

/**
 * Build a secret-free admin snapshot for one live room.
 * @param {object} room
 * @param {Array<{ role?: string, seatPlayerId?: *, isAdmin?: boolean }>} clients
 * @param {{ events?: object[] }} [extras]
 */
export function buildAdminRoomSnapshot(room, clients = [], extras = {}) {
  if (!room?.roomId) return null;
  const view = publicRoomView(room);
  const players = Array.isArray(room.state?.players) ? room.state.players : [];
  const nameBySeat = new Map(
    players
      .filter((p) => p && p.id != null)
      .map((p) => [String(p.id), String(p.name || p.faction || '').trim() || null]),
  );

  const list = Array.isArray(clients) ? clients : [];
  const safeClients = list.map((c) => {
    const seatPlayerId = c?.seatPlayerId ?? null;
    const role = c?.role || (c?.isAdmin ? 'admin' : 'viewer');
    const playerName = seatPlayerId != null
      ? (nameBySeat.get(String(seatPlayerId)) || null)
      : null;
    return {
      role,
      seatPlayerId,
      playerName,
    };
  });

  const claimedSeats = view.claimedSeats || [];
  const secrets = secretsSummary(room.state);
  const politics = politicsSummary(room.state);
  const game = gameSummary(room.state);
  const seats = seatsSummary(room.state, safeClients, claimedSeats);
  const health = healthSummary(room, view, safeClients.length);
  const events = Array.isArray(extras.events) ? extras.events.slice(-40) : [];

  let attention = 'ok';
  if (health.warnings.includes('host-offline') || health.warnings.includes('no-sse')) {
    attention = 'problem';
  }
  // Interactive stalls outrank connectivity noise for the list badge.
  if (secrets.discardSeatCount > 0 || secrets.pendingRevealCount > 0) attention = 'secrets';
  if (politics.modalOpen || politics.agendaPending) attention = 'politics';

  return {
    roomId: view.roomId,
    phase: view.phase || 'setup',
    hostOnline: view.hostOnline !== false,
    lastActivityAt: view.lastActivityAt || null,
    expiresAt: view.expiresAt || null,
    createdAt: view.createdAt || null,
    miltyStatus: view.milty?.status || null,
    isGameActive: !!room.state?.isGameActive,
    playersTotal: players.filter((p) => !p?.eliminated).length,
    claimedCount: claimedSeats.length,
    sseCount: safeClients.length,
    clients: safeClients,
    seats,
    secrets,
    politics,
    game,
    health,
    events,
    attention,
  };
}

/** True if an object looks like it leaked live-room secrets. */
export function adminSnapshotHasSecrets(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const blob = JSON.stringify(snapshot);
  return /hostKey|sessionToken|seatSecret|adminSecret/i.test(blob);
}
