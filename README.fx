#KAIZZ FX AI — real Market Scanner

A responsive, original trading-dashboard-style learning project for XAUUSD and BTCUSD.

## Run on Windows 11
1. Download and extract `KAIZZ-FX-AI.zip`.
2. Open the extracted `kaizz-fx-ai` folder.
3. Double-click `index.html` to open it in Chrome or Edge.
4. Choose XAUUSD or BTCUSD, select a timeframe, then click **SCAN MARKET**.

## Important
- The chart and prices are generated demo data, not live quotes.
- The scanner demonstrates a simple moving-average + momentum + RSI concept.
- It does not connect to MT5, a broker, or an exchange.
- It does not place orders or provide real trading instructions.
- The confidence score is an educational heuristic, not a probability of profit.

## Files
- `index.html` — dashboard structure
- `style.css` — responsive dark premium design
- `script.js` — real chart, asset selector, and scanner logic

## Next development stage
To add genuine market data, connect a reputable market-data API through a secure backend. Do not expose private API keys in browser JavaScript. Validate licensing, rate limits, timestamps, and delayed/live status before displaying any feed.



