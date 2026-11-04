/* Elayon • aceite de termos com registro, avisos de segurança e detecção de sinais de alerta.
   Os textos legais completos (termos.html e privacidade.html) são MINUTAS para revisão do escritório jurídico. */
const LEGAL={versao:'2026-11-04'};
function emergencia(t){
  const x=String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(/(boca (ficou |esta |ta |fica )?torta|rosto (ficou |esta |ta )?(torto|caido)|fraqueza (num|em um|no) lado|perdi a fala|nao consigo (falar|mexer)|fala (piorou|ficou (enrolada|estranha)) (de repente|do nada)|de repente (nao|parei)|dor de cabeca (muito )?forte|desmai|convuls|confusao mental)/.test(x))return'saude';
  if(/(me matar|suicid|quero morrer|nao quero mais viver|me machucar|tirar minha vida)/.test(x))return'emocional';
  return null}
function avisoEmergencia(t){const k=emergencia(t);if(!k)return null;
  return k==='saude'?'⚠️ O que você descreveu pode ser um sinal de alerta. Não espere pelo app: ligue <b>192 (SAMU)</b> ou vá a um pronto-atendimento agora.':'💛 Você não está sozinho(a). Fale agora com o <b>CVV, telefone 188</b> (24 horas, gratuito), ou com alguém de confiança. Se houver risco imediato, ligue <b>192</b>.'}
function legalGate(sb,user,tipo){
  return new Promise(async ok=>{
    const key=`elayon_aceite_${tipo}_${user.id}`;
    try{if(localStorage.getItem(key)===LEGAL.versao)return ok({})}catch(e){}
    try{const r=await Promise.race([sb.from('aceites').select('id').eq('user_id',user.id).eq('tipo',tipo).eq('versao',LEGAL.versao).limit(1),new Promise(r=>setTimeout(()=>r(null),4000))]);
      if(r&&r.data&&r.data.length){try{localStorage.setItem(key,LEGAL.versao)}catch(e){}return ok({})}}catch(e){}
    const P=tipo==='piloto';
    const corpo=P?`<p>O piloto é uma ferramenta de <b>apoio</b>. As medidas são estimativas acústicas feitas com microfone de celular, sem normas populacionais. O CRS temporal e a linha do tempo são <b>hipóteses de observação</b>, sem validação clínica.</p>
<p>Você assina o laudo e responde clinicamente por ele. O Elayon não emite diagnóstico nem conduta, e as faixas são definidas por você.</p>
<p>O nome do paciente não é enviado à IA, mas métricas e imagens dos gráficos são, ao provedor de IA que você configurou. Informe o paciente sobre o uso dos áudios e dos dados no laudo.</p>`
    :`<p>O Elayon Space capta a sua voz pelo microfone do celular e mostra gráficos de sinais da fala (ritmo, pausas, altura, intensidade). São <b>estimativas</b>: não é diagnóstico, exame nem tratamento.</p>
<p>Uma IA conversa com você sobre os gráficos. Ela é do provedor que <b>você</b> configurou, com a sua chave. Texto, medidas e, para transcrição, o áudio podem ser enviados a esse provedor e seguem as regras dele. <b>A IA pode errar: não a use como orientação de saúde.</b></p>
<p>Seus áudios e gráficos ficam neste aparelho. Conta, perfil e chave de IA ficam no nosso banco de dados.</p>
<p>Quem interpreta os resultados é o seu médico. <b>Se a fala piorar de repente, ou surgir fraqueza num lado do corpo, boca torta, confusão ou dor de cabeça forte e súbita, ligue 192 (SAMU) agora.</b> Em sofrimento emocional intenso, ligue 188 (CVV).</p>`;
    const d=document.createElement('div');d.id='elg';
    d.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(5,15,18,.86);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif';
    d.innerHTML=`<div style="background:#fff;color:#0a2a2f;max-width:480px;width:100%;max-height:92vh;overflow:auto;border-radius:18px;padding:20px 20px 16px;font-size:13px;line-height:1.5">
<h2 style="font-size:17px;margin:0 0 8px">${P?'Termo de uso profissional':'Antes de começar'}</h2>${corpo}
${P?'':`<p style="margin:8px 0 4px"><label style="display:flex;gap:6px"><input type="radio" name="elg-i" id="elg-a" value="a"> Tenho 18 anos ou mais</label><label style="display:flex;gap:6px;margin-top:4px"><input type="radio" name="elg-i" id="elg-m" value="m"> Sou menor de 18 anos e meu responsável legal está ciente e concorda</label></p>`}
<p style="margin:10px 0"><label style="display:flex;gap:8px;align-items:flex-start;font-weight:600"><input type="checkbox" id="elg-ok" style="margin-top:3px"> <span>Li e aceito os <a href="termos.html" target="_blank">Termos de Uso</a> e a <a href="privacidade.html" target="_blank">Política de Privacidade</a>${P?'':' e consinto com o tratamento dos meus dados de saúde nas condições descritas'}.</span></label></p>
<button id="elg-b" disabled style="width:100%;padding:12px;border:0;border-radius:12px;background:#2a9d8f;color:#fff;font-weight:800;opacity:.5">Continuar</button>
<p style="font-size:11px;color:#4a6b70;margin:8px 0 0">Versão ${LEGAL.versao}. Seu aceite fica registrado com data e hora.</p></div>`;
    document.body.appendChild(d);
    const chk=d.querySelector('#elg-ok'),b=d.querySelector('#elg-b'),up=()=>{const idade=P||d.querySelector('input[name=elg-i]:checked');const v=chk.checked&&!!idade;b.disabled=!v;b.style.opacity=v?1:.5};
    d.addEventListener('change',up);
    b.onclick=async()=>{b.disabled=true;const menor=!P&&d.querySelector('input[name=elg-i]:checked').value==='m';
      try{await sb.from('aceites').insert({user_id:user.id,tipo,versao:LEGAL.versao,menor,ua:navigator.userAgent.slice(0,200)})}catch(e){}
      try{localStorage.setItem(key,LEGAL.versao)}catch(e){}d.remove();ok({menor})}})}
