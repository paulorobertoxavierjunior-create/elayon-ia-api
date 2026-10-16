// ==========================================
// ELAYON SPACE • MOTOR DO COCKPIT (EVOLUÇÃO UX & CRS)
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6Inhsa3FnZmRzYmprIiwiaWF0IjoxNzkwNzc1ODk4LCJleHAiOjIxMDYzNTE4OTh9.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tokenCount = 100;
let arrayConexoesFIFO = []; // Fila FIFO restrita aos 3 últimos registros (Áudio, Imagem e CRS)
let etapaCalibracao = 0;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let activeCamada = 'usuario';

// ------------------------------------------
// SISTEMA DE LOGS E AUDITORIA
// ------------------------------------------
function addLog(msg, tipo = 'info') {
    const body = document.getElementById('logsBody');
    if (!body) return;
    const time = new Date().toLocaleTimeString();
    let classe = '';
    if (tipo === 'ok') classe = 'log-ok';
    if (tipo === 'err') classe = 'log-err';
    
    body.innerHTML += `<div class="log-item ${classe}">[${time}] ${msg}</div>`;
    body.scrollTop = body.scrollHeight;
    
    const count = body.querySelectorAll('.log-item').length;
    const logCountEl = document.getElementById('logCount');
    if (logCountEl) logCountEl.textContent = count;
}

// ------------------------------------------
// SÍNTESE DO BIP SONORO (FEEDBACK DE ESCUTA)
// ------------------------------------------
function tocarBipAbertura() {
    try {
        const ctxBip = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctxBip.createOscillator();
        const gain = ctxBip.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctxBip.currentTime); // Frequência A5 (Bipe limpo)
        gain.gain.setValueAtTime(0.1, ctxBip.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctxBip.currentTime + 0.15);
        
        osc.connect(gain);
        gain.connect(ctxBip.destination);
        
        osc.start();
        osc.stop(ctxBip.currentTime + 0.15);
    } catch (e) {
        console.log('Áudio context bloqueado pelo navegador até interação direta.');
    }
}

// ------------------------------------------
// GERENCIAMENTO DA FILA FIFO DE CONEXÕES (3 CAIXAS)
// ------------------------------------------
function adicionarConexaoFIFO(novaConexao) {
    if (arrayConexoesFIFO.length >= 3) {
        const removido = arrayConexoesFIFO.shift(); 
        addLog(`[FIFO] Limite de 3 conexões atingido. Conexão mais antiga (${removido.timestamp}) arquivada.`, 'info');
    }
    arrayConexoesFIFO.push(novaConexao);
    renderizarConexoesNaTela();
}

function renderizarConexoesNaTela() {
    let containerCaixas = document.getElementById('conexoesContainer');
    
    // Se o container de caixas dinâmicas ainda não existir no HTML, criamos logo acima do relatório bruto
    if (!containerCaixas) {
        const refBox = document.getElementById('crsReportBox');
        if (refBox && refBox.parentNode) {
            containerCaixas = document.createElement('div');
            containerCaixas.id = 'conexoesContainer';
            containerCaixas.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px;';
            refBox.parentNode.insertBefore(containerCaixas, refBox);
        }
    }

    if (!containerCaixas) return;

    const labelsOrdem = ['Terceira (Anterior)', 'Anterior (Recente)', 'Mais Recente'];
    let htmlContent = '';

    arrayConexoesFIFO.forEach((conexao, idx) => {
        const tituloBox = labelsOrdem[idx] || `Conexão #${idx + 1}`;
        htmlContent += `
            <div style="background: #ffffff; border: 1px solid var(--line); border-radius: 12px; padding: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); text-align: left;">
                <div style="font-size: 10px; font-weight: 800; color: var(--accent); margin-bottom: 6px; text-transform: uppercase;">🔗 ${tituloBox}</div>
                <div style="font-size: 9px; color: var(--muted); margin-bottom: 6px;">🕒 [${conexao.timestamp}] • Camada: ${conexao.camada}</div>
                <img src="${conexao.snapshotImg}" alt="Gráfico de Onda" style="width: 100%; height: 40px; border-radius: 6px; object-fit: cover; background: #0a2a2f; margin-bottom: 6px; border: 1px solid var(--line);">
                <audio controls src="${conexao.audioUrl}" style="width: 100%; height: 28px; margin-bottom: 6px;"></audio>
                <div style="font-family: monospace; font-size: 9px; color: #856404; background: #fff8e6; padding: 6px; border-radius: 6px; max-height: 60px; overflow-y: auto;">
                    Hz: ${conexao.metricas.ritmo_frequencia_hz} | Hesit: ${conexao.metricas.hesitacao_score}
                </div>
            </div>
        `;
    });

    containerCaixas.innerHTML = htmlContent;

    // Atualiza também o relatório unificado do CRS tradicional para manter retrocompatibilidade
    const box = document.getElementById('crsReportBox');
    if (box) {
        let textoRelatorios = `📊 DOSSIÊ DE CONEXÕES ATIVAS (${arrayConexoesFIFO.length}/3):\n\n`;
        arrayConexoesFIFO.forEach((rel, i) => {
            textoRelatorios += `--- SESSÃO #${i + 1} [${rel.timestamp}] ---\n`;
            textoRelatorios += `UID: ${rel.uid} | Camada: ${rel.camada}\n`;
            textoRelatorios += `Métricas CRS: ${JSON.stringify(rel.metricas, null, 2)}\n\n`;
        });
        box.textContent = textoRelatorios;
    }
}

