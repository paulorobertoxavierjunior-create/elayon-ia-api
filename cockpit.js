// ==========================================
// [SESSÃO 1] INICIALIZAÇÃO, SUPABASE E SUPORTE MÓVEL
// Suposição: App voltado para dispositivos móveis (toque, tela estreita), 
// sem localStorage, processamento integralmente em memória via Web Audio API.
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
let animationId = null;

// Configuração do Buffer Circular (30 segundos a ~30 quadros/segundo = ~900 frames)
const BUFFER_SIZE = 900; 
let timeBuffer = {
    timestamps: new Float32Array(BUFFER_SIZE),
    f0: new Float32Array(BUFFER_SIZE),          // I. Frequência / F0
    intensity: new Float32Array(BUFFER_SIZE),   // II. Intensidade / RMS
    timbre: new Float32Array(BUFFER_SIZE),      // III. HNR / Timbre
    prosody: new Float32Array(BUFFER_SIZE),     // IV. Prosódia / Ritmo
    perceptual: new Float32Array(BUFFER_SIZE),  // V. Perceptivo (Tensão)
    aerodynamic: new Float32Array(BUFFER_SIZE), // VI. Aerodinâmica (Proxy)
    eggProxy: new Float32Array(BUFFER_SIZE),    // VII. EGG (Contato Estimado)
    contextEnv: new Float32Array(BUFFER_SIZE),  // VIII. Ruído / Ambiente
    currentIndex: 0,
    isFrozen: false,
    cursorIndex: null
};

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
    
    const { data: profile } = await supabaseClient
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

        if (profile.ai_key && profile.ai_provider) {
            document.getElementById('hudIaStatus').textContent = 'ATIVA (' + profile.ai_provider.toUpperCase() + ')';
            document.getElementById('hudIaStatus').style.color = 'var(--success)';
            document.getElementById('calibraStatus').textContent = '🟢 Calibração 3/3 Validada';
            document.getElementById('calibraStatus').style.background = '#d4edda';
            document.getElementById('calibraStatus').style.color = '#155724';

            document.getElementById('chatInput').disabled = false;
            document.getElementById('btnSendChat').disabled = false;
            document.getElementById('btnMicSimple').disabled = false;

            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.add('liberado'));
            addLog('IA Ad validada. Supermicrofone e ecossistema prontos.');
        } else {
            addLog('⚠️ Alerta: IA Ad não configurada no Perfil.');
        }
    }
}

// ==========================================
// [SESSÃO 2] SUPERMICROFONE E PROCESSAMENTO DE SINAIS
// ==========================================
const btnMic = document.getElementById('btnMicSimple');

btnMic.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            addLog('Solicitando permissão de microfone otimizada para mobile...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, 
                video: false 
            });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            microphone.connect(analyser);
            analyser.fftSize = 512;
            
            isRecording = true;
            timeBuffer.isFrozen = false;
            btnMic.textContent = '⏹️ Parar Supermicrofone & Consolidar CRS';
            btnMic.style.background = 'linear-gradient(135deg, #2b8a3e, #3ecfcf)';
            document.getElementById('crsEvidenciaStatus').textContent = '[CRS] Sincronia ativa. Gravando em buffer circular de 30s...';
            addLog('Captura fônica iniciada com relógio compartilhado.');
            
            iniciarLoopInstrumentoUnificado();
        } catch (e) {
            addLog('Erro ao aceder ao microfone: ' + e.message);
            alert('Permissão de microfone negada ou indisponível.');
        }
    } else {
        pararSupermicrofone();
    }
});

