const MARKET_ASSETS = {
  XAUUSD:  { price: 2748.65, decimals: 2, step: 0.35, change: '+1.48%', label: 'Spot Gold' },
  XAUUSDc: { price: 2748.40, decimals: 2, step: 0.35, change: '+1.44%', label: 'Gold Cent' },
  XAGUSD:  { price: 31.42,   decimals: 2, step: 0.04, change: '+0.92%', label: 'Spot Silver' },
  BTCUSDT: { price: 96420.0, decimals: 1, step: 85.0, change: '+2.31%', label: 'Bitcoin' },
  GBPUSD:  { price: 1.2684,  decimals: 4, step: 0.0005, change: '-0.18%', label: 'Cable FX' }
};

const state = {
  pair: 'XAUUSD',
  timeframe: 'M15',
  showMA13: true,
  activeTab: 'live',
  scanActive: false,
  zonesVisible: false,
  candles: {},
  signal: {
    pair: 'XAUUSD',
    timeframe: 'M15',
    direction: 'BUY NOW',
    isBuy: true,
    confidence: '96.8%',
    entry: 2748.50,
    sl: 2743.50,
    tp1: 2752.50,
    tp2: 2757.00,
    tp3: 2763.50,
    rationale: 'Price retested dynamic MA-13 support above an M15 bullish order block with clean session momentum.'
  }
};

function formatPrice(val, pair = state.pair) {
  const dec = MARKET_ASSETS[pair]?.decimals ?? 2;
  return Number(val).toFixed(dec);
}

function showToast(message) {
  const toast = document.getElementById('kaizz-toast');
  const label = document.getElementById('kaizz-toast-msg');
  if (!toast || !label) return;
  label.textContent = message;
  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 2400);
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function triggerQuickScan() {
  scrollToSection('scanner-terminal');
  if (state.activeTab === 'live') {
    runLiveNeuralScan();
  } else {
    runVisionNeuralScan();
  }
}

/* --- TICKER & CANDLES --- */
function initCandles(pair) {
  const asset = MARKET_ASSETS[pair];
  let current = asset.price;
  const list = [];
  for (let i = 0; i < 48; i++) {
    const open = current;
    const drift = (Math.random() - 0.48) * asset.step * 3.2;
    const close = +(open + drift).toFixed(asset.decimals);
    const wickPad = Math.random() * asset.step * 1.8;
    const high = +(Math.max(open, close) + wickPad).toFixed(asset.decimals);
    const low = +(Math.min(open, close) - wickPad).toFixed(asset.decimals);
    list.push({ open, close, high, low });
    current = close;
  }
  asset.price = current;
  state.candles[pair] = list;
}

function calcMA13(candles) {
  return candles.map((_, idx) => {
    const start = Math.max(0, idx - 12);
    const slice = candles.slice(start, idx + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    return sum / slice.length;
  });
}

function renderTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;
  const items = Object.entries(MARKET_ASSETS).map(([sym, info]) => {
    const pos = info.change.startsWith('+');
    const colorClass = pos ? 'text-emerald-400' : 'text-rose-400';
    return `<div class="flex items-center gap-2 text-xs whitespace-nowrap">
      <span class="font-bold text-amber-200">${sym}</span>
      <span class="text-white">${formatPrice(info.price, sym)}</span>
      <span class="${colorClass}">${info.change}</span>
    </div>`;
  }).join('');
  track.innerHTML = items + items;
}

function tickMarket() {
  Object.entries(MARKET_ASSETS).forEach(([sym, info]) => {
    const delta = (Math.random() - 0.49) * info.step;
    info.price = Math.max(0.01, +(info.price + delta).toFixed(info.decimals));
    const series = state.candles[sym];
    if (series && series.length) {
      const last = series[series.length - 1];
      last.close = info.price;
      last.high = Math.max(last.high, info.price);
      last.low = Math.min(last.low, info.price);
    }
  });
  updateHeaderMetrics();
  renderTicker();
  if (state.activeTab === 'live') {
    drawCandlestickChart();
  }
}

