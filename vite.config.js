import { existsSync, readFileSync, cpSync, createReadStream, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { Readable } from 'node:stream';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './worker/api.js';

const FIGURINES_DIR = resolve(process.cwd(), 'ti4_figurines_8_colors');
const FIGURINES_URL = '/figurines';

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function figurinesStaticPlugin() {
  return {
    name: 'ti4-figurines-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(`${FIGURINES_URL}/`)) {
          next();
          return;
        }
        try {
          const rel = decodeURIComponent(req.url.slice(FIGURINES_URL.length + 1).split('?')[0]);
          if (!rel || rel.includes('..')) {
            res.statusCode = 400;
            res.end('bad path');
            return;
          }
          const file = join(FIGURINES_DIR, rel);
          if (!existsSync(file) || !statSync(file).isFile()) {
            res.statusCode = 404;
            res.end('not found');
            return;
          }
          res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          createReadStream(file).pipe(res);
        } catch (err) {
          console.error('[figurines]', err);
          res.statusCode = 500;
          res.end('error');
        }
      });
    },
    closeBundle() {
      if (!existsSync(FIGURINES_DIR)) return;
      const out = resolve(process.cwd(), 'dist/figurines');
      cpSync(FIGURINES_DIR, out, { recursive: true });
    },
  };
}

function readCloudSecrets() {
  const file = resolve(process.cwd(), 'cloud.local.json');
  if (!existsSync(file)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return {
      JSONBIN_BIN_ID: parsed.binId || parsed.JSONBIN_BIN_ID || '',
      JSONBIN_MASTER_KEY: parsed.masterKey || parsed.JSONBIN_MASTER_KEY || '',
      ADMIN_PIN: parsed.adminPin || parsed.ADMIN_PIN || '',
    };
  } catch {
    return {};
  }
}

function resolveServerEnv(mode) {
  const env = loadEnv(mode, process.cwd(), '');
  const fileSecrets = readCloudSecrets();
  return {
    JSONBIN_BIN_ID:
      fileSecrets.JSONBIN_BIN_ID ||
      env.JSONBIN_BIN_ID ||
      env.VITE_JSONBIN_BIN_ID ||
      '',
    JSONBIN_MASTER_KEY:
      fileSecrets.JSONBIN_MASTER_KEY ||
      env.JSONBIN_MASTER_KEY ||
      env.VITE_JSONBIN_MASTER_KEY ||
      '',
    ADMIN_PIN: fileSecrets.ADMIN_PIN || env.ADMIN_PIN || env.VITE_ADMIN_PIN || '',
  };
}

function cloudApiPlugin(mode) {
  return {
    name: 'ti4-cloud-api',
    configureServer(server) {
      const env = resolveServerEnv(mode);
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          next();
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const rawBody = Buffer.concat(chunks);
          const host = req.headers.host || 'localhost';
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value == null) continue;
            if (Array.isArray(value)) headers.set(key, value.join(', '));
            else headers.set(key, value);
          }

          const abort = new AbortController();
          res.on('close', () => abort.abort());

          const request = new Request(`http://${host}${req.url}`, {
            method: req.method || 'GET',
            headers,
            body: rawBody.length > 0 ? rawBody : undefined,
            signal: abort.signal,
          });
          const response = await handleApi(request, env);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            // Node will set its own transfer encoding for streams
            if (key.toLowerCase() === 'content-length') return;
            res.setHeader(key, value);
          });

          if (!response.body) {
            res.end();
            return;
          }

          const nodeStream = Readable.fromWeb(response.body);
          nodeStream.pipe(res);
        } catch (err) {
          if (err?.name === 'AbortError') return;
          console.error('[ti4-cloud-api]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'dev-api-error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), cloudApiPlugin(mode), figurinesStaticPlugin()],
  server: {
    watch: {
      // Binary / locked image drops on Windows throw EBUSY and kill the server.
      ignored: [
        '**/ti4_figurines_8_colors/**',
        '**/public/expedition/**',
        '**/*.{png,webp,jpg,jpeg,gif,PNG,WEBP,JPG,JPEG,GIF}',
      ],
    },
  },
}));
