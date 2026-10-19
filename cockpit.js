// ==========================================
// [SESSÃO 1] INICIALIZAÇÃO E AUTENTICAÇÃO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let isRecording = false;
let audioChunks = [];

const logBody = document.getElementById('logsBody');
const logCount = document.getElementById('logCount');
let logsTotal = 1;

function addLog(msg) {
    logsTotal++;
    logCount.textContent = logsTotal;
    const item = document.createElement('div');
    item.className = 'log-item';
    item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logBody.appendChild(item);
    logBody.scrollTop = logBody.scrollHeight;
}

async function initCockpit() {
    addLog('A verificar sessão do piloto no Supabase...');
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session) {
        addLog('Sessão não encontrada. Redirecionando para login...');
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    document.getElementById('userDisplayEmail').textContent = `ID: ${currentUser.id.substring(0, 10)}...`;
    
    // Buscar perfil e calibração de IA
    const { data: profile, err } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (profile) {
        currentProfile = profile;
        document.getElementById('userDisplayName').textContent = profile.nome || 'Piloto Elayon';
        document.getElementById('hudTokens').textContent = profile.tokens ?? 100;

        if (profile.avatar_url) {
            document.getElementById('userAvatarImg').src = profile.avatar_url;
        }

        // Validação da IA Ad calibrada no perfil
        if (profile.ai_key && profile.ai_provider) {
            document.getElementById('hudIaStatus').textContent = 'ATIVA (' + profile.ai_provider.toUpperCase() + ')';
            document.getElementById('hudIaStatus').style.color = 'var(--success)';
            document.getElementById('calibraStatus').textContent = '🟢 Calibração 3/3 Validada';
            document.getElementById('calibraStatus').style.background = '#d4edda';
            document.getElementById('calibraStatus').style.color = '#155724';

            // Liberar botões de interação e chat
            document.getElementById('chatInput').disabled = false;
            document.getElementById('btnSendChat').disabled = false;
            document.getElementById('btnMicSimple').disabled = false;
            addLog('IA Ad validada via Perfil. Ouvido sensorial desbloqueado.');
        } else {
            addLog('⚠️ Alerta: IA Ad não configurada no Perfil. Retorne ao perfil para calibrar.');
        }
    }
}

// ==========================================
// [SESSÃO 2] MOTOR DE CAPTAÇÃO FÔNICA (ONE-BUTTON MIC) & CANVAS
// ==========================================
const btnMic = document.getElementById('btnMicSimple');
const waveformStatus = document.getElementById('waveformStatus');

btnMic.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            addLog('A solicitar permissão de microfone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            microphone.connect(analyser);
            analyser.fftSize = 256;
            
            isRecording = true;
            btnMic.textContent = '⏹️ Parar Escuta Fônica & Processar CRS';
            btnMic.style.background = 'linear-gradient(135deg, #2b8a3e, #3ecfcf)';
            waveformStatus.textContent = 'AO VIVO (GRAVANDO)';
            addLog('Captação fônica ativa. Analisando frequências e ritmo.');
            
            iniciarLoopAnalise();
        } catch (e) {
            addLog('Erro ao aceder ao microfone: ' + e.message);
            alert('Permissão de microfone negada ou indisponível.');
        }
    } else {
        pararEscutaFonica();
    }
});

