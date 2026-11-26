/* Elayon · Demonstração independente. Tudo fictício, guardado só neste aparelho. Não usa Supabase. */
(function(){
var K='elx_demo_v1',PRECO=0.01,TK={calibrar:3,consulta:5,laudo:2,uso:1};
var ETAPA={cadastrado:'Cadastrado',calibrado:'Calibrado',consultado:'Consultado',laudo_pendente:'Laudo aguardando o master',em_tarefas:'Com tarefas',liberado:'Ferramenta liberada'};
function vazio(){return{clinica:null,medicos:[],usuarios:[],consumo:[],faturas:[],seq:0}}
function get(){try{return JSON.parse(localStorage.getItem(K))||vazio()}catch(e){return vazio()}}
function put(s){try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}}
function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rnd(a,b){return a+Math.random()*(b-a)}function ri(a,b){return Math.round(rnd(a,b))}
function pick(l){return l[Math.floor(Math.random()*l.length)]}
function id(s,p){s.seq++;return p+s.seq}
function medida(){return{f0:ri(95,220),jitter:+rnd(.4,2.2).toFixed(2),shimmer:+rnd(1.2,4.5).toFixed(2),hnr:+rnd(4,18).toFixed(1),pausas:ri(1,9)}}
var TAREFAS=['Leitura em voz alta por 3 minutos','Respiração lenta: 5 ciclos, 2 vezes ao dia','Descrever a rotina da manhã em um áudio curto','Pausa consciente entre frases'];
function log(s,u,acao,tok){s.consumo.push({t:Date.now(),uid:u.id,mid:u.mid,etapa:u.etapa,acao:acao,tokens:tok})}
var D={K:K,PRECO:PRECO,ETAPA:ETAPA,get:get,put:put,esc:esc,
 zerar:function(){try{localStorage.removeItem(K)}catch(e){}},
 criarClinica:function(nome){var s=get();s.clinica={nome:nome,codigo:'ECL-DEMO'+ri(1000,9999)};put(s);return s},
 addMedico:function(nome,crm){var s=get();if(!s.clinica)return s;s.medicos.push({id:id(s,'m'),nome:nome,crm:crm||'CRM fictício '+ri(100000,999999)});put(s);return s},
 addUsuario:function(nome,mid){var s=get();if(!s.clinica)return s;s.usuarios.push({id:id(s,'u'),nome:nome,mid:mid||(s.medicos[0]&&s.medicos[0].id)||null,etapa:'cadastrado',idade:ri(22,78),queixa:pick(['fadiga vocal','pausas longas ao falar','voz tensa no fim do dia','dificuldade para manter o ritmo']),medidas:null,laudo:null,tarefas:[],feitas:0,usos:0,criado:Date.now()});put(s);return s},
 act:function(uid,acao){var s=get(),u=s.usuarios.filter(function(x){return x.id===uid})[0];if(!u)return s;
  if(acao==='calibrar'&&u.etapa==='cadastrado'){u.medidas=medida();u.etapa='calibrado';log(s,u,'calibração',TK.calibrar)}
  else if(acao==='consulta'&&u.etapa==='calibrado'){u.etapa='consultado';log(s,u,'consulta',TK.consulta)}
  else if(acao==='laudo'&&u.etapa==='consultado'){var m=u.medidas;u.laudo='As medidas de voz descrevem F0 médio de '+m.f0+' Hz, jitter de '+m.jitter+'% e shimmer de '+m.shimmer+'%, com '+m.pausas+' pausas longas. Este texto descreve medidas e não é diagnóstico.';u.tarefas=[pick(TAREFAS),pick(TAREFAS)].filter(function(v,i,a){return a.indexOf(v)===i});u.feitas=0;u.etapa='laudo_pendente';log(s,u,'laudo',TK.laudo)}
  else if(acao==='validar'&&u.etapa==='laudo_pendente'){u.etapa='em_tarefas'}
  else if(acao==='cumprir'&&u.etapa==='em_tarefas'){u.feitas=Math.min(u.tarefas.length,u.feitas+1);if(u.feitas>=u.tarefas.length)u.etapa='liberado'}
  else if(acao==='uso'&&u.etapa==='liberado'){u.usos++;log(s,u,'uso da ferramenta',TK.uso)}
  put(s);return s},
 seed:function(){var s=vazio();put(s);D.criarClinica('Clínica Demonstração (fictícia)');D.addMedico('Médico Demo A');D.addMedico('Médico Demo B');
  for(var i=1;i<=6;i++){var s2=get();D.addUsuario('Usuário Demo '+('00'+i).slice(-3),s2.medicos[i%2].id)}
  var s3=get();s3.usuarios.forEach(function(u,i){var passos=['calibrar','consulta','laudo','validar','cumprir','cumprir','uso','uso','uso'];var n=[0,1,2,3,6,9][i];for(var k=0;k<n;k++){D.act(u.id,passos[k]);if(passos[k]==='cumprir'&&k===5){}}});
  return get()},
 total:function(s){return s.consumo.reduce(function(a,c){return a+c.tokens},0)},
 reais:function(t){return 'R$ '+(t*PRECO).toFixed(2).replace('.',',')},
 faturar:function(){var s=get(),t=D.total(s),ja=s.faturas.reduce(function(a,f){return a+f.tokens},0);if(t-ja<=0)return null;var f={n:s.faturas.length+1,t:Date.now(),tokens:t-ja,valor:+((t-ja)*PRECO).toFixed(2)};s.faturas.push(f);put(s);return f},
 shell:function(titulo,sub,explica,ativo){
  var nav=[['master.html','Master'],['medico.html','Médico'],['usuario.html','Usuário'],['advanced.html','Advanced']].map(function(a){return'<a href="'+a[0]+'"'+(a[0]===ativo?' class="on"':'')+'>'+a[1]+'</a>'}).join('');
  document.body.innerHTML='<div class="w"><div class="ban">DEMONSTRAÇÃO · dados fictícios, gerados aleatoriamente. Nenhuma pessoa real. Nada sai deste aparelho.</div><div class="hero"><h1>'+esc(titulo)+'</h1><p>'+esc(sub)+'</p></div><div class="nav">'+nav+'</div><div class="ex"><b>O que acontece aqui:</b> '+esc(explica)+'</div><div id="app"></div><div class="rod"><button class="b g" id="dSeed">Gerar dados aleatórios</button><button class="b g" id="dZero">Zerar a demonstração</button></div></div>';
  document.getElementById('dSeed').onclick=function(){D.seed();location.reload()};
  document.getElementById('dZero').onclick=function(){if(confirm('Apagar toda a demonstração deste aparelho?')){D.zerar();location.reload()}}},
 css:'<style>:root{--t:#0e7490;--bg:#eef6f8;--tx:#10303a;--ln:#d5e6ea}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.w{max-width:560px;margin:0 auto;padding:10px 14px 50px}.ban{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:8px 12px;font-size:12px;margin-bottom:10px}.hero{background:linear-gradient(135deg,#0b3a52,#0e7490);color:#fff;border-radius:18px;padding:16px;margin-bottom:10px}h1{margin:0 0 3px;font-size:19px}.hero p{margin:0;font-size:13px;opacity:.92}.nav{display:flex;gap:6px;margin-bottom:10px}.nav a{flex:1;text-align:center;padding:9px 4px;border-radius:12px;background:#fff;border:1px solid var(--ln);color:var(--t);font-weight:700;font-size:13px;text-decoration:none}.nav a.on{background:var(--t);color:#fff}.ex{font-size:12.5px;color:#456;background:#fff;border-left:4px solid var(--t);border-radius:8px;padding:8px 12px;margin-bottom:10px}.c{background:#fff;border:1px solid var(--ln);border-radius:16px;padding:14px;margin-bottom:10px}h3{margin:0 0 6px;font-size:15px}p{margin:4px 0 8px;font-size:13.5px}small{display:block;color:#5b7a85;font-size:12.5px}input,select{width:100%;padding:11px;border:1px solid var(--ln);border-radius:10px;font:inherit;margin:4px 0}.b{border:0;background:var(--t);color:#fff;border-radius:10px;padding:10px 14px;font:700 13px system-ui;margin:4px 4px 4px 0;cursor:pointer}.b.g{background:#e3f0f3;color:var(--t)}.it{border-top:1px solid var(--ln);padding:9px 0}.r{display:flex;justify-content:space-between;gap:8px}.pill{font-size:11px;font-weight:700;background:#e3f0f3;color:var(--t);border-radius:99px;padding:2px 9px;white-space:nowrap}.kp{display:flex;gap:8px}.kp div{flex:1;background:#f3f9fa;border-radius:12px;padding:10px;text-align:center;font-size:12px}.kp b{display:block;font-size:20px;color:#0b3a52}.rod{margin-top:14px}</style>',
 ini:function(){document.head.insertAdjacentHTML('beforeend',D.css);document.title='Elayon · Demonstração'}
};
window.D=D;D.ini();
})();
