// Browser-only configuration. Do not put production secrets here.
// JSONBin master keys must be kept on a server-side API in production.
export const JSONBIN_BIN_ID = import.meta.env.VITE_JSONBIN_BIN_ID ?? '';
export const JSONBIN_MASTER_KEY = import.meta.env.VITE_JSONBIN_MASTER_KEY ?? '';
export const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '';
