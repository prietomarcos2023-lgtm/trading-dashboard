// MAREBLU TRADING JOURNAL v4.2 — CRT Edition
const LS_ACCOUNTS='mtj_accounts_v1',LS_DATA_PFX='mtj_data_',LS_CFG_PFX='mtj_cfg_',LS_DATA_LEGACY='mtj_data',LS_CFG_LEGACY='mtj_config';
let accounts=[],activeAccountId='default',viewMode='single',data={},config={capital:5000};
let curYear=new Date().getFullYear(),curMonth=new Date().getMonth(),curFilter='all';
const TODAY=new Date().toISOString().split('T')[0];
let currentDayTrades=[],activeTradeTab=0,activeImgTradeIdx=0,activeImgSlotIdx=0;
const EMPTY_TRADE=()=>({type:null,result:'',pair:'',session:'',executionType:'',setupType:'',setup:'',notas:'',images:[null,null,null],imageNotas:['','','']});

function loadAccounts(){try{const r=localStorage.getItem(LS_ACCOUNTS);accounts=r?JSON.parse(r):[];}catch(e){accounts=[];}}
function saveAccounts(){localStorage.setItem(LS_ACCOUNTS,JSON.stringify(accounts));}
function getAccountDataKey(id){return LS_DATA_PFX+id;}
function getAccountConfigKey(id){return LS_CFG_PFX+id;}
function loadAccountData(id){try{const r=localStorage.getItem(getAccountDataKey(id));return r?JSON.parse(r):{}}catch(e){return{};}}
function loadAccountConfig(id){try{const r=localStorage.getItem(getAccountConfigKey(id));return r?JSON.parse(r):{capital:5000};}catch(e){return{capital:5000};}}
function saveAccountData(id,d){localStorage.setItem(getAccountDataKey(id),JSON.stringify(d));}
function saveAccountConfig(id,c){localStorage.setItem(getAccountConfigKey(id),JSON.stringify(c));}

function migrateToMultiAccount(){
  const legacyData=localStorage.getItem(LS_DATA_LEGACY);
  const legacyCfg=localStorage.getItem(LS_CFG_LEGACY);
  const alreadyMigrated=accounts.some(a=>a.id==='default');
  if(legacyData&&!alreadyMigrated){
    const def={id:'default',broker:'Personal',tipo:'personal',fase:'n/a',balanceInicial:5000,maxDrawdown:10,target:10,label:'Cuenta Principal',estado:'activa',createdAt:new Date().toISOString()};
    accounts.unshift(def);saveAccounts();
    localStorage.setItem(getAccountDataKey('default'),legacyData);
    if(legacyCfg){const cfg=JSON.parse(legacyCfg);def.balanceInicial=cfg.capital||5000;saveAccounts();localStorage.setItem(getAccountConfigKey('default'),legacyCfg);}
    try{const d=JSON.parse(legacyData);Object.keys(d).forEach(k=>{if(!d[k].accountId)d[k].accountId='default';});localStorage.setItem(getAccountDataKey('default'),JSON.stringify(d));}catch(e){}
  }
  if(accounts.length===0){accounts.push({id:'default',broker:'Personal',tipo:'personal',fase:'n/a',balanceInicial:5000,maxDrawdown:10,target:10,label:'Cuenta Principal',estado:'activa',createdAt:new Date().toISOString()});saveAccounts();}
}

function switchAccount(id){
  activeAccountId=id;viewMode='single';
  data=loadAccountData(id);config=loadAccountConfig(id);
  const acct=accounts.find(a=>a.id===id);
  if(acct)config.capital=config.capital||acct.balanceInicial||5000;
  migrateAllData();renderAccountBar();renderCalendar();renderSideAcctInfo();renderRiskCard();
// Inject PDF button
(function(){
  var existing=document.getElementById('btnExportPDF');
  if(!existing){
    var hdrRight=document.querySelector('.header-right');
    if(hdrRight){
      var noteBtn=document.createElement('button');noteBtn.id='btnMonthNote';noteBtn.className='hdr-btn';noteBtn.textContent='Nota Mes';noteBtn.onclick=openMonthNote;noteBtn.title='Escribir un resumen del mes (se incluye en el PDF)';hdrRight.appendChild(noteBtn);
      var btn=document.createElement('button');btn.id='btnExportPDF';btn.className='hdr-btn';btn.textContent='PDF Mes';btn.onclick=exportCalendarPDF;btn.title='Descargar calendario del mes como PDF';hdrRight.appendChild(btn);
    }
  }
})();

}

function switchToGlobal(){viewMode='global';renderAccountBar();renderCalendarGlobal();renderSideAcctInfo();renderRiskCard();}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/'/g,'&#39;');}

function renderAccountBar(){
  const pills=document.getElementById('acctPills');if(!pills)return;
  const activeAccts=accounts.filter(a=>a.estado==='activa');
  pills.innerHTML=activeAccts.map(a=>{
    const isActive=viewMode==='single'&&activeAccountId===a.id;
    const dotClass=a.tipo==='funded'?'acct-pill-funded':a.tipo==='challenge'?'acct-pill-challenge':'acct-pill-personal';
    const label=a.label||((a.broker||'')+(a.fase!=='n/a'?' '+a.fase:'')).trim();
    return '<button class="acct-pill'+(isActive?' active':'')+'" onclick="switchAccount(\''+a.id+'\')"><span class="acct-pill-dot '+dotClass+'"></span>'+esc(label)+'<span style="font-size:9px;opacity:0.4;cursor:pointer;margin-left:2px" onclick="event.stopPropagation();openAcctModal(\''+a.id+'\')">&#9998;</span></button>';
  }).join('');
}

function renderSideAcctInfo(){
  const el=document.getElementById('sideAcctInfo');if(!el)return;
  if(viewMode==='global'){el.innerHTML='<div class="s-label">Cuenta</div><div class="acct-info-card"><div class="acct-info-broker">&#8862; VISTA GLOBAL</div></div>';return;}
  const acct=accounts.find(a=>a.id===activeAccountId);if(!acct)return;
  const cap0=acct.balanceInicial||5000;
  const pnl=Object.values(data).filter(e=>e&&e.totalResult!==undefined).reduce((s,e)=>s+Number(e.totalResult||0),0);
  const balActual=cap0+pnl,dd=(pnl/cap0)*100,maxDD=acct.maxDrawdown||10;
  const ddUsed=Math.max(0,-dd),ddPct=Math.min(100,(ddUsed/maxDD)*100);
  const tgt=acct.target||10,progPct=Math.min(100,Math.max(0,(dd/tgt)*100));
  const label=acct.label||((acct.broker||'')+(acct.fase!=='n/a'?' '+acct.fase:'')).trim();
  const tipoLabel=acct.tipo==='funded'?'FUNDED':acct.tipo==='challenge'?'CHALLENGE':'PERSONAL';
  el.innerHTML='<div class="s-label">Cuenta activa</div><div class="acct-info-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px"><div class="acct-info-broker">'+esc(label)+'</div><span style="font-size:8px;padding:2px 6px;border-radius:20px;background:var(--gold-bg);color:var(--gold);font-weight:700;letter-spacing:1px">'+tipoLabel+'</span></div><div class="acct-info-row"><span class="acct-info-key">Balance inicial</span><span class="acct-info-val">$'+cap0.toLocaleString()+'</span></div><div class="acct-info-row"><span class="acct-info-key">Balance actual</span><span class="acct-info-val" style="color:'+(pnl>=0?'var(--win)':'var(--loss)')+'">$'+balActual.toFixed(2)+'</span></div><div class="acct-info-row"><span class="acct-info-key">P&amp;L</span><span class="acct-info-val" style="color:'+(pnl>=0?'var(--win)':'var(--loss)')+'">$'+pnl.toFixed(2)+' ('+dd.toFixed(2)+'%)</span></div><div class="acct-info-row"><span class="acct-info-key">Progreso target</span><span class="acct-info-val">'+dd.toFixed(2)+'% / '+tgt+'%</span></div><div class="acct-prog-bg" style="margin-top:8px"><div class="acct-prog-fill" style="width:'+progPct+'%;background:'+(progPct>=100?'var(--win)':'var(--gold)')+'"></div></div><div style="margin-top:7px"><div style="display:flex;justify-content:space-between;font-size:8px;color:var(--muted);margin-bottom:4px"><span>Drawdown usado</span><span style="color:'+(ddPct>70?'var(--loss)':'var(--text2)')+'">'+ddUsed.toFixed(2)+'% / '+maxDD+'%</span></div><div class="dd-track"><div class="dd-fill" style="width:'+ddPct+'%;background:'+(ddPct>70?'var(--loss)':ddPct>40?'var(--gold)':'var(--text2)')+'"></div></div></div></div>';
}

function calcularRiesgoCuenta(acct){
  const cap0=acct.balanceInicial||5000;
  const d=loadAccountData(acct.id);
  const pnl=Object.values(d).filter(e=>e&&e.totalResult!==undefined).reduce((s,e)=>s+Number(e.totalResult||0),0);
  const ddPct=(pnl/cap0)*100;
  let modo,riskPct,rrMin,mensaje,cssClass;
  if(ddPct<-3){modo='DEFENSIVO';riskPct=0.5;rrMin='1:2';cssClass='risk-defensivo';mensaje='Protege el capital. Sin operar por FOMO.';}
  else if(ddPct<=1){modo='NEUTRO';riskPct=0.75;rrMin='1:1.5';cssClass='risk-neutro';mensaje='Opera con disciplina. Sigue tu plan.';}
  else{modo='AGRESIVO CONTROLADO';riskPct=1.0;rrMin='1:1.5';cssClass='risk-agresivo';mensaje='Estas en ganancia. Sin salirte del plan.';}
  return{modo,riskPct,rrMin,mensaje,cssClass,riskDollar:(cap0*riskPct/100),ddPct,pnl};
}