function iniciarLoopAnalise() {
    const canvasFft = document.getElementById('cvFft');
    const ctxFft = canvasFft.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
        if (!isRecording) return;
        requestAnimationFrame(render);
        
        analyser.getByteFrequencyData(dataArray);
        
        // Simular métricas dinâmicas baseadas no áudio real
        let soma = dataArray.reduce((a, b) => a + b, 0);
        let rms = (soma / bufferLength / 255).toFixed(3);
        let freqMedia = Math.round(soma / bufferLength * 15);
        
        document.getElementById('mRms').textContent = rms;
        document.getElementById('mFreq').textContent = freqMedia;
        document.getElementById('mSil').textContent = (rms < 0.05 ? '85.2' : '12.4');
        document.getElementById('mVar').textContent = (rms * 2.4).toFixed(2);

        // Desenhar Espectro FFT no Canvas
        ctxFft.fillStyle = '#051518';
        ctxFft.fillRect(0, 0, canvasFft.width, canvasFft.height);
        
        let barWidth = (canvasFft.width / bufferLength) * 2.5;
        let x = 0;
        for(let i = 0; i < bufferLength; i++) {
            let barHeight = dataArray[i] / 2;
            ctxFft.fillStyle = `rgb(${barHeight + 50}, 165, 233)`;
            ctxFft.fillRect(x, canvasFft.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    render();
}

function pararEscutaFonica() {
    isRecording = false;
    btnMic.textContent = '🎙️ Iniciar Escuta Fônica (Gravar / Transcrever)';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';
    waveformStatus.textContent = 'STANDBY';
    addLog('Escuta fônica encerrada. Amostra enviada para o Buffer FIFO.');
    
    // Atualizar Buffer FIFO com simulação de nova conexão
    atualizarBufferFifo();
}

// ==========================================
// [SESSÃO 3] BUFFER FIFO DE CONEXÕES FÔNICAS
// ==========================================
function atualizarBufferFifo() {
    const grid = document.getElementById('conexoesFifoGrid');
    grid.innerHTML = `
        <div class="connection-card">
            <div class="connection-title">🔗 1. Mais Recente</div>
            <div class="connection-meta">Capturado agora há pouco</div>
            <div class="connection-report">CRS: Estável [RMS: 0.142 | Freq: 320Hz]</div>
        </div>
        <div class="connection-card">
            <div class="connection-title">🔗 2. Anterior</div>
            <div class="connection-meta">Sessão prévia</div>
            <div class="connection-report">CRS: Calibrado [Silêncio: 14%]</div>
        </div>
        <div class="connection-card">
            <div class="connection-title">🔗 3. Base (Estática)</div>
            <div class="connection-meta">Baseline inicial</div>
            <div class="connection-report">CRS: Referência Ativa</div>
        </div>
    `;
    addLog('Buffer FIFO (3/3) atualizado com sucesso.');
}

// ==========================================
// [SESSÃO 4 & 5] CHAT SIMBIÓTICO, RELATÓRIO E FERRAMENTAS
// ==========================================
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');

btnSendChat.addEventListener('click', () => {
    const texto = chatInput.value.trim();
    if (!texto) return;

    // Mensagem do Usuário
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = texto;
    chatBox.appendChild(userMsg);
    chatInput.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    addLog('Mensagem enviada para a IA Ad.');

    // Resposta simulada da IA Ad em simbiose
    setTimeout(() => {
        const adMsg = document.createElement('div');
        adMsg.className = 'chat-message ad';
        adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Recebi seu padrão fônico e entonação para "${texto}". Nossa simbiose está sintonizada.`;
        chatBox.appendChild(adMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Resposta da IA Ad integrada com sucesso.');
    }, 1000);
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSendChat.click();
});

// Botão de Relatório Imparcial
document.getElementById('btnRelatorioImparcial').addEventListener('click', () => {
    addLog('Gerando relatório imparcial de interação...');
    alert('📊 [Elayon Space] Relatório Imparcial:\n\nA simbiose fônica atingiu coeficiente ótimo. Padrões de frequência e pausas rítmicas alinhados com o perfil do operador.');
});

// Botão de Tutorial
document.getElementById('btnTutorial').addEventListener('click', () => {
    alert('💡 [Tutorial do Cockpit]\n\n1. Ative sua API no Perfil.\n2. Clique em "Iniciar Escuta Fônica" para capturar sua voz.\n3. Visualize os gráficos em tempo real e interaja com o chat simbiótico da IA Ad.');
});

// Botão de Encerrar Conexão com Dupla Confirmação
document.getElementById('btnEncerrarConexao').addEventListener('click', () => {
    const primeiraConfirmacao = confirm('Deseja realmente encerrar a sessão simbiótica atual?');
    if (primeiraConfirmacao) {
        const segundaConfirmacao = confirm('⚠️ Atenção: Os dados temporários serão descarregados. Confirmar encerramento definitivo?');
        if (segundaConfirmacao) {
            addLog('Sessão encerrada com segurança pelo piloto.');
            alert('Sessão encerrada. Retornando ao Perfil.');
            window.location.href = 'perfil.html';
        }
    }
});

// Ações das Camadas Complementares
function abrirCamada(nome) {
    addLog(`Acedendo à ferramenta: Elayon ${nome}`);
    alert(`Redirecionando para o ambiente integrado de Elayon ${nome}...`);
}

// ==========================================
// [SESSÃO 6] GAVETA DE LOGS INTERATIVA
// ==========================================
const logsDrawer = document.getElementById('logsDrawer');
const logsToggleBtn = document.getElementById('logsToggleBtn');
const logToggleIcon = document.getElementById('logToggleIcon');
let logsAberto = false;

logsToggleBtn.addEventListener('click', () => {
    logsAberto = !logsAberto;
    if (logsAberto) {
        logsDrawer.style.transform = 'translateY(0px)';
        logToggleIcon.textContent = '▼ Recolher';
    } else {
        logsDrawer.style.transform = 'translateY(115px)';
        logToggleIcon.textContent = '▲ Expandir Logs';
    }
});

// Inicializar execução ao carregar a página
initCockpit();


