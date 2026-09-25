import { useRef, useState } from 'react';
import { isCloudConfigured } from '../config';
import { ALL_FACTIONS } from '../data/gameData';
import { stampGameState } from '../game/gameState';
import { rememberObjectiveIds } from '../game/objectiveHistory';
import {
  clearCloudStats,
  createCloudSave,
  deleteCloudGame,
  fetchCloudSave,
  fetchCloudStats,
  postGameRecord,
} from '../utils/cloud';
import { cloudErrorMessage } from '../utils/cloudErrors';

/** Stats, cloud saves and end-of-game upload — everything that talks to /api. */
export function useCloudGame({ game, dispatch, getPlayerScore, uiAlert, uiConfirm, uiPrompt }) {
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [globalHistory, setGlobalHistory] = useState([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;

  const openStatsModal = async () => {
    setShowStatsModal(true);
    setIsStatsLoading(true);
    try {
      setGlobalHistory(isCloudConfigured ? await fetchCloudStats() : []);
    } catch (err) {
      console.error(err);
      setGlobalHistory([]);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const deleteSingleGame = async (gameId) => {
    if (!isCloudConfigured) {
      await uiAlert('Облачная статистика не настроена.', { variant: 'danger', title: 'Облако' });
      return;
    }
    const pin = await uiPrompt('Введите ADMIN PIN для удаления:', {
      title: 'Удаление партии',
      inputType: 'password',
      variant: 'danger',
      confirmLabel: 'Удалить',
    });
    if (pin === null) return;
    try {
      const updated = await deleteCloudGame(gameId, pin);
      if (updated) setGlobalHistory(updated);
      await uiAlert('Партия удалена.', { variant: 'success', title: 'Готово' });
    } catch (err) {
      await uiAlert(cloudErrorMessage(err, 'Ошибка при удалении'), { variant: 'danger', title: 'Ошибка' });
    }
  };

  const clearAllStats = async () => {
    if (!isCloudConfigured) {
      await uiAlert('Облачная статистика не настроена.', { variant: 'danger', title: 'Облако' });
      return;
    }
    const pin = await uiPrompt('Введите ADMIN PIN для сброса всей статистики:', {
      title: 'Сброс статистики',
      inputType: 'password',
      variant: 'danger',
      confirmLabel: 'Продолжить',
    });
    if (pin === null) return;
    const confirmed = await uiConfirm('Вы уверены? Вся история будет удалена безвозвратно!', {
      title: 'Очистить всё?',
      confirmLabel: 'Удалить всё',
    });
    if (!confirmed) return;
    try {
      await clearCloudStats(pin);
      setGlobalHistory([]);
      await uiAlert('Вся статистика очищена.', { variant: 'success', title: 'Готово' });
    } catch (err) {
      await uiAlert(cloudErrorMessage(err, 'Ошибка при очистке'), { variant: 'danger', title: 'Ошибка' });
    }
  };

  const saveGameToCloud = async (winnerPlayer) => {
    const current = gameRef.current;
    const players = Array.isArray(current?.players) ? current.players : [];
    const meta = current?.meta || {};
    const targetScore = meta.targetScore;
    const roundNumber = meta.roundNumber || 0;

    rememberObjectiveIds((current?.objectives?.active || []).map(o => o.id));

    const gameRecord = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ru-RU'),
      targetScore,
      roundsCount: roundNumber,
      winner: winnerPlayer ? winnerPlayer.name : 'Ничья',
      winningFaction: winnerPlayer
        ? (ALL_FACTIONS.find(f => f.id === winnerPlayer.factionId)?.name || '')
        : '',
      expansions: {
        pok: !!meta.usePok,
        te: !!meta.useTe,
      },
      objectives: (current?.objectives?.active || []).map(o => ({
        id: o.id,
        title: o.title,
        stage: o.stage,
        points: o.points,
        scoredBy: players
          .filter(p => current?.objectives?.completions?.[`${p.id}_${o.id}`])
          .map(p => p.name),
      })),
      teController: (() => {
        if (!meta.useTe || !current?.expedition?.completed) return null;
        const ctrl = players.find(p => p.id === current.expedition.controllerId);
        if (!ctrl) return null;
        return {
          name: ctrl.name,
          faction: ALL_FACTIONS.find(f => f.id === ctrl.factionId)?.name || ctrl.factionId,
        };
      })(),
      custodians: (() => {
        const id = current?.vpTrack?.custodiansPlayerId;
        if (id == null) return null;
        const p = players.find(x => x.id === id);
        return p ? p.name : null;
      })(),
      supports: Object.entries(current?.vpTrack?.supportHolders || {}).map(([fromId, holderId]) => {
        const from = players.find(p => p.id === Number(fromId));
        const holder = players.find(p => p.id === Number(holderId));
        return {
          from: from?.name || String(fromId),
          holder: holder?.name || String(holderId),
        };
      }),
      players: players.map(p => ({
        name: p.name,
        damageDealt: p.damageDealt || 0,
        faction: ALL_FACTIONS.find(f => f.id === p.factionId)?.name || p.factionId,
        score: getPlayerScore(p.id),
        totalTime: p.totalTime || 0,
        avgTurnTime: roundNumber > 0 ? Math.round((p.totalTime || 0) / roundNumber) : 0,
        isWinner: winnerPlayer ? p.id === winnerPlayer.id : false,
        breakthrough: !!p.breakthrough,
      })),
    };

    localStorage.setItem('ti4_gameSummary', JSON.stringify(gameRecord));

    if (!isCloudConfigured) {
      await uiAlert('Партия сохранена только на этом устройстве. Облачная статистика не настроена.', {
        title: 'Локальное сохранение',
        variant: 'info',
      });
      return true;
    }

    try {
      await postGameRecord(gameRecord);
      await uiAlert('Партия успешно сохранена в общую статистику!', {
        title: 'Сохранено',
        variant: 'success',
      });
      return true;
    } catch (err) {
      // Local summary is already written — still allow exit so the host is not stuck.
      await uiAlert(
        `${cloudErrorMessage(err, 'Не удалось сохранить в облако')}\n\nИтоги партии сохранены на этом устройстве. Можно выйти.`,
        {
          title: 'Облако недоступно',
          variant: 'danger',
        },
      );
      return true;
    }
  };

  const exportGameToken = async () => {
    if (!isCloudConfigured) {
      await uiAlert('Облачное сохранение не настроено.', { variant: 'danger', title: 'Облако' });
      return;
    }
    try {
      const saveId = await createCloudSave(stampGameState(game));
      navigator.clipboard.writeText(saveId);
      await uiAlert(`Партия сохранена! Код сохранения: ${saveId} (скопирован в буфер обмена)`, {
        title: 'Код сохранения',
        variant: 'success',
      });
    } catch (err) {
      await uiAlert(cloudErrorMessage(err, 'Ошибка при сохранении в облако'), {
        title: 'Ошибка',
        variant: 'danger',
      });
    }
  };

  const importGameToken = async (saveId) => {
    if (!isCloudConfigured) {
      await uiAlert('Облачная загрузка не настроена.', { variant: 'danger', title: 'Облако' });
      return;
    }
    const cleanId = saveId ? saveId.trim() : '';
    if (!cleanId) {
      await uiAlert('Введите код партии!', { variant: 'danger', title: 'Пустой код' });
      return;
    }

    try {
      const snap = await fetchCloudSave(cleanId);
      dispatch({ type: 'LOAD_STATE', state: snap });
      await uiAlert('Партия успешно загружена из облака!', { variant: 'success', title: 'Загружено' });
    } catch (err) {
      await uiAlert(cloudErrorMessage(err, 'Ошибка при загрузке из облака'), {
        title: 'Ошибка',
        variant: 'danger',
      });
    }
  };

  return {
    showStatsModal,
    setShowStatsModal,
    globalHistory,
    isStatsLoading,
    openStatsModal,
    deleteSingleGame,
    clearAllStats,
    saveGameToCloud,
    exportGameToken,
    importGameToken,
  };
}