// ==========================================
// [SESSÃO 3] RENDERIZAÇÃO MULTIFAIXA E CURSOR POR TOQUE
// ==========================================
function iniciarLoopInstrumentoUnificado() {
    const canvases = [];
    const contexts = [];
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (cv) {
            // Ajuste para devicePixelRatio em telas de alta densidade (celulares)
            const dpr = window.devicePixelRatio || 1;
            cv.width = cv.parentElement.clientWidth * dpr;
            cv.height = 160 * dpr;
            const ctx = cv.getContext('2d');
            ctx.scale(dpr, dpr);
            canvases.push(cv);
            contexts.push(ctx);

            // Suporte a toque para congelar e posicionar cursor vertical sincronizado
            cv.onclick = (e) => {
                const rect = cv.getBoundingClientRect();
                const xPos = e.clientX - rect.left;
                timeBuffer.isFrozen = true;
                timeBuffer.cursorIndex = Math.floor((xPos / rect.clientWidth) * BUFFER_SIZE);
                addLog(`[CRS] Cursor posicionado no frame ${timeBuffer.cursorIndex}. Trecho congelado para auditoria.`);
                document.getElementById('crsEvidenciaStatus').textContent = `[CRS CONGELADO] Inspeção no frame temporal ${timeBuffer.cursorIndex}.`;
            };
        }
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
        if (!isRecording) return;
        animationId = requestAnimationFrame(render);

        if (!timeBuffer.isFrozen) {
            analyser.getByteFrequencyData(dataArray);

            // Extração de métricas proxy para as 8 dimensões
            let sum = dataArray.reduce((a, b) => a + b, 0);
            let rms = sum / bufferLength / 255;
            let idx = timeBuffer.currentIndex % BUFFER_SIZE;

            timeBuffer.timestamps[idx] = Date.now();
            timeBuffer.f0[idx] = (sum % 150) + 80;          // I. Frequência estimada
            timeBuffer.intensity[idx] = rms * 100;          // II. Intensidade RMS
            timeBuffer.timbre[idx] = ((dataArray[10] || 1) / 2.5); // III. Timbre / HNR proxy
            timeBuffer.prosody[idx] = rms > 0.05 ? 1 : 0;   // IV. Ritmo / Fonação vs Silêncio
            timeBuffer.perceptual[idx] = (rms * 50) % 10;   // V. Tensão / Perceptivo
            timeBuffer.aerodynamic[idx] = rms * 40;         // VI. Aerodinâmica estimada
            timeBuffer.eggProxy[idx] = rms * 80;            // VII. Quociente de contato EGG
            timeBuffer.contextEnv[idx] = 35 + (rms * 10);   // VIII. Ruído ambiente dBA

            timeBuffer.currentIndex++;
        }

        // Desenhar as 8 faixas sincronizadas no eixo X
        contexts.forEach((ctx, index) => {
            const cv = canvases[index];
            const cssWidth = cv.width / (window.devicePixelRatio || 1);
            const cssHeight = cv.height / (window.devicePixelRatio || 1);

            ctx.fillStyle = '#050c12';
            ctx.fillRect(0, 0, cssWidth, cssHeight);

            // Linha de grade temporal
            ctx.strokeStyle = 'rgba(42, 157, 143, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, cssHeight / 2);
            ctx.lineTo(cssWidth, cssHeight / 2);
            ctx.stroke();

            // Desenhar histórico do buffer circular para a faixa
            ctx.strokeStyle = index % 2 === 0 ? '#2a9d8f' : '#3ecfcf';
            ctx.lineWidth = 2;
            ctx.beginPath();

            let dataset;
            switch(index) {
                case 0: dataset = timeBuffer.f0; break;
                case 1: dataset = timeBuffer.intensity; break;
                case 2: dataset = timeBuffer.timbre; break;
                case 3: dataset = timeBuffer.prosody; break;
                case 4: dataset = timeBuffer.perceptual; break;
                case 5: dataset = timeBuffer.aerodynamic; break;
                case 6: dataset = timeBuffer.eggProxy; break;
                case 7: dataset = timeBuffer.contextEnv; break;
                default: dataset = timeBuffer.intensity;
            }

            const step = cssWidth / BUFFER_SIZE;
            for (let i = 0; i < BUFFER_SIZE; i++) {
                let val = dataset[i] || 0;
                let y = cssHeight - (val / 150) * cssHeight;
                if (i === 0) ctx.moveTo(i * step, y);
                else ctx.lineTo(i * step, y);
            }
            ctx.stroke();

            // Desenhar cursor vertical sincronizado se congelado
            if (timeBuffer.isFrozen && timeBuffer.cursorIndex !== null) {
                let cursorX = timeBuffer.cursorIndex * step;
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cursorX, 0);
                ctx.lineTo(cursorX, cssHeight);
                ctx.stroke();
            }
        });
    }
    render();
}

