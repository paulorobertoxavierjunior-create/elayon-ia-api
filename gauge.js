/* gauge.js — medidor "faixa individual": o valor do usuário é sempre comparado com a faixa DELE (calibração), nunca com a média da população.
   Usado por clinica.html, supervisao.html e master.html. Carregar depois de health-core.js (usa esc). */
(function(){const st=document.createElement('style');st.textContent=`
.gg{margin:8px 0}.gg .r{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px}.gg small{color:var(--m);font-size:10px}
.gt{position:relative;height:18px;background:#eef7fa;border-radius:9px;margin-top:4px}.bd{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,#a5f3fc,#6ee7b7);border-radius:9px;opacity:.85}
.mk{position:absolute;top:2px;width:14px;height:14px;margin-left:-7px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px #0006}.mk.in{background:#059669}.mk.out{background:#1d4ed8}.mk.cal{background:#06b6d4;border-radius:3px}
.lgd{display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--m);margin:4px 0}.lgd i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}`;document.head.appendChild(st)})();
const GMET=[['f0','F0 (tom)','Hz',0],['hnr','HNR (timbre)','dB',0],['jit','Jitter','%',1],['shim','Shimmer','dB',1]];
/* faixa com folga mínima quando a calibração tem um ponto só */
function gAmpl(lo,hi){lo=+lo;hi=+hi;if(!isFinite(lo)||!isFinite(hi))return null;if(hi<=lo){const m=lo||1;return[m*.9,m*1.1]}return[lo,hi]}
/* sup=true: só passar do limite superior conta como fora (jitter e shimmer: menor é melhor) */
function gDentro(v,lo,hi,sup){return sup?v<=hi:(v>=lo&&v<=hi)}
function gauge(nome,un,lo,hi,pts,sup){const f=gAmpl(lo,hi);if(!f)return'';lo=f[0];hi=f[1];
  const w=hi-lo,a=lo-w*.5,b=hi+w*.5,pos=v=>Math.max(1,Math.min(99,(v-a)/(b-a)*100));
  const mk=pts.filter(p=>p.v!=null&&isFinite(p.v)).map(p=>{const dentro=p.k==='cal'||gDentro(p.v,lo,hi,sup);return `<i class="mk ${p.k==='cal'?'cal':dentro?'in':'out'}" style="left:${pos(p.v)}%" title="${esc(p.l)}: ${p.v} ${un}"></i>`}).join('');
  return `<div class="gg"><div class="r"><b>${nome}</b><small>faixa individual ${+lo.toFixed(1)}–${+hi.toFixed(1)} ${un}</small></div><div class="gt"><span class="bd" style="left:${pos(lo)}%;width:${pos(hi)-pos(lo)}%"></span>${mk}</div></div>`}
/* separa um envio do usuário em calibração e exercícios, e acha a faixa individual de cada medida */
function gEnvio(e){const it=(e.resumo&&e.resumo.itens)||[],cal=it.filter(x=>x.tipo==='calibracao'&&x.res),ex=it.filter(x=>x.tipo!=='calibracao'&&x.res);
  const faixa={};GMET.forEach(([k])=>{const v=cal.map(x=>+x.res[k]).filter(isFinite);if(v.length)faixa[k]=gAmpl(Math.min(...v),Math.max(...v))});return{cal,ex,faixa}}
function gaugesEnvio(e){const g=gEnvio(e);if(!g.cal.length)return'<p>Sem calibração neste envio: sem faixa individual para comparar.</p>';
  return GMET.map(([k,n,u,sup])=>{const f=g.faixa[k];return f?gauge(n,u,f[0],f[1],[...g.cal.map(x=>({v:+x.res[k],l:x.exercicio,k:'cal'})),...g.ex.map(x=>({v:+x.res[k],l:x.exercicio}))],sup):''}).join('')}
/* quantas medidas dos exercícios ficaram dentro da faixa individual: {k:{t,d}} */
function dentroEnvio(e){const g=gEnvio(e),o={};GMET.forEach(([k,,,sup])=>{o[k]={t:0,d:0};const f=g.faixa[k];if(!f)return;g.ex.forEach(x=>{const v=+x.res[k];if(!isFinite(v))return;o[k].t++;if(gDentro(v,f[0],f[1],sup))o[k].d++})});return o}
