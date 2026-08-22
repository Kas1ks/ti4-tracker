# TI4 Tracker

React/Vite version of the TI4 Companion dashboard. Work on `refactor/vite-from-main`; `main` still has the single-file app.

## Start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

The old one-file app is saved as `legacy.html` (open it directly in a browser). Do not put JSONBin master keys in the frontend for production.

Copy `.env.example` to `.env.local` for local stats, or put the same `VITE_*` values in Cloudflare Pages environment variables (they are applied at build time).

## Cloudflare Workers (static assets)

- Build command: `npm ci && npm run build`
- Deploy command: `npm ci && npm run build && npx wrangler deploy --assets=./dist --compatibility-date=2024-12-01`
- Do not use `public/_redirects` with `/* /index.html 200` — Workers rejects it as an infinite loop. `index.html` is served at `/` automatically.
- Environment variables: `VITE_JSONBIN_BIN_ID`, `VITE_JSONBIN_MASTER_KEY`, `VITE_ADMIN_PIN`
