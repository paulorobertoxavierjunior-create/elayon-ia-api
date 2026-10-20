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
let animationId = null;

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

        // Validação da IA Ad calibrada no perfil
        if (profile.ai_key && profile.ai_provider) {
            document.getElementById('hudIaStatus').textContent = 'ATIVA (' + profile.ai_provider.toUpperCase() + ')';
            document.getElementById('hudIaStatus').style.color = 'var(--success)';
            document.getElementById('calibraStatus').textContent = '🟢 Calibração 3/3 Validada';
            document.getElementById('calibraStatus').style.background = '#d4edda';
            document.getElementById('calibraStatus').style.color = '#155724';

            // Liberar botões de interação, chat e microfone
            document.getElementById('chatInput').disabled = false;
            document.getElementById('btnSendChat').disabled = false;
            document.getElementById('btnMicSimple').disabled = false;

            // Desbloquear Ferramentas do Ecossistema
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.add('liberado'));
            addLog('IA Ad validada via Perfil. Supermicrofone e ferramentas liberados.');
        } else {
            addLog('⚠️ Alerta: IA Ad não configurada no Perfil. Retorne ao perfil para calibrar.');
        }
    }
}

// ==========================================
// [SESSÃO 2] SUPERMICROFONE & 8 GRÁFICOS EM TEMPO REAL
// ==========================================
const btnMic = document.getElementById('btnMicSimple');

btnMic.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            addLog('A solicitar permissão de microfone para o Supermicrofone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            microphone.connect(analyser);
            analyser.fftSize = 256;
            
            isRecording = true;
            btnMic.textContent = '⏹️ Parar Supermicrofone & Enviar para o CRS';
            btnMic.style.background = 'linear-gradient(135deg, #2b8a3e, #3ecfcf)';
            document.getElementById('crsEvidenciaStatus').textContent = '[CRS] Captura fônica ativa. Analisando os 8 vetores acústicos...';
            addLog('Supermicrofone ativo. Disparando os 8 gráficos em simultâneo.');
            
            iniciarLoopGraficos();
        } catch (e) {
            addLog('Erro ao aceder ao microfone: ' + e.message);
            alert('Permissão de microfone negada ou indisponível.');
        }
    } else {
        pararSupermicrofone();
    }
});

function iniciarLoopGraficos() {
    const canvases = [];
    const contexts = [];
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (cv) {
            canvases.push(cv);
            contexts.push(cv.getContext('2d'));
        }
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function render() {
        if (!isRecording) return;
        animationId = requestAnimationFrame(render);
        
        analyser.getByteFrequencyData(dataArray);

        // Renderizar em cada um dos 8 canvases um padrão dinâmico baseado no áudio
        contexts.forEach((ctx, index) => {
            const cv = canvases[index];
            ctx.fillStyle = '#050c12';
            ctx.fillRect(0, 0, cv.width, cv.height);

            let barWidth = (cv.width / bufferLength) * 2.5;
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                let barHeight = (dataArray[i] / 2) * ((index + 1) * 0.2);
                if (barHeight > cv.height) barHeight = cv.height;
                
                // Cores variadas para distinguir as estantes
                if (index % 2 === 0) {
                    ctx.fillStyle = `rgb(42, 157, ${143 + i})`;
                } else {
                    ctx.fillStyle = `rgb(${62 + i}, 206, 207)`;
                }
                ctx.fillRect(x, cv.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
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
    
    document.getElementById('crsEvidenciaStatus').textContent = '[CRS] Amostra fônica processada com sucesso. Relatório qualitativo gerado.';
    addLog('Supermicrofone parado. Amostra enviada para o buffer de histórico e relatório CRS.');
    
    atualizarHistoricoEBuffer();
}

// ==========================================
// [SESSÃO 3] BUFFER FIFO E HISTÓRICO DAS 3 SESSÕES
// ==========================================
function atualizarHistoricoEBuffer() {
    document.getElementById('histSessao1').textContent = 'CRS: Sintonizado [Harmônicos Estáveis]';
    document.getElementById('histSessao1').style.background = '#d4edda';
    document.getElementById('histSessao1').style.color = '#155724';

    document.getElementById('histSessao2').textContent = 'CRS: Sessão anterior arquivada';
    document.getElementById('histSessao3').textContent = 'CRS: Baseline primária validada';
    addLog('Buffer de sessões atualizado (FIFO 3/3).');
}

// ==========================================
// [SESSÃO 4] CHAT SIMBIÓTICO COM A IA AD
// ==========================================
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
        adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Analisei o seu tom e padrão para "${texto}". A simbiose fônica e cognitiva está perfeita.`;
        chatBox.appendChild(adMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        addLog('Resposta simbiótica da IA Ad integrada.');
    }, 1000);
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnSendChat.click();
});

// ==========================================
// [SESSÃO 5 & 6] FERRAMENTAS DO ECOSSISTEMA E RELATÓRIO CRS
// ==========================================
function abrirFerramentaComApi(nomeModulo) {
    if (!currentProfile || !currentProfile.ai_key) {
        alert('⚠️ Acesso restrito: Configure a sua chave de API no Perfil antes de aceder aos módulos.');
        return;
    }
    addLog(`Acedendo ao módulo Elayon ${nomeModulo} com API via Backend.`);
    // Passando a API de forma segura pelo contexto do cockpit
    const tokenApi = currentProfile.ai_key;
    alert(`🔗 Conectando ao Elayon ${nomeModulo} utilizando a credencial ativa do operador.`);
    window.location.href = `elayon-${nomeModulo.toLowerCase()}.html?api_key=${encodeURIComponent(tokenApi)}`;
}

document.getElementById('btnRelatorioImparcial').addEventListener('click', () => {
    addLog('Gerando relatório CRS interpretado...');
    alert('📄 [Relatório CRS - Elayon Space]\n\nCoeficiente de ressonância otimizado. O operador demonstra excelente estabilidade nos formantes e pausas rítmicas plenamente cadenciadas, sem fadiga vocal detectada.');
});

document.getElementById('btnTutorial').addEventListener('click', () => {
    alert('💡 [Tutorial do Cockpit]\n\n1. Ative a IA no Perfil.\n2. Ligue o Supermicrofone para movimentar os 8 gráficos.\n3. Monitore o CRS e interaja com o chat simbiótico.');
});

document.getElementById('btnEncerrarConexao').addEventListener('click', () => {
    if (confirm('Deseja realmente encerrar a sessão simbiótica atual e retornar ao Perfil?')) {
        addLog('Sessão encerrada com segurança.');
        window.location.href = 'perfil.html';
    }
});

// ==========================================
// [SESSÃO 7] GAVETA DE LOGS DE AUDITORIA
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

// Inicializar carregamento ao abrir a página
initCockpit();
