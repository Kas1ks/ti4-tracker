import { ALL_FACTIONS } from '../data/gameData';
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

  const addRandomObjective = async (stage) => {
    const deck = stage === 1 ? stage1Deck : stage2Deck;
    const nextObjective = deck.find(deckObj =>
      !objectives.some(activeObj => activeObj.id === deckObj.id),
    );
    if (!nextObjective) {
      await uiAlert(`Все цели ${stage} этапа уже открыты!`, {
        title: 'Колода пуста',
        variant: 'info',
      });
      return;
    }
    dispatch({ type: 'ADD_OBJECTIVE', objective: { ...nextObjective } });
  };

  const addCustomObjective = async () => {
    const result = await uiForm({
      title: 'Своя цель',
      message: 'Заполните название, описание и этап.',
      fields: [
        { name: 'title', label: 'Название', placeholder: 'Название цели' },
        { name: 'desc', label: 'Описание', defaultValue: 'Пользовательская цель' },
        {
          name: 'stage',
          label: 'Этап',
          type: 'select',
          defaultValue: '1',
          options: [
            { value: '1', label: 'Этап 1 (1 ПО)' },
            { value: '2', label: 'Этап 2 (2 ПО)' },
          ],
        },
      ],
      confirmLabel: 'Добавить',
    });
    if (!result) return;
    const title = (result.title || '').trim();
    if (!title) {
      await uiAlert('Нужно указать название цели.', { variant: 'danger', title: 'Пустое название' });
      return;
    }
    const stage = result.stage === '2' ? 2 : 1;
    dispatch({
      type: 'ADD_OBJECTIVE',
      objective: {
        id: `custom_${Date.now()}`,
        title,
        desc: result.desc ?? 'Пользовательская цель',
        stage,
        points: stage,
      },
    });
  };

  const handleAddSecret = async (playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.secrets >= 4) return;

    if (player.secrets === 3) {
      const confirmFourth = await uiConfirm(
        `У ${player.name} уже 3 секретные цели (стандартный лимит). Добавить 4-ю целевую секретку?`,
        { title: 'Лимит секреток', confirmLabel: 'Добавить 4-ю' },
      );
      if (!confirmFourth) return;
    }
    dispatch({ type: 'ADJUST_SECRETS', playerId, delta: 1 });
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
    availableFactions,
  };
}
