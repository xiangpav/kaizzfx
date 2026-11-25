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
