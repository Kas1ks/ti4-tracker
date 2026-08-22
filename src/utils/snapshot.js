import { BASE_OBJECTIVES, DEFAULT_OBJECTIVES } from '../data/gameData';
import { shuffleArray } from './game';

const defaultStage1Deck = () =>
  shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1));

const defaultStage2Deck = () =>
  shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2));

/** Apply a saved game snapshot to React state setters (cloud import + local restore). */
export function applyGameSnapshot(snap, actions) {
  const players = snap.players || [];
  const draftQueue = Array.isArray(snap.draftQueue) ? snap.draftQueue : [];

  actions.setTargetScore(snap.targetScore ?? 10);
  actions.setRoundNumber(snap.roundNumber || 1);
  actions.setUsePok(!!snap.usePok);
  actions.setUseTe(!!snap.useTe);
  actions.setPlayers(players);
  actions.setIsPoliticsActive(!!snap.isPoliticsActive);
  actions.setIsAgendaPhasePending(!!snap.isAgendaPhasePending);
  actions.setObjectives(snap.objectives || DEFAULT_OBJECTIVES);
  actions.setCompletions(snap.completions || {});
  actions.setRoundActive(!!snap.roundActive);
  actions.setDraftAssignments(snap.draftAssignments || {});
  actions.setDraftQueue(draftQueue);
  actions.setCurrentQueueIndex(snap.currentQueueIndex || 0);
  actions.setDraftPickOrder(snap.draftPickOrder || []);
  actions.setStage1Deck(snap.stage1Deck || defaultStage1Deck());
  actions.setStage2Deck(snap.stage2Deck || defaultStage2Deck());
  actions.setStrategyCardBonuses(snap.strategyCardBonuses || {});
  actions.setTurnOrder(snap.turnOrder || []);
  actions.setSpeakerId(snap.speakerId ?? players[0]?.id ?? null);
  actions.setActiveTurnIdx(snap.activeTurnIdx || 0);
  actions.setPassed(snap.passed || {});
  actions.setTurnTime(snap.turnTime || 0);

  if (draftQueue.length === 0) {
    actions.setDraftStep('DRAFT');
    actions.setShowDraftModal(false);
  } else {
    const step = snap.draftStep === 'CONFIRM' ? 'CONFIRM' : 'DRAFT';
    actions.setDraftStep(step);
    actions.setShowDraftModal(snap.showDraftModal !== false);
  }

  actions.setIsGameActive(true);
}
