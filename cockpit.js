// ==========================================================================
// [ELAYON SPACE] MOTOR CLÍNICO SIMBIÓTICO • PARTE 1 (ÁUDIO & SÉRIE TEMPORAL)
// ==========================================================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6Inhsa3FnZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentTokens = 95;
let etapasCalibracaoVoz = 1;
let bufferSessoesFifo = [];

let audioCtx = null;
let analyser = null;
let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let metricsInterval = null;

let tempoDecorrido = 0;
let timerContador = null;
let transcricaoBrutaIpsisLiteris = "";
let recognitionInstance = null;
let keepRecognitionAlive = false;

// Séries temporais estilo Teste 10.1 (Acumulam no tempo)
let serieTemporalAtual = [];
let amostrasPorSegundoSessao = [];
let ultimoAudioBase64 = null;
let ultimoBlobAudio = null;

function addLog(msg) {
    const logBody = document.getElementById('logsBody');
    const logCount = document.getElementById('logCount');
    if (logBody) {
        const item = document.createElement('div');
        item.style.padding = "2px 0";
        item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logBody.appendChild(item);
        logBody.scrollTop = logBody.scrollHeight;
        if (logCount) logCount.textContent = logBody.children.length;
    }
    console.log(`[ELAYON 10.2] ${msg}`);
}

async function initCockpit() {
    addLog('Inicializando ecossistema com linha temporal viva...');
    document.getElementById('userDisplayName').textContent = 'Paulo Xavier';
    document.getElementById('userDisplayEmail').textContent = `ID: c708823f-a48a-41f0-948f-287eee484821`;
    document.getElementById('hudTokens').textContent = currentTokens;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();

            if (profile) {
                currentTokens = profile.tokens ?? 95;
                document.getElementById('hudTokens').textContent = currentTokens;
                if (profile.nome) document.getElementById('userDisplayName').textContent = profile.nome;
                if (profile.avatar_url) document.getElementById('userAvatarImg').src = profile.avatar_url;
            }
        }
    } catch (e) {
        addLog('Modo local resiliente ativo.');
    }

    await carregarBufferFifoDoBanco();
    desenharTodasEstantesVazias();
}

// Apresentação por Voz da IA Global
document.getElementById('btnLigarIaGlobal')?.addEventListener('click', () => {
    const msgApresentacao = "Olá, Paulo! Aqui é a IA Global dos Sistemas Elayon Space. Linha temporal ativada. Vamos iniciar a captação fônica crua.";
    falarTextoComSintoniaVoz(msgApresentacao, 1.0, 1.0);
    addLog('IA Global acionada.');
});

// Transcrição Ipsis Literis (Sem filtros ou correções)
function iniciarReconhecimentoIpsisLiteris() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'pt-BR';
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = true;

    recognitionInstance.onresult = (event) => {
        let parcial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcricaoBrutaIpsisLiteris += event.results[i][0].transcript + " ";
            } else {
                parcial += event.results[i][0].transcript;
            }
        }
        document.getElementById('txtTranscricaoEditavel').value = (transcricaoBrutaIpsisLiteris + " " + parcial);
    };

    recognitionInstance.onend = () => {
        if (keepRecognitionAlive && isRecording && tempoDecorrido < 30) {
            try { recognitionInstance.start(); } catch(e) {}
        }
    };

    keepRecognitionAlive = true;
    try { recognitionInstance.start(); } catch(e) {}
}

// Botão do Supermicrofone (Não abate token até confirmar)
const btnMic = document.getElementById('btnMicSimple');
if (btnMic) {
    btnMic.addEventListener('click', async () => {
        if (!isRecording) {
            addLog('Iniciando captação de 30s (Tokens intactos até confirmação).');

            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                const source = audioCtx.createMediaStreamSource(micStream);
                source.connect(analyser);
                analyser.fftSize = 256;

                audioChunks = [];
                mediaRecorder = new MediaRecorder(micStream);
                mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                mediaRecorder.start();

                isRecording = true;
                tempoDecorrido = 0;
                transcricaoBrutaIpsisLiteris = "";
                serieTemporalAtual = [];
                amostrasPorSegundoSessao = [];
                document.getElementById('txtTranscricaoEditavel').value = "";
                
                ocultarAcoesValidacao();

                btnMic.textContent = `⏹️ Gravando (0s / 30s max)... (Clique para Encerrar)`;
                btnMic.style.background = 'linear-gradient(135deg, #e63946, #ff7b00)';

                iniciarReconhecimentoIpsisLiteris();

                // Amostragem rítmica a cada 1 segundo (Estilo Teste 10.1)
                metricsInterval = setInterval(() => {
                    if (!isRecording) return;
                    tempoDecorrido++;

                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(dataArray);
                    let sum = dataArray.reduce((a, b) => a + b, 0);
                    let rms = (sum / (dataArray.length || 1) / 255);

                    const quadro = {
                        segundo: tempoDecorrido,
                        graves: Math.round((sum % 110) + 95),
                        medios: Math.round(rms * 80 + 20),
                        agudos: Math.round(rms * 60 + 15),
                        ruido: rms < 0.05 ? 15 : Math.round(rms * 40),
                        estabilidade: Math.round(85 - rms * 15)
                    };

                    serieTemporalAtual.push(quadro);
                    amostrasPorSegundoSessao.push(quadro);

                    // Desenha os gráficos em tempo real acumulando no canvas
                    desenharSerieNasEstantes(serieTemporalAtual);

                    btnMic.textContent = `⏹️ Gravando (${tempoDecorrido}s / 30s max)... (Clique para Encerrar)`;
                    if (tempoDecorrido >= 30) encerrarParaValidacao();
                }, 1000);

            } catch (e) {
                addLog('Erro no microfone: ' + e.message);
                alert('Permita o uso do microfone.');
            }
        } else {
            encerrarParaValidacao();
        }
    });
}

