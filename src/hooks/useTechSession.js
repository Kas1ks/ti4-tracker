import { ROLES } from '../sync/permissions';
import * as select from '../game/selectors';

/**
 * Derive Technology (7) research modal session for the current client role.
 */
/** Pure derivation — not a React hook (name kept for discoverability under hooks/). */
export function getTechSession({
  game,
  players,
  perms,
  roomStatus,
  isPlayerClient,
  techViewPlayerId,
}) {
  const strategyResolution = game.round?.strategyResolution;
  const techResearch = game.round?.techResearch;

  const techResolutionActive = !!(
    strategyResolution?.active
    && strategyResolution.cardId === 7
    && techResearch?.active
    && techResearch.concurrent
  );

  const myTechPending = !!(
    techResolutionActive
    && perms?.seatPlayerId != null
    && strategyResolution.responses?.[perms.seatPlayerId] === 'pending'
  );

  const hostTechFocusId = (() => {
    if (!techResolutionActive) return null;
    if (techViewPlayerId != null
      && strategyResolution.responses?.[techViewPlayerId] === 'pending') {
      return techViewPlayerId;
    }
    const pending = players.find(p => strategyResolution.responses?.[p.id] === 'pending');
    return pending?.id ?? null;
  })();

  const techSessionPlayerId = isPlayerClient
    ? (myTechPending ? perms.seatPlayerId : null)
    : hostTechFocusId;

  const techResearchView = techSessionPlayerId != null
    ? select.techResearchSessionFor(game, techSessionPlayerId)
    : null;

  const showTechResearchModal = !!techResearchView && (
    roomStatus === 'solo'
    || myTechPending
    || perms?.role === ROLES.ADMIN
  );

  return {
    techResolutionActive,
    myTechPending,
    techResearchView,
    showTechResearchModal,
  };
}
