/** Build mobile phase-hub chip configs shared by player/viewer consoles. */
export function buildPhaseHub({
  showDraftModal,
  showPoliticsModal,
  strategyResolutionActive,
  objectiveScoringActive,
  showStatusPhaseModal,
  includeStatus = false,
  openPhaseModal,
  openEventLog,
}) {
  const chips = [
    {
      id: 'draft',
      label: 'Драфт',
      icon: 'fa-layer-group',
      show: !!showDraftModal,
      onOpen: () => openPhaseModal('draft'),
    },
    {
      id: 'politics',
      label: 'Политика',
      icon: 'fa-gavel',
      show: !!showPoliticsModal,
      onOpen: () => openPhaseModal('politics'),
    },
    {
      id: 'strategy',
      label: 'Стратегия',
      icon: 'fa-clone',
      show: !!strategyResolutionActive,
      urgent: true,
      onOpen: () => openPhaseModal('strategyResolution'),
    },
    {
      id: 'scoring',
      label: 'Скоринг',
      icon: 'fa-bullseye',
      show: !!objectiveScoringActive,
      urgent: true,
      onOpen: () => openPhaseModal('objectiveScoring'),
    },
  ];
  if (includeStatus) {
    chips.push({
      id: 'status',
      label: 'Статус',
      icon: 'fa-clipboard-check',
      show: !!showStatusPhaseModal && !objectiveScoringActive,
      onOpen: () => openPhaseModal('statusPhase'),
    });
  }
  chips.push({
    id: 'log',
    label: 'Журнал',
    icon: 'fa-scroll',
    show: true,
    onOpen: openEventLog,
  });
  return chips;
}
