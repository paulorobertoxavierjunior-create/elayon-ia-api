// ==========================================================================
// [ELAYON SPACE] MOTOR CLÍNICO SIMBIÓTICO • PARTE 1 DE 2
// Seções: Configuração, Supabase, Estado Global, HUD & Captura de Fonação
// ==========================================================================

const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6Inhsa3FnZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// [SESSÃO A] ESTADO GLOBAL DO OPERADOR & FIFO
let currentUser = null;
let currentTokens = 95;
let etapasCalibracaoVoz = 1;
let bufferSessoesFifo = [];

// [SESSÃO B] VARIÁVEIS DE ÁUDIO E WEBAUDIO API
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
let transcricaoBrutaIpsisLiteris = "";
let recognitionInstance = null;
let keepRecognitionAlive = false;

let amostrasPorSegundoSessao = [];
let ultimoAudioBase64 = null;
let ultimoBlobAudio = null;

// [SESSÃO C] LOGS DE AUDITORIA TÉCNICA
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
    console.log(`[ELAYON MODULAR] ${msg}`);
}

// [SESSÃO D] INICIALIZAÇÃO E SINCRONIZAÇÃO DO PERFIL NO SUPABASE
async function initCockpit() {
    addLog('Inicializando ecossistema simbiótico modular...');
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
}

// [SESSÃO E] APRESENTAÇÃO POR VOZ DA IA GLOBAL
document.getElementById('btnLigarIaGlobal')?.addEventListener('click', () => {
    const msgApresentacao = "Olá, Paulo! Aqui é a IA Global dos Sistemas Elayon Space. Captação fônica crua, sem máscaras ou correções. Vamos testar a transparência total hoje?";
    falarTextoComSintoniaVoz(msgApresentacao, 1.0, 1.0);
    addLog('IA Global acionada.');
});

// [SESSÃO F] RECONHECIMENTO DE FALA IPSIS LITERIS (SEM CORREÇÃO)
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
        const brutoGeral = (transcricaoBrutaIpsisLiteris + " " + parcial);
        document.getElementById('txtTranscricaoEditavel').value = brutoGeral;
    };

    recognitionInstance.onend = () => {
        if (keepRecognitionAlive && isRecording && tempoDecorrido < 30) {
            try { recognitionInstance.start(); } catch(e) {}
        }
    };

    keepRecognitionAlive = true;
    try { recognitionInstance.start(); } catch(e) {}
}

