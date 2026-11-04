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
const SYS_MEDICO='Você é a IA do cockpit de um médico do Elayon Health (termômetro vocal CRS). Não emita diagnóstico: descreva achados acústicos estimados (microfone de celular), compare sessões, aponte pontos de atenção para o médico avaliar e sugira parâmetros e exercícios de autoexame. Como ler as imagens: fundo branco; espectrograma com cor de azul (pouca energia) a vermelho (muita energia); linha preta = F0; painéis XI e XII = dimensões CRS normalizadas (I–XI); faixa azul-petróleo = voz, rosa = silêncio. Linguagem clara, em português do Brasil, objetiva.';
async function aiCall(ME,prompt,imgs=[]){
  const k=ME&&ME.ai_key,pv=(ME&&ME.ai_provider)||'gemini';
  if(!k)throw new Error('Configure a chave de IA no seu perfil (a mesma do cockpit).');
  if(pv==='openai'){const c=[{type:'text',text:prompt},...imgs.map(u=>({type:'image_url',image_url:{url:u}}))];
    const j=await jfetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+k},body:JSON.stringify({model:'gpt-4o',messages:[{role:'system',content:SYS_MEDICO},{role:'user',content:c}]})});
    const t=j.choices&&j.choices[0]&&j.choices[0].message.content;if(!t)throw new Error('A IA não devolveu texto.');return t}
  const parts=[{text:prompt},...imgs.map(u=>({inline_data:{mime_type:'image/jpeg',data:u.split(',')[1]}}))];
  const j=await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYS_MEDICO}]},contents:[{role:'user',parts}]})});
  const t=j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts&&j.candidates[0].content.parts[0].text;if(!t)throw new Error('A IA não devolveu texto (conteúdo bloqueado ou vazio).');return t}
