/* ==========================================================================
   KAIZZ — Luxury Neural Trading Terminal
   Vanilla JS · canvas 3D core · simulated analytics
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ *
   *  Market model
   * ------------------------------------------------------------------ */
  const PAIRS = {
    XAUUSD: { base: 2748.5, vol: 0.9, dp: 2, pip: 10, label: "Spot Gold · Simulated feed", chg: 1.48 },
    XAGUSD: { base: 34.12, vol: 0.038, dp: 3, pip: 50, label: "Spot Silver · Simulated feed", chg: 0.86 },
    BTCUSDT: { base: 94526.8, vol: 145, dp: 1, pip: 1, label: "Bitcoin · Simulated feed", chg: 3.64 },
    GBPUSD: { base: 1.29552, vol: 0.00048, dp: 5, pip: 10, label: "Sterling / Dollar · Simulated feed", chg: -0.31 },
  };

  const state = {
    pair: "XAUUSD",
    tf: "M15",
    ma: true,
    candles: [],
    levels: null,
    signal: null,
    scanning: false,
    visionImage: null,
    visionRect: null,
    visionLevels: null,
  };

  const fmtPrice = (value, pair = state.pair) =>
    Number(value).toLocaleString("en-US", {
      minimumFractionDigits: PAIRS[pair].dp,
      maximumFractionDigits: PAIRS[pair].dp,
    });

  /* ------------------------------------------------------------------ *
   *  Utilities: toast, clock, counters, reveal
   * ------------------------------------------------------------------ */
  const toastEl = $("#toast");
  const toastMsg = $("#toast-msg");
  let toastTimer = null;
  function toast(message) {
    toastMsg.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2800);
  }

  function startClock() {
    const el = $("#utc-clock");
    const tick = () => {
      const now = new Date();
      el.textContent =
        now.toISOString().slice(11, 19) + " UTC";
    };
    tick();
    setInterval(tick, 1000);
  }

  function animateCounters() {
    $$("[data-count]").forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      if (reduceMotion) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }
      const start = performance.now();
      const dur = 1500;
      const step = (now) => {
        const p = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function initReveal() {
    const items = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const delay = parseInt(entry.target.dataset.revealDelay || "0", 10);
          setTimeout(() => entry.target.classList.add("is-in"), delay);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ *
   *  Header nav
   * ------------------------------------------------------------------ */
  function initNav() {
    const header = $("#site-header");
    const burger = $("#nav-burger");
    const links = $("#nav-links");

    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    burger.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$("a", links).forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
    document.addEventListener("click", (e) => {
      if (!links.classList.contains("is-open")) return;
      if (links.contains(e.target) || burger.contains(e.target)) return;
      links.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    });
  }

  /* ------------------------------------------------------------------ *
   *  Ticker
   * ------------------------------------------------------------------ */
  function buildTicker() {
    const track = $("#ticker-track");
    const entries = Object.entries(PAIRS);
    const html = entries
      .map(([key, cfg]) => {
        const up = cfg.chg >= 0;
        return `<span class="ticker-item"><b>${key}</b> ${fmtPrice(cfg.base, key)}
        <span class="${up ? "txt-up" : "txt-down"}">${up ? "+" : ""}${cfg.chg.toFixed(2)}%</span></span>`;
      })
      .join("");
    track.innerHTML = html + html;
  }

  /* ------------------------------------------------------------------ *
   *  Rolling candles
   * ------------------------------------------------------------------ */
  function generateCandles(count = 72) {
    const cfg = PAIRS[state.pair];
    const candles = [];
    let price = cfg.base * (1 - cfg.chg / 300);
    const drift = (cfg.base - price) / count;

    for (let i = 0; i < count; i++) {
      const open = price;
      const close = open + drift + rand(-cfg.vol * 0.8, cfg.vol * 0.8);
      const high = Math.max(open, close) + Math.random() * cfg.vol * 0.45;
      const low = Math.min(open, close) - Math.random() * cfg.vol * 0.45;
      candles.push({ o: open, h: high, l: low, c: close });
      price = close;
    }

    // Anchor the whole series so the final close matches the quoted price
    const last = candles[candles.length - 1];
    const shift = cfg.base - last.c;
    candles.forEach((c) => {
      c.o += shift;
      c.h += shift;
      c.l += shift;
      c.c += shift;
    });

    return candles;
  }

  function rollingTick() {
    if (state.scanning) return;
    const cfg = PAIRS[state.pair];
    const candles = state.candles;
    const last = candles[candles.length - 1];
    const move = rand(-cfg.vol, cfg.vol) * 0.7;
    last.c = last.c + move;
    last.h = Math.max(last.h, last.c);
    last.l = Math.min(last.l, last.c);

    // roll a fresh candle every few ticks
    if (Math.random() < 0.3) {
      const o = last.c;
      const c = o + rand(-cfg.vol * 0.6, cfg.vol * 0.6);
      state.candles.shift();
      state.candles.push({
        o,
        c,
        h: Math.max(o, c) + Math.random() * cfg.vol * 0.35,
        l: Math.min(o, c) - Math.random() * cfg.vol * 0.35,
      });
    }
    updateQuote();
    chart.invalidate();
  }

  function updateQuote() {
    const cfg = PAIRS[state.pair];
    const last = state.candles[state.candles.length - 1];
    const ma = movingAverage(13);
    const first = state.candles[0].c;
    const chg = ((last.c - first) / first) * 100;

    $("#chart-price").textContent = fmtPrice(last.c);
    $("#chart-ma").textContent = ma ? fmtPrice(ma) : "—";
    const chgEl = $("#chart-change");
    chgEl.textContent = `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`;
    chgEl.className = "chart-head__chg " + (chg >= 0 ? "txt-up" : "txt-down");

    const delta = ma ? last.c - ma : 0;
    const biasEl = $("#hud-bias");
    biasEl.textContent = delta >= 0 ? "BULLISH" : "BEARISH";
    biasEl.className = delta >= 0 ? "txt-up" : "txt-down";
    $("#hud-delta").textContent = (delta >= 0 ? "+" : "") + delta.toFixed(2);
  }

  function movingAverage(period) {
    const closes = state.candles.map((c) => c.c);
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /* ------------------------------------------------------------------ *
   *  Signal engine (simulated)
   * ------------------------------------------------------------------ */
  function computeSignal() {
    const cfg = PAIRS[state.pair];
    const candles = state.candles;
    const closes = candles.map((c) => c.c);
    const last = closes[closes.length - 1];
    const ma = movingAverage(13) || last;
    const prevMa = closes.slice(-16, -3).reduce((a, b) => a + b, 0) / 13 || ma;

    // RSI(14) approximation
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - 100 / (1 + rs);

    // Average true range
    const recent = candles.slice(-14);
    const atr =
      recent.reduce((sum, c) => sum + (c.h - c.l), 0) / recent.length;

    let score = 0;
    if (last >= ma) score += 1.2;
    else score -= 1.2;
    if (ma >= prevMa) score += 0.9;
    else score -= 0.9;
    if (rsi > 53) score += 0.7;
    else if (rsi < 47) score -= 0.7;
    if (last > candles[candles.length - 2].c) score += 0.4;
    else score -= 0.4;

    const dir = score >= 0 ? "BUY" : "SELL";
    const entry = last;
    const dist = Math.max(atr * 1.45, cfg.base * 0.0006);
    const sign = dir === "BUY" ? 1 : -1;

    const sl = entry - sign * dist;
    const tp1 = entry + sign * dist * 1.25;
    const tp2 = entry + sign * dist * 2.1;
    const tp3 = entry + sign * dist * 3.0;
    const confidence = clamp(90.4 + Math.abs(score) * 1.9 + rand(0, 2.4), 90.4, 98.6);

    const notes = {
      BUY: [
        "Price reclaimed the dynamic MA-13 above a bullish order block, with momentum expanding out of the session sweep.",
        "Liquidity was swept below the prior low and reclaimed instantly — MA-13 now acting as demand, targets measured from the impulse leg.",
      ],
      SELL: [
        "Price rejected the MA-13 from below after an unmitigated supply block, with momentum rotating into the London killzone.",
        "A buy-side sweep above the prior high failed to hold — distribution under MA-13, targets projected from the displacement leg.",
      ],
    };

    return {
      pair: state.pair,
      tf: state.tf,
      dir,
      entry,
      sl,
      tp1,
      tp2,
      tp3,
      confidence,
      rsi,
      atr,
      note: notes[dir][Math.floor(Math.random() * 2)],
    };
  }

  /* ------------------------------------------------------------------ *
   *  Chart renderer
   * ------------------------------------------------------------------ */
  const chart = (() => {
    const canvas = $("#candle-canvas");
    const stage = $("#chart-stage");
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;
    let needsDraw = true;
    let lastDraw = 0;
    let dash = 0;

    function resize() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsDraw = true;
    }

    function bounds() {
      const candles = state.candles;
      let min = Infinity;
      let max = -Infinity;
      candles.forEach((c) => {
        min = Math.min(min, c.l);
        max = Math.max(max, c.h);
      });
      if (state.levels) {
        const lv = state.levels;
        [lv.entry, lv.sl, lv.tp1, lv.tp2, lv.tp3].forEach((v) => {
          min = Math.min(min, v);
          max = Math.max(max, v);
        });
      }
      const pad = (max - min) * 0.1 || 1;
      return { min: min - pad, max: max + pad };
    }

    function priceToY(price, min, max, top, height) {
      return top + ((max - price) / (max - min)) * height;
    }

    function draw() {
      if (!W || !H) return;
      const cfg = PAIRS[state.pair];
      const candles = state.candles;
      const padL = 10;
      const padR = 66;
      const padT = 18;
      const padB = 24;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const { min, max } = bounds();

      ctx.clearRect(0, 0, W, H);

      // backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#08080b");
      bg.addColorStop(1, "#050507");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // horizontal grid + price axis
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const rows = 5;
      for (let i = 0; i <= rows; i++) {
        const y = padT + (plotH / rows) * i;
        ctx.strokeStyle = "rgba(212,175,55,0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y + 0.5);
        ctx.lineTo(W - padR, y + 0.5);
        ctx.stroke();
        const price = max - ((max - min) / rows) * i;
        ctx.fillStyle = "rgba(155,151,140,0.55)";
        ctx.fillText(fmtPrice(price), W - padR + 9, y);
      }

      // vertical grid
      for (let i = 0; i <= 8; i++) {
        const x = padL + (plotW / 8) * i;
        ctx.strokeStyle = "rgba(212,175,55,0.035)";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, padT);
        ctx.lineTo(x + 0.5, H - padB);
        ctx.stroke();
      }

      // candles
      const slot = plotW / candles.length;
      const bodyW = Math.max(2, slot * 0.56);
      const upColor = "#3ddc97";
      const downColor = "#ff6b81";

      candles.forEach((c, i) => {
        const x = padL + slot * i + slot / 2;
        const isUp = c.c >= c.o;
        const color = isUp ? upColor : downColor;

        // wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(x, priceToY(c.h, min, max, padT, plotH));
        ctx.lineTo(x, priceToY(c.l, min, max, padT, plotH));
        ctx.stroke();

        // body
        const yO = priceToY(c.o, min, max, padT, plotH);
        const yC = priceToY(c.c, min, max, padT, plotH);
        const top = Math.min(yO, yC);
        const hgt = Math.max(1.5, Math.abs(yC - yO));
        ctx.globalAlpha = isUp ? 0.95 : 0.9;
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyW / 2, top, bodyW, hgt);
        ctx.globalAlpha = 1;
      });

      // MA-13
      if (state.ma) {
        const closes = candles.map((c) => c.c);
        const pts = [];
        for (let i = 12; i < closes.length; i++) {
          const mean =
            closes.slice(i - 12, i + 1).reduce((a, b) => a + b, 0) / 13;
          pts.push({
            x: padL + slot * i + slot / 2,
            y: priceToY(mean, min, max, padT, plotH),
          });
        }
        if (pts.length > 1) {
          ctx.save();
          ctx.strokeStyle = "rgba(243,229,171,0.92)";
          ctx.lineWidth = 1.6;
          ctx.shadowColor = "rgba(212,175,55,0.65)";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
          ctx.restore();
        }
      }

      // levels overlay
      if (state.levels) {
        const lv = state.levels;
        const rows2 = [
          { v: lv.tp3, color: "rgba(61,220,151,0.85)", label: "TP3" },
          { v: lv.tp2, color: "rgba(61,220,151,0.85)", label: "TP2" },
          { v: lv.tp1, color: "rgba(61,220,151,0.85)", label: "TP1" },
          { v: lv.entry, color: "rgba(243,229,171,0.95)", label: "ENTRY" },
          { v: lv.sl, color: "rgba(255,107,129,0.9)", label: "SL" },
        ];
        rows2.forEach((row) => {
          const y = priceToY(row.v, min, max, padT, plotH);
          if (y < padT - 4 || y > H - padB + 4) return;
          ctx.save();
          ctx.strokeStyle = row.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = -dash;
          ctx.beginPath();
          ctx.moveTo(padL, y + 0.5);
          ctx.lineTo(W - padR, y + 0.5);
          ctx.stroke();
          ctx.restore();

          ctx.font = "8px 'JetBrains Mono', monospace";
          const textW = ctx.measureText(row.label).width + 8;
          ctx.fillStyle = "rgba(5,5,7,0.9)";
          ctx.fillRect(padL + 2, y - 6, textW, 12);
          ctx.fillStyle = row.color;
          ctx.textAlign = "left";
          ctx.fillText(row.label, padL + 6, y + 0.5);
        });
      }

      // last price line + tag
      const last = candles[candles.length - 1];
      const ly = priceToY(last.c, min, max, padT, plotH);
      ctx.save();
      ctx.strokeStyle = "rgba(212,175,55,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, ly + 0.5);
      ctx.lineTo(W - padR, ly + 0.5);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "#d4af37";
      const tag = fmtPrice(last.c);
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(tag).width + 12;
      const th = 17;
      const tx = W - padR + 4;
      const ty = clamp(ly - th / 2, 2, H - th - 2);
      roundRect(tx, ty, Math.min(tw, padR - 8), th, 4);
      ctx.fill();
      ctx.fillStyle = "#0a0803";
      ctx.textAlign = "left";
      ctx.fillText(tag, tx + 6, ty + th / 2);

      // subtle vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function loop(now) {
      if (state.levels && !reduceMotion) {
        dash = (now / 40) % 20;
        needsDraw = true;
      }
      if (needsDraw && now - lastDraw > 33) {
        draw();
        lastDraw = now;
        needsDraw = false;
      }
      requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });

    return {
      init() {
        resize();
        ro.observe(stage);
        updateQuote();
        draw();
        requestAnimationFrame(loop);
      },
      invalidate() {
        needsDraw = true;
      },
      draw,
      resize,
    };
  })();

  /* ------------------------------------------------------------------ *
   *  Signal card
   * ------------------------------------------------------------------ */
  function paintSignal(sig, animate = true) {
    const cfg = PAIRS[sig.pair];
    $("#sig-pair").textContent = `${sig.pair} · ${sig.tf}`;
    $("#sig-conf").textContent = sig.confidence.toFixed(1) + "%";
    $("#sig-dir").textContent = sig.dir + " NOW";
    $("#sig-entry").textContent = fmtPrice(sig.entry, sig.pair);
    $("#sig-sl").textContent = fmtPrice(sig.sl, sig.pair);
    $("#sig-tp1").textContent = fmtPrice(sig.tp1, sig.pair);
    $("#sig-tp2").textContent = fmtPrice(sig.tp2, sig.pair);
    $("#sig-tp3").textContent = fmtPrice(sig.tp3, sig.pair);
    $("#sig-note").textContent = sig.note;

    const action = $("#sig-action");
    action.classList.toggle("is-up", sig.dir === "BUY");
    action.classList.toggle("is-down", sig.dir === "SELL");

    const now = new Date();
    $("#sig-time").textContent =
      "Updated " + now.toISOString().slice(11, 16) + " UTC";

    if (animate) {
      const card = $("#signal-card");
      card.animate(
        [
          { boxShadow: "0 0 0 0 rgba(212,175,55,0.65)" },
          { boxShadow: "0 0 0 10px rgba(212,175,55,0)" },
        ],
        { duration: 900, easing: "ease-out" }
      );
    }
    state.signal = sig;
  }

  function applyPairChange(pair) {
    state.pair = pair;
    state.candles = generateCandles(72);
    state.levels = null;
    chart.invalidate();
    updateQuote();
    $("#chart-pair").textContent = pair;
    $("#chart-tf").textContent = state.tf;
    const feed = PAIRS[pair].label.toUpperCase();
    const feedEl = $(".chart-head__feed");
    if (feedEl) feedEl.textContent = feed;
    $("#sig-pair").textContent = `${pair} · ${state.tf}`;
    const sig = computeSignal();
    setLevels(sig);
    paintSignal(sig, false);
    $("#zone-badge").classList.remove("is-hidden");
  }

  function setLevels(sig) {
    state.levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3 };
  }

  /* ------------------------------------------------------------------ *
   *  Scanner overlay
   * ------------------------------------------------------------------ */
  const LIVE_STEPS = [
    "Detecting liquidity sweep…",
    "Mapping order blocks…",
    "Reconciling MA-13 equilibrium…",
    "Sizing stop loss…",
    "Projecting TP1 → TP3…",
    "Sealing neural verdict…",
  ];

  function runLiveScan({ silent = false } = {}) {
    if (state.scanning) return;
    state.scanning = true;
    const overlay = $("#scan-overlay");
    const stepEl = $("#scan-step");
    const bar = $("#scan-bar");
    const pct = $("#scan-pct");
    const btn = $("#scan-btn");

    overlay.classList.remove("is-hidden");
    btn.disabled = true;
    btn.style.opacity = "0.6";

    let i = 0;
    let progress = 0;
    const total = reduceMotion ? 1 : 2500;
    const start = performance.now();

    const failSafe = setInterval(() => {
      const elapsed = performance.now() - start;
      progress = clamp(elapsed / total, 0, 1);
      bar.style.width = (progress * 100).toFixed(0) + "%";
      if (pct) pct.textContent = (progress * 100).toFixed(0) + "%";
      const idx = Math.min(LIVE_STEPS.length - 1, Math.floor(progress * LIVE_STEPS.length));
      if (idx !== i) {
        i = idx;
        stepEl.textContent = LIVE_STEPS[i];
      }
      if (progress >= 1) {
        clearInterval(failSafe);
        finish();
      }
    }, 90);

    function finish() {
      const sig = computeSignal();
      setLevels(sig);
      paintSignal(sig, true);
      chart.invalidate();
      $("#zone-badge").classList.remove("is-hidden");
      overlay.classList.add("is-hidden");
      btn.disabled = false;
      btn.style.opacity = "";
      state.scanning = false;
      if (!silent) toast(`${sig.dir} ${sig.pair} · ${sig.confidence.toFixed(1)}% confidence · levels locked`);
    }
  }

  function initScannerControls() {
    $$("#pair-selector .seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#pair-selector .seg").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        applyPairChange(btn.dataset.pair);
      });
    });

    $$("#tf-selector .seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("#tf-selector .seg").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.tf = btn.dataset.tf;
        $("#chart-tf").textContent = state.tf;
        const sig = computeSignal();
        paintSignal(sig, false);
        setLevels(sig);
        $("#zone-badge").classList.remove("is-hidden");
        chart.invalidate();
      });
    });

    const maToggle = $("#ma-toggle");
    maToggle.addEventListener("click", () => {
      state.ma = !state.ma;
      maToggle.classList.toggle("is-on", state.ma);
      maToggle.setAttribute("aria-pressed", String(state.ma));
      maToggle.querySelector("b").textContent = state.ma ? "ON" : "OFF";
      chart.invalidate();
    });

    $("#scan-btn").addEventListener("click", () => runLiveScan());
    $("#nav-scan").addEventListener("click", () => {
      switchMode("live");
      $("#terminal").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setTimeout(() => runLiveScan(), 550);
    });
    $("#nav-vision").addEventListener("click", () => {
      switchMode("vision");
      $("#terminal").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function switchMode(mode) {
    const liveBtn = $("#tab-live");
    const visBtn = $("#tab-vision");
    const livePanel = $("#mode-live");
    const visPanel = $("#mode-vision");
    const controls = $("#live-controls");

    const isLive = mode === "live";
    liveBtn.classList.toggle("is-active", isLive);
    visBtn.classList.toggle("is-active", !isLive);
    liveBtn.setAttribute("aria-selected", String(isLive));
    visBtn.setAttribute("aria-selected", String(!isLive));
    livePanel.classList.toggle("is-hidden", !isLive);
    visPanel.classList.toggle("is-hidden", isLive);
    controls.style.visibility = isLive ? "" : "hidden";
    controls.style.opacity = isLive ? "" : "0";
  }

  /* ------------------------------------------------------------------ *
   *  Vision decoder
   * ------------------------------------------------------------------ */
  const vision = (() => {
    const stage = $("#vision-stage");
    const canvas = $("#vision-canvas");
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;

    function resize() {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    }

    function redraw() {
      if (!state.visionImage) return;
      ctx.fillStyle = "#060609";
      ctx.fillRect(0, 0, W, H);
      const img = state.visionImage;
      const iw = img.width;
      const ih = img.height;

      // blurred cover backdrop so the stage never looks empty
      const coverScale = Math.max(W / iw, H / ih);
      ctx.save();
      ctx.filter = "blur(16px)";
      ctx.globalAlpha = 0.55;
      ctx.drawImage(img, (W - iw * coverScale) / 2, (H - ih * coverScale) / 2, iw * coverScale, ih * coverScale);
      ctx.restore();
      ctx.fillStyle = "rgba(5,5,7,0.6)";
      ctx.fillRect(0, 0, W, H);

      const scale = Math.min(W / iw, H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      state.visionRect = { x: dx, y: dy, w: dw, h: dh };
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.fillStyle = "rgba(5,5,7,0.25)";
      ctx.fillRect(dx, dy, dw, dh);

      // scan corner brackets
      drawBrackets(dx + 6, dy + 6, dw - 12, dh - 12);

      if (state.visionLevels) {
        const lv = state.visionLevels;
        lv.forEach((row) => {
          const y = dy + dh * row.y;
          ctx.save();
          ctx.strokeStyle = row.color;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(dx + 8, y);
          ctx.lineTo(dx + dw - 8, y);
          ctx.stroke();
          ctx.restore();
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          const tw = ctx.measureText(row.label).width + 12;
          ctx.fillStyle = "rgba(5,5,7,0.9)";
          ctx.fillRect(dx + 12, y - 18, tw, 15);
          ctx.strokeStyle = row.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + 12, y - 18, tw, 15);
          ctx.fillStyle = row.color;
          ctx.textAlign = "left";
          ctx.fillText(row.label, dx + 18, y - 7);
        });
      }
    }

    function drawBrackets(x, y, w, h) {
      const len = 16;
      ctx.strokeStyle = "rgba(212,175,55,0.65)";
      ctx.lineWidth = 1.5;
      [
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
        [x + w, y + h, -1, -1],
      ].forEach(([px, py, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(px, py + sy * len);
        ctx.lineTo(px, py);
        ctx.lineTo(px + sx * len, py);
        ctx.stroke();
      });
    }

    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    function showCanvas() {
      canvas.classList.remove("is-hidden");
      $("#vision-drop").classList.add("is-hidden");
      // match the stage to the screenshot's aspect so there is no dead space
      const img = state.visionImage;
      if (img) {
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0) {
          const h = clamp((rect.width * img.height) / img.width, 230, 430);
          stage.style.height = h + "px";
        }
      }
      resize();
    }

    async function handleFile(file) {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          state.visionImage = await loadImage(reader.result);
          state.visionLevels = null;
          showCanvas();
          toast("Screenshot loaded · ready to decode");
        } catch (err) {
          toast("Could not read that image");
        }
      };
      reader.readAsDataURL(file);
    }

    function makeSample() {
      const c = document.createElement("canvas");
      c.width = 960;
      c.height = 540;
      const g = c.getContext("2d");
      g.fillStyle = "#08080b";
      g.fillRect(0, 0, 960, 540);

      g.strokeStyle = "rgba(212,175,55,0.09)";
      g.lineWidth = 1;
      for (let x = 0; x <= 960; x += 80) {
        g.beginPath();
        g.moveTo(x + 0.5, 40);
        g.lineTo(x + 0.5, 500);
        g.stroke();
      }
      for (let y = 40; y <= 500; y += 46) {
        g.beginPath();
        g.moveTo(40, y + 0.5);
        g.lineTo(900, y + 0.5);
        g.stroke();
      }

      g.fillStyle = "rgba(243,229,171,0.85)";
      g.font = "bold 20px monospace";
      g.fillText("XAUUSD", 40, 28);
      g.fillStyle = "rgba(212,175,55,0.7)";
      g.font = "12px monospace";
      g.fillText("M15 · MT5", 150, 27);

      let price = 2680;
      let drift = 1.15;
      const n = 52;
      for (let i = 0; i < n; i++) {
        drift += (Math.random() - 0.5) * 0.5;
        const o = price;
        const cl = o + drift + (Math.random() - 0.5) * 5;
        const hi = Math.max(o, cl) + Math.random() * 3.4;
        const lo = Math.min(o, cl) - Math.random() * 3.4;
        price = cl;
        const x = 56 + i * 16;
        const yFor = (v) => 480 - ((v - 2660) / 90) * 430;
        const up = cl >= o;
        g.strokeStyle = up ? "#3ddc97" : "#ff6b81";
        g.fillStyle = up ? "#3ddc97" : "#ff6b81";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 5, yFor(hi));
        g.lineTo(x + 5, yFor(lo));
        g.stroke();
        const yO = yFor(o);
        const yC = yFor(cl);
        g.fillRect(x + 1, Math.min(yO, yC), 8, Math.max(1.5, Math.abs(yC - yO)));
      }
      // MA line
      g.strokeStyle = "rgba(243,229,171,0.9)";
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = 61 + i * 16;
        const y = 300 + Math.sin(i / 6) * 26 + (i / n) * 60;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();

      return c;
    }

    function loadSample() {
      const c = makeSample();
      loadImage(c.toDataURL("image/png")).then((img) => {
        state.visionImage = img;
        state.visionLevels = null;
        showCanvas();
        toast("Sample MT5 chart loaded");
      });
    }

    function decode() {
      if (!state.visionImage) {
        toast("Load a screenshot first");
        return;
      }
      const overlay = $("#vision-overlay");
      const step = $("#vision-step");
      const bar = $("#vision-bar");
      const steps = [
        "Detecting chart geometry…",
        "Reading OHLC candles…",
        "Locating swing highs & lows…",
        "Fitting MA-13 equilibrium…",
        "Resolving entry, SL and targets…",
      ];
      overlay.classList.remove("is-hidden");
      let progress = 0;
      const start = performance.now();
      const total = reduceMotion ? 600 : 2600;
      const timer = setInterval(() => {
        progress = clamp((performance.now() - start) / total, 0, 1);
        bar.style.width = (progress * 100).toFixed(0) + "%";
        step.textContent = steps[Math.min(steps.length - 1, Math.floor(progress * steps.length))];
        if (progress >= 1) {
          clearInterval(timer);
          finish();
        }
      }, 80);

      function finish() {
        const sig = computeSignal();
        // map levels onto plausible chart-relative positions
        state.visionLevels = [
          { y: 0.34, color: "rgba(61,220,151,0.9)", label: "TP3 " + fmtPrice(sig.tp3) },
          { y: 0.41, color: "rgba(61,220,151,0.9)", label: "TP2 " + fmtPrice(sig.tp2) },
          { y: 0.48, color: "rgba(61,220,151,0.9)", label: "TP1 " + fmtPrice(sig.tp1) },
          { y: 0.57, color: "rgba(243,229,171,0.95)", label: "ENTRY " + fmtPrice(sig.entry) },
          { y: 0.68, color: "rgba(255,107,129,0.95)", label: "SL " + fmtPrice(sig.sl) },
        ];
        redraw();
        overlay.classList.add("is-hidden");
        setLevels(sig);
        paintSignal(sig, true);
        $("#zone-badge").classList.remove("is-hidden");
        toast(`Vision decode complete · ${sig.dir} ${sig.pair}`);
      }
    }

    return {
      init() {
        const input = $("#vision-input");
        const drop = $("#vision-drop");

        $("#tab-live").addEventListener("click", () => switchMode("live"));
        $("#tab-vision").addEventListener("click", () => switchMode("vision"));

        drop.addEventListener("click", () => input.click());
        input.addEventListener("change", (e) => {
          if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
        });

        ["dragenter", "dragover"].forEach((evt) =>
          drop.addEventListener(evt, (e) => {
            e.preventDefault();
            drop.classList.add("is-drag");
          })
        );
        ["dragleave", "drop"].forEach((evt) =>
          drop.addEventListener(evt, (e) => {
            e.preventDefault();
            drop.classList.remove("is-drag");
          })
        );
        drop.addEventListener("drop", (e) => {
          const file = e.dataTransfer && e.dataTransfer.files[0];
          if (file) handleFile(file);
        });
        ["dragover", "drop"].forEach((evt) =>
          stage.addEventListener(evt, (e) => e.preventDefault())
        );

        $("#vision-sample").addEventListener("click", loadSample);
        $("#vision-scan-btn").addEventListener("click", decode);

        new ResizeObserver(() => {
          if (!canvas.classList.contains("is-hidden")) resize();
        }).observe(stage);
      },
    };
  })();

  /* ------------------------------------------------------------------ *
   *  Copy signal
   * ------------------------------------------------------------------ */
  function initCopySignal() {
    $("#copy-signal").addEventListener("click", async () => {
      const sig = state.signal;
      if (!sig) return;
      const text = [
        `KAIZZ · ${sig.pair} ${sig.tf}`,
        `DIRECTION: ${sig.dir}`,
        `ENTRY: ${fmtPrice(sig.entry, sig.pair)}`,
        `SL: ${fmtPrice(sig.sl, sig.pair)}`,
        `TP1: ${fmtPrice(sig.tp1, sig.pair)}`,
        `TP2: ${fmtPrice(sig.tp2, sig.pair)}`,
        `TP3: ${fmtPrice(sig.tp3, sig.pair)}`,
        `CONFIDENCE: ${sig.confidence.toFixed(1)}%`,
        `— Simulated analytics, not financial advice.`,
      ].join("\n");

      try {
        await navigator.clipboard.writeText(text);
        toast("Signal copied to clipboard");
      } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          toast("Signal copied to clipboard");
        } catch (e) {
          toast("Copy not available in this browser");
        }
        ta.remove();
      }
    });
  }

  /* ------------------------------------------------------------------ *
   *  Signal vault
   * ------------------------------------------------------------------ */
  const VAULT = [
    { side: "BUY", pair: "XAUUSD", tf: "M15", entry: 2734.2, sl: 2727.5, tp: 2749.0, status: "TP3 HIT", pips: "+148 PIPS", time: "18 mins ago" },
    { side: "BUY", pair: "BTCUSDT", tf: "H1", entry: 92850.0, sl: 92100.0, tp: 94400.0, status: "TP2 HIT", pips: "+1,550 PTS", time: "1 hr ago" },
    { side: "SELL", pair: "XAGUSD", tf: "M30", entry: 34.12, sl: 34.28, tp: 33.78, status: "TP2 HIT", pips: "+340 PIPS", time: "3 hrs ago" },
    { side: "SELL", pair: "GBPUSD", tf: "M15", entry: 1.2985, sl: 1.301, tp: 1.2935, status: "TP1 HIT", pips: "+50 PIPS", time: "5 hrs ago" },
  ];

  function renderVault() {
    const grid = $("#vault-grid");
    grid.innerHTML = VAULT.map((v) => {
      const dp = PAIRS[v.pair] ? PAIRS[v.pair].dp : 2;
      const p = (n) => n.toFixed(dp);
      return `<article class="vault__card">
        <div class="vault__top">
          <div class="vault__pairwrap">
            <span class="vault__side ${v.side === "BUY" ? "is-up" : "is-down"}">${v.side}</span>
            <span class="vault__pair">${v.pair}</span>
            <span class="vault__tf">(${v.tf})</span>
          </div>
          <span class="vault__status is-hit">${v.status} <span class="txt-gold">${v.pips}</span></span>
        </div>
        <div class="vault__levels">
          <span>ENTRY <b>${p(v.entry)}</b></span>
          <span class="is-sl">SL <b>${p(v.sl)}</b></span>
          <span class="is-tp">TP <b>${p(v.tp)}</b></span>
        </div>
        <div class="vault__foot"><span>Simulated record</span><span>${v.time}</span></div>
      </article>`;
    }).join("");
  }

  /* ------------------------------------------------------------------ *
   *  Risk engine
   * ------------------------------------------------------------------ */
  const RISK_MODELS = {
    XAUUSD: { pipValue: 10, unit: "pips", label: "Gold" },
    XAGUSD: { pipValue: 50, unit: "pips", label: "Silver" },
    BTCUSDT: { pipValue: 1, unit: "points", label: "Bitcoin" },
    GBPUSD: { pipValue: 10, unit: "pips", label: "Sterling" },
  };

  function initRisk() {
    const balanceEl = $("#risk-balance");
    const pctEl = $("#risk-percent");
    const pctHint = $("#risk-percent-hint");
    const slEl = $("#risk-sl");
    const instEl = $("#risk-instrument");
    const lotsEl = $("#risk-lots");
    const amountEl = $("#risk-amount");
    const pipEl = $("#risk-pip");
    const contractsEl = $("#risk-contracts");
    const gaugeFill = $("#risk-gauge-fill");
    const gaugeLabel = $("#risk-gauge-label");
    const verdict = $("#risk-verdict");

    const money = (n) =>
      "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function updateGaugeFill() {
      const pct = parseFloat(pctEl.value);
      pctEl.style.setProperty("--fill", ((pct - 0.25) / (5 - 0.25)) * 100 + "%");
    }

    function compute() {
      const balance = Math.max(100, parseFloat(balanceEl.value) || 0);
      const pct = parseFloat(pctEl.value) || 0.25;
      const sl = Math.max(1, parseFloat(slEl.value) || 1);
      const model = RISK_MODELS[instEl.value] || RISK_MODELS.XAUUSD;

      const riskAmount = (balance * pct) / 100;
      let lots = riskAmount / (sl * model.pipValue);
      lots = Math.floor(lots * 100) / 100;
      lots = Math.max(0.01, lots);

      pctHint.textContent = pct.toFixed(2).replace(/0$/, "") + "%";
      lotsEl.textContent = lots.toFixed(2);
      contractsEl.textContent = lots.toFixed(2);
      amountEl.textContent = money(riskAmount);
      pipEl.textContent = money(model.pipValue);
      gaugeLabel.textContent = pct + "% of equity";

      const width = clamp((pct / 5) * 100, 2, 100);
      gaugeFill.style.width = width + "%";

      if (pct <= 2) {
        verdict.textContent = "Within mandate";
        verdict.className = "chip chip--emerald";
        gaugeFill.style.background = "linear-gradient(90deg,#b08d1f,#d4af37,#fff3c4)";
      } else if (pct <= 3.5) {
        verdict.textContent = "Elevated risk";
        verdict.className = "chip chip--gold";
        gaugeFill.style.background = "linear-gradient(90deg,#b08d1f,#e0a83a,#ffd166)";
      } else {
        verdict.textContent = "Aggressive";
        verdict.className = "chip chip--emerald";
        verdict.style.color = "#ff6b81";
        verdict.style.borderColor = "rgba(255,107,129,0.35)";
        verdict.style.background = "rgba(255,107,129,0.1)";
        gaugeFill.style.background = "linear-gradient(90deg,#a13a49,#ff6b81,#ffb3bd)";
      }
      if (pct <= 3.5) {
        verdict.style.color = "";
        verdict.style.borderColor = "";
        verdict.style.background = "";
      }

      updateGaugeFill();
      return { lots, riskAmount, money: model.pipValue, pct, balance };
    }

    [balanceEl, pctEl, slEl, instEl].forEach((el) => {
      el.addEventListener("input", compute);
      el.addEventListener("change", compute);
    });

    $("#risk-apply").addEventListener("click", () => {
      const out = compute();
      const card = $("#signal-card");
      card.animate(
        [
          { transform: "translateY(0)" },
          { transform: "translateY(-4px)" },
          { transform: "translateY(0)" },
        ],
        { duration: 450, easing: "ease-out" }
      );
      toast(`${out.lots.toFixed(2)} lots sized · ${money(out.riskAmount)} at risk`);
    });

    compute();
  }

  /* ------------------------------------------------------------------ *
   *  3D quantum core
   * ------------------------------------------------------------------ */
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

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */
  function boot() {
    startClock();
    buildTicker();
    initNav();
    initReveal();
    initScannerControls();
    initCopySignal();
    renderVault();
    initRisk();
    vision.init();

    state.candles = generateCandles(72);
    chart.init();
    core.init();
    dust.init();

    // first signal
    const sig = computeSignal();
    setLevels(sig);
    paintSignal(sig, false);

    animateCounters();
    setInterval(rollingTick, 1600);

    const yearEl = $("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // preloader
    const preloader = $("#preloader");
    const hide = () => setTimeout(() => preloader.classList.add("is-done"), 420);
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide);
    // safety
    setTimeout(() => preloader.classList.add("is-done"), 3500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
