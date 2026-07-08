// ══════════════════════════════════════════════════
// MAREBLU TRADING JOURNAL · PORTFOLIO ENGINE v4.2
// Multi-Trade · 3 Imágenes con Nota · CRT Edition
// ══════════════════════════════════════════════════

const LS_ACCOUNTS    = 'mtj_accounts_v1';
const LS_DATA_PFX    = 'mtj_data_';
const LS_CFG_PFX     = 'mtj_cfg_';
const LS_DATA_LEGACY = 'mtj_data';
const LS_CFG_LEGACY  = 'mtj_config';

let accounts        = [];
let activeAccountId = 'default';
let viewMode        = 'single';
let data            = {};
let config          = { capital: 5000 };
let curYear         = new Date().getFullYear();
let curMonth        = new Date().getMonth();
let activeDay       = null;
let curFilter       = 'all';
const TODAY         = new Date().toISOString().split('T')[0];

// ── MULTI-TRADE STATE ──
let currentDayTrades = [];
let activeTradeTab   = 0;
let activeImgTradeIdx = 0;
let activeImgSlotIdx  = 0;

// 3 imágenes por trade, cada una con su nota
const EMPTY_TRADE = () => ({
  type: null, result: '', pair: '', session: '',
  executionType: '', setupType: '', setup: '', notas: '',
  images:     [null, null, null],
  imageNotas: ['', '', '']
});

// ══════════════════════════════════════════════════
// ACCOUNT MANAGEMENT
// ══════════════════════════════════════════════════

function loadAccounts() {
  try { const r = localStorage.getItem(LS_ACCOUNTS); accounts = r ? JSON.parse(r) : []; }
  catch(e) { accounts = []; }
}
function saveAccounts() { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts)); }
function getAccountDataKey(id)   { return LS_DATA_PFX + id; }
function getAccountConfigKey(id) { return LS_CFG_PFX  + id; }
function loadAccountData(id) {
  try { const r = localStorage.getItem(getAccountDataKey(id)); return r ? JSON.parse(r) : {}; }
  catch(e) { return {}; }
}
function loadAccountConfig(id) {
  try { const r = localStorage.getItem(getAccountConfigKey(id)); return r ? JSON.parse(r) : { capital: 5000 }; }
  catch(e) { return { capital: 5000 }; }
}
function saveAccountData(id, d) { localStorage.setItem(getAccountDataKey(id), JSON.stringify(d)); }
function saveAccountConfig(id, c) { localStorage.setItem(getAccountConfigKey(id), JSON.stringify(c)); }

function migrateToMultiAccount() {
  const legacyData = localStorage.getItem(LS_DATA_LEGACY);
  const legacyCfg  = localStorage.getItem(LS_CFG_LEGACY);
  const alreadyMigrated = accounts.some(a => a.id === 'default');
  if (legacyData && !alreadyMigrated) {
    const defaultAccount = {
      id: 'default', broker: 'Personal', tipo: 'personal', fase: 'n/a',
      balanceInicial: 5000, maxDrawdown: 10, target: 10,
      label: 'Cuenta Principal', estado: 'activa', createdAt: new Date().toISOString()
    };
    accounts.unshift(defaultAccount);
    saveAccounts();
    localStorage.setItem(getAccountDataKey('default'), legacyData);
    if (legacyCfg) {
      const cfg = JSON.parse(legacyCfg);
      defaultAccount.balanceInicial = cfg.capital || 5000;
      saveAccounts();
      localStorage.setItem(getAccountConfigKey('default'), legacyCfg);
    }
    try {
      const d = JSON.parse(legacyData);
      Object.keys(d).forEach(k => { if (!d[k].accountId) d[k].accountId = 'default'; });
      localStorage.setItem(getAccountDataKey('default'), JSON.stringify(d));
    } catch(e) {}
  }
  if (accounts.length === 0) {
    accounts.push({
      id: 'default', broker: 'Personal', tipo: 'personal', fase: 'n/a',
      balanceInicial: 5000, maxDrawdown: 10, target: 10,
      label: 'Cuenta Principal', estado: 'activa', createdAt: new Date().toISOString()
    });
    saveAccounts();
  }
}

function switchAccount(id) {
  activeAccountId = id; viewMode = 'single';
  data   = loadAccountData(id);
  config = loadAccountConfig(id);
  const acct = accounts.find(a => a.id === id);
  if (acct) config.capital = config.capital || acct.balanceInicial || 5000;
  migrateAllData();
  renderAccountBar(); renderCalendar(); renderSideAcctInfo(); renderRiskCard();
}

