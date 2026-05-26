# Crypto Technical Scanner — Complete Codex Project Specification

> This is the complete single-file specification for building the Crypto Technical Scanner project with Codex.
>
> Product type: crypto technical screening and research tool.
>
> Important: this is not a trading bot, not a wallet app, and not financial advice software.

---

## How Codex Should Use This Document

Codex should follow this document in phases.

Do not implement the full product in one pass.

Recommended execution order:

1. Project initialization and folder structure
2. Binance public market-data layer
3. Indicator calculation layer
4. Scanner scoring layer
5. Scanner UI
6. Symbol detail page and charting
7. Caching, concurrency, and production hardening
8. Optional v2/v3 enhancements

For every phase, Codex must:

- Report changed files
- Explain implementation choices
- Run lint/build/typecheck where available
- Report known limitations
- Avoid adding unrequested features
- Avoid trading/order/wallet/private-key functionality

---

# Crypto Technical Scanner — Project Specification for Codex

> Version: v0.1 MVP Specification  
> Purpose: Build a crypto technical analysis scanner as a research and decision-support tool.  
> Important: This is **not** a trading bot, not a signal-selling site, and not financial advice.

---

## 0. Product Definition

### 0.1 One-sentence positioning

**Crypto Technical Scanner** is a web-based crypto market scanner that ranks Binance USDT spot pairs by technical structure, volatility compression, trend state, confirmation strength, and risk level.

### 0.2 What the product should do

The product should help the user answer:

- Which coins are entering volatility compression?
- Which coins are attempting a breakout?
- Which coins are trending cleanly?
- Which coins are overextended and risky?
- Which coins have weak or conflicting signals?
- What conditions would confirm or invalidate the current setup?

### 0.3 What the product must not do

Do **not** implement:

- Wallet connection
- Private exchange API keys
- Order placement
- Auto trading
- Copy trading
- Portfolio tracking
- Profit guarantees
- “Buy / Sell / Strong Buy” labels
- Financial advice language

Use neutral language:

- Observe
- Watch
- Breakout Attempt
- Confirming
- Trend Continuation
- Overextended
- Risk Warning
- Invalidated

### 0.4 First version scope

MVP scope:

- Exchange: Binance Spot only
- Quote asset: USDT only
- Market universe: Top 100 by 24h quote volume
- Timeframes: 4h and 1d
- Indicators:
  - SMA20 / SMA50 / SMA200
  - Bollinger Bands 20, 2
  - Bollinger Band Width
  - Bollinger Band Width Percentile
  - RSI14
  - Volume MA20
  - Volume Ratio
  - Price extension from MA20
- Output:
  - Market phase
  - Opportunity score
  - Confirmation score
  - Risk score
  - Rank score
  - Reasons
  - Warnings
  - Next confirmation
  - Invalidation

---

## 1. Recommended Technology Stack

### 1.1 Core stack

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui where useful
- TanStack Table for scanner result tables
- TanStack Query for frontend request state
- Lightweight Charts for candlestick charts
- technicalindicators for MVP indicator calculations
- p-limit for API concurrency control

### 1.2 Why this stack

Next.js is preferred over Astro for this project because the app is dynamic and API-heavy. It requires route handlers, server-side data fetching, caching, interactive filters, and later database-backed signal history.

### 1.3 External libraries to use

#### Data

- MVP: direct Binance public REST API
- Later: CCXT adapter for multi-exchange support

#### Indicators

- MVP: `technicalindicators`
- Alternative later: `trading-signals` or `ixjb94/indicators`

Important implementation rule:

> Do not call third-party indicator libraries directly from pages, components, or scanner logic. Wrap them inside `src/lib/indicators/`.

#### Charts

- Use `lightweight-charts` for candlestick and overlay lines.

#### Tables

- Use `@tanstack/react-table`.

#### Concurrency

- Use `p-limit`.
- Do not scan 100+ symbols with unrestricted `Promise.all`.

---

## 2. Architecture Overview

### 2.1 High-level architecture

```txt
User Interface
  ↓
Next.js API Routes
  ↓
Exchange Adapter Layer
  ↓
Raw Market Data
  ↓
Indicator Calculation Layer
  ↓
Scanner / Scoring Layer
  ↓
Explanation Layer
  ↓
Result Table + Symbol Detail Page
```

### 2.2 Main design principle

Separate the project into clean layers:

1. **Exchange layer**: fetches and normalizes market data.
2. **Indicator layer**: calculates pure technical indicators.
3. **Scanner layer**: converts indicators into phases, scores, warnings, and explanations.
4. **API layer**: exposes data to the UI.
5. **UI layer**: displays sortable, explainable results.

Do not mix these layers.

### 2.3 Cloudflare Workers Deployment Boundary

The stabilized MVP deploys to Cloudflare Workers via OpenNext for Cloudflare.

Cloudflare production supports the remote Binance scanner only:

- `/api/scan?source=remote`
- `/api/scan/mtf?source=remote`

Remote Binance is the default scan source. Local SQLite market-data sync and local JSONL scan history are local Node.js development features only. Cloudflare production should set:

```txt
DISABLE_LOCAL_SQLITE=true
NEXT_PUBLIC_DEPLOY_TARGET=cloudflare
```

When those flags are active, local-only routes return a clear `501` response instead of importing local SQLite or filesystem persistence. Persistent scan history on Cloudflare should later use D1 or another Workers-native persistence layer, but D1 is intentionally out of scope for the current MVP hardening task.

---

## 3. Project Directory Structure

Create this structure:

```txt
crypto-technical-scanner/
  app/
    page.tsx
    scanner/
      page.tsx
    symbol/
      [exchange]/
        [symbol]/
          page.tsx
    api/
      markets/
        route.ts
      candles/
        route.ts
      scan/
        route.ts

  src/
    components/
      layout/
        Header.tsx
        Footer.tsx

      scanner/
        ScannerTable.tsx
        ScannerFilters.tsx
        SignalBadge.tsx
        ScoreBadge.tsx
        ReasonList.tsx
        SelectedSymbolPanel.tsx
        PhaseBadge.tsx
        RiskBadge.tsx

      chart/
        CandleChart.tsx
        IndicatorLegend.tsx

    lib/
      exchanges/
        types.ts
        binance.ts

      indicators/
        types.ts
        movingAverage.ts
        bollinger.ts
        rsi.ts
        volume.ts
        index.ts

      scanner/
        types.ts
        marketPhase.ts
        scoring.ts
        riskFilters.ts
        explanations.ts
        multiTimeframe.ts
        scanMarket.ts

      cache/
        memory.ts
        keys.ts

      utils/
        math.ts
        format.ts
        logger.ts

  README.md
  package.json
```

