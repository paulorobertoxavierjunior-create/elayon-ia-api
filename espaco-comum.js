/* espaco-comum.js — catálogo de exercícios, laudos (IndexedDB, até 10), arquivo .elayon, check-up, PDF e texto de apoio da IA.
   Compartilhado por meu-espaco.html (usuário) e espaco-piloto.html (médico). Carregar depois de health-core.js e health-dsp.js. */
const ESP_VER='2026-11-07';
const EX=[
 {id:'livre',nome:'Falar livremente',bloco:'Livre',min:0,instr:'Fale sobre o que quiser, com a voz do dia a dia. Pode comentar os gráficos ou não.'},
 {id:'vogal',nome:'Vogal sustentada "aaa"',bloco:'Pulmão e pregas vocais',min:5,voz:true,instr:'Respire fundo e sustente "aaa" em volume confortável pelo maior tempo que conseguir, sem forçar. Responda só a isso.'},
 {id:'deslize',nome:'Deslize grave-agudo',bloco:'Pregas vocais (extensão)',min:4,voz:true,instr:'Diga "uuu" começando no som mais grave confortável, suba devagar até o mais agudo e volte, sem forçar.'},
 {id:'vogais',nome:'Vogais a, e, i, o, u',bloco:'Boca, língua e abertura',min:5,voz:true,instr:'Diga as vogais a, e, i, o, u, devagar, sustentando cada uma por cerca de 1 segundo.'},
 {id:'pataka',nome:'Pa-ta-ka',bloco:'Lábios, língua e dentes',min:5,rit:true,instr:'Repita "pa-ta-ka" o mais rápido e claro que conseguir, por 10 segundos.'},
 {id:'leitura',nome:'Leitura em voz alta',bloco:'Ritmo e fluxo',min:12,instr:'Leia em voz natural: "A manhã começou calma. O vento trazia o cheiro de café, e as crianças corriam pela calçada, rindo alto. Ao longe, o barco apitou duas vezes."'},
 {id:'contagem',nome:'Contagem, dias e meses',bloco:'Ritmo e fluxo',min:8,instr:'Conte de 1 a 20, depois diga os dias da semana e os meses do ano, no seu ritmo.'},
 {id:'espontanea',nome:'Fala espontânea (30 s)',bloco:'Ritmo e fluxo',min:20,instr:'Conte como foi o seu dia de ontem, por cerca de 30 segundos.'}
];
const exResolve=(it,i)=>{const b=EX.find(e=>e.id===it.id);return b?Object.assign({},b,it.instr?{instr:it.instr}:{}):{id:'c'+i,nome:it.nome||'Exercício '+(i+1),bloco:'Personalizado',min:+it.min||0,instr:it.instr||''}};
const codigoNovo=()=>{const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let c='';const r=crypto.getRandomValues(new Uint8Array(8));for(let i=0;i<8;i++)c+=A[r[i]%A.length];return 'ESH-'+c};

