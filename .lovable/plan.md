# CDC Wave 3 Analyzer — Build Plan

A trading signal dashboard styled like kudhoon.lovable.app, following the spec in your uploaded `step7-lovable-prompt.md`.

## Scope
- Web app (React + TypeScript + Tailwind + shadcn/ui + Recharts)
- Dark theme with exact color tokens from the spec (#0d1117 bg, #161b22 cards, #3fb950 buy, #f85149 sell, etc.)
- Two pages: Dashboard (signal cards) + Signal Detail
- Settings page for Railway API URL + watchlist
- CDC + Wave calculation utilities run client-side
- Ships with mock data so the UI works immediately; switches to the real Railway API once a URL is saved in Settings

## Pages & components

**Dashboard (`/`)**
- Header: logo "CDC Wave 3", search input, settings icon
- Filter tabs: All / Buy / Sell / Up / W1 / W2 / W3 / Fav with live counts
- Responsive signal card grid (3 col desktop, 1 col mobile)
- Card: ticker, price, badges (Up/W3/date), mini EMA sparkline, Wave Phase progress bar (orange), Total Signal Gain, last 3 trades, View Details button
- Color-coded left border per action (green BUY, red SELL, gray WATCH)

**Signal Detail (`/signal/:ticker`)**
- Header with back, ticker, company, price, market/trend badges, action chip, refresh
- Recharts LineChart "EMA Chart (Wave Zoom: N days)" with Price (solid white), EMA12 (blue dashed), EMA26 (orange dashed), Wave Pattern EMA55 (orange dashed), and scatter dots (Buy green / Near Buy cyan / Sell red / Wave3 orange)
- Custom dark tooltip + legend
- 6-card Stats Bar: Status, Sig Gain, Net Profit, MDD, Trades, Win Rate
- Chronos-Bolt Confirmation section (two columns: direction/vol/lot/agree + P10/P50/P90/upside/downside), warning banner when `cdc_agree=false`
- Full Trade History table with lot 1/3..3/3, status badges, colored gains

**Settings (`/settings`)**
- Railway BASE_URL input (persists to localStorage)
- Watchlist editor (add/remove tickers, default: AAPL,MSFT,NVDA,GOOGL,TSLA,META,AMZN,SPY,QQQ,AMD)
- Theme indicator (dark only for now)

## Technical layout

```text
src/
  pages/
    Dashboard.tsx
    SignalDetail.tsx
    Settings.tsx
  components/
    SignalCard.tsx
    FilterTabs.tsx
    EmaChart.tsx
    StatsBar.tsx
    ChronosPanel.tsx
    TradeHistoryTable.tsx
    WavePhaseBar.tsx
  utils/
    cdc.ts           // calcEMA, getCDCZone, detectWaveStages,
                     // calcSignalDots, calcStats, calcWavePhase
    api.ts           // fetch /signals, /signal/:ticker with BASE_URL fallback to mock
    mockData.ts      // realistic sample signals for 10 tickers
  types/signal.ts    // Signal, Trade types from spec
  hooks/
    useSignals.ts
    useFavorites.ts  // localStorage Set<string>
    useSettings.ts   // BASE_URL + watchlist
  index.css          // design tokens as HSL CSS vars
```

- Routing: react-router (BrowserRouter)
- Data fetching: TanStack Query
- All colors registered as semantic tokens in `index.css` + `tailwind.config.ts` (no hardcoded hex in components)
- Charts via Recharts; dotted lines via `strokeDasharray` exactly as specified

## Data flow
1. App mounts → read BASE_URL from localStorage; if empty, use mock data
2. `GET /signals?tickers=...&filter=all` → enrich with `calcEMA` + `detectWaveStages` + `calcSignalDots` client-side
3. Dashboard renders cards; filter tabs filter in-memory
4. Click card → navigate to `/signal/:ticker` → `GET /signal/:ticker` for fresh detail → render chart + stats + Chronos + history

## Out of scope (for now)
- Real Railway backend (UI ships with mock data + a URL input; you plug in your deployed Railway URL later)
- Authentication, light theme, mobile-only nav drawer
- Persistence beyond localStorage (favorites, settings)

## Deliverable
A working dark dashboard at `/`, detail view at `/signal/:ticker`, and `/settings`, all matching the Kudhoon visual language and ready to point at your Railway API.