---

## 4. Type Definitions

### 4.1 Exchange and timeframe types

```ts
export type Exchange = "binance";

export type Timeframe = "1h" | "4h" | "1d";
```

### 4.2 Market type

```ts
export type Market = {
  exchange: Exchange;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  quoteVolume?: number;
  priceChangePercent?: number;
};
```

### 4.3 Candle type

```ts
export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};
```

### 4.4 Indicator snapshot type

```ts
export type IndicatorSnapshot = {
  close: number;

  ma20: number | null;
  ma50: number | null;
  ma200: number | null;

  bollinger: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
    width: number | null;
    widthPercentile: number | null;
  };

  rsi14: number | null;

  volume: {
    current: number;
    ma20: number | null;
    ratio: number | null;
  };

  priceExtensionFromMA20: number | null;
};
```

### 4.5 Market phase type

```ts
export type MarketPhase =
  | "BASE_BUILDING"
  | "SQUEEZE"
  | "BREAKOUT_ATTEMPT"
  | "BREAKOUT_CONFIRMED"
  | "TRENDING"
  | "PULLBACK_HEALTHY"
  | "OVEREXTENDED"
  | "DISTRIBUTION"
  | "BREAKDOWN";
```

### 4.6 Scan result type

```ts
export type ScanResult = {
  exchange: "binance";
  symbol: string;
  timeframe: Timeframe;

  price: number;
  phase: MarketPhase;

  opportunityScore: number;
  confirmationScore: number;
  riskScore: number;
  rankScore: number;

  rsi14: number | null;
  bbWidthPercentile: number | null;
  volumeRatio: number | null;

  maStatus: {
    aboveMA20: boolean;
    aboveMA50: boolean;
    aboveMA200: boolean;
    ma20AboveMA50: boolean;
    ma50AboveMA200: boolean;
  };

  reasons: string[];
  warnings: string[];
  nextConfirmation: string[];
  invalidation: string[];

  dataQuality: {
    candleCount: number;
    sufficientHistory: boolean;
    missingIndicators: string[];
  };
};
```

---

## 5. Exchange Layer

### 5.1 Files

```txt
src/lib/exchanges/types.ts
src/lib/exchanges/binance.ts
```

### 5.2 Required functions

```ts
getSpotMarkets(): Promise<Market[]>

get24hTickers(): Promise<Record<string, {
  symbol: string;
  quoteVolume: number;
  priceChangePercent: number;
}>>

getTopUsdtMarkets(limit?: number): Promise<Market[]>

getCandles(
  symbol: string,
  timeframe: Timeframe,
  limit?: number
): Promise<Candle[]>
```

### 5.3 Binance filtering rules

Only include symbols where:

- `status === "TRADING"`
- `quoteAsset === "USDT"`

Exclude:

- Stablecoin pairs
- Leveraged tokens
- Inverse/UP/DOWN/BULL/BEAR tokens
- Very low liquidity pairs if they appear in the top list accidentally

Stablecoin bases to exclude:

```ts
const EXCLUDED_BASE_ASSETS = new Set([
  "USDC",
  "FDUSD",
  "TUSD",
  "DAI",
  "USDP",
  "BUSD",
  "EUR",
  "AEUR",
  "PAX",
]);
```

Leveraged token patterns to exclude:

```ts
const LEVERAGED_PATTERNS = [
  "UP",
  "DOWN",
  "BULL",
  "BEAR",
  "3L",
  "3S",
  "5L",
  "5S",
];
```

Be careful not to incorrectly exclude legitimate symbols that merely contain these letters. Prefer checking suffixes where possible.

### 5.4 Candle normalization

Binance kline response must be normalized to:

```ts
{
  openTime: Number(k[0]),
  open: Number(k[1]),
  high: Number(k[2]),
  low: Number(k[3]),
  close: Number(k[4]),
  volume: Number(k[5]),
  closeTime: Number(k[6])
}
```

---

## 6. Indicator Layer

### 6.1 Files

```txt
src/lib/indicators/types.ts
src/lib/indicators/movingAverage.ts
src/lib/indicators/bollinger.ts
src/lib/indicators/rsi.ts
src/lib/indicators/volume.ts
src/lib/indicators/index.ts
```

### 6.2 Required exported function

```ts
calculateIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot
```

### 6.3 Indicator requirements

Calculate:

- SMA20
- SMA50
- SMA200
- Bollinger Bands 20, 2
- Bollinger Band Width
- Bollinger Band Width Percentile over the last 90 valid width values
- RSI14
- Volume MA20
- Volume Ratio
- Price extension from MA20

### 6.4 Null behavior

If there is insufficient history:

- Return `null` for the unavailable indicator.
- Do not throw.
- Include missing indicators in `dataQuality.missingIndicators` later in scanner output.

### 6.5 Bollinger Band Width formula

```txt
bandWidth = (upper - lower) / middle
```

If `middle` is zero or null, return null.

### 6.6 Width percentile

Calculate where the current width sits relative to the last 90 valid widths.

Example:

```txt
current width is lower than 15% of recent widths
=> widthPercentile = 15
```

Low percentile means volatility compression.

### 6.7 Price extension from MA20

```txt
extension = (close - ma20) / ma20
```

Return decimal value, not percentage string.

Example:

```txt
0.08 means price is 8% above MA20.
```

---

## 7. Scanner and Scoring Layer

### 7.1 Files

```txt
src/lib/scanner/types.ts
src/lib/scanner/marketPhase.ts
src/lib/scanner/scoring.ts
src/lib/scanner/riskFilters.ts
src/lib/scanner/explanations.ts
src/lib/scanner/multiTimeframe.ts
src/lib/scanner/scanMarket.ts
```

### 7.2 Scanner goals

The scanner must not simply return indicator values. It must classify each market into a meaningful state and explain the classification.

For each symbol, produce:

- Market phase
- Opportunity score
- Confirmation score
- Risk score
- Rank score
- Reasons
- Warnings
- Next confirmation
- Invalidation

---

## 8. Market Phase Model

### 8.1 BASE_BUILDING

Meaning:

- Price is moving sideways.
- Volatility is relatively low.
- Price is not yet breaking out.

Typical conditions:

- Price near MA20 or Bollinger middle band
- Bollinger width below average
- RSI between 40 and 60
- No strong volume expansion

### 8.2 SQUEEZE

Meaning:

- Volatility compression.
- Potential pre-breakout structure.
- Good observation candidate, but not confirmed.

Typical conditions:

- Bollinger width percentile below 20
- MA20 and MA50 close together
- Price near Bollinger middle band
- Volume quiet or normal

### 8.3 BREAKOUT_ATTEMPT

Meaning:

- Price is trying to move out of compression or resistance.
- Needs volume and close confirmation.

Typical conditions:

- Close near or above upper Bollinger Band
- RSI above 55
- Volume ratio rising
- MA20 flattening or turning up

### 8.4 BREAKOUT_CONFIRMED

Meaning:

- Breakout has stronger confirmation.
- Still not a buy recommendation.

Typical conditions:

- Close above upper Bollinger Band
- Volume ratio above 1.5
- MA20 above or crossing MA50
- RSI between 55 and 72

### 8.5 TRENDING

Meaning:

- Market is already in an uptrend.

Typical conditions:

- Price > MA20 > MA50
- Price > MA200
- RSI between 50 and 70
- Pullbacks remain controlled

### 8.6 PULLBACK_HEALTHY

Meaning:

- Uptrend remains valid, but price is pulling back.

Typical conditions:

- Price above MA50 or MA200
- Price near MA20 or Bollinger middle band
- RSI above 45
- No breakdown volume

### 8.7 OVEREXTENDED

Meaning:

- Price may be too far from mean.
- Chasing risk is high.

Typical conditions:

- RSI above 75
- Price far above MA20
- Volume spike after a large candle
- Close far above upper Bollinger Band

### 8.8 DISTRIBUTION

Meaning:

- Possible weakening after a strong move.

Typical conditions:

- High volume but weak close
- Long upper wick
- RSI divergence optional later
- Price falls back under Bollinger middle band after expansion

### 8.9 BREAKDOWN

Meaning:

- Bearish or structurally weak state.

Typical conditions:

- Price below MA50 or MA200
- RSI weak
- High sell volume
- Bollinger lower band expansion

---

## 9. Scoring Model

### 9.1 Score outputs

For every result:

```txt
opportunityScore: 0-100
confirmationScore: 0-100
riskScore: 0-100
rankScore: derived value
```

### 9.2 Opportunity score

Opportunity score measures whether the symbol is worth observing.

Add points for:

- Bollinger width percentile below 20
- MA20 and MA50 convergence
- Price near Bollinger middle band
- RSI not overextended
- Volume quiet during compression
- Sufficient candle history

Example logic:

```txt
+30 if BB width percentile < 20
+20 if MA20 and MA50 are within 2%
+15 if price is near Bollinger middle band
+10 if RSI between 40 and 65
+10 if volume ratio between 0.6 and 1.2 during compression
+15 if trend context is not broken
```

### 9.3 Confirmation score

Confirmation score measures whether the setup is already being confirmed.

Add points for:

- Close above upper Bollinger Band
- Volume ratio > 1.5
- MA20 > MA50
- Price > MA200
- RSI between 55 and 72

Example logic:

```txt
+25 if close > upper Bollinger Band
+25 if volume ratio > 1.5
+20 if MA20 > MA50
+15 if price > MA200
+15 if RSI is between 55 and 72
```

### 9.4 Risk score

Risk score measures danger, overextension, or weak structure.

Add points for:

- RSI > 75
- Price far above MA20
- Price below MA50 or MA200
- Breakout without volume
- Long upper wick
- Insufficient history
- Market regime weak

Example logic:

```txt
+25 if RSI > 75
+20 if price extension from MA20 > 8%
+20 if price < MA50
+25 if close > upper Bollinger Band but volumeRatio < 1.2
+10 if candle history is insufficient
```

### 9.5 Rank score

Use rankScore for sorting only.

Initial formula:

```txt
rankScore =
  opportunityScore * 0.45 +
  confirmationScore * 0.35 -
  riskScore * 0.20
```

Clamp the final value between 0 and 100.

Important:

> Never hide the three underlying scores. Display all of them.

---

## 10. Risk Filters

### 10.1 Fake breakout risk

Add warning if:

- Price breaks above upper Bollinger Band but volume ratio < 1.2
- RSI > 75
- Current candle has a long upper wick
- Price extension from MA20 is too high
- 4h signal conflicts with 1d trend later

Example warning:

```txt
Possible fake breakout: price moved above the upper Bollinger Band without strong volume confirmation.
```

### 10.2 Overextension risk

Add warning if:

- RSI > 75
- Price extension from MA20 > 8% on 4h
- Price extension from MA20 > 15% on 1d

Example warning:

```txt
Price is extended from MA20; chasing risk is elevated.
```

### 10.3 Weak structure risk

Add warning if:

- Price below MA50
- Price below MA200
- RSI below 45
- Volume rising while price is falling

Example warning:

```txt
Trend structure is weak because price is below MA50.
```

---

## 11. Explanation Layer

Every scan result must include explanation arrays.

### 11.1 reasons[]

Explain why the symbol ranked.

Examples:

```txt
Bollinger Band width is in the lower 20% of recent candles.
MA20 and MA50 are converging.
Price is holding near the Bollinger middle band.
Volume is quiet, consistent with compression.
```

### 11.2 warnings[]

Explain risks.

Examples:

```txt
RSI is above 75, which may indicate overextension.
Breakout attempt lacks volume confirmation.
Daily trend is not confirmed yet.
Price is below MA200, so long-term trend remains weak.
```

### 11.3 nextConfirmation[]

Explain what should happen next.

Examples:

```txt
Watch for a 4H close above the upper Bollinger Band.
Volume ratio should rise above 1.5.
RSI should remain below 72 during confirmation.
Price should remain above MA50.
```

### 11.4 invalidation[]

Explain what would invalidate the setup.

Examples:

```txt
Invalidated if price closes below MA50 on the 4H timeframe.
Invalidated if price falls back below the Bollinger middle band with rising volume.
Invalidated if BTC daily market regime turns weak.
```

---

## 12. API Routes

### 12.1 `/api/markets`

Purpose:

- Return filtered Binance USDT spot markets.

Query params:

```txt
limit optional
```

Response:

```ts
{
  exchange: "binance";
  markets: Market[];
  itemCount: number;
  cached: boolean;
  updatedAt: string;
}
```

### 12.2 `/api/candles`

Purpose:

- Return normalized candle data for one symbol.

Query params:

```txt
symbol=BTCUSDT
timeframe=4h
limit=300
```

Response:

```ts
{
  exchange: "binance";
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  itemCount: number;
  cached: boolean;
  updatedAt: string;
}
```

### 12.3 `/api/scan`

Purpose:

- Scan top USDT markets and return ranked results.

Query params:

```txt
timeframe=4h
limit=100
```

Response:

```ts
{
  exchange: "binance";
  timeframe: Timeframe;
  results: ScanResult[];
  itemCount: number;
  errors?: {
    symbol: string;
    message: string;
  }[];
  cached: boolean;
  updatedAt: string;
}
```

### 12.4 Error handling

One symbol failure must not fail the whole scan.

If a symbol fails:

- Skip it.
- Add it to `errors`.
- Return partial results.

---

## 13. Caching and Performance

### 13.1 MVP cache

Use simple in-memory server-side cache first.

Files:

```txt
src/lib/cache/memory.ts
src/lib/cache/keys.ts
```

### 13.2 Cache TTL

Use:

```txt
markets: 1 hour
tickers: 1 minute
candles 1h: 2 minutes
candles 4h: 5 minutes
candles 1d: 15 minutes
scan 4h: 5 minutes
scan 1d: 15 minutes
```

### 13.3 Cache keys

```txt
markets:binance:spot:usdt
tickers:binance:24h
candles:binance:{symbol}:{timeframe}:{limit}
scan:binance:{timeframe}:{limit}
```

### 13.4 Concurrency control

Use `p-limit`.

Default scan concurrency:

```txt
5
```

Do not use unrestricted:

```ts
Promise.all(markets.map(...))
```

Use:

```ts
const limit = pLimit(5);
const results = await Promise.all(
  markets.map((market) => limit(() => scanSymbol(market)))
);
```

### 13.5 Future production cache

Later, replace memory cache with:

- Upstash Redis
- Redis on Railway/Fly.io
- Cloudflare KV if deployed in Cloudflare ecosystem

But do not add Redis in MVP unless necessary.

---

## 14. UI Requirements

### 14.1 Scanner page

Route:

```txt
/scanner
```

Layout:

```txt
Left: filters
Center: result table
Right: selected symbol summary
```

### 14.2 Filters

Support:

- Timeframe: 4h / 1d
- Phase
- Minimum opportunity score
- Maximum risk score
- Sort by:
  - rankScore
  - opportunityScore
  - confirmationScore
  - lowest riskScore
- Limit:
  - 50
  - 100
  - 200

### 14.3 Table columns

Required:

- Rank
- Symbol
- Phase
- Opportunity
- Confirmation
- Risk
- Rank Score
- RSI
- BB Width Percentile
- Volume Ratio
- MA Status
- Warnings

### 14.4 Selected symbol panel

When clicking a row, show:

- Symbol
- Phase
- Opportunity score
- Confirmation score
- Risk score
- Reasons
- Warnings
- Next confirmation
- Invalidation

### 14.5 UI states

Implement:

- Loading state
- Error state
- Empty state
- Cached data note
- Refresh Scan button

### 14.6 UI language

Do not use:

- Buy
- Sell
- Strong Buy
- Moon
- Pump
- Guaranteed
- Profit signal

Use:

- Observe
- Watch
- Confirming
- Breakout Attempt
- Trend Continuation
- Risk Warning
- Overextended
- Invalidated

---

## 15. Symbol Detail Page

### 15.1 Route

```txt
/symbol/[exchange]/[symbol]
```

Example:

```txt
/symbol/binance/BTCUSDT
```

### 15.2 Page content

Show:

- Symbol
- Timeframe selector
- Current price
- Market phase
- Opportunity / Confirmation / Risk scores
- Candlestick chart
- MA20 / MA50 / MA200 overlays
- Bollinger Band overlays
- Indicator summary
- Reasons
- Warnings
- Next confirmation
- Invalidation

### 15.3 Chart requirements

Use `lightweight-charts`.

MVP chart:

- Candlesticks
- MA20 line
- MA50 line
- MA200 line
- Bollinger upper/middle/lower lines

Later:

- Volume histogram
- RSI panel
- Signal markers
- Compression zone shading

---

## 16. Multi-Timeframe Enhancement

This is v2, not required in initial MVP unless time permits.

### 16.1 Purpose

Analyze 4h and 1d together.

### 16.2 Alignment states

```ts
export type MultiTimeframeAlignment =
  | "STRONG_ALIGNMENT"
  | "EARLY_4H_SIGNAL"
  | "DAILY_CONFIRMATION"
  | "CONFLICTING"
  | "HIGH_RISK";
```

### 16.3 Examples

| 4h Phase | 1d Phase | Alignment |
|---|---|---|
| SQUEEZE | SQUEEZE | STRONG_ALIGNMENT |
| BREAKOUT_ATTEMPT | SQUEEZE | EARLY_4H_SIGNAL |
| BREAKOUT_CONFIRMED | TRENDING | STRONG_ALIGNMENT |
| OVEREXTENDED | TRENDING | HIGH_RISK |
| BREAKOUT_ATTEMPT | BREAKDOWN | CONFLICTING |

---

## 17. BTC / ETH Market Regime Enhancement

This is v2, not required in MVP unless easy.

### 17.1 Purpose

Altcoin signals should be adjusted by BTC/ETH market environment.

### 17.2 Market regime inputs

Use:

- BTCUSDT 4h
- BTCUSDT 1d
- ETHUSDT 4h
- ETHUSDT 1d

### 17.3 Weak regime

If BTC daily is weak:

- Price below MA50
- RSI below 45
- Breakdown phase

Then:

- Reduce altcoin breakout-related rank score
- Add warning:

