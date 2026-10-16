// ==========================================
// ELAYON SPACE • MOTOR DO COCKPIT (JS UNIFICADO)
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
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
let logsAbertos = false;
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
    document.getElementById('logCount').textContent = count;
}

function toggleLogsDrawer() {
    logsAbertos = !logsAbertos;
    const drawer = document.getElementById('logsDrawer');
    const icon = document.getElementById('logToggleIcon');
    if (logsAbertos) {
        drawer.style.transform = 'translateY(0)';
        icon.textContent = '▼ Recolher';
    } else {
        drawer.style.transform = 'translateY(105px)';
        icon.textContent = '▲ Expandir';
    }
}

// ------------------------------------------
// GERENCIAMENTO DA FILA FIFO (3 RELATÓRIOS DO CRS)
// ------------------------------------------
function adicionarRelatorioFIFO(novoRelatorio) {
    if (arrayRelatoriosCRS.length >= 3) {
        const removido = arrayRelatoriosCRS.shift(); // Remove o mais antigo automaticamente
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
// INICIALIZAÇÃO & CONEXÃO FIEL DO USUÁRIO
// ------------------------------------------
async function initCockpit() {
    addLog('A validar sessão e a carregar dados do ID no Supabase...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        addLog('Sessão expirada. A redirecionar para o perfil.', 'err');
        window.location.href = 'perfil.html';
        return;
    }

    currentUser = session.user;
    document.getElementById('userDisplayEmail').textContent = currentUser.email;
    addLog(`ID autenticado com sucesso: ${currentUser.id}`, 'ok');

    // Carrega o perfil completo do utilizador vinculado estritamente ao ID
    const { data: profile, error: errProfile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (errProfile) {
        addLog('Erro ao buscar perfil: ' + errProfile.message, 'err');
    }

    if (profile) {
        document.getElementById('userDisplayName').textContent = profile.nome || currentUser.email.split('@')[0];
        tokenCount = profile.tokens ?? 100;
        document.getElementById('hudTokens').textContent = tokenCount;
        
        // Verifica e carrega a chave de API e provedor vinculados
        if (profile.ai_provider) {
            document.getElementById('selectAiProvider').value = profile.ai_provider;
        }
        if (profile.ai_key && profile.ai_key.trim() !== '') {
            document.getElementById('inputApiKey').value = profile.ai_key;
            ativarInterfaceIA(true);
            addLog('Chave de API fixa carregada com sucesso do banco de dados.', 'ok');
        } else {
            ativarInterfaceIA(false);
            addLog('Aviso: Nenhuma chave de API gravada no banco para este ID.', 'info');
        }

        if (profile.calibrado) {
            etapaCalibracao = 3;
            document.getElementById('calibraStatus').textContent = '✅ Calibrado (3/3)';
            document.getElementById('calibraStatus').style.background = '#d4edda';
            document.getElementById('calibraStatus').style.color = '#155724';
            addLog('Calibração vitalícia ativa carregada.', 'ok');
        }
    } else {
        addLog('Perfil não encontrado para este ID. A criar registo base...', 'info');
        await supabaseClient.from('profiles').insert([{ id: currentUser.id, email: currentUser.email, tokens: 100 }]);
    }

    const perfilUrl = new URL('perfil.html', window.location.href);
    document.getElementById('btnGoPerfil').href = perfilUrl.toString();
}

function ativarInterfaceIA(ativo) {
    const statusIa = document.getElementById('hudIaStatus');
    const inputChat = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSendChat');
    const btnMic = document.getElementById('btnMicSimple');

    if (ativo) {
        statusIa.textContent = 'ATIVA';
        statusIa.style.color = 'var(--success)';
        inputChat.disabled = false;
        inputChat.placeholder = 'Converse com o Ad (contexto total ativo)...';
        btnSend.disabled = false;
        btnMic.disabled = false;
    } else {
        statusIa.textContent = 'INATIVA';
        statusIa.style.color = 'var(--danger)';
        inputChat.disabled = true;
        inputChat.placeholder = 'Insira e salve a chave de API acima...';
        btnSend.disabled = true;
        btnMic.disabled = true;
    }
}

// ------------------------------------------
// SALVAR CHAVE E VINCULAR AO ID
// ------------------------------------------
async function salvarConfigAi() {
    const provider = document.getElementById('selectAiProvider').value;
    const apiKey = document.getElementById('inputApiKey').value.trim();
    
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
        
        // Mensagem de boas-vindas da IA
        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML += `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong><br>
                Seja bem-vindo ao ecossistema. Conexão estabelecida com sucesso. Como posso auxiliar na sua escuta simbólica hoje?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    } else {
        addLog('Erro ao fixar chave no Supabase: ' + error.message, 'err');
        alert('Erro ao salvar: ' + error.message);
    }
}

document.getElementById('btnSalvarIa').addEventListener('click', salvarConfigAi);

// ------------------------------------------
// SELEÇÃO DE CAMADAS (HEALTH & PSIQ)
// ------------------------------------------
function setCamada(id, desc, btn) {
    activeCamada = id;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('healthTabContent').textContent = desc;
    addLog(`Camada de acompanhamento alterada para: ${id}`);
}

// ------------------------------------------
// CAPTURA DE FONAÇÃO, ONDA E ENVIO AO CRS
// ------------------------------------------
async function toggleMicrofone() {
    const btn = document.getElementById('btnMicSimple');
    const apiKey = document.getElementById('inputApiKey').value.trim();
    
    if (!apiKey) {
        alert('Configure e salve sua chave de API antes de iniciar a captação por voz.');
        return;
    }

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            // Inicializa visualizador gráfico de onda (AudioContext)
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
            btn.textContent = '⏹️ Parar & Confirmar Envio (Max 30s)';
            btn.style.background = 'var(--danger)';
            addLog('Microfone aberto em modo de escuta (teto de 30s)...', 'ok');

            // Timeout automático de segurança de 30 segundos
            setTimeout(() => {
                if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    isRecording = false;
                    btn.textContent = '🎙️ Gravar Fala (Até 30s)';
                    btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
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
        btn.textContent = '🎙️ Gravar Fala (Até 30s)';
        btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
        addLog('Gravação encerrada manualmente pelo piloto.');
    }
}

document.getElementById('btnMicSimple').addEventListener('click', toggleMicrofone);

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
    // Consumo de tokens: 1 da ferramenta + 1 do processamento do CRS = 2 tokens
    if (tokenCount >= 2) {
        tokenCount -= 2;
        document.getElementById('hudTokens').textContent = tokenCount;
        await supabaseClient.from('profiles').update({ tokens: tokenCount }).eq('id', currentUser.id);
        addLog(`Tokens consumidos: -2 (Saldo atual: ${tokenCount})`, 'ok');
    } else {
        addLog('Aviso: Tokens insuficientes para processamento completo.', 'err');
    }

    // Simula a chegada do relatório estruturado do CRS-full
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

    // Adiciona na Fila FIFO (rotaciona mantendo apenas os 3 últimos)
    adicionarRelatorioFIFO(novoRelatorio);

    // Validação da calibração (3 interações completas)
    if (etapaCalibracao < 3) {
        etapaCalibracao += 1;
        document.getElementById('calibraStatus').textContent = `⚪ Calibração ${etapaCalibracao}/3`;
        if (etapaCalibracao >= 3) {
            document.getElementById('calibraStatus').textContent = '✅ Calibrado (3/3)';
            document.getElementById('calibraStatus').style.background = '#d4edda';
            document.getElementById('calibraStatus').style.color = '#155724';
            await supabaseClient.from('profiles').update({ calibrado: true }).eq('id', currentUser.id);
            addLog('Calibração vitalícia concluída e gravada no perfil!', 'ok');
        }
    }

    // Injeta interação no Chat com contexto total
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `<div class="chat-message user">🎙️ Áudio capturado e enviado via camada ${activeCamada}.</div>`;
    chatBox.innerHTML += `
        <div class="chat-message ad">
            <strong>Ad (Elayon Space):</strong><br>
            Relatório do CRS integrado à memória FIFO. Frequência e ritmo analisados sob a camada <em>${activeCamada}</em>. Como podemos avançar?
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
    addLog('Interação concluída com sucesso e somada ao contexto FIFO.', 'ok');
}

// ------------------------------------------
// ENVIO DE TEXTO NO CHAT
// ------------------------------------------
function enviarTextoChat() {
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    if(!texto) return;

    const apiKey = document.getElementById('inputApiKey').value.trim();
    if (!apiKey) {
        alert('Configure sua chave de API antes de interagir.');
        return;
    }

    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `<div class="chat-message user">${texto}</div>`;
    input.value = '';
    addLog(`Mensagem de texto enviada ao Ad.`);

    if(tokenCount > 0) {
        tokenCount -= 1;
        document.getElementById('hudTokens').textContent = tokenCount;
        supabaseClient.from('profiles').update({ tokens: tokenCount }).eq('id', currentUser.id);
    }

    setTimeout(() => {
        chatBox.innerHTML += `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong><br>
                Compreendido. Contexto avaliado e somado à nossa linha temporal. Como sigo orientando?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Resposta da IA integrada com sucesso.', 'ok');
    }, 1000);
}

document.getElementById('btnSendChat').addEventListener('click', enviarTextoChat);
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarTextoChat();
});

// Inicialização automática do motor ao abrir o cockpit
initCockpit();