function renderRiskCard(){
  const el=document.getElementById('riskCard');if(!el)return;
  if(viewMode==='global'){el.innerHTML='<div class="risk-card risk-neutro"><div class="risk-mode">VISTA GLOBAL</div><div class="risk-dollar">Selecciona una cuenta para ver el motor de riesgo.</div></div>';return;}
  const acct=accounts.find(a=>a.id===activeAccountId);if(!acct)return;
  const r=calcularRiesgoCuenta(acct);
  el.innerHTML='<div class="risk-card '+r.cssClass+'"><div class="risk-mode">'+r.modo+'</div><div class="risk-pct">'+r.riskPct+'%</div><div class="risk-dollar">$'+r.riskDollar.toFixed(2)+' por trade</div><div class="risk-rr">RR minimo: <span class="risk-rr-val">'+r.rrMin+'</span></div><div class="risk-msg">'+r.mensaje+'</div><div class="dd-bar-wrap"><div class="dd-label"><span>Drawdown vs balance</span><span>'+(r.ddPct>=0?'+':'')+r.ddPct.toFixed(2)+'%</span></div><div class="dd-track"><div class="dd-fill" style="width:'+Math.min(Math.max(-r.ddPct,0),100)+'%;background:'+(r.ddPct<-3?'var(--loss)':r.ddPct<0?'var(--gold)':'var(--win)')+'"></div></div></div></div>';
}

function key(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function fmt$(n){const v=Number(n);return(v>=0?'+$':'-$')+Math.abs(v).toFixed(2);}
function fmtP(n){const v=Number(n);return(v>=0?'+':'')+v.toFixed(2)+'%';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}

function migrateEntry(e){
  if(!e)return null;
  if(e.trades&&Array.isArray(e.trades)){
    e.trades=e.trades.map(t=>({...t,images:[t.images?.[0]||null,t.images?.[1]||null,t.images?.[2]||null],imageNotas:[t.imageNotas?.[0]||'',t.imageNotas?.[1]||'',t.imageNotas?.[2]||'']}));
    return e;
  }
  const m={...e};
  if(m.ganado!==undefined&&m.result===undefined){m.result=m.ganado?Math.abs(Number(m.pnl||0)):-Math.abs(Number(m.pnl||0));m.type=m.ganado?'TP':'SL';m.pair=m.par||m.pair||'';m.session=m.sesion||m.session||'';}
  if(m.img&&!m.images)m.images=[m.img];
  const t1={type:m.type||null,result:m.result!==undefined?String(m.result):'',pair:m.pair||'',session:m.session||'',executionType:m.executionType||'',setupType:m.setupType||'',setup:m.setup||'',notas:m.notas||'',images:[m.images?.[0]||null,m.images?.[1]||null,m.images?.[2]||null],imageNotas:[m.imageNotas?.[0]||'',m.imageNotas?.[1]||'',m.imageNotas?.[2]||'']};
  const totalResult=t1.result!==''?parseFloat(t1.result):0;
  return{trades:[t1],totalResult,weekday:m.weekday||'',accountId:m.accountId||activeAccountId,result:totalResult,type:t1.type,pair:t1.pair,session:t1.session};
}

function migrateAllData(){
  let changed=false;
  Object.keys(data).forEach(k=>{if(data[k]&&!Array.isArray(data[k].trades)){data[k]=migrateEntry(data[k]);changed=true;}});
  if(changed)saveAccountData(activeAccountId,data);
}

function getDayTotalResult(e){if(!e)return null;if(e.totalResult!==undefined)return e.totalResult;if(e.result!==undefined&&e.result!=='')return Number(e.result);return null;}
function getDayActiveTrades(e){if(!e)return[];if(Array.isArray(e.trades))return e.trades.filter(t=>t.result!==''&&t.result!==undefined&&t.result!==null);return[];}
function getMonthEntries(y,m){const prefix=y+'-'+String(m+1).padStart(2,'0')+'-';return Object.entries(data).filter(([k])=>k.startsWith(prefix)).map(([k,v])=>({...migrateEntry(v),_key:k}));}
function getAllEntries(){return Object.entries(data).map(([k,v])=>({...migrateEntry(v),_key:k}));}

function getAllIndividualTrades(){
  const result=[];
  Object.entries(data).forEach(([k,v])=>{
    const entry=migrateEntry(v);if(!entry)return;
    (entry.trades||[]).forEach((t,i)=>{if(t.result!==''&&t.result!==undefined)result.push({...t,_dayKey:k,_tradeIndex:i,weekday:entry.weekday||'',result:parseFloat(t.result)||0});});
  });
  return result;
}

function calcStats(){
  const cap0=config.capital||5000;
  const entries=Object.values(data).map(migrateEntry).filter(Boolean);
  const tradedDays=entries.filter(e=>getDayTotalResult(e)!==null);
  const totalPnl=tradedDays.reduce((s,e)=>s+(getDayTotalResult(e)||0),0);
  const allTrades=getAllIndividualTrades();
  const wins=allTrades.filter(t=>t.result>0),losses=allTrades.filter(t=>t.result<0);
  const winRate=allTrades.length?(wins.length/allTrades.length*100):0;
  const monthEntries=getMonthEntries(curYear,curMonth);
  const monthTraded=monthEntries.filter(e=>getDayTotalResult(e)!==null);
  const monthPnl=monthTraded.reduce((s,e)=>s+(getDayTotalResult(e)||0),0);
  const monthPct=cap0?(monthPnl/cap0*100):0;
  const now=new Date();
  const sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));
  const weekKeys=[];for(let i=0;i<7;i++){const d=new Date(sow);d.setDate(d.getDate()+i);weekKeys.push(d.toISOString().split('T')[0]);}
  const weekPnl=weekKeys.reduce((s,k)=>{const e=data[k]?migrateEntry(data[k]):null;return s+(getDayTotalResult(e)||0);},0);
  const weekPct=cap0?(weekPnl/cap0*100):0;
  const todayEntry=data[TODAY]?migrateEntry(data[TODAY]):null;
  const todayPnl=getDayTotalResult(todayEntry)||0,todayPct=cap0?(todayPnl/cap0*100):0;
  const sortedDays=Object.keys(data).sort();
  let streak=0,streakType=null;
  for(let i=sortedDays.length-1;i>=0;i--){const e=migrateEntry(data[sortedDays[i]]);const r=getDayTotalResult(e);if(r===null)break;if(i===sortedDays.length-1)streakType=r>=0?'win':'loss';if((streakType==='win'&&r>=0)||(streakType==='loss'&&r<0))streak++;else break;}
  let best=null,worst=null;
  monthTraded.forEach(e=>{const r=getDayTotalResult(e);if(r===null)return;if(best===null||r>best)best=r;if(worst===null||r<worst)worst=r;});
  const greenDays=monthTraded.filter(e=>(getDayTotalResult(e)||0)>0).length;
  const redDays=monthTraded.filter(e=>(getDayTotalResult(e)||0)<0).length;
  const grossWin=wins.reduce((s,t)=>s+t.result,0);
  const grossLoss=Math.abs(losses.reduce((s,t)=>s+t.result,0));
  const profitFactor=grossLoss>0?(grossWin/grossLoss):(grossWin>0?Infinity:0);
  const avgWin=wins.length?grossWin/wins.length:0;
  const avgLoss=losses.length?grossLoss/losses.length:0;
  const lossRate=allTrades.length?(losses.length/allTrades.length*100):0;
  const expectancy=allTrades.length?((winRate/100*avgWin)-(lossRate/100*avgLoss)):0;
  let peak=0,cum=0,maxDD=0;
  sortedDays.forEach(k=>{const e=migrateEntry(data[k]);const r=getDayTotalResult(e);if(r===null)return;cum+=r;if(cum>peak)peak=cum;const dd=peak-cum;if(dd>maxDD)maxDD=dd;});
  return{cap0,totalPnl,wins,losses,totalTrades:allTrades.length,winRate,monthPnl,monthPct,weekPct,todayPct,streak,streakType,best,worst,greenDays,redDays,monthTraded,profitFactor,expectancy,maxDD,avgWin,avgLoss};
}

function updateSidebar(){
  if(viewMode==='global')return;
  const s=calcStats();
  document.getElementById('sCapital').textContent='$'+(s.cap0+s.totalPnl).toFixed(2);
  document.getElementById('headerCapital').textContent='$'+(s.cap0+s.totalPnl).toFixed(2);
  const chg=document.getElementById('sCapitalChange');chg.textContent=fmt$(s.totalPnl);chg.className='capital-change '+(s.totalPnl>=0?'val-win':'val-loss');
  const pnlEl=document.getElementById('sPnl');pnlEl.textContent=fmt$(s.totalPnl);pnlEl.className='stat-row-val '+(s.totalPnl>=0?'val-win':'val-loss');
  document.getElementById('sDiario').textContent=fmtP(s.todayPct);document.getElementById('sDiario').className='stat-row-val '+(s.todayPct>=0?'val-win':'val-loss');
  document.getElementById('sSemanal').textContent=fmtP(s.weekPct);document.getElementById('sSemanal').className='stat-row-val '+(s.weekPct>=0?'val-win':'val-loss');
  document.getElementById('sMensual').textContent=fmtP(s.monthPct);document.getElementById('sMensual').className='stat-row-val '+(s.monthPct>=0?'val-win':'val-loss');
  const wr=s.winRate;
  document.getElementById('sWinRate').textContent=wr.toFixed(0)+'%';
  document.getElementById('sWinBar').style.width=wr+'%';
  document.getElementById('sWins').textContent=s.wins.length;
  document.getElementById('sLosses').textContent=s.losses.length;
  document.getElementById('sTotalTrades').textContent=s.totalTrades+' trades';
  const si=document.getElementById('streakIcon'),sv=document.getElementById('streakVal'),sl=document.getElementById('streakLbl');
  if(s.streak>0){si.textContent=s.streakType==='win'?'🔥':'🐢';sv.textContent=s.streak;sv.className='streak-val '+(s.streakType==='win'?'val-win':'val-loss');sl.textContent=s.streakType==='win'?'dias ganadores':'dias perdedores';}
  else{si.textContent='--';sv.textContent='0';sv.className='streak-val';sl.textContent='Sin operaciones';}
  document.getElementById('sBest').textContent=s.best!==null?fmt$(s.best):'--';
  document.getElementById('sWorst').textContent=s.worst!==null?fmt$(s.worst):'--';
  document.getElementById('sGreenDays').textContent=s.greenDays;
  document.getElementById('sRedDays').textContent=s.redDays;
  const pfEl=document.getElementById('sProfitFactor');
  if(pfEl){pfEl.textContent=s.profitFactor===Infinity?'∞':s.profitFactor.toFixed(2);pfEl.className='stat-row-val '+(s.profitFactor>=1?'val-win':'val-loss');}
  const expEl=document.getElementById('sExpectancy');
  if(expEl){expEl.textContent=fmt$(s.expectancy);expEl.className='stat-row-val '+(s.expectancy>=0?'val-win':'val-loss');}
  const ddEl=document.getElementById('sMaxDD');
  if(ddEl){ddEl.textContent='-$'+s.maxDD.toFixed(2);ddEl.className='stat-row-val '+(s.maxDD>0?'val-loss':'');}
  drawConsistency();drawEquityChart();
}

