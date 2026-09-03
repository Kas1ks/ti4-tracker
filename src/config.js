// Cloud secrets live on the Worker / Vite middleware — never in the browser bundle.
export const isCloudConfigured = import.meta.env.VITE_CLOUD_ENABLED === 'true';