/* ===== laudos no aparelho: até 10 por usuário; só o laudo e o áudio ===== */
const LAUDO_MAX=10;
const EDB=new Promise((ok,no)=>{const r=indexedDB.open('espaco_db',1);r.onupgradeneeded=()=>r.result.createObjectStore('laudos',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const etx=async(m,f)=>{const d=await EDB;return new Promise((ok,no)=>{const t=d.transaction('laudos',m),q=f(t.objectStore('laudos'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error)})};
async function laudosLista(uid){const a=(await etx('readonly',s=>s.getAll()))||[];return a.filter(l=>l.uid===uid).sort((x,y)=>y.ts-x.ts)}
async function laudoSalva(l){await etx('readwrite',s=>s.put(l));const todos=await laudosLista(l.uid);let rem=0;
  for(const o of todos.slice(LAUDO_MAX)){await etx('readwrite',s=>s.delete(o.id));rem++}return rem}
const laudoApaga=id=>etx('readwrite',s=>s.delete(id));

/* ===== arquivo .elayon (laudo + áudio + série completa, com todos os metadados) ===== */
const r3=v=>Math.round(v*1000)/1000;
function tkPack(tk){return tk.map(k=>({ct:r3(k.ct||0),f0:r3(k.f0),db:r3(k.db),jit:r3(k.jit),shim:r3(k.shim),hnr:r3(k.hnr),cpp:r3(k.cpp),cent:Math.round(k.cent),tilt:r3(k.tilt||0),voz:k.voz?1:0,flow:r3(k.flow),cq:r3(k.cq),floor:r3(k.floor),pk:r3(k.pk||0),G:r3(k.G),Rr:r3(k.Rr),B:r3(k.B),As:r3(k.As),S:r3(k.S),pros:r3(k.pros),sil:r3(k.sil),n:k.n.map(r3),sp:Array.from(k.sp)}))}
function tkUnpack(a){return a.map(k=>Object.assign({},k,{voz:!!k.voz,sp:Uint8Array.from(k.sp)}))}
const blobDataUrl=b=>new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(b)});
async function laudoExporta(l){
  const audio=l.ab?await blobDataUrl(new Blob([l.ab],{type:l.tipo||'audio/webm'})):null;
  const {tk,ab,...resto}=l;
  return new Blob([JSON.stringify({formato:'ELAYON-ESPACO-LAUDO',versao:1,laudo:resto,tk:tkPack(tk),audio})],{type:'application/json'})}
async function laudoImporta(file){
  const j=JSON.parse(await file.text());if(j.formato!=='ELAYON-ESPACO-LAUDO')throw new Error('Arquivo não é um laudo do Elayon Space.');
  const l=Object.assign({},j.laudo,{tk:tkUnpack(j.tk)});
  if(j.audio){const b=await (await fetch(j.audio)).blob();l.ab=await b.arrayBuffer();l.tipo=b.type||l.tipo}
  return l}

/* ===== metadados completos da captação (nada é cortado do laudo) ===== */
function metaCaptacao(extra){
  let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}
  return Object.assign({app:'Elayon Space • Meu Espaço',versao_app:ESP_VER,termos:(typeof LEGAL!=='undefined'&&LEGAL.versao)||'',
    metodo:{quadro_s:.05,limiar_pausa_db:CRS_CFG.limiar_db,pausa_min_s:CRS_CFG.min_pausa,faixas_pausa:CRS_CFG.faixas,origem:CRS_CFG.origem},
    captacao:{sample_rate:R.sr,eco:false,ruido:false,ganho_auto:false},
    aparelho:{ua:navigator.userAgent,idioma:navigator.language,fuso:tz},gerado_em:new Date().toISOString()},extra||{})}

/* ===== check-up de conformidade (regras do método, sem juízo clínico) ===== */
function checkup(ex,res,crs,q,prev){
  const o=[],add=(t,x)=>o.push({t,x});
  add(q.nivel==='boa'?'ok':'at','Qualidade da gravação: '+q.nivel+(q.motivos.length?' ('+q.motivos.join('; ')+')':'')+'.');
  const fala=res.dur*res.fon;
  if(ex&&ex.min){fala<ex.min?add('ex',`Foram medidos ${fala.toFixed(0)} s de voz e o exercício pede ${ex.min} s. Repita "${ex.nome}".`):add('ok',`Tempo de voz suficiente para o exercício (${fala.toFixed(0)} s).`)}
  if(ex&&ex.voz&&res.jit&&res.shim){
    res.jit.m>1.04?add('ex',`Jitter médio de ${res.jit.m}% está acima do limiar usual de literatura (cerca de 1,04%). Pode ser da gravação: repita a vogal sustentada 3 vezes, em volume confortável, antes de qualquer conclusão.`):add('ok',`Jitter médio de ${res.jit.m}%, dentro do limiar usual de literatura (cerca de 1,04%).`);
    res.shim.m>.35?add('ex',`Shimmer médio de ${res.shim.m} dB está acima do limiar usual de literatura (cerca de 0,35 dB). Repita a vogal sustentada para confirmar.`):add('ok',`Shimmer médio de ${res.shim.m} dB, dentro do limiar usual de literatura (cerca de 0,35 dB).`)}
  if(ex&&ex.rit)add('ok',`Velocidade estimada: ${res.silabas_s} sílabas por segundo. Compare com os seus próximos laudos.`);
  if(crs){add(crs.tmax>=2?'at':'ok',`Pausa mais longa: ${crs.tmax} s; ${crs.pausas} pausas (${crs.pausas_min} por minuto); fala ocupa ${Math.round(crs.ptr*100)}% do tempo.`)}
  if(prev&&prev.res&&prev.res.f0&&res.f0){const d=(res.f0.m-prev.res.f0.m)/prev.res.f0.m*100;
    Math.abs(d)>=10?add('at',`A altura média (F0) mudou ${d>0?'+':''}${d.toFixed(0)}% em relação ao seu último laudo do mesmo exercício. É uma diferença de medida, não um julgamento.`):add('ok','A altura média (F0) ficou dentro de 10% do seu último laudo do mesmo exercício.')}
  return o}

/* ===== IA do Espaço ===== */
const SYS_ESPACO='Você é a IA do Elayon Space, companhia de auto escuta simbólica. Fale em português do Brasil, em tom calmo e caloroso, em texto corrido, sem listas, sem emojis e sem markdown, no máximo 4 frases curtas. Converse livremente: sobre os gráficos ou sobre qualquer assunto que a pessoa trouxer. Só comente números se ela perguntar ou se uma sessão acabou de terminar, e então em linguagem simples. Faça no máximo uma pergunta por mensagem. NUNCA dê diagnóstico, não prometa tratamento nem resultado e não diga que a pessoa "melhorou" ou "piorou": diga que a medida "mudou em relação à referência". Os valores são estimativas de microfone de celular; quem interpreta é o profissional. Para afirmar algo da literatura, use SOMENTE as fontes e orientações do médico fornecidas abaixo e cite o nome da fonte; sem isso, diga que não tem base carregada. Se a pessoa relatar fala que piorou de repente, fraqueza num lado do corpo, boca torta, confusão, dor de cabeça forte e súbita, ou pensamentos de se machucar, a PRIMEIRA coisa a dizer é ligar para o SAMU (192) ou procurar emergência agora (em sofrimento emocional, CVV 188). Quando a sessão terminar, agradeça de verdade e despeça-se com uma frase curta.';
const limpaTxt=t=>String(t||'').replace(/```[\s\S]*?```/g,'').replace(/^\s{0,3}#{1,6}\s*/gm,'').replace(/\*\*|__|\*|`/g,'').replace(/^\s*[-•]\s+/gm,'').replace(/\n{3,}/g,'\n\n').trim();
function resumoIA(l){const r=l.res,c=l.crs,e=a=>a?a.m:null;return JSON.stringify({exercicio:l.ex&&l.ex.nome,duracao_s:r.dur,fonacao:r.fon,f0_hz:e(r.f0),db:e(r.db),jitter_pct:e(r.jit),shimmer_db:e(r.shim),hnr_db:e(r.hnr),pausas:r.pausas,silabas_s:r.silabas_s,crs:c?{ptr:c.ptr,pausas_min:c.pausas_min,pausa_media_s:c.mu,pausa_max_s:c.tmax,entropia:c.H}:null,qualidade:l.q&&l.q.nivel})}

/* ===== voz masculina e suave (quando o aparelho tiver) ===== */
function escolheVoz(){const V=speechSynthesis.getVoices().filter(v=>/^pt[-_]BR/i.test(v.lang));if(!V.length)return null;
  const m=/felipe|ant[oô]nio|daniel|ricardo|thiago|rafael|male|masc/i,n=/natural|neural|online|enhanced|premium/i,f=/luciana|francisca|maria|helena|female|fem/i;
  const pts=v=>(m.test(v.name)?4:0)+(n.test(v.name)?2:0)-(f.test(v.name)?5:0)+(v.localService?0:1);
  return V.sort((a,b)=>pts(b)-pts(a))[0]}
try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>{}}catch(e){}
function falar(t){return new Promise(res=>{try{speechSynthesis.cancel();
  const partes=String(t).replace(/\s+/g,' ').match(/[^.!?;:]+[.!?;:]?/g)||[String(t)],vz=escolheVoz();let i=0,f=0;
  const fim=()=>{if(f)return;f=1;res()};
  const prox=()=>{if(f)return;if(i>=partes.length)return fim();const s=partes[i++].trim();if(!s)return prox();
    const u=new SpeechSynthesisUtterance(s);u.lang='pt-BR';if(vz)u.voice=vz;u.rate=.92;u.pitch=.85;u.volume=.95;
    u.onend=()=>setTimeout(prox,/[.!?]$/.test(s)?260:120);u.onerror=fim;speechSynthesis.speak(u)};
  setTimeout(fim,90000);prox()}catch(e){res()}})}

/* ===== PDF do laudo (guardado no aparelho do usuário; metadados completos) ===== */
function laudoPdf(l,quem){
  const {jsPDF}=window.jspdf,d=new jsPDF({unit:'pt',format:'a4'}),L=40,Wd=515;let y=0;
  const pg=()=>{if(y>790){d.addPage();y=50}};
  const tx=(t,sz=10,b=false,cor=[10,42,47])=>{d.setFont('helvetica',b?'bold':'normal');d.setFontSize(sz);d.setTextColor(...cor);
    for(const ln of d.splitTextToSize(String(t),Wd)){pg();d.text(ln,L,y);y+=sz*1.35}};
  const h=t=>{y+=8;pg();tx(t,12,true,[42,157,143])};
  d.setFillColor(10,42,47);d.rect(0,0,595,62,'F');d.setTextColor(255,255,255);d.setFont('helvetica','bold');d.setFontSize(15);d.text('Laudo de Auto Escuta Simbólica',L,28);
  d.setFont('helvetica','normal');d.setFontSize(9);d.text('Elayon Space • Meu Espaço • termômetro vocal, não diagnóstico',L,46);y=84;
  const r=l.res,c=l.crs,q=l.q,f=(a,u='')=>a?`${a.m}${u} (min ${a.min}, máx ${a.max}, dp ${a.dp})`:'sem voz detectada';
  tx(`Usuário: ${quem.nome||'—'}   E-mail: ${quem.email||'—'}`);tx(`Data: ${new Date(l.ts).toLocaleString('pt-BR')}   Duração: ${r.dur} s   Laudo: ${l.id}`);
  tx(`Exercício: ${l.ex?l.ex.nome:'—'}${l.cod?`   Treino do médico: ${l.titulo||''} (${l.cod})`:''}`);
  try{const img=espectroide(l.tk,l.sec,l.ret,Math.max(1,r.dur));pg();if(y>520){d.addPage();y=50}d.addImage(img,'JPEG',L,y+4,Wd,Wd*.6);y+=Wd*.6+14}catch(e){}
  h('Medidas (estimativas de microfone de celular)');
  [['F0 (altura)',f(r.f0,' Hz')],['Intensidade',f(r.db,' dBFS')],['Jitter',f(r.jit,' %')],['Shimmer',f(r.shim,' dB')],['HNR (estimativa)',f(r.hnr,' dB')],['CPP (estimativa interna)',f(r.cpp)],['Fonação',Math.round(r.fon*100)+'% do tempo'],['Pausas',String(r.pausas)],['Sílabas por segundo (est.)',String(r.silabas_s)],['GRBAS aproximado (G R B A S)',['G','R','B','A','S'].map(k=>r.grbas_est[k]).join(' / ')+'  (não substitui a escala perceptiva)']].forEach(([a,b])=>tx(`${a}: ${b}`));
  if(c){h('Ritmo e pausas (CRS temporal)');tx(`Fala ocupa ${Math.round(c.ptr*100)}% do tempo; ${c.pausas} pausas (${c.pausas_min}/min); pausa média ${c.mu} s (desvio ${c.sd}); mais longa ${c.tmax} s; entropia de pausas ${c.H==null?'—':c.H}; continuidade ${c.cont}%.`)}
  h('Qualidade da captação');tx(`${q.nivel} • relação sinal-ruído ~${q.snr} dB • saturação ${q.clip}%${q.motivos.length?' • '+q.motivos.join('; '):''}`);
  if(l.check&&l.check.length){h('Check-up de conformidade');l.check.forEach(k=>tx('- '+k.x))}
  if(l.txt){h('O que foi dito (transcrição do navegador)');tx(l.txt)}
  if(l.ia){h('Retorno da IA (apoio, sem diagnóstico)');tx(l.ia)}
  h('Metadados completos da captação');tx(JSON.stringify(l.meta,null,1).replace(/[{}"]/g,'').replace(/,$/gm,''),7.5,false,[74,107,112]);
  h('Aviso');tx('Este laudo é um termômetro de método: estima sinais da fala com microfone de celular, sem normas populacionais. Não faz diagnóstico nem substitui avaliação profissional. Se a fala piorar de repente ou surgir fraqueza em um lado do corpo, boca torta, confusão ou dor de cabeça forte e súbita, ligue 192 (SAMU). Em sofrimento emocional, ligue 188 (CVV).',9);
  return d}