function drawConsistency(){
  const now=new Date();const sow=new Date(now);sow.setDate(now.getDate()-((now.getDay()+6)%7));
  let html='';
  for(let i=0;i<7;i++){const d=new Date(sow);d.setDate(d.getDate()+i);const k=d.toISOString().split('T')[0];const e=data[k]?migrateEntry(data[k]):null;const r=getDayTotalResult(e);let color='var(--border2)';if(r!==null)color=r>=0?'rgba(53,212,154,0.5)':'rgba(255,92,112,0.5)';html+='<div class="cons-dot" title="'+k+'" style="background:'+color+'"></div>';}
  document.getElementById('consistencyDots').innerHTML=html;
}

function drawEquityChart(){
  const canvas=document.getElementById('equityChart');if(!canvas)return;
  const ctx=canvas.getContext('2d');const dpr=window.devicePixelRatio||1;
  canvas.width=canvas.offsetWidth*dpr;canvas.height=canvas.offsetHeight*dpr;ctx.scale(dpr,dpr);
  const W=canvas.offsetWidth,H=canvas.offsetHeight;ctx.clearRect(0,0,W,H);
  const sorted=Object.keys(data).sort();let cumPnl=0;const points=[{pnl:0}];
  sorted.forEach(k=>{const e=data[k]?migrateEntry(data[k]):null;const r=getDayTotalResult(e);if(r!==null){cumPnl+=r;points.push({pnl:cumPnl});}});
  if(points.length<2){ctx.fillStyle='rgba(139,146,176,0.4)';ctx.font='10px Syne';ctx.textAlign='center';ctx.fillText('Sin datos',W/2,H/2);return;}
  const vals=points.map(p=>p.pnl);const minV=Math.min(...vals),maxV=Math.max(...vals);const range=maxV-minV||1;
  const pad={t:4,b:4,l:4,r:4};const plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  const toX=i=>pad.l+(i/(points.length-1))*plotW;const toY=v=>pad.t+plotH-((v-minV)/range)*plotH;
  const isUp=points[points.length-1].pnl>=0;
  const grad=ctx.createLinearGradient(0,pad.t,0,H);
  grad.addColorStop(0,isUp?'rgba(53,212,154,0.22)':'rgba(255,92,112,0.22)');grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.moveTo(toX(0),toY(points[0].pnl));for(let i=1;i<points.length;i++)ctx.lineTo(toX(i),toY(points[i].pnl));
  ctx.lineTo(toX(points.length-1),H);ctx.lineTo(toX(0),H);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(toX(0),toY(points[0].pnl));for(let i=1;i<points.length;i++)ctx.lineTo(toX(i),toY(points[i].pnl));
  ctx.strokeStyle=isUp?'rgba(53,212,154,0.8)':'rgba(255,92,112,0.8)';ctx.lineWidth=1.5;ctx.stroke();
}

function renderCalendarGlobal(){
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('monthTitle').textContent=meses[curMonth]+' '+curYear+' -- Vista Global';
  document.getElementById('monthSub').textContent='Todas las cuentas combinadas';
  const firstDay=new Date(curYear,curMonth,1).getDay();const offset=(firstDay+6)%7;const daysInMonth=new Date(curYear,curMonth+1,0).getDate();
  let html='';for(let i=0;i<offset;i++)html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const k=key(curYear,curMonth,d);let totalPnl=0,hasAny=false;
    accounts.filter(a=>a.estado==='activa').forEach(a=>{const d2=loadAccountData(a.id);const e=d2[k]?migrateEntry(d2[k]):null;const r=getDayTotalResult(e);if(r!==null){totalPnl+=r;hasAny=true;}});
    const isToday=k===TODAY;let cls='day-cell';if(isToday)cls+=' today';if(hasAny&&totalPnl>0)cls+=' win-day';if(hasAny&&totalPnl<0)cls+=' loss-day';
    html+='<div class="'+cls+'"><div class="day-num">'+d+'</div>'+(hasAny?'<div class="day-result '+(totalPnl>=0?'pos':'neg')+'">'+fmt$(totalPnl)+'</div>':'')+'</div>';
  }
  document.getElementById('calendar').innerHTML=html;
}

function renderCalendar(){
  if(viewMode==='global'){renderCalendarGlobal();return;}
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const firstDay=new Date(curYear,curMonth,1).getDay();const offset=(firstDay+6)%7;const daysInMonth=new Date(curYear,curMonth+1,0).getDate();
  const monthEntries=getMonthEntries(curYear,curMonth);const traded=monthEntries.filter(e=>getDayTotalResult(e)!==null);
  document.getElementById('monthTitle').textContent=meses[curMonth]+' '+curYear;
  let totalMonthTrades=0;traded.forEach(e=>{totalMonthTrades+=(e.trades||[]).filter(t=>t.result!=='').length;});
  document.getElementById('monthSub').textContent=totalMonthTrades+' trade'+(totalMonthTrades!==1?'s':'')+' registrado'+(totalMonthTrades!==1?'s':'');
  const winDaysCount=traded.filter(e=>(getDayTotalResult(e)||0)>0).length;
  const lossDaysCount=traded.filter(e=>(getDayTotalResult(e)||0)<0).length;
  const fbAllC=document.getElementById('fbAllCount');if(fbAllC)fbAllC.textContent=traded.length;
  const fbWinC=document.getElementById('fbWinCount');if(fbWinC)fbWinC.textContent=winDaysCount;
  const fbLossC=document.getElementById('fbLossCount');if(fbLossC)fbLossC.textContent=lossDaysCount;
  let best=null,worst=null;
  monthEntries.forEach(e=>{const r=getDayTotalResult(e);if(r===null)return;if(best===null||r>best)best=r;if(worst===null||r<worst)worst=r;});
  let html='';for(let i=0;i<offset;i++)html+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const k=key(curYear,curMonth,d);const e=data[k]?migrateEntry(data[k]):null;
    const isToday=k===TODAY;const r=getDayTotalResult(e);const hasData=r!==null;
    const isWin=hasData&&r>0,isLoss=hasData&&r<0;
    let filteredOut=false;if(curFilter==='win'&&!isWin)filteredOut=true;if(curFilter==='loss'&&!isLoss)filteredOut=true;
    let classes='day-cell';if(isToday)classes+=' today';if(hasData&&r>0)classes+=' win-day';if(hasData&&r<0)classes+=' loss-day';
    if(filteredOut)classes+=' filtered-out';if(hasData&&r===best&&best>0)classes+=' best-day';if(hasData&&r===worst&&worst<0)classes+=' worst-day';
    const activeTrades=getDayActiveTrades(e);
    const tradeCountHtml=activeTrades.length>1?'<div style="font-size:10px;color:#fff;font-weight:700;font-family:var(--mono)">'+activeTrades.length+' trades</div>':'';
    const pairs=[...new Set(activeTrades.map(t=>t.pair).filter(Boolean))];
    const pairHtml=pairs.length?'<div style="font-size:12px;color:#fff;font-weight:700;margin-top:2px;font-family:var(--mono);letter-spacing:0.3px">'+pairs.join(' · ')+'</div>':'';
    let badgeHtml='';
    if(activeTrades.length){const types=activeTrades.map(t=>t.type).filter(Boolean);const hasTP=types.includes('TP'),hasSL=types.includes('SL'),hasBE=types.includes('BE');if(hasTP&&hasSL)badgeHtml='<div class="day-badge badge-mixed">+-</div>';else if(hasTP)badgeHtml='<div class="day-badge badge-tp">TP</div>';else if(hasSL)badgeHtml='<div class="day-badge badge-sl">SL</div>';else if(hasBE)badgeHtml='<div class="day-badge badge-be">BE</div>';}
    const resultHtml=hasData?'<div class="day-result '+(r>=0?'pos':'neg')+'" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:15px;font-weight:700;white-space:nowrap;text-align:center;">'+fmt$(r)+'</div>':'';
    html+='<div class="'+classes+'" onclick="openDayModal(\''+k+'\')">'+badgeHtml+'<div class="day-num">'+d+'</div>'+resultHtml+tradeCountHtml+pairHtml+(hasData?'<div style="position:absolute;inset:0;background:'+(r>=0?'rgba(53,212,154,0.09)':'rgba(255,92,112,0.09)')+';pointer-events:none;border-radius:inherit"></div>':'')+'</div>';
  }
  document.getElementById('calendar').innerHTML=html;
  updateSidebar();renderSideAcctInfo();renderRiskCard();
}

