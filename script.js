// ══════════════════════════════════════════════════
// MAREBLU TRADING JOURNAL · PORTFOLIO ENGINE v4
// Design: Formatum Divinum Noir Edition
// ══════════════════════════════════════════════════

// ── LS KEYS ──
const LS_ACCOUNTS    = 'mtj_accounts_v1';
const LS_DATA_PFX    = 'mtj_data_';
const LS_CFG_PFX     = 'mtj_cfg_';
const LS_DATA_LEGACY = 'mtj_data';
const LS_CFG_LEGACY  = 'mtj_config';

// ── MULTI-ACCOUNT STATE ──
let accounts        = [];
let activeAccountId = 'default';
let viewMode        = 'single';

// ── PER-ACCOUNT STATE ──
let data      = {};
let config    = { capital: 5000 };
let curYear   = new Date().getFullYear();
let curMonth  = new Date().getMonth();
let activeDay = null;
let curFilter = 'all';
const TODAY   = new Date().toISOString().split('T')[0];

// ══════════════════════════════════════════════════
// ACCOUNT MANAGEMENT
// ══════════════════════════════════════════════════

function loadAccounts() {
  try {
    const raw = localStorage.getItem(LS_ACCOUNTS);
    accounts = raw ? JSON.parse(raw) : [];
  } catch(e) { accounts = []; }
}

function saveAccounts() {
  localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
}

function getAccountDataKey(id)   { return LS_DATA_PFX + id; }
function getAccountConfigKey(id) { return LS_CFG_PFX  + id; }