function updateHeaderMetrics() {
  const info = MARKET_ASSETS[state.pair];
  const series = state.candles[state.pair] || [];
  const maArr = calcMA13(series);
  const latestMA = maArr[maArr.length - 1] ?? info.price;
  const delta = info.price - latestMA;

  document.getElementById('chart-pair-title').textContent = state.pair;
  document.getElementById('chart-tf-badge').textContent = state.timeframe;
  document.getElementById('chart-live-price').textContent = formatPrice(info.price, state.pair);
  document.getElementById('chart-ma13-val').textContent = formatPrice(latestMA, state.pair);
  document.getElementById('chart-volatility').textContent = info.change;

  const biasEl = document.getElementById('hud-bias');
  const deltaEl = document.getElementById('hud-ma-delta');
  if (biasEl && deltaEl) {
    const bullish = delta >= 0;
    biasEl.textContent = bullish ? 'BULLISH' : 'BEARISH';
    biasEl.className = bullish ? 'text-emerald-400' : 'text-rose-400';
    deltaEl.textContent = (delta >= 0 ? '+' : '') + formatPrice(delta, state.pair);
  }
}

function drawCandlestickChart() {
  const canvas = document.getElementById('candlestick-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Subtle horizontal grid
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = (h / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const candles = state.candles[state.pair] || [];
  if (!candles.length) return;

  let minP = Infinity;
  let maxP = -Infinity;
  candles.forEach(c => {
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
  });

  if (state.zonesVisible) {
    minP = Math.min(minP, state.signal.sl, state.signal.tp1, state.signal.tp3);
    maxP = Math.max(maxP, state.signal.sl, state.signal.tp1, state.signal.tp3);
  }

  const padX = 16;
  const padY = 24;
  const range = Math.max(1e-5, maxP - minP);
  const toY = p => padY + ((maxP - p) / range) * (h - padY * 2);

  const stepW = (w - padX * 2) / candles.length;
  const bodyW = Math.max(3, stepW * 0.62);

  candles.forEach((c, idx) => {
    const x = padX + idx * stepW + stepW / 2;
    const isBull = c.close >= c.open;
    const color = isBull ? '#34D399' : '#FB7185';

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, toY(c.high));
    ctx.lineTo(x, toY(c.low));
    ctx.stroke();

    const yOpen = toY(c.open);
    const yClose = toY(c.close);
    const top = Math.min(yOpen, yClose);
    const height = Math.max(2, Math.abs(yClose - yOpen));

    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, top, bodyW, height);
  });

  if (state.showMA13) {
    const ma = calcMA13(candles);
    ctx.strokeStyle = '#F3E5AB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ma.forEach((val, idx) => {
      const x = padX + idx * stepW + stepW / 2;
      const y = toY(val);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  if (state.zonesVisible) {
    const drawLevel = (price, label, strokeColor) => {
      const y = toY(price);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = strokeColor;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText(`${label} (${formatPrice(price)})`, w - 155, y - 5);
      ctx.restore();
    };
    drawLevel(state.signal.entry, 'ENTRY', '#FBBF24');
    drawLevel(state.signal.sl, 'SL', '#F87171');
    drawLevel(state.signal.tp1, 'TP1', '#34D399');
    drawLevel(state.signal.tp3, 'TP3', '#10B981');
  }
}

/* --- SIGNAL GENERATION & UI --- */
function applySignalToCard() {
  const s = state.signal;
  document.getElementById('sig-pair-header').textContent = `${s.pair} • ${s.timeframe}`;
  document.getElementById('sig-confidence').textContent = s.confidence;
  document.getElementById('sig-action-text').textContent = s.direction;
  document.getElementById('sig-entry').textContent = formatPrice(s.entry, s.pair);
  document.getElementById('sig-sl').textContent = formatPrice(s.sl, s.pair);
  document.getElementById('sig-tp1').textContent = formatPrice(s.tp1, s.pair);
  document.getElementById('sig-tp2').textContent = formatPrice(s.tp2, s.pair);
  document.getElementById('sig-tp3').textContent = formatPrice(s.tp3, s.pair);
  document.getElementById('sig-rationale').textContent = s.rationale;
  document.getElementById('sig-timestamp').textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  const box = document.getElementById('sig-action-box');
  const txt = document.getElementById('sig-action-text');
  if (s.isBuy) {
    box.className = 'p-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/40 flex items-center justify-between';
    txt.className = 'font-display text-2xl font-black tracking-wider text-emerald-400';
  } else {
    box.className = 'p-4 rounded-2xl bg-rose-500/12 border border-rose-500/40 flex items-center justify-between';
    txt.className = 'font-display text-2xl font-black tracking-wider text-rose-400';
  }
}

function generateSignalFromPrice(pair, timeframe, basePrice) {
  const asset = MARKET_ASSETS[pair];
  const isBuy = Math.random() >= 0.45;
  const risk = asset.step * (pair === 'BTCUSDT' ? 3.5 : 14);
  const entry = +basePrice.toFixed(asset.decimals);
  const sl = +(isBuy ? entry - risk : entry + risk).toFixed(asset.decimals);
  const tp1 = +(isBuy ? entry + risk * 0.9 : entry - risk * 0.9).toFixed(asset.decimals);
  const tp2 = +(isBuy ? entry + risk * 1.8 : entry - risk * 1.8).toFixed(asset.decimals);
  const tp3 = +(isBuy ? entry + risk * 2.9 : entry - risk * 2.9).toFixed(asset.decimals);

  state.signal = {
    pair,
    timeframe,
    direction: isBuy ? 'BUY NOW' : 'SELL NOW',
    isBuy,
    confidence: `${(92.4 + Math.random() * 5.2).toFixed(1)}%`,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    rationale: isBuy
      ? `Bullish rejection off ${timeframe} MA-13 dynamic support with institutional buy-side liquidity above.`
      : `Bearish rejection below ${timeframe} MA-13 equilibrium with sell-side liquidity target below.`
  };
  applySignalToCard();
}

function runLiveNeuralScan() {
  if (state.scanActive) return;
  state.scanActive = true;
  const overlay = document.getElementById('live-scan-overlay');
  const label = document.getElementById('scan-step-label');
  const bar = document.getElementById('scan-progress-bar');

  const steps = [
    ['Detecting Liquidity Sweep...', '28%'],
    ['Evaluating MA-13 Equilibrium...', '62%'],
    ['Locking SL & TP1–TP3 Targets...', '100%']
  ];

  overlay.classList.remove('hidden');
  let i = 0;

  const advance = () => {
    if (i < steps.length) {
      label.textContent = steps[i][0];
      bar.style.width = steps[i][1];
      i++;
      setTimeout(advance, 420);
    } else {
      overlay.classList.add('hidden');
      bar.style.width = '15%';
      generateSignalFromPrice(state.pair, state.timeframe, MARKET_ASSETS[state.pair].price);
      state.zonesVisible = true;
      document.getElementById('zone-legend-badge')?.classList.remove('hidden');
      drawCandlestickChart();
      state.scanActive = false;
      showToast(`${state.signal.direction} signal generated for ${state.pair}`);
    }
  };
  advance();
}

/* --- MODE 2: VISION SCANNER --- */
let visionLoadedImage = null;

function drawVisionImage(img) {
  const canvas = document.getElementById('vision-canvas');
  const placeholder = document.getElementById('vision-placeholder');
  if (!canvas || !img) return;

  placeholder.classList.add('hidden');
  canvas.classList.remove('hidden');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (canvas.width - drawW) / 2;
  const dy = (canvas.height - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function loadSampleMT5Chart() {
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 800;
  sampleCanvas.height = 420;
  const ctx = sampleCanvas.getContext('2d');

  ctx.fillStyle = '#0B0D12';
  ctx.fillRect(0, 0, 800, 420);

  let y = 260;
  for (let x = 40; x < 740; x += 22) {
    const bull = Math.random() > 0.42;
    const h = 14 + Math.random() * 28;
    const nextY = bull ? y - h * 0.55 : y + h * 0.55;
    ctx.strokeStyle = bull ? '#34D399' : '#FB7185';
    ctx.beginPath();
    ctx.moveTo(x, Math.min(y, nextY) - 10);
    ctx.lineTo(x, Math.max(y, nextY) + 10);
    ctx.stroke();

    ctx.fillStyle = bull ? '#34D399' : '#FB7185';
    ctx.fillRect(x - 6, Math.min(y, nextY), 12, Math.max(3, Math.abs(nextY - y)));
    y = Math.max(70, Math.min(350, nextY));
  }

  const img = new Image();
  img.onload = () => {
    visionLoadedImage = img;
    drawVisionImage(img);
    showToast('Sample MT5 chart loaded');
  };
  img.src = sampleCanvas.toDataURL();
}

function handleVisionUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      visionLoadedImage = img;
      drawVisionImage(img);
      showToast('Chart screenshot ready for AI scan');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function runVisionNeuralScan() {
  if (!visionLoadedImage) {
    loadSampleMT5Chart();
    setTimeout(runVisionNeuralScan, 250);
    return;
  }
  const overlay = document.getElementById('vision-scan-overlay');
  const stepLabel = document.getElementById('vision-step-label');
  overlay.classList.remove('hidden');
  stepLabel.textContent = 'Mapping Support & Resistance...';

  setTimeout(() => {
    stepLabel.textContent = 'Extracting SL & TP Levels...';
  }, 550);

  setTimeout(() => {
    overlay.classList.add('hidden');
    generateSignalFromPrice(state.pair, state.timeframe, MARKET_ASSETS[state.pair].price);
    drawVisionImage(visionLoadedImage);
    const canvas = document.getElementById('vision-canvas');
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(24, canvas.height * 0.48);
    ctx.lineTo(canvas.width - 24, canvas.height * 0.48);
    ctx.stroke();
    showToast('Screenshot decoded into VIP signal');
  }, 1150);
}

/* --- TAB, PAIR, TIMEFRAME & COPY CONTROLS --- */
function switchScannerTab(tab) {
  state.activeTab = tab;
  const liveContainer = document.getElementById('mode-live-container');
  const visionContainer = document.getElementById('mode-vision-container');
  const controls = document.getElementById('live-chart-controls');
  const liveBtn = document.getElementById('tab-live-chart');
  const visionBtn = document.getElementById('tab-vision-scan');

  const activeCls = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition flex items-center gap-2 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 text-black';
  const idleCls = 'px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition flex items-center gap-2 text-zinc-300 hover:text-amber-200';

  if (tab === 'live') {
    liveContainer.classList.remove('hidden');
    visionContainer.classList.add('hidden');
    controls.classList.remove('hidden');
    liveBtn.className = activeCls;
    visionBtn.className = idleCls;
    drawCandlestickChart();
  } else {
    liveContainer.classList.add('hidden');
    visionContainer.classList.remove('hidden');
    controls.classList.add('hidden');
    visionBtn.className = activeCls;
    liveBtn.className = idleCls;
    if (visionLoadedImage) drawVisionImage(visionLoadedImage);
  }
}

function toggleMA13() {
  state.showMA13 = !state.showMA13;
  const btn = document.getElementById('toggle-ma13');
  if (btn) {
    btn.querySelector('span:last-child').textContent = `MA 13: ${state.showMA13 ? 'ON' : 'OFF'}`;
  }
  drawCandlestickChart();
}

function copyCurrentSignal() {
  const s = state.signal;
  const text = [
    `KAIZZ AI VIP SIGNAL — ${s.pair} (${s.timeframe})`,
    `Direction: ${s.direction} | Confidence: ${s.confidence}`,
    `Entry: ${formatPrice(s.entry, s.pair)}`,
    `SL: ${formatPrice(s.sl, s.pair)}`,
    `TP1: ${formatPrice(s.tp1, s.pair)} | TP2: ${formatPrice(s.tp2, s.pair)} | TP3: ${formatPrice(s.tp3, s.pair)}`
  ].join('\n');

  navigator.clipboard?.writeText(text).catch(() => {});
  showToast('VIP signal copied to clipboard');
}

/* --- THREE.JS BACKGROUND & HERO CORE --- */
function initThreeScenes() {
  if (typeof THREE === 'undefined') return;

  // Ambient Background Particles
  const bgCanvas = document.getElementById('bg-3d-canvas');
  if (bgCanvas) {
    const bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, alpha: true, antialias: true });
    bgRenderer.setSize(window.innerWidth, window.innerHeight);
    const bgScene = new THREE.Scene();
    const bgCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    bgCam.position.z = 12;

    const count = 260;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xD4AF37, size: 0.08, transparent: true, opacity: 0.55 });
    const points = new THREE.Points(geo, mat);
    bgScene.add(points);

    const animateBg = () => {
      requestAnimationFrame(animateBg);
      points.rotation.y += 0.0008;
      bgRenderer.render(bgScene, bgCam);
    };
    animateBg();
  }

  // Interactive Hero 3D Gold Prism
  const heroCanvas = document.getElementById('hero-3d-canvas');
  const coordsEl = document.getElementById('hero-3d-coords');
  if (heroCanvas) {
    const rect = heroCanvas.parentElement.getBoundingClientRect();
    const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, alpha: true, antialias: true });
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, Math.max(1, rect.width) / Math.max(1, rect.height), 0.1, 50);
    camera.position.z = 4.2;

    const light = new THREE.PointLight(0xF3E5AB, 2.2, 20);
    light.position.set(3, 3, 4);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xD4AF37, 0.7));

    const coreGeo = new THREE.OctahedronGeometry(1.15, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xD4AF37,
      metalness: 0.85,
      roughness: 0.2,
      wireframe: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);

    const wireMat = new THREE.MeshBasicMaterial({ color: 0xF3E5AB, wireframe: true, transparent: true, opacity: 0.35 });
    const wireMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.38, 1), wireMat);

    const group = new THREE.Group();
    group.add(coreMesh);
    group.add(wireMesh);
    scene.add(group);

    let dragging = false;
    let prevX = 0;
    let prevY = 0;

    heroCanvas.addEventListener('pointerdown', e => {
      dragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    heroCanvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      group.rotation.y += (e.clientX - prevX) * 0.012;
      group.rotation.x += (e.clientY - prevY) * 0.012;
      prevX = e.clientX;
      prevY = e.clientY;
      if (coordsEl) {
        coordsEl.textContent = `X: ${group.rotation.x.toFixed(2)} Y: ${group.rotation.y.toFixed(2)}`;
      }
    });

    const animateHero = () => {
      requestAnimationFrame(animateHero);
      if (!dragging) {
        group.rotation.y += 0.006;
        group.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
      }
      renderer.render(scene, camera);
    };
    animateHero();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  Object.keys(MARKET_ASSETS).forEach(initCandles);
  renderTicker();
  updateHeaderMetrics();
  applySignalToCard();
  drawCandlestickChart();
  initThreeScenes();

  document.querySelectorAll('.pair-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pair = btn.dataset.pair;
      state.zonesVisible = false;
      document.getElementById('zone-legend-badge')?.classList.add('hidden');
      document.querySelectorAll('.pair-btn').forEach(b => {
        b.className = b === btn
          ? 'pair-btn px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-400/20 text-amber-200 border border-amber-400/50'
          : 'pair-btn px-3 py-1.5 rounded-lg text-xs font-mono font-semibold text-zinc-400 hover:text-white';
      });
      updateHeaderMetrics();
      drawCandlestickChart();
    });
  });

  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.timeframe = btn.dataset.tf;
      document.querySelectorAll('.tf-btn').forEach(b => {
        b.className = b === btn
          ? 'tf-btn px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-400/20 text-amber-200 border border-amber-400/50'
          : 'tf-btn px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold text-zinc-400 hover:text-white';
      });
      updateHeaderMetrics();
      drawCandlestickChart();
    });
  });

  window.addEventListener('resize', () => {
    if (state.activeTab === 'live') drawCandlestickChart();
    else if (visionLoadedImage) drawVisionImage(visionLoadedImage);
  });

  setInterval(tickMarket, 2500);
});
