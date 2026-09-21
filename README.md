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
2. Fill `JSONBIN_BIN_ID`, `JSONBIN_MASTER_KEY`, `ADMIN_PIN`, `ROOM_CREATE_SECRET` (no `VITE_` prefix)
3. Or use `cloud.local.json`: `{ "binId", "masterKey", "adminPin", "roomCreateSecret" }`

Cloud buttons are on by default. Set `VITE_CLOUD_ENABLED=false` only if you want to hide them.

Vite serves `/api/*` via a local middleware that keeps secrets on the Node side.

## Cloudflare Worker deploy

- Build: `npm ci && npm run build`
- Deploy: `npx wrangler deploy` (or `npm run deploy`)
- Worker secrets (runtime — via `wrangler secret put` or Worker Bindings / Variables that the Worker can read):
  - `JSONBIN_BIN_ID`
  - `JSONBIN_MASTER_KEY`
  - `ADMIN_PIN`
  - `ROOM_CREATE_SECRET` — required to **create** live rooms (join stays public)
- Remove old `VITE_JSONBIN_*` / `VITE_ADMIN_PIN` / `VITE_ROOM_CREATE_SECRET` from **build** env — they must not appear in `dist/`
- Optional: `VITE_CLOUD_ENABLED=false` only if you want to hide cloud UI
- Do not use `public/_redirects` with `/* /index.html 200` — Workers treats that as an infinite loop

### API

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Diagnostics (`rooms: memory \| durable-object`, bin / create-secret flags) |
| POST | `/api/rooms` | Create live room; body `{ state, createSecret }` → `{ roomId, hostKey, state, seq }` |
| POST | `/api/host-unlock` | Verify host secret (solo / local); body `{ createSecret }` → `{ ok: true }` |
| GET | `/api/rooms/:id/snapshot` | Current room state |
| POST | `/api/rooms/:id/actions` | Body `{ action }` — server applies the game reducer |
| GET | `/api/rooms/:id/events` | SSE stream of state updates |
| GET | `/api/stats` | Game history |
| POST | `/api/stats` | Append finished game record (alias: `POST /api/game`) |
| POST | `/api/game` | Append finished game → `{ ok: true }` |
| POST | `/api/saves` | Save in-progress game → `{ code }` |
| GET | `/api/saves/:code` | Load save |
| DELETE | `/api/stats/:id` | Body `{ "pin" }` |
| DELETE | `/api/stats` | Clear history; body `{ "pin" }` |

### Live rooms (Phase 6 MVP)

- **Solo** still works on one device via `localStorage`.
- **Create party** and **solo / load save** ask for `ROOM_CREATE_SECRET` (host only). Guests use **Join by code** — no secret.
- Game actions sync through the server reducer; `TICK` (turn timer) stays local.
- `npm run dev`: rooms are **in-memory** on the Vite process (two tabs work; restart clears rooms). Set `ROOM_CREATE_SECRET` in `.env.local` / `.dev.vars`.
- Production: one Cloudflare **Durable Object** per room (`GAME_ROOMS` in `wrangler.toml`). First deploy applies migration `v1-game-rooms`.
- Room TTL: each join/action refreshes `lastActivityAt` / `expiresAt` (**48h** idle). After host `RESET_GAME`, grace is **2h**, then the DO alarm wipes storage. Stale memory rooms are dropped on access in dev.

## Security note

Older single-file HTML copies (`legacy.html`, `indexv*.html`) were removed from the repo because they contained hardcoded JSONBin keys. If those files were ever public, **rotate** your JSONBin master key and admin PIN.
