# KaizzFX

A responsive, dark luxury-style trading workspace branded with the KaizzFX name and neon-green visual identity.

## What is included

- `index.html` — standalone responsive dashboard with a decorative sample chart, market watchlist placeholders, and an interactive trade-plan calculator.
- The calculator uses values entered by the visitor to work out illustrative entry, stop-loss (SL), and take-profit (TP) levels for a chosen Buy/Long or Sell/Short direction.
- Clear offline/demo labels: this site does **not** connect to an exchange, receive live prices, or generate AI trading signals.

## Run locally

Open `index.html` in a browser. No build tools or dependencies are required.

## Publish with GitHub Pages

In the repository, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. GitHub Pages will publish the static site after its deployment workflow completes.

## Important

The chart is decorative and market cards intentionally show no prices. Calculator output is based only on user-supplied assumptions and is for demonstration and educational planning; it is not financial advice, a recommendation, or a promise of results. Trading involves risk, including loss of capital.

The provided logo image was not available as a repository file to embed in this change, so the dashboard currently uses a small KaizzFX-themed vector mark and text wordmark. Replace the inline `.brand-mark` SVG in `index.html` with the supplied logo asset when it is added to the repository.
