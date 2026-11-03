/* health-core.js — compartilhado pelas páginas do Elayon Health (mesma origem = mesma sessão do Supabase) */
const SB_URL='https://xlktkelumtpugidnecbj.supabase.co',SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const sb=supabase.createClient(SB_URL,SB_KEY),$=id=>document.getElementById(id),Q=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function eu(){const {data:{session}}=await sb.auth.getSession();if(!session){location.href='login.html';throw new Error('sem sessão')}return session.user}
async function aiCall(ME,prompt,imgs=[]){
  const k=ME.ai_key,pv=ME.ai_provider||'gemini',sys='Você é a IA do cockpit de um médico do Elayon Health (termômetro vocal CRS). Não emita diagnóstico: descreva achados acústicos estimados (microfone de celular), compare sessões, aponte pontos de atenção para o médico avaliar e sugira parâmetros e exercícios de autoexame. Linguagem clara, em português do Brasil, objetiva.';
  if(!k)throw new Error('Configure a chave de IA no perfil do médico.');
  if(pv==='openai'){const c=[{type:'text',text:prompt},...imgs.map(u=>({type:'image_url',image_url:{url:u}}))];
    return (await (await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+k},body:JSON.stringify({model:'gpt-4o',messages:[{role:'system',content:sys},{role:'user',content:c}]})})).json()).choices[0].message.content}
  const parts=[{text:prompt},...imgs.map(u=>({inline_data:{mime_type:'image/jpeg',data:u.split(',')[1]}}))];
  return (await (await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:sys}]},contents:[{role:'user',parts}]})})).json()).candidates[0].content.parts[0].text
}
 