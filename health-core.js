/* health-core.js — compartilhado pelas páginas do Elayon Health (mesma origem = mesma sessão do Supabase) */
const SB_URL='https://xlktkelumtpugidnecbj.supabase.co',SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const sb=supabase.createClient(SB_URL,SB_KEY),$=id=>document.getElementById(id),Q=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mm=t=>{t=Math.round(t);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
function dl(blob,nome){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;a.click()}
async function eu(){const {data:{session}}=await sb.auth.getSession();if(!session){location.href='login.html';throw new Error('sem sessão')}return session.user}
/* fetch JSON com tempo limite e mensagem de erro legível */
async function jfetch(url,opt,ms=90000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{...opt,signal:c.signal}),j=await r.json().catch(()=>({}));
    if(!r.ok||j.error)throw new Error((j.error&&(j.error.message||j.error))||('Erro '+r.status));return j}
  catch(e){throw new Error(e.name==='AbortError'?'A IA demorou demais. Tente de novo.':e.message)}finally{clearTimeout(t)}}
const SYS_MEDICO='Você é a IA do cockpit de um médico do Elayon Health (termômetro vocal CRS). Não emita diagnóstico: descreva achados acústicos estimados (microfone de celular), compare sessões, aponte pontos de atenção para o médico avaliar e sugira parâmetros e exercícios de autoexame. Como ler as imagens: fundo branco; espectrograma com cor de azul (pouca energia) a vermelho (muita energia); linha preta = F0; painéis XI e XII = dimensões CRS normalizadas (I–XI); faixa azul-petróleo = voz, rosa = silêncio. Use SOMENTE a base de conhecimento fornecida no pedido para afirmar algo da literatura, citando o [ID]; o que não estiver nela deve ser marcado como "sem base na literatura carregada". Separe medida, interpretação e limitação. Linguagem clara, em português do Brasil, objetiva.';
/* ---- provedores de IA (mesma tabela do perfil.html). Modelos e limites gratuitos mudam: o campo modelo é editável no perfil. ---- */
const PROV={gemini:{nome:'Google Gemini',modelo:'gemini-2.5-flash',vis:true},
 groq:{nome:'Groq',url:'https://api.groq.com/openai/v1/chat/completions',modelo:'meta-llama/llama-4-scout-17b-16e-instruct',vis:true},
 mistral:{nome:'Mistral',url:'https://api.mistral.ai/v1/chat/completions',modelo:'mistral-small-latest',vis:true},
 openrouter:{nome:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',modelo:'meta-llama/llama-3.3-70b-instruct:free',vis:false},
 openai:{nome:'OpenAI',url:'https://api.openai.com/v1/chat/completions',modelo:'gpt-4o',vis:true},
 custom:{nome:'Personalizado (compatível OpenAI)',modelo:'',vis:false}};
function provLista(p){const cfg=(p&&p.ai_cfg)||{},act=(p&&p.ai_provider)||'gemini',L=[];
  const add=id=>{const c=cfg[id]||{},key=id===act?(p.ai_key||c.key):c.key;if(key)L.push({p:id,key,model:c.model||'',url:c.url||'',vis:!!c.vis})};
  add(act);if(cfg._fb!==false)Object.keys(PROV).filter(k=>k!==act).forEach(add);return L}
const RUIM=/quota|429|exhausted|rate|limit|overload|503|capacity|unavailable/i;
async function aiCall(ME,prompt,imgs=[],sys=SYS_MEDICO){
  const L=provLista(ME);if(!L.length)throw new Error('Configure a chave de IA no seu perfil (a mesma do cockpit).');let ult=null;
  for(const c of L){try{const t=await aiUm(c,prompt,imgs,sys);aiCall.ultimo=c.p;return t}catch(e){ult=e;if(!RUIM.test(e.message))throw e}}
  throw new Error('Cota ou limite da IA esgotado em todos os provedores configurados ('+L.map(c=>PROV[c.p].nome).join(', ')+'). Tente mais tarde ou adicione outro provedor gratuito no perfil.')}
async function aiUm(c,prompt,imgs,sys){
  const P=PROV[c.p]||PROV.custom,model=c.model||P.modelo,vis=P.vis||c.vis,im=vis?imgs:[];
  if(c.p==='gemini'){
    const parts=[{text:prompt},...im.map(u=>({inline_data:{mime_type:'image/jpeg',data:u.split(',')[1]}}))];
    const j=await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${c.key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({generationConfig:{temperature:.2},systemInstruction:{parts:[{text:sys}]},contents:[{role:'user',parts}]})});
    const t=j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts[0].text;if(!t)throw new Error('A IA não devolveu texto (conteúdo bloqueado ou vazio).');return t}
  const url=c.url||P.url;if(!url)throw new Error('Informe o endereço (URL) do provedor personalizado no perfil.');if(!model)throw new Error('Informe o modelo no perfil.');
  const txt=(imgs.length&&!im.length?'[As imagens não foram enviadas: o modelo escolhido não lê imagens.]\n':'')+prompt,cont=im.length?[{type:'text',text:txt},...im.map(u=>({type:'image_url',image_url:{url:u}}))]:txt;
  const j=await jfetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:JSON.stringify({model,temperature:.2,messages:[{role:'system',content:sys},{role:'user',content:cont}]})});
  const t=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;if(!t)throw new Error('A IA não devolveu texto.');return t}

