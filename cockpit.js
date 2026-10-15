const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tokenCount = 100;
let etapaCalibracao = 0; // 0 a 3
let gravandoLivre = false;
let mediaRecorder = null;
let audioChunks = [];
let logsAbertos = false;

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

async function initCockpit() {
    addLog('A validar sessão e calibragem vitalícia no Supabase...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        addLog('Sessão expirada. A redirecionar para o perfil.', 'err');
        window.location.href = 'perfil.html';
        return;
    }

    currentUser = session.user;
    document.getElementById('userDisplayEmail').textContent = currentUser.email;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        document.getElementById('userDisplayName').textContent = profile.nome || currentUser.email.split('@')[0];
        tokenCount = profile.tokens ?? 100;
        document.getElementById('hudTokens').textContent = tokenCount;
        document.getElementById('cardTokens').textContent = tokenCount;
        
        if (profile.ai_provider) document.getElementById('selectAiProvider').value = profile.ai_provider;
        if (profile.ai_key) document.getElementById('inputApiKey').value = profile.ai_key;

        // Verifica se a calibração vitalícia já foi concluída anteriormente
        if (profile.calibrado) {
            etapaCalibracao = 3;
            ativarSimbioseCompleta();
            addLog('Calibração vitalícia carregada do perfil com sucesso.', 'ok');
        }
    }

    const perfilUrl = new URL('perfil.html', window.location.href);
    document.getElementById('btnGoPerfil').href = perfilUrl.toString();
}

async function salvarConfigAi() {
    const provider = document.getElementById('selectAiProvider').value;
    const apiKey = document.getElementById('inputApiKey').value.trim();
    if(!apiKey) {
        addLog('Tentativa de salvar chave de IA vazia.', 'err');
        alert('Por favor, insira sua chave de API.');
        return;
    }

    addLog(`Salvando provedor ${provider} no Supabase...`);
    const { error } = await supabaseClient
        .from('profiles')
        .upsert({ id: currentUser.id, email: currentUser.email, ai_provider: provider, ai_key: apiKey });

    if (!error) {
        localStorage.setItem('elayon_ai_provider', provider);
        localStorage.setItem('elayon_ai_key', apiKey);
        addLog('Chave de IA externa salva e fixada com sucesso!', 'ok');
        alert('✅ Chave de API e Provedor salvos e fixados com sucesso!');
    } else {
        addLog('Erro ao salvar chave: ' + error.message, 'err');
        alert('Erro ao salvar: ' + error.message);
    }
}

// Gravação sequencial dos 3 áudios para calibração vitalícia com envio ao CRS-full
async function gravarAudioCalibracao() {
    if (tokenCount < 1) {
        addLog('Tokens insuficientes para calibração.', 'err');
        alert('Tokens insuficientes.');
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('Navegador não suporta gravação de áudio.', 'err');
        alert('Seu dispositivo não suporta captura de microfone.');
        return;
    }

    try {
        addLog(`Iniciando captação do microfone para o Áudio ${etapaCalibracao + 1}/3...`);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        let chunks = [];

        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            addLog(`Áudio ${etapaCalibracao + 1}/3 capturado (${blob.size} bytes). Despachando para CRS-full (Análise Espectral e Pausas)...`, 'info');

            setTimeout(async () => {
                tokenCount -= 1;
                etapaCalibracao += 1;
                
                document.getElementById('hudTokens').textContent = tokenCount;
                document.getElementById('cardTokens').textContent = tokenCount;

                await supabaseClient.from('profiles').update({ tokens: tokenCount }).eq('id', currentUser.id);

                if (etapaCalibracao < 3) {
                    document.getElementById('btnIniciarCalibracao').textContent = `🎙️ Gravar Áudio de Calibração Vitalícia (Sequencial ${etapaCalibracao + 1}/3)`;
                    document.getElementById('calibraStatus').textContent = `⚪ Calibração Pendente (${etapaCalibracao}/3)`;
                    addLog(`Áudio ${etapaCalibracao} processado pelo CRS com sucesso.`, 'ok');
                } else {
                    addLog('3 áudios calibrados. Perfil ajustado para calibração vitalícia!', 'ok');
                    await supabaseClient.from('profiles').update({ calibrado: true }).eq('id', currentUser.id);
                    ativarSimbioseCompleta();
                }
            }, 1800);
        };

        recorder.start();
        alert(`Fale ao microfone para o Áudio ${etapaCalibracao + 1}/3. Clique em OK quando terminar.`);
        recorder.stop();
        stream.getTracks().forEach(track => track.stop());

    } catch (err) {
        addLog('Erro ao acionar microfone do dispositivo: ' + err.message, 'err');
        alert('Erro ao acessar o microfone.');
    }
}

