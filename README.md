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
2. Fill `JSONBIN_BIN_ID`, `JSONBIN_MASTER_KEY`, `ADMIN_PIN` (no `VITE_` prefix)
3. Or use `cloud.local.json`: `{ "binId", "masterKey", "adminPin" }`

Cloud buttons are on by default. Set `VITE_CLOUD_ENABLED=false` only if you want to hide them.

Vite serves `/api/*` via a local middleware that keeps secrets on the Node side.

## Cloudflare Worker deploy

- Build: `npm ci && npm run build`
- Deploy: `npx wrangler deploy` (or `npm run deploy`)
- Worker secrets (runtime — via `wrangler secret put` or Worker Bindings / Variables that the Worker can read):
  - `JSONBIN_BIN_ID`
  - `JSONBIN_MASTER_KEY`
  - `ADMIN_PIN`
- Remove old `VITE_JSONBIN_*` / `VITE_ADMIN_PIN` from **build** env — they must not appear in `dist/`
- Optional: `VITE_CLOUD_ENABLED=false` only if you want to hide cloud UI
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
| GET | `/api/health` | Diagnostics (`hasBinId`, etc.) |

## Security note

Older single-file HTML copies (`legacy.html`, `indexv*.html`) were removed from the repo because they contained hardcoded JSONBin keys. If those files were ever public, **rotate** your JSONBin master key and admin PIN.
