/* health-dsp.js — análise vocal (F0, jitter, shimmer, HNR, CPP, GRBAS~, espectroide) — carregado só na sala */

const R={ctx:null,an:null,buf:null,fb:null,sr:48000,fl:[],P:[],A:[],vz:[],prev:.3};let D={jit:0,shim:0};
const rg=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
/* tema claro: fundo branco nos gráficos, tons escuros para contraste */
const GR=['#0369a1','#c2410c','#15803d','#a16207','#7e22ce','#0f766e','#be185d','#1d4ed8','#4d7c0f','#b91c1c','#0e7490'].map(c=>['','',c]);
const HC={bg:'#ffffff',pan:'#f8fafc',tx:'#334155',f0:'#111827',db:'#0891b2',voz:'#0e7490',sil:'#fca5a5',grade:'#cbd5e1'};
const corEsp=v=>v<.06?'#ffffff':`hsl(${235-v*235},85%,${95-v*52}%)`;   // branco = sem energia; azul > verde > vermelho = mais energia
const med=a=>a.length?a.reduce((p,q)=>p+q,0)/a.length:0;
function mk(o){
  R.vz.push(o.voz?1:0);if(R.vz.length>40)R.vz.shift();
  const pros=med(R.vz),sil=1-med(R.vz.slice(-10));
  const R_=Math.min(3,o.jit/1),B_=Math.min(3,Math.max(0,(15-o.hnr)/5)),A_=Math.min(3,Math.max(0,(-42-o.db)/6)),S_=Math.min(3,Math.max(0,(o.cent-1800)/700)),G_=Math.min(3,(R_+B_+A_+S_)/4*1.6);
  const k=Object.assign({},o,{G:G_,Rr:R_,B:B_,As:A_,S:S_,pros,sil});
  if(o.voz)R.prev=rg(o.f0,70,400);
  k.n=[R.prev,rg(o.db,-70,-10),rg(o.hnr,0,30),pros,G_/3,o.flow,o.cq,rg(o.floor,-90,-30),rg(o.cent,200,4000),sil,0];
  k.n[10]=med(k.n.slice(0,8));return k
}

function analisar(){
  const b=R.buf,sr=R.sr;R.an.getFloatTimeDomainData(b);R.an.getFloatFrequencyData(R.fb);
  let e=0;for(let i=0;i<b.length;i++)e+=b[i]*b[i];const rms=Math.sqrt(e/b.length),db=20*Math.log10(rms+1e-6);
  const d=Math.max(1,Math.round(sr/12000)),n=512,x=new Float32Array(n),off=b.length-n*d;
  for(let i=0;i<n;i++){let s=0;for(let j=0;j<d;j++)s+=b[off+i*d+j]||0;x[i]=s/d}
  const fs=sr/d,lmin=Math.floor(fs/400),lmax=Math.floor(fs/70);let r0=1e-9;for(let i=0;i<n;i++)r0+=x[i]*x[i];
  let best=0,bl=lmin;const rr=[];
  for(let l=lmin;l<=lmax;l++){let s=0;for(let i=0;i<n-l;i++)s+=x[i]*x[i+l];s/=r0;rr[l]=s;if(s>best){best=s;bl=l}}
  for(let l=lmin+1;l<bl;l++)if(rr[l]>=.9*best&&rr[l]>rr[l-1]&&rr[l]>=rr[l+1]){bl=l;best=rr[l];break}
  R.fl.push(db);if(R.fl.length>80)R.fl.shift();const floor=Math.min(...R.fl);
  const voz=db>floor+9&&best>.5;let f0=0,jit=D.jit,shim=D.shim;
  if(voz){const T=bl/fs;f0=1/T;R.P.push(T);R.A.push(rms);if(R.P.length>10){R.P.shift();R.A.shift()}
    if(R.P.length>3){let s=0,q=0;for(let i=1;i<R.P.length;i++){s+=Math.abs(R.P[i]-R.P[i-1]);q+=Math.abs(20*Math.log10(R.A[i]/R.A[i-1]))}jit=s/(R.P.length-1)/med(R.P)*100;shim=q/(R.A.length-1)}}
  else{R.P=[];R.A=[]}
  const bc=Math.min(.98,Math.max(.02,best)),hnr=10*Math.log10(bc/(1-bc)),fb=R.fb,nb=fb.length,bh=sr/2/nb,sp=new Uint8Array(64),pw=[];
  let lo=0,hi=0,cs=0,ct=0;
  for(let j=0;j<64;j++){const f1=60*Math.pow(8000/60,j/64),f2=60*Math.pow(8000/60,(j+1)/64);let m=-140;
    for(let k=Math.floor(f1/bh);k<=Math.max(Math.floor(f2/bh),Math.floor(f1/bh));k++)if(fb[k]>m)m=fb[k];
    sp[j]=Math.max(0,Math.min(255,(m+100)*3.2));const p=Math.pow(10,m/10),fc=Math.sqrt(f1*f2);cs+=fc*p;ct+=p;if(fc<1000)lo+=p;else if(fc<5000)hi+=p}
  const cent=ct?cs/ct:0,tilt=10*Math.log10((hi+1e-12)/(lo+1e-12));
  const k0=Math.ceil(60/bh),k1=Math.floor(4000/bh);let mL=0;for(let k=k0;k<k1;k++)mL+=Math.max(-140,fb[k]);mL/=(k1-k0);
  let cmax=0,csum=0,cn=0;for(let q=.001;q<.02;q+=.0004){let s=0;for(let k=k0;k<k1;k++)s+=(Math.max(-140,fb[k])-mL)*Math.cos(6.2832*k*bh*q);s=Math.abs(s)/(k1-k0);csum+=s;cn++;if(q>.0025&&q<.014&&s>cmax)cmax=s}
  const cpp=Math.max(0,cmax-csum/cn);
  let cq=.5,flow=.3;
  if(voz){const a=Math.max(...[-1,0,1].map(o=>fb[Math.round(f0/bh)+o]||-140)),c=Math.max(...[-1,0,1].map(o=>fb[Math.round(2*f0/bh)+o]||-140));cq=Math.max(.1,Math.min(.9,.6-(a-c)/40));flow=Math.min(1,.15+.5*(1-bc)+.35*rg(db,-60,-10))}
  return mk({f0,db,jit,shim,hnr,cpp,cent,tilt,voz,flow,cq,floor,sp})
}

