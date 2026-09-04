import { useState } from 'react';

/** Ephemeral UI that never syncs to other devices. */
export function useLocalUi() {
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showGameSummaryModal, setShowGameSummaryModal] = useState(false);
  const [showCombatModal, setShowCombatModal] = useState(false);
  const [showSpeakerSelectionModal, setShowSpeakerSelectionModal] = useState(false);
  const [minimizedModals, setMinimizedModals] = useState({});
  const [combatOpponentId, setCombatOpponentId] = useState(null);
  const [combatHits, setCombatHits] = useState({ attacker: 0, defender: 0 });
  const [combatRound, setCombatRound] = useState(1);
  const [totalCombatDamage, setTotalCombatDamage] = useState({ attacker: 0, defender: 0 });
  const [expandedObjectives, setExpandedObjectives] = useState({});

  const toggleMinimize = (modalName) => {
    setMinimizedModals(prev => ({ ...prev, [modalName]: !prev[modalName] }));
  };

  const toggleExpand = (id) => {
    setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openCombatModal = () => {
    setCombatOpponentId(null);
    setCombatRound(1);
    setTotalCombatDamage({ attacker: 0, defender: 0 });
    setCombatHits({ attacker: 0, defender: 0 });
    setShowCombatModal(true);
  };

  const closeEndGameUi = () => {
    setShowEndGameModal(false);
    setShowGameSummaryModal(false);
  };

  return {
    showEndGameModal, setShowEndGameModal,
    showGameSummaryModal, setShowGameSummaryModal,
    showCombatModal, setShowCombatModal,
    showSpeakerSelectionModal, setShowSpeakerSelectionModal,
    minimizedModals, toggleMinimize,
    combatOpponentId, setCombatOpponentId,
    combatHits, setCombatHits,
    combatRound, setCombatRound,
    totalCombatDamage, setTotalCombatDamage,
    expandedObjectives, toggleExpand,
    openCombatModal,
    closeEndGameUi,
  };
}
