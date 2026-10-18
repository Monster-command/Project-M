# Project M

An AI-native Indian stock market intelligence platform powered by **NSE's official MCP servers** — with **live data** when you host it yourself.

- **Dashboard** — market status, NIFTY 50 / BANK / IT / FINANCIAL SERVICES / MIDCAP 100 cards with sparklines, top gainers/losers, most active, market breadth
- **Markets** — explorer with Gainers / Losers / Volume / 52W Highs / 52W Lows / Returns tabs, search + sort
- **Stocks** — symbol search + detailed stock pages: live quote, candlestick chart (1M–5Y) with volume, 52-week position, corporate-action warnings
- **Compare** — 2–5 symbols, base-100 normalized chart, returns, drawdowns
- **AI Analyst** — natural-language questions answered *only* from retrieved NSE data, with an expandable "View data sources" panel and an execution timeline
- **Quant Lab** — screen builder (return / volume / 52-week conditions) with saveable screens
- **Watchlist** — multiple lists, add/remove/reorder (localStorage)
- **Cmd/Ctrl+K** command palette, dark-first UI with light-mode toggle

## Data sources (all server-side — never exposed to the browser)

| Server | URL | What it serves |
|---|---|---|
| Cash-market (live) | `https://mcp.nseindia.in/cmmkt/mcp` | Live quotes, indices, gainers/losers, market movers |
| Bhavcopy (history) | `https://mcp.nseindia.in/bhavcopy/cm/mcp` | Daily OHLCV up to 5 years, breadth, comparisons, corporate actions, symbol search |

Both endpoints were verified reachable on **2026-10-18**, but NSE's bot protection has blocked them intermittently in the past — the MCP client has timeouts, one auto re-handshake on session expiry, and every API route returns honest errors (`"NSE market data could not be retrieved right now."`) instead of fake data. Bhavcopy prices are **unadjusted**; the app checks corporate actions before presenting historical returns.

## Quick start

```bash
npm install
cp .env.example .env   # optional: add LLM_API_KEY for AI prose polish
npm run dev            # http://localhost:3000
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `NSE_CM_MCP_URL` | `https://mcp.nseindia.in/cmmkt/mcp` | Live cash-market MCP server |
| `NSE_BHAVCOPY_MCP_URL` | `https://mcp.nseindia.in/bhavcopy/cm/mcp` | Historical bhavcopy MCP server |
| `LLM_API_KEY` | *(unset)* | Optional OpenAI-compatible key — AI Analyst uses it only to polish prose from retrieved data; templated grounded answers work without it |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `gpt-4o-mini` | Model for prose polish |
| `PORT` | `3000` | Server port |

## Deploy

### Vercel
```bash
npm i -g vercel
vercel            # follow prompts; add env vars in the dashboard if needed
vercel --prod
```
No special config needed — it's a standard Next.js app. Set `LLM_API_KEY` in Vercel's env UI if you want AI prose.

### Railway / Render
- **Railway:** `railway init` → `railway up` (Nixpacks auto-detects Next.js), or connect the repo in the dashboard. Add env vars in the service settings.
- **Render:** New → Web Service → connect repo → Build: `npm install && npm run build`, Start: `npm start`. Add env vars in the dashboard.

### Plain Docker VPS
```bash
cp .env.example .env   # edit as needed
docker compose up -d --build
# → http://<your-server>:3000
```

## API surface (all JSON, all NSE-grounded)

`GET /api/indices` · `GET /api/movers?limit=` · `GET /api/quote?symbol=` · `GET /api/history?symbol=&months=` · `GET /api/index-history?name=&months=` · `GET /api/breadth?date=` · `GET /api/52w?symbol=` · `GET /api/search?q=` · `GET /api/bulk?symbols=` · `GET /api/universe-returns?months=` · `POST /api/compare` · `POST /api/screen` · `POST /api/ask`

Every response carries `asOf`, `stale`, and `marketOpen`. Live data only flows 09:15–15:30 IST, Mon–Fri; outside hours the UI labels figures as the last close.

## Public vs private note

This codebase is the way to get a **public, live** Project M: host it yourself and it calls NSE's MCP servers from your server at request time. (Muse's own hosted-app runtime can't do public + live-backend in one artifact — hence this repo.)

## Disclaimer

Data is for **educational and research purposes only** — not investment advice. Consult a SEBI-registered investment adviser before investing. Past performance is not indicative of future results.
