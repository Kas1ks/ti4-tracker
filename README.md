# TI4 Tracker

React/Vite TI4 Companion dashboard. Cloud stats/saves go through a Cloudflare Worker so JSONBin keys never ship in the browser bundle.

## Start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

### Local cloud (optional)

1. Copy `.env.example` → `.env.local`
2. Set `VITE_CLOUD_ENABLED=true`
3. Fill `JSONBIN_BIN_ID`, `JSONBIN_MASTER_KEY`, `ADMIN_PIN` (no `VITE_` prefix)
4. Or use `cloud.local.json`: `{ "binId", "masterKey", "adminPin" }`

Vite serves `/api/*` via a local middleware that keeps secrets on the Node side.

The old one-file app is saved as `legacy.html`.

## Cloudflare Worker deploy

- Build: `npm ci && npm run build`
- Deploy: `npx wrangler deploy` (or `npm run deploy`)
- Worker secrets (Dashboard → Workers → Settings → Variables / Secrets):
  - `JSONBIN_BIN_ID`
  - `JSONBIN_MASTER_KEY`
  - `ADMIN_PIN`
- Build-time client flag only: `VITE_CLOUD_ENABLED=true` (not a secret)
- Remove old `VITE_JSONBIN_*` / `VITE_ADMIN_PIN` from build env — they must not appear in `dist/`
- Do not use `public/_redirects` with `/* /index.html 200` — Workers treats that as an infinite loop

### API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/stats` | Game history |
| POST | `/api/games` | Append finished game |
| POST | `/api/saves` | Save in-progress game → `{ code }` |
| GET | `/api/saves/:code` | Load save |
| DELETE | `/api/stats/:id` | Body `{ "pin" }` |
| DELETE | `/api/stats` | Clear history; body `{ "pin" }` |