function analisarSessao(tk){
  const dur=tk.length/20,V=tk.filter(k=>k.voz),r=(v,d=1)=>+(+v).toFixed(d);
  const est=a=>{if(!a.length)return null;const m=med(a);return{m:r(m,2),min:r(Math.min(...a),2),max:r(Math.max(...a),2),dp:r(Math.sqrt(med(a.map(q=>(q-m)**2))),2)}};
  const segs=[];let sil=0,cur=null;
  tk.forEach((k,i)=>{if(k.voz){if(!cur||sil>=6){if(cur)segs.push(cur);cur={t0:i/20,f:[],ar:0,n:0}}sil=0;cur.n++;cur.ar+=Math.pow(10,k.db/20)*.05;if(k.f0)cur.f.push(k.f0)}else sil++});
  if(cur)segs.push(cur);
  const ret=segs.map(s=>({t:r(s.t0),dur:r(s.n/20),f0:Math.round(med(s.f)),area:r(s.ar*100,2)}));
  let pk=0;tk.forEach((k,i)=>{if(k.voz&&i>3&&i<tk.length-3&&k.db>tk[i-1].db&&k.db>=tk[i+1].db&&k.db-Math.min(...tk.slice(i-3,i+4).map(q=>q.db))>4)pk++});
  const sec=[];for(let s=0;s*20<tk.length;s++){const B=tk.slice(s*20,s*20+20),Vv=B.filter(k=>k.voz);sec.push({db:med(B.map(k=>k.db)),f0:Vv.length?med(Vv.map(k=>k.f0)):0,hnr:med(Vv.map(k=>k.hnr)),jit:med(Vv.map(k=>k.jit)),shim:med(Vv.map(k=>k.shim)),cpp:med(Vv.map(k=>k.cpp))})}
  const m=a=>r(med(V.map(k=>k[a])),2);
  const res={dur:r(dur),fon:r(V.length/Math.max(1,tk.length),2),pausas:Math.max(0,segs.length-1),silabas_s:r(pk/Math.max(.5,V.length/20)),
    f0:est(V.map(k=>k.f0)),db:est(V.map(k=>k.db)),jit:est(V.map(k=>k.jit)),shim:est(V.map(k=>k.shim)),hnr:est(V.map(k=>k.hnr)),cpp:est(V.map(k=>k.cpp)),cent:est(V.map(k=>k.cent)),
    grbas_est:{G:m('G'),R:m('Rr'),B:m('B'),A:m('As'),S:m('S')},fluxo_proxy:m('flow'),contato_proxy:m('cq'),piso_ruido_dbfs:r(med(tk.map(k=>k.floor)),0),
    retomadas:ret.slice(0,12),por_s:{f0:sec.map(s=>Math.round(s.f0)),db:sec.map(s=>r(s.db)),hnr:sec.map(s=>r(s.hnr)),jit:sec.map(s=>r(s.jit,2))},d_db_por_s:sec.map((s,i)=>i?r(s.db-sec[i-1].db):0)};
  return{res,sec,ret}
}
function espectroide(tk,sec,ret,dur){
  const W=900,Hh=540,c=document.createElement('canvas');c.width=W;c.height=Hh;const x=c.getContext('2d'),n=tk.length||1,w=W/n+.8;
  x.fillStyle=HC.bg;x.fillRect(0,0,W,Hh);
  tk.forEach((k,i)=>{for(let j=0;j<64;j++){const v=k.sp[j]/255;x.fillStyle=corEsp(v);x.fillRect(i/n*W,(63-j)*3.9,w,4.5)}});
  x.strokeStyle=HC.f0;x.lineWidth=2;x.beginPath();let pen=false;tk.forEach((k,i)=>{if(k.voz&&k.f0){const y=250-250*Math.log(k.f0/60)/Math.log(8000/60);pen?x.lineTo(i/n*W,y):x.moveTo(i/n*W,y);pen=true}else pen=false});x.stroke();
  x.fillStyle=HC.pan;x.fillRect(0,256,W,140);
  for(let m=0;m<11;m++){x.strokeStyle=GR[m][2];x.lineWidth=1.3;x.beginPath();tk.forEach((k,i)=>{const y=392-k.n[m]*128;i?x.lineTo(i/n*W,y):x.moveTo(i/n*W,y)});x.stroke()}
  tk.forEach((k,i)=>{x.fillStyle=k.voz?HC.voz:HC.sil;x.fillRect(i/n*W,402,w,22)});
  x.fillStyle=HC.pan;x.fillRect(0,430,W,100);const sw=W/Math.max(1,dur);
  sec.forEach((s,i)=>{const d=i?s.db-sec[i-1].db:0,hh=Math.max(-30,Math.min(30,d*3));x.fillStyle=d>=0?'#16a34a':'#dc2626';x.fillRect(i*sw+2,470-Math.max(hh,0),sw-4,Math.abs(hh)||1);x.fillStyle=HC.tx;x.font='11px monospace';x.fillText(i+'s',i*sw+3,525)});
  x.setLineDash([5,4]);x.strokeStyle='#111827';x.lineWidth=1;ret.slice(1).forEach(s=>{const px=s.t/dur*W;x.beginPath();x.moveTo(px,0);x.lineTo(px,440);x.stroke();x.fillStyle='#111827';x.font='bold 11px sans-serif';x.fillText('↻∫'+s.area,px+3,12)});x.setLineDash([]);
  x.fillStyle=HC.tx;x.font='11px sans-serif';x.fillText('Espectrograma 60Hz–8kHz + F0 (linha preta)',6,246);x.fillText('Dimensões I–XI (normalizadas)',6,272);x.fillText('Voz (azul) / Silêncio (vermelho)',6,420);x.fillText('Δ intensidade por segundo (verde sobe, vermelho cai) · ↻ = retomada sonora, ∫ = área da fala',6,448);
  return c.toDataURL('image/jpeg',.82)
}