```txt
Market regime is weak; altcoin breakout signals may be less reliable.
```

---

## 18. Watchlist Enhancement

This is v2.

### 18.1 MVP watchlist storage

Use `localStorage`.

### 18.2 No login required

Do not add accounts in early versions.

### 18.3 Watchlist features

- Add symbol to watchlist
- Remove symbol
- Filter scanner to watchlist
- Highlight watchlist symbols in scanner

---

## 19. Historical Signals and Backtesting

This is v3.

Do not implement in MVP.

### 19.1 Later database

Use:

- PostgreSQL
- Prisma

### 19.2 Tables later

Potential schema:

```txt
markets
candles
indicator_snapshots
signal_snapshots
watchlists
```

### 19.3 Backtest metrics later

For each signal type:

- 3-day return
- 7-day return
- 14-day return
- Max drawdown
- Win rate
- Median return
- Number of occurrences

---

## 20. Development Phases for Codex

Do the project in small tasks. Do not attempt all phases in one pass.

### Phase 1 — Project scaffold

Goal:

- Set up Next.js project.
- Add folders, placeholder pages, placeholder components, types.
- No real Binance logic yet.

Acceptance:

- `/` opens.
- `/scanner` opens.
- `/symbol/binance/BTCUSDT` opens.
- `npm run lint` passes.
- `npm run build` passes.

### Phase 2 — Binance data layer

Goal:

- Implement exchange adapter.
- Implement `/api/markets`.
- Implement `/api/candles`.

Acceptance:

- `/api/markets` returns filtered Binance USDT pairs.
- `/api/candles?symbol=BTCUSDT&timeframe=4h` returns normalized candles.
- No private API keys used.

### Phase 3 — Indicator layer

Goal:

- Implement indicator wrapper.
- Calculate indicator snapshots.

Acceptance:

- `calculateIndicatorSnapshot(candles)` works.
- Short candle arrays return nulls instead of throwing.
- No scanner scoring yet.

### Phase 4 — Scanner scoring layer

Goal:

- Implement market phase classification.
- Implement scoring.
- Implement explanations.
- Implement `/api/scan`.

Acceptance:

- `/api/scan?timeframe=4h&limit=100` returns ranked ScanResult[].
- Results include reasons, warnings, nextConfirmation, invalidation.
- One failed symbol does not fail the whole scan.

### Phase 5 — Scanner UI

Goal:

- Build `/scanner` page.

Acceptance:

- User can select timeframe and limit.
- User can click Refresh Scan.
- Results appear in sortable table.
- Clicking a row shows details in side panel.
- No financial advice language.

### Phase 6 — Symbol detail page

Goal:

- Build `/symbol/[exchange]/[symbol]`.

Acceptance:

- Page shows candle chart.
- Chart overlays MA and Bollinger Bands.
- Page shows indicator summary and current scanner interpretation.

### Phase 7 — Cache and stability

Goal:

- Add memory cache.
- Add concurrency control.
- Add response metadata.

Acceptance:

- Repeated API calls return faster from cache.
- Scan does not use unrestricted concurrency.
- API returns `cached`, `updatedAt`, and `itemCount`.

### Phase 8 — Polish and README

Goal:

- Improve UI.
- Add README.
- Add known limitations.
- Clean warnings.

Acceptance:

- README explains setup, architecture, limitations, and safety boundaries.
- Build passes.

---

## 21. Codex Execution Rules

Every Codex task should follow these rules:

1. Do only the requested phase.
2. Do not add unrelated features.
3. Do not implement trading.
4. Do not add wallet connection.
5. Do not use private API keys.
6. Do not introduce database unless the phase explicitly asks for it.
7. Do not replace the architecture without explanation.
8. Keep TypeScript types clean.
9. Add comments where formulas or scoring assumptions are non-obvious.
10. Run:
   - `npm run lint`
   - `npm run build`
11. Report:
   - Changed files
   - What was implemented
   - Known limitations
   - Any skipped parts

---

## 22. Prompt for Codex — Phase 1

Copy this prompt into Codex first:

```txt
Create the initial project structure for a crypto technical scanner web app.

This is a decision-support research tool for crypto technical analysis, not a trading bot.

Use:
- Next.js App Router
- TypeScript
- Tailwind CSS
- TanStack Table
- TanStack Query
- lightweight-charts
- technicalindicators
- p-limit

Create routes:
- /
- /scanner
- /symbol/[exchange]/[symbol]
- /api/markets
- /api/scan
- /api/candles

Create folders:
src/components/scanner
src/components/chart
src/components/layout
src/lib/exchanges
src/lib/indicators
src/lib/scanner
src/lib/cache
src/lib/utils

Create placeholder components:
- Header
- Footer
- ScannerTable
- ScannerFilters
- SignalBadge
- ScoreBadge
- ReasonList
- SelectedSymbolPanel
- CandleChart

Create placeholder types for:
- Exchange
- Timeframe
- Market
- Candle
- IndicatorSnapshot
- MarketPhase
- ScanResult

Important rules:
- Do not implement real exchange logic yet
- Do not implement trading
- Do not add wallet connection
- Do not use private exchange API keys
- Do not use Buy/Sell/Strong Buy language
- Add a disclaimer that the tool is for technical screening and research only and does not provide financial advice

After implementation:
- run npm run lint
- run npm run build
- report changed files
- report known limitations
```

---

## 23. Prompt for Codex — Phase 2

```txt
Implement the Binance public market data layer.

Scope:
- Binance Spot only
- Public endpoints only
- No API keys
- No trading
- No order placement

Create:
src/lib/exchanges/types.ts
src/lib/exchanges/binance.ts

Implement:
1. getSpotMarkets()
- Fetch Binance exchangeInfo
- Return only symbols where status is TRADING
- Return only USDT quote pairs
- Exclude stablecoin pairs and leveraged tokens

2. get24hTickers()
- Fetch Binance 24h ticker data
- Map quoteVolume and priceChangePercent

3. getTopUsdtMarkets(limit = 100)
- Combine markets and tickers
- Sort by quoteVolume descending
- Return top 100 by default

4. getCandles(symbol, timeframe, limit = 300)
- Fetch Binance klines
- Convert raw response to typed Candle[]
- Support 1h, 4h, 1d

Create API routes:
- /api/markets
- /api/candles?symbol=BTCUSDT&timeframe=4h

Add basic error handling.

Do not implement scanner logic yet.

After implementation:
- run lint
- run build
- report changed files
```

