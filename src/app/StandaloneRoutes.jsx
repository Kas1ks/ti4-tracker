import { lazy, Suspense } from 'react';
import { RouteFallback } from './RouteFallback';

const StatsPage = lazy(() => import('../components/StatsModal').then((m) => ({ default: m.StatsPage })));
const GuidePage = lazy(() => import('../components/GuidePage').then((m) => ({ default: m.GuidePage })));
const AdminRoomsPage = lazy(() => import('../components/AdminRoomsPage').then((m) => ({ default: m.AdminRoomsPage })));
const MiltyCreatePage = lazy(() => import('../components/MiltyCreatePage').then((m) => ({ default: m.MiltyCreatePage })));
const MiltyDraftPage = lazy(() => import('../components/MiltyDraftPage').then((m) => ({ default: m.MiltyDraftPage })));

/**
 * Full-page routes that skip the live-game shell.
 * Returns null when the current path is the main hub/game flow.
 */
export function StandaloneRoutes({
  location,
  navigate,
  dialogSlot,
  cloud,
  unlockAsHost,
  onCreatePartyWithMilty,
}) {
  const path = location.pathname;
  const isStatsRoute = path === '/stats';
  const isGuideRoute = path === '/guide';
  const isAdminRoomsRoute = path === '/admin/rooms';
  const isMiltyCreateRoute = path === '/milty';
  const miltyDraftMatch = path.match(/^\/milty\/([^/]+)$/);
  const isMiltyDraftRoute = !!miltyDraftMatch;

  if (isStatsRoute) {
    return (
      <>
        <Suspense fallback={<RouteFallback />}>
          <StatsPage
            onBack={() => navigate('/')}
            isStatsLoading={cloud.isStatsLoading}
            globalHistory={cloud.globalHistory}
            pendingLocalCount={cloud.pendingLocalCount}
            isPendingUploading={cloud.isPendingUploading}
            onUploadPending={cloud.uploadPendingStats}
            deleteSingleGame={cloud.deleteSingleGame}
            clearAllStats={cloud.clearAllStats}
          />
        </Suspense>
        {dialogSlot}
      </>
    );
  }

  if (isGuideRoute) {
    return (
      <>
        <Suspense fallback={<RouteFallback />}>
          <GuidePage onBack={() => navigate('/')} />
        </Suspense>
        {dialogSlot}
      </>
    );
  }

  if (isAdminRoomsRoute) {
    return (
      <>
        <Suspense fallback={<RouteFallback />}>
          <AdminRoomsPage onBack={() => navigate('/')} />
        </Suspense>
        {dialogSlot}
      </>
    );
  }

  if (isMiltyCreateRoute || isMiltyDraftRoute) {
    const partyMode = !!(location.state?.party);
    const partyCreateSecret = location.state?.createSecret || null;
    return (
      <>
        <Suspense fallback={<RouteFallback />}>
          {isMiltyCreateRoute ? (
            <MiltyCreatePage
              partyMode={partyMode}
              createSecret={partyCreateSecret}
              unlockAsHost={unlockAsHost}
              onCreateParty={partyMode
                ? (settings) => onCreatePartyWithMilty(settings, partyCreateSecret)
                : null}
            />
          ) : (
            <MiltyDraftPage />
          )}
        </Suspense>
        {dialogSlot}
      </>
    );
  }

  return null;
}

/** True when pathname is handled by StandaloneRoutes (skip game shell hooks side-effects if needed). */
export function isStandalonePath(pathname) {
  if (!pathname) return false;
  if (pathname === '/stats' || pathname === '/guide' || pathname === '/admin/rooms' || pathname === '/milty') {
    return true;
  }
  return /^\/milty\/[^/]+$/.test(pathname);
}
