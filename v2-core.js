/* Elayon v2 · páginas abertas: entrada com cadastro livre. Usa os utilitários do app-core.js */
const V2={
 porta(cfg,cb){
  const st=document.createElement('style');st.textContent=CSS+'.mg{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mi{background:#1f4690;color:#fff;border:0;border-radius:18px;padding:14px;text-align:left;min-height:96px;display:flex;flex-direction:column;justify-content:space-between;font:inherit;cursor:pointer}.mi span{font-size:24px}.mi b{font-size:15px}.mi i{font-size:11px;background:#2aa851;border-radius:8px;padding:2px 6px;align-self:flex-start;font-style:normal}.mi[disabled]{opacity:.65;cursor:default}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:6px 4px;border-bottom:1px solid var(--l);text-align:left}:root{--c:'+(cfg.cor||'#0b7285')+'}';document.head.appendChild(st);
  document.title=cfg.nome;this.tipo=cfg.papel==='usuario'?'usuario':'candidato';
  document.body.innerHTML='<div class="top"><img src="/icons/logo-emblema.png" alt=""><b>'+esc(cfg.nome)+'</b><button id="xSair" hidden>Sair</button></div><div class="w" id="app"></div>';
  $('xSair').onclick=async()=>{await sb.auth.signOut();location.reload()};
  try{const q=new URLSearchParams(location.search).get('c');if(q)localStorage.setItem('v2_cod',q.trim().toUpperCase())}catch(e){}
  sb.auth.getSession().then(({data:{session}})=>session?this.entrou(session.user,cb):this.tela(cfg,cb,'entrar'));
 },
 entrou(u,cb){$('xSair').hidden=false;Promise.resolve(Elx.aceite(this.tipo,()=>cb(u))).catch(e=>{$('app').innerHTML='<div class="c"><h2>Algo falhou</h2><p>'+esc(msg(e))+'</p><button class="b" onclick="location.reload()">Tentar de novo</button></div>'})},
 tela(cfg,cb,modo){const novo=modo==='novo';$('xSair').hidden=true;
  $('app').innerHTML='<div class="c cen"><img class="logo" src="/icons/logo-emblema.png" alt=""><h1>'+esc(cfg.titulo)+'</h1><p>'+esc(cfg.frase)+'</p></div><div class="c">'
   +(novo?'<label>Seu nome</label><input id="xNome" autocomplete="name">':'')+'<label>E-mail</label><input id="xEm" type="email" autocomplete="email"><label>Senha</label><input id="xPw" type="password" autocomplete="'+(novo?'new-password':'current-password')+'">'
   +'<button class="b" id="xGo">'+(novo?'Criar minha conta':'Entrar')+'</button><div class="msg" id="xMsg"></div><button class="b g" id="xTroca">'+(novo?'Já tenho conta · Entrar':'Primeira vez · Criar conta')+'</button></div>';
  $('xTroca').onclick=()=>this.tela(cfg,cb,novo?'entrar':'novo');
  $('xGo').onclick=async()=>{const em=$('xEm').value.trim(),pw=$('xPw').value,m=$('xMsg');m.className='msg';m.textContent='';
   if(!em||pw.length<6){m.className='msg er';m.textContent='Informe e-mail e senha (mínimo 6 caracteres).';return}
   $('xGo').disabled=true;try{
    if(novo){const nm=$('xNome').value.trim();const {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{nome:nm,papel:cfg.papel}}});if(error)throw error;
     if(!data.session){m.className='msg ok';m.textContent='Confirme o e-mail que enviamos e depois toque em Entrar.';$('xGo').disabled=false;return}
     if(nm){try{await sb.from('profiles').update({nome:nm}).eq('id',data.session.user.id)}catch(e){}}
     return this.entrou(data.session.user,cb)}
    const {data,error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)throw error;this.entrou(data.user,cb)
   }catch(e){m.className='msg er';m.textContent=/Invalid login/i.test(e.message||'')?'E-mail ou senha incorretos.':msg(e);$('xGo').disabled=false}}},
 copiar(t){try{navigator.clipboard.writeText(t);return true}catch(e){return false}},
 wa(fone,txt){const f=String(fone||'').replace(/\D/g,'');return 'https://wa.me/'+(f&&f.length<=11?'55':'')+f+'?text='+encodeURIComponent(txt)}
};
Object.assign(MSG,{sem_clinica:'Cadastre a clínica primeiro.',dados_incompletos:'Preencha todos os campos.',nome_obrigatorio:'Informe o nome.',laudo_vazio:'Escreva o laudo e salve antes de validar.',assinatura_obrigatoria:'Digite a assinatura do médico.',sem_permissao:'Sem permissão.',texto_longo:'Texto longo demais.'});
MSG.resposta_vazia='Escreva a sua resposta antes de enviar.';