function setFilter(f){
  curFilter=f;
  ['All','Win','Loss'].forEach(x=>{document.getElementById('fb'+x).className='filter-btn';});
  if(f==='all')document.getElementById('fbAll').className='filter-btn active-all';
  if(f==='win')document.getElementById('fbWin').className='filter-btn active-win';
  if(f==='loss')document.getElementById('fbLoss').className='filter-btn active-loss';
  renderCalendar();
}

function changeMonth(dir){curMonth+=dir;if(curMonth>11){curMonth=0;curYear++;}if(curMonth<0){curMonth=11;curYear--;}renderCalendar();}

let currentModalKey=null;

function openDayModal(k){
  const parts=k.split('-');const y=parts[0],m=parts[1],d=parts[2];
  currentModalKey=k;activeTradeTab=0;
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('modalDateTitle').textContent=parseInt(d)+' de '+meses[parseInt(m)-1]+' '+y;
  const existing=data[k]?migrateEntry(data[k]):null;
  const existingTrades=existing?existing.trades||[]:[]; 
  currentDayTrades=[0,1,2].map(function(i){
    if(existingTrades[i]){
      const t=existingTrades[i];
      return{type:t.type||null,result:t.result!==undefined?String(t.result):'',pair:t.pair||'',session:t.session||'',executionType:t.executionType||'',setupType:t.setupType||'',setup:t.setup||'',notas:t.notas||'',images:[t.images?.[0]||null,t.images?.[1]||null,t.images?.[2]||null],imageNotas:[t.imageNotas?.[0]||'',t.imageNotas?.[1]||'',t.imageNotas?.[2]||'']};
    }
    return EMPTY_TRADE();
  });
  renderTradePanels();switchTradeTab(0);updateDaySummary();
  document.getElementById('tradeModal').classList.add('open');
}

function renderTradePanels(){
  document.getElementById('tradePanels').innerHTML=currentDayTrades.map(function(t,i){return buildTradePanel(t,i);}).join('');
  [0,1,2].forEach(function(i){
    const tab=document.getElementById('tradeTab'+i);const t=currentDayTrades[i];const hasData=t.result!=='';
    tab.classList.toggle('has-data',hasData);
    if(hasData){const r=parseFloat(t.result)||0;tab.classList.toggle('tab-win',r>0);tab.classList.toggle('tab-loss',r<0);}
    else{tab.classList.remove('tab-win','tab-loss');}
  });
}

function buildTradePanel(t,i){
  const pares=[{v:'SP500',l:'SP500'},{v:'NAS100',l:'NAS100'},{v:'US30',l:'US30'},{v:'RUSSEL',l:'RUSSEL'},{v:'EURUSD',l:'EURUSD'},{v:'GBPUSD',l:'GBPUSD'},{v:'XAUUSD',l:'XAUUSD'},{v:'OTRO',l:'OTRO'}];
  const pairOpts=pares.map(function(p){return '<option value="'+p.v+'"'+(t.pair===p.v?' selected':'')+'>'+p.l+'</option>';}).join('');
  const sessOpts=['Asia','Londres','NY','Overlap'].map(function(v){return '<option value="'+v+'"'+(t.session===v?' selected':'')+'>'+v+'</option>';}).join('');
  const execOpts=[['buena','Buena'],['mala','Mala'],['emocional','Emocional']].map(function(x){return '<option value="'+x[0]+'"'+(t.executionType===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('');
  const setupOpts='<option value="">-- Setup --</option><option value="Rango CRT - Order Block"'+(t.setupType==='Rango CRT - Order Block'?' selected':'')+'>Rango CRT - Order Block</option><option value="Rango CRT - Continuacion"'+(t.setupType==='Rango CRT - Continuacion'?' selected':'')+'>Rango CRT - Continuacion</option>';
  const imgLabels=['HTF / Bias','Entrada M5','Resultado'];
  let imgHTML='';
  for(let si=0;si<3;si++){
    const img=t.images[si];const nota=t.imageNotas[si]||'';
    imgHTML+='<div style="margin-bottom:12px">';
    imgHTML+='<div style="font-size:10px;color:var(--gold);margin-bottom:4px;font-weight:600">'+imgLabels[si]+'</div>';
    imgHTML+='<div class="img-slot" id="imgSlot_'+i+'_'+si+'" onclick="triggerImgUpload('+i+','+si+')" style="height:130px;cursor:pointer">';
    if(img){imgHTML+='<img src="'+img+'" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="event.stopPropagation();viewImgModal('+i+','+si+')">';imgHTML+='<button class="img-slot-del" onclick="removeImg(event,'+i+','+si+')">x</button>';}
    else{imgHTML+='<span class="img-slot-ico">&#128247;</span><span class="img-slot-lbl">'+imgLabels[si]+'</span>';}
    imgHTML+='</div>';
    imgHTML+='<textarea class="form-textarea" id="imgNota_'+i+'_'+si+'" placeholder="Nota de esta imagen..." rows="2" oninput="onImgNotaInput('+i+','+si+')" style="margin-top:4px;font-size:11px;min-height:38px">'+esc(nota)+'</textarea>';
    imgHTML+='</div>';
  }
  return '<div class="trade-panel" id="tradePanel'+i+'" style="display:none"><div class="result-type"><button class="type-btn'+(t.type==='TP'?' tp-active':'')+'" id="btnTP_'+i+'" onclick="setTradeType('+i+',\'TP\')">TP Ganado</button><button class="type-btn'+(t.type==='BE'?' be-active':'')+'" id="btnBE_'+i+'" onclick="setTradeType('+i+',\'BE\')">BE</button><button class="type-btn'+(t.type==='SL'?' sl-active':'')+'" id="btnSL_'+i+'" onclick="setTradeType('+i+',\'SL\')">SL Perdido</button></div><div class="form-row"><div class="form-group"><label class="form-label">Resultado ($)</label><input type="number" class="form-input" id="fRes_'+i+'" placeholder="45.50" step="0.01" value="'+esc(t.result)+'" oninput="onTradeInput('+i+')"></div><div class="form-group"><label class="form-label">Par</label><select class="form-select" id="fPair_'+i+'" onchange="onTradeInput('+i+')"><option value="">-- Par --</option>'+pairOpts+'</select></div></div><div class="form-row-3"><div class="form-group"><label class="form-label">Sesion</label><select class="form-select" id="fSess_'+i+'" onchange="onTradeInput('+i+')"><option value="">-- Sesion --</option>'+sessOpts+'</select></div><div class="form-group"><label class="form-label">Ejecucion</label><select class="form-select" id="fExec_'+i+'" onchange="onTradeInput('+i+')"><option value="">-- Ejecucion --</option>'+execOpts+'</select></div><div class="form-group"><label class="form-label">Setup CRT</label><select class="form-select" id="fSetupType_'+i+'" onchange="onTradeInput('+i+')">'+setupOpts+'</select></div></div><div class="form-row"><div class="form-group full"><label class="form-label">Detalle entrada</label><input type="text" class="form-input" id="fSetup_'+i+'" placeholder="Purge + OB H1 + FVG M5" value="'+esc(t.setup)+'" oninput="onTradeInput('+i+')"></div></div><div class="form-row"><div class="form-group full"><label class="form-label">Notas del trade</label><textarea class="form-textarea" id="fNotas_'+i+'" placeholder="Que salio bien? Que mejorar?" oninput="onTradeInput('+i+')">'+esc(t.notas)+'</textarea></div></div><div class="form-group" style="margin-top:12px"><label class="form-label">Screenshots (3 imagenes con notas)</label>'+imgHTML+'</div></div>';
}

function switchTradeTab(idx){
  activeTradeTab=idx;
  [0,1,2].forEach(function(i){
    const tab=document.getElementById('tradeTab'+i);if(tab)tab.classList.toggle('active',i===idx);
    const panel=document.getElementById('tradePanel'+i);if(panel)panel.style.display=i===idx?'block':'none';
  });
}

function setTradeType(tradeIdx,type){
  currentDayTrades[tradeIdx].type=type;
  document.getElementById('btnTP_'+tradeIdx).className='type-btn'+(type==='TP'?' tp-active':'');
  document.getElementById('btnBE_'+tradeIdx).className='type-btn'+(type==='BE'?' be-active':'');
  document.getElementById('btnSL_'+tradeIdx).className='type-btn'+(type==='SL'?' sl-active':'');
  onTradeInput(tradeIdx);
}

function onTradeInput(tradeIdx){
  const t=currentDayTrades[tradeIdx];
  t.result=document.getElementById('fRes_'+tradeIdx)?document.getElementById('fRes_'+tradeIdx).value:'';
  t.pair=document.getElementById('fPair_'+tradeIdx)?document.getElementById('fPair_'+tradeIdx).value:'';
  t.session=document.getElementById('fSess_'+tradeIdx)?document.getElementById('fSess_'+tradeIdx).value:'';
  t.executionType=document.getElementById('fExec_'+tradeIdx)?document.getElementById('fExec_'+tradeIdx).value:'';
  t.setupType=document.getElementById('fSetupType_'+tradeIdx)?document.getElementById('fSetupType_'+tradeIdx).value:'';
  t.setup=document.getElementById('fSetup_'+tradeIdx)?document.getElementById('fSetup_'+tradeIdx).value:'';
  t.notas=document.getElementById('fNotas_'+tradeIdx)?document.getElementById('fNotas_'+tradeIdx).value:'';
  updateDaySummary();
  const tab=document.getElementById('tradeTab'+tradeIdx);const hasData=t.result!=='';
  tab.classList.toggle('has-data',hasData);
  if(hasData){const r=parseFloat(t.result)||0;tab.classList.toggle('tab-win',r>0);tab.classList.toggle('tab-loss',r<0);}
  else{tab.classList.remove('tab-win','tab-loss');}
}

function onImgNotaInput(tradeIdx,slotIdx){
  const el=document.getElementById('imgNota_'+tradeIdx+'_'+slotIdx);
  if(el)currentDayTrades[tradeIdx].imageNotas[slotIdx]=el.value;
}

function updateDaySummary(){
  let total=0,count=0;
  currentDayTrades.forEach(function(t){if(t.result!==''&&t.result!==null&&t.result!==undefined){const v=parseFloat(t.result);if(!isNaN(v)){total+=v;count++;}}});
  const valEl=document.getElementById('daySummaryVal');const trdEl=document.getElementById('daySummaryTrades');
  if(valEl){valEl.textContent=fmt$(total);valEl.className='day-summary-val '+(total>=0?'val-win':'val-loss');}
  if(trdEl)trdEl.textContent=count+' trade'+(count!==1?'s':'')+' activo'+(count!==1?'s':'');
}

function triggerImgUpload(tradeIdx,slotIdx){activeImgTradeIdx=tradeIdx;activeImgSlotIdx=slotIdx;const inp=document.getElementById('fImagenMulti');if(inp){inp.value='';inp.click();}}

function handleMultiImage(event){
  const file=event.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){currentDayTrades[activeImgTradeIdx].images[activeImgSlotIdx]=e.target.result;refreshImgSlot(activeImgTradeIdx,activeImgSlotIdx);};
  reader.readAsDataURL(file);
}

function refreshImgSlot(tradeIdx,slotIdx){
  const slot=document.getElementById('imgSlot_'+tradeIdx+'_'+slotIdx);if(!slot)return;
  const src=currentDayTrades[tradeIdx].images[slotIdx];
  const labels=['HTF / Bias','Entrada M5','Resultado'];
  if(src){slot.innerHTML='<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;border-radius:6px;cursor:zoom-in" onclick="event.stopPropagation();viewImgModal('+tradeIdx+','+slotIdx+')"><button class="img-slot-del" onclick="removeImg(event,'+tradeIdx+','+slotIdx+')">x</button>';}
  else{slot.innerHTML='<span class="img-slot-ico">&#128247;</span><span class="img-slot-lbl">'+labels[slotIdx]+'</span>';}
}

function removeImg(event,tradeIdx,slotIdx){event.stopPropagation();currentDayTrades[tradeIdx].images[slotIdx]=null;refreshImgSlot(tradeIdx,slotIdx);}

function viewImgModal(tradeIdx,slotIdx){
  const src=currentDayTrades[tradeIdx].images[slotIdx];if(!src)return;
  const nota=currentDayTrades[tradeIdx].imageNotas[slotIdx]||'';
  viewImg(src,nota);
}

function viewImg(src,nota){
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;cursor:zoom-out';
  let inner='<div style="position:fixed;top:16px;right:20px;color:white;font-size:28px;cursor:pointer;z-index:10000" onclick="this.closest(\'[style*=fixed]\').remove()">X</div>';
  inner+='<img src="'+src+'" style="max-width:92vw;max-height:'+(nota?'72':'85')+'vh;border-radius:10px;box-shadow:0 0 60px rgba(0,0,0,0.9);object-fit:contain">';
  if(nota)inner+='<div style="margin-top:16px;max-width:85vw;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 16px;color:#fff;font-size:13px;line-height:1.5;text-align:center;cursor:default" onclick="event.stopPropagation()">'+esc(nota)+'</div>';
  overlay.innerHTML=inner;
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
}

function getMonthNoteKey(){return curYear+'-'+curMonth;}
function getMonthNote(){config.monthlyNotes=config.monthlyNotes||{};return config.monthlyNotes[getMonthNoteKey()]||'';}
function saveMonthNoteVal(v){config.monthlyNotes=config.monthlyNotes||{};config.monthlyNotes[getMonthNoteKey()]=v;saveAccountConfig(activeAccountId,config);}

function openMonthNote(){
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  const val=getMonthNote();
  let inner='<div onclick="event.stopPropagation()" style="background:var(--surface,#fff);border-radius:10px;padding:20px;max-width:480px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.3)">';
  inner+='<div style="font-family:var(--sans,sans-serif);font-weight:700;font-size:15px;margin-bottom:4px;color:var(--text,#111)">Resumen del mes</div>';
  inner+='<div style="font-family:var(--mono,monospace);font-size:11px;color:var(--muted,#888);margin-bottom:12px">'+meses[curMonth]+' '+curYear+' -- se incluye en el PDF exportado</div>';
  inner+='<textarea id="monthNoteInput" rows="6" placeholder="Ej: Mes disciplinado, respete 1-5-9. Unico error fue el SL del equilibrio del dia 25..." style="width:100%;font-family:var(--sans,sans-serif);font-size:13px;padding:10px;background:var(--surface2,#161B24);color:var(--text,#F2F4F7);border:1px solid var(--border2,#2B3240);border-radius:8px;resize:vertical;box-sizing:border-box;outline:none">'+esc(val)+'</textarea>';
  inner+='<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">';
  inner+='<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:9px 16px;border-radius:8px;border:1px solid var(--border2,#ccc);background:var(--surface2,#eee);cursor:pointer;font-family:var(--mono,monospace);font-size:12px;font-weight:700;color:var(--text2,#555)">Cancelar</button>';
  inner+='<button onclick="saveMonthNoteVal(document.getElementById(\'monthNoteInput\').value);this.closest(\'[style*=fixed]\').remove();toast(\'Resumen del mes guardado\')" style="padding:9px 16px;border-radius:8px;border:none;background:var(--gold,#B8962E);cursor:pointer;font-family:var(--mono,monospace);font-size:12px;font-weight:700;color:#fff">Guardar</button>';
  inner+='</div></div>';
  overlay.innerHTML=inner;
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay);};
  document.body.appendChild(overlay);
  setTimeout(function(){const ta=document.getElementById('monthNoteInput');if(ta)ta.focus();},50);
}