function renderAccountBar() {
  const pills = document.getElementById('acctPills');
  if (!pills) return;
  const activeAccts = accounts.filter(a => a.estado === 'activa');
  pills.innerHTML = activeAccts.map(a => {
    const isActive = viewMode === 'single' && activeAccountId === a.id;
    const dotClass = a.tipo === 'funded' ? 'acct-pill-funded' : a.tipo === 'challenge' ? 'acct-pill-challenge' : 'acct-pill-personal';
    const label    = a.label || `${a.broker} ${a.fase !== 'n/a' ? a.fase : ''}`.trim();
    return `<button class="acct-pill${isActive?' active':''}" onclick="switchAccount('${a.id}')">
      <span class="acct-pill-dot ${dotClass}"></span>${esc(label)}
      <span style="font-size:9px;opacity:0.4;cursor:pointer;margin-left:2px" onclick="event.stopPropagation();openAcctModal('${a.id}')">✎</span>
    </button>`;
  }).join('');
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function renderSideAcctInfo() {
  const el = document.getElementById('sideAcctInfo');
  if (!el) return;
  if (viewMode === 'global') {
    el.innerHTML = `<div class="s-label">Cuenta</div><div class="acct-info-card"><div class="acct-info-broker">⊞ VISTA GLOBAL</div><div class="acct-info-row"><span class="acct-info-key">Cuentas activas</span><span class="acct-info-val">${accounts.filter(a=>a.estado==='activa').length}</span></div></div>`;
    return;
  }
  const acct = accounts.find(a => a.id === activeAccountId);
  if (!acct) return;
  const cap0      = acct.balanceInicial || 5000;
  const pnl       = Object.values(data).filter(e=>e?.totalResult!==undefined).reduce((s,e)=>s+Number(e.totalResult||0),0);
  const balActual = cap0 + pnl;
  const dd        = (pnl/cap0)*100;
  const maxDD     = acct.maxDrawdown||10;
  const ddUsed    = Math.max(0,-dd);
  const ddPct     = Math.min(100,(ddUsed/maxDD)*100);
  const tgt       = acct.target||10;
  const progPct   = Math.min(100,Math.max(0,(dd/tgt)*100));
  const label     = acct.label||`${acct.broker} ${acct.fase!=='n/a'?acct.fase:''}`.trim();
  const tipoLabel = acct.tipo==='funded'?'FUNDED':acct.tipo==='challenge'?'CHALLENGE':'PERSONAL';
  el.innerHTML = `
    <div class="s-label">Cuenta activa</div>
    <div class="acct-info-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
        <div class="acct-info-broker">${esc(label)}</div>
        <span style="font-size:8px;padding:2px 6px;border-radius:20px;background:var(--gold-bg);color:var(--gold);font-weight:700;letter-spacing:1px">${tipoLabel}</span>
      </div>
      <div class="acct-info-row"><span class="acct-info-key">Balance inicial</span><span class="acct-info-val">$${cap0.toLocaleString()}</span></div>
      <div class="acct-info-row"><span class="acct-info-key">Balance actual</span><span class="acct-info-val" style="color:${pnl>=0?'var(--win)':'var(--loss)'}">$${balActual.toFixed(2)}</span></div>
      <div class="acct-info-row"><span class="acct-info-key">P&L</span><span class="acct-info-val" style="color:${pnl>=0?'var(--win)':'var(--loss)'}">${pnl>=0?'+':''}$${pnl.toFixed(2)} (${dd>=0?'+':''}${dd.toFixed(2)}%)</span></div>
      <div class="acct-info-row"><span class="acct-info-key">Progreso target</span><span class="acct-info-val">${dd>=0?'+':''}${dd.toFixed(2)}% / ${tgt}%</span></div>
      <div class="acct-prog-bg" style="margin-top:8px"><div class="acct-prog-fill" style="width:${progPct}%;background:${progPct>=100?'var(--win)':'var(--gold)'}"></div></div>
      <div style="margin-top:7px">
        <div style="display:flex;justify-content:space-between;font-size:8px;color:var(--muted);margin-bottom:4px;letter-spacing:0.5px">
          <span>Drawdown usado</span>
          <span style="color:${ddPct>70?'var(--loss)':'var(--text2)'}">${ddUsed.toFixed(2)}% / ${maxDD}%</span>
        </div>
        <div class="dd-track"><div class="dd-fill" style="width:${ddPct}%;background:${ddPct>70?'var(--loss)':ddPct>40?'var(--gold)':'var(--text2)'}"></div></div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════
// RISK ENGINE
// ══════════════════════════════════════════════════

function calcularRiesgoCuenta(acct) {
  const cap0  = acct.balanceInicial||5000;
  const d     = loadAccountData(acct.id);
  const pnl   = Object.values(d).filter(e=>e?.totalResult!==undefined).reduce((s,e)=>s+Number(e.totalResult||0),0);
  const ddPct = (pnl/cap0)*100;
  let modo, riskPct, rrMin, mensaje, cssClass;
  if (ddPct<-3) { modo='DEFENSIVO'; riskPct=0.5; rrMin='1:2'; cssClass='risk-defensivo'; mensaje='Protegé el capital. Prioridad: sobrevivir. Sin operar por FOMO.'; }
  else if (ddPct<=1) { modo='NEUTRO'; riskPct=0.75; rrMin='1:1.5'; cssClass='risk-neutro'; mensaje='Operá con disciplina. Seguí tu plan. Sin sobredimensionar posiciones.'; }
  else { modo='AGRESIVO CONTROLADO'; riskPct=1.0; rrMin='1:1.5'; cssClass='risk-agresivo'; mensaje='Estás en ganancia. Podés crecer, pero sin salirte del plan.'; }
  return { modo, riskPct, rrMin, mensaje, cssClass, riskDollar:(cap0*riskPct/100), ddPct, pnl };
}

function renderRiskCard() {
  const el = document.getElementById('riskCard');
  if (!el) return;
  if (viewMode==='global') { el.innerHTML='<div class="risk-card risk-neutro"><div class="risk-mode">VISTA GLOBAL</div><div class="risk-dollar">Seleccioná una cuenta para ver el motor de riesgo.</div></div>'; return; }
  const acct = accounts.find(a=>a.id===activeAccountId);
  if (!acct) return;
  const r = calcularRiesgoCuenta(acct);
  el.innerHTML = `<div class="risk-card ${r.cssClass}">
    <div class="risk-mode">${r.modo}</div>
    <div class="risk-pct">${r.riskPct}%</div>
    <div class="risk-dollar">$${r.riskDollar.toFixed(2)} por trade</div>
    <div class="risk-rr">RR mínimo: <span class="risk-rr-val">${r.rrMin}</span></div>
    <div class="risk-msg">${r.mensaje}</div>
    <div class="dd-bar-wrap">
      <div class="dd-label"><span>Drawdown vs balance</span><span>${r.ddPct>=0?'+':''}${r.ddPct.toFixed(2)}%</span></div>
      <div class="dd-track"><div class="dd-fill" style="width:${Math.min(Math.max(-r.ddPct,0),100)}%;background:${r.ddPct<-3?'var(--loss)':r.ddPct<0?'var(--gold)':'var(--win)'}"></div></div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════
// DATA MANAGEMENT
// ══════════════════════════════════════════════════

function key(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmt$(n) { const v=Number(n); return (v>=0?'+$':'-$')+Math.abs(v).toFixed(2); }
function fmtP(n) { const v=Number(n); return (v>=0?'+':'')+v.toFixed(2)+'%'; }
function toast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

function migrateEntry(e) {
  if (!e) return null;
  if (e.trades && Array.isArray(e.trades)) {
    // Ensure each trade has 3 images and imageNotas
    e.trades = e.trades.map(t => ({
      ...t,
      images:     [t.images?.[0]||null, t.images?.[1]||null, t.images?.[2]||null],
      imageNotas: [t.imageNotas?.[0]||'', t.imageNotas?.[1]||'', t.imageNotas?.[2]||'']
    }));
    return e;
  }
  const m = {...e};
  if (m.ganado!==undefined && m.result===undefined) {
    m.result = m.ganado ? Math.abs(Number(m.pnl||0)) : -Math.abs(Number(m.pnl||0));
    m.type   = m.ganado ? 'TP' : 'SL';
    m.pair   = m.par||m.pair||'';
    m.session= m.sesion||m.session||'';
  }
  if (m.img && !m.images) m.images = [m.img];
  const t1 = {
    type: m.type||null, result: m.result!==undefined ? String(m.result) : '',
    pair: m.pair||'', session: m.session||'',
    executionType: m.executionType||'', setupType: m.setupType||'',
    setup: m.setup||'', notas: m.notas||'',
    images:     [m.images?.[0]||null, m.images?.[1]||null, m.images?.[2]||null],
    imageNotas: [m.imageNotas?.[0]||'', m.imageNotas?.[1]||'', m.imageNotas?.[2]||'']
  };
  const totalResult = t1.result!=='' ? parseFloat(t1.result) : 0;
  return { trades:[t1], totalResult, weekday:m.weekday||'', accountId:m.accountId||activeAccountId, result:totalResult, type:t1.type, pair:t1.pair, session:t1.session };
}

function migrateAllData() {
  let changed=false;
  Object.keys(data).forEach(k=>{
    const e=data[k];
    if (e && !Array.isArray(e.trades)) { data[k]=migrateEntry(e); changed=true; }
  });
  if (changed) saveAccountData(activeAccountId,data);
}

function getDayTotalResult(entry) {
  if (!entry) return null;
  if (entry.totalResult!==undefined) return entry.totalResult;
  if (entry.result!==undefined && entry.result!=='') return Number(entry.result);
  return null;
}

function getDayActiveTrades(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.trades)) return entry.trades.filter(t=>t.result!==''&&t.result!==undefined&&t.result!==null);
  return [];
}

function getMonthEntries(y,m) {
  const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;
  return Object.entries(data).filter(([k])=>k.startsWith(prefix)).map(([k,v])=>({...migrateEntry(v),_key:k}));
}

function getAllEntries() { return Object.entries(data).map(([k,v])=>({...migrateEntry(v),_key:k})); }

function getAllIndividualTrades() {
  const result=[];
  Object.entries(data).forEach(([k,v])=>{
    const entry=migrateEntry(v);
    if (!entry) return;
    (entry.trades||[]).forEach((t,i)=>{
      if (t.result!==''&&t.result!==undefined) {
        result.push({...t, _dayKey:k, _tradeIndex:i, weekday:entry.weekday||'', result:parseFloat(t.result)||0});
      }
    });
  });
  return result;
}

function calcStats() {
  const cap0    = config.capital||5000;
  const entries = Object.values(data).map(migrateEntry).filter(Boolean);
  const tradedDays = entries.filter(e=>getDayTotalResult(e)!==null);
  const totalPnl   = tradedDays.reduce((s,e)=>s+(getDayTotalResult(e)||0),0);
  const allTrades  = getAllIndividualTrades();
  const wins       = allTrades.filter(t=>t.result>0);
  const losses     = allTrades.filter(t=>t.result<0);
  const winRate    = allTrades.length?(wins.length/allTrades.length*100):0;
  const monthEntries = getMonthEntries(curYear,curMonth);
  const monthTraded  = monthEntries.filter(e=>getDayTotalResult(e)!==null);
  const monthPnl     = monthTraded.reduce((s,e)=>s+(getDayTotalResult(e)||0),0);
  const monthPct     = cap0?(monthPnl/cap0*100):0;
  const now=new Date();
  const startOfWeek=new Date(now); startOfWeek.setDate(now.getDate()-((now.getDay()+6)%7));
  const weekKeys=[];
  for (let i=0;i<7;i++){const d=new Date(startOfWeek);d.setDate(d.getDate()+i);weekKeys.push(d.toISOString().split('T')[0]);}
  const weekPnl=weekKeys.reduce((s,k)=>{const e=data[k]?migrateEntry(data[k]):null;return s+(getDayTotalResult(e)||0);},0);
  const weekPct=cap0?(weekPnl/cap0*100):0;
  const todayEntry=data[TODAY]?migrateEntry(data[TODAY]):null;
  const todayPnl=getDayTotalResult(todayEntry)||0;
  const todayPct=cap0?(todayPnl/cap0*100):0;
  const sortedDays=Object.keys(data).sort();
  let streak=0,streakType=null;
  for (let i=sortedDays.length-1;i>=0;i--){
    const e=migrateEntry(data[sortedDays[i]]);const r=getDayTotalResult(e);
    if (r===null) break;
    if (i===sortedDays.length-1) streakType=r>=0?'win':'loss';
    if ((streakType==='win'&&r>=0)||(streakType==='loss'&&r<0)) streak++;
    else break;
  }
  let best=null,worst=null;
  monthTraded.forEach(e=>{const r=getDayTotalResult(e);if(r===null)return;if(best===null||r>best)best=r;if(worst===null||r<worst)worst=r;});
  const greenDays=monthTraded.filter(e=>(getDayTotalResult(e)||0)>0).length;
  const redDays  =monthTraded.filter(e=>(getDayTotalResult(e)||0)<0).length;
  return {cap0,totalPnl,wins,losses,totalTrades:allTrades.length,winRate,monthPnl,monthPct,weekPct,todayPct,streak,streakType,best,worst,greenDays,redDays,monthTraded};
}

function updateSidebar() {
  if (viewMode==='global') return;
  const s=calcStats();
  const currentCap=s.cap0+s.totalPnl;
  document.getElementById('sCapital').textContent='$'+currentCap.toFixed(2);
  document.getElementById('headerCapital').textContent='$'+currentCap.toFixed(2);
  const chg=document.getElementById('sCapitalChange');
  chg.textContent=fmt$(s.totalPnl); chg.className='capital-change '+(s.totalPnl>=0?'val-win':'val-loss');
  const pnlEl=document.getElementById('sPnl');
  pnlEl.textContent=fmt$(s.totalPnl); pnlEl.className='stat-row-val '+(s.totalPnl>=0?'val-win':'val-loss');
  document.getElementById('sDiario').textContent=fmtP(s.todayPct);
  document.getElementById('sDiario').className='stat-row-val '+(s.todayPct>=0?'val-win':'val-loss');
  document.getElementById('sSemanal').textContent=fmtP(s.weekPct);
  document.getElementById('sSemanal').className='stat-row-val '+(s.weekPct>=0?'val-win':'val-loss');
  const meEl=document.getElementById('sMensual');
  meEl.textContent=fmtP(s.monthPct); meEl.className='stat-row-val '+(s.monthPct>=0?'val-win':'val-loss');
  const wr=s.winRate;
  document.getElementById('sWinRate').textContent=wr.toFixed(0)+'%';
  document.getElementById('sWinBar').style.width=wr+'%';
  document.getElementById('sWins').textContent=s.wins.length;
  document.getElementById('sLosses').textContent=s.losses.length;
  document.getElementById('sTotalTrades').textContent=s.totalTrades+' trades';
  const si=document.getElementById('streakIcon'),sv=document.getElementById('streakVal'),sl=document.getElementById('streakLbl');
  if (s.streak>0){si.textContent=s.streakType==='win'?'🔥':'🧊';sv.textContent=s.streak;sv.className='streak-val '+(s.streakType==='win'?'val-win':'val-loss');sl.textContent=s.streakType==='win'?'días ganadores':'días perdedores';}
  else {si.textContent='—';sv.textContent='0';sv.className='streak-val';sl.textContent='Sin operaciones';}
  document.getElementById('sBest').textContent=s.best!==null?fmt$(s.best):'—';
  document.getElementById('sWorst').textContent=s.worst!==null?fmt$(s.worst):'—';
  document.getElementById('sGreenDays').textContent=s.greenDays;
  document.getElementById('sRedDays').textContent=s.redDays;
  drawConsistency(); drawEquityChart();
}

function drawConsistency() {
  const now=new Date();
  const startOfWeek=new Date(now);startOfWeek.setDate(now.getDate()-((now.getDay()+6)%7));
  let html='';
  for (let i=0;i<7;i++){
    const d=new Date(startOfWeek);d.setDate(d.getDate()+i);
    const k=d.toISOString().split('T')[0];
    const e=data[k]?migrateEntry(data[k]):null;const r=getDayTotalResult(e);
    let color='var(--border2)';
    if (r!==null) color=r>=0?'rgba(62,207,122,0.5)':'rgba(224,85,85,0.5)';
    html+=`<div class="cons-dot" title="${k}" style="background:${color}"></div>`;
  }
  document.getElementById('consistencyDots').innerHTML=html;
}

function drawEquityChart() {
  const canvas=document.getElementById('equityChart');
  if (!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  canvas.width=canvas.offsetWidth*dpr;canvas.height=canvas.offsetHeight*dpr;
  ctx.scale(dpr,dpr);
  const W=canvas.offsetWidth,H=canvas.offsetHeight;
  ctx.clearRect(0,0,W,H);
  const sorted=Object.keys(data).sort();
  let cumPnl=0;const points=[{pnl:0}];
  sorted.forEach(k=>{const e=data[k]?migrateEntry(data[k]):null;const r=getDayTotalResult(e);if(r!==null){cumPnl+=r;points.push({pnl:cumPnl});}});
  if (points.length<2){ctx.fillStyle='rgba(139,146,176,0.4)';ctx.font='10px Syne';ctx.textAlign='center';ctx.fillText('Sin datos',W/2,H/2);return;}
  const vals=points.map(p=>p.pnl);const minV=Math.min(...vals),maxV=Math.max(...vals);const range=maxV-minV||1;
  const pad={t:4,b:4,l:4,r:4};const plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(points.length-1))*plotW;const toY=v=>pad.t+plotH-((v-minV)/range)*plotH;
  const isUp=points[points.length-1].pnl>=0;
  const grad=ctx.createLinearGradient(0,pad.t,0,H);
  grad.addColorStop(0,isUp?'rgba(62,207,122,0.22)':'rgba(224,85,85,0.22)');grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.moveTo(toX(0),toY(points[0].pnl));
  for(let i=1;i<points.length;i++)ctx.lineTo(toX(i),toY(points[i].pnl));
  ctx.lineTo(toX(points.length-1),H);ctx.lineTo(toX(0),H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(toX(0),toY(points[0].pnl));
  for(let i=1;i<points.length;i++)ctx.lineTo(toX(i),toY(points[i].pnl));
  ctx.strokeStyle=isUp?'rgba(62,207,122,0.8)':'rgba(224,85,85,0.8)';ctx.lineWidth=1.5;ctx.stroke();
}

// ══════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════

function renderCalendarGlobal() {
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthTitle').textContent=`${meses[curMonth]} ${curYear} — Vista Global`;
  document.getElementById('monthSub').textContent='Todas las cuentas combinadas';
  const firstDay=new Date(curYear,curMonth,1).getDay();
  const offset=(firstDay+6)%7;const daysInMonth=new Date(curYear,curMonth+1,0).getDate();
  let html='';
  for(let i=0;i<offset;i++) html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const k=key(curYear,curMonth,d);let totalPnl=0,hasAny=false;
    accounts.filter(a=>a.estado==='activa').forEach(a=>{const d2=loadAccountData(a.id);const e=d2[k]?migrateEntry(d2[k]):null;const r=getDayTotalResult(e);if(r!==null){totalPnl+=r;hasAny=true;}});
    const isToday=k===TODAY;let cls='day-cell';
    if(isToday)cls+=' today';if(hasAny&&totalPnl>0)cls+=' win-day';if(hasAny&&totalPnl<0)cls+=' loss-day';
    const resultHtml=hasAny?`<div class="day-result ${totalPnl>=0?'pos':'neg'}">${fmt$(totalPnl)}</div>`:'';
    html+=`<div class="${cls}"><div class="day-num">${d}</div>${resultHtml}</div>`;
  }
  document.getElementById('calendar').innerHTML=html;
}

function renderCalendar() {
  if (viewMode==='global'){renderCalendarGlobal();return;}
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay=new Date(curYear,curMonth,1).getDay();
  const offset=(firstDay+6)%7;const daysInMonth=new Date(curYear,curMonth+1,0).getDate();
  const monthEntries=getMonthEntries(curYear,curMonth);
  const traded=monthEntries.filter(e=>getDayTotalResult(e)!==null);
  document.getElementById('monthTitle').textContent=`${meses[curMonth]} ${curYear}`;
  let totalMonthTrades=0;
  traded.forEach(e=>{totalMonthTrades+=(e.trades||[]).filter(t=>t.result!=='').length;});
  document.getElementById('monthSub').textContent=`${totalMonthTrades} trade${totalMonthTrades!==1?'s':''} registrado${totalMonthTrades!==1?'s':''}`;
  let best=null,worst=null;
  monthEntries.forEach(e=>{const r=getDayTotalResult(e);if(r===null)return;if(best===null||r>best)best=r;if(worst===null||r<worst)worst=r;});
  let html='';
  for(let i=0;i<offset;i++) html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const k=key(curYear,curMonth,d);
    const rawEntry=data[k]||null;const e=rawEntry?migrateEntry(rawEntry):null;
    const isToday=k===TODAY;const r=getDayTotalResult(e);const hasData=r!==null;
    const isWin=hasData&&r>0;const isLoss=hasData&&r<0;
    let filteredOut=false;
    if(curFilter==='win'&&!isWin)filteredOut=true;
    if(curFilter==='loss'&&!isLoss)filteredOut=true;
    let classes='day-cell';
    if(isToday)classes+=' today';if(hasData&&r>0)classes+=' win-day';if(hasData&&r<0)classes+=' loss-day';
    if(filteredOut)classes+=' filtered-out';
    if(hasData&&r===best&&best>0)classes+=' best-day';if(hasData&&r===worst&&worst<0)classes+=' worst-day';
    const resultHtml=hasData?`<div class="day-result ${r>=0?'pos':'neg'}">${fmt$(r)}</div>`:'';
    const activeTrades=getDayActiveTrades(e);
    const tradeCountHtml=activeTrades.length>1?`<div style="font-size:7px;color:var(--muted);font-family:var(--mono)">${activeTrades.length} trades</div>`:'';
    const pairs=[...new Set(activeTrades.map(t=>t.pair).filter(Boolean))];
    const pairHtml=pairs.length?`<div style="font-size:7px;color:var(--gold);opacity:0.7;margin-top:1px;font-family:var(--mono);letter-spacing:0.3px">${pairs.join('·')}</div>`:'';
    let badgeHtml='';
    if(activeTrades.length){const types=activeTrades.map(t=>t.type).filter(Boolean);const hasTP=types.includes('TP'),hasSL=types.includes('SL');if(hasTP&&hasSL)badgeHtml='<div class="day-badge badge-mixed">±</div>';else if(hasTP)badgeHtml='<div class="day-badge badge-tp">TP</div>';else if(hasSL)badgeHtml='<div class="day-badge badge-sl">SL</div>';}
    const glowHtml=hasData?`<div style="position:absolute;inset:0;background:${r>=0?'rgba(62,207,122,0.06)':'rgba(224,85,85,0.06)'};pointer-events:none;border-radius:inherit"></div>`:'';
    html+=`<div class="${classes}" onclick="openDayModal('${k}')">
      ${badgeHtml}<div class="day-num">${d}</div>${resultHtml}${tradeCountHtml}${pairHtml}${glowHtml}
    </div>`;
  }
  document.getElementById('calendar').innerHTML=html;
  updateSidebar();renderSideAcctInfo();renderRiskCard();
}