/* Base de conhecimento do piloto: só entra o que foi conferido na fonte. Acrescentar item novo = abrir a fonte antes. */
const KB=[
 {id:'CRS-ART',ref:'Xavier Júnior, P.R. (2026). Modelagem e Integração de Sinais Temporais Cognitivos em Sistemas Multimodais.',txt:'O CRS formaliza eventos temporais e_i=(t_i,a_i) e intervalos Δt como séries estocásticas vetorizáveis (média, desvio, entropia temporal, densidade de eventos, extremos). Não realiza diagnóstico autônomo: fornece indicadores complementares para avaliação profissional. A extensão a ambientes clínicos exige aprovação em Comitê de Ética em Pesquisa e TCLE.'},
 {id:'CRS-HIP',ref:'Relatório descritivo de patente (INPI), item [007].',txt:'Hipóteses de trabalho do método, de observação empírica do autor e SEM validação clínica: pausas curtas ~ continuidade; médias ~ organização ou verificação; longas ~ hesitação ou espera; ritmo acelerado ~ urgência; desacelerado ~ busca de precisão. Usar só como hipótese descritiva.'},
 {id:'BOWDEN-2023',ref:'Bowden et al. (2023), npj Digital Medicine, revisão sistemática de 40 estudos em doença do neurônio motor.',txt:'Medidas de fala digitais (acústicas e temporais) distinguiram grupos em alguns estudos, mas nenhum biomarcador isolado diagnostica ou dá prognóstico de forma consistente; os estudos variam em aparelho, tarefa e distância do microfone e poucos acompanham pacientes ao longo do tempo.'},
 {id:'JVOICE-2017',ref:'Estudo de J Voice (2017) com smartphones e vozes sintéticas.',txt:'Em dois smartphones Android, com vogais sintéticas em cabine silenciosa, jitter, shimmer e razão ruído-harmônicos tiveram boa concordância com a referência. HNR, F0 e CPP não foram testados. O ambiente precisa ser controlado e o resultado não se generaliza a fala real em ambiente comum.'},
 {id:'CAPEV-BR',ref:'Borges et al. (2022), Distúrbios da Comunicação, que cita Behlau et al. (2020) e Nemr et al. (2012).',txt:'O CAPE-V tem adaptação brasileira e o GRBASI é usado no Brasil; são escalas perceptivo-auditivas aplicadas pelo profissional. As estimativas GRBAS~ do Elayon NÃO substituem a avaliação perceptiva.'},
 {id:'WAB-BR',ref:'Adaptação do WAB-R (rastreio) ao português do Brasil, CoDAS.',txt:'Houve tradução e adaptação transcultural do rastreio do WAB-R; o trabalho não traz dados de validade nem confiabilidade.'},
 {id:'LAST-BR',ref:'Adaptação e validação do Language Screening Test (LAST) para o português do Brasil, JSLHR (2023).',txt:'O LAST, rastreio de linguagem em pacientes pós-AVC, foi adaptado e validado para o português do Brasil.'},
 {id:'LIM-ELAYON',ref:'Limites do método (interno).',txt:'Medidas vêm de microfone de celular. A voz sonora é detectada por periodicidade (consoantes surdas não contam); as pausas usam energia com resolução de 50 ms, então pausas abaixo de 100 ms não são confiáveis. Não há normas populacionais: interpretar sempre contra a linha de base do próprio paciente.'}
];
const kbTxt=()=>KB.map(k=>`[${k.id}] ${k.txt}`).join('\n');
