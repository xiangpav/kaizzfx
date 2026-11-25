# KAIZZ — Real Market Data Terminal

A public, single-page, read-only market data terminal for the **KAIZZ** brand:
an obsidian-and-gold dashboard with real gold and Bitcoin prices, real OHLC candles,
a calculated MA-13, a live candlestick stream and an Easy Scan panel that derives
entry, stop-loss and 1R/2R/3R targets from those real candles. No simulated prices,
no order execution.

**Live site:** https://xiangpav.github.io/kaizzfx/

## Data sources

| Asset | Data | Provider |
| --- | --- | --- |
| BTCUSDT | 5m/15m/30m/1h candles, 24h stats, live kline stream | Binance public market-data endpoints |
| XAU/USD | 5m/15m/30m/1h candles, 24h stats, live kline stream | Binance PAXGUSDT — PAX Gold, a gold-backed token that tracks the XAU/USD spot price |
| XAU/USD | Live spot price (native mode) | Gold API — `https://api.gold-api.com/price/XAU` |
| XAU/USD | Historical OHLC candles (native mode, optional) | Twelve Data — key entered in the page |

All default feeds need no account or key. Gold candles load automatically from
Binance PAXGUSDT. For **native** XAU/USD candles, paste a free Twelve Data API key
into the key bar on the XAUUSD chart and press “Load Gold Candles”; the key stays in
the browser tab — it is not stored, logged or committed. If the key fails, the site
falls back to the Binance gold candles automatically.

## Features

- Interactive 3D core (custom canvas renderer, drag to rotate).
- Real candlestick desk with MA-13, timeframes M5/M15/M30/H1 and pair switch.
- Live BTCUSDT stream plus 24-hour high/low/change.
- Feed status (LIVE / DELAYED / OFFLINE) derived from real provider timestamps.
- Easy Scan: BUY / SELL / WAIT with entry, stop loss and TP1-TP3, drawn on the chart.
- No fabricated candles: when a provider is unavailable the chart stays empty and
  says so.

## Easy Scan methodology

Easy Scan is a fixed, transparent rule set, recomputed on every candle update:

1. **Side** — BUY when the latest close is above the MA-13, SELL when it is below.
   If the close sits within 0.15 x ATR(14) of the MA-13 the panel shows **WAIT**
   and no levels.
2. **Entry** — the latest real close.
3. **Stop loss** — 1.5 x ATR(14) away from entry, so the stop scales with current
   volatility instead of jumping after a sharp move.
4. **Targets** — TP1 / TP2 / TP3 at 1R / 2R / 3R, where R is entry-to-stop distance.

The levels are illustrative arithmetic on real prices, not a recommendation, and the
site never connects to a broker or places orders.

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
external providers and may be delayed, incomplete or unavailable. Easy Scan is a
rule-based technical readout of the chart, not a recommendation. The dashboard does
not connect to a broker or place orders. Nothing here is financial advice.
