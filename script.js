/* ==========================================================================
   KAIZZ — Real Market Data Terminal
   Read-only market information. No trade signals or order execution.
   ========================================================================== */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    pair: "XAUUSD",
    timeframe: "M15",
    candles: [],
    ma: true,
    lastPrice: null,
    change24h: null,
    lastUpdate: null,
    ws: null,
    reconnectTimer: null,
    btcTickerTimer: null,
    reconnectDelay: 2000,
    goldApiKey: "",
    goldNative: false,
    goldQuoteTimer: null,
    resizeObserver: null
  };

  const BINANCE_API = "https://data-api.binance.vision/api/v3";

  const TIMEFRAMES = {
    M5: { binance: "5m", twelve: "5min" },
    M15: { binance: "15m", twelve: "15min" },
    M30: { binance: "30m", twelve: "30min" },
    H1: { binance: "1h", twelve: "1h" }
  };

  const DECIMALS = { XAUUSD: 2, BTCUSDT: 2 };
  const fmt = (value, pair = state.pair) => {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString("en-US", {
      minimumFractionDigits: DECIMALS[pair] ?? 2,
      maximumFractionDigits: DECIMALS[pair] ?? 2
    });
  };

  const toast = (message) => {
    const msg = $("#toast-msg");
    const el = $("#toast");
    if (!msg || !el) return;
    msg.textContent = message;
    el.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove("is-visible"), 3200);
  };

  function setStatus(status, message = "") {
    const badge = $("#market-status");
    const panel = $("#panel-status");
    const header = $("#header-feed-status");
    [badge, panel, header].filter(Boolean).forEach((el) => {
      el.textContent = status;
      el.classList.remove("is-live", "is-delayed", "is-offline");
      el.classList.add(`is-${status.toLowerCase()}`);
    });
    const note = $("#panel-note");
    if (note && message) note.textContent = message;
  }

  function startClock() {
    const el = $("#utc-clock");
    const tick = () => {
      if (el) el.textContent = new Date().toISOString().slice(11, 19) + " UTC";
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function initNav() {
    const header = $("#site-header");
    const burger = $("#nav-burger");
    const links = $("#nav-links");
    if (!header || !burger || !links) return;

    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$("a", links).forEach((a) => a.addEventListener("click", () => {
      links.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  function initReveal() {
    const items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const delay = Number(entry.target.dataset.revealDelay || 0);
        window.setTimeout(() => entry.target.classList.add("is-in"), delay);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
  }

  function movingAverage(period = 13) {
    if (state.candles.length < period) return null;
    const closes = state.candles.slice(-period).map((c) => c.c);
    return closes.reduce((sum, n) => sum + n, 0) / period;
  }

  function updateMarketUI() {
    const pair = state.pair;
    const price = state.lastPrice;
    const ma = movingAverage(13);
    const change = state.change24h;
    const priceText = fmt(price, pair);
    const maText = fmt(ma, pair);

    $("#chart-pair").textContent = pair;
    $("#chart-tf").textContent = state.timeframe;
    $("#chart-price").textContent = priceText;
    $("#chart-ma").textContent = maText;
    $("#chart-change").textContent = change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    $("#chart-change").className = "chart-head__chg " + (change == null ? "" : change >= 0 ? "txt-up" : "txt-down");

    $("#panel-pair").textContent = `${pair} · ${state.timeframe}`;
    $("#panel-price").textContent = priceText;
    $("#panel-change").textContent = `24H CHANGE: ${change == null ? "Not supplied by this feed" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}`;
    $("#panel-ma").textContent = maText;
    $("#panel-relation").textContent = ma == null || price == null ? "Waiting for 13 candles" : price >= ma ? "Above MA-13" : "Below MA-13";
    $("#hud-bias").textContent = "DATA";
    $("#hud-bias").className = "txt-gold";
    $("#hud-delta").textContent = ma == null || price == null ? "—" : (price - ma >= 0 ? "+" : "") + (price - ma).toFixed(2);

    const source = pair === "BTCUSDT"
      ? "Binance public market data"
      : state.goldNative
        ? "Gold API spot · Twelve Data candles"
        : "Binance PAXGUSDT · gold-backed XAU proxy";
    $("#data-source").textContent = source;
    $("#panel-source").textContent = source;
    $("#panel-updated").textContent = state.lastUpdate ? new Date(state.lastUpdate).toLocaleTimeString() : "Waiting for data";

    const track = $("#ticker-track");
    if (track) {
      const gold = pair === "XAUUSD" ? `${pair} ${priceText}` : "XAUUSD —";
      const btc = pair === "BTCUSDT" ? `${pair} ${priceText}` : "BTCUSDT —";
      const content = `<span class="ticker-item"><b>${gold}</b></span><span class="ticker-item"><b>${btc}</b></span>`;
      track.innerHTML = content + content;
    }
    chart.invalidate();
  }

  function setNoCandles(message) {
    state.candles = [];
    chart.invalidate();
    $("#panel-note").textContent = message;
    $("#chart-ma").textContent = "—";
    $("#panel-ma").textContent = "—";
    $("#panel-relation").textContent = "Unavailable";
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function parseBinanceKlines(rows) {
    return rows.map((r) => ({
      t: Number(r[0]),
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c: Number(r[4]),
      v: Number(r[5])
    }));
  }

  async function fetchBinanceSeries(symbol, interval) {
    const [rows, ticker] = await Promise.all([
      fetchJson(`${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=120`),
      fetchJson(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`)
    ]);
    state.candles = parseBinanceKlines(rows);
    state.lastPrice = Number(ticker.lastPrice);
    state.change24h = Number(ticker.priceChangePercent);
    state.lastUpdate = Date.now();
    updateMarketUI();
  }

  function startTickerPoll(symbol, pairName) {
    if (state.btcTickerTimer) window.clearInterval(state.btcTickerTimer);
    state.btcTickerTimer = window.setInterval(async () => {
      if (state.pair !== pairName || document.hidden) return;
      try {
        const fresh = await fetchJson(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
        state.change24h = Number(fresh.priceChangePercent);
        updateMarketUI();
      } catch {}
    }, 60000);
  }

  async function loadBitcoin() {
    closeSocket();
    setStatus("DELAYED", "Loading Binance public market data…");
    const interval = TIMEFRAMES[state.timeframe].binance;
    try {
      await fetchBinanceSeries("BTCUSDT", interval);
      setStatus("DELAYED", "Connecting to the live Binance candle stream…");
      startTickerPoll("BTCUSDT", "BTCUSDT");
      connectBinanceSocket("btcusdt", interval, "BTCUSDT");
      $("#panel-note").textContent = "Bitcoin candles, 24-hour statistics and the live candle stream come from Binance public market data. No simulated prices.";
    } catch (error) {
      setStatus("OFFLINE", `Binance data could not be loaded: ${error.message}. Check your connection and try again.`);
      setNoCandles("BTCUSDT market data is currently unavailable. No sample candles are shown.");
    }
  }

  function connectBinanceSocket(symbol, interval, pairName) {
    closeSocket();
    const url = `wss://data-stream.binance.vision/ws/${symbol}@kline_${interval}`;
    try {
      const socket = new WebSocket(url);
      state.ws = socket;
      socket.addEventListener("open", () => {
        state.reconnectDelay = 2000;
      });
      socket.addEventListener("message", (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        const k = message.k;
        if (!k) return;
        const candle = {
          t: Number(k.t), o: Number(k.o), h: Number(k.h),
          l: Number(k.l), c: Number(k.c), v: Number(k.v)
        };
        const last = state.candles[state.candles.length - 1];
        if (last && last.t === candle.t) state.candles[state.candles.length - 1] = candle;
        else state.candles.push(candle);
        if (state.candles.length > 120) state.candles.shift();
        state.lastPrice = candle.c;
        state.lastUpdate = Date.now();
        updateMarketUI();
        setStatus("LIVE");
      });
      socket.addEventListener("close", () => {
        if (state.ws !== socket) return;
        scheduleReconnect(symbol, interval, pairName);
      });
      socket.addEventListener("error", () => {
        setStatus("DELAYED", "Binance WebSocket connection interrupted. Attempting to reconnect…");
      });
    } catch (error) {
      scheduleReconnect(symbol, interval, pairName);
    }
  }

  function scheduleReconnect(symbol, interval, pairName) {
    if (state.pair !== pairName || state.reconnectTimer) return;
    setStatus("DELAYED", "Live stream disconnected. Reconnecting…");
    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      connectBinanceSocket(symbol, interval, pairName);
    }, state.reconnectDelay);
    state.reconnectDelay = Math.min(state.reconnectDelay * 2, 30000);
  }

  function closeSocket() {
    if (state.reconnectTimer) {
      window.clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }
    if (state.ws) {
      const old = state.ws;
      state.ws = null;
      old.onclose = null;
      try { old.close(); } catch {}
    }
  }

  async function fetchGoldQuote() {
    const data = await fetchJson("https://api.gold-api.com/price/XAU");
    const price = Number(data.price);
    if (!Number.isFinite(price)) throw new Error("Gold API returned no usable price");
    state.lastPrice = price;
    state.lastUpdate = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now();

    // Update the currently forming candle with the actual spot quote.
    const last = state.candles[state.candles.length - 1];
    if (last) {
      last.c = price;
      last.h = Math.max(last.h, price);
      last.l = Math.min(last.l, price);
    }
    updateMarketUI();
    setStatus("LIVE", "Gold API spot quote is updating. Candle history is supplied separately by Twelve Data and may be delayed.");
  }

  async function loadGoldCandles() {
    const key = state.goldApiKey.trim();
    if (!key) {
      setNoCandles("Gold spot price is live. To show genuine historical XAUUSD OHLC candles, enter a Twelve Data API key and press “Load Gold Candles”. No generated candles are displayed.");
      return false;
    }
    setStatus("DELAYED", "Loading XAUUSD historical OHLC candles from Twelve Data…");
    const interval = TIMEFRAMES[state.timeframe].twelve;
    const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${encodeURIComponent(interval)}&outputsize=120&apikey=${encodeURIComponent(key)}`;
    try {
      const result = await fetchJson(url);
      if (!Array.isArray(result.values)) {
        throw new Error(result.message || result.status || "Provider did not return candle values");
      }
      state.candles = result.values.slice().reverse().map((v) => ({
        t: Date.parse(v.datetime + "Z"),
        o: Number(v.open), h: Number(v.high), l: Number(v.low), c: Number(v.close)
      })).filter((c) => [c.o, c.h, c.l, c.c].every(Number.isFinite));
      if (state.candles.length < 13) throw new Error("Provider returned fewer than 13 valid candles");
      state.lastUpdate = Date.now();
      updateMarketUI();
      setStatus("DELAYED", "XAUUSD spot quote is live; historical candle bars are from Twelve Data and may be delayed by its plan.");
      $("#panel-note").textContent = "Gold spot price comes from Gold API. Chart OHLC history comes from Twelve Data. The latest candle is updated with the live spot quote when available.";
      return true;
    } catch (error) {
      setNoCandles(`XAUUSD candle history could not be loaded: ${error.message}. The spot price feed can still work independently.`);
      setStatus("DELAYED", "Gold spot quote and historical candle feed are separate connections.");
      return false;
    }
  }

  async function loadGold() {
    closeSocket();
    if (state.btcTickerTimer) window.clearInterval(state.btcTickerTimer);
    state.btcTickerTimer = null;
    if (state.goldQuoteTimer) window.clearInterval(state.goldQuoteTimer);
    state.goldQuoteTimer = null;
    state.goldNative = Boolean(state.goldApiKey.trim());

    if (!state.goldNative) {
      await loadGoldProxy();
      return;
    }

    setStatus("DELAYED", "Connecting to Gold API…");
    try {
      await fetchGoldQuote();
    } catch (error) {
      setStatus("OFFLINE", `Gold API price is unavailable: ${error.message}`);
      state.lastPrice = null;
      state.change24h = null;
      updateMarketUI();
    }
    const nativeOk = await loadGoldCandles();
    if (!nativeOk) {
      state.goldNative = false;
      toast("Twelve Data key failed — loading Binance gold candles");
      await loadGoldProxy();
      return;
    }
    state.goldQuoteTimer = window.setInterval(async () => {
      if (state.pair !== "XAUUSD" || document.hidden) return;
      try { await fetchGoldQuote(); }
      catch (error) { setStatus("OFFLINE", `Gold API quote failed: ${error.message}`); }
    }, 30000);
  }

  async function loadGoldProxy() {
    closeSocket();
    const interval = TIMEFRAMES[state.timeframe].binance;
    setStatus("DELAYED", "Loading real gold market candles from Binance…");
    try {
      await fetchBinanceSeries("PAXGUSDT", interval);
      setStatus("DELAYED", "Gold candles loaded. Connecting to the live Binance candle stream…");
      $("#panel-note").textContent = "Gold chart uses Binance PAXGUSDT — PAX Gold, a gold-backed token that tracks the XAU/USD spot price. Candles and MA-13 are computed from real exchange closes. No fabricated bars. A Twelve Data key is optional for native XAU/USD candles.";
      startTickerPoll("PAXGUSDT", "XAUUSD");
      connectBinanceSocket("paxgusdt", interval, "XAUUSD");
    } catch (error) {
      setStatus("OFFLINE", `Gold market data could not be loaded: ${error.message}. Check your connection and try again.`);
      setNoCandles("XAUUSD market data is currently unavailable. No sample candles are shown.");
    }
  }

  async function loadCurrentMarket() {
    if (state.pair === "BTCUSDT") {
      if (state.goldQuoteTimer) window.clearInterval(state.goldQuoteTimer);
      state.goldQuoteTimer = null;
      await loadBitcoin();
    } else {
      await loadGold();
    }
  }

  const chart = (() => {
    const canvas = $("#candle-canvas");
    const stage = $("#chart-stage");
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let dirty = true;

    function resize() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
      draw();
    }

    function draw() {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const left = 12, right = 66, top = 22, bottom = 26;
      const plotW = Math.max(10, width - left - right);
      const plotH = Math.max(10, height - top - bottom);
      const candles = state.candles;

      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#08080b");
      bg.addColorStop(1, "#050507");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      if (!candles.length) {
        ctx.fillStyle = "rgba(212,175,55,.85)";
        ctx.font = "12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(state.pair === "XAUUSD" ? "WAITING FOR REAL GOLD MARKET CANDLES" : "WAITING FOR REAL BTCUSDT CANDLES", width / 2, height / 2);
        return;
      }

      let min = Math.min(...candles.map((c) => c.l));
      let max = Math.max(...candles.map((c) => c.h));
      const pad = (max - min) * 0.09 || Math.max(Math.abs(max) * 0.001, 0.01);
      min -= pad;
      max += pad;
      const y = (price) => top + ((max - price) / (max - min)) * plotH;

      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 5; i++) {
        const gy = top + (plotH / 5) * i;
        ctx.strokeStyle = "rgba(212,175,55,.08)";
        ctx.beginPath();
        ctx.moveTo(left, gy);
        ctx.lineTo(width - right, gy);
        ctx.stroke();
        const p = max - ((max - min) / 5) * i;
        ctx.fillStyle = "rgba(155,151,140,.7)";
        ctx.fillText(fmt(p), width - right + 7, gy);
      }
      for (let i = 0; i <= 8; i++) {
        const gx = left + (plotW / 8) * i;
        ctx.strokeStyle = "rgba(212,175,55,.035)";
        ctx.beginPath();
        ctx.moveTo(gx, top);
        ctx.lineTo(gx, height - bottom);
        ctx.stroke();
      }

      const slot = plotW / candles.length;
      const bodyW = Math.max(2, Math.min(10, slot * 0.58));
      candles.forEach((c, i) => {
        const x = left + slot * i + slot / 2;
        const up = c.c >= c.o;
        const color = up ? "#3ddc97" : "#ff6b81";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y(c.h));
        ctx.lineTo(x, y(c.l));
        ctx.stroke();
        const yo = y(c.o), yc = y(c.c);
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW, Math.max(1.5, Math.abs(yc - yo)));
      });

      if (state.ma && candles.length >= 13) {
        ctx.save();
        ctx.strokeStyle = "rgba(243,229,171,.95)";
        ctx.lineWidth = 1.7;
        ctx.shadowColor = "rgba(212,175,55,.55)";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        let started = false;
        for (let i = 12; i < candles.length; i++) {
          const avg = candles.slice(i - 12, i + 1).reduce((sum, c) => sum + c.c, 0) / 13;
          const px = left + slot * i + slot / 2;
          if (!started) { ctx.moveTo(px, y(avg)); started = true; }
          else ctx.lineTo(px, y(avg));
        }
        ctx.stroke();
        ctx.restore();
      }

      const last = candles[candles.length - 1];
      ctx.strokeStyle = "rgba(212,175,55,.75)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(left, y(last.c));
      ctx.lineTo(width - right, y(last.c));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#d4af37";
      ctx.fillRect(width - right + 2, y(last.c) - 9, right - 4, 18);
      ctx.fillStyle = "#08080b";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.fillText(fmt(last.c), width - right + 6, y(last.c));
    }

    return {
      init() {
        resize();
        if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
        else window.addEventListener("resize", resize);
      },
      invalidate() { dirty = true; draw(); }
    };
  })();

  function initControls() {
    $$("#pair-selector [data-pair]").forEach((button) => {
      button.addEventListener("click", async () => {
        $$("#pair-selector [data-pair]").forEach((b) => b.classList.toggle("is-active", b === button));
        state.pair = button.dataset.pair;
        $("#gold-keybar").classList.toggle("is-hidden", state.pair !== "XAUUSD");
        state.candles = [];
        state.lastPrice = null;
        state.change24h = null;
        updateMarketUI();
        await loadCurrentMarket();
      });
    });

    $$("#tf-selector [data-tf]").forEach((button) => {
      button.addEventListener("click", async () => {
        $$("#tf-selector [data-tf]").forEach((b) => b.classList.toggle("is-active", b === button));
        state.timeframe = button.dataset.tf;
        await loadCurrentMarket();
      });
    });

    $("#ma-toggle").addEventListener("click", () => {
      state.ma = !state.ma;
      const button = $("#ma-toggle");
      button.classList.toggle("is-on", state.ma);
      button.setAttribute("aria-pressed", String(state.ma));
      button.querySelector("b").textContent = state.ma ? "ON" : "OFF";
      chart.invalidate();
    });

    $("#connect-gold-key").addEventListener("click", async () => {
      state.goldApiKey = $("#gold-api-key").value.trim();
      if (!state.goldApiKey) {
        toast("Enter your Twelve Data key first");
        return;
      }
      if (state.pair !== "XAUUSD") {
        toast("Select XAUUSD to load gold candles");
        return;
      }
      await loadGoldCandles();
    });

    $("#scan-btn").addEventListener("click", loadCurrentMarket);
    $("#nav-scan").addEventListener("click", () => {
      $("#terminal").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      loadCurrentMarket();
    });
  }

  function initTickerStatus() {
    const feed = $("#header-feed-status");
    if (feed) feed.textContent = "MARKET FEEDS";
  }

  function hideUnusedDemoUI() {
    const visionButton = $("#tab-vision");
    if (visionButton) visionButton.remove();
    const oldVision = $("#mode-vision");
    if (oldVision) oldVision.remove();
    const zoneBadge = $("#zone-badge");
    if (zoneBadge) zoneBadge.remove();
    const scanOverlay = $("#scan-overlay");
    if (scanOverlay) scanOverlay.remove();
  }

  function boot() {
    startClock();
    initNav();
    initReveal();
    initTickerStatus();
    hideUnusedDemoUI();
    chart.init();
    initControls();
    core.init();
    dust.init();

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();

    const preloader = $("#preloader");
    const finish = () => window.setTimeout(() => preloader?.classList.add("is-done"), 350);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    window.setTimeout(() => preloader?.classList.add("is-done"), 3500);

    loadCurrentMarket();
  }

const core = (() => {
    const canvas = $("#core-canvas");
    const stage = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const coordsEl = $("#core-coords");

    // Icosahedron
    const phi = (1 + Math.sqrt(5)) / 2;
    const raw = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];
    const norm = Math.sqrt(1 + phi * phi);
    const verts = raw.map(([x, y, z]) => [x / norm, y / norm, z / norm]);
    const edges = [];
    const adjacent = (i, j) =>
      Math.hypot(
        verts[i][0] - verts[j][0],
        verts[i][1] - verts[j][1],
        verts[i][2] - verts[j][2]
      ) < 1.2;

    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (adjacent(i, j)) edges.push([i, j]);
      }
    }

    const faces = [];
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (!adjacent(i, j)) continue;
        for (let k = j + 1; k < verts.length; k++) {
          if (adjacent(i, k) && adjacent(j, k)) faces.push([i, j, k]);
        }
      }
    }

    // rings of points
    const rings = [
      { tiltX: 0.44, tiltZ: 0.18, radius: 1.38, speed: 0.25 },
      { tiltX: -0.62, tiltZ: 0.62, radius: 1.62, speed: -0.18 },
    ];

    const stars = Array.from({ length: 46 }, () => {
      const r = rand(1.15, 1.9);
      const theta = rand(0, Math.PI * 2);
      const phiA = Math.acos(rand(-1, 1));
      return {
        p: [
          r * Math.sin(phiA) * Math.cos(theta),
          r * Math.cos(phiA),
          r * Math.sin(phiA) * Math.sin(theta),
        ],
        tw: rand(0, Math.PI * 2),
        s: rand(0.8, 2),
      };
    });

    let W = 0;
    let H = 0;
    let dpr = 1;
    let rotX = -0.35;
    let rotY = 0.5;
    let velX = 0;
    let velY = 0.0032;
    let dragging = false;
    let lastPos = { x: 0, y: 0 };
    let glow = 0;
    let visible = true;

    function resize() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p, cx, cy, scale) {
      const [x, y, z] = p;
      // rotate Y
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      // rotate X
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const fov = 3.1;
      const persp = fov / (fov + z2);
      return {
        x: cx + x1 * scale * persp,
        y: cy + y1 * scale * persp,
        z: z2,
        s: persp,
      };
    }

    function colorForDepth(z) {
      // z in about [-1.9, 1.9], front is negative (closer)
      const t = clamp((1 - (z + 1.6) / 3.2), 0, 1);
      const near = [255, 246, 204];
      const far = [120, 92, 16];
      const c = near.map((v, i) => Math.round(lerp(far[i], v, t)));
      return `rgba(${c[0]},${c[1]},${c[2]},${0.2 + t * 0.8})`;
    }

    function draw(now) {
      if (!W || !H) return;
      const t = now / 1000;
      const cx = W / 2;
      const cy = H / 2 + 4;
      const scale = Math.min(W, H) * 0.34;

      ctx.clearRect(0, 0, W, H);

      // soft core glow
      const glowR = scale * (1.5 + Math.sin(t * 1.2) * 0.06);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      g.addColorStop(0, "rgba(212,175,55,0.18)");
      g.addColorStop(0.45, "rgba(212,175,55,0.06)");
      g.addColorStop(1, "rgba(212,175,55,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // ring polylines
      rings.forEach((ring, ri) => {
        const pts = [];
        const segments = 96;
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2 + t * ring.speed;
          let p = [Math.cos(a) * ring.radius, Math.sin(a) * ring.radius, 0];
          // tilt Z
          const cz = Math.cos(ring.tiltZ);
          const sz = Math.sin(ring.tiltZ);
          p = [p[0] * cz - p[1] * sz, p[0] * sz + p[1] * cz, p[2]];
          // tilt X
          const cxr = Math.cos(ring.tiltX);
          const sxr = Math.sin(ring.tiltX);
          p = [p[0], p[1] * cxr - p[2] * sxr, p[1] * sxr + p[2] * cxr];
          pts.push(project(p, cx, cy, scale));
        }
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.strokeStyle = ri === 0 ? "rgba(212,175,55,0.3)" : "rgba(243,229,171,0.2)";
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // travelling spark on the orbit
        const spark = pts[Math.floor((t * 40 + ri * 47) % segments)];
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,246,204,0.95)";
        ctx.shadowColor = "rgba(212,175,55,0.95)";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // solid translucent faces, back to front
      const projected = verts.map((v) => project(v, cx, cy, scale));
      const faceList = faces
        .map((f) => ({
          f,
          z: (projected[f[0]].z + projected[f[1]].z + projected[f[2]].z) / 3,
        }))
        .sort((a, b) => b.z - a.z);

      faceList.forEach(({ f, z }) => {
        const tDepth = clamp(1 - (z + 1.6) / 3.2, 0, 1);
        ctx.beginPath();
        ctx.moveTo(projected[f[0]].x, projected[f[0]].y);
        ctx.lineTo(projected[f[1]].x, projected[f[1]].y);
        ctx.lineTo(projected[f[2]].x, projected[f[2]].y);
        ctx.closePath();
        ctx.fillStyle = `rgba(212,175,55,${0.018 + tDepth * 0.085})`;
        ctx.fill();
      });

      // edges sorted by depth (back to front)
      const drawEdges = edges
        .map(([a, b]) => ({
          a: projected[a],
          b: projected[b],
          z: (projected[a].z + projected[b].z) / 2,
        }))
        .sort((p, q) => q.z - p.z);

      drawEdges.forEach(({ a, b, z }) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = colorForDepth(z);
        ctx.lineWidth = clamp(1.5 - z * 0.28, 0.6, 2);
        ctx.stroke();
      });

      // vertices
      projected.forEach((p) => {
        const alpha = clamp(0.95 - (p.z + 1.6) * 0.28, 0.15, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, p.s * 1.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,246,204,${alpha})`;
        ctx.shadowColor = "rgba(212,175,55,0.9)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // inner nucleus
      const pulse = 1 + Math.sin(t * 2.1) * 0.12;
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.22 * pulse);
      ng.addColorStop(0, "rgba(255,250,225,0.95)");
      ng.addColorStop(0.4, "rgba(226,190,80,0.55)");
      ng.addColorStop(1, "rgba(212,175,55,0)");
      ctx.fillStyle = ng;
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 0.26 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // stars
      stars.forEach((s) => {
        const p = project(s.p, cx, cy, scale);
        const tw = 0.35 + Math.abs(Math.sin(t * 1.5 + s.tw)) * 0.65;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.s * p.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(243,229,171,${tw * 0.7})`;
        ctx.fill();
      });

      coordsEl.textContent = `X: ${(rotX * 57.29).toFixed(2)} Y: ${(rotY * 57.29).toFixed(2)}`;
    }

    function loop(now) {
      if (visible) {
        if (!dragging && !reduceMotion) {
          velX *= 0.94;
          velY = velY * 0.94 + 0.0032 * 0.06;
          rotY += velY;
          rotX += velX;
          rotX = clamp(rotX, -1.1, 1.1);
        }
        draw(now);
      }
      requestAnimationFrame(loop);
    }

    function initEvents() {
      const down = (e) => {
        dragging = true;
        const p = e.touches ? e.touches[0] : e;
        lastPos = { x: p.clientX, y: p.clientY };
        canvas.style.cursor = "grabbing";
      };
      const move = (e) => {
        if (!dragging) return;
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - lastPos.x;
        const dy = p.clientY - lastPos.y;
        lastPos = { x: p.clientX, y: p.clientY };
        rotY += dx * 0.008;
        rotX = clamp(rotX + dy * 0.006, -1.1, 1.1);
        velY = dx * 0.0009;
        velX = dy * 0.0006;
        if (e.cancelable && e.touches) e.preventDefault();
      };
      const up = () => {
        dragging = false;
        canvas.style.cursor = "grab";
      };

      canvas.addEventListener("mousedown", down);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      canvas.addEventListener("touchstart", down, { passive: true });
      canvas.addEventListener("touchmove", move, { passive: false });
      window.addEventListener("touchend", up);

      canvas.addEventListener("pointerenter", () => {
        if (!dragging) canvas.style.cursor = "grab";
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          (entries) => entries.forEach((en) => (visible = en.isIntersecting)),
          { threshold: 0.05 }
        ).observe(canvas);
      }
      document.addEventListener("visibilitychange", () => {
        visible = !document.hidden;
      });
    }

    return {
      init() {
        resize();
        new ResizeObserver(resize).observe(stage);
        initEvents();
        requestAnimationFrame(loop);
      },
    };
  })();

  /* ------------------------------------------------------------------ *
   *  Gold dust background
   * ------------------------------------------------------------------ */
  
const dust = (() => {
    const canvas = $("#dust-canvas");
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;
    let dpr = 1;
    let particles = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      const count = Math.min(70, Math.round(W / 22));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(0.5, 2),
        vy: rand(-0.12, -0.35),
        vx: rand(-0.08, 0.08),
        a: rand(0.1, 0.55),
        ph: rand(0, Math.PI * 2),
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -6) {
          p.y = H + 6;
          p.x = Math.random() * W;
        }
        if (p.x < -6) p.x = W + 6;
        if (p.x > W + 6) p.x = -6;
        const tw = 0.55 + Math.abs(Math.sin(t / 1400 + p.ph)) * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${p.a * tw})`;
        ctx.shadowColor = "rgba(212,175,55,0.5)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    function loop(t) {
      if (!document.hidden) draw(t);
      requestAnimationFrame(loop);
    }

    return {
      init() {
        resize();
        window.addEventListener("resize", resize);
        if (reduceMotion) {
          draw(0);
        } else {
          requestAnimationFrame(loop);
        }
      },
    };
  })();

  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
