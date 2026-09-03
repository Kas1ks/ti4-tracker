import React, { useState } from 'react';
import { isCloudConfigured } from './config';
import { ALL_FACTIONS, BASE_OBJECTIVES, DEFAULT_OBJECTIVES, STRATEGY_CARDS } from './data/gameData';
import { shuffleArray } from './utils/game';
import { loadJson } from './utils/storage';
import { applyGameSnapshot } from './utils/snapshot';
import {
    clearCloudStats,
    createCloudSave,
    deleteCloudGame,
    fetchCloudSave,
    fetchCloudStats,
    postGameRecord,
} from './utils/cloud';
import { useGamePersistence } from './hooks/useGamePersistence';
import { useTurnTimer } from './hooks/useTurnTimer';
import { GameSummaryModal } from './components/GameSummaryModal';
import { MinimizedModalControls } from './components/MinimizedModalControls';
import { SetupScreen } from './components/SetupScreen';
import { GameBoard } from './components/GameBoard';
import { StatsModal } from './components/StatsModal';
import { StatusPhaseModal } from './components/StatusPhaseModal';
import { EndGameModal } from './components/EndGameModal';
import { DraftModal } from './components/DraftModal';
import { PoliticsModal } from './components/PoliticsModal';
import { CombatModal } from './components/CombatModal';
import { ActiveTurnBar } from './components/ActiveTurnBar';
import { SpeakerSelectionModal } from './components/SpeakerSelectionModal';