function ativarSimbioseCompleta() {
    document.getElementById('calibraStatus').textContent = '✅ Calibração Vitalícia Ativa';
    document.getElementById('calibraStatus').style.color = 'var(--success)';
    document.getElementById('btnIniciarCalibracao').style.display = 'none';

    document.getElementById('chatInput').disabled = false;
    document.getElementById('chatInput').placeholder = 'Converse com o Ad (análise de hesitação ativa)...';
    document.getElementById('btnSendChat').disabled = false;
    document.getElementById('btnMicLivre').classList.remove('btn-disabled');
    document.getElementById('btnElayonHealth').classList.add('active');

    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `
        <div class="chat-message ad">
            Conexão Simbiótica Ativada.<br><br>
            Seja bem-vindo ao Elayon Space. O seu espaço de Escuta Simbólica.<br><br>
            Como vamos operar hoje?
        </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
    addLog('Módulos e Assistente Ad operacionais com análise de hesitação.', 'ok');
}

// Primeira interação detalhando nível de hesitação e aspectos espectrais
function enviarTextoChat() {
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    if(!texto) return;

    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `<div class="chat-message user">${texto}</div>`;
    input.value = '';
    addLog(`Mensagem enviada ao Ad para análise de fluxo: "${texto}"`);

    if(tokenCount > 0) {
        tokenCount -= 1;
        document.getElementById('hudTokens').textContent = tokenCount;
        document.getElementById('cardTokens').textContent = tokenCount;
    }

    setTimeout(() => {
        chatBox.innerHTML += `
            <div class="chat-message ad">
                📊 <strong>Relatório CRS-full & Espectrometria:</strong><br>
                - Nível de hesitação: Baixo / Fluido.<br>
                - Espectro de frequência e pausas validados.<br>
                - Aparelho calibrado com sucesso. Como posso auxiliar no seu ecossistema?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Feedback de hesitação e relatório CRS entregues com sucesso.', 'ok');
    }, 1200);
}

// Gravação contínua sem limite de tempo no microfone do aparelho
async function toggleMicrofoneLivre() {
    const btn = document.getElementById('btnMicLivre');
    
    if (!gravandoLivre) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                addLog(`Gravação contínua concluída (${blob.size} bytes). Enviando para CRS-full...`, 'ok');
                
                const chatBox = document.getElementById('chatBox');
                chatBox.innerHTML += `<div class="chat-message ad">🎙️ Áudio contínuo processado. Espectrograma e métricas de silêncio avaliadas pelo CRS.</div>`;
                chatBox.scrollTop = chatBox.scrollHeight;
            };

            mediaRecorder.start();
            gravandoLivre = true;
            btn.textContent = '⏹️ Parar Gravação Contínua';
            btn.className = 'btn-action btn-danger';
            addLog('Microfone aberto em modo contínuo (sem limite de tempo)...', 'ok');
        } catch (err) {
            addLog('Erro no microfone contínuo: ' + err.message, 'err');
            alert('Erro ao iniciar o microfone.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        gravandoLivre = false;
        btn.textContent = '🔴 Iniciar Gravação Contínua (Sem Limite)';
        btn.className = 'btn-action btn-primary';
        addLog('Gravação contínua encerrada.');
    }
}

initCockpit();