---

## 24. Prompt for Codex — Phase 3

```txt
Implement the indicator calculation layer.

Use technicalindicators only inside src/lib/indicators.
Do not call technicalindicators from pages, API routes, or scanner logic directly.

Create:
src/lib/indicators/types.ts
src/lib/indicators/movingAverage.ts
src/lib/indicators/bollinger.ts
src/lib/indicators/rsi.ts
src/lib/indicators/volume.ts
src/lib/indicators/index.ts

Implement:
- SMA 20 / 50 / 200
- Bollinger Bands with period 20 and stdDev 2
- Bollinger Band Width
- Bollinger Band Width percentile over the last 90 valid width values
- RSI 14
- Volume MA20
- Volume ratio = current volume / volumeMA20
- Price extension from MA20

Create a function:
calculateIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot

Rules:
- Return null for indicators when there is not enough data
- Do not throw for short candle arrays
- Keep calculations pure and testable
- Add comments explaining assumptions

Do not implement scanner scoring yet.

After implementation:
- run lint
- run build
- report changed files
```

---

## 25. Prompt for Codex — Phase 4

```txt
Implement the scanner scoring layer.

Create:
src/lib/scanner/types.ts
src/lib/scanner/marketPhase.ts
src/lib/scanner/scoring.ts
src/lib/scanner/riskFilters.ts
src/lib/scanner/explanations.ts
src/lib/scanner/scanMarket.ts

Use the existing exchange layer and indicator layer.

For each symbol:
1. Fetch candles
2. Calculate indicator snapshot
3. Determine market phase
4. Calculate:
   - opportunityScore
   - confirmationScore
   - riskScore
   - rankScore
5. Generate:
   - reasons[]
   - warnings[]
   - nextConfirmation[]
   - invalidation[]

Market phases:
- BASE_BUILDING
- SQUEEZE
- BREAKOUT_ATTEMPT
- BREAKOUT_CONFIRMED
- TRENDING
- PULLBACK_HEALTHY
- OVEREXTENDED
- DISTRIBUTION
- BREAKDOWN

Scoring guidelines:
- SQUEEZE: high opportunity when Bollinger Band width percentile is low and MA20/MA50 are close
- BREAKOUT_ATTEMPT: high confirmation when close is above upper Bollinger Band and volume ratio > 1.5
- TRENDING: price > MA20 > MA50 and price > MA200
- PULLBACK_HEALTHY: price near MA20 or Bollinger middle band while trend remains intact
- OVEREXTENDED: RSI > 75 or price is far above MA20
- BREAKDOWN: price below MA50/MA200 with weak RSI or high sell volume

Add risk warnings:
- RSI above 75
- volume does not confirm breakout
- price too extended from MA20
- insufficient candle history
- low liquidity if available

Create /api/scan?timeframe=4h&limit=100

Implementation requirements:
- Use p-limit to limit concurrent candle fetches
- Sort results by rankScore descending
- Return JSON
- Add basic error handling per symbol so one failed symbol does not fail the whole scan

Do not build the full UI yet.

After implementation:
- run lint
- run build
- report changed files
```

---

## 26. Prompt for Codex — Phase 5

```txt
Build the scanner UI.

Route:
- /scanner

Use:
- TanStack Table
- React state
- Existing /api/scan endpoint
- shadcn/ui components if available

Layout:
- Left filter panel
- Main results table
- Right selected-symbol summary panel

Filters:
- timeframe: 4h / 1d
- phase
- min opportunity score
- max risk score
- sort by:
  - rankScore
  - opportunityScore
  - confirmationScore
  - lowest riskScore
- limit: 50 / 100 / 200

Table columns:
- Rank
- Symbol
- Phase
- Opportunity
- Confirmation
- Risk
- Rank Score
- RSI
- BB Width Percentile
- Volume Ratio
- MA Status
- Warnings

Selected symbol panel:
Show:
- symbol
- phase
- opportunityScore
- confirmationScore
- riskScore
- reasons[]
- warnings[]
- nextConfirmation[]
- invalidation[]

UX:
- Add loading state
- Add error state
- Add empty state
- Add Refresh Scan button
- Avoid financial advice language
- Do not use Buy/Sell labels

Design:
- Clean technical interface
- Restrained colors
- Readable table
- Use badges for phases and risk warnings

After implementation:
- run lint
- run build
- report changed files
```

---

## 27. Prompt for Codex — Phase 6

```txt
Build the symbol detail page.

Route:
- /symbol/[exchange]/[symbol]

Use:
- Existing /api/candles endpoint
- Existing indicator calculation logic
- lightweight-charts for candlestick chart

Features:
1. Fetch candles for selected symbol
2. Display candlestick chart
3. Overlay:
   - MA20
   - MA50
   - MA200
   - Bollinger upper/middle/lower
4. Show indicator summary:
   - RSI14
   - Bollinger Band Width Percentile
   - Volume Ratio
   - MA status
5. Show current scanner interpretation:
   - phase
   - opportunityScore
   - confirmationScore
   - riskScore
   - reasons
   - warnings
   - nextConfirmation
   - invalidation

Keep chart implementation simple and stable.
Do not overbuild.
No trading buttons.
No Buy/Sell labels.

After implementation:
- run lint
- run build
- report changed files
```

---

## 28. Prompt for Codex — Phase 7

```txt
Add caching and performance safeguards.

Create:
src/lib/cache/memory.ts
src/lib/cache/keys.ts

Implement simple server-side memory cache:
- markets: 1 hour
- tickers: 1 minute
- candles 1h: 2 minutes
- candles 4h: 5 minutes
- candles 1d: 15 minutes
- scan 4h: 5 minutes
- scan 1d: 15 minutes

Add cache keys:
- markets:binance:spot:usdt
- tickers:binance:24h
- candles:binance:{symbol}:{timeframe}:{limit}
- scan:binance:{timeframe}:{limit}

Add response metadata:
- cached
- updatedAt
- itemCount

Add concurrency protection:
- Use p-limit when scanning symbols
- Default concurrency: 5
- Do not use Promise.all without concurrency limit for large scans

Add graceful degradation:
- If one symbol fails, collect the error and continue
- Return partial results with warnings if necessary

After implementation:
- run lint
- run build
- report changed files
```