function setFilter(f) {
  curFilter=f;
  ['All','Win','Loss'].forEach(x=>{document.getElementById(`fb${x}`).className='filter-btn';});
  if(f==='all') document.getElementById('fbAll').className='filter-btn active-all';
  if(f==='win') document.getElementById('fbWin').className='filter-btn active-win';
  if(f==='loss') document.getElementById('fbLoss').className='filter-btn active-loss';
  renderCalendar();
}

function changeMonth(dir) {
  curMonth+=dir;
  if(curMonth>11){curMonth=0;curYear++;}if(curMonth<0){curMonth=11;curYear--;}
  renderCalendar();
}

// ══════════════════════════════════════════════════
// MULTI-TRADE MODAL — 3 IMÁGENES + NOTA POR IMAGEN
// ══════════════════════════════════════════════════

let currentModalKey=null;

function openDayModal(k) {
  const [y,m,d]=k.split('-');
  currentModalKey=k;activeTradeTab=0;
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('modalDateTitle').textContent=`${parseInt(d)} de ${meses[parseInt(m)-1]} ${y}`;
  const existing=data[k]?migrateEntry(data[k]):null;
  const existingTrades=existing?.trades||[];
  currentDayTrades=[0,1,2].map(i=>{
    if (existingTrades[i]) {
      const t=existingTrades[i];
      return {
        type:t.type||null, result:t.result!==undefined?String(t.result):'',
        pair:t.pair||'', session:t.session||'',
        executionType:t.executionType||'', setupType:t.setupType||'',
        setup:t.setup||'', notas:t.notas||'',
        images:    [t.images?.[0]||null, t.images?.[1]||null, t.images?.[2]||null],
        imageNotas:[t.imageNotas?.[0]||'', t.imageNotas?.[1]||'', t.imageNotas?.[2]||'']
      };
    }
    return EMPTY_TRADE();
  });
  renderTradePanels();switchTradeTab(0);updateDaySummary();
  document.getElementById('tradeModal').classList.add('open');
}

