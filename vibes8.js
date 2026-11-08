/* vibes8.js — os 8 gráficos do Elayon Vibes 8 (modelos I–VIII do cockpit) como módulo reutilizável.
   Uso: const V=Vibes8.mount(elemento); V.push(quadro) ao vivo, ou V.replay(tk,()=>segundosDoAudio) para rever uma sessão; V.pause(true) congela a imagem.
   Depende de health-dsp.js (rg, mk). Os desenhos são portados do cockpit.html sem alterar a aparência. */
const V8N=[['I. Frequência / Tom','F0 & Jitter','#0891b2'],['II. Intensidade','Rosca & Shimmer','#0284c7'],['III. Timbre','HNR & espectro','#059669'],['IV. Prosódia / Pausas','CRS ritmo e silêncio','#0e7490'],['V. Perceptivo-Auditivo','GRBAS acústico','#1d4ed8'],['VI. Aerodinâmica','fluxo (proxy)','#0d9488'],['VII. Contato Glótico','EGG (proxy)','#2563eb'],['VIII. Ambiente / Ruído','piso & SNR','#10b981']];
const Vibes8=(()=>{
  const CSS=`.v8g{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:480px){.v8g{grid-template-columns:1fr}}
  .v8c{border:1px solid color-mix(in srgb,var(--c) 45%,#fff);border-radius:14px;padding:9px;background:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--c) 14%,transparent)}.v8c.dest{box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 40%,transparent),0 10px 26px color-mix(in srgb,var(--c) 30%,transparent)}.v8c.oculto{display:none}.v8c.foco{grid-column:1/-1}
  .v8h{display:flex;gap:5px;align-items:baseline;font-size:11px;font-weight:800;text-transform:uppercase;color:color-mix(in srgb,var(--c) 68%,#0a2a2f)}
  .v8h small{font-weight:500;color:#4a6b70;font-size:9px;text-transform:none}.v8h i{margin-left:auto;font:10px monospace;font-style:normal;background:#ecfeff;border:1px solid #cdeaf0;padding:2px 6px;border-radius:6px;white-space:nowrap;color:#0a2a2f}
  .v8c canvas{width:100%;height:96px;display:block;margin-top:5px;background:linear-gradient(180deg,#fff,#f3fcfd);border:1px solid #dff1f5;border-radius:10px}.v8c.foco canvas{height:190px}.v8c.fecha canvas{display:none}
  .v8tg{cursor:pointer;margin-left:6px;padding:2px 5px;color:#4a6b70;font-size:13px;user-select:none}`;
  const rgf=(v,a,b)=>Math.max(0,Math.min(1,(v-a)/(b-a)));
  const fade=(x,W,h,a)=>{x.globalCompositeOperation='source-over';x.fillStyle=`rgba(255,255,255,${a})`;x.fillRect(0,0,W,h)};
  const dot=(x,px,py,r,c)=>{x.fillStyle=c;x.beginPath();x.arc(px,py,r,0,6.2832);x.fill()};
  const lv=(db,fl)=>rgf(db-fl,4,32);
  function mount(grid){
    if(!document.getElementById('v8css')){const s=document.createElement('style');s.id='v8css';s.textContent=CSS;document.head.appendChild(s)}
    grid.classList.add('v8g');
    grid.innerHTML=V8N.map((g,i)=>`<div class="v8c" id="v8c${i}" style="--c:${g[2]}"><div class="v8h">${g[0]}<small>${g[1]}</small><i id="v8t${i}">--</i><span class="v8tg" data-k="${i}" title="recolher">▾</span><span class="v8tg" data-f="${i}" title="ampliar">⛶</span></div><canvas id="v8g${i}"></canvas></div>`).join('');
    let H=[],mode='live',rep=null,paused=false,tt=0,last=0,fr=0,run=true;
    const D={n:new Array(11).fill(0),sp:new Float32Array(64),f0:150,db:-60,jit:0,shim:0,hnr:10,cpp:5,cent:1000,G:0,Rr:0,B:0,As:0,S:0,flow:.2,cq:.5,floor:-70,pk:new Float32Array(64)};
    const cv=V8N.map((_,i)=>{const c=document.getElementById('v8g'+i);return{c,x:c.getContext('2d'),W:0,h:0}});
    function fit(){const r=Math.min(devicePixelRatio||1,1.5);cv.forEach(o=>{if(!o.c.clientWidth)return;o.W=o.c.clientWidth;o.h=o.c.clientHeight;o.c.width=o.W*r;o.c.height=o.h*r;o.x.setTransform(r,0,0,r,0,0)})}
    grid.addEventListener('click',e=>{const k=e.target.dataset&&e.target.dataset.k,f=e.target.dataset&&e.target.dataset.f;
      if(k!=null&&k!==''){document.getElementById('v8c'+k).classList.toggle('fecha');setTimeout(fit,30)}
      if(f!=null&&f!==''){document.getElementById('v8c'+f).classList.toggle('foco');setTimeout(fit,30)}});
    addEventListener('resize',fit);
    const G=[];
    const lgr=(x,x0,y0,x1,y1,c0,c1)=>{const g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,c0);g.addColorStop(1,c1);return g};
    G[0]=(x,W,h,t)=>{fade(x,W,h,.26);const L=H.slice(-160),Y=k=>h-8-rgf(k.f0,70,400)*(h-16),g=lgr(x,0,0,W,0,'rgba(34,211,238,.3)','#1d4ed8');
      x.strokeStyle='rgba(6,182,212,.25)';x.lineWidth=1;x.beginPath();for(let px=0;px<=W;px+=6){const y=h/2+Math.sin(px*.03+t*1.5)*(3+lv(D.db,D.floor)*8);px?x.lineTo(px,y):x.moveTo(px,y)}x.stroke();
      for(const [lw,al] of [[8,.13],[2.4,1]]){x.globalAlpha=al;x.lineWidth=lw;x.strokeStyle=g;x.beginPath();let pen=false;L.forEach((k,i)=>{const px=i/159*W;if(k.voz){pen?x.lineTo(px,Y(k)):x.moveTo(px,Y(k));pen=true}else pen=false});x.stroke()}x.globalAlpha=1;
      L.forEach((k,i)=>{if(k.voz)for(let q=0;q<3;q++)dot(x,i/159*W+Math.sin(i*7+q*2+t*9)*k.jit*3,Y(k)+Math.cos(i*5+q+t*8)*(2+k.jit*6),1.1,'rgba(14,116,144,.5)')});
      const py=h-8-rgf(D.f0,70,400)*(h-16);for(let r=0;r<3;r++){x.strokeStyle=`rgba(29,78,216,${.6-r*.18})`;x.lineWidth=1;x.beginPath();x.arc(W-4,py,4+((t*30+r*8)%24),0,6.28);x.stroke()}};
    G[1]=(x,W,h,t)=>{fade(x,W,h,.3);const cx=W/2,cy=h/2,q=lv(D.db,D.floor),R0=h*.2+q*h*.2+Math.sin(t*1.3)*2,th=3+q*10,sh=D.shim*5+q*2,g=x.createRadialGradient(cx,cy,R0*.4,cx,cy,R0*1.7);g.addColorStop(0,'rgba(6,182,212,.95)');g.addColorStop(.55,'rgba(29,78,216,.85)');g.addColorStop(1,'rgba(5,150,105,.45)');
      for(let p=0;p<3;p++){x.strokeStyle=g;x.globalAlpha=.95-p*.28;x.lineWidth=Math.max(1,th-p*2.8);x.beginPath();for(let i=0;i<=120;i++){const a=i/120*6.2832,r=R0+Math.sin(a*6+t*3+p)*(1+sh)*(1+p*.4)+Math.sin(a*11-t*4)*sh,px=cx+Math.cos(a)*r*1.5,py=cy+Math.sin(a)*r;i?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.stroke()}x.globalAlpha=1;
      const rr=12+q*18,gg=x.createRadialGradient(cx,cy,1,cx,cy,rr);gg.addColorStop(0,'rgba(34,211,238,.9)');gg.addColorStop(1,'rgba(34,211,238,0)');x.fillStyle=gg;x.beginPath();x.arc(cx,cy,rr,0,6.28);x.fill()};
    G[2]=(x,W,h,t)=>{fade(x,W,h,.35);const n=48,bw=W/n,q=rgf(D.hnr,0,25),g=x.createLinearGradient(0,h,0,0);g.addColorStop(0,'#22d3ee');g.addColorStop(.6,q>.5?'#10b981':'#0284c7');g.addColorStop(1,q>.5?'#047857':'#1d4ed8');
      const V=i=>Math.pow(D.sp[Math.floor(i*64/n)]/255,.7);x.fillStyle=g;for(let i=0;i<n;i++){const b=Math.max(2,V(i)*(h-8)*(.9+.1*Math.sin(t*5+i)));x.fillRect(i*bw+1,h-b,bw-2,b)}
      x.fillStyle='rgba(10,42,47,.5)';for(let i=0;i<n;i++)x.fillRect(i*bw+1,h-Math.max(2,V(i)*(h-8))-2,bw-2,2)};
    G[3]=(x,W,h,t)=>{fade(x,W,h,.4);const L=H.slice(-200),g=lgr(x,0,0,0,h,'rgba(6,182,212,.75)','rgba(5,150,105,.04)');
      L.forEach((k,i)=>{if(!k.voz){x.fillStyle='rgba(100,116,139,.14)';x.fillRect(i/199*W,0,W/199+1,h)}});
      x.beginPath();L.forEach((k,i)=>{const px=i/199*W,py=h-6-lv(k.db,k.floor)*(h-16)*(.97+.03*Math.sin(t*6+i))-(Math.sin(t*1.4+i*.05)+1)*1.5;i?x.lineTo(px,py):x.moveTo(px,py)});
      x.strokeStyle='#0e7490';x.lineWidth=1.8;x.stroke();x.lineTo(W,h);x.lineTo(0,h);x.fillStyle=g;x.fill()};
    G[4]=(x,W,h,t)=>{fade(x,W,h,.3);const cx=W/2,cy=h/2,L=['G','R','B','A','S'],v=[D.G,D.Rr,D.B,D.As,D.S],cl=['#06b6d4','#0284c7','#1d4ed8','#059669','#10b981'];
      v.forEach((s,i)=>{const a=i/5*6.2832-1.57+Math.sin(t*.5+i)*.08,rad=h*.1+Math.min(s,3)/3*h*.32,px=cx+Math.cos(a)*rad*1.5,py=cy+Math.sin(a)*rad;
        x.strokeStyle=cl[i]+'66';x.lineWidth=1;x.beginPath();x.moveTo(cx,cy);x.lineTo(px,py);x.stroke();
        for(let q=0;q<16;q++){const aa=q*1.7+t*(1+i*.2),rr=4+s*8+q;dot(x,px+Math.cos(aa)*rr,py+Math.sin(aa)*rr,1,cl[i]+'aa')}
        dot(x,px,py,4+s*2,cl[i]);x.fillStyle='#0a2a2f';x.font='10px system-ui';x.fillText(L[i]+s.toFixed(1),px+7,py-6)});dot(x,cx,cy,3,'#0e7490')};
    G[5]=(x,W,h,t)=>{fade(x,W,h,.3);const A1=h*.12+D.flow*h*.28,A2=h*.1+D.cq*h*.25;
      for(let px=0;px<W;px+=3){const u=px/W,y1=h/2+Math.sin(px*.045+t*3)*A1*(.5+.5*Math.sin(u*3+t)),y2=h/2+Math.sin(px*.045+t*3+2.2)*A2;
        x.fillStyle='rgba(6,182,212,.14)';x.fillRect(px,Math.min(y1,y2),2,Math.abs(y1-y2));dot(x,px,y1,1.6,'#0891b2');dot(x,px,y2,1.6,'#059669')}};
    G[6]=(x,W,h,t)=>{fade(x,W,h,.35);const L=H.slice(-120);let p0=h;x.beginPath();x.moveTo(0,h);
      L.forEach((k,i)=>{const px=i/119*W,py=h-6-(k.voz?k.cq:.05)*(h-14);x.lineTo(px,p0);x.lineTo(px,py);p0=py});
      x.lineTo(W,p0);x.strokeStyle='#1d4ed8';x.lineWidth=2;x.stroke();x.lineTo(W,h);x.fillStyle='rgba(6,182,212,.16)';x.fill();x.fillStyle='rgba(6,182,212,.12)';x.fillRect((t*80)%W,0,3,h)};
    G[7]=(x,W,h,t)=>{fade(x,W,h,.4);const cx=W/2,cy=h*.8,r=h*.62,v=[rgf(D.floor,-90,-30),rgf(D.db-D.floor,0,50),D.n[3]],cl=['#06b6d4','#1d4ed8','#10b981'];
      v.forEach((q,i)=>{const rr=r-i*12;x.lineWidth=7;x.strokeStyle='#e1f3f7';x.beginPath();x.arc(cx,cy,rr,Math.PI,6.2832);x.stroke();x.strokeStyle=cl[i];x.beginPath();x.arc(cx,cy,rr,Math.PI,Math.PI+q*Math.PI);x.stroke()});
      const a=Math.PI+((t*.8)%1)*Math.PI;dot(x,cx+Math.cos(a)*r,cy+Math.sin(a)*r,3,'#0a2a2f')};
    function idx(tk,seg){let a=0,b=tk.length-1;if(b<0)return 0;const ct=i=>tk[i].ct!=null?tk[i].ct:i*.05;while(a<b){const m=(a+b+1)>>1;ct(m)<=seg?a=m:b=m-1}return a}
    function loop(ms){if(!run)return;requestAnimationFrame(loop);if(ms-last<33)return;last=ms;
      if(paused)return;tt+=.033;
      if(mode==='replay'&&rep){const i=idx(rep.tk,Math.max(0,rep.t()));H=rep.tk.slice(Math.max(0,i-199),i+1)}
      const c=H[H.length-1];if(!c)return;
      for(const k of ['f0','db','jit','shim','hnr','cpp','cent','G','Rr','B','As','S','flow','cq','floor'])D[k]+=((c[k]||0)-D[k])*.35;
      for(let i=0;i<11;i++)D.n[i]+=(((c.n&&c.n[i])||0)-D.n[i])*.35;
      for(let i=0;i<64;i++)D.sp[i]+=(((c.sp&&c.sp[i])||0)-D.sp[i])*.5;
      cv.forEach((o,i)=>{if(o.W&&!document.getElementById('v8c'+i).classList.contains('fecha'))G[i](o.x,o.W,o.h,tt)});
      if(++fr%6==0){const L=H.slice(-200),pa=L.filter((k,i)=>i&&k.voz&&!L[i-1].voz).length;
        const T=[`${c.voz?Math.round(D.f0):'--'} Hz | jit ${D.jit.toFixed(2)}%`,`${D.db.toFixed(1)} dBFS | shim ${D.shim.toFixed(2)}`,`HNR ${D.hnr.toFixed(1)} | CPP ${D.cpp.toFixed(1)}`,`${pa} retomadas | fon ${Math.round((c.pros||0)*100)}%`,`G${D.G.toFixed(1)} R${D.Rr.toFixed(1)} B${D.B.toFixed(1)} A${D.As.toFixed(1)} S${D.S.toFixed(1)}`,`fluxo ~${D.flow.toFixed(2)}`,`CQ ~${D.cq.toFixed(2)}`,`${D.floor.toFixed(0)} dBFS | SNR ${(D.db-D.floor).toFixed(0)}`];
        T.forEach((s,i)=>{const e=document.getElementById('v8t'+i);if(e)e.textContent=s})}}
    setTimeout(fit,0);requestAnimationFrame(loop);
    return{
      push(k){H.push(k);if(H.length>600)H.shift()},
      idle(){const t=Date.now()/1000,sp=new Uint8Array(64);for(let j=0;j<64;j++)sp[j]=Math.max(0,(.12+.05*Math.sin(j*.3+t*.8))*(1-j/80)*90);
        return mk({f0:0,db:-66+1.2*Math.sin(t*.7),jit:0,shim:0,hnr:6,cpp:2,cent:900+60*Math.sin(t*.5),tilt:-10,voz:false,flow:.2,cq:.5,floor:-70,sp})},
      replay(tk,timeFn){mode='replay';rep={tk,t:timeFn};H=[]},
      live(){mode='live';rep=null;H=[]},
      pause(b){paused=!!b},isPaused:()=>paused,
      solo(i){cv.forEach((_,k)=>{const e=document.getElementById('v8c'+k);e.classList.toggle('oculto',i>=0&&k!==i);e.classList.toggle('foco',i>=0&&k===i);e.classList.toggle('dest',i>=0&&k===i);if(i>=0&&k===i)e.classList.remove('fecha')});setTimeout(fit,30)},
      collapseAll(b){cv.forEach((_,i)=>document.getElementById('v8c'+i).classList.toggle('fecha',!!b));setTimeout(fit,30)},
      fit,stop(){run=false}
    }
  }
  return{mount}
})();
