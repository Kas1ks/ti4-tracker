export function cloudErrorMessage(err, fallback) {
  const apiError = err?.data?.error || err?.message;
  if (apiError === 'not-configured' || err?.status === 503) {
    return 'Облако на сервере не настроено. В Cloudflare Worker Secrets нужны JSONBIN_BIN_ID / JSONBIN_MASTER_KEY / ADMIN_PIN (или те же имена с префиксом VITE_).';
  }
  if (err?.status === 401) return 'Неверный PIN!';
  if (err?.status === 404) {
    // Save-code load uses this status; other 404s are routing / missing endpoints.
    if (typeof fallback === 'string' && /загруз/i.test(fallback)) {
      return 'Сохранение с таким кодом не найдено!';
    }
    return `${fallback} (404 — проверьте деплой Worker и секрет JSONBin).`;
  }
  if (err?.status === 502 || apiError === 'upstream-error' || apiError === 'html-fallback') {
    return 'Сервер не смог сохранить данные в облако. Проверьте деплой Worker и секреты JSONBIN_BIN_ID / JSONBIN_MASTER_KEY.';
  }
  return `${fallback} (код ${err?.status || '?'}).`;
}