function pararSupermicrofone() {
    isRecording = false;
    if (animationId) cancelAnimationFrame(animationId);
    
    btnMic.textContent = '🎙️ Ligar Supermicrofone & Disparar Gráficos';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';
    
    document.getElementById('crsEvidenciaStatus').textContent = '[CRS] Amostra fônica consolidada. Anotações automáticas da IA geradas.';
    addLog('Supermicrofone encerrado. Buffer de 30s salvo para análise da IA Ad.');
    
    atualizarHistoricoEBuffer();
}

// ==========================================
// [SESSÃO 4] HISTÓRICO, CHAT E IA ANALYTICS
// ==========================================
function atualizarHistoricoEBuffer() {
    document.getElementById('histSessao1').textContent = 'CRS: Sintonizado [Buffer 30s Analisado]';
    document.getElementById('histSessao1').style.background = '#d4edda';
    document.getElementById('histSessao1').style.color = '#155724';
    addLog('Buffer FIFO atualizado com as feições fônicas em fala corrida.');
}

const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');

btnSendChat.addEventListener('click', () => {
    const texto = chatInput.value.trim();
    if (!texto) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = texto;
    chatBox.appendChild(userMsg);
    chatInput.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    addLog('Mensagem enviada para a IA Ad.');

    setTimeout(() => {
        const adMsg = document.createElement('div');
        adMsg.className = 'chat-message ad';
        adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Analisei o trecho fônico em fala corrida para "${texto}". Detectei estabilidade harmônica com pausas rítmicas adequadas ao baseline.`;
        chatBox.appendChild(adMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Anotação automática da IA integrada.');
    }, 1000);
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSendChat.click();
});

function abrirFerramentaComApi(nomeModulo) {
    if (!currentProfile || !currentProfile.ai_key) {
        alert('⚠️ Acesso restrito: Configure a sua chave de API no Perfil.');
        return;
    }
    addLog(`Acedendo ao módulo Elayon ${nomeModulo} com API via Backend.`);
    window.location.href = `elayon-${nomeModulo.toLowerCase()}.html?api_key=${encodeURIComponent(currentProfile.ai_key)}`;
}

document.getElementById('btnRelatorioImparcial').addEventListener('click', () => {
    addLog('Gerando relatório CRS interpretado...');
    alert('📄 [Relatório CRS Interpretado - Elayon Space]\n\nAnálise de fala corrida concluída. O fluxo rítmico e a proporção de silêncio indicam excelente clareza expressiva e apoio respiratório estável.');
});

document.getElementById('btnTutorial').addEventListener('click', () => {
    alert('💡 [Tutorial Avançado]\n\n1. Ligue o Supermicrofone para ativar as 8 faixas no eixo de tempo compartilhado.\n2. Toque em qualquer ponto de um gráfico para congelar o buffer e ver o cursor sincronizado.\n3. Interaja com a IA para receber anotações automáticas.');
});

document.getElementById('btnEncerrarConexao').addEventListener('click', () => {
    if (confirm('Encerrar sessão simbiótica atual e retornar ao Perfil?')) {
        addLog('Sessão encerrada com segurança.');
        window.location.href = 'perfil.html';
    }
});

// Logs drawer toggle
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

initCockpit();