---

## 29. README Requirements

The project README must include:

- What the tool does
- What the tool does not do
- Setup instructions
- Development commands
- Data source explanation
- Indicator explanation
- Scoring explanation
- Safety disclaimer
- Known limitations
- Future roadmap

Disclaimer text:

```txt
This tool is for technical screening and research only. It does not provide financial advice, investment advice, trading recommendations, or profit guarantees. It does not place trades or connect to user wallets or exchange accounts.
```

---

## 30. MVP Acceptance Checklist

Before calling MVP complete, confirm:

- [ ] `/` loads
- [ ] `/scanner` loads
- [ ] `/symbol/binance/BTCUSDT` loads
- [ ] `/api/markets` returns filtered markets
- [ ] `/api/candles?symbol=BTCUSDT&timeframe=4h` returns candles
- [ ] `/api/scan?timeframe=4h&limit=100` returns ranked results
- [ ] Results include phase
- [ ] Results include opportunity score
- [ ] Results include confirmation score
- [ ] Results include risk score
- [ ] Results include reasons
- [ ] Results include warnings
- [ ] Results include next confirmation
- [ ] Results include invalidation
- [ ] Scanner UI displays table
- [ ] Scanner UI has filters
- [ ] Selected symbol panel works
- [ ] Symbol detail page shows chart
- [ ] No trading functionality
- [ ] No wallet connection
- [ ] No private exchange API keys
- [ ] No Buy/Sell/Strong Buy language
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

---

## 31. Future Roadmap

### v2

- Watchlist with localStorage
- Multi-timeframe alignment
- BTC/ETH market regime filter
- Better liquidity tiers
- Better chart annotations

### v3

- PostgreSQL + Prisma
- Historical signal snapshots
- Backtesting
- Watchlist alerts
- Coinbase / Kraken / OKX support through exchange adapter or CCXT

### v4

- User accounts
- Saved strategy templates
- Custom scoring weights
- Signal performance analytics

---

## 32. Final Direction

The first version should be narrow, stable, and useful.

Do not attempt to build a full trading platform.

The MVP should answer one question well:

> “Among the top Binance USDT spot pairs, which coins currently have a technical structure worth observing, why, what confirms it, and what invalidates it?”

---

# Appendix: GitHub / Open-Source Reuse Strategy

The following section explains which existing GitHub projects and libraries should be used, referenced, or avoided.

---

This addendum explains which existing GitHub projects/libraries should be used or referenced for the Crypto Technical Scanner project, and which ones should not be used as the project base.

## Core Decision

Do not fork a full crypto trading bot as the project foundation.

Instead, build our own Next.js product structure and reuse mature open-source libraries for specific modules:

- Technical indicators
- Candlestick charting
- Market-data abstraction
- Optional future backtesting
- Optional future alerts

The product we are building is a technical screening and research tool, not an automated trading bot.

---

## Recommended Reuse Strategy

### Use libraries as dependencies

These can be installed through npm and wrapped inside our own abstraction layers.

1. `lightweight-charts`
2. `technicalindicators` or `trading-signals`
3. `ccxt` in v2, not required for v1
4. `p-limit`
5. `@tanstack/react-table`
6. `@tanstack/react-query`

### Reference code patterns only

These repositories may be studied for ideas, but should not be copied wholesale:

1. `CryptoSignal/Crypto-Signal`
2. `chrisleekr/binance-trading-bot`
3. `keithorange/CryptoSuperScreener`
4. `botcrypto-io/awesome-crypto-trading-bots`

---

## Recommended Libraries

### 1. TradingView Lightweight Charts

Repository:

`tradingview/lightweight-charts`

Use for:

- Candlestick charts
- MA overlays
- Bollinger Band overlays
- Signal markers on chart
- Future chart annotations

Why use it:

- Small and fast financial charting library
- Strong fit for browser-based financial tools
- Better than building charting from scratch
- Suitable for a clean technical scanner UI

How to use:

Install:

```bash
npm install lightweight-charts
```

Create our wrapper:

```txt
src/components/chart/CandleChart.tsx
src/components/chart/chartData.ts
src/components/chart/indicatorSeries.ts
```

Rules:

- Do not put chart logic directly into page files.
- Build a stable wrapper so chart implementation can evolve later.
- First version only needs candles + MA + Bollinger Bands.

---

### 2. technicalindicators

Repository:

`anandanand84/technicalindicators`

Use for MVP indicator calculations:

- SMA
- EMA if needed later
- RSI
- MACD if needed later
- Bollinger Bands
- Candlestick patterns, optional future use

Why use it:

- Simple and mature JavaScript/TypeScript technical indicator library
- Easy for Codex to understand
- Enough for MVP

Concern:

- The project is older and may not be as actively maintained as newer alternatives.
- Therefore, do not couple the whole app directly to this library.

How to use:

Install:

```bash
npm install technicalindicators
```

Wrap it:

```txt
src/lib/indicators/movingAverage.ts
src/lib/indicators/bollinger.ts
src/lib/indicators/rsi.ts
src/lib/indicators/volume.ts
src/lib/indicators/index.ts
```

Important rule:

No page, component, API route, or scanner logic should import `technicalindicators` directly.

Only files inside `src/lib/indicators/` may import it.

---

### 3. trading-signals

Repository:

`bennycode/trading-signals`

Use as an alternative to `technicalindicators`, or as a future upgrade.

Potential use:

- Streaming-style indicators
- Modular strategy concepts
- More TypeScript-native signal logic
- Future backtesting or strategy abstraction inspiration

Why consider it:

- Fully typed
- Modular
- Designed around indicators and strategy concepts
- Closer to the direction of a signal-scanning system

Concern:

- It also includes bot-related concepts, so we should not adopt the whole bot stack.
- Use only indicator and signal abstractions that fit our scanner.

Recommendation:

For v1, use either:

```txt
Option A: technicalindicators for simplicity
Option B: trading-signals if Codex finds it straightforward
```

But always hide the choice behind our own indicator wrapper.

---

### 4. CCXT

Repository:

`ccxt/ccxt`

Use in v2, not required in v1.

