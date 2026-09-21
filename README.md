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
| GET | `/api/health` | Diagnostics (`rooms: memory \| durable-object`, bin flags) |
| POST | `/api/rooms` | Create live room → `{ roomId, hostKey, state, seq }` |
| GET | `/api/rooms/:id/snapshot` | Current room state |
| POST | `/api/rooms/:id/actions` | Body `{ action }` — server applies the game reducer |
| GET | `/api/rooms/:id/events` | SSE stream of state updates |
| GET | `/api/stats` | Game history |
| POST | `/api/game` | Append finished game |
| POST | `/api/saves` | Save in-progress game → `{ code }` |
| GET | `/api/saves/:code` | Load save |
| DELETE | `/api/stats/:id` | Body `{ "pin" }` |
| DELETE | `/api/stats` | Clear history; body `{ "pin" }` |

### Live rooms (Phase 6 MVP)

- **Solo** still works on one device via `localStorage`.
- On the setup screen: **Создать комнату** → share the 6-character code; others **Войти**.
- Game actions sync through the server reducer; `TICK` (turn timer) stays local.
- `npm run dev`: rooms are **in-memory** on the Vite process (two tabs work; restart clears rooms).
- Production: one Cloudflare **Durable Object** per room (`GAME_ROOMS` in `wrangler.toml`). First deploy applies migration `v1-game-rooms`.
- Room TTL: each join/action refreshes `lastActivityAt` / `expiresAt` (**48h** idle). After host `RESET_GAME`, grace is **2h**, then the DO alarm wipes storage. Stale memory rooms are dropped on access in dev.

## Security note

Older single-file HTML copies (`legacy.html`, `indexv*.html`) were removed from the repo because they contained hardcoded JSONBin keys. If those files were ever public, **rotate** your JSONBin master key and admin PIN.