function cloudErrorMessage(err, fallback) {
    if (err?.data?.error === 'not-configured' || err?.status === 503) {
        return 'Облако на сервере не настроено. В Cloudflare Worker Secrets нужны JSONBIN_BIN_ID / JSONBIN_MASTER_KEY / ADMIN_PIN (или те же имена с префиксом VITE_).';
    }
    if (err?.status === 401) return 'Неверный PIN!';
    if (err?.status === 404) return 'Сохранение с таким кодом не найдено!';
    if (err?.status === 502) return 'Сервер не смог связаться с JSONBin. Проверьте ключи Worker Secrets.';
    return `${fallback} (код ${err?.status || '?'}).`;
}


        

        function App() {
            const [isGameActive, setIsGameActive] = useState(() => loadJson('ti4_active', false));
            const [targetScore, setTargetScore] = useState(() => loadJson('ti4_targetScore', 10));
            const [roundNumber, setRoundNumber] = useState(() => loadJson('ti4_round', 1));

            // Состояние окна выбора стратегий (Draft Modal)
            const [draftQueue, setDraftQueue] = useState(() => loadJson('ti4_draftQueue', []));
            const [draftAssignments, setDraftAssignments] = useState(() => loadJson('ti4_draftAssignments', {}));
            const [currentQueueIndex, setCurrentQueueIndex] = useState(() => loadJson('ti4_currentQueueIndex', 0));
            const [draftStep, setDraftStep] = useState(() => {
                const step = loadJson('ti4_draftStep', 'DRAFT');
                return step === 'CONFIRM' ? 'CONFIRM' : 'DRAFT';
            });
            const [showDraftModal, setShowDraftModal] = useState(() => {
                const queue = loadJson('ti4_draftQueue', []);
                if (!Array.isArray(queue) || queue.length === 0) return false;
                return true;
            });
            const [draftPickOrder, setDraftPickOrder] = useState(() => loadJson('ti4_draftPickOrder', []));
            const [strategyCardBonuses, setStrategyCardBonuses] = useState(() => loadJson('ti4_strategyBonuses', {}));
            const [roundActive, setRoundActive] = useState(() => loadJson('ti4_roundActive', false));

            // Функции управления стартом и завершением раунда
            const handleStartRound = () => {
                const orderedPlayers = players.filter(p => !p.eliminated).sort((a, b) => {
                    const isANaalu = a.factionId === 'naalu';
                    const isBNaalu = b.factionId === 'naalu';

                    if (isANaalu && !isBNaalu) return -1;
                    if (!isANaalu && isBNaalu) return 1;

                    const aInit = a.lastMinInitiative ?? 99;
                    const bInit = b.lastMinInitiative ?? 99;
                    if (aInit !== bInit) return aInit - bInit;
                    return a.id - b.id;
                });

                setTurnOrder(orderedPlayers);
                setActiveTurnIdx(0);

                setPlayers(prev =>
                    prev.map(player => ({
                        ...player,
                        passed: player.eliminated ? true : false,
                        strategyPlayed: player.eliminated ? true : false
                    }))
                );

                setPassed({});
                setTurnTime(0);

                setRoundActive(true);
                localStorage.setItem("ti4_roundActive", JSON.stringify(true));
            };

            const handleEndRound = () => {
                if (isAgendaPhasePending) {
                    setShowPoliticsModal(true);
                    return;
                }
                setShowStatusPhaseModal(true);
            };

            // Дополнения по умолчанию не выбраны
            const [usePok, setUsePok] = useState(() => loadJson('ti4_usePok', false));
            const [useTe, setUseTe] = useState(() => loadJson('ti4_useTe', false));

            // Игроки по умолчанию пустые
            const [players, setPlayers] = useState(() => loadJson('ti4_players', []));

            // === НОВОЕ: Создаем и храним перемешанные колоды целей ===
            const [stage1Deck, setStage1Deck] = useState(() => {
                const savedDeck = loadJson('ti4_stage1Deck', null);
                return savedDeck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1));
            });

            const [stage2Deck, setStage2Deck] = useState(() => {
                const savedDeck = loadJson('ti4_stage2Deck', null);
                return savedDeck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2));
            });
            // ==========================================================

            const [objectives, setObjectives] = useState(() => {
                const savedObjectives = loadJson('ti4_objectives', null);
                if (savedObjectives && Array.isArray(savedObjectives)) {
                    // Фильтруем сохраненные цели, удаляя те, которых больше нет в BASE_OBJECTIVES.
                    // Кастомные цели (с id, начинающимся на 'custom_') всегда сохраняются.
                    return savedObjectives.filter(savedObj =>
                        BASE_OBJECTIVES.some(baseObj => baseObj.id === savedObj.id) || savedObj.id.startsWith('custom_')
                    );
                }
                return DEFAULT_OBJECTIVES; // DEFAULT_OBJECTIVES - пустой массив, поэтому новые игры начинаются без целей.
            });
            const [completions, setCompletions] = useState(() => loadJson('ti4_completions', {})); 

            const [turnOrder, setTurnOrder] = useState(() => loadJson('ti4_turnOrder', []));
            const [activeTurnIdx, setActiveTurnIdx] = useState(() => loadJson('ti4_activeTurnIdx', 0));
            const [passed, setPassed] = useState(() => loadJson('ti4_passed', {}));

            // Модальные окна
            const [showStatusPhaseModal, setShowStatusPhaseModal] = useState(false);
            const [statusPhaseChecks, setStatusPhaseChecks] = useState({
                scoreObjectives: false,
                revealObjective: false,
                drawActionCards: false,
                gainCommandTokens: false,
                refreshAndRepair: false,
                returnStrategyCards: false,
            });
            const [showStatsModal, setShowStatsModal] = useState(false);
            const [showEndGameModal, setShowEndGameModal] = useState(false);
            const [isPoliticsActive, setIsPoliticsActive] = useState(() => loadJson('ti4_isPoliticsActive', false));
            const [isAgendaPhasePending, setIsAgendaPhasePending] = useState(() => loadJson('ti4_isAgendaPhasePending', false));

            const [speakerId, setSpeakerId] = useState(() => loadJson('ti4_speakerId', null)); // ID игрока-спикера
            const [showGameSummaryModal, setShowGameSummaryModal] = useState(false);
            // Состояние для окна боя
            const [showCombatModal, setShowCombatModal] = useState(false);
            // Состояние для свернутых модальных окон
            const [minimizedModals, setMinimizedModals] = useState({});

            const [combatOpponentId, setCombatOpponentId] = useState(null);
            const [combatHits, setCombatHits] = useState({ attacker: 0, defender: 0 });
            const [combatRound, setCombatRound] = useState(1);
            const [totalCombatDamage, setTotalCombatDamage] = useState({ attacker: 0, defender: 0 });
            const [showSpeakerSelectionModal, setShowSpeakerSelectionModal] = useState(false);

 
            // Состояние для модального окна Политики
            const [showPoliticsModal, setShowPoliticsModal] = useState(false); // Показать/скрыть модалку
            const [politicsStep, setPoliticsStep] = useState('SETUP'); // 'SETUP' | 'VOTE'
            const [agendas, setAgendas] = useState([
                { type: null, votes: {}, locked: {} }
            ]);
            const [currentAgendaIndex, setCurrentAgendaIndex] = useState(0);
            const toggleMinimize = (modalName) => {
                setMinimizedModals(prev => ({ ...prev, [modalName]: !prev[modalName] }));
            };

            const handleStatusCheck = (key) => {
                setStatusPhaseChecks(prev => ({ ...prev, [key]: !prev[key] }));
            };

            const emptyStatusChecks = {
                scoreObjectives: false,
                revealObjective: false,
                drawActionCards: false,
                gainCommandTokens: false,
                refreshAndRepair: false,
                returnStrategyCards: false,
            };

            const handleConfirmStatusPhase = () => {
                setShowStatusPhaseModal(false);
                setStatusPhaseChecks({ ...emptyStatusChecks });
                if (isPoliticsActive) {
                    setPoliticsStep('SETUP');
                    setAgendas([{ type: null, votes: {}, locked: {} }]);
                    setCurrentAgendaIndex(0);
                    setShowPoliticsModal(true);
                    setIsAgendaPhasePending(true);
                } else {
                    startNewRound();
                }
            };


            const resetGameState = () => {
                // Очищаем локальное хранилище браузера
                localStorage.removeItem('ti4_active');
                localStorage.removeItem('ti4_round');
                localStorage.removeItem('ti4_players');
                localStorage.removeItem('ti4_usePok');
                localStorage.removeItem('ti4_useTe');
                localStorage.removeItem('ti4_objectives');
                localStorage.removeItem('ti4_completions');
                localStorage.removeItem('ti4_turnOrder');
                localStorage.removeItem('ti4_activeTurnIdx');
                localStorage.removeItem('ti4_passed');
                localStorage.removeItem('ti4_roundActive');
                localStorage.removeItem('ti4_isPoliticsActive');
                localStorage.removeItem('ti4_draftAssignments');
                localStorage.removeItem('ti4_draftQueue');
                localStorage.removeItem('ti4_currentQueueIndex');
                localStorage.removeItem('ti4_draftStep');
                localStorage.removeItem('ti4_draftPickOrder');
                localStorage.removeItem('ti4_showDraftModal');
                localStorage.removeItem('ti4_stage1Deck'); // Очищаем колоды
                localStorage.removeItem('ti4_stage2Deck');
                localStorage.removeItem('ti4_gameSummary');
                localStorage.removeItem('ti4_strategyBonuses');
                localStorage.removeItem('ti4_speakerId');
                localStorage.removeItem('ti4_isAgendaPhasePending');

                // Сбрасываем состояния к исходным "чистым" значениям
                setIsGameActive(false);
                setRoundNumber(1);

                setTurnOrder([]);
                setActiveTurnIdx(0);
                setPassed({});
                setTurnTime(0);

                setRoundActive(false);

                setDraftAssignments({});
                setDraftQueue([]);
                setCurrentQueueIndex(0);
                setDraftPickOrder([]);
                setDraftStep('DRAFT');
                setShowDraftModal(false);

                setShowEndGameModal(false);

                setUsePok(false);
                setUseTe(false);

                setPlayers([]);
                setSpeakerId(null); // Сбрасываем спикера
                setIsPoliticsActive(false);
                setIsAgendaPhasePending(false);
                setShowStatusPhaseModal(false);
                setStatusPhaseChecks({ ...emptyStatusChecks });
                setStrategyCardBonuses({});
                setObjectives(DEFAULT_OBJECTIVES);
                setShowGameSummaryModal(false);
                setCompletions({});

                // Пересоздаем перемешанные колоды
                setStage1Deck(shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1)));
                setStage2Deck(shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2)));
            };

            // === БЛОК 2 (ОБНОВЛЕННЫЙ): Логика выбора и обмена карт стратегий ===

            // 1. Открытие модального окна и сборка очереди драфта
            const openStrategyDraft = () => {
                if (draftQueue.length > 0) {
                    setShowDraftModal(true);
                    return;
                }

                const activePlayersForDraft = players.filter(p => !p.eliminated);
                const draftAlreadyDone = activePlayersForDraft.length > 0
                    && activePlayersForDraft.every(p => p.cards && p.cards.length > 0);
                if (draftAlreadyDone || roundActive) {
                    return;
                }

                const cardsPerPlayer = players.length <= 4 ? 2 : 1;

                let speakerIndex = activePlayersForDraft.findIndex(p => p.id === speakerId);
                if (speakerIndex === -1) {
                    const newSpeakerId = activePlayersForDraft.length > 0 ? activePlayersForDraft[0].id : null;
                    setSpeakerId(newSpeakerId);
                    speakerIndex = 0;
                }

                const draftOrderPlayers = [
                    ...activePlayersForDraft.slice(speakerIndex),
                    ...activePlayersForDraft.slice(0, speakerIndex)
                ];

                const queue = [];

                for (let i = 0; i < cardsPerPlayer; i++) {
                    for (const player of draftOrderPlayers) {
                        queue.push(player.id);
                    }
                }

                setDraftQueue(queue);
                setCurrentQueueIndex(0);
                setDraftAssignments({});
                setDraftPickOrder([]);
                setDraftStep("DRAFT");
                setShowDraftModal(true);
            };

            // 2. Клик по карте во время драфта
            const handleSelectCard = (cardId) => {
                const currentPlayerId = draftQueue[currentQueueIndex];
                setDraftAssignments(prev => ({ ...prev, [cardId]: currentPlayerId }));
                setDraftPickOrder(prev => [...prev, cardId]);

                const nextIndex = currentQueueIndex + 1;
                if (nextIndex >= draftQueue.length) {
                    setDraftStep('CONFIRM');
                } else {
                    setCurrentQueueIndex(nextIndex);
                }
            };

            const handleUndoLastPick = () => {
                if (draftPickOrder.length === 0) return;

                const lastCardId = draftPickOrder[draftPickOrder.length - 1];
                const nextPickOrder = draftPickOrder.slice(0, -1);

                setDraftPickOrder(nextPickOrder);
                setDraftAssignments(prev => {
                    const next = { ...prev };
                    delete next[lastCardId];
                    return next;
                });
                setDraftStep('DRAFT');
                setCurrentQueueIndex(nextPickOrder.length);
            };

            // 3. Обмен/переназначение карты в окне подтверждения
            const handleReassignCard = (cardId, newPlayerId) => {
                setDraftAssignments({
                    ...draftAssignments,
                    [cardId]: parseInt(newPlayerId)
                });
            };

            // 4. Финальное подтверждение драфта
            const confirmDraft = () => {
                const assignments = new Map();

                Object.entries(draftAssignments).forEach(([cardId, playerId]) => {
                    if (!assignments.has(playerId)) {
                        assignments.set(playerId, []);
                    }

                    assignments.get(playerId).push(Number(cardId));
                });

                const updatedPlayers = players.map(player => {
                    const cardIds = assignments.get(player.id) || [];

                    cardIds.sort((a, b) => a - b);

                    const cards = cardIds
                        .map(id => STRATEGY_CARDS.find(card => card.id === id))
                        .filter(Boolean);

                    return {
                        ...player,
                        cards,
                        lastMinInitiative: cardIds.length
                            ? cardIds[0]
                            : player.lastMinInitiative ?? 99
                    };
                });

                // Обновляем бонусы на картах стратегий
                const newBonuses = { ...strategyCardBonuses };
                STRATEGY_CARDS.forEach(card => {
                    const wasPicked = Object.keys(draftAssignments).some(cardId => Number(cardId) === card.id);
                    if (wasPicked) {
                        newBonuses[card.id] = 0; // Сбрасываем бонус, если карту взяли
                    } else {
                        newBonuses[card.id] = (newBonuses[card.id] || 0) + 1; // Добавляем бонус, если не взяли
                    }
                });
                setStrategyCardBonuses(newBonuses);


                setPlayers(updatedPlayers);

                setShowDraftModal(false);

                setDraftAssignments({});
                setDraftQueue([]);
                setCurrentQueueIndex(0);
                setDraftPickOrder([]);
                setDraftStep('DRAFT');
            };

            // История и загрузка статистики
            const [globalHistory, setGlobalHistory] = useState([]);
            const [isStatsLoading, setIsStatsLoading] = useState(false);

            const [expandedObjectives, setExpandedObjectives] = React.useState({});

            const toggleExpand = (id) => {
                setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));
            };

            // Таймер
            const [turnTime, setTurnTime] = useState(() => loadJson('ti4_turnTime', 0));

            useGamePersistence({
                isGameActive, targetScore, roundNumber, usePok, useTe, isPoliticsActive,
                players, objectives, completions, stage1Deck, stage2Deck, roundActive,
                turnOrder, activeTurnIdx, passed, turnTime, speakerId, draftAssignments,
                draftQueue, currentQueueIndex, draftStep, showDraftModal, draftPickOrder,
                strategyCardBonuses, isAgendaPhasePending,
            });

            // Загрузить историю из облака через /api (секреты на Worker / Vite middleware)
            const fetchGlobalStats = async () => {
                if (!isCloudConfigured) return [];
                try {
                    return await fetchCloudStats();
                } catch (err) {
                    console.error(err);
                    return [];
                }
            };

            const openStatsModal = async () => {
                setShowStatsModal(true);
                setIsStatsLoading(true);
                const stats = await fetchGlobalStats();
                setGlobalHistory(stats);
                setIsStatsLoading(false);
            };

            const deleteSingleGame = async (gameId) => {
                if (!isCloudConfigured) {
                    alert("Облачная статистика не настроена.");
                    return;
                }
                const pin = prompt("Введите ADMIN PIN для удаления:");
                if (pin === null) return;
                try {
                    const updated = await deleteCloudGame(gameId, pin);
                    if (updated) setGlobalHistory(updated);
                    alert("Партия удалена.");
                } catch (err) {
                    alert(cloudErrorMessage(err, 'Ошибка при удалении'));
                }
            };

            const clearAllStats = async () => {
                if (!isCloudConfigured) {
                    alert("Облачная статистика не настроена.");
                    return;
                }
                const pin = prompt("Введите ADMIN PIN для сброса всей статистики:");
                if (pin === null) return;
                if (!confirm("Вы уверены? Вся история будет удалена безвозвратно!")) return;
                try {
                    await clearCloudStats(pin);
                    setGlobalHistory([]);
                    alert("Вся статистика очищена.");
                } catch (err) {
                    alert(cloudErrorMessage(err, 'Ошибка при очистке'));
                }
            };

            // Сохранить завершенную игру в облако
            const saveGameToCloud = async (winnerPlayer) => {
                const gameRecord = {
                    id: Date.now(),
                    date: new Date().toLocaleDateString('ru-RU'),
                    targetScore,
                    roundsCount: roundNumber,
                    winner: winnerPlayer ? winnerPlayer.name : "Ничья",
                    winningFaction: winnerPlayer ? (ALL_FACTIONS.find(f => f.id === winnerPlayer.factionId)?.name || "") : "",
                    players: players.map(p => ({
                        name: p.name,
                        damageDealt: p.damageDealt || 0,
                        faction: ALL_FACTIONS.find(f => f.id === p.factionId)?.name || p.factionId,
                        score: getPlayerScore(p.id),
                        totalTime: p.totalTime || 0,
                        avgTurnTime: roundNumber > 0 ? Math.round((p.totalTime || 0) / roundNumber) : 0,
                        isWinner: winnerPlayer ? p.id === winnerPlayer.id : false
                    }))
                };

                localStorage.setItem('ti4_gameSummary', JSON.stringify(gameRecord));

                if (!isCloudConfigured) {
                    alert("Партия сохранена только на этом устройстве. Облачная статистика не настроена.");
                    return;
                }

                try {
                    await postGameRecord(gameRecord);
                    alert("Партия успешно сохранена в общую статистику! 🏆");
                } catch (err) {
                    alert(cloudErrorMessage(err, 'Ошибка при сохранении в облако'));
                }
            };

            const activePlayer = turnOrder[activeTurnIdx];

            const activeStrategyCard =
                activePlayer?.cards
                    ?.slice()
                    ?.sort((a, b) => a.id - b.id)[0] || null;

            const isCurrentStrategyPlayed =
                activePlayer
                    ? !!activePlayer.strategyPlayed
                    : false;

            const markStrategyAsPlayed = () => {
                if (!activePlayer) return;
                const updatePlayerState = (p) => {
                    if (p.id === activePlayer.id) {
                        return { ...p, strategyPlayed: true };
                    }
                    return p;
                };
                setTurnOrder(prev => prev.map(updatePlayerState));
                setPlayers(prev => prev.map(updatePlayerState));
            };

            const playStrategyCard = () => {
                if (!activePlayer) return;

                // Если это карта Политики, открываем модалку выбора спикера
                if (activeStrategyCard && activeStrategyCard.id === 3) {
                    setShowSpeakerSelectionModal(true);
                    return; // Не помечаем карту сыгранной сразу, а ждем выбора в модалке
                }
                markStrategyAsPlayed();
            };
            useTurnTimer({
                isGameActive, turnOrder, activePlayer, passed, setTurnTime, setPlayers
            });

            const availableFactions = ALL_FACTIONS.filter(f => {
                if (f.exp === 'base') return true;
                if (f.exp === 'pok' && usePok) return true;
                if (f.exp === 'te' && useTe) return true;
                return false;
            });

            const addPlayer = () => {
                if (players.length >= 8) return;
                const newId = Date.now();
                const unassignedFaction = availableFactions.find(f => !players.some(p => p.factionId === f.id)) || availableFactions[0];
                // Цвет изначально не выбран ('')
                setPlayers([...players, { id: newId, name: `Игрок ${players.length + 1}`, factionId: unassignedFaction.id, color: '', secrets: 0, extra: 0, totalTime: 0, damageDealt: 0, eliminated: false }]);
            };

            const removePlayer = (id) => {
                setPlayers(players.filter(p => p.id !== id));
            };

            // Проверка занятости цвета
            const isColorTaken = (colorHex, currentPlayerId) => {
                return players.some(p => p.id !== currentPlayerId && p.color === colorHex);
            };

            // Запуск партии с валидацией
            const handleStartGame = () => {
                if (players.length < 2) {
                    alert('Для начала игры нужно добавить минимум 2 игроков!');
                    return;
                }
                const uncoloredPlayer = players.find(p => !p.color);
                if (uncoloredPlayer) {
                    alert(`Игрок "${uncoloredPlayer.name}" не выбрал цвет! Выберите цвет для всех игроков.`);
                    return;
                }
                // Назначаем спикера, если он еще не назначен (первый запуск)
                if (!speakerId && players.length > 0) {
                    setSpeakerId(players[0].id); // Первый игрок становится спикером
                }

                setIsGameActive(true);
            };

            const getPlayerScore = (playerId) => {
                const p = players.find(x => x.id === playerId);
                if (!p) return 0;
                let score = p.secrets + p.extra;
                objectives.forEach(obj => {
                    if (completions[`${playerId}_${obj.id}`]) score += obj.points;
                });
                return score;
            };

            // ОБНОВЛЕННАЯ ФУНКЦИЯ: теперь берет следующую цель из "колоды"
            const addRandomObjective = (stage) => {
                const deck = stage === 1 ? stage1Deck : stage2Deck;

                // 1. Находим первую цель в колоде, которой еще нет в списке активных
                const nextObjective = deck.find(deckObj => 
                    !objectives.some(activeObj => activeObj.id === deckObj.id)
                );

                // 2. Если такая цель не найдена (колода исчерпана), сообщаем об этом
                if (!nextObjective) {
                    alert(`Все цели ${stage} этапа уже открыты!`);
                    return;
                }

                // 3. Добавляем найденную цель в список активных
                setObjectives(prev => [...prev, { ...nextObjective }]);
            };

            const addCustomObjective = () => {
                const title = prompt("Введите название своей цели:");
                if (!title) return;

                const desc = prompt("Введите описание цели:", "Пользовательская цель");
                if (desc === null) return;

                let stage;
                while (true) {
                    stage = prompt("Введите этап цели (1 или 2):", "1");
                    if (stage === "1" || stage === "2") {
                        break;
                    }
                    if (stage === null) return; // Пользователь нажал "Отмена"
                    alert("Неверный этап. Пожалуйста, введите 1 или 2.");
                }

                setObjectives(prev => [...prev, { id: 'custom_' + Date.now(), title, desc, stage: Number(stage), points: Number(stage) }]);
            };

            const toggleCompletion = (pId, oId) => {
                const key = `${pId}_${oId}`;
                setCompletions(prev => ({ ...prev, [key]: !prev[key] }));
            };
            const removeObjective = (objectiveId) => {
                setObjectives(prev => prev.filter(obj => obj.id !== objectiveId));
            };
            const handleAddSecret = (playerId) => {
                setPlayers(prev => prev.map(p => {
                    if (p.id !== playerId) return p;

                    if (p.secrets === 3) {
                        const confirmFourth = window.confirm(
                            `У ${p.name} уже 3 секретные цели (стандартный лимит). Добавить 4-ю целевую секретку?`
                        );
                        if (!confirmFourth) return p;
                    }

                    return { ...p, secrets: Math.min(4, p.secrets + 1) };
                }));
            };
            const exportGameToken = async () => {
                if (!isCloudConfigured) {
                    alert("Облачное сохранение не настроено.");
                    return;
                }
                const gameState = {
                    targetScore,
                    roundNumber,
                    usePok,
                    useTe,
                    players,
                    objectives,
                    completions,
                    roundActive,
                    draftAssignments,
                    draftQueue,
                    currentQueueIndex,
                    draftPickOrder,
                    draftStep,
                    showDraftModal,
                    turnOrder,
                    stage1Deck,
                    stage2Deck,
                    strategyCardBonuses,
                    speakerId,
                    isPoliticsActive,
                    isAgendaPhasePending,
                    activeTurnIdx,
                    passed,
                    turnTime,
                    timestamp: new Date().toLocaleString('ru-RU')
                };

                try {
                    const saveId = await createCloudSave(gameState);
                    navigator.clipboard.writeText(saveId);
                    alert(`Партия сохранена! Код сохранения: ${saveId} (скопирован в буфер обмена)`);
                } catch (err) {
                    alert(cloudErrorMessage(err, 'Ошибка при сохранении в облако'));
                }
            };


            const snapshotActions = {
                setTargetScore,
                setRoundNumber,
                setUsePok,
                setUseTe,
                setPlayers,
                setIsPoliticsActive,
                setIsAgendaPhasePending,
                setObjectives,
                setCompletions,
                setRoundActive,
                setDraftAssignments,
                setDraftQueue,
                setCurrentQueueIndex,
                setDraftPickOrder,
                setStage1Deck,
                setStage2Deck,
                setStrategyCardBonuses,
                setTurnOrder,
                setSpeakerId,
                setActiveTurnIdx,
                setPassed,
                setTurnTime,
                setDraftStep,
                setShowDraftModal,
                setIsGameActive,
            };

            const importGameToken = async (saveId) => {
                if (!isCloudConfigured) {
                    alert("Облачная загрузка не настроена.");
                    return;
                }
                const cleanId = saveId ? saveId.trim() : '';
                if (!cleanId) {
                    alert('Введите код партии!');
                    return;
                }

                try {
                    const snap = await fetchCloudSave(cleanId);
                    applyGameSnapshot(snap, snapshotActions);
                    alert('Партия успешно загружена из облака!');
                } catch (err) {
                    alert(cloudErrorMessage(err, 'Ошибка при загрузке из облака'));
                }
            };

            const restoreSnapshot = (snap) => {
                if (!confirm(`Восстановить сохранение от ${snap.timestamp}? Текущий прогресс изменится.`)) return;
                applyGameSnapshot(snap, snapshotActions);
            };

            const nextTurn = () => {
                if (turnOrder.length === 0) return;

                let nextIdx = (activeTurnIdx + 1) % turnOrder.length;
                let checkedCount = 0;

                while (passed[turnOrder[nextIdx].id] && checkedCount < turnOrder.length) {
                    nextIdx = (nextIdx + 1) % turnOrder.length;
                    checkedCount++;
                }

                const remainingActive = turnOrder.filter(p => !passed[p.id]);
                if (remainingActive.length === 0) {
                    handleEndRound();
                    return;
                }

                if (checkedCount < turnOrder.length) setActiveTurnIdx(nextIdx);
                setTurnTime(0);
            };

            const passTurn = (pId) => {
                if (!isCurrentStrategyPlayed) {
                    alert('Нельзя пасовать, пока вы не сыграли свою карту стратегии!');
                    return;
                }

                const updatedPassed = { ...passed, [pId]: true };
                setPassed(updatedPassed);

                const remainingActive = turnOrder.filter(p => !updatedPassed[p.id]);

                if (remainingActive.length === 0) {
                    handleEndRound();
                } else {
                    nextTurn();
                }
            };

            const eliminatePlayer = (playerId) => {
                const playerToEliminate = players.find(p => p.id === playerId);
                if (!playerToEliminate) return;

                if (!window.confirm(`Вы уверены, что хотите устранить игрока "${playerToEliminate.name}"? Это действие необратимо в рамках текущей партии.`)) {
                    return;
                }

                setPlayers(prevPlayers => prevPlayers.map(p =>
                    p.id === playerId ? { ...p, eliminated: true } : p
                ));

                const updatedPassed = { ...passed, [playerId]: true };
                setPassed(updatedPassed);

                if (speakerId === playerId) {
                    const oldSpeakerIndex = players.findIndex(p => p.id === playerId);
                    let newSpeaker = null;
                    if (oldSpeakerIndex !== -1) {
                        for (let i = 1; i < players.length; i++) {
                            const nextPlayer = players[(oldSpeakerIndex + i) % players.length];
                            if (nextPlayer.id !== playerId && !nextPlayer.eliminated) {
                                newSpeaker = nextPlayer;
                                break;
                            }
                        }
                    }
                    if (newSpeaker) {
                        setSpeakerId(newSpeaker.id);
                        alert(`Игрок ${playerToEliminate.name} был спикером. Новым спикером становится ${newSpeaker.name}.`);
                    } else {
                        const remainingPlayers = players.filter(p => p.id !== playerId && !p.eliminated);
                        setSpeakerId(remainingPlayers[0]?.id || null);
                    }
                }

                const remainingActiveInTurn = turnOrder.filter(p => !updatedPassed[p.id]);
                if (roundActive && remainingActiveInTurn.length === 0) {
                    handleEndRound();
                } else if (activePlayer && activePlayer.id === playerId) {
                    nextTurn();
                }
            };

            const startNewRound = () => {
                setIsAgendaPhasePending(false);
                setRoundNumber(prev => {
                    const next = prev + 1;
                    localStorage.setItem("ti4_round", JSON.stringify(next));
                    return next;
                });

                // Сбрасываем игровое состояние игроков
                setPlayers(prev =>
                    prev.map(player => ({
                        ...player,
                        strategyPlayed: false,
                        passed: false,
                        cards: []
                    }))
                );

                // Очередь начинается заново после нового драфта
                setTurnOrder([]);
                setActiveTurnIdx(0);
                setPassed({});
                setTurnTime(0);
                setRoundActive(false);

                setDraftAssignments({});
                setDraftQueue([]);
                setCurrentQueueIndex(0);
                setDraftPickOrder([]);
                setDraftStep('DRAFT');
                setShowDraftModal(false);

                localStorage.setItem("ti4_roundActive", JSON.stringify(false));
            };

            const isFactionTaken = (factionId, currentPlayerId) => {
                return players.some(p => p.id !== currentPlayerId && p.factionId === factionId);
            };

            const sortedPlayersForBoard = [...players].sort((a, b) => {
                const scoreA = getPlayerScore(a.id);
                const scoreB = getPlayerScore(b.id);
                if (scoreB !== scoreA) {
                    return scoreB - scoreA;
                }
                return a.id - b.id;
            });

            const openCombatModal = () => {
                setCombatOpponentId(null);
                setCombatRound(1);
                setTotalCombatDamage({ attacker: 0, defender: 0 });
                setCombatHits({ attacker: 0, defender: 0 });
                setShowCombatModal(true);
            };

            const activePlayers = players.filter(p => !p.eliminated);
            const canStartRound = activePlayers.length > 0 && activePlayers.every(p => p.cards && p.cards.length > 0);
            const draftInProgress = draftQueue.length > 0;
            const isDraftLocked = canStartRound && !draftInProgress;

            return (
                <div className="max-w-[1800px] mx-auto min-h-screen flex flex-col text-slate-100 px-3 md:px-8">

                    {/* ХЕДЕР */}
                    <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 shadow-xl rounded-b-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <i className="fa-solid fa-khanda text-cyan-400 text-2xl md:text-3xl"></i>
                                <span className="font-orbitron font-black text-xl md:text-3xl text-white tracking-wider">TI4 TRACKER</span>
                            </div>

                            <div className="flex items-center gap-4">
                                {isGameActive ? (
                                    <>
                                        <div className="text-sm md:text-base font-bold text-amber-400 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl font-orbitron">
                                            РАУНД {roundNumber}
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                                            <span className={`font-bold text-xs uppercase ${isPoliticsActive ? 'text-purple-400' : 'text-slate-500'}`}>Политика</span>
                                            <button
                                                onClick={() => setIsPoliticsActive(!isPoliticsActive)}
                                                title={isPoliticsActive ? "Деактивировать фазу политики" : "Активировать фазу политики (после взятия Мекатола)"}
                                                className={`w-9 h-5 rounded-full flex items-center transition-colors px-0.5 ${isPoliticsActive ? 'bg-purple-600 justify-end' : 'bg-slate-700 justify-start'}`}
                                            >
                                                <span className="w-4 h-4 bg-white rounded-full block shadow-md"></span>
                                            </button>
                                        </div>



                                        {/* === БЛОК 3: Кнопки управления фазой драфта и раунда === */}
                                        <div className="flex gap-2">
                                            {/* 1. Кнопка «Выбор карт стратегии» (активна только между раундами) */}
                                            <button
                                                onClick={openStrategyDraft}
                                                disabled={roundActive || isDraftLocked}
                                                title={isDraftLocked ? 'Карты уже выбраны — дождитесь конца раунда' : undefined}
                                                className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition border border-amber-400/30 shadow-md flex items-center gap-1.5"
                                            >
                                                <i className="fa-solid fa-layer-group"></i> Выбор карт стратегий
                                            </button>

                                            {/* 2. Переключатель раунда: «Начать раунд» или «Завершить раунд» */}
                                            {!roundActive ? (
                                                <button
                                                    onClick={handleStartRound}
                                                    disabled={!canStartRound}
                                                    className={`font-bold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5 ${
                                                        canStartRound
                                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <i className="fa-solid fa-play"></i> Начать раунд
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleEndRound}
                                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-md flex items-center gap-1.5"
                                                >
                                                    <i className="fa-solid fa-flag-checkered"></i> Завершить раунд
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            onClick={exportGameToken}
                                            className="bg-cyan-950/80 hover:bg-cyan-900 text-cyan-400 font-extrabold px-3 py-2 rounded-xl text-xs md:text-sm border border-cyan-800 transition flex items-center gap-1.5 shadow"
                                            title="Скопировать токен партии"
                                        >
                                            <i className="fa-solid fa-share-nodes"></i>
                                            <span className="hidden sm:inline">Код игры</span>
                                        </button>

                                        <button
                                            onClick={() => setShowEndGameModal(true)}
                                            className="bg-red-900/80 hover:bg-red-800 text-red-200 font-extrabold px-4 py-2 rounded-xl text-xs md:text-sm border border-red-700 transition flex items-center gap-1.5 shadow">
                                            <i className="fa-solid fa-square-xmark"></i>
                                            <span className="hidden sm:inline">Завершить</span>
                                        </button>
                                    </>

                                ) : (
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={openStatsModal}
                                            className="bg-purple-950/80 hover:bg-purple-900 text-purple-300 font-extrabold px-4 py-2 rounded-xl text-xs md:text-sm border border-purple-800 transition flex items-center gap-1.5 shadow"
                                        >
                                            <i className="fa-solid fa-chart-pie"></i>
                                            <span>📊 Статистика компании</span>
                                        </button>

                                        <div className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-4 py-2 rounded-xl font-bold text-xs md:text-sm uppercase tracking-wider font-orbitron">
                                            Режим Настройки
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isGameActive && turnOrder.length > 0 && activePlayer && !passed[activePlayer.id] && (
                            <ActiveTurnBar
                                activePlayer={activePlayer}
                                activeStrategyCard={activeStrategyCard}
                                isCurrentStrategyPlayed={isCurrentStrategyPlayed}
                                onPlayStrategy={playStrategyCard}
                                turnTime={turnTime}
                                onNextTurn={nextTurn}
                                onPassTurn={passTurn}
                                onOpenCombat={openCombatModal}
                            />
                        )}
                    </header>

                    {/* КОНТЕНТ */}
                    <main className="py-6 flex-grow space-y-8">

                        {/* 1. ЭКРАН НАСТРОЙКИ */}
                        {!isGameActive && (
                            <SetupScreen
                                targetScore={targetScore}
                                setTargetScore={setTargetScore}
                                usePok={usePok}
                                setUsePok={setUsePok}
                                useTe={useTe}
                                setUseTe={setUseTe}
                                players={players}
                                setPlayers={setPlayers}
                                addPlayer={addPlayer}
                                removePlayer={removePlayer}
                                availableFactions={availableFactions}
                                isFactionTaken={isFactionTaken}
                                isColorTaken={isColorTaken}
                                importGameToken={importGameToken}
                                restoreSnapshot={restoreSnapshot}
                                handleStartGame={handleStartGame}
                            />
                        )}

                        {/* 2. ЭКРАН АКТИВНОЙ ИГРЫ */}
                        {isGameActive && (
                            <GameBoard
                                turnOrder={turnOrder}
                                passed={passed}
                                activePlayer={activePlayer}
                                sortedPlayersForBoard={sortedPlayersForBoard}
                                getPlayerScore={getPlayerScore}
                                players={players}
                                setPlayers={setPlayers}
                                objectives={objectives}
                                completions={completions}
                                toggleCompletion={toggleCompletion}
                                expandedObjectives={expandedObjectives}
                                toggleExpand={toggleExpand}
                                removeObjective={removeObjective}
                                addRandomObjective={addRandomObjective}
                                addCustomObjective={addCustomObjective}
                                targetScore={targetScore}
                                speakerId={speakerId}
                                handleAddSecret={handleAddSecret}
                                eliminatePlayer={eliminatePlayer}
                                isGameActive={isGameActive}
                            />
                        )}


                        <StatusPhaseModal
                            show={showStatusPhaseModal}
                            minimized={!!minimizedModals.statusPhase}
                            roundNumber={roundNumber}
                            checks={statusPhaseChecks}
                            onCheck={handleStatusCheck}
                            onConfirm={handleConfirmStatusPhase}
                            onClose={() => setShowStatusPhaseModal(false)}
                            onMinimize={() => toggleMinimize('statusPhase')}
                        />

                        <StatsModal
                            showStatsModal={showStatsModal}
                            setShowStatsModal={setShowStatsModal}
                            isStatsLoading={isStatsLoading}
                            globalHistory={globalHistory}
                            deleteSingleGame={deleteSingleGame}
                            clearAllStats={clearAllStats}
                        />

                        <EndGameModal
                            showEndGameModal={showEndGameModal}
                            setShowEndGameModal={setShowEndGameModal}
                            players={players}
                            getPlayerScore={getPlayerScore}
                            saveGameToCloud={saveGameToCloud}
                            setShowGameSummaryModal={setShowGameSummaryModal}
                            resetGameState={resetGameState}
                        />
                        <DraftModal
                            showDraftModal={showDraftModal}
                            minimizedModals={minimizedModals}
                            toggleMinimize={toggleMinimize}
                            setShowDraftModal={setShowDraftModal}
                            draftStep={draftStep}
                            draftQueue={draftQueue}
                            players={activePlayers}
                            currentQueueIndex={currentQueueIndex}
                            draftAssignments={draftAssignments}
                            draftPickOrder={draftPickOrder}
                            strategyCardBonuses={strategyCardBonuses}
                            handleSelectCard={handleSelectCard}
                            handleUndoLastPick={handleUndoLastPick}
                            handleReassignCard={handleReassignCard}
                            confirmDraft={confirmDraft}
                        />
                        <PoliticsModal
                            show={showPoliticsModal}
                            minimized={!!minimizedModals.politics}
                            onMinimize={() => toggleMinimize('politics')}
                            onClose={() => setShowPoliticsModal(false)}
                            politicsStep={politicsStep}
                            setPoliticsStep={setPoliticsStep}
                            agendas={agendas}
                            setAgendas={setAgendas}
                            currentAgendaIndex={currentAgendaIndex}
                            setCurrentAgendaIndex={setCurrentAgendaIndex}
                            activePlayers={activePlayers}
                            players={players}
                            setPlayers={setPlayers}
                            speakerId={speakerId}
                            setSpeakerId={setSpeakerId}
                            onFinish={() => {
                                setShowPoliticsModal(false);
                                startNewRound();
                            }}
                        />
                        <CombatModal
                            show={showCombatModal}
                            minimized={!!minimizedModals.combat}
                            onMinimize={() => toggleMinimize('combat')}
                            onClose={() => setShowCombatModal(false)}
                            activePlayer={activePlayer}
                            activePlayers={activePlayers}
                            players={players}
                            setPlayers={setPlayers}
                            combatOpponentId={combatOpponentId}
                            setCombatOpponentId={setCombatOpponentId}
                            combatHits={combatHits}
                            setCombatHits={setCombatHits}
                            combatRound={combatRound}
                            setCombatRound={setCombatRound}
                            totalCombatDamage={totalCombatDamage}
                            setTotalCombatDamage={setTotalCombatDamage}
                        />
                        <SpeakerSelectionModal
                            show={showSpeakerSelectionModal}
                            activePlayer={activePlayer}
                            activePlayers={activePlayers}
                            onSelectSpeaker={(playerId) => {
                                setSpeakerId(playerId);
                                markStrategyAsPlayed();
                                setShowSpeakerSelectionModal(false);
                            }}
                        />
                        <GameSummaryModal
                            show={showGameSummaryModal}
                            onClose={() => { setShowGameSummaryModal(false); resetGameState(); }}
                        />
                    </main>
                    <MinimizedModalControls
                        minimizedModals={minimizedModals}
                        showDraftModal={showDraftModal}
                        showPoliticsModal={showPoliticsModal}
                        showCombatModal={showCombatModal}
                        showStatusPhaseModal={showStatusPhaseModal}
                        onRestore={toggleMinimize}
                    />
                </div>
            );
        }
export default App;