const b64=u=>{let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)};
async function wav(blob){
  const ab=await blob.arrayBuffer(),AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const buf=await new AC(1,1,16000).decodeAudioData(ab),oc=new AC(1,Math.ceil(buf.duration*16000),16000),s=oc.createBufferSource();s.buffer=buf;s.connect(oc.destination);s.start();
  const o=(await oc.startRendering()).getChannelData(0),v=new DataView(new ArrayBuffer(44+o.length*2)),w=(p,t)=>[...t].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
  w(0,'RIFF');v.setUint32(4,36+o.length*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,o.length*2,true);
  for(let i=0;i<o.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,o[i]))*32767,true);return new Uint8Array(v.buffer)
}
async function pcm16(blob){const ab=await blob.arrayBuffer(),AC=window.OfflineAudioContext||window.webkitOfflineAudioContext,buf=await new AC(1,1,16000).decodeAudioData(ab),oc=new AC(1,Math.ceil(buf.duration*16000),16000),s=oc.createBufferSource();s.buffer=buf;s.connect(oc.destination);s.start();return (await oc.startRendering()).getChannelData(0)}

function ligarAnalise(track){R.ctx=new (window.AudioContext||window.webkitAudioContext)();R.ctx.resume();R.an=R.ctx.createAnalyser();R.an.fftSize=2048;R.an.smoothingTimeConstant=.3;R.sr=R.ctx.sampleRate;R.ctx.createMediaStreamSource(new MediaStream([track])).connect(R.an);R.buf=new Float32Array(2048);R.fb=new Float32Array(1024)}