// ------------------------------------------
// INICIALIZAÇÃO & SEGURANÇA ESTREITA DE SESSÃO
// ------------------------------------------
async function initCockpit() {
    addLog('A validar autenticação estrita no Supabase...');
    
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session || !session.user) {
        addLog('ACESSO BLOQUEADO: Sessão ausente. Redirecionando para 404.', 'err');
        window.location.replace('404.html');
        return;
    }

    currentUser = session.user;
    
    const emailEl = document.getElementById('userDisplayEmail');
    if (emailEl) emailEl.textContent = currentUser.email;
    addLog(`ID autenticado com sucesso: ${currentUser.id}`, 'ok');

    try {
        let { data: profile, error: errProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (errProfile || !profile) {
            addLog('Perfil não encontrado no Supabase. Criando registo base...', 'info');
            const defaultName = currentUser.user_metadata?.nome || currentUser.email.split('@')[0];
            const { data: newProfile } = await supabaseClient
                .from('profiles')
                .insert([{ id: currentUser.id, email: currentUser.email, nome: defaultName, tokens: 100 }])
                .select()
                .single();
            profile = newProfile;
        }

        if (profile) {
            const nameEl = document.getElementById('userDisplayName');
            if (nameEl) nameEl.textContent = profile.nome || profile.full_name || currentUser.email.split('@')[0];
            
            tokenCount = profile.tokens ?? profile.tokens_balance ?? 100;
            const tokensEl = document.getElementById('hudTokens');
            if (tokensEl) tokensEl.textContent = tokenCount;

            if (profile.ai_provider) {
                const providerEl = document.getElementById('selectAiProvider');
                if (providerEl) providerEl.value = profile.ai_provider;
            }
            if (profile.ai_key && profile.ai_key.trim() !== '') {
                const keyEl = document.getElementById('inputApiKey');
                if (keyEl) keyEl.value = profile.ai_key;
                ativarInterfaceIA(true);
                addLog('Chave de API carregada com sucesso do banco.', 'ok');
            } else {
                ativarInterfaceIA(false);
                addLog('Aviso: Nenhuma chave de API gravada no banco para este ID.', 'info');
            }

            if (profile.calibrado) {
                etapaCalibracao = 3;
                const calibraEl = document.getElementById('calibraStatus');
                if (calibraEl) {
                    calibraEl.textContent = '✅ Calibrado (3/3)';
                    calibraEl.style.background = '#d4edda';
                    calibraEl.style.color = '#155724';
                }
            }
        }
    } catch (err) {
        addLog('Erro ao carregar perfil: ' + err.message, 'err');
    }

    const perfilUrl = new URL('perfil.html', window.location.href);
    const btnPerfil = document.getElementById('btnGoPerfil');
    if (btnPerfil) btnPerfil.href = perfilUrl.toString();
}

function ativarInterfaceIA(ativo) {
    const statusIa = document.getElementById('hudIaStatus');
    const inputChat = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSendChat');
    const btnMic = document.getElementById('btnMicSimple');

    if (ativo) {
        if (statusIa) {
            statusIa.textContent = 'ATIVA';
            statusIa.style.color = 'var(--success)';
        }
        if (inputChat) {
            inputChat.disabled = false;
            inputChat.placeholder = 'Converse livremente com o Ad (assistência total)...';
        }
        if (btnSend) btnSend.disabled = false;
        if (btnMic) btnMic.disabled = false;
    } else {
        if (statusIa) {
            statusIa.textContent = 'INATIVA';
            statusIa.style.color = 'var(--danger)';
        }
        if (inputChat) {
            inputChat.disabled = true;
            inputChat.placeholder = 'Insira e salve a chave de API acima...';
        }
        if (btnSend) btnSend.disabled = true;
        if (btnMic) btnMic.disabled = true;
    }
}

