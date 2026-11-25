# KAIZZ — Real Market Data Terminal

A public, single-page, read-only market data terminal for the **KAIZZ** brand:
an obsidian-and-gold dashboard with real gold and Bitcoin prices, real OHLC candles,
a calculated MA-13 and a live candlestick stream. No simulated prices, no buy/sell
signals, no order execution.

**Live site:** https://xiangpav.github.io/kaizzfx/

## Data sources

| Asset | Data | Provider |
| --- | --- | --- |
| BTCUSDT | 1m/5m/15m/30m/1h candles, 24h stats, live kline stream | Binance public market-data endpoints |
| XAU/USD | Live spot price | Gold API — `https://api.gold-api.com/price/XAU` |
| XAU/USD | Historical OHLC candles (optional) | Twelve Data — key entered in the page |

The Binance and Gold API feeds need no account or key. For gold **candles**, paste a
free Twelve Data API key into the key bar on the XAUUSD chart and press
“Load Gold Candles”. The key stays in the browser tab — it is not stored, logged or
committed. Gold spot price works without a key.

## Features

- Interactive 3D core (custom canvas renderer, drag to rotate).
- Real candlestick desk with MA-13, timeframes M5/M15/M30/H1 and pair switch.
- Live BTCUSDT stream plus 24-hour high/low/change.
- Feed status (LIVE / DELAYED / OFFLINE) derived from real provider timestamps.
- No fabricated candles: when a provider is unavailable the chart stays empty and
  says so.

## Run locally

The site is fully static — `index.html`, `style.css`, `script.js`:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Deploy

GitHub Pages: **Settings → Pages → Deploy from a branch → main / root**. Any static
host (Netlify, Vercel, Cloudflare Pages) also works — upload the three files.

## Disclaimer

KAIZZ is a read-only educational market-data display. Prices and candles come from
external providers and may be delayed, incomplete or unavailable. The dashboard does
not connect to a broker, place orders, or provide trading recommendations. Nothing
here is financial advice.
# KAIZZ — Luxury Neural Trading Terminal

A public, single-page front-end for the **KAIZZ** brand: an obsidian-and-gold AI trading
terminal concept with an interactive 3D neural core, a live-style candlestick desk, a
BUY / SELL signal engine (entry, stop loss, TP1–TP3), a signal vault and a position-size
calculator.

> **Important:** this is a design demonstration. Every price, scan, signal, win rate and
> performance figure is simulated in the browser. There is no broker, exchange or MT5
> connection, no order execution, and nothing here is financial advice.

## Live site

The site is fully static — `index.html`, `style.css` and `script.js`. Open `index.html`
directly, or serve the folder:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

Deploying publicly is a matter of enabling GitHub Pages for the repository
(**Settings → Pages → Deploy from a branch → main / root**) or dropping the three files on
Netlify, Vercel, Cloudflare Pages or any static host.

## Features

- **Interactive 3D core** — custom canvas renderer: rotating gold icosahedron with
  translucent facet fills, orbit rings with travelling sparks, particle shell, drag-to-rotate
  with inertia. No Three.js dependency.
- **Live-style chart desk** — generated OHLC candles, MA-13 equilibrium line, live price tag,
  animated dashes, and an AI scan overlay that stamps entry, stop and TP zones.
- **Signal engine** — direction from price vs MA-13, MA slope, RSI(14) and momentum; stop and
  targets projected from ATR. Confidence and rationale update per pair and timeframe.
- **Vision decoder** — upload an MT5/TradingView screenshot (analysed locally, never uploaded)
  or load a generated sample, then watch level mapping and the resulting signal.
- **Signal vault** — a simulated ledger of recent model output with pip results.
- **Risk engine** — account balance, risk %, stop distance and instrument → lot size, risk
  amount and mandate gauge.
- **Luxury UI** — bespoke CSS (no framework), gold gradient typography, glass panels,
  dust field, grain, reveal-on-scroll and count-up metrics, fully responsive, with
  reduced-motion support.

## Structure

```
index.html   markup, sections and inline SVG crest
style.css    design system, layout, animation
script.js    market simulation, chart renderer, 3D core, scanner, vault, risk engine
```

## Notes for a production build

To make signals genuinely real, move data fetching behind a secure backend and use a
licensed market-data provider. Never expose broker/API credentials in browser JavaScript.
Validate licensing, timestamps and delayed/live status, and keep the risk disclaimer
visible before displaying any live feed.
