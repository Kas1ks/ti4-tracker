import { ALL_FACTIONS } from '../data/gameData';
import { overflowForPlayer } from '../game/secretDeck';
import * as select from '../game/selectors';

/**
 * Handlers that ask the user something before they reach the reducer.
 * Pure dispatches stay in App / components; only dialog-gated flows live here.
 */
export function useGameDialogs({ game, dispatch, uiAlert, uiConfirm, uiForm, onNeedSpeakerPick }) {
  const { players } = game;
  const { speakerId } = game.meta;
  const { active: objectives, stage1Deck, stage2Deck } = game.objectives;
  const availableFactions = select.availableFactions(game, ALL_FACTIONS);
  const activePlayer = select.activePlayer(game);
  const isCurrentStrategyPlayed = select.isActiveStrategyPlayed(game);

  const handleStartGame = async () => {
    if (players.length < 2) {
      await uiAlert('Для начала игры нужно добавить минимум 2 игроков!', {
        title: 'Недостаточно игроков',
        variant: 'danger',
      });
      return;
    }
    const uncoloredPlayer = players.find(p => !p.color);
    if (uncoloredPlayer) {
      await uiAlert(`Игрок "${uncoloredPlayer.name}" не выбрал цвет! Выберите цвет для всех игроков.`, {
        title: 'Цвет обязателен',
        variant: 'danger',
      });
      return;
    }
    dispatch({ type: 'START_GAME' });
  };

  const removeObjective = async (objectiveId) => {
    const obj = objectives.find(o => o.id === objectiveId);
    if (!obj) return;

    const stage = Number(obj.stage) === 2 ? 2 : 1;
    const deck = stage === 2 ? stage2Deck : stage1Deck;
    const activeIds = new Set(objectives.map(o => o.id));
    const hasReplacement = deck.some(
      d => d.id !== objectiveId && !activeIds.has(d.id),
    );

    const label = obj.desc || obj.title || obj.id;
    const confirmed = await uiConfirm(
      hasReplacement
        ? `Убрать цель «${label}» с поля? Она исчезнет из колоды, вместо неё откроется следующая цель этапа ${stage}.`
        : `Убрать цель «${label}» с поля? Она исчезнет из колоды; неоткрытых целей этого этапа больше нет.`,
      { title: 'Удалить цель?', confirmLabel: 'Убрать', variant: 'danger' },
    );
    if (!confirmed) return;

    dispatch({ type: 'DISCARD_OBJECTIVE', objectiveId });
  };

  const officialCountForStage = (stage) => objectives.filter((o) => {
    if (o?.extra) return false;
    const isII = Number(o.stage) === 2;
    return stage === 2 ? isII : !isII;
  }).length;

  const remainingDeckForStage = (stage) => {
    const deck = stage === 2 ? stage2Deck : stage1Deck;
    const activeIds = new Set(objectives.map((o) => o.id));
    return (deck || []).filter((o) => !activeIds.has(o.id));
  };

  const secretsDealStarted = !!game.secretObjectives?.dealStarted;

  const addRandomObjective = async (stage) => {
    if (!secretsDealStarted) {
      await uiAlert('Сначала запустите раздачу секретных целей.', {
        title: 'Публичные цели закрыты',
        variant: 'info',
      });
      return;
    }
    if (officialCountForStage(stage) >= 5) {
      await uiAlert(
        `Уже открыто 5 целей этапа ${stage}. 6-ю можно добавить только через «Ввести цель вручную».`,
        { title: 'Лимит этапа', variant: 'info' },
      );
      return;
    }
    const nextObjective = remainingDeckForStage(stage)[0];
    if (!nextObjective) {
      await uiAlert(`Все цели ${stage} этапа уже открыты!`, {
        title: 'Колода пуста',
        variant: 'info',
      });
      return;
    }
    dispatch({ type: 'ADD_OBJECTIVE', objective: { ...nextObjective } });
  };

  const addCustomObjective = async (stageArg) => {
    if (!secretsDealStarted) {
      await uiAlert('Сначала запустите раздачу секретных целей.', {
        title: 'Публичные цели закрыты',
        variant: 'info',
      });
      return;
    }
    const stage = Number(stageArg) === 2 ? 2 : 1;
    const asExtra = officialCountForStage(stage) >= 5;
    const remaining = remainingDeckForStage(stage);

    const sourcePick = await uiForm({
      title: asExtra ? `Доп. цель этапа ${stage}` : `Добавить цель этапа ${stage}`,
      message: asExtra
        ? '6-я и далее — только вручную для учёта. Авто-раскрытие в статусе их не считает.'
        : 'Выберите источник цели.',
      fields: [
        {
          name: 'source',
          label: 'Откуда',
          type: 'select',
          defaultValue: remaining.length ? 'deck' : 'manual',
          options: [
            ...(remaining.length
              ? [{ value: 'deck', label: `Из колоды (${remaining.length})` }]
              : []),
            { value: 'manual', label: 'Ввести вручную' },
          ],
        },
      ],
      confirmLabel: 'Далее',
    });
    if (!sourcePick) return;

    if (sourcePick.source === 'deck') {
      if (!remaining.length) {
        await uiAlert('В колоде этого этапа не осталось карт.', {
          title: 'Колода пуста',
          variant: 'info',
        });
        return;
      }
      const chosen = remaining[Math.floor(Math.random() * remaining.length)];
      dispatch({
        type: 'ADD_OBJECTIVE',
        objective: { ...chosen, ...(asExtra ? { extra: true } : {}) },
      });
      return;
    }

    const result = await uiForm({
      title: asExtra ? `Своя доп. цель · этап ${stage}` : `Своя цель · этап ${stage}`,
      message: 'Заполните название и описание.',
      fields: [
        { name: 'title', label: 'Название', placeholder: 'Название цели' },
        { name: 'desc', label: 'Описание', defaultValue: 'Пользовательская цель' },
      ],
      confirmLabel: 'Добавить',
    });
    if (!result) return;
    const title = (result.title || '').trim();
    if (!title) {
      await uiAlert('Нужно указать название цели.', { variant: 'danger', title: 'Пустое название' });
      return;
    }
    dispatch({
      type: 'ADD_OBJECTIVE',
      objective: {
        id: `custom_${Date.now()}`,
        title,
        desc: result.desc ?? 'Пользовательская цель',
        stage,
        points: stage,
        ...(asExtra ? { extra: true } : {}),
      },
    });
  };

  const handleAddSecret = async (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    if (!game.secretObjectives?.dealStarted || game.secretObjectives?.draftPending) {
      await uiAlert('Сначала завершите раздачу секретных целей.', {
        title: 'Секретки',
        variant: 'info',
      });
      return;
    }
    if (overflowForPlayer(game.secretObjectives, playerId)) {
      await uiAlert(
        `У ${player.name} перебор секреток — сначала сбросьте карту до лимита.`,
        { title: 'Секретки', variant: 'info' },
      );
      return;
    }
    dispatch({ type: 'DRAW_SECRET', playerId });
  };

  const passTurn = async (playerId) => {
    if (!isCurrentStrategyPlayed) {
      await uiAlert('Нельзя пасовать, пока вы не сыграли все свои карты стратегии!', {
        title: 'Сначала стратегия',
        variant: 'danger',
      });
      return;
    }
    dispatch({ type: 'PASS_TURN', playerId });
  };

  const eliminatePlayer = async (playerId) => {
    const playerToEliminate = players.find(p => p.id === playerId);
    if (!playerToEliminate) return;

    const confirmed = await uiConfirm(
      `Вы уверены, что хотите устранить игрока "${playerToEliminate.name}"? Это действие необратимо в рамках текущей партии.`,
      { title: 'Устранить игрока?', confirmLabel: 'Устранить' },
    );
    if (!confirmed) return;

    const newSpeakerId = speakerId === playerId
      ? select.nextSpeakerAfter(game, playerId)
      : null;

    dispatch({ type: 'ELIMINATE_PLAYER', playerId });

    const newSpeaker = players.find(p => p.id === newSpeakerId);
    if (newSpeaker) {
      await uiAlert(
        `Игрок ${playerToEliminate.name} был спикером. Новым спикером становится ${newSpeaker.name}.`,
        { title: 'Новый спикер', variant: 'info' },
      );
    }
  };

  const playStrategyCard = (cardId) => {
    if (!activePlayer) return;
    if (cardId === 3) {
      onNeedSpeakerPick();
      return;
    }
    dispatch({ type: 'PLAY_STRATEGY', cardId });
  };

  const addPlayer = () => {
    const freeFaction = availableFactions.find(f => !players.some(p => p.factionId === f.id))
      || availableFactions[0];
    dispatch({ type: 'ADD_PLAYER', playerId: Date.now(), factionId: freeFaction.id });
  };

  /** Grow/shrink the seat list to an exact count (3–8). */
  const ensurePlayerCount = (count) => {
    const n = Math.max(3, Math.min(8, Number(count) || 3));
    if (players.length > n) {
      players.slice(n).forEach((p) => dispatch({ type: 'REMOVE_PLAYER', playerId: p.id }));
      return;
    }
    const taken = new Set(players.map((p) => p.factionId));
    const need = n - players.length;
    for (let i = 0; i < need; i += 1) {
      const free = availableFactions.find((f) => !taken.has(f.id)) || availableFactions[0];
      if (!free) break;
      taken.add(free.id);
      dispatch({
        type: 'ADD_PLAYER',
        playerId: Date.now() + i + Math.floor(Math.random() * 1000),
        factionId: free.id,
      });
    }
  };

  return {
    handleStartGame,
    removeObjective,
    addRandomObjective,
    addCustomObjective,
    handleAddSecret,
    passTurn,
    eliminatePlayer,
    playStrategyCard,
    addPlayer,
    ensurePlayerCount,
    availableFactions,
  };
}
