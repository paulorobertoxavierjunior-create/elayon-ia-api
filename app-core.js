/* Elayon · núcleo dos apps: entrada por convite, sessão, barra e utilidades */
const SBU='https://xlktkelumtpugidnecbj.supabase.co',SBK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const sb=supabase.createClient(SBU,SBK);
const $=id=>document.getElementById(id);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function rpc(fn,a){const {data,error}=await sb.rpc(fn,a||{});if(error)throw error;return data}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
const MSG={convite_invalido:'Convite inválido. Confira o código.',convite_expirado:'Convite vencido. Peça um novo.',convite_ja_usado:'Esse convite já foi usado por outra pessoa.',so_master_convida_medico:'Só o master convida médicos.',so_medico_convida_usuario:'Só o médico convida usuários.',convite_outro_email:'Este convite é para outro e-mail. Entre com o e-mail que o seu médico informou.',medico_nao_ativo:'Seu acesso de médico ainda não foi aceito pelo master.',nome_obrigatorio:'Digite o nome.',email_invalido:'E-mail inválido.',laudo_inexistente:'Laudo não encontrado.',laudo_nao_certificado:'Certifique o laudo antes de liberar ao usuário.',medico_inexistente:'Médico não encontrado.',sem_clinica:'Sua clínica ainda não foi criada.',confirmacao_invalida:'Confirmação incorreta.',conta_do_dono:'Esta é a conta do dono e não pode ser removida.',conta_inexistente:'Conta não encontrada.',dono_sem_conta:'A conta do dono não existe.',sem_permissao:'Sem permissão.',caso_inexistente:'Caso não encontrado.',medico_nao_vinculado:'Esse médico não está vinculado a este usuário.',caso_ja_decidido:'Esse caso já foi decidido.',caso_nao_encaminhado:'Esse caso ainda não foi encaminhado a você.'};
const msg=e=>MSG[(e&&e.message)||e]||((e&&e.message)||String(e));
const TIPONOME={usuario:'de usuário',medico:'de médico',candidato:'de master'};
const APPS={usuario:'app-usuario.html',medico:'app-medico.html',candidato:'app-master.html'};
const CSS=`:root{--c:#2a9d8f;--ink:#0a2a2f;--m:#4a6b70;--l:#d8e8eb;--bg:#f2f8f6}*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:linear-gradient(160deg,#f4f9f4,#e6f3f5);color:var(--ink);padding:0 0 40px}
.top{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--c);color:#fff;position:sticky;top:0;z-index:5}.top img{width:34px;height:34px;border-radius:9px;background:#fff;padding:2px}.top b{flex:1;font-size:15px}.top button{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:10px;padding:7px 12px;font-weight:700;font-size:12px}
.w{max-width:560px;margin:0 auto;padding:14px 16px;display:grid;gap:12px}
.c{background:#fff;border:1px solid var(--l);border-radius:16px;padding:14px;display:grid;gap:8px;box-shadow:0 2px 10px rgba(10,42,47,.05)}h1{font-size:20px}h2{font-size:16px}h3{font-size:14px}p,small,.hint{color:var(--m);font-size:13px;line-height:1.55}
label{font-size:12px;font-weight:700;color:var(--m)}input,select,textarea{width:100%;padding:12px;border:1px solid var(--l);border-radius:12px;font-size:15px;background:#fff;color:var(--ink);font-family:inherit}
.b{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:13px;padding:13px;font-weight:800;font-size:14px;background:var(--c);color:#fff;cursor:pointer}.b.g{background:#eef5f5;color:var(--ink);border:1px solid var(--l)}.b:disabled{opacity:.55}
.msg{font-size:13px;min-height:16px}.msg.er{color:#b91c1c}.msg.ok{color:#047857}
.kp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.kp div{background:linear-gradient(180deg,#fff,#f1fcfe);border:1px solid var(--l);border-radius:12px;padding:10px 6px;text-align:center;font-size:11px;color:var(--m)}.kp b{display:block;font-size:20px;color:var(--ink)}
.it{border:1px solid var(--l);border-radius:12px;padding:10px;display:grid;gap:4px}.it .r{display:flex;justify-content:space-between;gap:8px;align-items:center}
.pill{font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;background:#fff7e0;color:#92400e;border:1px solid #f3dca0}.pill.ok{background:#e8fbf3;color:#047857;border-color:#9fe2c4}.pill.er{background:#fff0f0;color:#b91c1c;border-color:#f3b4b4}
.tabs{display:flex;gap:4px;overflow-x:auto;background:#eef5f5;border:1px solid var(--l);border-radius:14px;padding:4px}.tab{flex:1;white-space:nowrap;border:0;background:transparent;padding:9px 12px;border-radius:11px;font-weight:700;font-size:12px;color:var(--m)}.tab.on{background:#fff;color:var(--ink);box-shadow:0 1px 6px rgba(0,0,0,.08)}
.pane{display:none;gap:12px}.pane.on{display:grid}.logo{width:84px;height:84px;margin:6px auto 0;border-radius:22px;background:#fff;padding:6px;box-shadow:0 4px 18px rgba(10,42,47,.12)}.cen{text-align:center}
.alerta{background:#fff7e0;border:1px solid #f3dca0;border-radius:12px;padding:10px;font-size:13px;color:#92400e}.cod{font-family:ui-monospace,monospace;font-weight:800;font-size:20px;letter-spacing:1px;text-align:center;padding:10px;background:#f1fcfe;border:1px dashed var(--c);border-radius:12px;user-select:all}
.step{display:flex;gap:10px;align-items:flex-start}.step .n{flex:0 0 28px;height:28px;border-radius:50%;background:#eef5f5;display:grid;place-items:center;font-weight:800;font-size:13px}.step.ok .n{background:#047857;color:#fff}.step.at .n{background:var(--c);color:#fff}`;
const Elx={cfg:null,
 inicia(cfg,cb){this.cfg=cfg;this.cb=cb;try{const q=new URLSearchParams(location.search).get('c');if(q){localStorage.setItem('elx_conv',q.trim().toUpperCase());history.replaceState(null,'',location.pathname)}}catch(e){}document.title=cfg.nome;const st=document.createElement('style');st.textContent=CSS.replace('--c:#2a9d8f','--c:'+cfg.cor);document.head.appendChild(st);
  document.body.innerHTML='<div class="top"><img src="/icons/logo-emblema.png" alt=""><b>'+esc(cfg.nome)+'</b><button id="xSair" hidden>Sair</button></div><div class="w" id="app"></div>';
  $('xSair').onclick=async()=>{await sb.auth.signOut();location.reload()};this.boot()},
 async boot(){const {data:{session}}=await sb.auth.getSession();if(!session)return this.login();this.sessao(session.user)},
 login(modo){modo=modo||'entrar';const novo=modo==='novo',cf=this.cfg;let pend='';try{pend=localStorage.getItem('elx_conv')||''}catch(e){}
  $('xSair').hidden=true;
  $('app').innerHTML='<div class="c cen"><img class="logo" src="/icons/logo-emblema.png" alt=""><h1>'+esc(cf.titulo)+'</h1><p>'+esc(cf.frase)+'</p></div><div class="c">'
   +(novo?'<label>Seu nome</label><input id="xNome" autocomplete="name">':'')+'<label>E-mail</label><input id="xEm" type="email" autocomplete="email"><label>Senha</label><input id="xPw" type="password" autocomplete="'+(novo?'new-password':'current-password')+'">'
   +(novo?'<label>Convite</label><input id="xCv" value="'+esc(pend)+'" autocapitalize="characters" autocomplete="off" placeholder="CONV-XXXX-XXXX">':'')
   +'<button class="b" id="xGo">'+(novo?'Criar meu acesso':'Entrar')+'</button><div class="msg" id="xMsg"></div>'
   +'<button class="b g" id="xTroca">'+(novo?'Já tenho acesso · Entrar':'Primeiro acesso · tenho um convite')+'</button></div>';
  $('xTroca').onclick=()=>this.login(novo?'entrar':'novo');
  $('xGo').onclick=async()=>{const em=$('xEm').value.trim(),pw=$('xPw').value,m=$('xMsg');m.className='msg';m.textContent='';if(!em||pw.length<6){m.className='msg er';m.textContent='Informe e-mail e senha (mínimo 6 caracteres).';return}
   $('xGo').disabled=true;try{
    if(novo){const cv=$('xCv').value.trim();if(!cv){throw new Error('Digite o convite que você recebeu.')}try{localStorage.setItem('elx_conv',cv)}catch(e){}
     const {data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{nome:$('xNome').value.trim()}}});if(error)throw error;
     if(!data.session){m.className='msg ok';m.textContent='Confirme o e-mail que enviamos e depois toque em Entrar. O convite fica guardado neste aparelho.';$('xGo').disabled=false;return}
     const nm=$('xNome').value.trim();if(nm){try{await sb.from('profiles').update({nome:nm}).eq('id',data.session.user.id)}catch(e){}}
     return this.sessao(data.session.user)}
    const {data,error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)throw error;this.sessao(data.user)
   }catch(e){m.className='msg er';m.textContent=/Invalid login/i.test(e.message||'')?'E-mail ou senha incorretos.':msg(e);$('xGo').disabled=false}}},
 async sessao(u){$('xSair').hidden=false;let cv='';try{cv=localStorage.getItem('elx_conv')||''}catch(e){}
  try{let r=await rpc('usar_convite',{p_codigo:cv});
   if(!r.ok){
    try{const T=await rpc('minha_trilha');if(this.cfg.tipo==='candidato'&&T.cred&&T.cred.master)r={ok:true,tipo:'candidato'}}catch(e){}}
   if(!r.ok)return this.pedeConvite(u,r.erro);
   try{localStorage.removeItem('elx_conv')}catch(e){}
   if(r.tipo!==this.cfg.tipo){const outro=APPS[r.tipo];$('app').innerHTML='<div class="c"><h2>App errado</h2><p>Seu convite é '+(TIPONOME[r.tipo]||'de outro tipo')+'. Abra o app certo.</p>'+(outro?'<a class="b" href="'+outro+'">Abrir o app certo</a>':'')+'</div>';return}
   this.cb(u,r)}catch(e){$('app').innerHTML='<div class="c"><h2>Algo falhou</h2><p>'+esc(msg(e))+'</p><button class="b" onclick="location.reload()">Tentar de novo</button></div>'}},
 pedeConvite(u,erro){$('app').innerHTML='<div class="c"><h2>Falta o convite</h2><p>Este acesso é só por convite. Digite o código que você recebeu.</p><input id="xCv2" autocapitalize="characters" autocomplete="off" placeholder="CONV-XXXX-XXXX"><button class="b" id="xOk">Validar convite</button><div class="msg '+(erro&&erro!=='convite_invalido'?'er':'')+'" id="xM2">'+esc(erro&&erro!=='convite_invalido'?(MSG[erro]||erro):'')+'</div></div>';
  $('xOk').onclick=()=>{const v=$('xCv2').value.trim();if(!v)return;try{localStorage.setItem('elx_conv',v)}catch(e){}this.sessao(u)}}
};
