import { useRef, useState } from 'react';
import { isCloudConfigured } from '../config';
import { stampGameState } from '../game/gameState';
import { rememberObjectiveIds } from '../game/objectiveHistory';
import { buildGameRecord, normalizeHistory } from '../analytics/gameRecord';
import {
  enqueuePendingStat,
  loadLocalGameSummary,
  loadPendingStats,
  mergeStatsHistory,
  pendingOnlyCount,
  prunePendingAgainstCloud,
  savePendingStats,
} from '../analytics/localStatsQueue';
import { getHostWriteToken, setHostWriteToken } from '../sync/hostWriteToken';
import { verifyHostSecret } from '../sync/roomApi';
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
  const [globalHistory, setGlobalHistory] = useState([]);
  const [pendingLocalCount, setPendingLocalCount] = useState(0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isPendingUploading, setIsPendingUploading] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;

  const ensureWriteToken = async () => {
    const cached = getHostWriteToken();
    if (cached) return cached;
    const createSecret = await uiPrompt('Введите код доступа хоста для записи в облако:', {
      title: 'Код доступа',
      inputType: 'password',
      placeholder: 'ROOM_CREATE_SECRET',
      confirmLabel: 'Продолжить',
      variant: 'info',
    });
    if (createSecret === null) return null;
    if (!String(createSecret).trim()) {
      await uiAlert('Код доступа не может быть пустым.', { title: 'Ошибка', variant: 'danger' });
      return null;
    }
    try {
      await verifyHostSecret(String(createSecret));
      setHostWriteToken(String(createSecret));
      return String(createSecret);
    } catch (err) {
      await uiAlert(cloudErrorMessage(err, 'Неверный код доступа'), {
        title: 'Ошибка',
        variant: 'danger',
      });
      return null;
    }
  };

  /** Load company history for the /stats page (cloud + local pending bridge). */
  const loadStatsHistory = async () => {
    setIsStatsLoading(true);
    try {
      let cloud = [];
      if (isCloudConfigured) {
        try {
          cloud = await fetchCloudStats();
        } catch (err) {
          console.error(err);
          cloud = [];
        }
      }
      const pending = prunePendingAgainstCloud(cloud);
      const summary = loadLocalGameSummary();
      const merged = mergeStatsHistory(cloud, pending, summary);
      setGlobalHistory(merged);
      setPendingLocalCount(pendingOnlyCount(cloud, pending));
    } catch (err) {
      console.error(err);
      const pending = loadPendingStats();
      const summary = loadLocalGameSummary();
      setGlobalHistory(mergeStatsHistory([], pending, summary));
      setPendingLocalCount(pending.length);
    } finally {
      setIsStatsLoading(false);
    }
  };

  /** Upload pending local game records into company cloud history. */
  const uploadPendingStats = async () => {
    if (!isCloudConfigured) {
      await uiAlert('Облачная статистика не настроена.', { variant: 'danger', title: 'Облако' });
      return;
    }
    const pending = loadPendingStats();
    if (!pending.length) {
      await uiAlert('Локальная очередь пуста.', { variant: 'info', title: 'Статистика' });
      return;
    }
    const token = await ensureWriteToken();
    if (!token) return;

    setIsPendingUploading(true);
    try {
      const remaining = [];
      let uploaded = 0;
      for (const record of pending) {
        try {
          await postGameRecord(record, { createSecret: token });
          uploaded += 1;
        } catch (err) {
          console.error(err);
          remaining.push(record);
        }
      }
      savePendingStats(remaining);
      await loadStatsHistory();
      if (remaining.length) {
        await uiAlert(
          `Загружено ${uploaded} из ${pending.length}. Остались в очереди: ${remaining.length}.`,
          { title: 'Частичная загрузка', variant: 'danger' },
        );
      } else {
        await uiAlert(`В облако загружено партий: ${uploaded}.`, {
          title: 'Готово',
          variant: 'success',
        });
      }
    } finally {
      setIsPendingUploading(false);
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
      if (updated) setGlobalHistory(normalizeHistory(updated));
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

    rememberObjectiveIds((current?.objectives?.active || []).map(o => o.id));

    const gameRecord = buildGameRecord(current, winnerPlayer, getPlayerScore);

    localStorage.setItem('ti4_gameSummary', JSON.stringify(gameRecord));

    if (!isCloudConfigured) {
      enqueuePendingStat(gameRecord);
      await uiAlert(
        'Партия сохранена на этом устройстве и попадёт в /stats локально. Облако не настроено.',
        {
          title: 'Локальное сохранение',
          variant: 'info',
        },
      );
      return true;
    }

    try {
      const token = await ensureWriteToken();
      if (!token) {
        enqueuePendingStat(gameRecord);
        await uiAlert(
          'Итоги сохранены локально (очередь для /stats). Облачная запись отменена — нет кода доступа.',
          { title: 'Локальное сохранение', variant: 'info' },
        );
        return true;
      }
      await postGameRecord(gameRecord, { createSecret: token });
      // Successful cloud write — keep pending clean if this id was queued earlier.
      prunePendingAgainstCloud([gameRecord]);
      await uiAlert('Партия успешно сохранена в общую статистику!', {
        title: 'Сохранено',
        variant: 'success',
      });
      return true;
    } catch (err) {
      // Local summary + pending queue — still allow exit so the host is not stuck.
      enqueuePendingStat(gameRecord);
      await uiAlert(
        `${cloudErrorMessage(err, 'Не удалось сохранить в облако')}\n\nИтоги сохранены на устройстве и ждут загрузки в /stats. Можно выйти.`,
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
      const token = await ensureWriteToken();
      if (!token) return;
      const saveId = await createCloudSave(stampGameState(game), { createSecret: token });
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
    globalHistory,
    pendingLocalCount,
    isStatsLoading,
    isPendingUploading,
    loadStatsHistory,
    uploadPendingStats,
    deleteSingleGame,
    clearAllStats,
    saveGameToCloud,
    exportGameToken,
    importGameToken,
  };
}
