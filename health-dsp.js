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
  x.fillStyle='#04060b';x.fillRect(0,0,W,Hh);
  tk.forEach((k,i)=>{for(let j=0;j<64;j++){const v=k.sp[j]/255;x.fillStyle=`hsl(${280-v*260},90%,${6+v*58}%)`;x.fillRect(i/n*W,(63-j)*3.9,w,4.5)}});
  x.strokeStyle='#fde047';x.lineWidth=2;x.beginPath();let pen=false;tk.forEach((k,i)=>{if(k.voz&&k.f0){const y=250-250*Math.log(k.f0/60)/Math.log(8000/60);pen?x.lineTo(i/n*W,y):x.moveTo(i/n*W,y);pen=true}else pen=false});x.stroke();
  x.fillStyle='#020408';x.fillRect(0,256,W,140);
  for(let m=0;m<11;m++){x.strokeStyle=GR[m][2];x.lineWidth=1.3;x.beginPath();tk.forEach((k,i)=>{const y=392-k.n[m]*128;i?x.lineTo(i/n*W,y):x.moveTo(i/n*W,y)});x.stroke()}
  tk.forEach((k,i)=>{x.fillStyle=k.voz?'#0e7490':'#b91c1c';x.fillRect(i/n*W,402,w,22)});
  x.fillStyle='#020408';x.fillRect(0,430,W,100);const sw=W/Math.max(1,dur);
  sec.forEach((s,i)=>{const d=i?s.db-sec[i-1].db:0,hh=Math.max(-30,Math.min(30,d*3));x.fillStyle=d>=0?'#22c55e':'#ef4444';x.fillRect(i*sw+2,470-Math.max(hh,0),sw-4,Math.abs(hh)||1);x.fillStyle='#94a3b8';x.font='11px monospace';x.fillText(i+'s',i*sw+3,525)});
  x.setLineDash([5,4]);x.strokeStyle='#fff';x.lineWidth=1;ret.slice(1).forEach(s=>{const px=s.t/dur*W;x.beginPath();x.moveTo(px,0);x.lineTo(px,440);x.stroke();x.fillStyle='#fff';x.font='bold 11px sans-serif';x.fillText('↻∫'+s.area,px+3,12)});x.setLineDash([]);
  x.fillStyle='#e2e8f0';x.font='11px sans-serif';x.fillText('Espectrograma 60Hz–8kHz + F0 (amarelo)',6,246);x.fillText('Dimensões I–XI (normalizadas)',6,272);x.fillText('Voz (azul) / Silêncio (vermelho)',6,420);x.fillText('Δ intensidade por segundo (verde sobe, vermelho cai) · ↻ = retomada sonora, ∫ = área da fala',6,448);
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
