export function cloudErrorMessage(err, fallback) {
  if (err?.data?.error === 'not-configured' || err?.status === 503) {
    return 'Облако на сервере не настроено. В Cloudflare Worker Secrets нужны JSONBIN_BIN_ID / JSONBIN_MASTER_KEY / ADMIN_PIN (или те же имена с префиксом VITE_).';
  }
  if (err?.status === 401) return 'Неверный PIN!';
  if (err?.status === 404) return 'Сохранение с таким кодом не найдено!';
  if (err?.status === 502) return 'Сервер не смог связаться с JSONBin. Проверьте ключи Worker Secrets.';
  return `${fallback} (код ${err?.status || '?'}).`;
}
