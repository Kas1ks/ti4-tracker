const cloud = typeof __TI4_CLOUD__ === 'object' && __TI4_CLOUD__ ? __TI4_CLOUD__ : {};

export const JSONBIN_BIN_ID = cloud.binId || import.meta.env.VITE_JSONBIN_BIN_ID || '';
export const JSONBIN_MASTER_KEY = cloud.masterKey || import.meta.env.VITE_JSONBIN_MASTER_KEY || '';
export const ADMIN_PIN = cloud.adminPin || import.meta.env.VITE_ADMIN_PIN || '';
export const isCloudConfigured = Boolean(JSONBIN_BIN_ID && JSONBIN_MASTER_KEY);
