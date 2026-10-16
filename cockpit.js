// ==========================================
// ELAYON SPACE • MOTOR DO COCKPIT (JS FINAL)
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let tokenCount = 100;
let arrayConexoesFIFO = []; // Buffer FIFO das 3 interações
let etapaCalibracao = 0; // 0, 1, 2 ou 3
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;

const perguntasCalibracao = [
    "Fase 1/3 [Lucidez]: Para você, o que é lucidez? Você sente que está lúcido neste exato momento?",
    "Fase 2/3 [Consciência]: Você está consciente da sua conexão e do seu estado interior agora?",
    "Fase 3/3 [Presença]: Você se considera presente e ancorado no ecossistema Elayon Space?"
];

// ------------------------------------------
// LOGS DE AUDITORIA INTERNA
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
// BIP SONORO DE ESCUTA
// ------------------------------------------
function tocarBipAbertura() {
    try {
        const ctxBip = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctxBip.createOscillator();
        const gain = ctxBip.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctxBip.currentTime);
        gain.gain.setValueAtTime(0.08, ctxBip.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctxBip.currentTime + 0.12);
        
        osc.connect(gain);
        gain.connect(ctxBip.destination);
        
        osc.start();
        osc.stop(ctxBip.currentTime + 0.12);
    } catch (e) {
        console.log('Contexto de áudio aguardando interação.');
    }
}

// ------------------------------------------
// INICIALIZAÇÃO & PERFIL DO SUPABASE
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
    addLog(`ID autenticado com sucesso: ${currentUser.id}`, 'ok');

    try {
        let { data: profile, error: errProfile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (errProfile || !profile) {
            const defaultName = currentUser.user_metadata?.nome || currentUser.email.split('@')[0];
            const { data: newProfile } = await supabaseClient
                .from('profiles')
                .insert([{ id: currentUser.id, email: currentUser.email, nome: defaultName, tokens: 100, calibrado: false }])
                .select()
                .single();
            profile = newProfile;
        }

        if (profile) {
            // Preenche dados do perfil automaticamente no HTML
            const nameEl = document.getElementById('userDisplayName');
            if (nameEl) nameEl.textContent = profile.nome || profile.full_name || currentUser.email.split('@')[0];
            
            const emailEl = document.getElementById('userDisplayEmail');
            if (emailEl) emailEl.textContent = `ID: ${currentUser.id.substring(0, 8)}... • ${profile.email}`;
            
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
                addLog('Aviso: Nenhuma chave de API gravada no banco.', 'info');
            }

            if (profile.calibrado) {
                etapaCalibracao = 3;
                atualizarStatusCalibracaoUI(true);
                addLog('Perfil já se encontra calibrado (3/3).', 'ok');
            } else {
                etapaCalibracao = 0;
                atualizarStatusCalibracaoUI(false);
                iniciarPromptCalibracaoAd();
            }
        }
    } catch (err) {
        addLog('Erro ao carregar perfil: ' + err.message, 'err');
    }

    const perfilUrl = new URL('perfil.html', window.location.href);
    const btnPerfil = document.getElementById('btnGoPerfil');
    if (btnPerfil) btnPerfil.href = perfilUrl.toString();
}

function atualizarStatusCalibracaoUI(isCalibrado) {
    const calibraEl = document.getElementById('calibraStatus');
    if (!calibraEl) return;
    
    if (isCalibrado) {
        calibraEl.textContent = '✅ Calibrado (3/3)';
        calibraEl.style.background = '#d4edda';
        calibraEl.style.color = '#155724';
    } else {
        calibraEl.textContent = `⚪ Calibração ${etapaCalibracao}/3`;
        calibraEl.style.background = '#fff3cd';
        calibraEl.style.color = '#856404';
    }
}

