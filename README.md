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
