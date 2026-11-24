const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let selectedTF = '15m';
let selectedSymbol = 'XAUUSD';
let series = [];
const basePrices = {XAUUSD:2347.8, BTCUSD:67420.5};
const fmt = (n, d=2) => n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
function makeSeries(base, count=70, drift=0.12){
  let p=base, out=[];
  for(let i=0;i<count;i++){
    const wave=Math.sin(i/6)*base*0.0007;
    const move=(Math.random()-.47)*base*0.0018 + drift*base*0.00008 + wave*0.07;
    const open=p; p=Math.max(base*.8,p+move);
    out.push({open,close:p,high:Math.max(open,p)+Math.random()*base*.0005,low:Math.min(open,p)-Math.random()*base*.0005});
  }
  return out;
}
function drawChart(){
  const canvas=$('#price-chart'), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  canvas.width=rect.width*dpr; canvas.height=260*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=rect.width,h=260, pad={l:8,r:55,t:12,b:20};
  const vals=series.flatMap(x=>[x.high,x.low]), min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const y=v=>pad.t+(max-v)/range*(h-pad.t-pad.b), step=(w-pad.l-pad.r)/series.length;
  ctx.strokeStyle='#202c38';ctx.lineWidth=1;
  for(let i=0;i<5;i++){let yy=pad.t+i*(h-pad.t-pad.b)/4;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillStyle='#6f8193';ctx.font='9px DM Mono';ctx.fillText(fmt(max-i*range/4,selectedSymbol==='BTCUSD'?0:2),w-pad.r+7,yy+3);}
  series.forEach((c,i)=>{const x=pad.l+i*step+step/2, up=c.close>=c.open, col=up?'#36d8a0':'#ff6c83';ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y(c.high));ctx.lineTo(x,y(c.low));ctx.stroke();const top=y(Math.max(c.open,c.close)),bh=Math.max(2,Math.abs(y(c.open)-y(c.close)));ctx.fillRect(x-step*.28,top,Math.max(2,step*.56),bh);});
  const last=series.at(-1).close;ctx.setLineDash([4,4]);ctx.strokeStyle='#65b9ef';ctx.beginPath();ctx.moveTo(0,y(last));ctx.lineTo(w-pad.r,y(last));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#193e58';ctx.fillRect(w-pad.r+2,y(last)-9,52,18);ctx.fillStyle='#c8eaff';ctx.font='9px DM Mono';ctx.fillText(fmt(last,selectedSymbol==='BTCUSD'?0:2),w-pad.r+6,y(last)+3);
  $('#chart-price-label').textContent='Last: '+fmt(last,selectedSymbol==='BTCUSD'?0:2);
}
function updateAsset(symbol){
  selectedSymbol=symbol; $('#asset-select').value=symbol; $('#chart-symbol').textContent=symbol;
  $$('.market-card').forEach(c=>c.classList.toggle('selected',c.dataset.symbol===symbol));
  const price=basePrices[symbol];series=makeSeries(price,70,symbol==='XAUUSD'?.15:-.08);drawChart();
}
function sma(arr,n){return arr.slice(-n).reduce((a,b)=>a+b,0)/n;}
function rsi(closes){
  let gains=0,losses=0;for(let i=closes.length-14;i<closes.length;i++){let d=closes[i]-closes[i-1];if(d>0)gains+=d;else losses-=d;}
  if(losses===0)return 100;return 100-100/(1+(gains/14)/(losses/14));
}
function runScan(){
  selectedSymbol=$('#asset-select').value;updateAsset(selectedSymbol);
  const closes=series.map(c=>c.close), last=closes.at(-1), fast=sma(closes,9), slow=sma(closes,21), momentum=last-closes.at(-6), rv=rsi(closes);
  const trend=fast>slow?'Bullish':fast<slow?'Bearish':'Sideways';
  let bias='NEUTRAL', caption='No clear directional edge', confidence=52;
  if(fast>slow && momentum>0 && rv<72){bias='BULLISH';caption='Upward momentum in this demo sample';confidence=Math.min(82,58+Math.round(Math.abs(momentum/last)*9000));}
  if(fast<slow && momentum<0 && rv>28){bias='BEARISH';caption='Downward momentum in this demo sample';confidence=Math.min(82,58+Math.round(Math.abs(momentum/last)*9000));}
  $('#empty-result').classList.add('hidden');$('#scan-result').classList.remove('hidden');
  $('#report-state').textContent='SCAN COMPLETE · DEMO';
  $('#bias-value').textContent=bias;$('#bias-value').style.color=bias==='BULLISH'?'#36d99b':bias==='BEARISH'?'#ff7187':'#b7c7d8';
  $('#bias-caption').textContent=caption;$('#trend-value').textContent=trend;$('#rsi-value').textContent=rv.toFixed(1);$('#ma-value').textContent=fast>slow?'MA9 ABOVE MA21':fast<slow?'MA9 BELOW MA21':'MAs FLAT';$('#confidence-value').textContent=confidence+'/100';
  $('#result-explain').textContent=`${selectedSymbol} · ${selectedTF}: the demo scanner compares short and medium moving averages, recent momentum and RSI. Current sample bias is ${bias.toLowerCase()}. Review the chart and indicator readings as a learning exercise; this is not a live market signal and should not be used to place trades.`;
}
$('#scan-button').addEventListener('click',runScan);$('#hero-scan').addEventListener('click',()=>{runScan();$('#scanner-panel').scrollIntoView({behavior:'smooth',block:'center'});});
$('#asset-select').addEventListener('change',e=>updateAsset(e.target.value));
$$('.market-card').forEach(c=>c.addEventListener('click',()=>updateAsset(c.dataset.symbol)));
$$('#timeframe-choices button').forEach(b=>b.addEventListener('click',()=>{$$('#timeframe-choices button').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedTF=b.dataset.tf;updateAsset(selectedSymbol);}));
$$('.timeframes button').forEach(b=>b.addEventListener('click',()=>{$$('.timeframes button').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedTF=b.textContent;}));
$('#open-terminal').addEventListener('click',()=>$('#chart-panel').scrollIntoView({behavior:'smooth'}));
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>{$$('.nav-item').forEach(x=>x.classList.remove('active'));b.classList.add('active');const map={overview:'Overview',terminal:'Market terminal',scanner:'AI scanner',signals:'Signal journal',indicators:'Indicators',settings:'Settings'};$('#page-title').textContent=map[b.dataset.view]||'Overview';if(b.dataset.view==='scanner')$('#scanner-panel').scrollIntoView({behavior:'smooth'});if(b.dataset.view==='terminal')$('#chart-panel').scrollIntoView({behavior:'smooth'});if(b.dataset.view==='signals')$('#result-panel').scrollIntoView({behavior:'smooth'});}));
$('#current-date').textContent=new Date().toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}).toUpperCase();
updateAsset('XAUUSD');window.addEventListener('resize',drawChart);