function renderTradePanels() {
  const container=document.getElementById('tradePanels');
  container.innerHTML=currentDayTrades.map((t,i)=>buildTradePanel(t,i)).join('');
  [0,1,2].forEach(i=>{
    const tab=document.getElementById(`tradeTab${i}`);const t=currentDayTrades[i];
    const hasData=t.result!=='';tab.classList.toggle('has-data',hasData);
    if(hasData){const r=parseFloat(t.result)||0;tab.classList.toggle('tab-win',r>0);tab.classList.toggle('tab-loss',r<0);}
    else{tab.classList.remove('tab-win','tab-loss');}
  });
}

function buildTradePanel(t,i) {
  // ── PARES ACTUALIZADOS ──
  const pares=[
    {v:'SP500', l:'📈 SP500'},
    {v:'NAS100',l:'📈 NAS100'},
    {v:'US30',  l:'📈 US30'},
    {v:'RUSSEL',l:'📈 RUSSEL'},
    {v:'EURUSD',l:'💶 EURUSD'},
    {v:'GBPUSD',l:'💷 GBPUSD'},
    {v:'XAUUSD',l:'🥇 XAUUSD'},
    {v:'OTRO',  l:'✏️ OTRO'},
  ];
  const pairOptions=pares.map(p=>`<option value="${p.v}" ${t.pair===p.v?'selected':''}>${p.l}</option>`).join('');
  const sessOptions=['Asia','Londres','NY','Overlap'].map(v=>`<option value="${v}" ${t.session===v?'selected':''}>${v}</option>`).join('');
  const execOptions=[['buena','✅ Buena'],['mala','⚠ Mala'],['emocional','❌ Emocional']].map(([v,l])=>`<option value="${v}" ${t.executionType===v?'selected':''}>${l}</option>`).join('');

  // ── SETUPS SIMPLIFICADOS ──
  const setupOptions=`
    <option value="">— Setup —</option>
    <option value="Rango CRT - Order Block" ${t.setupType==='Rango CRT - Order Block'?'selected':''}>📊 Rango CRT - Order Block</option>
    <option value="Rango CRT - Continuacion" ${t.setupType==='Rango CRT - Continuacion'?'selected':''}>📊 Rango CRT - Continuación</option>`;

  // ── 3 SLOTS DE IMAGEN con nota individual ──
  const imgLabels=['📊 Análisis HTF / Bias','📍 Entrada / Setup M5','✅ Resultado / Confirmación'];
  const imgKeys  =['Análisis HTF','Entrada M5','Resultado'];

  const imgSlotsHtml=t.images.map((img,si)=>`
    <div class="img-slot-wrap" style="margin-bottom:12px">
      <div class="img-slot-label" style="font-size:10px;color:var(--gold);margin-bottom:4px;font-weight:600">${imgLabels[si]}</div>
      <div class="img-slot" id="imgSlot_${i}_${si}" onclick="triggerImgUpload(${i},${si})" style="height:140px;cursor:pointer">
        ${img
          ? `<img src="${img}" alt="img${si}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="event.stopPropagation();viewImg('${img}','${esc(t.imageNotas[si]||'')}')"><button class="img-slot-del" onclick="removeImg(event,${i},${si})">✕</button>`
          : `<span class="img-slot-ico">🖼</span><span class="img-slot-lbl">${imgKeys[si]}</span>`
        }
      </div>
      <textarea class="form-textarea img-nota-input" id="imgNota_${i}_${si}"
        placeholder="Nota sobre esta imagen..." rows="2"
        oninput="onImgNotaInput(${i},${si})"
        style="margin-top:4px;font-size:11px;resize:vertical;min-height:40px">${esc(t.imageNotas[si]||'')}</textarea>
    </div>`).join('');

  return `<div class="trade-panel" id="tradePanel${i}" style="display:none">
    <div class="result-type">
      <button class="type-btn${t.type==='TP'?' tp-active':''}" id="btnTP_${i}" onclick="setTradeType(${i},'TP')">✅ TP — Ganado</button>
      <button class="type-btn${t.type==='SL'?' sl-active':''}" id="btnSL_${i}" onclick="setTradeType(${i},'SL')">❌ SL — Perdido</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Resultado ($)</label>
        <input type="number" class="form-input" id="fRes_${i}" placeholder="Ej: 45.50" step="0.01" value="${t.result}" oninput="onTradeInput(${i})">
      </div>
      <div class="form-group">
        <label class="form-label">Par</label>
        <select class="form-select" id="fPair_${i}" onchange="onTradeInput(${i})">
          <option value="">— Par —</option>${pairOptions}
        </select>
      </div>
    </div>
    <div class="form-row-3">
      <div class="form-group">
        <label class="form-label">Sesión</label>
        <select class="form-select" id="fSess_${i}" onchange="onTradeInput(${i})">
          <option value="">— Sesión —</option>${sessOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Ejecución</label>
        <select class="form-select" id="fExec_${i}" onchange="onTradeInput(${i})">
          <option value="">— Ejecución —</option>${execOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Setup CRT</label>
        <select class="form-select" id="fSetupType_${i}" onchange="onTradeInput(${i})">${setupOptions}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group full">
        <label class="form-label">Detalle de entrada</label>
        <input type="text" class="form-input" id="fSetup_${i}" placeholder="Ej: Purge + OB H1 + FVG M5" value="${esc(t.setup)}" oninput="onTradeInput(${i})">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group full">
        <label class="form-label">Notas generales del trade</label>
        <textarea class="form-textarea" id="fNotas_${i}" placeholder="¿Qué salió bien? ¿Qué mejorar? ¿Cómo fue la ejecución?" oninput="onTradeInput(${i})">${esc(t.notas)}</textarea>
      </div>
    </div>
    <!-- 3 IMÁGENES CON NOTA INDIVIDUAL -->
    <div class="form-group" style="margin-top:12px">
      <label class="form-label" style="margin-bottom:10px">📸 Screenshots del trade — 3 imágenes con notas</label>
      ${imgSlotsHtml}
    </div>
  </div>`;
}

function switchTradeTab(idx) {
  activeTradeTab=idx;
  [0,1,2].forEach(i=>{
    document.getElementById(`tradeTab${i}`)?.classList.toggle('active',i===idx);
    const panel=document.getElementById(`tradePanel${i}`);
    if(panel)panel.style.display=i===idx?'block':'none';
  });
}

function setTradeType(tradeIdx,type) {
  currentDayTrades[tradeIdx].type=type;
  document.getElementById(`btnTP_${tradeIdx}`).className=`type-btn${type==='TP'?' tp-active':''}`;
  document.getElementById(`btnSL_${tradeIdx}`).className=`type-btn${type==='SL'?' sl-active':''}`;
  onTradeInput(tradeIdx);
}

function onTradeInput(tradeIdx) {
  const t=currentDayTrades[tradeIdx];
  t.result        =document.getElementById(`fRes_${tradeIdx}`)?.value??'';
  t.pair          =document.getElementById(`fPair_${tradeIdx}`)?.value??'';
  t.session       =document.getElementById(`fSess_${tradeIdx}`)?.value??'';
  t.executionType =document.getElementById(`fExec_${tradeIdx}`)?.value??'';
  t.setupType     =document.getElementById(`fSetupType_${tradeIdx}`)?.value??'';
  t.setup         =document.getElementById(`fSetup_${tradeIdx}`)?.value??'';
  t.notas         =document.getElementById(`fNotas_${tradeIdx}`)?.value??'';
  updateDaySummary();
  const tab=document.getElementById(`tradeTab${tradeIdx}`);
  const hasData=t.result!=='';tab.classList.toggle('has-data',hasData);
  if(hasData){const r=parseFloat(t.result)||0;tab.classList.toggle('tab-win',r>0);tab.classList.toggle('tab-loss',r<0);}
  else{tab.classList.remove('tab-win','tab-loss');}
}

function onImgNotaInput(tradeIdx,slotIdx) {
  const val=document.getElementById(`imgNota_${tradeIdx}_${slotIdx}`)?.value||'';
  currentDayTrades[tradeIdx].imageNotas[slotIdx]=val;
}

function updateDaySummary() {
  let total=0,count=0;
  currentDayTrades.forEach(t=>{if(t.result!==''&&t.result!==null&&t.result!==undefined){const v=parseFloat(t.result);if(!isNaN(v)){total+=v;count++;}}});
  const valEl=document.getElementById('daySummaryVal');const trdEl=document.getElementById('daySummaryTrades');
  if(valEl){valEl.textContent=fmt$(total);valEl.className='day-summary-val '+(total>=0?'val-win':'val-loss');}
  if(trdEl)trdEl.textContent=`${count} trade${count!==1?'s':''} activo${count!==1?'s':''}`;
}

// ── IMAGE HANDLING ──
function triggerImgUpload(tradeIdx,slotIdx) {
  activeImgTradeIdx=tradeIdx;activeImgSlotIdx=slotIdx;
  const inp=document.getElementById('fImagenMulti');
  if(inp){inp.value='';inp.click();}
}

function handleMultiImage(event) {
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    currentDayTrades[activeImgTradeIdx].images[activeImgSlotIdx]=e.target.result;
    refreshImgSlot(activeImgTradeIdx,activeImgSlotIdx);
  };
  reader.readAsDataURL(file);
}

function refreshImgSlot(tradeIdx,slotIdx) {
  const slot=document.getElementById(`imgSlot_${tradeIdx}_${slotIdx}`);
  if(!slot)return;
  const src=currentDayTrades[tradeIdx].images[slotIdx];
  const keys=['Análisis HTF','Entrada M5','Resultado'];
  if(src){
    const nota=currentDayTrades[tradeIdx].imageNotas[slotIdx]||'';
    slot.innerHTML=`<img src="${src}" alt="img${slotIdx}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="event.stopPropagation();viewImg('${src}','${esc(nota)}')"><button class="img-slot-del" onclick="removeImg(event,${tradeIdx},${slotIdx})">✕</button>`;
  } else {
    slot.innerHTML=`<span class="img-slot-ico">🖼</span><span class="img-slot-lbl">${keys[slotIdx]}</span>`;
  }
}

function removeImg(event,tradeIdx,slotIdx) {
  event.stopPropagation();
  currentDayTrades[tradeIdx].images[slotIdx]=null;
  refreshImgSlot(tradeIdx,slotIdx);
}

// ── VISOR DE IMAGEN — con nota debajo ──
function viewImg(src,nota) {
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;cursor:zoom-out';
  overlay.innerHTML=`
    <div style="position:fixed;top:16px;right:20px;color:white;font-size:28px;cursor:pointer;opacity:0.7;z-index:10000;line-height:1" onclick="document.body.removeChild(this.closest('[style*=fixed]'))">✕</div>
    <img src="${src}" style="max-width:92vw;max-height:${nota?'72vh':'85vh'};border-radius:10px;box-shadow:0 0 60px rgba(0,0,0,0.9);object-fit:contain">
    ${nota?`<div style="margin-top:16px;max-width:85vw;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 16px;color:#fff;font-size:13px;line-height:1.5;text-align:center;cursor:default" onclick="event.stopPropagation()">${esc(nota)}</div>`:''}`;
  overlay.onclick=()=>document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

// ── SAVE / CLEAR ──
function saveDay() {
  if(!currentModalKey)return;
  const k=currentModalKey;
  const dateObj=new Date(k+'T12:00:00');
  const weekdays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  onTradeInput(activeTradeTab);
  const tradesWithData=currentDayTrades.filter(t=>t.result!==''&&t.result!==null);
  if(!tradesWithData.length){
    delete data[k];saveAccountData(activeAccountId,data);
    closeTradeModal();renderCalendar();toast('Sin trades — día limpiado');return;
  }
  const totalResult=tradesWithData.reduce((s,t)=>s+(parseFloat(t.result)||0),0);
  const cleanTrades=currentDayTrades.map(t=>({
    type:t.type, result:t.result!==''?parseFloat(t.result):'',
    pair:t.pair, session:t.session,
    executionType:t.executionType, setupType:t.setupType,
    setup:t.setup, notas:t.notas,
    images:    [t.images[0]||null, t.images[1]||null, t.images[2]||null],
    imageNotas:[t.imageNotas[0]||'', t.imageNotas[1]||'', t.imageNotas[2]||''],
  }));
  data[k]={
    trades:cleanTrades, totalResult,
    weekday:weekdays[dateObj.getDay()], accountId:activeAccountId,
    result:totalResult, type:cleanTrades[0]?.type||null,
    pair:cleanTrades[0]?.pair||'', session:cleanTrades[0]?.session||'',
  };
  saveAccountData(activeAccountId,data);
  if(activeAccountId==='default')localStorage.setItem('mtj_data',JSON.stringify(data));
  closeTradeModal();renderCalendar();
  toast(`✓ ${tradesWithData.length} trade${tradesWithData.length>1?'s':''} guardado${tradesWithData.length>1?'s':''}`);
}

function clearDay() {
  if(!currentModalKey)return;
  if(!confirm('¿Borrar todos los trades de este día?'))return;
  delete data[currentModalKey];
  saveAccountData(activeAccountId,data);
  if(activeAccountId==='default')localStorage.setItem('mtj_data',JSON.stringify(data));
  closeTradeModal();renderCalendar();renderSideAcctInfo();renderRiskCard();toast('Día borrado');
}

function closeTradeModal() {
  document.getElementById('tradeModal').classList.remove('open');
  currentModalKey=null;
}

// ══════════════════════════════════════════════════
// ACCOUNT CRUD
// ══════════════════════════════════════════════════

let editingAcctId=null;

function openAcctModal(id) {
  editingAcctId=id;
  const acct=id?accounts.find(a=>a.id===id):null;
  document.getElementById('acctModalTitle').textContent=acct?'EDITAR CUENTA':'NUEVA CUENTA';
  document.getElementById('acctBroker').value  =acct?.broker        ||'';
  document.getElementById('acctBalance').value =acct?.balanceInicial||'';
  document.getElementById('acctTipo').value    =acct?.tipo          ||'challenge';
  document.getElementById('acctFase').value    =acct?.fase          ||'fase1';
  document.getElementById('acctMaxDD').value   =acct?.maxDrawdown   ||10;
  document.getElementById('acctTarget').value  =acct?.target        ||10;
  document.getElementById('acctLabel').value   =acct?.label         ||'';
  document.getElementById('acctDeleteBtn').style.display=acct?'block':'none';
  document.getElementById('acctModal').classList.add('open');
}
function closeAcctModal(){document.getElementById('acctModal').classList.remove('open');editingAcctId=null;}

function saveAccount() {
  const broker=document.getElementById('acctBroker').value.trim();
  if(!broker){alert('Ingresá el nombre del broker o firma.');return;}
  const balance=parseFloat(document.getElementById('acctBalance').value)||5000;
  const tipo=document.getElementById('acctTipo').value;
  const fase=document.getElementById('acctFase').value;
  const maxDD=parseFloat(document.getElementById('acctMaxDD').value)||10;
  const target=parseFloat(document.getElementById('acctTarget').value)||10;
  const label=document.getElementById('acctLabel').value.trim()||broker;
  if(editingAcctId){
    const idx=accounts.findIndex(a=>a.id===editingAcctId);
    if(idx>=0){
      accounts[idx]={...accounts[idx],broker,balanceInicial:balance,tipo,fase,maxDrawdown:maxDD,target,label};
      const cfg=loadAccountConfig(editingAcctId);cfg.capital=balance;saveAccountConfig(editingAcctId,cfg);
      if(editingAcctId===activeAccountId)config.capital=balance;
    }
  } else {
    const newId='acct_'+Date.now();
    accounts.push({id:newId,broker,balanceInicial:balance,tipo,fase,maxDrawdown:maxDD,target,label,estado:'activa',createdAt:new Date().toISOString()});
  }
  saveAccounts();closeAcctModal();renderAccountBar();renderSideAcctInfo();renderRiskCard();toast('Cuenta guardada ✓');
}

function deleteAccount() {
  if(!editingAcctId)return;
  const acct=accounts.find(a=>a.id===editingAcctId);
  const label=acct?.label||acct?.broker||'esta cuenta';
  if(!confirm(`¿Eliminar "${label}" y todos sus datos?\n\nEsta acción no se puede deshacer.`))return;
  const idx=accounts.findIndex(a=>a.id===editingAcctId);
  if(idx>=0)accounts.splice(idx,1);
  localStorage.removeItem(getAccountDataKey(editingAcctId));
  localStorage.removeItem(getAccountConfigKey(editingAcctId));
  if(editingAcctId==='default'){
    accounts.unshift({id:'default',broker:'Personal',tipo:'personal',fase:'n/a',balanceInicial:5000,maxDrawdown:10,target:10,label:'Cuenta Principal',estado:'activa',createdAt:new Date().toISOString()});
  }
  saveAccounts();closeAcctModal();
  const nextId=accounts.find(a=>a.estado==='activa')?.id||'default';
  switchAccount(nextId);toast('Cuenta eliminada');
}

// ══════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════

function openSettings(){document.getElementById('fCapitalInicial').value=config.capital||5000;document.getElementById('settingsModal').classList.add('open');setTimeout(()=>document.getElementById('fCapitalInicial').focus(),100);}
function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
function saveCapital(){
  const v=parseFloat(document.getElementById('fCapitalInicial').value);
  if(!v||v<=0)return;
  config.capital=v;saveAccountConfig(activeAccountId,config);
  if(activeAccountId==='default')localStorage.setItem('mtj_config',JSON.stringify(config));
  const acctIdx=accounts.findIndex(a=>a.id===activeAccountId);
  if(acctIdx>=0){accounts[acctIdx].balanceInicial=v;saveAccounts();}
  closeSettings();renderCalendar();renderSideAcctInfo();renderRiskCard();toast(`Capital: $${v.toFixed(2)}`);
}

// ══════════════════════════════════════════════════
// CONSOLIDADO
// ══════════════════════════════════════════════════

function openConsolidado(){renderConsolidado();document.getElementById('consolidadoPanel').classList.add('open');}
function closeConsolidado(){document.getElementById('consolidadoPanel').classList.remove('open');}

function renderConsolidado() {
  const el=document.getElementById('consolidadoContent');if(!el)return;
  const activeAccts=accounts.filter(a=>a.estado==='activa');
  let totalPnl=0,totalTrades=0,totalWins=0;
  const rows=activeAccts.map(acct=>{
    const d=loadAccountData(acct.id);
    const entries=Object.values(d).map(e=>migrateEntry(e)).filter(Boolean);
    const pnl=entries.reduce((s,e)=>s+(getDayTotalResult(e)||0),0);
    const allT=[];entries.forEach(e=>{(e.trades||[]).forEach(t=>{if(t.result!=='')allT.push(t);});});
    const wins=allT.filter(t=>parseFloat(t.result||0)>0).length;
    const trades=allT.length;const wr=trades?(wins/trades*100):0;
    const r=calcularRiesgoCuenta(acct);
    totalPnl+=pnl;totalTrades+=trades;totalWins+=wins;
    const tipoClass=acct.tipo==='funded'?'cons-funded':acct.tipo==='challenge'?'cons-challenge':'cons-personal';
    const label=acct.label||`${acct.broker} ${acct.fase!=='n/a'?acct.fase:''}`.trim();
    return `<div class="cons-acct-row">
      <div><div class="cons-broker">${esc(label)}</div><div style="font-size:9px;color:var(--muted)">${acct.broker}</div></div>
      <div><span class="cons-tipo ${tipoClass}">${acct.tipo.toUpperCase()}</span></div>
      <div style="font-family:var(--mono);font-weight:700;font-size:11px;color:${pnl>=0?'var(--win)':'var(--loss)'}">${pnl>=0?'+':''}$${pnl.toFixed(2)}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text2)">${wr.toFixed(0)}%</div>
      <div style="font-size:9px;font-family:var(--mono)"><span style="font-size:8px;font-weight:700;letter-spacing:1px;color:${r.modo==='DEFENSIVO'?'var(--loss)':r.modo==='NEUTRO'?'var(--gold)':'var(--win)'}">${r.modo}</span></div>
      <div style="font-size:10px;color:var(--muted)">${trades} trades</div>
    </div>`;
  }).join('');
  const globalWr=totalTrades?(totalWins/totalTrades*100):0;
  el.innerHTML=`
    <div class="cons-grid">
      <div class="cons-kpi"><div class="cons-kpi-lbl">PnL Global</div><div class="cons-kpi-val" style="color:${totalPnl>=0?'var(--win)':'var(--loss)'}">${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)}</div><div class="cons-kpi-sub">Todas las cuentas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Cuentas activas</div><div class="cons-kpi-val">${activeAccts.length}</div><div class="cons-kpi-sub">${accounts.filter(a=>a.estado==='inactiva').length} inactivas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Total Trades</div><div class="cons-kpi-val">${totalTrades}</div><div class="cons-kpi-sub">Todas las cuentas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Win Rate Global</div><div class="cons-kpi-val">${globalWr.toFixed(0)}%</div><div class="cons-kpi-sub">${totalWins} ganadores</div></div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div class="cons-acct-row header"><div>Cuenta</div><div>Tipo</div><div>P&L</div><div>WR</div><div>Modo</div><div>Trades</div></div>
      ${rows||'<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">No hay cuentas activas.</div>'}
    </div>
    <div style="margin-top:10px;font-size:9px;color:var(--muted);text-align:right">PnL global · ${new Date().toLocaleString('es-PY')}</div>`;
}

// ══════════════════════════════════════════════════
// BACKUP
// ══════════════════════════════════════════════════

function exportBackup() {
  const backup={_version:2,_exportedAt:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(k&&(k===LS_ACCOUNTS||k===LS_DATA_LEGACY||k===LS_CFG_LEGACY||k.startsWith(LS_DATA_PFX)||k.startsWith(LS_CFG_PFX))){backup.data[k]=localStorage.getItem(k);}
  }
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=`mareblu-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  toast('✓ Backup exportado');
}

function importBackup() {
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const backup=JSON.parse(ev.target.result);
        if(!backup._version||!backup.data){alert('Archivo inválido.');return;}
        if(!confirm(`¿Restaurar backup del ${backup._exportedAt?.slice(0,10)}?\n\nEsto reemplazará todos los datos actuales.`))return;
        Object.entries(backup.data).forEach(([k,v])=>localStorage.setItem(k,v));
        toast('✓ Backup restaurado — recargando…');setTimeout(()=>location.reload(),1200);
      }catch(err){alert('Error al leer el archivo.');}
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);input.click();document.body.removeChild(input);
}

// ══════════════════════════════════════════════════
// INTELLIGENCE ENGINE
// ══════════════════════════════════════════════════

let intelCurTab='dashboard';
function openIntel(){migrateAllData();document.getElementById('intelPanel').classList.add('open');renderIntel(intelCurTab);}
function closeIntel(){document.getElementById('intelPanel').classList.remove('open');}

function switchIntelTab(tab) {
  intelCurTab=tab;
  document.querySelectorAll('.intel-tab').forEach(el=>el.classList.remove('active'));
  const tabs=['dashboard','pares','sesiones','dias','setups','insights'];
  const idx=tabs.indexOf(tab);if(idx>=0)document.querySelectorAll('.intel-tab')[idx].classList.add('active');
  renderIntel(tab);
}

function analizarPatronesTrading() {
  const all=getAllIndividualTrades().filter(t=>t.result!==''&&t.result!==undefined);
  function groupBy(key){
    const groups={};
    all.forEach(e=>{const k=e[key]||'Sin especificar';if(!groups[k])groups[k]={trades:0,wins:0,pnl:0};groups[k].trades++;if(Number(e.result)>0)groups[k].wins++;groups[k].pnl+=Number(e.result||0);});
    return Object.entries(groups).map(([name,d])=>({name,trades:d.trades,wins:d.wins,pnl:d.pnl,winRate:d.trades?(d.wins/d.trades*100):0,avgPnl:d.trades?(d.pnl/d.trades):0})).sort((a,b)=>b.pnl-a.pnl);
  }
  const porPar=groupBy('pair');const porSession=groupBy('session');const porSetup=groupBy('setupType');const porExec=groupBy('executionType');
  const dayOrder=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const porDia=groupBy('weekday').sort((a,b)=>dayOrder.indexOf(a.name)-dayOrder.indexOf(b.name));
  return {porPar,porSession,porSetup,porDia,porExec,total:all.length};
}

function renderIntel(tab) {
  const p=analizarPatronesTrading();const el=document.getElementById('intelContent');
  if(!p.total){el.innerHTML='<div class="i-empty">No hay operaciones registradas.<br>Registrá trades con par, sesión y setup para ver inteligencia.</div>';return;}
  if(tab==='dashboard') el.innerHTML=renderIntelDashboard(p);
  if(tab==='pares')     el.innerHTML=renderIntelTable(p.porPar,'Por Par','🪙');
  if(tab==='sesiones')  el.innerHTML=renderIntelTable(p.porSession,'Por Sesión','🕐');
  if(tab==='dias')      el.innerHTML=renderIntelTable(p.porDia,'Por Día de la Semana','📅');
  if(tab==='setups')    el.innerHTML=renderIntelTable(p.porSetup,'Por Setup','🧠');
  if(tab==='insights')  el.innerHTML=renderIntelInsights(p);
}

function renderIntelDashboard(p) {
  const bestPar =[...p.porPar].filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestSess=[...p.porSession].filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestDia =[...p.porDia].filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestSet =[...p.porSetup].filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestPnl =[...p.porPar].sort((a,b)=>b.pnl-a.pnl)[0];
  const card=(icon,label,val,sub,color='var(--gold)')=>`<div class="i-card"><div class="i-card-icon">${icon}</div><div class="i-card-label">${label}</div><div class="i-card-val" style="color:${color}">${val}</div><div class="i-card-sub">${sub}</div></div>`;
  return `<div class="i-grid">
    ${bestPar ?card('🪙','Mejor Par',   bestPar.name, `${bestPar.winRate.toFixed(0)}% WR · ${bestPar.trades} trades`):card('🪙','Mejor Par','—','Sin datos')}
    ${bestSess?card('🕐','Mejor Sesión',bestSess.name,`${bestSess.winRate.toFixed(0)}% WR · ${fmt$(bestSess.pnl)} PnL`):card('🕐','Mejor Sesión','—','Sin datos')}
    ${bestDia ?card('📅','Mejor Día',   bestDia.name, `${bestDia.winRate.toFixed(0)}% WR · ${bestDia.trades} trades`):card('📅','Mejor Día','—','Sin datos')}
    ${bestSet ?card('🧠','Mejor Setup', bestSet.name, `${bestSet.winRate.toFixed(0)}% WR · ${bestSet.trades} ops`):card('🧠','Mejor Setup','—','Sin datos')}
    ${bestPnl ?card('💰','Mayor PnL',   bestPnl.name, `${fmt$(bestPnl.pnl)} total`,bestPnl.pnl>=0?'var(--win)':'var(--loss)'):''}
  </div>
  ${p.porPar.length?`<div class="i-section-title">Rendimiento por par</div>${renderMiniTable(p.porPar.slice(0,5))}`:''}
  ${p.porSession.length?`<div class="i-section-title">Rendimiento por sesión</div>${renderMiniTable(p.porSession)}`:''}`;
}

function renderMiniTable(rows) {
  return `<table class="i-table"><thead><tr><th>#</th><th>Nombre</th><th>Trades</th><th>Win Rate</th><th>PnL Total</th><th>Avg PnL</th></tr></thead><tbody>
    ${rows.map((r,i)=>`<tr>
      <td class="i-rank">${i+1}</td><td class="i-name">${r.name}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--text2)">${r.trades}</td>
      <td><span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${r.winRate>=55?'var(--win)':r.winRate>=40?'var(--gold)':'var(--loss)'}">${r.winRate.toFixed(0)}%</span>
        <span class="i-bar-wrap"><span class="i-bar-fill" style="width:${r.winRate}%;background:${r.winRate>=55?'rgba(62,207,122,0.7)':r.winRate>=40?'rgba(200,168,75,0.7)':'rgba(224,85,85,0.7)'}"></span></span></td>
      <td style="font-family:var(--mono);font-size:11px;font-weight:700;color:${r.pnl>=0?'var(--win)':'var(--loss)'}">${fmt$(r.pnl)}</td>
      <td style="font-family:var(--mono);font-size:10px;color:${r.avgPnl>=0?'rgba(62,207,122,0.8)':'rgba(224,85,85,0.8)'}">${fmt$(r.avgPnl)}</td>
    </tr>`).join('')}
  </tbody></table>`;
}

function renderIntelTable(rows,title,icon){
  if(!rows.length)return'<div class="i-empty">Sin datos para este análisis.</div>';
  return`<div class="i-section-title">${icon} ${title} · ${rows.length} categoría${rows.length!==1?'s':''}</div>${renderMiniTable(rows)}`;
}

function renderIntelInsights(p) {
  const ins=[];
  const pares=[...p.porPar].filter(r=>r.trades>=3);
  if(pares.length){
    const best=[...pares].sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'🪙',txt:`<strong>${best.name}</strong> es tu par más rentable con <strong>${best.winRate.toFixed(0)}% win rate</strong> en ${best.trades} trades (PnL: ${fmt$(best.pnl)}).`});
    const worst=[...pares].sort((a,b)=>a.winRate-b.winRate)[0];
    if(worst.winRate<40)ins.push({ico:'⚠️',txt:`<strong>${worst.name}</strong> tiene bajo rendimiento (${worst.winRate.toFixed(0)}% WR). Evaluar si conviene seguir operando este par.`});
  }
  const sess=[...p.porSession].filter(r=>r.trades>=2);
  if(sess.length){
    const best=[...sess].sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'🕐',txt:`Sesión <strong>${best.name}</strong> es la más rentable: ${best.winRate.toFixed(0)}% WR con ${fmt$(best.pnl)} PnL acumulado.`});
    const worst=[...sess].sort((a,b)=>a.pnl-b.pnl)[0];
    if(worst.pnl<0)ins.push({ico:'⚠️',txt:`Sesión <strong>${worst.name}</strong> genera pérdidas (${fmt$(worst.pnl)}). Considerar reducir operaciones en ese horario.`});
  }
  const dias=[...p.porDia].filter(r=>r.trades>=2);
  if(dias.length){
    const best=[...dias].sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'📅',txt:`<strong>${best.name}</strong> es tu mejor día con ${best.winRate.toFixed(0)}% WR en ${best.trades} sesiones.`});
    const worst=[...dias].sort((a,b)=>a.pnl-b.pnl)[0];
    if(worst.pnl<0)ins.push({ico:'📅',txt:`<strong>${worst.name}</strong> es tu peor día (${fmt$(worst.pnl)}). Evaluar descanso ese día.`});
  }
  const setups=[...p.porSetup].filter(r=>r.trades>=2);
  if(setups.length){const best=[...setups].sort((a,b)=>b.winRate-a.winRate)[0];ins.push({ico:'🧠',txt:`Setup <strong>${best.name}</strong> tiene el mayor win rate: ${best.winRate.toFixed(0)}% en ${best.trades} operaciones.`});}
  if(!ins.length)return'<div class="i-empty">Registrá al menos 3–5 trades con par, sesión y setup para ver insights.</div>';
  return ins.map(i=>`<div class="i-insight"><span class="i-insight-ico">${i.ico}</span><span class="i-insight-text">${i.txt}</span></div>`).join('');
}

// ══════════════════════════════════════════════════
// HEATMAP ENGINE
// ══════════════════════════════════════════════════

let heatmapCurTab='hora';
function openHeatmap(){document.getElementById('heatmapPanel').classList.add('open');renderHeatmap(heatmapCurTab);}
function closeHeatmap(){document.getElementById('heatmapPanel').classList.remove('open');}

function switchHeatmapTab(tab){
  heatmapCurTab=tab;
  document.querySelectorAll('.heatmap-tab').forEach(el=>el.classList.remove('active'));
  document.getElementById('htab-'+tab)?.classList.add('active');
  renderHeatmap(tab);
}

function renderHeatmap(tab){
  const el=document.getElementById('heatmapContent');if(!el)return;
  const trades=getAllIndividualTrades().filter(t=>t.result!==''&&t.result!==undefined);
  if(!trades.length){el.innerHTML='<div class="i-empty">Sin trades registrados.<br>Registrá sesión en cada trade para ver el mapa de calor.</div>';return;}
  if(tab==='hora')   el.innerHTML=renderHeatmapSesionHora(trades);
  if(tab==='dia')    el.innerHTML=renderHeatmapDia(trades);
  if(tab==='sesion') el.innerHTML=renderHeatmapSesion(trades);
}

function heatColor(pnl,maxAbs){
  if(maxAbs===0)return'rgba(42,48,72,0.6)';
  const ratio=Math.max(-1,Math.min(1,pnl/maxAbs));
  if(ratio>0){const a=Math.min(0.9,0.15+ratio*0.75);return`rgba(62,207,122,${a.toFixed(2)})`;}
  else if(ratio<0){const a=Math.min(0.9,0.15+Math.abs(ratio)*0.75);return`rgba(224,85,85,${a.toFixed(2)})`;}
  return'rgba(42,48,72,0.6)';
}
function heatTextColor(pnl,maxAbs){if(maxAbs===0)return'var(--muted)';return Math.abs(pnl/maxAbs)>0.3?'#fff':'var(--text2)';}

function renderHeatmapSesionHora(trades){
  const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const sessions=['Asia','Londres','NY','Overlap'];
  const matrix={};
  days.forEach(d=>{matrix[d]={};sessions.forEach(s=>{matrix[d][s]={pnl:0,count:0,wins:0};});});
  trades.forEach(t=>{const day=t.weekday||'';const ses=t.session||'';if(matrix[day]&&matrix[day][ses]!==undefined){matrix[day][ses].pnl+=Number(t.result||0);matrix[day][ses].count++;if(Number(t.result)>0)matrix[day][ses].wins++;}});
  let maxAbs=0;days.forEach(d=>sessions.forEach(s=>{const v=Math.abs(matrix[d][s].pnl);if(v>maxAbs)maxAbs=v;}));
  const totalPnl=trades.reduce((s,t)=>s+Number(t.result||0),0);
  const wins=trades.filter(t=>Number(t.result)>0).length;const wr=trades.length?(wins/trades.length*100):0;
  let bestCell=null,bestPnl=-Infinity;
  days.forEach(d=>sessions.forEach(s=>{if(matrix[d][s].count>0&&matrix[d][s].pnl>bestPnl){bestPnl=matrix[d][s].pnl;bestCell=`${d} · ${s}`;}}));
  let html=`<div class="hm-stats-row">
    <div class="hm-stat"><div class="hm-stat-lbl">P&L Total</div><div class="hm-stat-val" style="color:${totalPnl>=0?'var(--win)':'var(--loss)'}">${fmt$(totalPnl)}</div></div>
    <div class="hm-stat"><div class="hm-stat-lbl">Total Trades</div><div class="hm-stat-val">${trades.length}</div></div>
    <div class="hm-stat"><div class="hm-stat-lbl">Win Rate</div><div class="hm-stat-val" style="color:var(--win)">${wr.toFixed(0)}%</div></div>
    <div class="hm-stat"><div class="hm-stat-lbl">Mejor combo</div><div class="hm-stat-val" style="color:var(--gold);font-size:11px">${bestCell||'—'}</div></div>
  </div>
  <div class="hm-legend"><span style="color:var(--loss)">■</span> Pérdida <span style="color:var(--muted);margin:0 8px">■</span> Sin datos <span style="color:var(--win)">■</span> Ganancia</div>
  <div class="hm-grid-wrap"><table class="hm-table"><thead><tr><th class="hm-th-day"></th>${sessions.map(s=>`<th class="hm-th-sess">${s}</th>`).join('')}<th class="hm-th-sess">Total día</th></tr></thead><tbody>`;
  days.forEach(day=>{
    const dayTotal=sessions.reduce((s,ses)=>s+matrix[day][ses].pnl,0);
    const dayCount=sessions.reduce((s,ses)=>s+matrix[day][ses].count,0);
    html+=`<tr><td class="hm-td-day">${day}</td>`;
    sessions.forEach(ses=>{
      const cell=matrix[day][ses];const bg=heatColor(cell.pnl,maxAbs);const tc=heatTextColor(cell.pnl,maxAbs);
      const wr=cell.count?(cell.wins/cell.count*100).toFixed(0):null;
      if(cell.count===0)html+=`<td class="hm-td empty"><span class="hm-empty">—</span></td>`;
      else html+=`<td class="hm-td" style="background:${bg}"><div class="hm-cell-pnl" style="color:${tc}">${fmt$(cell.pnl)}</div><div class="hm-cell-meta" style="color:${tc};opacity:0.75">${cell.count}t · ${wr}%wr</div></td>`;
    });
    const dayBg=dayCount>0?heatColor(dayTotal,maxAbs):'transparent';const dayTc=dayCount>0?heatTextColor(dayTotal,maxAbs):'var(--muted)';
    html+=`<td class="hm-td hm-td-total" style="background:${dayBg}">${dayCount>0?`<div class="hm-cell-pnl" style="color:${dayTc}">${fmt$(dayTotal)}</div><div class="hm-cell-meta" style="color:${dayTc};opacity:0.75">${dayCount} trades</div>`:'<span class="hm-empty">—</span>'}</td></tr>`;
  });
  html+=`<tr><td class="hm-td-day" style="color:var(--gold);font-weight:700">Total</td>`;
  sessions.forEach(ses=>{
    const total=days.reduce((s,d)=>s+matrix[d][ses].pnl,0);const count=days.reduce((s,d)=>s+matrix[d][ses].count,0);
    const bg=count>0?heatColor(total,maxAbs):'transparent';const tc=count>0?heatTextColor(total,maxAbs):'var(--muted)';
    html+=`<td class="hm-td hm-td-total" style="background:${bg}">${count>0?`<div class="hm-cell-pnl" style="color:${tc}">${fmt$(total)}</div><div class="hm-cell-meta" style="color:${tc};opacity:0.75">${count} trades</div>`:'<span class="hm-empty">—</span>'}</td>`;
  });
  html+=`<td class="hm-td hm-td-total" style="background:${heatColor(totalPnl,maxAbs)}"><div class="hm-cell-pnl" style="color:${heatTextColor(totalPnl,maxAbs)}">${fmt$(totalPnl)}</div><div class="hm-cell-meta" style="color:${heatTextColor(totalPnl,maxAbs)};opacity:0.75">${trades.length}t</div></td></tr>`;
  html+=`</tbody></table></div>`;return html;
}

function renderHeatmapDia(trades){
  const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const stats={};days.forEach(d=>{stats[d]={pnl:0,count:0,wins:0};});
  trades.forEach(t=>{const d=t.weekday||'';if(stats[d]){stats[d].pnl+=Number(t.result||0);stats[d].count++;if(Number(t.result)>0)stats[d].wins++;}});
  const maxAbs=Math.m
