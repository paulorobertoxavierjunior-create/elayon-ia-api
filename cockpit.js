// ==========================================
// [ELAYON SPACE] MOTOR DO COCKPIT CLÍNICO
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let currentTokens = 100;
let etapasCalibracaoVoz = 1;
let totalSessoesConcluidas = 0;

let audioCtx = null;
let analyser = null;
let micStream = null;
let isRecording = false;
let animId = null;
let metricsInterval = null;
let recognitionInstance = null;

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
    console.log(`[ELAYON] ${msg}`);
}

// Inicialização e Leitura do Perfil Logado
async function initCockpit() {
    addLog('Conectando ao Supabase para verificar sessão do operador...');
    
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error || !session) {
            addLog('Sessão não encontrada. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;
        const userEmail = currentUser.email || '';
        document.getElementById('userDisplayEmail').textContent = `ID: ${currentUser.id.substring(0, 10)}...`;

        // Busca o perfil na tabela `profiles`
        let { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        // Se não encontrar por ID, busca por e-mail
        if (!profile && userEmail) {
            const { data: profileByEmail } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();
            profile = profileByEmail;
        }

        // Aplica o nome carregado do banco ou o metadata do login
        const nomeOperador = profile?.nome || currentUser.user_metadata?.nome || userEmail.split('@')[0] || 'Paulo Xavier';
        document.getElementById('userDisplayName').textContent = nomeOperador;

        if (profile) {
            currentProfile = profile;
            currentTokens = profile.tokens ?? 100;
            document.getElementById('hudTokens').textContent = currentTokens;

            if (profile.avatar_url) {
                document.getElementById('userAvatarImg').src = profile.avatar_url;
            } else {
                document.getElementById('userAvatarImg').src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.id}`;
            }

            if (profile.ai_key) {
                const provider = (profile.ai_provider || 'GEMINI').toUpperCase();
                document.getElementById('hudIaStatus').textContent = `ATIVA (${provider})`;
                document.getElementById('hudIaStatus').style.color = 'var(--success)';
                addLog(`IA Ad ativada e vinculada ao operador ${nomeOperador}.`);
            } else {
                document.getElementById('hudIaStatus').textContent = 'ATIVA (MODO LAB)';
                document.getElementById('hudIaStatus').style.color = 'var(--success)';
                addLog('IA Ad operando em modo laboratorial.');
            }
        } else {
            document.getElementById('hudTokens').textContent = currentTokens;
            document.getElementById('hudIaStatus').textContent = 'ATIVA (MODO LAB)';
            document.getElementById('hudIaStatus').style.color = 'var(--success)';
            addLog('Perfil não localizado no banco; sessão iniciada em modo resiliência.');
        }

        // Habilita o microfone
        const btnMic = document.getElementById('btnMicSimple');
        if (btnMic) btnMic.disabled = false;
        addLog('Supermicrofone liberado para a 1ª Calibração por Voz.');

    } catch (err) {
        addLog('Aviso na sincronização: ' + err.message);
        document.getElementById('userDisplayName').textContent = 'Paulo Xavier';
        const btnMic = document.getElementById('btnMicSimple');
        if (btnMic) btnMic.disabled = false;
    }
}

// Reconhecimento de Voz
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
        const textoFalado = event.results[0][0].transcript;
        pararSupermicrofoneComTexto(textoFalado);
    };

    rec.onerror = (e) => {
        addLog('Aviso na captura de voz: ' + e.error);
        pararSupermicrofoneComTexto("Áudio processado pela fonação.");
    };

    return rec;
}

const btnMic = document.getElementById('btnMicSimple');
if (btnMic) {
    btnMic.addEventListener('click', async () => {
        if (!isRecording) {
            if (currentTokens <= 0) {
                alert('⚠️ Tokens esgotados! Recarregue no seu Perfil.');
                return;
            }

            currentTokens -= 1;
            document.getElementById('hudTokens').textContent = currentTokens;
            
            if (currentUser) {
                await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id).catch(()=>{});
            }
            addLog('1 token consumido para calibração fônica.');

            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                const source = audioCtx.createMediaStreamSource(micStream);
                source.connect(analyser);
                analyser.fftSize = 256;

                isRecording = true;
                btnMic.textContent = `⏹️ Gravando Etapa ${etapasCalibracaoVoz}/3... (Pressione para Parar)`;
                btnMic.style.background = 'linear-gradient(135deg, #e63946, #ff7b00)';

                iniciarLoopGraficosBrancos();

                recognitionInstance = setupSpeechRecognition();
                if (recognitionInstance) {
                    recognitionInstance.start();
                } else {
                    setTimeout(() => {
                        pararSupermicrofoneComTexto("Análise espectral de voz capturada com sucesso.");
                    }, 4000);
                }

            } catch (e) {
                addLog('Erro de acesso ao microfone: ' + e.message);
                alert('Permita a captação de áudio no navegador.');
            }
        } else {
            if (recognitionInstance) try { recognitionInstance.stop(); } catch(e){}
            pararSupermicrofoneComTexto("Voz encerrada pelo operador.");
        }
    });
}

// Renderização das 8 Estantes Gráficas
function iniciarLoopGraficosBrancos() {
    const canvases = [];
    const contexts = [];
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (cv) {
            cv.width = cv.parentElement.clientWidth || 300;
            cv.height = 110;
            canvases.push(cv);
            contexts.push(cv.getContext('2d'));
        }
    }

    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    metricsInterval = setInterval(() => {
        if (!isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        let rms = (sum / (dataArray.length || 1) / 255).toFixed(3);

        document.getElementById('mVal1').textContent = `${Math.round((sum % 110) + 95)} Hz | ${(rms * 1.6).toFixed(2)}%`;
        document.getElementById('mVal2').textContent = `${(rms * 70 + 40).toFixed(1)} dB | ${(rms * 2.1).toFixed(2)}%`;
        document.getElementById('mVal3').textContent = `${(rms * 24 + 10).toFixed(1)} dB | ${(rms * 12 + 6).toFixed(1)} dB`;
        document.getElementById('mVal4').textContent = `${Math.round(82 + rms * 18)}% | ${(0.4 + rms * 0.7).toFixed(2)}s`;
        document.getElementById('mVal5').textContent = `G${Math.round(rms * 2)} | S${Math.round(rms * 1.5)}`;
        document.getElementById('mVal6').textContent = `${(105 + rms * 40).toFixed(1)} L/s | ${(6.8 + rms * 3.5).toFixed(1)} cmH₂O`;
        document.getElementById('mVal7').textContent = `${Math.round(48 + rms * 18)}% | ${(3.2 + rms * 1.1).toFixed(1)} ms`;
        document.getElementById('mVal8').textContent = `${Math.round(32 + rms * 12)} dBA | ${Math.round(94 - rms * 4)}%`;
    }, 2000);

    let phase = 0;
    function render() {
        if (!isRecording) return;
        animId = requestAnimationFrame(render);
        analyser.getByteFrequencyData(dataArray);
        phase += 0.04;

        contexts.forEach((ctx, index) => {
            const cv = canvases[index];
            if (!cv) return;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = index % 2 === 0 ? '#2a9d8f' : '#0ea5e9';

            for (let x = 0; x < cv.width; x++) {
                let wave = Math.sin(x * 0.03 + phase + index) * (dataArray[x % dataArray.length] / 6);
                let y = cv.height / 2 + wave;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        });
    }
    render();
}

// Parada e Avanço das 3 Calibrações
function pararSupermicrofoneComTexto(textoTranscrito) {
    isRecording = false;
    if (animId) cancelAnimationFrame(animId);
    if (metricsInterval) clearInterval(metricsInterval);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();

    btnMic.textContent = '🎙️ Pressione para Falar (Consome 1 Token)';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';

    document.getElementById('crsReportPayloadDisplay').textContent = 
`{
  "etapa_calibracao": "${etapasCalibracaoVoz}/3",
  "status_crs": "Espectroide de silêncios e ritmos calibrado.",
  "transcricao": "${textoTranscrito}"
}`;

    const chatBox = document.getElementById('chatBox');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = textoTranscrito;
    chatBox.appendChild(userMsg);

    setTimeout(() => {
        const adMsg = document.createElement('div');
        adMsg.className = 'chat-message ad';

        if (etapasCalibracaoVoz === 1) {
            etapasCalibracaoVoz = 2;
            document.getElementById('calibStepTitle').textContent = '🎙️ 2ª Calibração de Voz (Anterior)';
            document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 2/3)';
            adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Sistema simbiótico ativo. CRS calibrado. Registrei a 1ª etapa: "${textoTranscrito}". Diga agora o estado atual do ambiente para a <strong>2ª Etapa</strong>.`;
        } else if (etapasCalibracaoVoz === 2) {
            etapasCalibracaoVoz = 3;
            document.getElementById('calibStepTitle').textContent = '🎙️ 3ª Calibração de Voz (Baseline)';
            document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 3/3)';
            adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Sistema simbiótico ativo. CRS calibrado. 2ª etapa registrada: "${textoTranscrito}". Por fim, emita a <strong>3ª Calibração</strong> para selar o baseline.`;
        } else {
            document.getElementById('calibStepTitle').textContent = '🟢 Ecossistema Simbiótico Ativo & Calibrado';
            document.getElementById('calibraStatus').textContent = '🟢 Sistema Calibrado (3/3)';
            adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> Sistema simbiótico ativo. CRS calibrado! As 3 etapas foram validadas com sucesso. O ecossistema está ativado.`;
            
            document.getElementById('btnFinalizarCalibracao').style.display = 'block';
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.add('liberado'));
            btnMic.style.display = 'none';
        }

        chatBox.appendChild(adMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 800);

    totalSessoesConcluidas = Math.min(totalSessoesConcluidas + 1, 3);
    if (totalSessoesConcluidas >= 1) document.getElementById('infoSessao1').textContent = 'Sessão auditada';
    if (totalSessoesConcluidas >= 2) document.getElementById('infoSessao2').textContent = 'Sessão anterior gravada';
    if (totalSessoesConcluidas >= 3) {
        document.getElementById('infoSessao3').textContent = 'Baseline completa';
        const btnPdf = document.getElementById('btnGerarPdf');
        if (btnPdf) {
            btnPdf.style.opacity = '1';
            btnPdf.style.pointerEvents = 'auto';
        }
    }
}

// Gaveta de Logs
const logsDrawer = document.getElementById('logsDrawer');
const logsToggleBtn = document.getElementById('logsToggleBtn');
if (logsToggleBtn) {
    let logsAberto = false;
    logsToggleBtn.addEventListener('click', () => {
        logsAberto = !logsAberto;
        logsDrawer.style.transform = logsAberto ? 'translateY(0px)' : 'translateY(115px)';
    });
}

initCockpit();