Use for:

- Multi-exchange support
- Binance / Coinbase / Kraken / OKX / Bybit unified market data
- Future exchange adapter layer

Do not use in v1 unless needed.

Why not v1:

- We only need Binance Spot public data first.
- Direct Binance API is simpler and easier to debug.
- CCXT adds abstraction weight before we need it.

Recommended path:

v1:

```txt
src/lib/exchanges/binance.ts
```

v2:

```txt
src/lib/exchanges/ccxt.ts
src/lib/exchanges/coinbase.ts
src/lib/exchanges/okx.ts
```

Keep this interface from day one:

```ts
export interface ExchangeAdapter {
  getMarkets(): Promise<Market[]>;
  getTickers(): Promise<Ticker[]>;
  getCandles(symbol: string, timeframe: Timeframe, limit: number): Promise<Candle[]>;
}
```

---

## Repositories to Study but Not Fork

### 1. CryptoSignal/Crypto-Signal

Repository:

`CryptoSignal/Crypto-Signal`

What it does:

- Command-line crypto technical analysis automation
- Tracks many coins across several exchanges
- Includes indicators such as RSI, SMA, MACD, MFI, OBV, VWAP
- Includes alert channels such as SMS, email, Slack, Telegram, Discord

Can borrow ideas from:

- Indicator grouping
- Alert concepts
- Multi-exchange mindset
- Signal naming
- Configuration style

Do not borrow:

- CLI-first architecture
- Bot-style product positioning
- Alert-heavy structure for MVP
- Any assumption that the app is a trading signal bot

Use only as reference.

---

### 2. chrisleekr/binance-trading-bot

Repository:

`chrisleekr/binance-trading-bot`

What it does:

- Automated Binance trading bot
- Grid trading
- Manual trade
- Stop-loss
- Multi-coin monitoring
- TradingView technical analysis integration

Can borrow ideas from:

- Binance monitoring patterns
- Symbol filtering
- Risk warning ideas
- Configuration naming

Do not borrow:

- Order placement
- Buy/sell flow
- Wallet or private API key handling
- Grid trading logic
- Trading bot UI assumptions

This project is too close to an automated trading product and should not be the foundation.

---

### 3. keithorange/CryptoSuperScreener

Repository:

`keithorange/CryptoSuperScreener`

What it does:

- Crypto screener concept
- CCXT-based multi-exchange direction
- Grid-watching charts

Can borrow ideas from:

- Screener UX
- Multi-chart monitoring
- CCXT direction for future versions

Do not borrow:

- Whole architecture
- Plotly-first charting if we prefer Lightweight Charts
- Older or less maintained code without review

Use as a product reference only.

---

### 4. botcrypto-io/awesome-crypto-trading-bots

Repository:

`botcrypto-io/awesome-crypto-trading-bots`

What it is:

- A curated list of crypto trading bots, technical analysis libraries, market data libraries, API/data providers, and charting libraries.

Use for:

- Researching alternative libraries
- Future comparison
- Finding backtesting frameworks later

Important caution:

The repository itself says tools are not checked or tested and should be used at your own risk.

---

## Strong Recommendation

Use this combination for the MVP:

```txt
Framework:
- Next.js App Router
- TypeScript

Market data:
- Direct Binance public REST API

Indicators:
- technicalindicators, wrapped by our own indicator layer

Charts:
- tradingview/lightweight-charts

Table:
- TanStack Table

Client data fetching:
- TanStack Query

Concurrency:
- p-limit

Cache:
- memory cache first
- Upstash Redis later
```

Do not use a full GitHub trading bot as the base.

---

## Why Not Fork a Full Bot?

Because most crypto bot repositories are optimized for:

- Trading
- Order placement
- API keys
- Telegram alerts
- Grid strategies
- Stop-loss / take-profit
- Bot configuration
- Server processes

Our project is optimized for:

- Web UI
- Technical screening
- Explainable ranking
- Market phase classification
- Multi-timeframe research
- No private keys
- No trading execution
- No financial advice language

The product goals are different.

Forking a trading bot would create more cleanup work than value.

---

## Codex Instruction: Reuse Policy

Add this instruction to every Codex task:

```txt
Reuse mature open-source libraries where appropriate, but do not fork or copy a full trading bot architecture.

Allowed dependencies:
- lightweight-charts
- technicalindicators or trading-signals
- @tanstack/react-table
- @tanstack/react-query
- p-limit
- ccxt only in v2 or later

Rules:
- Do not implement order placement.
- Do not connect wallets.
- Do not request private exchange API keys.
- Do not use Buy/Sell/Strong Buy language.
- Do not copy large blocks of code from trading bot repositories.
- If borrowing logic from a repository, clearly state the source and adapt it into our own architecture.
- Keep indicator calculations behind src/lib/indicators.
- Keep exchange access behind src/lib/exchanges.
- Keep scoring and product-specific signal logic inside src/lib/scanner.
```

---

## Codex Task: Evaluate Dependencies Before Installing

Before installing any external library, Codex should report:

```txt
1. Package name
2. Why it is needed
3. Which internal wrapper will isolate it
4. License
5. Whether it introduces trading/order/security risk
```

Example:

```txt
Package: lightweight-charts
Need: interactive candlestick chart rendering
Wrapper: src/components/chart/CandleChart.tsx
License: Apache-2.0
Trading/security risk: none
```

---

## MVP Dependency Decision

Use this by default:

```json
{
  "dependencies": {
    "lightweight-charts": "latest",
    "technicalindicators": "latest",
    "@tanstack/react-table": "latest",
    "@tanstack/react-query": "latest",
    "p-limit": "latest"
  }
}
```

Do not add:

```txt
ccxt
bullmq
prisma
telegram bot libraries
exchange private API clients
wallet libraries
```

until a later phase explicitly requires them.

---

## Final Position

Yes, we should use existing GitHub/open-source code.

But we should use it as:

```txt
mature libraries + reference patterns
```

not as:

```txt
forked trading bot base
```

The best implementation path is:

```txt
Own Next.js scanner architecture
+ lightweight-charts for charts
+ technicalindicators/trading-signals for indicators
+ Binance public API adapter
+ TanStack Table for scanner UI
+ p-limit and cache for stability
```

This gives us speed without inheriting the wrong product structure.