function loadAccountData(id) {
  try {
    const raw = localStorage.getItem(getAccountDataKey(id));
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function loadAccountConfig(id) {
  try {
    const raw = localStorage.getItem(getAccountConfigKey(id));
    return raw ? JSON.parse(raw) : { capital: 5000 };
  } catch(e) { return { capital: 5000 }; }
}

function saveAccountData(id, d) {
  localStorage.setItem(getAccountDataKey(id), JSON.stringify(d));
}

function saveAccountConfig(id, c) {
  localStorage.setItem(getAccountConfigKey(id), JSON.stringify(c));
}

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
  activeAccountId = id;
  viewMode = 'single';
  data   = loadAccountData(id);
  config = loadAccountConfig(id);
  const acct = accounts.find(a => a.id === id);
  if (acct) config.capital = config.capital || acct.balanceInicial || 5000;
  migrateAllData();
  renderAccountBar();
  renderCalendar();
  renderSideAcctInfo();
  renderRiskCard();
}

function switchToGlobal() {
  viewMode = 'global';
  renderAccountBar();
  renderCalendarGlobal();
  renderSideAcctInfo();
  renderRiskCard();
}

function renderAccountBar() {
  const pills = document.getElementById('acctPills');
  if (!pills) return;
  const activeAccts = accounts.filter(a => a.estado === 'activa');
  pills.innerHTML = activeAccts.map(a => {
    const isActive  = viewMode === 'single' && activeAccountId === a.id;
    const dotClass  = a.tipo === 'funded' ? 'acct-pill-funded' : a.tipo === 'challenge' ? 'acct-pill-challenge' : 'acct-pill-personal';
    const label     = a.label || `${a.broker} ${a.fase !== 'n/a' ? a.fase : ''}`.trim();
    return `<button class="acct-pill${isActive ? ' active' : ''}" onclick="switchAccount('${a.id}')">
      <span class="acct-pill-dot ${dotClass}"></span>
      ${esc(label)}
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

  const cap0     = acct.balanceInicial || 5000;
  const pnl      = Object.values(data).filter(e => e?.result !== '' && e?.result !== undefined).reduce((s,e) => s + Number(e.result||0), 0);
  const balActual = cap0 + pnl;
  const dd        = ((pnl / cap0) * 100);
  const maxDD     = acct.maxDrawdown || 10;
  const ddUsed    = Math.max(0, -dd);
  const ddPct     = Math.min(100, (ddUsed / maxDD) * 100);
  const tgt       = acct.target || 10;
  const progPct   = Math.min(100, Math.max(0, (dd / tgt) * 100));
  const label     = acct.label || `${acct.broker} ${acct.fase !== 'n/a' ? acct.fase : ''}`.trim();
  const tipoLabel = acct.tipo === 'funded' ? 'FUNDED' : acct.tipo === 'challenge' ? 'CHALLENGE' : 'PERSONAL';

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
    </div>
  `;
}

// ══════════════════════════════════════════════════
// RISK ENGINE
// ══════════════════════════════════════════════════

function calcularRiesgoCuenta(acct) {
  const cap0  = acct.balanceInicial || 5000;
  const d     = loadAccountData(acct.id);
  const pnl   = Object.values(d).filter(e=>e?.result!==''&&e?.result!==undefined).reduce((s,e)=>s+Number(e.result||0),0);
  const ddPct = (pnl / cap0) * 100;

  let modo, riskPct, rrMin, mensaje, cssClass;

  if (ddPct < -3) {
    modo = 'DEFENSIVO'; riskPct = 0.5; rrMin = '1:2'; cssClass = 'risk-defensivo';
    mensaje = 'Protegé el capital. Prioridad: sobrevivir. Sin operar por FOMO.';
  } else if (ddPct <= 1) {
    modo = 'NEUTRO'; riskPct = 0.75; rrMin = '1:1.5'; cssClass = 'risk-neutro';
    mensaje = 'Operá con disciplina. Seguí tu plan. Sin sobredimensionar posiciones.';
  } else {
    modo = 'AGRESIVO CONTROLADO'; riskPct = 1.0; rrMin = '1:1.5'; cssClass = 'risk-agresivo';
    mensaje = 'Estás en ganancia. Podés crecer, pero sin salirte del plan. Capital protegido.';
  }

  const riskDollar = (cap0 * riskPct / 100);
  return { modo, riskPct, rrMin, mensaje, cssClass, riskDollar, ddPct, pnl };
}

function renderRiskCard() {
  const el = document.getElementById('riskCard');
  if (!el) return;

  if (viewMode === 'global') {
    el.innerHTML = '<div class="risk-card risk-neutro"><div class="risk-mode">VISTA GLOBAL</div><div class="risk-dollar">Seleccioná una cuenta para ver el motor de riesgo.</div></div>';
    return;
  }

  const acct = accounts.find(a => a.id === activeAccountId);
  if (!acct) return;

  const r = calcularRiesgoCuenta(acct);
  el.innerHTML = `
    <div class="risk-card ${r.cssClass}">
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
// CONSOLIDADO GLOBAL
// ══════════════════════════════════════════════════

function openConsolidado() {
  renderConsolidado();
  document.getElementById('consolidadoPanel').classList.add('open');
}
function closeConsolidado() {
  document.getElementById('consolidadoPanel').classList.remove('open');
}

function renderConsolidado() {
  const el = document.getElementById('consolidadoContent');
  if (!el) return;

  const activeAccts = accounts.filter(a => a.estado === 'activa');
  let totalPnl = 0, totalTrades = 0, totalWins = 0;

  const rows = activeAccts.map(acct => {
    const d      = loadAccountData(acct.id);
    const entries = Object.values(d).filter(e => e?.result !== '' && e?.result !== undefined);
    const pnl    = entries.reduce((s,e) => s + Number(e.result||0), 0);
    const wins   = entries.filter(e => Number(e.result) > 0).length;
    const trades = entries.length;
    const wr     = trades ? (wins/trades*100) : 0;
    const cap0   = acct.balanceInicial || 5000;
    const r      = calcularRiesgoCuenta(acct);

    totalPnl    += pnl;
    totalTrades += trades;
    totalWins   += wins;

    const tipoClass = acct.tipo === 'funded' ? 'cons-funded' : acct.tipo === 'challenge' ? 'cons-challenge' : 'cons-personal';
    const label     = acct.label || `${acct.broker} ${acct.fase !== 'n/a' ? acct.fase : ''}`.trim();

    return `<div class="cons-acct-row">
      <div>
        <div class="cons-broker">${esc(label)}</div>
        <div style="font-size:9px;color:var(--muted)">${acct.broker}</div>
      </div>
      <div><span class="cons-tipo ${tipoClass}">${acct.tipo.toUpperCase()}</span></div>
      <div style="font-family:var(--mono);font-weight:700;font-size:11px;color:${pnl>=0?'var(--win)':'var(--loss)'}">${pnl>=0?'+':''}$${pnl.toFixed(2)}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text2)">${wr.toFixed(0)}%</div>
      <div style="font-size:9px;font-family:var(--mono)"><span style="font-size:8px;font-weight:700;letter-spacing:1px;color:${r.modo==='DEFENSIVO'?'var(--loss)':r.modo==='NEUTRO'?'var(--gold)':'var(--win)'}">${r.modo}</span></div>
      <div style="font-size:10px;color:var(--muted)">${trades} ops</div>
    </div>`;
  }).join('');

  const globalWr = totalTrades ? (totalWins/totalTrades*100) : 0;

  el.innerHTML = `
    <div class="cons-grid">
      <div class="cons-kpi"><div class="cons-kpi-lbl">PnL Global</div><div class="cons-kpi-val" style="color:${totalPnl>=0?'var(--win)':'var(--loss)'}">${totalPnl>=0?'+':''}$${totalPnl.toFixed(2)}</div><div class="cons-kpi-sub">Todas las cuentas activas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Cuentas activas</div><div class="cons-kpi-val">${activeAccts.length}</div><div class="cons-kpi-sub">${accounts.filter(a=>a.estado==='inactiva').length} inactivas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Total Trades</div><div class="cons-kpi-val">${totalTrades}</div><div class="cons-kpi-sub">Todas las cuentas</div></div>
      <div class="cons-kpi"><div class="cons-kpi-lbl">Win Rate Global</div><div class="cons-kpi-val">${globalWr.toFixed(0)}%</div><div class="cons-kpi-sub">${totalWins} ganadores</div></div>
    </div>
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div class="cons-acct-row header">
        <div>Cuenta</div><div>Tipo</div><div>P&L</div><div>WR</div><div>Modo</div><div>Trades</div>
      </div>
      ${rows || '<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">No hay cuentas activas.</div>'}
    </div>
    <div style="margin-top:10px;font-size:9px;color:var(--muted);text-align:right;letter-spacing:0.3px">
      PnL global actualizado en tiempo real · ${new Date().toLocaleString('es-PY')}
    </div>`;
}

// ══════════════════════════════════════════════════
// ACCOUNT CRUD MODAL
// ══════════════════════════════════════════════════

let editingAcctId = null;

function openAcctModal(id) {
  editingAcctId = id;
  const acct = id ? accounts.find(a => a.id === id) : null;
  document.getElementById('acctModalTitle').textContent = acct ? 'EDITAR CUENTA' : 'NUEVA CUENTA';
  document.getElementById('acctBroker').value   = acct?.broker        || '';
  document.getElementById('acctBalance').value  = acct?.balanceInicial|| '';
  document.getElementById('acctTipo').value     = acct?.tipo          || 'challenge';
  document.getElementById('acctFase').value     = acct?.fase          || 'fase1';
  document.getElementById('acctMaxDD').value    = acct?.maxDrawdown   || 10;
  document.getElementById('acctTarget').value   = acct?.target        || 10;
  document.getElementById('acctLabel').value    = acct?.label         || '';
  // Mostrar botón eliminar para TODAS las cuentas incluyendo default
  document.getElementById('acctDeleteBtn').style.display = acct ? 'block' : 'none';
  document.getElementById('acctModal').classList.add('open');
}

function closeAcctModal() {
  document.getElementById('acctModal').classList.remove('open');
  editingAcctId = null;
}

// ── FIX: saveAccount — guarda label correctamente incluyendo cuenta principal ──
function saveAccount() {
  const broker = document.getElementById('acctBroker').value.trim();
  if (!broker) { alert('Ingresá el nombre del broker o firma.'); return; }

  const balance = parseFloat(document.getElementById('acctBalance').value) || 5000;
  const tipo    = document.getElementById('acctTipo').value;
  const fase    = document.getElementById('acctFase').value;
  const maxDD   = parseFloat(document.getElementById('acctMaxDD').value) || 10;
  const target  = parseFloat(document.getElementById('acctTarget').value) || 10;
  const label   = document.getElementById('acctLabel').value.trim() || broker;

  if (editingAcctId) {
    const idx = accounts.findIndex(a => a.id === editingAcctId);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], broker, balanceInicial: balance, tipo, fase, maxDrawdown: maxDD, target, label };
      // Actualizar config de capital también
      const cfg = loadAccountConfig(editingAcctId);
      cfg.capital = balance;
      saveAccountConfig(editingAcctId, cfg);
      if (editingAcctId === activeAccountId) config.capital = balance;
    }
  } else {
    const newId = 'acct_' + Date.now();
    accounts.push({
      id: newId, broker, balanceInicial: balance, tipo, fase,
      maxDrawdown: maxDD, target, label, estado: 'activa',
      createdAt: new Date().toISOString()
    });
  }
  saveAccounts();
  closeAcctModal();
  renderAccountBar();
  renderSideAcctInfo();
  renderRiskCard();
  toast('Cuenta guardada ✓');
}

// ── FIX: deleteAccount — permite eliminar cualquier cuenta incluyendo default ──
function deleteAccount() {
  if (!editingAcctId) return;
  const acct = accounts.find(a => a.id === editingAcctId);
  const label = acct?.label || acct?.broker || 'esta cuenta';
  if (!confirm(`¿Eliminar "${label}" y todos sus datos?\n\nEsta acción no se puede deshacer.`)) return;
  const idx = accounts.findIndex(a => a.id === editingAcctId);
  if (idx >= 0) accounts.splice(idx, 1);
  localStorage.removeItem(getAccountDataKey(editingAcctId));
  localStorage.removeItem(getAccountConfigKey(editingAcctId));
  // Si borramos la default, recrear una vacía para que el sistema no explote
  if (editingAcctId === 'default') {
    accounts.unshift({
      id: 'default', broker: 'Personal', tipo: 'personal', fase: 'n/a',
      balanceInicial: 5000, maxDrawdown: 10, target: 10,
      label: 'Cuenta Principal', estado: 'activa', createdAt: new Date().toISOString()
    });
  }
  saveAccounts();
  closeAcctModal();
  const nextId = accounts.find(a => a.estado === 'activa')?.id || 'default';
  switchAccount(nextId);
  toast('Cuenta eliminada');
}

// ══════════════════════════════════════════════════
// DATA MANAGEMENT
// ══════════════════════════════════════════════════

function key(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

function fmt$(n) {
  const v = Number(n);
  const s = Math.abs(v).toFixed(2);
  return (v >= 0 ? '+$' : '-$') + s;
}

function fmtP(n) {
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function migrateEntry(e) {
  if (!e) return null;
  const m = { ...e };
  if (m.ganado !== undefined && m.result === undefined) {
    m.result  = m.ganado ? Math.abs(Number(m.pnl||0)) : -Math.abs(Number(m.pnl||0));
    m.type    = m.ganado ? 'TP' : 'SL';
    m.pair    = m.par || m.pair || '';
    m.session = m.sesion || m.session || '';
  }
  if (m.img && !m.images) m.images = [m.img];
  return m;
}

function migrateAllData() {
  let changed = false;
  Object.keys(data).forEach(k => {
    const e = data[k];
    if (e && e.ganado !== undefined && e.result === undefined) {
      data[k] = migrateEntry(e);
      changed = true;
    }
  });
  if (changed) saveAccountData(activeAccountId, data);
}

function getMonthEntries(y, m) {
  const prefix = `${y}-${String(m+1).padStart(2,'0')}-`;
  return Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k,v]) => ({ ...migrateEntry(v), _key: k }));
}

function getAllEntries() {
  return Object.entries(data).map(([k,v]) => ({ ...migrateEntry(v), _key: k }));
}

function calcStats() {
  const cap0    = config.capital || 5000;
  const entries = Object.values(data).map(migrateEntry);
  const traded  = entries.filter(e => e.result !== undefined && e.result !== null && e.result !== '');
  const totalPnl  = traded.reduce((s, e) => s + Number(e.result||0), 0);
  const wins      = traded.filter(e => Number(e.result||0) > 0);
  const losses    = traded.filter(e => Number(e.result||0) < 0);
  const totalTrades = traded.reduce((s,e) => s + (Number(e.trades)||1), 0);
  const winRate   = traded.length ? (wins.length / traded.length * 100) : 0;

  const monthEntries = getMonthEntries(curYear, curMonth);
  const monthTraded  = monthEntries.filter(e => e.result !== undefined && e.result !== '');
  const monthPnl     = monthTraded.reduce((s,e) => s + Number(e.result||0), 0);
  const monthPct     = cap0 ? (monthPnl / cap0 * 100) : 0;

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay()+6)%7));
  const weekKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek); d.setDate(d.getDate() + i);
    weekKeys.push(d.toISOString().split('T')[0]);
  }
  const weekPnl = weekKeys.reduce((s,k) => s + Number(data[k]?.result||0), 0);
  const weekPct = cap0 ? (weekPnl / cap0 * 100) : 0;

  const todayPnl = Number(data[TODAY]?.result||0);
  const todayPct = cap0 ? (todayPnl / cap0 * 100) : 0;

  const sortedDays = Object.keys(data).sort();
  let streak = 0, streakType = null;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    const e = data[sortedDays[i]];
    if (!e || e.result === '' || e.result === undefined) break;
    const r = Number(e.result);
    if (i === sortedDays.length - 1) streakType = r >= 0 ? 'win' : 'loss';
    if ((streakType === 'win' && r >= 0) || (streakType === 'loss' && r < 0)) streak++;
    else break;
  }

  let best = null, worst = null;
  monthTraded.forEach(e => {
    const r = Number(e.result);
    if (best === null || r > best) best = r;
    if (worst === null || r < worst) worst = r;
  });
  const greenDays = monthTraded.filter(e => Number(e.result||0) > 0).length;
  const redDays   = monthTraded.filter(e => Number(e.result||0) < 0).length;

  return { cap0, totalPnl, wins, losses, totalTrades, winRate, monthPnl, monthPct,
           weekPct, todayPct, streak, streakType, best, worst,
           greenDays, redDays, monthTraded };
}

function updateSidebar() {
  if (viewMode === 'global') return;
  const s = calcStats();
  const cap0 = s.cap0;
  const currentCap = cap0 + s.totalPnl;
  document.getElementById('sCapital').textContent = '$' + currentCap.toFixed(2);
  document.getElementById('headerCapital').textContent = '$' + currentCap.toFixed(2);
  const chg = document.getElementById('sCapitalChange');
  chg.textContent = fmt$(s.totalPnl);
  chg.className = 'capital-change ' + (s.totalPnl >= 0 ? 'val-win' : 'val-loss');

  const pnlEl = document.getElementById('sPnl');
  pnlEl.textContent = fmt$(s.totalPnl);
  pnlEl.className = 'stat-row-val ' + (s.totalPnl >= 0 ? 'val-win' : 'val-loss');

  document.getElementById('sDiario').textContent = fmtP(s.todayPct);
  document.getElementById('sDiario').className = 'stat-row-val ' + (s.todayPct >= 0 ? 'val-win' : 'val-loss');
  document.getElementById('sSemanal').textContent = fmtP(s.weekPct);
  document.getElementById('sSemanal').className = 'stat-row-val ' + (s.weekPct >= 0 ? 'val-win' : 'val-loss');
  const meEl = document.getElementById('sMensual');
  meEl.textContent = fmtP(s.monthPct);
  meEl.className   = 'stat-row-val ' + (s.monthPct >= 0 ? 'val-win' : 'val-loss');

  const wr = s.winRate;
  document.getElementById('sWinRate').textContent = wr.toFixed(0) + '%';
  document.getElementById('sWinBar').style.width   = wr + '%';
  document.getElementById('sWins').textContent     = s.wins.length;
  document.getElementById('sLosses').textContent   = s.losses.length;
  document.getElementById('sTotalTrades').textContent = s.totalTrades + ' trades';

  const si = document.getElementById('streakIcon');
  const sv = document.getElementById('streakVal');
  const sl = document.getElementById('streakLbl');
  if (s.streak > 0) {
    si.textContent = s.streakType === 'win' ? '🔥' : '🧊';
    sv.textContent = s.streak;
    sv.className = 'streak-val ' + (s.streakType === 'win' ? 'val-win' : 'val-loss');
    sl.textContent = s.streakType === 'win' ? 'días ganadores' : 'días perdedores';
  } else {
    si.textContent = '—'; sv.textContent = '0'; sv.className = 'streak-val';
    sl.textContent = 'Sin operaciones';
  }

  document.getElementById('sBest').textContent    = s.best !== null ? fmt$(s.best) : '—';
  document.getElementById('sWorst').textContent   = s.worst !== null ? fmt$(s.worst) : '—';
  document.getElementById('sGreenDays').textContent = s.greenDays;
  document.getElementById('sRedDays').textContent   = s.redDays;

  drawConsistency();
  drawEquityChart();
}

function drawConsistency() {
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay()+6)%7));
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek); d.setDate(d.getDate() + i);
    const k = d.toISOString().split('T')[0];
    const e = data[k];
    let color = 'var(--border2)';
    if (e && e.result !== '' && e.result !== undefined) {
      color = Number(e.result) >= 0 ? 'rgba(62,207,122,0.5)' : 'rgba(224,85,85,0.5)';
    }
    html += `<div class="cons-dot" title="${k}" style="background:${color}"></div>`;
  }
  document.getElementById('consistencyDots').innerHTML = html;
}

function drawEquityChart() {
  const canvas = document.getElementById('equityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = canvas.offsetWidth  * dpr;
  canvas.height = canvas.offsetHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  ctx.clearRect(0, 0, W, H);

  const sorted = Object.keys(data).sort();
  let cumPnl = 0;
  const points = [{ pnl: 0 }];
  sorted.forEach(k => {
    const e = data[k];
    if (e && e.result !== '' && e.result !== undefined) {
      cumPnl += Number(e.result);
      points.push({ pnl: cumPnl });
    }
  });

  if (points.length < 2) {
    ctx.fillStyle = 'rgba(139,146,176,0.4)';
    ctx.font = '10px Syne';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos', W/2, H/2);
    return;
  }

  const vals = points.map(p => p.pnl);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pad = { t: 4, b: 4, l: 4, r: 4 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const toX = i => pad.l + (i / (points.length - 1)) * plotW;
  const toY = v => pad.t + plotH - ((v - minV) / range) * plotH;
  const isUp = points[points.length-1].pnl >= 0;

  const grad = ctx.createLinearGradient(0, pad.t, 0, H);
  grad.addColorStop(0, isUp ? 'rgba(62,207,122,0.22)' : 'rgba(224,85,85,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(points[0].pnl));
  for (let i = 1; i < points.length; i++) ctx.lineTo(toX(i), toY(points[i].pnl));
  ctx.lineTo(toX(points.length-1), H);
  ctx.lineTo(toX(0), H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(points[0].pnl));
  for (let i = 1; i < points.length; i++) ctx.lineTo(toX(i), toY(points[i].pnl));
  ctx.strokeStyle = isUp ? 'rgba(62,207,122,0.8)' : 'rgba(224,85,85,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── GLOBAL CALENDAR VIEW ──
function renderCalendarGlobal() {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthTitle').textContent = `${meses[curMonth]} ${curYear} — Vista Global`;
  document.getElementById('monthSub').textContent   = 'Todas las cuentas combinadas';
  const firstDay    = new Date(curYear, curMonth, 1).getDay();
  const offset      = (firstDay + 6) % 7;
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const k = key(curYear, curMonth, d);
    let totalPnl = 0, hasAny = false;
    accounts.filter(a=>a.estado==='activa').forEach(a => {
      const d2 = loadAccountData(a.id);
      const e  = d2[k];
      if (e && e.result !== '' && e.result !== undefined) {
        totalPnl += Number(e.result||0);
        hasAny = true;
      }
    });
    const isToday = k === TODAY;
    let cls = 'day-cell';
    if (isToday) cls += ' today';
    if (hasAny && totalPnl > 0) cls += ' win-day';
    if (hasAny && totalPnl < 0) cls += ' loss-day';
    const resultHtml = hasAny ? `<div class="day-result ${totalPnl>=0?'pos':'neg'}" style="font-family:var(--mono);font-size:10px">${fmt$(totalPnl)}</div>` : '';
    html += `<div class="${cls}"><div class="day-num">${d}</div>${resultHtml}</div>`;
  }
  document.getElementById('calendar').innerHTML = html;
}

// ── CALENDAR ──
function renderCalendar() {
  if (viewMode === 'global') { renderCalendarGlobal(); return; }
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay    = new Date(curYear, curMonth, 1).getDay();
  const offset      = (firstDay + 6) % 7;
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

  const monthEntries = getMonthEntries(curYear, curMonth);
  const traded = monthEntries.filter(e => e.result !== undefined && e.result !== '');
  document.getElementById('monthTitle').textContent = `${meses[curMonth]} ${curYear}`;
  document.getElementById('monthSub').textContent   = `${traded.length} operación${traded.length !== 1 ? 'es' : ''} registrada${traded.length !== 1 ? 's' : ''}`;

  let best = null, worst = null;
  monthEntries.forEach(e => {
    if (e.result === '' || e.result === undefined) return;
    const r = Number(e.result);
    if (best === null || r > best) best = r;
    if (worst === null || r < worst) worst = r;
  });

  let html = '';
  for (let i = 0; i < offset; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const k       = key(curYear, curMonth, d);
    const e       = migrateEntry(data[k] || null);
    const isToday = k === TODAY;
    const result  = e?.result;
    const hasData = result !== undefined && result !== null && result !== '';
    const r       = hasData ? Number(result) : 0;
    const isWin   = hasData && r > 0;
    const isLoss  = hasData && r < 0;

    let filteredOut = false;
    if (curFilter === 'win'  && !isWin)  filteredOut = true;
    if (curFilter === 'loss' && !isLoss) filteredOut = true;

    let classes = 'day-cell';
    if (isToday)    classes += ' today';
    if (hasData && r > 0) classes += ' win-day';
    if (hasData && r < 0) classes += ' loss-day';
    if (filteredOut) classes += ' filtered-out';
    if (hasData && r === best  && best  > 0) classes += ' best-day';
    if (hasData && r === worst && worst < 0) classes += ' worst-day';

    const resultHtml = hasData ? `<div class="day-result ${r >= 0 ? 'pos' : 'neg'}" style="font-family:var(--mono);font-size:10px">${fmt$(r)}</div>` : '';
    const pairHtml   = e?.pair ? `<div style="font-size:7px;color:var(--gold);opacity:0.7;margin-top:1px;font-family:var(--mono);letter-spacing:0.3px">${e.pair}</div>` : '';

    let badgeHtml = '';
    if (e?.type === 'TP') badgeHtml = '<div class="day-badge badge-tp">TP</div>';
    if (e?.type === 'SL') badgeHtml = '<div class="day-badge badge-sl">SL</div>';

    let glowHtml = '';
    if (hasData) {
      const color = r >= 0 ? 'rgba(62,207,122,0.06)' : 'rgba(224,85,85,0.06)';
      glowHtml = `<div style="position:absolute;inset:0;background:${color};pointer-events:none;border-radius:inherit"></div>`;
    }

    html += `<div class="${classes}" onclick="openDayModal('${k}')">
      ${badgeHtml}
      <div class="day-num">${d}</div>
      ${resultHtml}
      ${pairHtml}
      ${glowHtml}
    </div>`;
  }

  document.getElementById('calendar').innerHTML = html;
  updateSidebar();
  renderSideAcctInfo();
  renderRiskCard();
}

// ── FILTER ──
function setFilter(f) {
  curFilter = f;
  ['All','Win','Loss'].forEach(x => {
    document.getElementById(`fb${x}`).className = 'filter-btn';
  });
  if (f === 'all')  document.getElementById('fbAll').className  = 'filter-btn active-all';
  if (f === 'win')  document.getElementById('fbWin').className  = 'filter-btn active-win';
  if (f === 'loss') document.getElementById('fbLoss').className = 'filter-btn active-loss';
  renderCalendar();
}

// ── MONTH NAV ──
function changeMonth(dir) {
  curMonth += dir;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  if (curMonth < 0)  { curMonth = 11; curYear--; }
  renderCalendar();
}

// ── MODAL ──
let currentModalKey = null;
let currentType     = null;
let currentImages   = [null, null, null];
let activeImgSlot   = 0;

function openDayModal(k) {
  const [y,m,d] = k.split('-');
  currentModalKey = k;
  currentType     = null;
  currentImages   = [null, null, null];

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('modalDateTitle').textContent = `${parseInt(d)} de ${meses[parseInt(m)-1]} ${y}`;

  const e = migrateEntry(data[k] || {});
  document.getElementById('fResultado').value  = e.result ?? '';
  document.getElementById('fTrades').value     = e.trades  ?? 1;
  document.getElementById('fSetup').value      = e.setup   ?? '';
  document.getElementById('fNotas').value      = e.notas   ?? '';
  document.getElementById('fPair').value       = e.pair    ?? '';
  document.getElementById('fSession').value    = e.session ?? '';
  document.getElementById('fExecution').value  = e.executionType ?? '';
  document.getElementById('fSetupType').value  = e.setupType ?? '';

  const imgs = e.images || (e.img ? [e.img] : []);
  currentImages = [imgs[0]||null, imgs[1]||null, imgs[2]||null];
  renderImgSlots();

  document.getElementById('btnTP').className = 'type-btn';
  document.getElementById('btnSL').className = 'type-btn';
  if (e.type === 'TP') setType('TP');
  else if (e.type === 'SL') setType('SL');

  document.getElementById('tradeModal').classList.add('open');
  setTimeout(() => document.getElementById('fResultado').focus(), 100);
}

// ── FIX: viewImg — ver imagen en pantalla completa ──
function viewImg(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.93);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  overlay.innerHTML = `
    <img src="${src}" style="max-width:92vw;max-height:90vh;border-radius:10px;box-shadow:0 0 60px rgba(0,0,0,0.9)">
    <div style="position:fixed;top:18px;right:24px;color:white;font-size:26px;cursor:pointer;opacity:0.7;line-height:1">✕</div>`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

// ── FIX: renderImgSlots — click en imagen abre viewer, no upload ──
function renderImgSlots() {
  const labels = ['Par operado', 'Correlación', 'SMT / Confirmación'];
  const icons  = ['📊', '🔗', '🧠'];
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`imgSlot${i}`);
    if (currentImages[i]) {
      const src = currentImages[i];
      slot.innerHTML = `
        <img src="${src}" alt="img${i}"
          style="cursor:zoom-in;width:100%;height:100%;object-fit:cover;border-radius:6px"
          onclick="event.stopPropagation();viewImg('${src}')">
        <button class="img-slot-del" onclick="removeImg(event,${i})">✕</button>`;
    } else {
      slot.innerHTML = `
        <span class="img-slot-ico">${icons[i]}</span>
        <span class="img-slot-lbl">${labels[i]}</span>`;
    }
  }
}

function triggerImgUpload(idx) {
  activeImgSlot = idx;
  document.getElementById('fImagenMulti').value = '';
  document.getElementById('fImagenMulti').click();
}

function handleMultiImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentImages[activeImgSlot] = e.target.result;
    renderImgSlots();
  };
  reader.readAsDataURL(file);
}

function removeImg(event, idx) {
  event.stopPropagation();
  currentImages[idx] = null;
  renderImgSlots();
}

function closeTradeModal() {
  document.getElementById('tradeModal').classList.remove('open');
  currentModalKey = null;
}

function setType(t) {
  currentType = t;
  document.getElementById('btnTP').className = 'type-btn' + (t === 'TP' ? ' tp-active' : '');
  document.getElementById('btnSL').className = 'type-btn' + (t === 'SL' ? ' sl-active' : '');
}

function saveDay() {
  if (!currentModalKey) return;
  const result   = document.getElementById('fResultado').value;
  const k        = currentModalKey;
  const dateObj  = new Date(k + 'T12:00:00');
  const weekdays = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  data[k] = {
    result:        result !== '' ? parseFloat(result) : '',
    trades:        parseInt(document.getElementById('fTrades').value) || 1,
    type:          currentType,
    setup:         document.getElementById('fSetup').value.trim(),
    notas:         document.getElementById('fNotas').value.trim(),
    pair:          document.getElementById('fPair').value,
    session:       document.getElementById('fSession').value,
    executionType: document.getElementById('fExecution').value,
    setupType:     document.getElementById('fSetupType').value,
    weekday:       weekdays[dateObj.getDay()],
    images:        currentImages.filter(Boolean),
    img:           currentImages[0] || null,
    accountId:     activeAccountId,
  };
  saveAccountData(activeAccountId, data);
  if (activeAccountId === 'default') localStorage.setItem('mtj_data', JSON.stringify(data));
  closeTradeModal();
  renderCalendar();
  toast('✓ Operación guardada');
}

function clearDay() {
  if (!currentModalKey) return;
  if (!confirm('¿Borrar datos de este día?')) return;
  delete data[currentModalKey];
  saveAccountData(activeAccountId, data);
  if (activeAccountId === 'default') localStorage.setItem('mtj_data', JSON.stringify(data));
  closeTradeModal();
  renderCalendar();
  renderSideAcctInfo();
  renderRiskCard();
  toast('Día borrado');
}

// ── SETTINGS ──
function openSettings() {
  document.getElementById('fCapitalInicial').value = config.capital || 5000;
  document.getElementById('settingsModal').classList.add('open');
  setTimeout(() => document.getElementById('fCapitalInicial').focus(), 100);
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
function saveCapital() {
  const v = parseFloat(document.getElementById('fCapitalInicial').value);
  if (!v || v <= 0) return;
  config.capital = v;
  saveAccountConfig(activeAccountId, config);
  if (activeAccountId === 'default') localStorage.setItem('mtj_config', JSON.stringify(config));
  const acctIdx = accounts.findIndex(a => a.id === activeAccountId);
  if (acctIdx >= 0) { accounts[acctIdx].balanceInicial = v; saveAccounts(); }
  closeSettings();
  renderCalendar();
  renderSideAcctInfo();
  renderRiskCard();
  toast(`Capital inicial: $${v.toFixed(2)}`);
}

// ══════════════════════════════════════════════════
// EXPORT / IMPORT — Backup system
// ══════════════════════════════════════════════════

function exportBackup() {
  const backup = { _version: 1, _exportedAt: new Date().toISOString(), data: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (
      k === LS_ACCOUNTS ||
      k === LS_DATA_LEGACY ||
      k === LS_CFG_LEGACY  ||
      k.startsWith(LS_DATA_PFX) ||
      k.startsWith(LS_CFG_PFX)
    )) {
      backup.data[k] = localStorage.getItem(k);
    }
  }
  const json     = JSON.stringify(backup, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const date     = new Date().toISOString().slice(0, 10);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `mareblu-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('✓ Backup exportado correctamente');
}

function importBackup() {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup._version || !backup.data) {
          alert('Archivo inválido. Asegurate de usar un backup exportado desde Mareblu Journal.');
          return;
        }
        if (!confirm(`¿Restaurar backup del ${backup._exportedAt?.slice(0,10) || 'fecha desconocida'}?\n\nATENCIÓN: Esto reemplazará todos los datos actuales.`)) return;
        Object.entries(backup.data).forEach(([k, v]) => {
          localStorage.setItem(k, v);
        });
        toast('✓ Backup restaurado — recargando…');
        setTimeout(() => location.reload(), 1200);
      } catch(err) {
        alert('Error al leer el archivo. Asegurate de que sea un JSON válido.');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// ══════════════════════════════════════════════════
// INTELLIGENCE ENGINE
// ══════════════════════════════════════════════════

let intelCurTab = 'dashboard';

function openIntel() {
  migrateAllData();
  document.getElementById('intelPanel').classList.add('open');
  renderIntel(intelCurTab);
}
function closeIntel() {
  document.getElementById('intelPanel').classList.remove('open');
}

function switchIntelTab(tab) {
  intelCurTab = tab;
  document.querySelectorAll('.intel-tab').forEach(el => el.classList.remove('active'));
  const tabs = ['dashboard','pares','sesiones','dias','setups','insights'];
  const idx  = tabs.indexOf(tab);
  if (idx >= 0) document.querySelectorAll('.intel-tab')[idx].classList.add('active');
  renderIntel(tab);
}

function analizarPatronesTrading() {
  const all = getAllEntries().filter(e => e.result !== '' && e.result !== undefined);

  function groupBy(key) {
    const groups = {};
    all.forEach(e => {
      const k = e[key] || 'Sin especificar';
      if (!groups[k]) groups[k] = { trades:0, wins:0, pnl:0, entries:[] };
      groups[k].trades++;
      if (Number(e.result) > 0) groups[k].wins++;
      groups[k].pnl += Number(e.result||0);
      groups[k].entries.push(e);
    });
    return Object.entries(groups).map(([name, d]) => ({
      name,
      trades:  d.trades,
      wins:    d.wins,
      pnl:     d.pnl,
      winRate: d.trades ? (d.wins / d.trades * 100) : 0,
      avgPnl:  d.trades ? (d.pnl / d.trades) : 0,
    })).sort((a,b) => b.pnl - a.pnl);
  }

  const porPar     = groupBy('pair');
  const porSession = groupBy('session');
  const porSetup   = groupBy('setupType');
  const porExec    = groupBy('executionType');
  const dayOrder   = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const porDia     = groupBy('weekday').sort((a,b) => dayOrder.indexOf(a.name) - dayOrder.indexOf(b.name));

  return { porPar, porSession, porSetup, porDia, porExec, total: all.length };
}

function renderIntel(tab) {
  const p  = analizarPatronesTrading();
  const el = document.getElementById('intelContent');
  if (!p.total) {
    el.innerHTML = '<div class="i-empty">No hay operaciones registradas con suficientes datos.<br>Registrá trades con par, sesión y setup para ver inteligencia.</div>';
    return;
  }
  if (tab === 'dashboard')  el.innerHTML = renderIntelDashboard(p);
  if (tab === 'pares')      el.innerHTML = renderIntelTable(p.porPar,     'Por Par',              '🪙');
  if (tab === 'sesiones')   el.innerHTML = renderIntelTable(p.porSession, 'Por Sesión',           '🕐');
  if (tab === 'dias')       el.innerHTML = renderIntelTable(p.porDia,     'Por Día de la Semana', '📅');
  if (tab === 'setups')     el.innerHTML = renderIntelTable(p.porSetup,   'Por Setup',            '🧠');
  if (tab === 'insights')   el.innerHTML = renderIntelInsights(p);
}

function renderIntelDashboard(p) {
  const bestPar  = p.porPar.filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestSess = p.porSession.filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestDia  = p.porDia.filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestSet  = p.porSetup.filter(r=>r.trades>=2).sort((a,b)=>b.winRate-a.winRate)[0];
  const bestPnl  = p.porPar.sort((a,b)=>b.pnl-a.pnl)[0];

  const card = (icon, label, val, sub, color='var(--gold)') => `
    <div class="i-card">
      <div class="i-card-icon">${icon}</div>
      <div class="i-card-label">${label}</div>
      <div class="i-card-val" style="color:${color}">${val}</div>
      <div class="i-card-sub">${sub}</div>
    </div>`;

  return `
    <div class="i-grid">
      ${bestPar  ? card('🪙','Mejor Par',     bestPar.name,  `${bestPar.winRate.toFixed(0)}% WR · ${bestPar.trades} trades`) : card('🪙','Mejor Par','—','Sin datos suficientes')}
      ${bestSess ? card('🕐','Mejor Sesión',  bestSess.name, `${bestSess.winRate.toFixed(0)}% WR · ${fmt$(bestSess.pnl)} PnL`) : card('🕐','Mejor Sesión','—','Sin datos')}
      ${bestDia  ? card('📅','Mejor Día',     bestDia.name,  `${bestDia.winRate.toFixed(0)}% WR · ${bestDia.trades} trades`) : card('📅','Mejor Día','—','Sin datos')}
      ${bestSet  ? card('🧠','Mejor Setup',   bestSet.name,  `${bestSet.winRate.toFixed(0)}% WR · ${bestSet.trades} ops`) : card('🧠','Mejor Setup','—','Sin datos')}
      ${bestPnl  ? card('💰','Mayor PnL',     bestPnl.name,  `${fmt$(bestPnl.pnl)} total`, bestPnl.pnl>=0?'var(--win)':'var(--loss)') : ''}
    </div>
    ${p.porPar.length ? `<div class="i-section-title">Rendimiento por par (top ${Math.min(p.porPar.length,5)})</div>${renderMiniTable(p.porPar.slice(0,5))}` : ''}
    ${p.porSession.length ? `<div class="i-section-title">Rendimiento por sesión</div>${renderMiniTable(p.porSession)}` : ''}
  `;
}

function renderMiniTable(rows) {
  return `
    <table class="i-table">
      <thead><tr><th>#</th><th>Nombre</th><th>Trades</th><th>Win Rate</th><th>PnL Total</th><th>Avg PnL</th></tr></thead>
      <tbody>
        ${rows.map((r,i) => `
          <tr>
            <td class="i-rank">${i+1}</td>
            <td class="i-name">${r.name}</td>
            <td style="font-family:var(--mono);font-size:10px;color:var(--text2)">${r.trades}</td>
            <td>
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:${r.winRate>=55?'var(--win)':r.winRate>=40?'var(--gold)':'var(--loss)'}">${r.winRate.toFixed(0)}%</span>
              <span class="i-bar-wrap"><span class="i-bar-fill" style="width:${r.winRate}%;background:${r.winRate>=55?'rgba(62,207,122,0.7)':r.winRate>=40?'rgba(200,168,75,0.7)':'rgba(224,85,85,0.7)'}"></span></span>
            </td>
            <td style="font-family:var(--mono);font-size:11px;font-weight:700;color:${r.pnl>=0?'var(--win)':'var(--loss)'}">${fmt$(r.pnl)}</td>
            <td style="font-family:var(--mono);font-size:10px;color:${r.avgPnl>=0?'rgba(62,207,122,0.8)':'rgba(224,85,85,0.8)'}">${fmt$(r.avgPnl)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderIntelTable(rows, title, icon) {
  if (!rows.length) return '<div class="i-empty">Sin datos para este análisis.<br>Completá los campos al registrar operaciones.</div>';
  return `
    <div class="i-section-title">${icon} ${title} · ${rows.length} categoría${rows.length!==1?'s':''}</div>
    ${renderMiniTable(rows)}
  `;
}

function renderIntelInsights(p) {
  const ins = [];

  const pares = p.porPar.filter(r=>r.trades>=3);
  if (pares.length) {
    const best = pares.sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'🪙', txt:`<strong>${best.name}</strong> es tu par más rentable con <strong>${best.winRate.toFixed(0)}% win rate</strong> en ${best.trades} trades (PnL: ${fmt$(best.pnl)}).`});
    const worst = pares.sort((a,b)=>a.winRate-b.winRate)[0];
    if (worst.winRate < 40) ins.push({ico:'⚠️', txt:`<strong>${worst.name}</strong> tiene bajo rendimiento (${worst.winRate.toFixed(0)}% WR). Evaluar si es conveniente seguir operando este par.`});
  }

  const sess = p.porSession.filter(r=>r.trades>=2);
  if (sess.length) {
    const best = sess.sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'🕐', txt:`Sesión <strong>${best.name}</strong> es la más rentable: ${best.winRate.toFixed(0)}% WR con ${fmt$(best.pnl)} PnL acumulado.`});
    if (sess.length > 1) {
      const worst = sess.sort((a,b)=>a.pnl-b.pnl)[0];
      if (worst.pnl < 0) ins.push({ico:'⚠️', txt:`Sesión <strong>${worst.name}</strong> genera pérdidas (${fmt$(worst.pnl)}). Considerar reducir operaciones en ese horario.`});
    }
  }

  const dias = p.porDia.filter(r=>r.trades>=2);
  if (dias.length) {
    const sorted = dias.sort((a,b)=>b.winRate-a.winRate);
    const best = sorted[0];
    ins.push({ico:'📅', txt:`<strong>${best.name}</strong> es tu mejor día con ${best.winRate.toFixed(0)}% WR en ${best.trades} sesiones.`});
    if (sorted.length > 1) {
      const worst = dias.sort((a,b)=>a.pnl-b.pnl)[0];
      if (worst.pnl < 0) ins.push({ico:'📅', txt:`<strong>${worst.name}</strong> es tu peor día (${fmt$(worst.pnl)}). Evaluar descanso ese día.`});
    }
  }

  const setups = p.porSetup.filter(r=>r.trades>=2);
  if (setups.length) {
    const best = setups.sort((a,b)=>b.winRate-a.winRate)[0];
    ins.push({ico:'🧠', txt:`Setup <strong>${best.name}</strong> tiene el mayor win rate: ${best.winRate.toFixed(0)}% en ${best.trades} operaciones.`});
  }

  const exec = p.porExec.filter(r=>r.trades>=2);
  if (exec.length) {
    const buenas      = exec.find(r=>r.name==='buena');
    const emocionales = exec.find(r=>r.name==='emocional');
    if (buenas && emocionales) {
      ins.push({ico:'🎯', txt:`Ejecuciones <strong>buenas</strong>: ${buenas.winRate.toFixed(0)}% WR. Ejecuciones <strong>emocionales</strong>: ${emocionales.winRate.toFixed(0)}% WR. Diferencia: ${Math.abs(buenas.winRate - emocionales.winRate).toFixed(0)} puntos.`});
    }
    if (emocionales && emocionales.pnl < 0) {
      ins.push({ico:'🚨', txt:`Las ejecuciones <strong>emocionales</strong> generan pérdidas (${fmt$(emocionales.pnl)}). Prioridad: mejorar disciplina de entrada.`});
    }
  }

  if (p.total >= 10) {
    const all  = getAllEntries().filter(e => e.result!==''&&e.result!==undefined);
    const wins = all.filter(e => Number(e.result)>0);
    const wr   = all.length ? wins.length/all.length*100 : 0;
    if (wr >= 60) ins.push({ico:'🔥', txt:`Win rate global: <strong>${wr.toFixed(0)}%</strong> en ${all.length} operaciones. Rendimiento consistente.`});
    else if (wr < 40) ins.push({ico:'📊', txt:`Win rate global de <strong>${wr.toFixed(0)}%</strong>. Revisar criterios de entrada y gestión de riesgo.`});
  }

  if (!ins.length) return '<div class="i-empty">Registrá al menos 3–5 trades con par, sesión y setup para ver insights automáticos.</div>';

  return ins.map(i => `
    <div class="i-insight">
      <span class="i-insight-ico">${i.ico}</span>
      <span class="i-insight-text">${i.txt}</span>
    </div>
  `).join('');
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTradeModal(); closeSettings(); closeIntel(); closeConsolidado(); closeAcctModal(); }
  if (e.key === 'Enter') {
    if (document.getElementById('settingsModal').classList.contains('open')) saveCapital();
    else if (document.getElementById('tradeModal').classList.contains('open') &&
             document.activeElement.tagName !== 'TEXTAREA' &&
             document.activeElement.tagName !== 'SELECT') saveDay();
  }
});

document.getElementById('tradeModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeTradeModal(); });
document.getElementById('settingsModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeSettings(); });
document.getElementById('intelPanel').addEventListener('click', e => { if (e.target === e.currentTarget) closeIntel(); });
document.getElementById('consolidadoPanel').addEventListener('click', e => { if (e.target === e.currentTarget) closeConsolidado(); });
document.getElementById('acctModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAcctModal(); });

// ── INIT ──
loadAccounts();
migrateToMultiAccount();
data   = loadAccountData(activeAccountId);
config = loadAccountConfig(activeAccountId);
const _initAcct = accounts.find(a => a.id === activeAccountId);
if (_initAcct && !config.capital) config.capital = _initAcct.balanceInicial || 5000;
migrateAllData();
renderAccountBar();
renderCalendar();
renderSideAcctInfo();
renderRiskCard();
window.addEventListener('resize', drawEquityChart);



 



     

 




    


 




      
