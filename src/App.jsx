import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ADMIN_PIN, isCloudConfigured } from './config';
import { ALL_FACTIONS, BASE_OBJECTIVES, DEFAULT_OBJECTIVES, STRATEGY_CARDS } from './data/gameData';
import { formatTime, isAgendaFullyVoted, shuffleArray } from './utils/game';
import { loadJson } from './utils/storage';
import { fetchCloudBin, putCloudBin } from './utils/cloud';
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

            const [showObjectiveModal, setShowObjectiveModal] = useState(false);
            const [selectedStage, setSelectedStage] = useState(1); // 1 или 2 этап

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
            const [otherChoices, setOtherChoices] = useState(['']);

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
                const cardsPerPlayer = players.length <= 4 ? 2 : 1;
                const activePlayersForDraft = players.filter(p => !p.eliminated);

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
                setDraftStep("DRAFT");
                setShowDraftModal(true);
            };

            // 2. Клик по карте во время драфта
            const handleSelectCard = (cardId) => {
                const currentPlayerId = draftQueue[currentQueueIndex];
                const updatedAssignments = { ...draftAssignments, [cardId]: currentPlayerId };
                setDraftAssignments(updatedAssignments);

                const nextIndex = currentQueueIndex + 1;
                if (nextIndex >= draftQueue.length) {
                    setDraftStep('CONFIRM');
                } else {
                    setCurrentQueueIndex(nextIndex);
                }
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
                draftQueue, currentQueueIndex, draftStep, showDraftModal,
                strategyCardBonuses, isAgendaPhasePending,
            });

            // Разделяем useEffect для лучшей производительности и логики
            // Загрузить историю из облака
            const fetchGlobalStats = async () => {
                if (!isCloudConfigured) return [];
                try {
                    const { history } = await fetchCloudBin();
                    return history;
                } catch (e) {
                    console.error(e);
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
                if (!isCloudConfigured || !ADMIN_PIN) {
                    alert("Облачная статистика не настроена.");
                    return;
                }
                const pin = prompt("Введите ADMIN PIN для удаления:");
                if (pin !== ADMIN_PIN) {
                    alert("Неверный PIN!");
                    return;
                }
                try {
                    const { history, saves } = await fetchCloudBin();
                    const updated = history.filter(g => g.id !== gameId);
                    await putCloudBin({ history: updated, saves });
                    setGlobalHistory(updated);
                    alert("Партия удалена.");
                } catch (e) {
                    alert("Ошибка при удалении.");
                }
            };

            const clearAllStats = async () => {
                if (!isCloudConfigured || !ADMIN_PIN) {
                    alert("Облачная статистика не настроена.");
                    return;
                }
                const pin = prompt("Введите ADMIN PIN для сброса всей статистики:");
                if (pin !== ADMIN_PIN) {
                    alert("Неверный PIN!");
                    return;
                }
                if (!confirm("Вы уверены? Вся история будет удалена безвозвратно!")) return;
                try {
                    const { saves } = await fetchCloudBin();
                    await putCloudBin({ history: [], saves });
                    setGlobalHistory([]);
                    alert("Вся статистика очищена.");
                } catch (e) {
                    alert("Ошибка при очистке.");
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
                    const { history, saves } = await fetchCloudBin();
                    history.unshift(gameRecord);
                    await putCloudBin({ history, saves });
                    alert("Партия успешно сохранена в общую статистику! 🏆");
                } catch (e) {
                    alert("Ошибка при сохранении в облако.");
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
                setPlayers([...players, { id: newId, name: `Игрок ${players.length + 1}`, factionId: unassignedFaction.id, color: '', secrets: 0, extra: 0, breakthrough: false, totalTime: 0, damageDealt: 0, eliminated: false }]);
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
                const saveId = Math.random().toString(36).substring(2, 7); // Генерирует короткий ID (напр. "x7k9p")
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
                    turnOrder,
                    stage1Deck, // Добавляем колоды в сохранение
                    stage2Deck,
                    strategyCardBonuses,
                    speakerId, // Восстанавливаем спикера
                    isPoliticsActive,
                    isAgendaPhasePending,
                    activeTurnIdx,
                    passed,
                    turnTime,
                    timestamp: new Date().toLocaleString('ru-RU')
                };

                try {
                    const { history, saves } = await fetchCloudBin();
                    saves[saveId] = gameState;
                    await putCloudBin({ history, saves });

                    navigator.clipboard.writeText(saveId);
                    alert(`Партия сохранена! Код сохранения: ${saveId} (скопирован в буфер обмена)`);
                } catch (e) {
                    alert('Ошибка при сохранении в облако.');
                }
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
                    const { saves } = await fetchCloudBin();
                    const snap = saves[cleanId];

                    if (!snap) {
                        alert('Сохранение с таким кодом не найдено!');
                        return;
                    }

                    setTargetScore(snap.targetScore);
                    setRoundNumber(snap.roundNumber || 1);
                    setUsePok(!!snap.usePok);
                    setUseTe(!!snap.useTe);
                    setPlayers(snap.players || []);
                    setIsPoliticsActive(snap.isPoliticsActive || false);
                    setIsAgendaPhasePending(!!snap.isAgendaPhasePending);
                    setObjectives(snap.objectives || DEFAULT_OBJECTIVES);
                    setCompletions(snap.completions || {});
                    setRoundActive(!!snap.roundActive);
                    setDraftAssignments(snap.draftAssignments || {});
                    setDraftQueue(snap.draftQueue || []);
                    setCurrentQueueIndex(snap.currentQueueIndex || 0);
                    setStage1Deck(snap.stage1Deck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1))); // Восстанавливаем колоды
                    setStage2Deck(snap.stage2Deck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2)));
                    setStrategyCardBonuses(snap.strategyCardBonuses || {});
                    setTurnOrder(snap.turnOrder || []);
                    setSpeakerId(snap.speakerId || null);
                    setActiveTurnIdx(snap.activeTurnIdx || 0);
                    setPassed(snap.passed || {});
                    setTurnTime(snap.turnTime || 0);

                    setIsGameActive(true);
                    alert('Партия успешно загружена из облака!');
                } catch (e) {
                    alert('Ошибка при загрузке из облака.');
                }
            };

            const restoreSnapshot = (snap) => {
                if (!confirm(`Восстановить сохранение от ${snap.timestamp}? Текущий прогресс изменится.`)) return;

                setTargetScore(snap.targetScore);
                setRoundNumber(snap.roundNumber || 1);
                setPlayers(snap.players);
                setObjectives(snap.objectives || DEFAULT_OBJECTIVES);
                setIsPoliticsActive(snap.isPoliticsActive || false);
                setIsAgendaPhasePending(!!snap.isAgendaPhasePending);
                setCompletions(snap.completions || {});
                setRoundActive(!!snap.roundActive);
                setDraftAssignments(snap.draftAssignments || {});
                setDraftQueue(snap.draftQueue || []);
                setCurrentQueueIndex(snap.currentQueueIndex || 0);
                setStage1Deck(snap.stage1Deck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 1)));
                setStage2Deck(snap.stage2Deck || shuffleArray(BASE_OBJECTIVES.filter(obj => obj.stage === 2)));
                setStrategyCardBonuses(snap.strategyCardBonuses || {});
                setTurnOrder(snap.turnOrder || []);
                    setSpeakerId(snap.speakerId || (snap.players.length > 0 ? snap.players[0].id : null)); // Восстанавливаем спикера
                setActiveTurnIdx(snap.activeTurnIdx || 0);
                setPassed(snap.passed || {});
                setIsGameActive(true);
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

            const activePlayers = players.filter(p => !p.eliminated);
            const canStartRound = activePlayers.length > 0 && activePlayers.every(p => p.cards && p.cards.length > 0);

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
                                                disabled={roundActive}
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

                        {/* ПАНЕЛЬ АКТИВНОГО ХОДА */}
                        {isGameActive && turnOrder.length > 0 && activePlayer && !passed[activePlayer.id] && (
                            <div className="bg-slate-950 border-2 border-cyan-500/70 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                                <div className="flex items-center gap-4">
                                    {(() => {
                                        const fact = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);
                                        return (
                                            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center p-1 overflow-hidden shadow">
                                                <img src={fact?.iconUrl} alt={fact?.name} className="w-full h-full object-contain" />
                                            </div>
                                        );
                                    })()}
                                    <div>
                                        <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Сейчас ходит:</div>
                                        <div className="font-bold text-white text-xl md:text-2xl leading-none">{activePlayer.name}</div>
                                    </div>
                                </div>

                                {activeStrategyCard && (
                                    <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">Карта Стратегии:</div>
                                            <div className="font-orbitron font-extrabold text-sm md:text-base text-amber-300">{activeStrategyCard.name}</div>
                                        </div>
                                        <button
                                            onClick={playStrategyCard}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${isCurrentStrategyPlayed
                                                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                                                : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400 shadow'
                                                }`}>
                                            {isCurrentStrategyPlayed ? '✓ Сыграна' : 'Сыграть стратегию'}
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-5 bg-slate-900 px-5 py-2 rounded-xl border border-slate-800">
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Ход</div>
                                        <div className="font-orbitron font-black text-amber-400 text-lg md:text-xl">{formatTime(turnTime)}</div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-800"></div>
                                    <div className="text-center">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Всего</div>
                                        <div className="font-orbitron font-bold text-slate-300 text-base md:text-lg">{formatTime(activePlayer.totalTime || 0)}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button onClick={nextTurn} className="bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold px-5 py-3 rounded-xl text-sm md:text-base flex items-center gap-2 shadow-lg transition active:scale-95 font-orbitron uppercase">
                                        Завершить ход <i className="fa-solid fa-forward"></i>
                                    </button>
                                    <button
                                        onClick={() => passTurn(activePlayer.id)}
                                        disabled={!isCurrentStrategyPlayed}
                                        title={!isCurrentStrategyPlayed ? "Сначала сыграйте карту стратегии!" : ""}
                                        className={`font-bold px-4 py-3 rounded-xl text-sm border transition ${isCurrentStrategyPlayed
                                            ? 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800 cursor-pointer'
                                            : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
                                            }`}>
                                        Пас
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCombatOpponentId(null); // Сбрасываем оппонента при открытии
                                            setCombatRound(1); // Начинаем с 1-го раунда
                                            setTotalCombatDamage({ attacker: 0, defender: 0 }); // Сбрасываем общий урон
                                            setCombatHits({ attacker: 0, defender: 0 }); // Сбрасываем счетчики
                                            setShowCombatModal(true);
                                        }}
                                        className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-sm border border-red-800 transition flex items-center gap-1.5" title="Открыть окно боя">
                                        <i className="fa-solid fa-crosshairs"></i>
                                    </button>
                                </div>
                            </div>
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
                                openStrategyDraft={openStrategyDraft}
                                roundActive={roundActive}
                                handleStartRound={handleStartRound}
                                handleEndRound={handleEndRound}
                                activePlayer={activePlayer}
                                activeStrategyCard={activeStrategyCard}
                                isCurrentStrategyPlayed={isCurrentStrategyPlayed}
                                playStrategyCard={playStrategyCard}
                                nextTurn={nextTurn}
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
                                setShowObjectiveModal={setShowObjectiveModal}
                                setSelectedStage={setSelectedStage}
                                setShowCombatModal={setShowCombatModal}
                                roundNumber={roundNumber}
                                targetScore={targetScore}
                                canStartRound={canStartRound}
                                speakerId={speakerId}
                                handleAddSecret={handleAddSecret}
                                eliminatePlayer={eliminatePlayer}
                                isGameActive={isGameActive}
                                setObjectives={setObjectives}
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
                            strategyCardBonuses={strategyCardBonuses}
                            handleSelectCard={handleSelectCard}
                            handleReassignCard={handleReassignCard}
                            confirmDraft={confirmDraft}
                        />
                        {/* ВСПЛЫВАЮЩЕЕ ОКНО 4: ФАЗА ПОЛИТИКИ (ПЕРЕРАБОТАНО) */}
                        {showPoliticsModal && (
                            <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${minimizedModals.politics ? 'hidden' : ''}`}>
                                <div className="bg-slate-900 border border-purple-800 rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-500/10">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                                        <h2 className="font-orbitron text-lg font-bold text-purple-400 uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-gavel"></i> Фаза Политики
                                        </h2>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => toggleMinimize('politics')} className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-window-minimize text-base"></i>
                                            </button>
                                            <button onClick={() => setShowPoliticsModal(false)} className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-xmark text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>

                                    {/* ШАГ 1: НАЗНАЧЕНИЕ ГОЛОСОВ */}
                                    {politicsStep === 'SETUP' && (() => {
                                        const currentAgenda = agendas[currentAgendaIndex];
                                        const allVotedOnCurrentAgenda = activePlayers.length > 0 && activePlayers.every(p => !!currentAgenda.locked[p.id]);
                                        if (allVotedOnCurrentAgenda) return null;
                                        return (
                                        <div className="space-y-4">
                                            <p className="text-sm text-slate-400">Укажите количество голосов (влияния) для каждого игрока на всю фазу политики.</p>
                                            <div className="space-y-2">
                                                {activePlayers.map(p => (
                                                    <div key={p.id} className="p-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            {(() => {
                                                                const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                                                                return <img src={faction?.iconUrl} alt={faction?.name} className="w-8 h-8 object-contain" />;
                                                            })()}
                                                            <div className="font-bold text-white">{p.name}</div>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={p.influence || 0}
                                                            onChange={(e) => setPlayers(players.map(player => player.id === p.id ? { ...player, influence: parseInt(e.target.value) || 0 } : player))}
                                                            className="bg-slate-800 border border-slate-700 rounded-md w-20 text-center font-orbitron font-bold text-lg text-amber-400 focus:outline-none focus:border-amber-500"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                                <button onClick={() => setPoliticsStep('VOTE')} className="bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-extrabold py-2 px-6 rounded-xl text-sm transition uppercase">
                                                    Перейти к голосованию <i className="fa-solid fa-arrow-right"></i>
                                                </button>
                                            </div>
                                        </div>);
                                    })()}

                                    {/* ШАГ 2: ГОЛОСОВАНИЕ (ЗАКОНЫ) */}
                                    {politicsStep === 'VOTE' && (() => {
                                        const currentAgenda = agendas[currentAgendaIndex];
                                        const setAgendaType = (type) => {
                                            const newAgendas = agendas.map((agenda, index) => {
                                                if (index === currentAgendaIndex) {
                                                    // При выборе "Другой", инициализируем с одним пустым вариантом
                                                    return { ...agenda, type: type, customChoices: type === 'OTHER' ? [''] : undefined };
                                                }
                                                return agenda;
                                            });
                                            setAgendas(newAgendas);
                                        };
                                        const setAgendaVotes = (playerId, vote) => {
                                            const newAgendas = [...agendas];
                                            newAgendas[currentAgendaIndex].votes[playerId] = vote;
                                            setAgendas(newAgendas);
                                        };
                                        const lockVote = (playerId) => {
                                            const newAgendas = [...agendas];
                                            newAgendas[currentAgendaIndex].locked[playerId] = true;
                                            setAgendas(newAgendas);
                                        };
                                        const handleNextAgenda = () => {
                                            const nextIndex = currentAgendaIndex + 1;
                                            if (!agendas[nextIndex]) {
                                                const newAgendas = [...agendas, { type: null, votes: {}, locked: {}, customChoices: undefined }];
                                                setAgendas(newAgendas);
                                            }
                                            setCurrentAgendaIndex(nextIndex);
                                        };
                                        const handleSkipAgenda = () => {
                                            // Просто переходим к следующему закону, не помечая текущий как "проголосованный"
                                            // Он останется с type: null и не будет считаться в итоге
                                            handleNextAgenda();
                                        };
                                        const setCustomChoices = (newChoices) => {
                                            const newAgendas = agendas.map((agenda, index) => {
                                                if (index === currentAgendaIndex) {
                                                    return { ...agenda, customChoices: newChoices };
                                                }
                                                return agenda;
                                            });
                                            setAgendas(newAgendas);
                                        };

                                        const voteTotals = (() => {
                                            if (!currentAgenda || !currentAgenda.type) return {};
                                            const totals = {};
                                            // Правильный перебор голосов
                                            Object.entries(currentAgenda.votes).forEach(([playerId, vote]) => {
                                                if (
                                                    currentAgenda.locked[playerId] && // Учитываем только подтвержденные голоса
                                                    vote &&
                                                    vote.choice !== 'abstain' &&
                                                    vote.amount > 0
                                                ) {
                                                    totals[vote.choice] = (totals[vote.choice] || 0) + vote.amount;
                                                }
                                            });
                                            return totals;
                                        })();

                                        const winningChoice = (() => {
                                            if (Object.keys(voteTotals).length === 0) return null;
                                            const sortedVotes = Object.entries(voteTotals).sort((a, b) => b[1] - a[1]);
                                            // Проверяем на ничью: если есть больше одного варианта и голоса у первого и второго равны
                                            if (sortedVotes.length > 1 && sortedVotes[0][1] === sortedVotes[1][1] && sortedVotes[0][1] > 0) {
                                                return null; // Ничья, нет победителя
                                            }
                                            // Возвращаем ключ (choice) победившего варианта
                                            return sortedVotes[0][0];
                                        })();

                                        const allVotedOnCurrentAgenda = isAgendaFullyVoted(currentAgenda, activePlayers);

                                        const completedAgendasCount = agendas.filter((agenda) =>
                                            isAgendaFullyVoted(agenda, activePlayers)
                                        ).length;

                                        return (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <button onClick={() => setPoliticsStep('SETUP')} className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1"><i className="fa-solid fa-arrow-left"></i> Назад к голосам</button>
                                                <div className="font-orbitron font-bold text-lg text-amber-400">ЗАКОН №{currentAgendaIndex + 1}</div>
                                            </div>

                                            {/* Экран выбора типа повестки (пока не выбран) */}
                                            {!currentAgenda.type && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                                    <button onClick={() => setAgendaType('FOR_AGAINST')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-cyan-500">
                                                        <div className="text-3xl">👍 / 👎</div>
                                                        <div className="font-bold text-cyan-400">За / Против</div>
                                                    </button>
                                                    <button onClick={() => setAgendaType('PLAYER_CHOICE')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-amber-500">
                                                        <div className="text-3xl">👥</div>
                                                        <div className="font-bold text-amber-400">Выбор игрока</div>
                                                    </button>
                                                    <button onClick={() => setAgendaType('OTHER')} className="p-6 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-rose-500">
                                                        <div className="text-3xl">📝</div>
                                                        <div className="font-bold text-rose-400">Другой выбор</div>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Интерфейс голосования */}
                                            {currentAgenda.type && (<>
                                                {/* Блок подсчета голосов */}
                                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                                                    <h4 className="font-orbitron font-bold text-sm text-amber-400 uppercase mb-3">Итоги голосования</h4>
                                                    {Object.keys(voteTotals).length > 0 ? (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {Object.entries(voteTotals).sort((a, b) => b[1] - a[1]).map(([choice, total]) => {
                                                                let choiceName = choice;
                                                                const isWinner = choice === winningChoice;
                                                                if (currentAgenda.type === 'FOR_AGAINST') {
                                                                    choiceName = choice === 'for' ? 'ЗА' : 'ПРОТИВ';
                                                                } else if (currentAgenda.type === 'PLAYER_CHOICE') {
                                                                    choiceName = players.find(p => p.id == choice)?.name || 'Неизвестно';
                                                                } else if (currentAgenda.type === 'OTHER') {
                                                                    choiceName = currentAgenda.customChoices?.[choice] || `Вариант ${parseInt(choice)+1}`;
                                                                }
                                                                return (
                                                                    <div key={choice} className={`bg-slate-900 p-3 rounded-xl border text-center transition-all ${isWinner ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-slate-800/70'}`}>
                                                                        <div className="font-bold text-xs uppercase text-slate-400 truncate">{choiceName}</div>
                                                                        <div className="font-orbitron font-black text-3xl text-white mt-1">{total}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-sm text-slate-500 py-4">Голоса еще не отданы.</div>
                                                    )}
                                                </div>

                                                {/* Блок для ввода вариантов "Другой выбор" */}
                                                {currentAgenda.type === 'OTHER' && (
                                                    <div className="space-y-2 pt-4 border-t border-slate-800">
                                                        <h4 className="font-orbitron font-bold text-sm text-rose-400 uppercase mb-2">Варианты для голосования</h4>
                                                        {currentAgenda.customChoices?.map((choice, index) => (
                                                            <div key={index} className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-500 w-10 text-right">#{index + 1}</span>
                                                                <input
                                                                    type="text"
                                                                    value={choice}
                                                                    onChange={e => {
                                                                        const newChoices = [...currentAgenda.customChoices];
                                                                        newChoices[index] = e.target.value;
                                                                        setCustomChoices(newChoices);
                                                                    }}
                                                                    placeholder={`Введите вариант ${index + 1}`}
                                                                    className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-md font-bold text-sm text-white focus:outline-none focus:border-rose-400 flex-grow"
                                                                />
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => setCustomChoices([...(currentAgenda.customChoices || []), ''])}
                                                            className="w-full mt-2 py-2 bg-slate-800/50 hover:bg-slate-800 border border-dashed border-slate-700 rounded-lg text-slate-400 text-xs font-bold transition"
                                                        >
                                                            + Добавить вариант
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="space-y-3 pt-4 border-t border-slate-800">
                                                    {activePlayers.map(p => {
                                                        const vote = currentAgenda.votes[p.id] || { choice: 'abstain', amount: 0 };
                                                        const isLocked = !!currentAgenda.locked[p.id];
                                                        const votesSpentOnPrevAgendas = agendas.slice(0, currentAgendaIndex).reduce((acc, agenda) => {
                                                            const playerVote = agenda.votes[p.id];
                                                            // Суммируем только если голос был подтвержден (locked)
                                                            if (playerVote && agenda.locked[p.id]) {
                                                                return acc + (playerVote.amount || 0);
                                                            }
                                                            return acc;
                                                        }, 0);
                                                        const availableInfluence = (p.influence || 0) - votesSpentOnPrevAgendas;

                                                        return (
                                                            <div key={p.id} className={`p-4 bg-slate-950 border rounded-xl flex items-center justify-between gap-4 transition ${isLocked ? 'border-purple-700/50 opacity-60' : 'border-slate-800'}`}>
                                                                {/* Блок: Герб, Имя, Доступные голоса */}
                                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                                    {(() => {
                                                                        const faction = ALL_FACTIONS.find(f => f.id === p.factionId);
                                                                        return <img src={faction?.iconUrl} alt={faction?.name} className="w-9 h-9 object-contain" />;
                                                                    })()}
                                                                    <div className="font-bold text-lg text-white">{p.name}</div>
                                                                    <div className="text-center w-20">
                                                                        <div className="text-xs text-slate-400">Доступно</div>
                                                                        <div className="font-orbitron font-black text-3xl text-amber-400">{availableInfluence}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Блок голосования */}
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        value={vote.choice}
                                                                        onChange={e => setAgendaVotes(p.id, { ...vote, choice: e.target.value })}
                                                                        disabled={isLocked}
                                                                        className="bg-slate-800 border border-slate-700 rounded-md px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-400 w-32 disabled:opacity-50"
                                                                    >
                                                                        <option value="abstain">Воздержаться</option>
                                                                        {currentAgenda.type === 'FOR_AGAINST' && <>
                                                                            <option value="for">За</option>
                                                                            <option value="against">Против</option>
                                                                        </>}
                                                                        {currentAgenda.type === 'PLAYER_CHOICE' && activePlayers.map(target => (<option key={target.id} value={target.id}>{target.name}</option>))}
                                                                        {currentAgenda.type === 'OTHER' && currentAgenda.customChoices?.map((opt, idx) => (
                                                                            opt && <option key={idx} value={idx}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                    <input
                                                                        type="number"
                                                                        min="0" max={availableInfluence}
                                                                        value={vote.amount}
                                                                        onChange={e => {
                                                                            const newAmount = Math.max(0, Math.min(availableInfluence, parseInt(e.target.value) || 0));
                                                                            setAgendaVotes(p.id, { ...vote, amount: newAmount });
                                                                        }}
                                                                        disabled={isLocked || vote.choice === 'abstain'}
                                                                        className="bg-slate-800 border border-slate-700 rounded-md w-28 text-center font-orbitron font-black text-4xl text-cyan-400 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                                                                    />
                                                                    <button onClick={() => lockVote(p.id)} disabled={isLocked} className="px-4 py-2 bg-purple-800 hover:bg-purple-700 text-sm font-bold rounded-md disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed">
                                                                        {isLocked ? '✓' : 'OK'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>)}
                                            <div className="pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
                                                <button
                                                    onClick={() => setPoliticsStep('SPEAKER')}
                                                    disabled={completedAgendasCount < 2}
                                                    className="col-span-1 bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
                                                    title={completedAgendasCount < 2 ? "Нужно проголосовать минимум по 2 законам" : "Перейти к выбору Спикера"}
                                                >
                                                    Завершить голосование
                                                </button>
                                                <button onClick={handleSkipAgenda} className="col-span-1 bg-slate-700 hover:bg-slate-600 text-white font-orbitron font-bold py-3 rounded-xl text-sm transition uppercase">
                                                    Пропустить закон
                                                </button>
                                                <button onClick={handleNextAgenda} disabled={!allVotedOnCurrentAgenda} className="col-span-1 bg-purple-600 hover:bg-purple-500 text-white font-orbitron font-extrabold py-3 rounded-xl text-sm transition uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed">
                                                    Следующий закон <i className="fa-solid fa-arrow-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                    })()}

                                    {/* ШАГ 3: ВЫБОР СПИКЕРА */}
                                    {politicsStep === 'SPEAKER' && (() => {
                                        const currentSpeaker = activePlayers.find(p => p.id === speakerId);
                                        return (
                                            <div className="space-y-4">
                                                <h3 className="font-orbitron font-bold text-lg text-amber-400 text-center">Передача жетона Спикера</h3>
                                                <p className="text-sm text-slate-400 text-center">
                                                    Текущий Спикер (<span className="font-bold text-white">{currentSpeaker?.name || 'Неизвестно'}</span>) выбирает следующего Спикера.
                                                </p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                                    {activePlayers.map(player => {
                                                        const faction = ALL_FACTIONS.find(f => f.id === player.factionId);
                                                        return (
                                                            <button
                                                                key={player.id}
                                                                onClick={() => {
                                                                    setSpeakerId(player.id);
                                                                    setShowPoliticsModal(false);
                                                                    startNewRound();
                                                                }}
                                                                className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-purple-500"
                                                            >
                                                                <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                                                                <div className="font-bold text-purple-400">{player.name}</div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* ВСПЛЫВАЮЩЕЕ ОКНО 5: БОЙ */}
                        {showCombatModal && activePlayer && (
                            <div className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${minimizedModals.combat ? 'hidden' : ''}`}>
                                <div className="bg-slate-900 border border-red-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-red-500/10">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                                        <h2 className="font-orbitron text-lg font-bold text-red-400 uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-crosshairs"></i> Окно Сражения
                                        </h2>
                                        <div className="flex items-center gap-4">
                                            <button onClick={() => toggleMinimize('combat')} className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-window-minimize text-base"></i>
                                            </button>
                                            <button onClick={() => setShowCombatModal(false)} className="text-slate-500 hover:text-white transition">
                                                <i className="fa-solid fa-xmark text-lg"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>

                                    {!combatOpponentId ? (
                                        /* Шаг 1: Выбор оппонента */
                                        <div className="space-y-3">
                                            <h3 className="text-center font-bold text-slate-300">Выберите защищающегося игрока:</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {activePlayers.filter(p => p.id !== activePlayer.id).map(opponent => {
                                                    const faction = ALL_FACTIONS.find(f => f.id === opponent.factionId);
                                                    return (
                                                        <button key={opponent.id} onClick={() => setCombatOpponentId(opponent.id)} className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-red-500">
                                                            <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                                                            <div className="font-bold text-red-400">{opponent.name}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        /* Шаг 2: Счетчик попаданий */
                                        (() => {
                                            const opponent = players.find(p => p.id === combatOpponentId);
                                            const handleEndCombat = () => {
                                                // Добавляем урон из последнего раунда
                                                const finalAttackerDamage = totalCombatDamage.attacker + combatHits.attacker;
                                                const finalDefenderDamage = totalCombatDamage.defender + combatHits.defender;

                                                setPlayers(prevPlayers => prevPlayers.map(p => {
                                                    if (p.id === activePlayer.id) {
                                                        return { ...p, damageDealt: (p.damageDealt || 0) + finalAttackerDamage };
                                                    }
                                                    if (p.id === opponent.id) {
                                                        return { ...p, damageDealt: (p.damageDealt || 0) + finalDefenderDamage };
                                                    }
                                                    return p;
                                                }));

                                                setShowCombatModal(false);
                                            };

                                            const handleNextCombatRound = () => {
                                                setTotalCombatDamage(prev => ({
                                                    attacker: prev.attacker + combatHits.attacker,
                                                    defender: prev.defender + combatHits.defender
                                                }));
                                                setCombatHits({ attacker: 0, defender: 0 });
                                                setCombatRound(prev => prev + 1);
                                            };

                                            if (!opponent) return null;
                                            const attackerFaction = ALL_FACTIONS.find(f => f.id === activePlayer.factionId);
                                            const defenderFaction = ALL_FACTIONS.find(f => f.id === opponent.factionId);

                                            return (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="col-span-2 text-center">
                                                            <div className="text-sm text-slate-400">Раунд боя</div>
                                                            <div className="font-orbitron font-black text-3xl text-amber-400">{combatRound}</div>
                                                        </div>
                                                        {/* Атакующий */}
                                                        <div className="bg-slate-950 p-4 rounded-xl border border-cyan-700 text-center space-y-3">
                                                            <div className="text-xs font-bold text-cyan-400 uppercase">АТАКУЮЩИЙ</div>
                                                            <img src={attackerFaction?.iconUrl} alt={attackerFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                                                            <div className="font-bold text-lg text-white">{activePlayer.name}</div>
                                                            <div className="flex items-center justify-center gap-3">
                                                                <button onClick={() => setCombatHits(h => ({ ...h, attacker: Math.max(0, h.attacker - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">-</button>
                                                                <div className="font-orbitron font-black text-5xl text-cyan-400 w-24">{combatHits.attacker}</div>
                                                                <button onClick={() => setCombatHits(h => ({ ...h, attacker: h.attacker + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">+</button>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-400 uppercase">Попаданий</div>
                                                            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                                                                Всего урона в бою: 
                                                                <span className="font-bold text-base text-cyan-300 ml-1">{totalCombatDamage.attacker + combatHits.attacker}</span>
                                                            </div>
                                                        </div>

                                                        {/* Защищающийся */}
                                                        <div className="bg-slate-950 p-4 rounded-xl border border-red-700 text-center space-y-3">
                                                            <div className="text-xs font-bold text-red-400 uppercase">ЗАЩИЩАЮЩИЙСЯ</div>
                                                            <img src={defenderFaction?.iconUrl} alt={defenderFaction?.name} className="w-20 h-20 mx-auto object-contain" />
                                                            <div className="font-bold text-lg text-white">{opponent.name}</div>
                                                            <div className="flex items-center justify-center gap-3">
                                                                <button onClick={() => setCombatHits(h => ({ ...h, defender: Math.max(0, h.defender - 1) }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">-</button>
                                                                <div className="font-orbitron font-black text-5xl text-red-400 w-24">{combatHits.defender}</div>
                                                                <button onClick={() => setCombatHits(h => ({ ...h, defender: h.defender + 1 }))} className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-full text-2xl font-bold transition">+</button>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-400 uppercase">Попаданий</div>
                                                            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                                                                Всего урона в бою: 
                                                                <span className="font-bold text-base text-red-300 ml-1">{totalCombatDamage.defender + combatHits.defender}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-800">
                                                        <button
                                                            onClick={() => setCombatOpponentId(null)}
                                                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-3 rounded-xl text-xs transition"
                                                        >
                                                            <i className="fa-solid fa-users mr-1"></i> Сменить оппонента
                                                        </button>
                                                        <button
                                                            onClick={handleNextCombatRound}
                                                            className="bg-amber-600 hover:bg-amber-500 text-black font-orbitron font-bold px-5 py-3 rounded-xl text-sm transition"
                                                        >
                                                            Следующий раунд <i className="fa-solid fa-arrow-right ml-1"></i>
                                                        </button>
                                                        <button
                                                            onClick={handleEndCombat}
                                                            className="bg-red-950 hover:bg-red-900 text-red-300 font-bold px-4 py-3 rounded-xl text-xs transition border border-red-800"
                                                        >
                                                            <i className="fa-solid fa-flag-checkered mr-1"></i> Завершить бой
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                                </div>
                            </div>
                        )}
                        {/* ВСПЛЫВАЮЩЕЕ ОКНО 7: ВЫБОР СПИКЕРА (КАРТА ПОЛИТИКИ) */}
                        {showSpeakerSelectionModal && activePlayer && (
                            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <div className="bg-slate-900 border border-purple-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl shadow-purple-500/10">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                                        <h2 className="font-orbitron text-lg font-bold text-purple-400 uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-gavel"></i> Карта Политики: Выбор Спикера
                                        </h2>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="font-orbitron font-bold text-lg text-amber-400 text-center">Выберите следующего Спикера</h3>
                                        <p className="text-sm text-slate-400 text-center">
                                            Игрок <span className="font-bold text-white">{activePlayer.name}</span> выбирает следующего Спикера.
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                            {activePlayers.map(player => {
                                                const faction = ALL_FACTIONS.find(f => f.id === player.factionId);
                                                return (
                                                    <button
                                                        key={player.id}
                                                        onClick={() => {
                                                            setSpeakerId(player.id);
                                                            markStrategyAsPlayed();
                                                            setShowSpeakerSelectionModal(false);
                                                        }}
                                                        className="p-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-center space-y-2 transition hover:border-purple-500"
                                                    >
                                                        <img src={faction?.iconUrl} alt={faction?.name} className="w-16 h-16 mx-auto object-contain" />
                                                        <div className="font-bold text-purple-400">{player.name}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