/* ===== CRS temporal (artigo CRS: e_i=(t_i,a_i); Δt; μ, σ, entropia, densidade, extremos) =====
   Pausa = inatividade de ENERGIA (limiar adaptativo sobre o piso de ruído), não ausência de voz sonora:
   assim consoantes surdas (s, f, t) não contam como pausa. Resolução: 50 ms. */
const CRS_CFG={dt:.05,limiar_db:9,min_pausa:.10,faixas:[['micro',.10,.20],['curta',.20,.60],['media',.60,1.20],['longa',1.20,1e9]],
  origem:'faixas alinhadas ao núcleo CRS (config.json: 2/6/12 quadros de 100 ms); micro = 100–200 ms; valores a confirmar pelo autor'};
function crsTemporal(tk){
  const C=CRS_CFG,n=tk.length;if(n<20)return null;
  const tm=i=>{const k=tk[Math.min(i,n-1)];return k.ct!=null?k.ct:i*C.dt};
  const a0=tk.map(k=>k.db>k.floor+C.limiar_db),at=a0.map((v,i)=>((a0[i-1]?1:0)+(v?1:0)+(a0[i+1]?1:0))>=2);   // suaviza oscilações de 1 quadro
  let runs=[];for(let i=0;i<n;){let j=i;while(j<n&&at[j]===at[i])j++;runs.push({a:at[i],i,j,t0:tm(i),d:(j<n?tm(j):tm(n-1)+C.dt)-tm(i)});i=j}
  while(runs.length&&!runs[0].a)runs.shift();while(runs.length&&!runs[runs.length-1].a)runs.pop();
  if(!runs.length)return null;
  const T0=runs[0].t0,total=runs.reduce((s,r)=>s+r.d,0);if(total<=0)return null;
  const fala=runs.filter(r=>r.a),pau=runs.filter(r=>!r.a&&r.d>=C.min_pausa),pd=pau.map(r=>r.d),m=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0,r2=x=>+(+x).toFixed(2);
  const mu=m(pd),sd=Math.sqrt(m(pd.map(x=>(x-mu)**2)));
  const bins=new Array(6).fill(0);pd.forEach(x=>{bins[Math.max(0,Math.min(5,Math.floor(Math.log2(x/C.min_pausa))))]++});
  const H=pd.length>=3?-bins.filter(b=>b).reduce((s,b)=>s+(b/pd.length)*Math.log2(b/pd.length),0)/Math.log2(6):null;
  const fx={};C.faixas.forEach(([nm,a,b])=>{fx[nm]=pd.filter(x=>x>=a&&x<b).length});
  const tercos=[0,1,2].map(q=>{const w0=T0+q*total/3,w1=T0+(q+1)*total/3;let ac=0;fala.forEach(r=>{ac+=Math.max(0,Math.min(r.t0+r.d,w1)-Math.max(r.t0,w0))});
    const np=pau.filter(r=>r.t0>=w0&&r.t0<w1).length;return{ptr:r2(ac/(total/3)),pm:r2(np/(total/3)*60)}});
  return{tempo:r2(total),ptr:r2(fala.reduce((s,r)=>s+r.d,0)/total),pausas:pd.length,pausas_min:r2(pd.length/total*60),mu:r2(mu),sd:r2(sd),H:H==null?null:r2(H),
    tmax:pd.length?r2(Math.max(...pd)):0,tmin:pd.length?r2(Math.min(...pd)):0,cont:r2(fala.reduce((s,x)=>s+(x.d>=1?x.d:0),0)/Math.max(1e-9,fala.reduce((s,x)=>s+x.d,0))*100),faixas:fx,tempo_pausa_pct:r2(pd.reduce((s,x)=>s+x,0)/total*100),fala_media:r2(m(fala.map(r=>r.d))),tercos,res_ms:Math.round(C.dt*1000)}
}
function qualidade(tk){
  const C=CRS_CFG,n=tk.length,dur=n*C.dt,at=tk.filter(k=>k.db>k.floor+C.limiar_db),sn=at.length?med(at.map(k=>k.db-k.floor)):0,clip=n?tk.filter(k=>k.pk>=.99).length/n:0,mot=[];let nv=0;
  const up=(l,t)=>{if(l>nv)nv=l;mot.push(t)};
  if(dur<10)up(1,'áudio curto (<10 s): medidas de tempo pouco estáveis');
  if(sn<10)up(2,`relação sinal-ruído baixa (~${sn.toFixed(0)} dB)`);else if(sn<15)up(1,`ruído moderado (SNR~ ${sn.toFixed(0)} dB)`);
  if(clip>.02)up(1,`saturação do microfone em ${(clip*100).toFixed(0)}% do tempo`);
  if(n&&at.length/n<.2)up(2,'pouca fala detectada');
  return{nivel:['boa','atenção','insuficiente'][nv],snr:+sn.toFixed(1),clip:+(clip*100).toFixed(1),motivos:mot,criterio:'critérios internos do Elayon, ainda sem validação publicada'}
}

