/* Botão voltar: volta para a tela anterior (app ou navegador). Sem histórico do site, usa o destino do próprio link. */
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;var t=(a.textContent||'').trim();
 if(!/^(⬅|←)/.test(t)&&!a.hasAttribute('data-home')&&!a.classList.contains('back'))return;
 var ok=false;try{ok=history.length>1&&!!document.referrer&&new URL(document.referrer).origin===location.origin}catch(_){}
 if(ok){e.preventDefault();history.back()}},true);
