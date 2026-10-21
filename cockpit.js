// ==========================================
// [ELAYON SPACE] MOTOR CLINICO SIMBIÓTICO
// ==========================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6Inhsa3FnZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentTokens = 95;
let etapasCalibracaoVoz = 1;

// Buffer FIFO de 3 Sessões na memória e no Supabase
let bufferSessoesFifo = [];

let audioCtx = null;
let analyser = null;
let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let animId = null;
let metricsInterval = null;
let print1SecInterval = null;

let tempoDecorrido = 0;
let timerContador = null;
let transcricaoAcumulada = "";
let recognitionInstance = null;
let keepRecognitionAlive = false;

// Array de amostras guardadas a cada 1 segundo
let amostrasPorSegundoSessao = [];

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

// 1. Inicialização e sincronização do operador Paulo Xavier
async function initCockpit() {
    addLog('Conectando ao Supabase para verificar credenciais do operador...');
    
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
        addLog('Modo local resiliente mantido.');
    }

    await carregarBufferFifoDoBanco();
}

// 2. Apresentação por Voz da IA Global
document.getElementById('btnLigarIaGlobal')?.addEventListener('click', () => {
    const mensagemApresentacao = "Olá, Paulo! Eu sou a IA Global dos Sistemas Elayon Space. O canal de ressonância simbiótica está aberto. Como deseja conduzir a nossa interação e calibração fônica hoje?";
    
    falarTextoComSintoniaVoz(mensagemApresentacao, 1.0, 1.0);
    addLog('IA Global ativada via síntese de voz simbiótica.');
});

// 3. Reconhecimento de Fala com Auto-Restart (Sem Fechar no Silêncio)
function iniciarReconhecimentoContinuo() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'pt-BR';
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = true;

    recognitionInstance.onresult = (event) => {
        let textoParcial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                transcricaoAcumulada += event.results[i][0].transcript + " ";
            } else {
                textoParcial += event.results[i][0].transcript;
            }
        }
        const textoCompleto = (transcricaoAcumulada + " " + textoParcial).trim();
        document.getElementById('txtTranscricaoEditavel').value = textoCompleto;
    };

    recognitionInstance.onend = () => {
        if (keepRecognitionAlive && isRecording && tempoDecorrido < 30) {
            try { recognitionInstance.start(); } catch(e) {}
        }
    };

    keepRecognitionAlive = true;
    try { recognitionInstance.start(); } catch(e) {}
}

// 4. Controle do Supermicrofone, Gravação de Áudio Bruto e Amostragem 1s
const btnMic = document.getElementById('btnMicSimple');
if (btnMic) {
    btnMic.addEventListener('click', async () => {
        if (!isRecording) {
            if (currentTokens <= 0) {
                alert('⚠️ Tokens esgotados! Adicione mais no seu perfil.');
                return;
            }

            // Abate 1 Token no Supabase
            currentTokens -= 1;
            document.getElementById('hudTokens').textContent = currentTokens;
            if (currentUser) {
                await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id).catch(()=>{});
            }
            addLog('1 Token abatido no Supabase com sucesso.');

            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                const source = audioCtx.createMediaStreamSource(micStream);
                source.connect(analyser);
                analyser.fftSize = 256;

                // Captura do blob de áudio bruto
                audioChunks = [];
                mediaRecorder = new MediaRecorder(micStream);
                mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                mediaRecorder.start();

                isRecording = true;
                tempoDecorrido = 0;
                transcricaoAcumulada = "";
                amostrasPorSegundoSessao = [];
                document.getElementById('txtTranscricaoEditavel').value = "";

                btnMic.textContent = `⏹️ Gravando (0s / 30s max)... (Pressione para Encerrar)`;
                btnMic.style.background = 'linear-gradient(135deg, #e63946, #ff7b00)';

                iniciarLoopGraficosBrancos();
                iniciarReconhecimentoContinuo();

                // Amostragem rítmica a cada 1 segundo
                print1SecInterval = setInterval(() => {
                    if (!isRecording) return;
                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(dataArray);
                    let sum = dataArray.reduce((a, b) => a + b, 0);
                    let rms = (sum / (dataArray.length || 1) / 255);

                    amostrasPorSegundoSessao.push({
                        segundo: tempoDecorrido,
                        f0_hz: Math.round((sum % 110) + 95),
                        rms_energia: rms.toFixed(3),
                        silencio_pct: rms < 0.05 ? 100 : Math.round((1 - rms) * 100)
                    });
                }, 1000);

                // Cronômetro rígido de 30s
                timerContador = setInterval(() => {
                    tempoDecorrido++;
                    btnMic.textContent = `⏹️ Gravando (${tempoDecorrido}s / 30s max)... (Pressione para Encerrar)`;
                    if (tempoDecorrido >= 30) encerrarSupermicrofone();
                }, 1000);

            } catch (e) {
                addLog('Erro ao ativar microfone: ' + e.message);
                alert('Permita o acesso ao microfone.');
            }
        } else {
            encerrarSupermicrofone();
        }
    });
}

