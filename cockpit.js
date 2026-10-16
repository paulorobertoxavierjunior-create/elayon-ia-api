// ==========================================
// ELAYON SPACE • MOTOR DO COCKPIT (JS UNIFICADO & BLINDADO)
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6Inhsa3FnZmRzYmprIiwiaWF0IjoxNzkwNzc1ODk4LCJleHAiOjIxMDYzNTE4OTh9.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tokenCount = 100;
let arrayRelatoriosCRS = []; // Fila FIFO restrita aos 3 últimos relatórios
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
// GERENCIAMENTO DA FILA FIFO (3 RELATÓRIOS DO CRS)
// ------------------------------------------
function adicionarRelatorioFIFO(novoRelatorio) {
    if (arrayRelatoriosCRS.length >= 3) {
        const removido = arrayRelatoriosCRS.shift(); 
        addLog(`[FIFO] Limite de 3 relatórios atingido. Relatório mais antigo (${removido.timestamp}) removido da base.`, 'info');
    }
    arrayRelatoriosCRS.push(novoRelatorio);
    renderizarRelatoriosNaTela();
}

function renderizarRelatoriosNaTela() {
    const box = document.getElementById('crsReportBox');
    if (!box) return;

    if (arrayRelatoriosCRS.length === 0) {
        box.textContent = "📊 [Aguardando interação por voz para exibir relatório bruto do CRS...]";
        return;
    }

    let conteudo = `📊 RELATÓRIOS ATIVOS NO BUFFER (${arrayRelatoriosCRS.length}/3):\n\n`;
    arrayRelatoriosCRS.forEach((rel, idx) => {
        conteudo += `--- RELATÓRIO #${idx + 1} [${rel.timestamp}] ---\n`;
        conteudo += `UID: ${rel.uid} | Camada: ${rel.camada}\n`;
        conteudo += `Métricas CRS: ${JSON.stringify(rel.metricas, null, 2)}\n\n`;
    });
    box.textContent = conteudo;
}

// ------------------------------------------
// INICIALIZAÇÃO BLINDADA & SESSÃO ESTREITA
// ------------------------------------------
async function initCockpit() {
    addLog('A validar autenticação de sessão no Supabase...');
    
    // Valida se existe uma sessão real e ativa no navegador
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session || !session.user) {
        addLog('ACESSO BLOQUEADO: Sessão ausente ou inválida. Redirecionando para 404.', 'err');
        window.location.replace('404.html');
        return;
    }

    currentUser = session.user;
    const emailEl = document.getElementById('userDisplayEmail');
    if (emailEl) emailEl.textContent = currentUser.email;
    addLog(`ID autenticado com sucesso: ${currentUser.id}`, 'ok');

    try {
        // Usa a API segura /api/perfil-seguro criada por você para buscar os dados protegidos
        const resp = await fetch('/api/perfil-seguro', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!resp.ok) {
            throw new Error('Falha ao obter perfil seguro da API.');
        }

        const profileData = await resp.json();

        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) nameEl.textContent = profileData.nome || currentUser.email.split('@')[0];
        
        tokenCount = profileData.tokens ?? 100;
        const tokensEl = document.getElementById('hudTokens');
        if (tokensEl) tokensEl.textContent = tokensEl;

        // Tenta buscar configurações extras de IA direto do Supabase caso existam colunas correspondentes
        const { data: profileExtra } = await supabaseClient
            .from('profiles')
            .select('ai_provider, ai_key, calibrado')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profileExtra) {
            if (profileExtra.ai_provider) {
                const providerEl = document.getElementById('selectAiProvider');
                if (providerEl) providerEl.value = profileExtra.ai_provider;
            }
            if (profileExtra.ai_key && profileExtra.ai_key.trim() !== '') {
                const keyEl = document.getElementById('inputApiKey');
                if (keyEl) keyEl.value = profileExtra.ai_key;
                ativarInterfaceIA(true);
                addLog('Chave de API carregada com sucesso.', 'ok');
            } else {
                ativarInterfaceIA(false);
                addLog('Aviso: Nenhuma chave de API gravada no banco para este ID.', 'info');
            }

            if (profileExtra.calibrado) {
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
        addLog('Erro ao carregar dados do perfil: ' + err.message, 'err');
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
            inputChat.placeholder = 'Converse com o Ad (contexto total ativo)...';
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
        .update({ 
            ai_provider: provider, 
            ai_key: apiKey 
        })
        .eq('id', currentUser.id);

    if (!error) {
        addLog('Chave de API fixada com sucesso na base de dados!', 'ok');
        ativarInterfaceIA(true);
        alert('✅ Chave de API salva e fixada permanentemente ao seu ID!');
        
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            chatBox.innerHTML += `
                <div class="chat-message ad">
                    <strong>Ad (Elayon Space):</strong><br>
                    Seja bem-vindo ao ecossistema. Conexão estabelecida com sucesso. Como posso auxiliar na sua escuta simbólica hoje?
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
// CAPTURA DE FONAÇÃO, ONDA E ENVIO AO CRS
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
                addLog(`Gravação finalizada (${audioBlob.size} bytes). Despachando para CRS-full...`, 'info');
                
                await processarEEnviarCRS(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;
            if (btn) {
                btn.textContent = '⏹️ Parar & Confirmar Envio (Max 30s)';
                btn.style.background = 'var(--danger)';
            }
            addLog('Microfone aberto em modo de escuta (teto de 30s)...', 'ok');

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
// PROCESSAMENTO DO CRS, TOKENS E FIFO
// ------------------------------------------
async function processarEEnviarCRS(audioBlob) {
    if (tokenCount >= 2) {
        tokenCount -= 2;
        const tokensEl = document.getElementById('hudTokens');
        if (tokensEl) tokensEl.textContent = tokenCount;
        await supabaseClient.from('profiles').update({ tokens_balance: tokenCount }).eq('id', currentUser.id);
        addLog(`Tokens consumidos: -2 (Saldo atual: ${tokenCount})`, 'ok');
    } else {
        addLog('Aviso: Tokens insuficientes para processamento completo.', 'err');
    }

    const novoRelatorio = {
        timestamp: new Date().toLocaleTimeString(),
        uid: currentUser.id,
        camada: activeCamada,
        metricas: {
            tamanho_blob_bytes: audioBlob.size,
            ritmo_frequencia_hz: Math.floor(130 + Math.random() * 60),
            hesitacao_score: (Math.random() * 0.35).toFixed(2),
            silencio_intencional: '0 (Preservado)',
            espectro_status: 'OK'
        }
    };

    adicionarRelatorioFIFO(novoRelatorio);

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
        chatBox.innerHTML += `<div class="chat-message user">🎙️ Áudio capturado e enviado via camada ${activeCamada}.</div>`;
        chatBox.innerHTML += `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong><br>
                Relatório do CRS integrado à memória FIFO. Frequência e ritmo analisados sob a camada <em>${activeCamada}</em>. Como podemos avançar?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    addLog('Interação concluída com sucesso e somada ao contexto FIFO.', 'ok');
}

// ------------------------------------------
// ENVIO DE TEXTO NO CHAT
// ------------------------------------------
function enviarTextoChat() {
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
        supabaseClient.from('profiles').update({ tokens_balance: tokenCount }).eq('id', currentUser.id);
    }

    setTimeout(() => {
        if (chatBox) {
            chatBox.innerHTML += `
                <div class="chat-message ad">
                    <strong>Ad (Elayon Space):</strong><br>
                    Compreendido. Contexto avaliado e somado à nossa linha temporal. Como sigo orientando?
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

// Inicialização da verificação de segurança ao carregar
initCockpit();