/* Linha do tempo: janelas de w s, comparadas com o PRÓPRIO áudio (mediana e MAD). Sinalizações são hipóteses de observação, não achados. */
function crsJanelas(tk,w){
  const C=CRS_CFG;w=w||C.janela||3;const n=tk.length,per=Math.round(w/C.dt);if(n<per*4)return null;
  const a0=tk.map(k=>k.db>k.floor+C.limiar_db),at=a0.map((v,i)=>((a0[i-1]?1:0)+(v?1:0)+(a0[i+1]?1:0))>=2);
  let i0=at.indexOf(true),i1=at.lastIndexOf(true);if(i0<0)return null;const nj=Math.floor((i1-i0+1)/per);if(nj<4)return null;
  const tm=i=>{const k=tk[Math.min(i,n-1)];return k.ct!=null?k.ct:i*C.dt},mp=Math.round(C.min_pausa/C.dt),J=[];
  for(let q=0;q<nj;q++){const s=i0+q*per,e=s+per;let act=0,ons=0,run=0,mx=0,pz=0,np=0;
    const fl=()=>{if(run>=mp){pz+=run;np++;if(run>mx)mx=run}run=0};
    for(let i=s;i<e;i++){if(at[i]){act++;if(i>0&&!at[i-1])ons++;fl()}else run++}fl();
    J.push({t0:+tm(s).toFixed(1),t1:+tm(e-1).toFixed(1),ptr:+(act/per).toFixed(2),pausas:np,tmax:+(mx*C.dt).toFixed(2),pp:+(pz/per).toFixed(2),ritmo:+(ons/w).toFixed(2),flag:[]})}
  const md=a=>{const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
  const mp_=md(J.map(x=>x.pp)),mr_=md(J.map(x=>x.ritmo)),sp=1.4826*Math.max(.05,md(J.map(x=>Math.abs(x.pp-mp_)))),sr=1.4826*Math.max(.3,md(J.map(x=>Math.abs(x.ritmo-mr_))));
  J.forEach(x=>{const zp=(x.pp-mp_)/sp,zr=(x.ritmo-mr_)/sr;x.zp=+zp.toFixed(1);x.zr=+zr.toFixed(1);
    if(zp>=1.5&&x.tmax>=.6)x.flag.push('hesitação');if(zr>=1.5)x.flag.push('aceleração');if(zr<=-1.5)x.flag.push('desaceleração')});
  return{w,med:{pp:+mp_.toFixed(2),ritmo:+mr_.toFixed(2)},jan:J,nota:'z robusto (mediana/MAD) contra o próprio áudio; |z|≥1,5 sinaliza. Hipóteses de observação do método, sem validação clínica.'}
}
/* Mapeamento PROVISÓRIO das medidas para o payload do núcleo CRS (Render) */
function nucPayload(tk,c,q,ctx){
  const C=CRS_CFG,at=tk.filter(k=>k.db>k.floor+C.limiar_db),lv=at.map(k=>k.db-k.floor),m=lv.length?lv.reduce((s,x)=>s+x,0)/lv.length:0,sd=Math.sqrt(lv.length?lv.reduce((s,x)=>s+(x-m)**2,0)/lv.length:0),cl=x=>Math.max(0,Math.min(100,x));
  let sp=null;const fr=at.filter(k=>k.sp&&k.sp.length>=9);if(fr.length){const L=fr[0].sp.length,t=[0,0,0];fr.forEach(k=>{for(let i=0;i<L;i++)t[Math.min(2,Math.floor(i*3/L))]+=Math.max(0,+k.sp[i]||0)});const S=t[0]+t[1]+t[2]||1;sp={graves:t[0]/S*100,medios:t[1]/S*100,agudos:t[2]/S*100}}
  return{duration_sec:c.tempo,silence_pct:100-c.ptr*100,pause_count:c.pausas,mean_pause_ms:c.mu*1000,continuity_pct:c.cont,oscillation_pct:cl(m?sd/m*100:0),energy_pct:cl(m/40*100),noise_pct:cl(100-q.snr*5),spectrum_snapshot:sp||{},context:ctx||''}
}
