export function cloudErrorMessage(err, fallback) {
  const apiError = err?.data?.error || err?.message;
  if (apiError === 'not-configured' || err?.status === 503) {
    return 'Облако на сервере не настроено. В Cloudflare Worker Secrets нужны JSONBIN_BIN_ID / JSONBIN_MASTER_KEY / ADMIN_PIN / ROOM_CREATE_SECRET (без префикса VITE_ в production).';
  }
  if (apiError === 'forbidden' || apiError === 'write-token-required' || err?.status === 403) {
    return 'Нужен код доступа хоста (ROOM_CREATE_SECRET), чтобы сохранить статистику или сейв.';
  }
  if (apiError === 'rate-limited' || err?.status === 429) {
    return 'Слишком много попыток. Подождите минуту и повторите.';
  }
  if (err?.status === 401) return 'Неверный PIN!';
  if (err?.status === 404) {
    // Save-code load uses this status; other 404s are routing / missing endpoints.
    if (typeof fallback === 'string' && /загруз/i.test(fallback)) {
      return 'Сохранение с таким кодом не найдено!';
    }
    const where = err?.data?.pathname || err?.url || '';
    const suffix = where ? ` (${where})` : '';
    return `${fallback} (404${suffix}). Сделайте npm run deploy и обновите страницу без кэша.`;
  }
  if (err?.status === 502 || apiError === 'upstream-error' || apiError === 'html-fallback') {
    return 'Сервер не смог сохранить данные в облако. Проверьте деплой Worker и секреты JSONBIN_BIN_ID / JSONBIN_MASTER_KEY.';
  }
  return `${fallback} (код ${err?.status || '?'}).`;
}