function saveDay(){
  if(!currentModalKey)return;
  const k=currentModalKey;
  const dateObj=new Date(k+'T12:00:00');
  const weekdays=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  onTradeInput(activeTradeTab);
  const tradesWithData=currentDayTrades.filter(function(t){return t.result!==''&&t.result!==null;});
  if(!tradesWithData.length){delete data[k];saveAccountData(activeAccountId,data);closeTradeModal();renderCalendar();toast('Sin trades -- dia limpiado');return;}
  const totalResult=tradesWithData.reduce(function(s,t){return s+(parseFloat(t.result)||0);},0);
  const cleanTrades=currentDayTrades.map(function(t){return{type:t.type,result:t.result!==''?parseFloat(t.result):'',pair:t.pair,session:t.session,executionType:t.executionType,setupType:t.setupType,setup:t.setup,notas:t.notas,images:[t.images[0]||null,t.images[1]||null,t.images[2]||null],imageNotas:[t.imageNotas[0]||'',t.imageNotas[1]||'',t.imageNotas[2]||'']};});
  data[k]={trades:cleanTrades,totalResult:totalResult,weekday:weekdays[dateObj.getDay()],accountId:activeAccountId,result:totalResult,type:cleanTrades[0]?cleanTrades[0].type:null,pair:cleanTrades[0]?cleanTrades[0].pair:'',session:cleanTrades[0]?cleanTrades[0].session:''};
  saveAccountData(activeAccountId,data);
  if(activeAccountId==='default')localStorage.setItem('mtj_data',JSON.stringify(data));
  closeTradeModal();renderCalendar();toast(tradesWithData.length+' trade'+(tradesWithData.length>1?'s':'')+' guardado'+(tradesWithData.length>1?'s':''));
}

function clearDay(){if(!currentModalKey)return;if(!confirm('Borrar todos los trades de este dia?'))return;delete data[currentModalKey];saveAccountData(activeAccountId,data);if(activeAccountId==='default')localStorage.setItem('mtj_data',JSON.stringify(data));closeTradeModal();renderCalendar();renderSideAcctInfo();renderRiskCard();toast('Dia borrado');}
function closeTradeModal(){document.getElementById('tradeModal').classList.remove('open');currentModalKey=null;}

let editingAcctId=null;
function openAcctModal(id){
  editingAcctId=id;
  const acct=id?accounts.find(function(a){return a.id===id;}):null;
  document.getElementById('acctModalTitle').textContent=acct?'EDITAR CUENTA':'NUEVA CUENTA';
  document.getElementById('acctBroker').value=acct?acct.broker||'':'';
  document.getElementById('acctBalance').value=acct?acct.balanceInicial||'':'';
  document.getElementById('acctTipo').value=acct?acct.tipo||'challenge':'challenge';
  document.getElementById('acctFase').value=acct?acct.fase||'fase1':'fase1';
  document.getElementById('acctMaxDD').value=acct?acct.maxDrawdown||10:10;
  document.getElementById('acctTarget').value=acct?acct.target||10:10;
  document.getElementById('acctLabel').value=acct?acct.label||'':'';
  document.getElementById('acctDeleteBtn').style.display=acct?'block':'none';
  document.getElementById('acctModal').classList.add('open');
}
function closeAcctModal(){document.getElementById('acctModal').classList.remove('open');editingAcctId=null;}