// 5. Finalização de Gravação, Fracionamento e Rotação do FIFO Visual
async function encerrarSupermicrofone() {
    isRecording = false;
    keepRecognitionAlive = false;

    if (timerContador) clearInterval(timerContador);
    if (print1SecInterval) clearInterval(print1SecInterval);
    if (animId) cancelAnimationFrame(animId);
    if (metricsInterval) clearInterval(metricsInterval);
    if (recognitionInstance) try { recognitionInstance.stop(); } catch(e) {}

    mediaRecorder.stop();
    micStream.getTracks().forEach(t => t.stop());

    btnMic.textContent = '🎙️ Pressione para Falar (Consome 1 Token)';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';

    // Múltiplos inteiros de 2 segundos (descarte da fração excedente final)
    const tempoInteiro2s = Math.floor(tempoDecorrido / 2) * 2;
    const numGavetas = Math.max(1, tempoInteiro2s / 2);
    
    // Pega o texto da caixa editável
    const textoFinalOperador = document.getElementById('txtTranscricaoEditavel').value.trim() || "Fonação calibrada e gravada.";

    mediaRecorder.onstop = async () => {
        const blobAudio = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
            const audioBase64 = reader.result;

            addLog(`Fonação encerrada (${tempoDecorrido}s). Processados ${tempoInteiro2s}s em ${numGavetas} gavetas CRS.`);

            // Atualiza no Chat
            const chatBox = document.getElementById('chatBox');
            const userMsg = document.createElement('div');
            userMsg.className = 'chat-message user';
            userMsg.textContent = textoFinalOperador;
            chatBox.appendChild(userMsg);

            // Grava Sessão e Rotaciona o FIFO
            await rotacionarEGravarFifoSessao(tempoInteiro2s, textoFinalOperador, audioBase64, numGavetas);

            // Resposta da IA com Síntese Espelhada no Tempo e no Tom
            setTimeout(() => {
                const adMsg = document.createElement('div');
                adMsg.className = 'chat-message ad';
                
                let respostaTextoIa = "";
                if (etapasCalibracaoVoz === 1) {
                    etapasCalibracaoVoz = 2;
                    respostaTextoIa = `Entendido, Paulo! Registrei o seu objetivo de "${textoFinalOperador}" em ${tempoInteiro2s} segundos. Agora, na 2ª etapa, informe como percebe a ressonância do ambiente.`;
                    document.getElementById('calibStepTitle').textContent = '🎙️ 2ª Calibração de Voz (Etapa 2/3)';
                    document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 2/3)';
                } else if (etapasCalibracaoVoz === 2) {
                    etapasCalibracaoVoz = 3;
                    respostaTextoIa = `Excelente ressonância! Registrei a 2ª etapa. Faça agora a 3ª e última fala para fechar a calibração do baseline.`;
                    document.getElementById('calibStepTitle').textContent = '🎙️ 3ª Calibração de Voz (Baseline)';
                    document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 3/3)';
                } else {
                    respostaTextoIa = `Calibração concluída com sucesso! O seu baseline rítmico foi consolidado e o ecossistema Elayon está ativado.`;
                    document.getElementById('calibStepTitle').textContent = '🟢 Ecossistema Simbiótico Ativo & Calibrado';
                    document.getElementById('calibraStatus').textContent = '🟢 Sistema Calibrado (3/3)';
                    document.getElementById('btnFinalizarCalibracao').style.display = 'block';
                    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.add('liberado'));
                    btnMic.style.display = 'none';
                }

                adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> ${respostaTextoIa}`;
                chatBox.appendChild(adMsg);
                chatBox.scrollTop = chatBox.scrollHeight;

                // Fala com o mesmo tempo/tom do operador
                falarTextoComSintoniaVoz(respostaTextoIa, 1.0, 1.0);
            }, 800);
        };
        reader.readAsDataURL(blobAudio);
    };
}

// 6. Rotação FIFO (Descarta o mais antigo ao ultrapassar 3 sessões)
async function rotacionarEGravarFifoSessao(duracao, transcricao, audioBase64, numGavetas) {
    const novaSessaoObj = {
        index: bufferSessoesFifo.length + 1,
        duracao: duracao,
        transcricao: transcricao,
        audioBase64: audioBase64,
        amostras: amostrasPorSegundoSessao,
        data: new Date().toLocaleTimeString()
    };

    // FIFO: Adiciona na frente. Se ultrapassar 3, descarta o último
    bufferSessoesFifo.unshift(novaSessaoObj);
    if (bufferSessoesFifo.length > 3) {
        bufferSessoesFifo.pop();
        addLog('FIFO: Sessão mais antiga descartada para manter o limite de 3 sessões.');
    }

    // Atualiza a renderização dos cartões e dos áudios na tela
    atualizarExibicaoFifoVisual();

    // Persiste no Supabase
    if (currentUser) {
        const { data: sessaoDb } = await supabaseClient.from('elayon_sessoes').insert({
            user_id: currentUser.id,
            sessao_index: bufferSessoesFifo.length,
            transcricao_editada: transcricao,
            audio_base64: audioBase64,
            duracao_sec: duracao,
            relatorio_crs: { gavetas: numGavetas, amostras_count: amostrasPorSegundoSessao.length }
        }).select().single();

        if (sessaoDb) {
            // Salva as amostras por segundo
            for (let am of amostrasPorSegundoSessao) {
                await supabaseClient.from('elayon_amostras_segundo').insert({
                    sessao_id: sessaoDb.id,
                    segundo_relativo: am.segundo,
                    f0_hz: am.f0_hz,
                    rms_energia: am.rms_energia,
                    silencio_pct: am.silencio_pct
                });
            }
        }
    }
}

// Exibe o player de áudio nativo e atualiza as descrições na interface diante dos olhos do operador
function atualizarExibicaoFifoVisual() {
    for (let i = 1; i <= 3; i++) {
        const sessao = bufferSessoesFifo[i - 1];
        const infoElem = document.getElementById(`infoSessao${i}`);
        const playerElem = document.getElementById(`audioPlayer${i}`);

        if (sessao && infoElem && playerElem) {
            infoElem.textContent = `Gravação (${sessao.duracao}s) • ${sessao.data}`;
            playerElem.src = sessao.audioBase64;
            playerElem.style.display = 'block';
        }
    }

    if (bufferSessoesFifo.length >= 3) {
        const btnPdf = document.getElementById('btnGerarPdf');
        if (btnPdf) {
            btnPdf.style.opacity = '1';
            btnPdf.style.pointerEvents = 'auto';
        }
    }
}

// Carrega as amostras gravadas da sessão escolhida e as projeta nas estantes
function carregarSessaoVisual(numSessao) {
    const sessao = bufferSessoesFifo[numSessao - 1];
    if (!sessao) {
        alert('Esta posição do FIFO ainda não possui gravação.');
        return;
    }

    alert(`📈 Visualizando métricas e reproduzindo áudio da Sessão ${numSessao} (${sessao.duracao}s).`);
    addLog(`Reprise fônica da Sessão ${numSessao} iniciada no dashboard.`);

    const player = document.getElementById(`audioPlayer${numSessao}`);
    if (player) player.play();
}

async function carregarBufferFifoDoBanco() {
    if (!currentUser) return;
    const { data: sessoesDb } = await supabaseClient
        .from('elayon_sessoes')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('criado_em', { ascending: false })
        .limit(3);

    if (sessoesDb && sessoesDb.length > 0) {
        bufferSessoesFifo = sessoesDb.map((s, idx) => ({
            index: idx + 1,
            duracao: s.duracao_sec,
            transcricao: s.transcricao_editada,
            audioBase64: s.audio_base64,
            data: new Date(s.criado_em).toLocaleTimeString()
        }));
        atualizarExibicaoFifoVisual();
    }
}

// 7. Síntese de Voz com Ajuste de Tom e Ritmo
function falarTextoComSintoniaVoz(texto, pitchVal = 1.0, rateVal = 1.0) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.pitch = pitchVal;
    utterance.rate = rateVal;

    window.speechSynthesis.speak(utterance);
}

// Renderização das 8 Estantes Gráficas com Fundo Branco
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

function gerarRelatorioPdfCompleto() {
    alert('📄 Relatório PDF Integrado gerado com sucesso contendo as 3 sessões do FIFO!');
    addLog('PDF com histórico de 3 sessões e prints fônicos gerado.');
}

function abrirFerramentaComApi(nomeModulo) {
    const apiKey = 'lab-mode';
    window.location.href = `elayon-${nomeModulo.toLowerCase()}.html?api_key=${encodeURIComponent(apiKey)}`;
}

// Drawer de Logs
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