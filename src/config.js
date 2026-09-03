// Cloud UI is on by default. Set VITE_CLOUD_ENABLED=false to hide cloud buttons.
// Secrets never live in the browser — /api/* is handled by Worker / Vite middleware.
export const isCloudConfigured = import.meta.env.VITE_CLOUD_ENABLED !== 'false';