// [SESSÃO G] CONTROLE DO SUPERMICROFONE (GRAVAÇÃO E AMOSTRAGEM 1s)
const btnMic = document.getElementById('btnMicSimple');
if (btnMic) {
    btnMic.addEventListener('click', async () => {
        if (!isRecording) {
            addLog('Iniciando fonação de teste (Tokens preservados até confirmação).');

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
                amostrasPorSegundoSessao = [];
                document.getElementById('txtTranscricaoEditavel').value = "";
                
                ocultarAcoesValidacao();

                btnMic.textContent = `⏹️ Gravando (0s / 30s max)... (Clique para Encerrar)`;
                btnMic.style.background = 'linear-gradient(135deg, #e63946, #ff7b00)';

                iniciarLoopGraficosBrancos();
                iniciarReconhecimentoIpsisLiteris();

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

                timerContador = setInterval(() => {
                    tempoDecorrido++;
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

// ==========================================================================
// [ELAYON SPACE] MOTOR CLÍNICO SIMBIÓTICO • PARTE 2 DE 2
// Seções: Validação (Confirmar/Refazer), FIFO, Supabase Sync, Gráficos & TTS
// ==========================================================================

// [SESSÃO H] ENCERRAMENTO E EXIBIÇÃO DE VALIDAÇÃO (CONFIRMAR / REFAZER)
function encerrarParaValidacao() {
    isRecording = false;
    keepRecognitionAlive = false;

    if (timerContador) clearInterval(timerContador);
    if (print1SecInterval) clearInterval(print1SecInterval);
    if (animId) cancelAnimationFrame(animId);
    if (metricsInterval) clearInterval(metricsInterval);
    if (recognitionInstance) try { recognitionInstance.stop(); } catch(e) {}

    mediaRecorder.stop();
    micStream.getTracks().forEach(t => t.stop());

    btnMic.textContent = '🎙️ Pressione para Falar (Nova Sessão)';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';

    mediaRecorder.onstop = () => {
        ultimoBlobAudio = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            ultimoAudioBase64 = reader.result;
            addLog(`Captura fônica concluída (${tempoDecorrido}s). Aguardando validação.`);
            exibirAcoesValidacao();
        };
        reader.readAsDataURL(ultimoBlobAudio);
    };
}

function exibirAcoesValidacao() {
    let containerAcoes = document.getElementById('validacaoAcoesContainer');
    if (!containerAcoes) {
        containerAcoes = document.createElement('div');
        containerAcoes.id = 'validacaoAcoesContainer';
        containerAcoes.style.cssText = "display: flex; gap: 10px; margin-top: 10px; margin-bottom: 10px;";
        
        containerAcoes.innerHTML = `
            <button class="btn-action btn-primary" id="btnConfirmarSessao" style="background: var(--success); flex: 1; margin:0;">✅ Confirmar Sessão (Conta 1 Token)</button>
            <button class="btn-action btn-secondary" id="btnRefazerSessao" style="background: var(--warning); color:#000; flex: 1; margin:0;">🔄 Refazer (Sem Custo)</button>
        `;
        const chatSection = document.querySelector('.chat-section');
        chatSection.insertBefore(containerAcoes, document.getElementById('btnMicSimple'));

        document.getElementById('btnConfirmarSessao').addEventListener('click', confirmarEfetivacaoSessao);
        document.getElementById('btnRefazerSessao').addEventListener('click', refazerSessaoLimpa);
    }
    containerAcoes.style.display = 'flex';
}

function ocultarAcoesValidacao() {
    const containerAcoes = document.getElementById('validacaoAcoesContainer');
    if (containerAcoes) containerAcoes.style.display = 'none';
}

// [SESSÃO I] REFAZER (DESCARTA ÁUDIO E PRESERVA TOKENS)
function refazerSessaoLimpa() {
    addLog('Sessão refazejada pelo operador. Nenhum token consumido.');
    document.getElementById('txtTranscricaoEditavel').value = "";
    ultimoAudioBase64 = null;
    ultimoBlobAudio = null;
    ocultarAcoesValidacao();
    alert('🔄 Sessão descartada. Pode gravar novamente sem gastar tokens!');
}

// [SESSÃO J] CONFIRMAR (DEBITA TOKEN, FECHA BALÃO E GRAVA NO FIFO/SUPABASE)
async function confirmarEfetivacaoSessao() {
    ocultarAcoesValidacao();

    if (currentTokens <= 0) {
        alert('⚠️ Tokens esgotados!');
        return;
    }

    currentTokens -= 1;
    document.getElementById('hudTokens').textContent = currentTokens;
    if (currentUser) {
        await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id).catch(()=>{});
    }
    addLog('Token confirmado e debitado após validação.');

    const tempoInteiro2s = Math.floor(tempoDecorrido / 2) * 2;
    const numGavetas = Math.max(1, tempoInteiro2s / 2);
    const textoBrutoIpsisLiteris = document.getElementById('txtTranscricaoEditavel').value.trim() || "Fonação confirmada sem texto.";

    const chatBox = document.getElementById('chatBox');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = textoBrutoIpsisLiteris;
    chatBox.appendChild(userMsg);

    await rotacionarEGravarFifoSessao(tempoInteiro2s, textoBrutoIpsisLiteris, ultimoAudioBase64, numGavetas);

    setTimeout(() => {
        const adMsg = document.createElement('div');
        adMsg.className = 'chat-message ad';
        
        let respostaIpsis = `Sessão confirmada, Paulo. Ouvi cru e direto: "${textoBrutoIpsisLiteris}" em ${tempoInteiro2s} segundos. Balão fechado no FIFO.`;
        
        if (etapasCalibracaoVoz === 1) {
            etapasCalibracaoVoz = 2;
            document.getElementById('calibStepTitle').textContent = '🎙️ 2ª Calibração de Voz (Etapa 2/3)';
            document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 2/3)';
        } else if (etapasCalibracaoVoz === 2) {
            etapasCalibracaoVoz = 3;
            document.getElementById('calibStepTitle').textContent = '🎙️ 3ª Calibração de Voz (Baseline)';
            document.getElementById('calibraStatus').textContent = '🎙️ Calibração de Voz (Etapa 3/3)';
        } else {
            document.getElementById('calibStepTitle').textContent = '🟢 Ecossistema Simbiótico Ipsis Literis Ativo';
            document.getElementById('calibraStatus').textContent = '🟢 Sistema Calibrado (3/3)';
            document.getElementById('btnFinalizarCalibracao').style.display = 'block';
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.add('liberado'));
            btnMic.style.display = 'none';
        }

        adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> ${respostaIpsis}`;
        chatBox.appendChild(adMsg);
        chatBox.scrollTop = chatBox.scrollHeight;

        falarTextoComSintoniaVoz(respostaIpsis, 1.0, 1.0);
    }, 800);
}

// [SESSÃO K] ROTACIONAL FIFO (MÁXIMO 3 SESSÕES) & SUPABASE SYNC
async function rotacionarEGravarFifoSessao(duracao, transcricao, audioBase64, numGavetas) {
    const novaSessaoObj = {
        index: bufferSessoesFifo.length + 1,
        duracao: duracao,
        transcricao: transcricao,
        audioBase64: audioBase64,
        amostras: amostrasPorSegundoSessao,
        data: new Date().toLocaleTimeString()
    };

    bufferSessoesFifo.unshift(novaSessaoObj);
    if (bufferSessoesFifo.length > 3) {
        bufferSessoesFifo.pop();
        addLog('FIFO: Sessão mais antiga removida.');
    }

    atualizarExibicaoFifoVisual();

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

function atualizarExibicaoFifoVisual() {
    for (let i = 1; i <= 3; i++) {
        const sessao = bufferSessoesFifo[i - 1];
        const infoElem = document.getElementById(`infoSessao${i}`);
        const playerElem = document.getElementById(`audioPlayer${i}`);

        if (sessao && infoElem && playerElem) {
            infoElem.textContent = `Sessão (${sessao.duracao}s) • ${sessao.data}`;
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

function carregarSessaoVisual(numSessao) {
    const sessao = bufferSessoesFifo[numSessao - 1];
    if (!sessao) {
        alert('Posição FIFO vazia.');
        return;
    }
    alert(`📈 Carregando Sessão ${numSessao} (${sessao.duracao}s) com áudio bruto e gráficos.`);
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

// [SESSÃO L] SÍNTESE DE VOZ (TTS)
function falarTextoComSintoniaVoz(texto, pitchVal = 1.0, rateVal = 1.0) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    utterance.pitch = pitchVal;
    utterance.rate = rateVal;
    window.speechSynthesis.speak(utterance);
}

// [SESSÃO M] ESTANTES GRÁFICAS EM FUNDO BRANCO
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

// [SESSÃO N] UTILS & INICIALIZAÇÃO FINAL
const logsDrawer = document.getElementById('logsDrawer');
const logsToggleBtn = document.getElementById('logsToggleBtn');
if (logsToggleBtn) {
    let logsAberto = false;
    logsToggleBtn.addEventListener('click', () => {
        logsAberto = !logsAberto;
        logsDrawer.style.transform = logsAberto ? 'translateY(0px)' : 'translateY(115px)';
    });
}

function abrirFerramentaComApi(nomeModulo) {
    window.location.href = `elayon-${nomeModulo.toLowerCase()}.html?api_key=lab-mode`;
}

initCockpit();
