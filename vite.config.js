import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function readCloudSecrets() {
  const file = resolve(process.cwd(), 'cloud.local.json');
  if (!existsSync(file)) {
    return { binId: '', masterKey: '', adminPin: '' };
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return {
      binId: parsed.binId || '',
      masterKey: parsed.masterKey || '',
      adminPin: parsed.adminPin || '',
    };
  } catch {
    return { binId: '', masterKey: '', adminPin: '' };
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const fileSecrets = readCloudSecrets();

  return {
    plugins: [react()],
    define: {
      __TI4_CLOUD__: JSON.stringify({
        binId: fileSecrets.binId || env.VITE_JSONBIN_BIN_ID || process.env.VITE_JSONBIN_BIN_ID || '',
        masterKey: fileSecrets.masterKey || env.VITE_JSONBIN_MASTER_KEY || process.env.VITE_JSONBIN_MASTER_KEY || '',
        adminPin: fileSecrets.adminPin || env.VITE_ADMIN_PIN || process.env.VITE_ADMIN_PIN || '',
      }),
    },
  };
});