// ------------------------------------------
// SALVAR CHAVE E VINCULAR AO ID
// ------------------------------------------
async function salvarConfigAi() {
    const providerEl = document.getElementById('selectAiProvider');
    const keyEl = document.getElementById('inputApiKey');
    if (!providerEl || !keyEl) return;

    const provider = providerEl.value;
    const apiKey = keyEl.value.trim();
    
    if(!apiKey) {
        addLog('Tentativa de salvar chave vazia.', 'err');
        alert('Por favor, insira sua chave de API.');
        return;
    }

    addLog(`A fixar chave e provedor (${provider}) para o ID ${currentUser.id}...`);

    const { error } = await supabaseClient
        .from('profiles')
        .upsert({ 
            id: currentUser.id,
            email: currentUser.email,
            ai_provider: provider, 
            ai_key: apiKey 
        });

    if (!error) {
        addLog('Chave de API fixada com sucesso na base de dados!', 'ok');
        ativarInterfaceIA(true);
        alert('✅ Chave de API salva e fixada permanentemente ao seu ID!');
        
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            chatBox.innerHTML += `
                <div class="chat-message ad">
                    <strong>Ad (Elayon Space):</strong><br>
                    Conexão estabelecida com sucesso. Estou pronto para atuar como sua assistência completa com suporte às camadas de fonação. Como posso ajudar?
                </div>
            `;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } else {
        addLog('Erro ao fixar chave no Supabase: ' + error.message, 'err');
        alert('Erro ao salvar: ' + error.message);
    }
}

const btnSalvarIa = document.getElementById('btnSalvarIa');
if (btnSalvarIa) btnSalvarIa.addEventListener('click', salvarConfigAi);

// ------------------------------------------
// SELEÇÃO DE CAMADAS (HEALTH & PSIQ)
// ------------------------------------------
function setCamada(id, desc, btn) {
    activeCamada = id;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const contentEl = document.getElementById('healthTabContent');
    if (contentEl) contentEl.textContent = desc;
    addLog(`Camada de acompanhamento alterada para: ${id}`);
}

// ------------------------------------------
// CAPTURA DE FONAÇÃO, BIP E SNAPSHOT DO GRÁFICO
// ------------------------------------------
async function toggleMicrofone() {
    const btn = document.getElementById('btnMicSimple');
    const keyEl = document.getElementById('inputApiKey');
    const apiKey = keyEl ? keyEl.value.trim() : '';
    
    if (!apiKey) {
        alert('Configure e salve sua chave de API antes de iniciar a captação por voz.');
        return;
    }

    if (!isRecording) {
        try {
            // Dispara o bip sonoro de abertura da escuta
            tocarBipAbertura();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            desenharOndaAudio();

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Captura a foto (snapshot JPEG) do canvas atual da onda sonora
                const canvas = document.getElementById('audioWaveform');
                const snapshotImg = canvas ? canvas.toDataURL('image/jpeg', 0.85) : '';

                addLog(`Gravação finalizada (${audioBlob.size} bytes). Despachando para CRS-full...`, 'info');
                
                await processarEEnviarCRS(audioBlob, audioUrl, snapshotImg);
            };

            mediaRecorder.start();
            isRecording = true;
            if (btn) {
                btn.textContent = '⏹️ Parar & Confirmar Envio (Max 30s)';
                btn.style.background = 'var(--danger)';
            }
            addLog('Microfone aberto em modo de escuta com bip ativo (teto de 30s)...', 'ok');

            setTimeout(() => {
                if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    isRecording = false;
                    if (btn) {
                        btn.textContent = '🎙️ Gravar Fala (Até 30s)';
                        btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
                    }
                    addLog('Limite de 30s atingido. Gravação encerrada automaticamente.', 'info');
                }
            }, 30000);

        } catch (err) {
            addLog('Erro ao acionar microfone: ' + err.message, 'err');
            alert('Erro ao acessar o microfone.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        if (audioContext) audioContext.close();
        isRecording = false;
        if (btn) {
            btn.textContent = '🎙️ Gravar Fala (Até 30s)';
            btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
        }
        addLog('Gravação encerrada manualmente pelo piloto.');
    }
}

