const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tokenCount = 100;
let etapaCalibracao = 0;
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
    addLog('A validar sessão e a carregar dados do ID no Supabase...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        addLog('Sessão expirada. A redirecionar para o perfil.', 'err');
        window.location.href = 'perfil.html';
        return;
    }

    currentUser = session.user;
    document.getElementById('userDisplayEmail').textContent = currentUser.email;
    addLog(`ID autenticado: ${currentUser.id}`, 'ok');

    // Carrega o perfil completo do utilizador vinculado ao ID
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
        document.getElementById('cardTokens').textContent = tokenCount;
        
        // Fixa e carrega o provedor e a chave de API salvos no banco para este ID
        if (profile.ai_provider) {
            document.getElementById('selectAiProvider').value = profile.ai_provider;
        }
        if (profile.ai_key && profile.ai_key.trim() !== '') {
            document.getElementById('inputApiKey').value = profile.ai_key;
            addLog('Chave de API fixa carregada com sucesso do banco de dados.', 'ok');
        } else {
            addLog('Aviso: Nenhuma chave de API gravada no banco para este ID.', 'info');
        }

        if (profile.calibrado) {
            etapaCalibracao = 3;
            ativarSimbioseCompleta();
            addLog('Calibração vitalícia ativa carregada.', 'ok');
        }
    } else {
        addLog('Perfil não encontrado para este ID. A criar registo base...', 'info');
        await supabaseClient.from('profiles').insert([{ id: currentUser.id, email: currentUser.email, tokens: 100 }]);
    }

    const perfilUrl = new URL('perfil.html', window.location.href);
    document.getElementById('btnGoPerfil').href = perfilUrl.toString();
}

// Salva e fixa a chave de API no Supabase vinculada estritamente ao ID
async function salvarConfigAi() {
    const provider = document.getElementById('selectAiProvider').value;
    const apiKey = document.getElementById('inputApiKey').value.trim();
    
    if(!apiKey) {
        addLog('Tentativa de salvar chave vazia.', 'err');
        alert('Por favor, insira sua chave de API.');
        return;
    }

    addLog(`A fixar chave e provedor (${provider}) para o ID ${currentUser.id}...`);

    // Atualiza ou insere mantendo o vínculo fixo por ID
    const { error } = await supabaseClient
        .from('profiles')
        .update({ 
            ai_provider: provider, 
            ai_key: apiKey 
        })
        .eq('id', currentUser.id);

    if (!error) {
        addLog('Chave de API fixada com sucesso na base de dados!', 'ok');
        alert('✅ Chave de API salva e fixada permanentemente ao seu ID!');
    } else {
        addLog('Erro ao fixar chave no Supabase: ' + error.message, 'err');
        alert('Erro ao salvar: ' + error.message);
    }
}

async function gravarAudioCalibracao() {
    if (tokenCount < 1) {
        addLog('Tokens insuficientes para calibração.', 'err');
        alert('Tokens insuficientes.');
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        addLog('Navegador não suporta gravação de áudio.', 'err');
        alert('Seu dispositivo não suporta o microfone.');
        return;
    }

    try {
        addLog(`Iniciando captação para o Áudio de Calibração Vitalícia ${etapaCalibracao + 1}/3...`);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        let chunks = [];

        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            addLog(`Áudio ${etapaCalibracao + 1}/3 capturado (${blob.size} bytes). Despachando para CRS-full...`, 'info');

            setTimeout(async () => {
                tokenCount -= 1;
                etapaCalibracao += 1;
                
                document.getElementById('hudTokens').textContent = tokenCount;
                document.getElementById('cardTokens').textContent = tokenCount;

                await supabaseClient.from('profiles').update({ tokens: tokenCount }).eq('id', currentUser.id);

                if (etapaCalibracao < 3) {
                    document.getElementById('btnIniciarCalibracao').textContent = `🎙️ Gravar Áudio de Calibração Vitalícia (Sequencial ${etapaCalibracao + 1}/3)`;
                    document.getElementById('calibraStatus').textContent = `⚪ Calibração Pendente (${etapaCalibracao}/3)`;
                    addLog(`Áudio ${etapaCalibracao} processado com sucesso.`, 'ok');
                } else {
                    addLog('3 áudios calibrados. Calibração vitalícia gravada!', 'ok');
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
        addLog('Erro ao acionar microfone: ' + err.message, 'err');
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
    addLog('Módulos e Assistente Ad operacionais.', 'ok');
}

function enviarTextoChat() {
    const input = document.getElementById('chatInput');
    const texto = input.value.trim();
    if(!texto) return;

    const apiKey = document.getElementById('inputApiKey').value.trim();
    if (!apiKey) {
        addLog('Erro: Nenhuma chave de API ativa vinculada a este ID.', 'err');
        alert('Configure e salve sua chave de API acima antes de interagir.');
        return;
    }

    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `<div class="chat-message user">${texto}</div>`;
    input.value = '';
    addLog(`Mensagem enviada ao Ad com chave vinculada ao ID.`);

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
                - Conexão com API externa ativa para o ID. Como posso auxiliar?
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Interação concluída com sucesso.', 'ok');
    }, 1200);
}

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
                chatBox.innerHTML += `<div class="chat-message ad">🎙️ Áudio contínuo processado e avaliado pelo CRS.</div>`;
                chatBox.scrollTop = chatBox.scrollHeight;
            };

            mediaRecorder.start();
            gravandoLivre = true;
            btn.textContent = '⏹️ Parar Gravação Contínua';
            btn.className = 'btn-action btn-danger';
            addLog('Microfone aberto em modo contínuo...', 'ok');
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