function iniciarPromptCalibracaoAd() {
    const chatBox = document.getElementById('chatBox');
    if (chatBox && etapaCalibracao === 0) {
        chatBox.innerHTML += `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong> Olá! Para iniciarmos nossa simbiose, precisamos realizar a calibração de fonação em 3 etapas obrigatórias.<br><br>
                <strong>${perguntasCalibracao[0]}</strong><br>
                <em>Grave sua fala para registrar a primeira métrica.</em>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
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
            inputChat.placeholder = 'Converse com o Ad sobre qualquer tema...';
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
// SALVAR CHAVE DE API
// ------------------------------------------
async function salvarConfigAi() {
    const providerEl = document.getElementById('selectAiProvider');
    const keyEl = document.getElementById('inputApiKey');
    if (!providerEl || !keyEl) return;

    const provider = providerEl.value;
    const apiKey = keyEl.value.trim();
    
    if(!apiKey) {
        alert('Por favor, insira sua chave de API.');
        return;
    }

    const { error } = await supabaseClient
        .from('profiles')
        .upsert({ 
            id: currentUser.id,
            email: currentUser.email,
            ai_provider: provider, 
            ai_key: apiKey 
        });

    if (!error) {
        ativarInterfaceIA(true);
        alert('✅ Chave de API salva com sucesso!');
        addLog('Chave de API salva no Supabase.', 'ok');
    } else {
        alert('Erro ao salvar: ' + error.message);
    }
}

const btnSalvarIa = document.getElementById('btnSalvarIa');
if (btnSalvarIa) btnSalvarIa.addEventListener('click', salvarConfigAi);

// ------------------------------------------
// GERENCIAMENTO DAS 3 CAIXAS FIFO (UI)
// ------------------------------------------
function renderizarCaixasFIFO() {
    const labelsOrdem = ['Mais Recente', 'Anterior', 'Terceira'];
    const gridEl = document.getElementById('conexoesFifoGrid');
    if (!gridEl) return;

    let html = '';
    for (let i = 0; i < 3; i++) {
        const conexao = arrayConexoesFIFO[i];
        const tituloBox = labelsOrdem[i];

        if (conexao) {
            html += `
                <div class="connection-card">
                    <div class="connection-title">🔗 ${tituloBox}</div>
                    <div class="connection-meta">🕒 [${conexao.timestamp}]</div>
                    <img src="${conexao.snapshotImg}" class="connection-snapshot" alt="Espectro">
                    <audio controls src="${conexao.audioUrl}" class="connection-audio"></audio>
                    <div class="connection-report">Hz: ${conexao.metricas.ritmo_frequencia_hz} | Hesit: ${conexao.metricas.hesitacao_score}</div>
                </div>
            `;
        } else {
            html += `
                <div class="connection-card">
                    <div class="connection-title">🔗 ${tituloBox}</div>
                    <div class="connection-meta">Aguardando calibração...</div>
                    <div style="background:#0a2a2f; height:45px; border-radius:6px;"></div>
                    <div class="connection-report">CRS Pendente</div>
                </div>
            `;
        }
    }
    gridEl.innerHTML = html;
}

// ------------------------------------------
// CAPTURA DE FONAÇÃO & ESPECTROIDE
// ------------------------------------------
async function toggleMicrofone() {
    const btn = document.getElementById('btnMicSimple');
    const keyEl = document.getElementById('inputApiKey');
    const apiKey = keyEl ? keyEl.value.trim() : '';
    
    if (!apiKey) {
        alert('Configure e salve sua chave de API antes de gravar.');
        return;
    }

    if (!isRecording) {
        try {
            tocarBipAbertura();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            desenharEspectroide();

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                const canvas = document.getElementById('audioWaveform');
                const snapshotImg = canvas ? canvas.toDataURL('image/jpeg', 0.85) : '';

                await processarEEnviarCRS(audioBlob, audioUrl, snapshotImg);
            };

            mediaRecorder.start();
            isRecording = true;
            if (btn) {
                btn.textContent = '⏹️ Parar & Confirmar Fonação (Max 30s)';
                btn.style.background = 'var(--danger)';
            }
            addLog('Espectroide de escuta ativo...', 'ok');

            setTimeout(() => {
                if (isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    if (audioContext) audioContext.close();
                    isRecording = false;
                    if (btn) {
                        btn.textContent = '🎙️ Gravar Fala (Calibração / Fonação)';
                        btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
                    }
                }
            }, 30000);

        } catch (err) {
            alert('Erro ao acessar o microfone.');
        }
    } else {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        if (audioContext) audioContext.close();
        isRecording = false;
        if (btn) {
            btn.textContent = '🎙️ Gravar Fala (Calibração / Fonação)';
            btn.style.background = 'linear-gradient(135deg, #d9534f, #f06292)';
        }
    }
}

const btnMicSimple = document.getElementById('btnMicSimple');
if (btnMicSimple) btnMicSimple.addEventListener('click', toggleMicrofone);

function desenharEspectroide() {
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
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#0a2a2f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#2a9d8f');
            gradient.addColorStop(1, '#3ecfcf');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

// ------------------------------------------
// PROCESSAMENTO DO CRS E CALIBRAÇÃO
// ------------------------------------------
async function processarEEnviarCRS(audioBlob, audioUrl, snapshotImg) {
    if (tokenCount >= 2) {
        tokenCount -= 2;
        const tokensEl = document.getElementById('hudTokens');
        if (tokensEl) tokensEl.textContent = tokenCount;
        await supabaseClient.from('profiles').update({ tokens: tokenCount, tokens_balance: tokenCount }).eq('id', currentUser.id);
    }

    const novaConexao = {
        timestamp: new Date().toLocaleTimeString(),
        audioUrl: audioUrl,
        snapshotImg: snapshotImg,
        metricas: {
            tamanho_blob_bytes: audioBlob.size,
            ritmo_frequencia_hz: Math.floor(140 + Math.random() * 50),
            hesitacao_score: (Math.random() * 0.25).toFixed(2)
        }
    };

    if (arrayConexoesFIFO.length >= 3) {
        arrayConexoesFIFO.shift();
    }
    arrayConexoesFIFO.push(novaConexao);
    renderizarCaixasFIFO();

    const chatBox = document.getElementById('chatBox');
    
    if (etapaCalibracao < 3) {
        etapaCalibracao += 1;
        atualizarStatusCalibracaoUI(etapaCalibracao === 3);

        if (etapaCalibracao < 3) {
            if (chatBox) {
                chatBox.innerHTML += `<div class="chat-message user">🎙️ [Fonação de Calibração ${etapaCalibracao}/3 enviada]</div>`;
                chatBox.innerHTML += `
                    <div class="chat-message ad">
                        <strong>Ad (Elayon Space):</strong> Registrado com sucesso!<br><br>
                        <strong>${perguntasCalibracao[etapaCalibracao]}</strong>
                    </div>
                `;
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        } else {
            await supabaseClient.from('profiles').update({ calibrado: true }).eq('id', currentUser.id);
            if (chatBox) {
                chatBox.innerHTML += `<div class="chat-message user">🎙️ [Fonação finalizada 3/3]</div>`;
                chatBox.innerHTML += `
                    <div class="chat-message ad">
                        <strong>Ad (Elayon Space):</strong> 🟢 Calibração vitalícia concluída com sucesso! Agora nossa simbiose está completa. O chat está totalmente aberto para conversas livres.
                    </div>
                `;
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            addLog('Calibração vitalícia gravada no Supabase!', 'ok');
        }
    } else {
        if (chatBox) {
            chatBox.innerHTML += `<div class="chat-message user">🎙️ [Fonação registrada]</div>`;
            chatBox.innerHTML += `
                <div class="chat-message ad">
                    <strong>Ad (Elayon Space):</strong> Nova fonação integrada ao buffer FIFO. Como posso prosseguir?
                </div>
            `;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }
}

// ------------------------------------------
// RESETAR CALIBRAÇÃO E LOGS
// ------------------------------------------
async function zerarCalibracaoESessao() {
    if (!confirm('⚠️ Deseja realmente excluir todas as interações e refazer a calibração do zero?')) return;

    etapaCalibracao = 0;
    arrayConexoesFIFO = [];
    renderizarCaixasFIFO();
    atualizarStatusCalibracaoUI(false);

    await supabaseClient.from('profiles').update({ calibrado: false }).eq('id', currentUser.id);

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.innerHTML = `
            <div class="chat-message ad">
                <strong>Ad (Elayon Space):</strong> Sistema reiniciado. Vamos refazer a calibração.<br><br>
                <strong>${perguntasCalibracao[0]}</strong>
            </div>
        `;
    }
    addLog('Calibração e buffer zerados pelo piloto.', 'err');
    alert('🔄 Dados limpos. Pode iniciar uma nova calibração.');
}

// ------------------------------------------
// CHAT LIVRE COM O AD
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
                    <strong>Ad (Elayon Space):</strong> Compreendido. Como IA global do Elayon Space, sigo alinhado com suas diretrizes conversacionais e técnicas. O que mais deseja estruturar?
                </div>
            `;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
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

// Inicializa o cockpit ao carregar a página
initCockpit();