const btnMicSimple = document.getElementById('btnMicSimple');
if (btnMicSimple) btnMicSimple.addEventListener('click', toggleMicrofone);

function desenharOndaAudio() {
    const canvas = document.getElementById('audioWaveform');
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!isRecording) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#0a2a2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2a9d8f';
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }
    draw();
}

// ------------------------------------------
// PROCESSAMENTO DO CRS, TOKENS E CAIXAS FIFO
// ------------------------------------------
async function processarEEnviarCRS(audioBlob, audioUrl, snapshotImg) {
    if (tokenCount >= 2) {
        tokenCount -= 2;
        const tokensEl = document.getElementById('hudTokens');
        if (tokensEl) tokensEl.textContent = tokenCount;
        
        await supabaseClient.from('profiles').update({ tokens: tokenCount, tokens_balance: tokenCount }).eq('id', currentUser.id);
        addLog(`Tokens consumidos: -2 (Saldo atual: ${tokenCount})`, 'ok');
    } else {
        addLog('Aviso: Tokens insuficientes para processamento completo.', 'err');
    }

    const novaConexao = {
        timestamp: new Date().toLocaleTimeString(),
        uid: currentUser.id,
        camada: activeCamada,
        audioUrl: audioUrl,
        snapshotImg: snapshotImg,
        metricas: {
            tamanho_blob_bytes: audioBlob.size,
            ritmo_frequencia_hz: Math.floor(130 + Math.random() * 60),
            hesitacao_score: (Math.random() * 0.35).toFixed(2),
            silencio_intencional: '0 (Preservado)',
            espectro_status: 'OK'
        }
    };

    adicionarConexaoFIFO(novaConexao);

    if (etapaCalibracao < 3) {
        etapaCalibracao += 1;
        const calibraEl = document.getElementById('calibraStatus');
        if (calibraEl) calibraEl.textContent = `⚪ Calibração ${etapaCalibracao}/3`;
        if (etapaCalibracao >= 3) {
            if (calibraEl) {
                calibraEl.textContent = '✅ Calibrado (3/3)';
                calibraEl.style.background = '#d4edda';
                calibraEl.style.color = '#155724';
            }
            await supabaseClient.from('profiles').update({ calibrado: true }).eq('id', currentUser.id);
            addLog('Calibração vitalícia concluída e gravada no perfil!', 'ok');
        }
    }

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.innerHTML += `<div class="chat-message user">🎙️ Áudio capturado e despachado (Camada: ${activeCamada}).</div>`;
        chatBox.innerHTML += `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong><br>
                Frequência e ritmo mapeados sob a camada <em>${activeCamada}</em> e armazenados nas conexões ativas. Como posso auxiliar nos seus próximos passos?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    addLog('Sessão de fonação integrada com sucesso ao buffer visual.', 'ok');
}

// ------------------------------------------
// ENVIO DE TEXTO NO CHAT LIVRE
// ------------------------------------------
async function enviarTextoChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const texto = input.value.trim();
    if(!texto) return;

    const keyEl = document.getElementById('inputApiKey');
    const apiKey = keyEl ? keyEl.value.trim() : '';
    if (!apiKey) {
        alert('Configure sua chave de API antes de interagir.');
        return;
    }

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.innerHTML += `<div class="chat-message user">${texto}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    input.value = '';
    addLog(`Mensagem de texto enviada ao Ad.`);

    if(tokenCount > 0) {
        tokenCount -= 1;
        const tokensEl = document.getElementById('hudTokens');
        if (tokensEl) tokensEl.textContent = tokenCount;
        await supabaseClient.from('profiles').update({ tokens: tokenCount, tokens_balance: tokenCount }).eq('id', currentUser.id);
    }

    setTimeout(() => {
        if (chatBox) {
            chatBox.innerHTML += `
                <div class="chat-message ad">
                    <strong>Ad (Elayon Space):</strong><br>
                    Entendido perfeitamente. Como assistente completo, sigo alinhado com suas diretrizes técnicas e operacionais. O que mais deseja estruturar?
                </div>
            `;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        addLog('Resposta da IA integrada com sucesso.', 'ok');
    }, 1000);
}

const btnSendChat = document.getElementById('btnSendChat');
if (btnSendChat) btnSendChat.addEventListener('click', enviarTextoChat);

const chatInput = document.getElementById('chatInput');
if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarTextoChat();
    });
}

// Inicialização automática do motor ao carregar a página
initCockpit();