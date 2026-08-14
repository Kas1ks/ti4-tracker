import { useEffect } from 'react';

export function useGamePersistence(state) {
  const {
    isGameActive, targetScore, roundNumber, usePok, useTe, isPoliticsActive,
    players, objectives, completions, stage1Deck, stage2Deck, roundActive,
    turnOrder, activeTurnIdx, passed, turnTime, speakerId, draftAssignments,
    draftQueue, strategyCardBonuses,
  } = state;

  useEffect(() => {
    localStorage.setItem('ti4_active', JSON.stringify(isGameActive));
    localStorage.setItem('ti4_targetScore', JSON.stringify(targetScore));
    localStorage.setItem('ti4_round', JSON.stringify(roundNumber));
    localStorage.setItem('ti4_usePok', JSON.stringify(usePok));
    localStorage.setItem('ti4_useTe', JSON.stringify(useTe));
    localStorage.setItem('ti4_isPoliticsActive', JSON.stringify(isPoliticsActive));
  }, [isGameActive, targetScore, roundNumber, usePok, useTe, isPoliticsActive]);

  useEffect(() => {
    localStorage.setItem('ti4_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('ti4_objectives', JSON.stringify(objectives));
    localStorage.setItem('ti4_completions', JSON.stringify(completions));
    localStorage.setItem('ti4_stage1Deck', JSON.stringify(stage1Deck));
    localStorage.setItem('ti4_stage2Deck', JSON.stringify(stage2Deck));
  }, [objectives, completions, stage1Deck, stage2Deck]);

  useEffect(() => {
    localStorage.setItem('ti4_roundActive', JSON.stringify(roundActive));
    localStorage.setItem('ti4_turnOrder', JSON.stringify(turnOrder));
    localStorage.setItem('ti4_activeTurnIdx', JSON.stringify(activeTurnIdx));
    localStorage.setItem('ti4_passed', JSON.stringify(passed));
    localStorage.setItem('ti4_turnTime', JSON.stringify(turnTime));
    localStorage.setItem('ti4_speakerId', JSON.stringify(speakerId));
    localStorage.setItem('ti4_draftAssignments', JSON.stringify(draftAssignments));
    localStorage.setItem('ti4_draftQueue', JSON.stringify(draftQueue));
    localStorage.setItem('ti4_strategyBonuses', JSON.stringify(strategyCardBonuses));
  }, [roundActive, turnOrder, activeTurnIdx, passed, turnTime, speakerId, draftAssignments, draftQueue, strategyCardBonuses]);
}