function saveAccount(){
  const broker=document.getElementById('acctBroker').value.trim();
  if(!broker){alert('Ingresa el nombre del broker.');return;}
  const balance=parseFloat(document.getElementById('acctBalance').value)||5000;
  const tipo=document.getElementById('acctTipo').value;const fase=document.getElementById('acctFase').value;
  const maxDD=parseFloat(document.getElementById('acctMaxDD').value)||10;const target=parseFloat(document.getElementById('acctTarget').value)||10;
  const label=document.getElementById('acctLabel').value.trim()||broker;
  if(editingAcctId){
    const idx=accounts.findIndex(function(a){return a.id===editingAcctId;});
    if(idx>=0){accounts[idx]=Object.assign({},accounts[idx],{broker:broker,balanceInicial:balance,tipo:tipo,fase:fase,maxDrawdown:maxDD,target:target,label:label});
    const cfg=loadAccountConfig(editingAcctId);cfg.capital=balance;saveAccountConfig(editingAcctId,cfg);if(editingAcctId===activeAccountId)config.capital=balance;}
  }else{const newId='acct_'+Date.now();accounts.push({id:newId,broker:broker,balanceInicial:balance,tipo:tipo,fase:fase,maxDrawdown:maxDD,target:target,label:label,estado:'activa',createdAt:new Date().toISOString()});}
  saveAccounts();closeAcctModal();renderAccountBar();renderSideAcctInfo();renderRiskCard();toast('Cuenta guardada');
}

function deleteAccount(){
  if(!editingAcctId)return;
  const acct=accounts.find(function(a){return a.id===editingAcctId;});
  if(!confirm('Eliminar "'+(acct?acct.label||acct.broker:'cuenta')+'" y todos sus datos?'))return;
  const idx=accounts.findIndex(function(a){return a.id===editingAcctId;});if(idx>=0)accounts.splice(idx,1);
  localStorage.removeItem(getAccountDataKey(editingAcctId));localStorage.removeItem(getAccountConfigKey(editingAcctId));
  if(editingAcctId==='default'){accounts.unshift({id:'default',broker:'Personal',tipo:'personal',fase:'n/a',balanceInicial:5000,maxDrawdown:10,target:10,label:'Cuenta Principal',estado:'activa',createdAt:new Date().toISOString()});}
  saveAccounts();closeAcctModal();const nextId=(accounts.find(function(a){return a.estado==='activa';})||{id:'default'}).id;switchAccount(nextId);toast('Cuenta eliminada');
}

function openSettings(){document.getElementById('fCapitalInicial').value=config.capital||5000;document.getElementById('settingsModal').classList.add('open');}
function closeSettings(){document.getElementById('settingsModal').classList.remove('open');}
function saveCapital(){
  const v=parseFloat(document.getElementById('fCapitalInicial').value);if(!v||v<=0)return;
  config.capital=v;saveAccountConfig(activeAccountId,config);if(activeAccountId==='default')localStorage.setItem('mtj_config',JSON.stringify(config));
  const acctIdx=accounts.findIndex(function(a){return a.id===activeAccountId;});if(acctIdx>=0){accounts[acctIdx].balanceInicial=v;saveAccounts();}
  closeSettings();renderCalendar();renderSideAcctInfo();renderRiskCard();toast('Capital: $'+v.toFixed(2));
}

function openConsolidado(){renderConsolidado();document.getElementById('consolidadoPanel').classList.add('open');}
function closeConsolidado(){document.getElementById('consolidadoPanel').classList.remove('open');}
function renderConsolidado(){
  const el=document.getElementById('consolidadoContent');if(!el)return;
  const activeAccts=accounts.filter(function(a){return a.estado==='activa';});
  let totalPnl=0,totalTrades=0,totalWins=0;
  const rows=activeAccts.map(function(acct){
    const d=loadAccountData(acct.id);const entries=Object.values(d).map(migrateEntry).filter(Boolean);
    const pnl=entries.reduce(function(s,e){return s+(getDayTotalResult(e)||0);},0);
    const allT=[];entries.forEach(function(e){(e.trades||[]).forEach(function(t){if(t.result!=='')allT.push(t);});});
    const wins=allT.filter(function(t){return parseFloat(t.result||0)>0;}).length;
    const trades=allT.length;const wr=trades?(wins/trades*100):0;const r=calcularRiesgoCuenta(acct);
    totalPnl+=pnl;totalTrades+=trades;totalWins+=wins;
    const tipoClass=acct.tipo==='funded'?'cons-funded':acct.tipo==='challenge'?'cons-challenge':'cons-personal';
    const label=acct.label||((acct.broker||'')+(acct.fase!=='n/a'?' '+acct.fase:'')).trim();
    return '<div class="cons-acct-row"><div><div class="cons-broker">'+esc(label)+'</div><div style="font-size:9px;color:var(--muted)">'+esc(acct.broker||'')+'</div></div><div><span class="cons-tipo '+tipoClass+'">'+acct.tipo.toUpperCase()+'</span></div><div style="font-family:var(--mono);font-weight:700;font-size:11px;color:'+(pnl>=0?'var(--win)':'var(--loss)')+'">'+fmt$(pnl)+'</div><div style="font-family:var(--mono);font-size:10px;color:var(--text2)">'+wr.toFixed(0)+'%</div><div style="font-size:9px"><span style="font-size:8px;font-weight:700;color:'+(r.modo==='DEFENSIVO'?'var(--loss)':r.modo==='NEUTRO'?'var(--gold)':'var(--win)')+'">'+r.modo+'</span></div><div style="font-size:10px;color:var(--muted)">'+trades+' trades</div></div>';
  }).join('');
  const gWr=totalTrades?(totalWins/totalTrades*100):0;
  el.innerHTML='<div class="cons-grid"><div class="cons-kpi"><div class="cons-kpi-lbl">PnL Global</div><div class="cons-kpi-val" style="color:'+(totalPnl>=0?'var(--win)':'var(--loss)')+'">'+fmt$(totalPnl)+'</div></div><div class="cons-kpi"><div class="cons-kpi-lbl">Cuentas activas</div><div class="cons-kpi-val">'+activeAccts.length+'</div></div><div class="cons-kpi"><div class="cons-kpi-lbl">Total Trades</div><div class="cons-kpi-val">'+totalTrades+'</div></div><div class="cons-kpi"><div class="cons-kpi-lbl">Win Rate</div><div class="cons-kpi-val">'+gWr.toFixed(0)+'%</div></div></div><div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden"><div class="cons-acct-row header"><div>Cuenta</div><div>Tipo</div><div>P&amp;L</div><div>WR</div><div>Modo</div><div>Trades</div></div>'+rows+'</div>';
}

function exportBackup(){
  const backup={_version:2,_exportedAt:new Date().toISOString(),data:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&(k===LS_ACCOUNTS||k===LS_DATA_LEGACY||k===LS_CFG_LEGACY||k.startsWith(LS_DATA_PFX)||k.startsWith(LS_CFG_PFX)))backup.data[k]=localStorage.getItem(k);}
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='mareblu-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);toast('Backup exportado');
}
function importBackup(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=function(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=function(ev){try{const backup=JSON.parse(ev.target.result);if(!backup._version||!backup.data){alert('Archivo invalido.');return;}if(!confirm('Restaurar backup del '+( backup._exportedAt?backup._exportedAt.slice(0,10):'?')+'? Esto reemplazara todos los datos actuales.'))return;Object.entries(backup.data).forEach(function(pair){localStorage.setItem(pair[0],pair[1]);});toast('Backup restaurado -- recargando...');setTimeout(function(){location.reload();},1200);}catch(err){alert('Error al leer el archivo.');}};
    reader.readAsText(file);
  };
  document.body.appendChild(input);input.click();document.body.removeChild(input);
}

let intelCurTab='dashboard';
function openIntel(){migrateAllData();document.getElementById('intelPanel').classList.add('open');renderIntel(intelCurTab);}
function closeIntel(){document.getElementById('intelPanel').classList.remove('open');}
function switchIntelTab(tab){
  intelCurTab=tab;document.querySelectorAll('.intel-tab').forEach(function(el){el.classList.remove('active');});
  const tabs=['dashboard','pares','sesiones','dias','setups','insights'];const idx=tabs.indexOf(tab);if(idx>=0)document.querySelectorAll('.intel-tab')[idx].classList.add('active');
  renderIntel(tab);
}
function analizarPatronesTrading(){
  const all=getAllIndividualTrades().filter(function(t){return t.result!==''&&t.result!==undefined;});
  function groupBy(k){const g={};all.forEach(function(e){const key=e[k]||'Sin especificar';if(!g[key])g[key]={trades:0,wins:0,pnl:0};g[key].trades++;if(Number(e.result)>0)g[key].wins++;g[key].pnl+=Number(e.result||0);});return Object.entries(g).map(function(pair){const n=pair[0],d=pair[1];return{name:n,trades:d.trades,wins:d.wins,pnl:d.pnl,winRate:d.trades?(d.wins/d.trades*100):0,avgPnl:d.trades?(d.pnl/d.trades):0};}).sort(function(a,b){return b.pnl-a.pnl;});}
  const dayOrder=['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
  return{porPar:groupBy('pair'),porSession:groupBy('session'),porSetup:groupBy('setupType'),porDia:groupBy('weekday').sort(function(a,b){return dayOrder.indexOf(a.name)-dayOrder.indexOf(b.name);}),porExec:groupBy('executionType'),total:all.length};
}
function renderIntel(tab){
  const p=analizarPatronesTrading();const el=document.getElementById('intelContent');
  if(!p.total){el.innerHTML='<div class="i-empty">No hay operaciones registradas. Registra trades para ver inteligencia.</div>';return;}
  if(tab==='dashboard')el.innerHTML=renderIntelDashboard(p);
  else if(tab==='pares')el.innerHTML=renderIntelTable(p.porPar,'Por Par','Par');
  else if(tab==='sesiones')el.innerHTML=renderIntelTable(p.porSession,'Por Sesion','Sesion');
  else if(tab==='dias')el.innerHTML=renderIntelTable(p.porDia,'Por Dia','Dia');
  else if(tab==='setups')el.innerHTML=renderIntelTable(p.porSetup,'Por Setup','Setup');
  else if(tab==='insights')el.innerHTML=renderIntelInsights(p);
}
function renderIntelDashboard(p){
  const bP=p.porPar.filter(function(r){return r.trades>=2;}).sort(function(a,b){return b.winRate-a.winRate;})[0];
  const bS=p.porSession.filter(function(r){return r.trades>=2;}).sort(function(a,b){return b.winRate-a.winRate;})[0];
  const bD=p.porDia.filter(function(r){return r.trades>=2;}).sort(function(a,b){return b.winRate-a.winRate;})[0];
  const bSt=p.porSetup.filter(function(r){return r.trades>=2;}).sort(function(a,b){return b.winRate-a.winRate;})[0];
  const bPnl=p.porPar.slice().sort(function(a,b){return b.pnl-a.pnl;})[0];
  function card(ico,lbl,val,sub,col){return '<div class="i-card"><div class="i-card-icon">'+ico+'</div><div class="i-card-label">'+lbl+'</div><div class="i-card-val" style="color:'+(col||'var(--gold)')+'">'+val+'</div><div class="i-card-sub">'+sub+'</div></div>';}
  return '<div class="i-grid">'+(bP?card('Par',bP.name,bP.winRate.toFixed(0)+'% WR',bP.trades+' trades'):card('Par','--','--','Sin datos'))+(bS?card('Sesion',bS.name,bS.winRate.toFixed(0)+'% WR',fmt$(bS.pnl)):card('Sesion','--','--','Sin datos'))+(bD?card('Dia',bD.name,bD.winRate.toFixed(0)+'% WR',bD.trades+' trades'):card('Dia','--','--','Sin datos'))+(bSt?card('Setup',bSt.name,bSt.winRate.toFixed(0)+'% WR',bSt.trades+' ops'):card('Setup','--','--','Sin datos'))+(bPnl?card('PnL',bPnl.name,fmt$(bPnl.pnl),'total',bPnl.pnl>=0?'var(--win)':'var(--loss)'):'')+'</div>'+(p.porPar.length?'<div class="i-section-title">Por par</div>'+renderMiniTable(p.porPar.slice(0,5)):'')+(p.porSession.length?'<div class="i-section-title">Por sesion</div>'+renderMiniTable(p.porSession):'');
}
function renderMiniTable(rows){return '<table class="i-table"><thead><tr><th>#</th><th>Nombre</th><th>Trades</th><th>Win Rate</th><th>PnL</th><th>Avg</th></tr></thead><tbody>'+rows.map(function(r,i){return '<tr><td class="i-rank">'+(i+1)+'</td><td class="i-name">'+r.name+'</td><td style="font-family:var(--mono);font-size:10px">'+r.trades+'</td><td><span style="font-family:var(--mono);font-weight:700;color:'+(r.winRate>=55?'var(--win)':r.winRate>=40?'var(--gold)':'var(--loss)')+'">'+r.winRate.toFixed(0)+'%</span></td><td style="font-family:var(--mono);font-weight:700;color:'+(r.pnl>=0?'var(--win)':'var(--loss)')+'">'+fmt$(r.pnl)+'</td><td style="font-family:var(--mono);font-size:10px;color:'+(r.avgPnl>=0?'rgba(53,212,154,0.8)':'rgba(255,92,112,0.8)')+'">'+fmt$(r.avgPnl)+'</td></tr>';}).join('')+'</tbody></table>';}
function renderIntelTable(rows,title,ico){if(!rows.length)return'<div class="i-empty">Sin datos para este analisis.</div>';return'<div class="i-section-title">'+ico+' '+title+'</div>'+renderMiniTable(rows);}
function renderIntelInsights(p){
  const ins=[];
  const pares=p.porPar.filter(function(r){return r.trades>=3;});
  if(pares.length){const best=pares.slice().sort(function(a,b){return b.winRate-a.winRate;})[0];ins.push({ico:'Par',txt:'<strong>'+best.name+'</strong> es tu par mas rentable con '+best.winRate.toFixed(0)+'% WR en '+best.trades+' trades.'});}
  const sess=p.porSession.filter(function(r){return r.trades>=2;});
  if(sess.length){const best=sess.slice().sort(function(a,b){return b.winRate-a.winRate;})[0];ins.push({ico:'Ses',txt:'Sesion <strong>'+best.name+'</strong> es la mas rentable: '+best.winRate.toFixed(0)+'% WR con '+fmt$(best.pnl)+' PnL.'});}
  if(!ins.length)return'<div class="i-empty">Registra al menos 3-5 trades con par, sesion y setup para ver insights.</div>';
  return ins.map(function(item){return'<div class="i-insight"><span class="i-insight-ico">'+item.ico+'</span><span class="i-insight-text">'+item.txt+'</span></div>';}).join('');
}

let heatmapCurTab='hora';
function openHeatmap(){document.getElementById('heatmapPanel').classList.add('open');renderHeatmap(heatmapCurTab);}
function closeHeatmap(){document.getElementById('heatmapPanel').classList.remove('open');}
function switchHeatmapTab(tab){heatmapCurTab=tab;document.querySelectorAll('.heatmap-tab').forEach(function(el){el.classList.remove('active');});const el=document.getElementById('htab-'+tab);if(el)el.classList.add('active');renderHeatmap(tab);}
function renderHeatmap(tab){
  const el=document.getElementById('heatmapContent');if(!el)return;
  const trades=getAllIndividualTrades().filter(function(t){return t.result!==''&&t.result!==undefined;});
  if(!trades.length){el.innerHTML='<div class="i-empty">Sin trades registrados.</div>';return;}
  if(tab==='hora')el.innerHTML=renderHeatmapGrid(trades);
  else if(tab==='dia')el.innerHTML=renderHeatmapDia(trades);
  else if(tab==='sesion')el.innerHTML=renderHeatmapSesion(trades);
}
function heatColor(pnl,maxAbs){if(maxAbs===0)return'rgba(42,48,72,0.6)';const r=Math.max(-1,Math.min(1,pnl/maxAbs));if(r>0){const a=Math.min(0.9,0.15+r*0.75);return'rgba(53,212,154,'+a.toFixed(2)+')';}else if(r<0){const a=Math.min(0.9,0.15+Math.abs(r)*0.75);return'rgba(255,92,112,'+a.toFixed(2)+')';}return'rgba(42,48,72,0.6)';}
function heatTC(pnl,maxAbs){return maxAbs===0?'var(--muted)':Math.abs(pnl/maxAbs)>0.3?'#fff':'var(--text2)';}
function renderHeatmapGrid(trades){
  const days=['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
  const sessions=['Asia','Londres','NY','Overlap'];
  const m={};days.forEach(function(d){m[d]={};sessions.forEach(function(s){m[d][s]={pnl:0,count:0,wins:0};});});
  trades.forEach(function(t){const day=t.weekday||'';const ses=t.session||'';if(m[day]&&m[day][ses]!==undefined){m[day][ses].pnl+=Number(t.result||0);m[day][ses].count++;if(Number(t.result)>0)m[day][ses].wins++;}});
  let maxAbs=0;days.forEach(function(d){sessions.forEach(function(s){const v=Math.abs(m[d][s].pnl);if(v>maxAbs)maxAbs=v;});});
  const totalPnl=trades.reduce(function(s,t){return s+Number(t.result||0);},0);
  const wins=trades.filter(function(t){return Number(t.result)>0;}).length;
  let html='<div class="hm-stats-row"><div class="hm-stat"><div class="hm-stat-lbl">P&amp;L Total</div><div class="hm-stat-val" style="color:'+(totalPnl>=0?'var(--win)':'var(--loss)')+'">'+fmt$(totalPnl)+'</div></div><div class="hm-stat"><div class="hm-stat-lbl">Trades</div><div class="hm-stat-val">'+trades.length+'</div></div><div class="hm-stat"><div class="hm-stat-lbl">Win Rate</div><div class="hm-stat-val" style="color:var(--win)">'+(trades.length?(wins/trades.length*100).toFixed(0):0)+'%</div></div></div>';
  html+='<div class="hm-grid-wrap"><table class="hm-table"><thead><tr><th class="hm-th-day"></th>'+sessions.map(function(s){return'<th class="hm-th-sess">'+s+'</th>';}).join('')+'</tr></thead><tbody>';
  days.forEach(function(day){
    html+='<tr><td class="hm-td-day">'+day+'</td>';
    sessions.forEach(function(ses){const cell=m[day][ses];const bg=heatColor(cell.pnl,maxAbs);const tc=heatTC(cell.pnl,maxAbs);if(cell.count===0)html+='<td class="hm-td empty"><span class="hm-empty">--</span></td>';else html+='<td class="hm-td" style="background:'+bg+'"><div class="hm-cell-pnl" style="color:'+tc+'">'+fmt$(cell.pnl)+'</div><div class="hm-cell-meta" style="color:'+tc+';opacity:0.75">'+cell.count+'t</div></td>';});
    html+='</tr>';
  });
  html+='</tbody></table></div>';return html;
}
function renderHeatmapDia(trades){
  const days=['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
  const stats={};days.forEach(function(d){stats[d]={pnl:0,count:0,wins:0};});
  trades.forEach(function(t){const d=t.weekday||'';if(stats[d]){stats[d].pnl+=Number(t.result||0);stats[d].count++;if(Number(t.result)>0)stats[d].wins++;}});
  const maxAbs=Math.max.apply(null,days.map(function(d){return Math.abs(stats[d].pnl);}).concat([1]));
  let html='<div class="hm-bar-section">';
  days.forEach(function(day){const s=stats[day];if(s.count===0)return;const pct=Math.abs(s.pnl/maxAbs*100);const isPos=s.pnl>=0;html+='<div class="hm-bar-row"><div class="hm-bar-label">'+day+'</div><div class="hm-bar-track"><div class="hm-bar-fill" style="width:'+pct+'%;background:'+(isPos?'rgba(53,212,154,0.7)':'rgba(255,92,112,0.7)')+'"></div></div><div class="hm-bar-val" style="color:'+(isPos?'var(--win)':'var(--loss)')+'">'+fmt$(s.pnl)+'</div><div class="hm-bar-meta">'+s.count+'t</div></div>';});
  html+='</div>';return html;
}
function renderHeatmapSesion(trades){
  const sessions=['Asia','Londres','NY','Overlap'];const stats={};sessions.forEach(function(s){stats[s]={pnl:0,count:0,wins:0};});
  trades.forEach(function(t){const s=t.session||'';if(stats[s]){stats[s].pnl+=Number(t.result||0);stats[s].count++;if(Number(t.result)>0)stats[s].wins++;}});
  const maxAbs=Math.max.apply(null,sessions.map(function(s){return Math.abs(stats[s].pnl);}).concat([1]));
  let html='<div class="hm-bar-section">';
  sessions.forEach(function(ses){const s=stats[ses];if(s.count===0)return;const pct=Math.abs(s.pnl/maxAbs*100);const isPos=s.pnl>=0;const col=ses==='Londres'?'rgba(91,156,246,0.7)':ses==='NY'?'rgba(200,168,75,0.7)':'rgba(139,146,176,0.5)';html+='<div class="hm-bar-row"><div class="hm-bar-label">'+ses+'</div><div class="hm-bar-track"><div class="hm-bar-fill" style="width:'+pct+'%;background:'+col+'"></div></div><div class="hm-bar-val" style="color:'+(isPos?'var(--win)':'var(--loss)')+'">'+fmt$(s.pnl)+'</div><div class="hm-bar-meta">'+s.count+'t</div></div>';});
  html+='</div>';return html;
}


function exportCalendarPDF(){
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const acct=accounts.find(function(a){return a.id===activeAccountId;});
  const label=acct?acct.label||acct.broker:'Cuenta';
  const firstDay=new Date(curYear,curMonth,1).getDay();
  const offset=(firstDay+6)%7;
  const daysInMonth=new Date(curYear,curMonth+1,0).getDate();
  const monthEntries=getMonthEntries(curYear,curMonth);
  let totalPnl=0,greenCount=0,redCount=0;
  monthEntries.forEach(function(e){const r=getDayTotalResult(e);if(r!==null){totalPnl+=r;if(r>0)greenCount++;else redCount++;}});

  let cells='';
  const dias=['LUN','MAR','MIE','JUE','VIE','SAB','DOM'];
  dias.forEach(function(d){cells+='<div class="cal-hdr">'+d+'</div>';});
  for(let i=0;i<offset;i++)cells+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=daysInMonth;d++){
    const k=key(curYear,curMonth,d);
    const e=data[k]?migrateEntry(data[k]):null;
    const r=getDayTotalResult(e);
    const hasData=r!==null;
    const activeTrades=getDayActiveTrades(e||{});
    const pairs=[...new Set(activeTrades.map(function(t){return t.pair;}).filter(Boolean))];
    const pairStr=pairs.join(' · ');
    const types=activeTrades.map(function(t){return t.type;}).filter(Boolean);
    const badge=types.includes('TP')&&types.includes('SL')?'±':types.includes('TP')?'TP':types.includes('SL')?'SL':types.includes('BE')?'BE':'';
    const badgeCls=badge==='BE'?'be':(r>=0?'tp':'sl');
    const bgColor=hasData?(r>=0?'#e8f5e9':'#ffebee'):'#fff';
    const pnlColor=hasData?(r>=0?'#1b5e20':'#b71c1c'):'';
    cells+='<div class="cal-cell" style="background:'+bgColor+'">';
    cells+='<div class="day-n">'+d+(badge?'<span class="bdg '+badgeCls+'">'+badge+'</span>':'')+'</div>';
    if(hasData)cells+='<div class="pnl" style="color:'+pnlColor+'">'+fmt$(r)+'</div>';
    if(pairStr)cells+='<div class="pair">'+pairStr+'</div>';
    cells+='</div>';
  }

  const stats=calcStats();
  const monthNote=getMonthNote();
  const noteHtml=monthNote?'<div class="month-note"><div class="month-note-lbl">Resumen del mes</div><div class="month-note-txt">'+esc(monthNote).replace(/\n/g,'<br>')+'</div></div>':'';
  const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mareblu Journal - '+meses[curMonth]+' '+curYear+'</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;padding:20px;color:#111;}h1{font-size:18px;margin-bottom:4px;}h2{font-size:13px;color:#555;font-weight:normal;margin-bottom:16px;}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;border-bottom:2px solid #111;padding-bottom:12px;}.stats{display:flex;gap:24px;}.stat{text-align:center;}.stat-val{font-size:16px;font-weight:700;}.stat-lbl{font-size:10px;color:#777;}.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}.cal-hdr{text-align:center;font-size:10px;font-weight:700;color:#555;padding:4px 0;border-bottom:1px solid #ccc;}.cal-cell{min-height:80px;border:1px solid #ddd;border-radius:4px;padding:6px;display:flex;flex-direction:column;}.cal-cell.empty{border:none;background:transparent;}.day-n{font-size:10px;font-weight:700;color:#333;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}.bdg{font-size:8px;padding:1px 4px;border-radius:3px;font-weight:700;}.bdg.tp{background:#c8e6c9;color:#1b5e20;}.bdg.sl{background:#ffcdd2;color:#b71c1c;}.bdg.be{background:#d6e4f0;color:#2c4f75;}.pnl{font-size:14px;font-weight:700;text-align:center;flex:1;display:flex;align-items:center;justify-content:center;}.pair{font-size:9px;font-weight:700;color:#111;text-align:center;margin-top:2px;}.footer{margin-top:16px;font-size:9px;color:#aaa;text-align:right;}.month-note{margin-top:16px;padding:12px 14px;border:1px solid #ddd;border-left:3px solid #B8962E;border-radius:4px;background:#faf9f5;}.month-note-lbl{font-size:10px;font-weight:700;color:#8E7523;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;}.month-note-txt{font-size:12px;color:#222;line-height:1.5;white-space:pre-wrap;}@media print{body{padding:10px;}}</style></head><body>';
  const winPct=stats.totalTrades?(stats.wins.length/stats.totalTrades*100).toFixed(0):0;
  const result='<div class="header"><div><h1>Mareblu Trading Journal</h1><h2>'+esc(label)+' &mdash; '+meses[curMonth]+' '+curYear+'</h2></div><div class="stats"><div class="stat"><div class="stat-val" style="color:'+(totalPnl>=0?'#1b5e20':'#b71c1c')+'">'+fmt$(totalPnl)+'</div><div class="stat-lbl">P&amp;L Mensual</div></div><div class="stat"><div class="stat-val">'+greenCount+'</div><div class="stat-lbl">Dias verdes</div></div><div class="stat"><div class="stat-val">'+redCount+'</div><div class="stat-lbl">Dias rojos</div></div><div class="stat"><div class="stat-val">'+winPct+'%</div><div class="stat-lbl">Win Rate</div></div><div class="stat"><div class="stat-val">'+stats.totalTrades+'</div><div class="stat-lbl">Trades</div></div></div></div><div class="cal">'+cells+'</div>'+noteHtml+'<div class="footer">Mareblu Journal &mdash; Exportado el '+new Date().toLocaleDateString('es-PY')+'</div>';
  const win=window.open('','_blank');
  win.document.write(html+result+'</body></html>');
  win.document.close();
  setTimeout(function(){win.print();},500);
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){closeTradeModal();closeSettings();closeIntel();closeConsolidado();closeAcctModal();closeHeatmap();}
  if(e.key==='Enter'){if(document.getElementById('settingsModal').classList.contains('open'))saveCapital();else if(document.getElementById('tradeModal').classList.contains('open')&&document.activeElement.tagName!=='TEXTAREA'&&document.activeElement.tagName!=='SELECT')saveDay();}
});
var tm=document.getElementById('tradeModal');if(tm)tm.addEventListener('click',function(e){if(e.target===e.currentTarget)closeTradeModal();});
var sm=document.getElementById('settingsModal');if(sm)sm.addEventListener('click',function(e){if(e.target===e.currentTarget)closeSettings();});
var ip=document.getElementById('intelPanel');if(ip)ip.addEventListener('click',function(e){if(e.target===e.currentTarget)closeIntel();});
var cp=document.getElementById('consolidadoPanel');if(cp)cp.addEventListener('click',function(e){if(e.target===e.currentTarget)closeConsolidado();});
var am=document.getElementById('acctModal');if(am)am.addEventListener('click',function(e){if(e.target===e.currentTarget)closeAcctModal();});
var hp=document.getElementById('heatmapPanel');if(hp)hp.addEventListener('click',function(e){if(e.target===e.currentTarget)closeHeatmap();});

loadAccounts();
migrateToMultiAccount();
data=loadAccountData(activeAccountId);
config=loadAccountConfig(activeAccountId);
var _ia=accounts.find(function(a){return a.id===activeAccountId;});
if(_ia&&!config.capital)config.capital=_ia.balanceInicial||5000;
migrateAllData();
renderAccountBar();renderCalendar();renderSideAcctInfo();renderRiskCard();
// Inject PDF button
(function(){
  var existing=document.getElementById('btnExportPDF');
  if(!existing){
    var hdrRight=document.querySelector('.header-right');
    if(hdrRight){
      var noteBtn=document.createElement('button');noteBtn.id='btnMonthNote';noteBtn.className='hdr-btn';noteBtn.textContent='Nota Mes';noteBtn.onclick=openMonthNote;noteBtn.title='Escribir un resumen del mes (se incluye en el PDF)';hdrRight.appendChild(noteBtn);
      var btn=document.createElement('button');btn.id='btnExportPDF';btn.className='hdr-btn';btn.textContent='PDF Mes';btn.onclick=exportCalendarPDF;btn.title='Descargar calendario del mes como PDF';hdrRight.appendChild(btn);
    }
  }
})();

window.addEventListener('resize',drawEquityChart);
