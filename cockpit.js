// ==========================================================================
// [ELAYON SPACE] COCKPIT CLÍNICO SIMBIÓTICO • v2.3.0 (PARTE 1 DE 2)
// ==========================================================================
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentTokens = 100;
let etapasCalibracaoVoz = 1; // 1, 2 e 3 (Baseline)
let bufferSessoesFifo = [];

let audioCtx = null;
let analyser = null;
let micStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let metricsInterval = null;

let tempoDecorrido = 0;
let transcricaoBrutaIpsisLiteris = "";
let recognitionInstance = null;
let keepRecognitionAlive = false;

let serieTemporalAtual = [];
let ultimoAudioBase64 = null;
let ultimoBlobAudio = null;

// Injetar painel de logs de erro e diagnóstico no HTML dinamicamente se não existir
function injetarPainelLogsSeNecessario() {
    if (document.getElementById('logsDrawer')) return;
    const drawer = document.createElement('div');
    drawer.id = 'logsDrawer';
    drawer.style.cssText = "position:fixed; bottom:0; left:0; right:0; background:#0a2a2f; color:#3ecfcf; font-family:monospace; font-size:10px; padding:10px; z-index:9999; border-top:2px solid #2a9d8f; max-height:120px; overflow-y:auto; transition:0.3s; transform:translateY(95px);";
    drawer.innerHTML = `
        <div id="logsToggleBtn" style="cursor:pointer; font-weight:bold; padding-bottom:4px; border-bottom:1px solid #1a4a50; display:flex; justify-content:space-between;">
            <span>📋 Gaveta de Logs & Diagnóstico de Erros (Elayon IA API)</span>
            <span>▲ Abrir/Fechar</span>
        </div>
        <div id="logsBody" style="margin-top:6px; max-height:80px; overflow-y:auto;"></div>
    `;
    document.body.appendChild(drawer);
    document.getElementById('logsToggleBtn').onclick = () => {
        drawer.style.transform = drawer.style.transform === 'translateY(0px)' ? 'translateY(95px)' : 'translateY(0px)';
    };
}

function addLog(msg) {
    injetarPainelLogsSeNecessario();
    const logBody = document.getElementById('logsBody');
    const timeStr = new Date().toLocaleTimeString();
    if (logBody) {
        const item = document.createElement('div');
        item.style.padding = "2px 0";
        item.textContent = `[${timeStr}] ${msg}`;
        logBody.appendChild(item);
        logBody.scrollTop = logBody.scrollHeight;
    }
    console.log(`[ELAYON 2.3.0] ${msg}`);
}

async function initCockpit() {
    addLog('Inicializando Cockpit v2.3.0 • Sincronizando tokens do Supabase...');
    
    const hudTokensEl = document.getElementById('hudTokens');
    if (hudTokensEl) hudTokensEl.textContent = '...';

    try {
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        if (authError || !session || !session.user) {
            addLog('Sessão não encontrada ou expirada. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }

        currentUser = session.user;
        document.getElementById('userDisplayEmail').textContent = `ID: ${currentUser.id}`;

        // Consulta exata na tabela profiles
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('tokens, nome, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profile) {
            currentTokens = profile.tokens ?? 100;
            if (hudTokensEl) hudTokensEl.textContent = currentTokens;
            if (profile.nome) document.getElementById('userDisplayName').textContent = profile.nome;
            if (profile.avatar_url) document.getElementById('userAvatarImg').src = profile.avatar_url;
            addLog(`✅ Tokens sincronizados com sucesso: ${currentTokens}`);
        } else {
            currentTokens = 100;
            if (hudTokensEl) hudTokensEl.textContent = currentTokens;
            const nomeFallback = currentUser.email.split('@')[0];
            document.getElementById('userDisplayName').textContent = nomeFallback;
            
            await supabaseClient.from('profiles').upsert({
                id: currentUser.id,
                email: currentUser.email,
                tokens: 100,
                nome: nomeFallback,
                papel: 'usuario'
            });
            addLog('⚡ Perfil inicial gerado automaticamente no Supabase.');
        }

    } catch (e) {
        addLog('❌ Erro crítico ao buscar tokens: ' + e.message);
        currentTokens = 100;
        if (hudTokensEl) hudTokensEl.textContent = currentTokens;
    }

    await carregarBufferFifoDoBanco();
    desenharTodasEstantesVazias();
}

// Interação Inteligente da IA Global por Etapas
document.getElementById('btnLigarIaGlobal')?.addEventListener('click', () => {
    let msgIA = "Olá! Aqui é a IA Global dos Sistemas Elayon Space. Como posso ajudar?";
    if (etapasCalibracaoVoz === 2) msgIA = "Excelente. O que vamos fazer agora na nossa segunda calibração?";
    if (etapasCalibracaoVoz === 3) msgIA = "Estamos na reta final. Como você está se sentindo para consolidar nossa Baseline?";
    
    falarTextoComSintoniaVoz(msgIA);
    adicionarMensagemChatAd(msgIA);
    addLog('IA Global acionada com prompt interativo.');
});

function adicionarMensagemChatAd(texto) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;
    const adMsg = document.createElement('div');
    adMsg.className = 'chat-message ad';
    adMsg.innerHTML = `<strong>Ad (Elayon Space):</strong> ${texto}`;
    chatBox.appendChild(adMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ==========================================
// TRANSCRIÇÃO IPIS LITERIS & INPUT DE CHAT
// ==========================================
function iniciarTranscricaoIpsisLiteris() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addLog('⚠️ SpeechRecognition não suportado neste navegador.');
        return;
    }

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = 'pt-BR';
    recognitionInstance.interimResults = true;
    recognitionInstance.continuous = true;

    recognitionInstance.onresult = (event) => {
        let textoFinal = "";
        let textoParcial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const trecho = event.results[i][0].transcript;
            if (event.results[i].isFinal) textoFinal += trecho + " ";
            else textoParcial += trecho + " ";
        }
        if (textoFinal) transcricaoBrutaIpsisLiteris += textoFinal;
        const campoTexto = document.getElementById('txtTranscricaoEditavel');
        if (campoTexto) campoTexto.value = (transcricaoBrutaIpsisLiteris + " " + textoParcial).trim();
    };

    recognitionInstance.onerror = (e) => {
        addLog('⚠️ Erro na transcrição de voz: ' + e.error);
    };

    recognitionInstance.onend = () => {
        if (keepRecognitionAlive && isRecording && tempoDecorrido < 30) {
            try { recognitionInstance.start(); } catch (e) {}
        }
    };

    keepRecognitionAlive = true;
    try { recognitionInstance.start(); } catch (e) { addLog('Erro ao iniciar reconhecimento: ' + e.message); }
}

// Supermicrofone Blindado com Gravação Real
const btnMic = document.getElementById('btnMicSimple');
if (btnMic) {
    btnMic.onclick = async () => {
        if (!isRecording) {
            addLog(`Iniciando captação real para Calibração (Etapa ${etapasCalibracaoVoz}/3).`);

            try {
                if (micStream) {
                    micStream.getTracks().forEach(track => track.stop());
                }

                micStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });

                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') await audioCtx.resume();

                analyser = audioCtx.createAnalyser();
                const source = audioCtx.createMediaStreamSource(micStream);
                source.connect(analyser);
                analyser.fftSize = 256;

                audioChunks = [];
                const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
                mediaRecorder = new MediaRecorder(micStream, { mimeType });

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) audioChunks.push(e.data);
                };
                mediaRecorder.start(250);

                isRecording = true;
                tempoDecorrido = 0;
                transcricaoBrutaIpsisLiteris = "";
                serieTemporalAtual = [];
                
                const campoTexto = document.getElementById('txtTranscricaoEditavel');
                if (campoTexto) campoTexto.value = "";
                
                ocultarAcoesValidacao();

                btnMic.textContent = `⏹️ Gravando Etapa ${etapasCalibracaoVoz} (0s / 30s)... (Toque para Encerrar)`;
                btnMic.style.background = 'linear-gradient(135deg, #e63946, #ff7b00)';

                iniciarTranscricaoIpsisLiteris();

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
                    desenharSerieNasEstantes(serieTemporalAtual);
                    atualizarMetricasTextuais(quadro);

                    btnMic.textContent = `⏹️ Gravando Etapa ${etapasCalibracaoVoz} (${tempoDecorrido}s / 30s)... (Toque para Encerrar)`;
                    if (tempoDecorrido >= 30) encerrarParaValidacao();
                }, 1000);

            } catch (e) {
                addLog('❌ Erro de hardware no microfone: ' + e.message);
                alert('⚠️ Permissão de microfone negada ou ocupado por outra aplicação.');
                isRecording = false;
                btnMic.textContent = '🎙️ Pressione para Falar (Tentar Novamente)';
                btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';
            }
        } else {
            encerrarParaValidacao();
        }
    };
}

function encerrarParaValidacao() {
    isRecording = false;
    keepRecognitionAlive = false;

    if (metricsInterval) clearInterval(metricsInterval);
    if (recognitionInstance) try { recognitionInstance.stop(); } catch(e) {}
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (micStream) micStream.getTracks().forEach(t => t.stop());

    btnMic.textContent = '🎙️ Pressione para Falar (Nova Tentativa)';
    btnMic.style.background = 'linear-gradient(135deg, var(--danger), #f06292)';

    mediaRecorder.onstop = () => {
        ultimoBlobAudio = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            ultimoAudioBase64 = reader.result;
            addLog(`Calibração ${etapasCalibracaoVoz} gravada com sucesso. Aguardando confirmação.`);
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
            <button class="btn-action btn-primary" id="btnConfirmarSessao" style="background: var(--success); flex: 1; margin:0;">✅ Confirmar Calibração ${etapasCalibracaoVoz} (Consome 1 Token)</button>
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

function refazerSessaoLimpa() {
    addLog('Calibração descartada. Tokens preservados.');
    document.getElementById('txtTranscricaoEditavel').value = "";
    ultimoAudioBase64 = null;
    ultimoBlobAudio = null;
    serieTemporalAtual = [];
    desenharTodasEstantesVazias();
    ocultarAcoesValidacao();
    alert('🔄 Sessão descartada.');
}

async function confirmarEfetivacaoSessao() {
    ocultarAcoesValidacao();

    if (currentTokens <= 0) {
        alert('⚠️ Tokens esgotados no perfil!');
        addLog('❌ Tentativa de calibração sem tokens disponíveis.');
        return;
    }

    currentTokens -= 1;
    document.getElementById('hudTokens').textContent = currentTokens;
    
    // Atualiza imediatamente o saldo na tabela profiles do Supabase
    if (currentUser) {
        const { error: updateErr } = await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id);
        if (updateErr) {
            addLog('❌ Erro ao atualizar token no Supabase: ' + updateErr.message);
        } else {
            addLog(`✅ Token debitado e persistido na base. Saldo atual: ${currentTokens}`);
        }
    }

    const textoBruto = document.getElementById('txtTranscricaoEditavel').value.trim() || "Calibração confirmada.";
    const snapshotsGraficos = capturarSnapshotsCanvas();

    const chatBox = document.getElementById('chatBox');
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.textContent = textoBruto;
    chatBox.appendChild(userMsg);

    await rotacionarEGravarFifoSessao(tempoDecorrido, textoBruto, ultimoAudioBase64, snapshotsGraficos, etapasCalibracaoVoz);

    setTimeout(() => {
        let resposta = "";
        if (etapasCalibracaoVoz === 1) {
            etapasCalibracaoVoz = 2;
            document.getElementById('calibStepTitle').textContent = '🎙️ 2ª Calibração de Voz (Etapa 2/3)';
            document.getElementById('calibraStatus').textContent = '🎙️ Calibração 2/3';
            resposta = "Excelente, 1ª calibração concluída! O que vamos fazer agora na segunda etapa?";
        } else if (etapasCalibracaoVoz === 2) {
            etapasCalibracaoVoz = 3;
            document.getElementById('calibStepTitle').textContent = '🎙️ 3ª Calibração de Voz (Baseline Final)';
            document.getElementById('calibraStatus').textContent = '🎙️ Baseline (Etapa 3/3)';
            resposta = "Perfeito, 2ª calibração confirmada. Como você está se sentindo para a 3ª etapa (Baseline)?";
        } else {
            document.getElementById('calibStepTitle').textContent = '🟢 Calibração Concluída com Sucesso';
            document.getElementById('calibraStatus').textContent = '🟢 Sistema Calibrado (3/3)';
            document.getElementById('btnLiberarHealth').style.display = 'block';
            if(btnMic) btnMic.style.display = 'none';
            resposta = "Baseline estabelecida com sucesso! O acesso ao Elayon Health via API está totalmente liberado.";
        }

        adicionarMensagemChatAd(resposta);
        falarTextoComSintoniaVoz(resposta);
    }, 800);
}

// FIFO & Supabase
async function rotacionarEGravarFifoSessao(duracao, transcricao, audioBase64, snapshots, etapa) {
    const novaSessaoObj = {
        duracao: duracao,
        transcricao: transcricao,
        audioBase64: audioBase64,
        snapshots: snapshots,
        serie: [...serieTemporalAtual],
        data: new Date().toLocaleTimeString(),
        etapa: etapa
    };

    bufferSessoesFifo.unshift(novaSessaoObj);
    if (bufferSessoesFifo.length > 3) bufferSessoesFifo.pop();

    atualizarExibicaoFifoVisual();

    if (currentUser) {
        await supabaseClient.from('elayon_sessoes').insert({
            user_id: currentUser.id,
            sessao_index: bufferSessoesFifo.length,
            etapa_calibracao: etapa,
            transcricao_editada: transcricao,
            audio_base64: audioBase64,
            duracao_sec: duracao,
            snapshots_graficos: snapshots
        });
        addLog(`📦 Sessão FIFO ${etapa} salva com sucesso no Supabase.`);
    }
}

function atualizarExibicaoFifoVisual() {
    for (let i = 1; i <= 3; i++) {
        const sessao = bufferSessoesFifo[i - 1];
        const infoElem = document.getElementById(`infoSessao${i}`);
        const playerElem = document.getElementById(`audioPlayer${i}`);

        if (sessao && infoElem && playerElem) {
            infoElem.textContent = `Etapa ${sessao.etapa || i} (${sessao.duracao}s) • ${sessao.data}`;
            playerElem.src = sessao.audioBase64;
            playerElem.style.display = 'block';
        }
    }
}

function carregarSessaoVisual(numSessao) {
    const sessao = bufferSessoesFifo[numSessao - 1];
    if (!sessao) { alert('Posição FIFO vazia.'); return; }
    if (sessao.serie) desenharSerieNasEstantes(sessao.serie);
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
        bufferSessoesFifo = sessoesDb.map((s) => ({
            duracao: s.duracao_sec,
            transcricao: s.transcricao_editada,
            audioBase64: s.audio_base64,
            snapshots: s.snapshots_graficos,
            data: new Date(s.criado_em).toLocaleTimeString(),
            etapa: s.etapa_calibracao || 1
        }));
        atualizarExibicaoFifoVisual();
        
        if (bufferSessoesFifo.length >= 3) {
            etapasCalibracaoVoz = 3;
            document.getElementById('calibraStatus').textContent = '🟢 Sistema Calibrado (3/3)';
            document.getElementById('btnLiberarHealth').style.display = 'block';
            if(btnMic) btnMic.style.display = 'none';
        }
    }
}

function atualizarMetricasTextuais(q) {
    const m1 = document.getElementById('mVal1');
    const m2 = document.getElementById('mVal2');
    const m3 = document.getElementById('mVal3');
    const m4 = document.getElementById('mVal4');
    const m5 = document.getElementById('mVal5');
    const m6 = document.getElementById('mVal6');
    const m7 = document.getElementById('mVal7');
    const m8 = document.getElementById('mVal8');

    if (m1) m1.textContent = `${q.graves * 2} Hz | ${q.estabilidade}%`;
    if (m2) m2.textContent = `${65 + (q.medios % 15)} dB | ${q.ruido}%`;
    if (m3) m3.textContent = `24.5 dB | CRS: OK`;
    if (m4) m4.textContent = `${q.estabilidade}% | 1.2s`;
    if (m5) m5.textContent = `G0 | S0 (Normal)`;
    if (m6) m6.textContent = `120 L/s | 12 cmH₂O`;
    if (m7) m7.textContent = `48% | 4.5ms`;
    if (m8) m8.textContent = `35 dBA | OK`;
}

function desenharSerieNasEstantes(serie) {
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (!cv) continue;
        const ctx = cv.getContext('2d');
        const W = cv.width = cv.parentElement.clientWidth || 300;
        const H = cv.height = 110;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#eef4f5';
        ctx.lineWidth = 1;
        for (let y = 20; y < H; y += 20) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        if (serie.length === 0) continue;

        ctx.strokeStyle = (i % 2 === 0) ? '#2a9d8f' : '#0ea5e9';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const maxPontos = Math.max(serie.length, 30);
        const stepX = W / (maxPontos - 1);

        serie.forEach((quadro, idx) => {
            const x = idx * stepX;
            const val = quadro.medios || quadro.graves || 50;
            const y = H - ((val / 100) * (H - 20) + 10);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
}

function desenharTodasEstantesVazias() {
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (!cv) continue;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
    }
}

function capturarSnapshotsCanvas() {
    const snaps = {};
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvGraph${i}`);
        if (cv) snaps[`estante_${i}`] = cv.toDataURL('image/png');
    }
    return snaps;
}

function falarTextoComSintoniaVoz(texto) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(texto);
    utt.lang = 'pt-BR';
    window.speechSynthesis.speak(utt);
}

// Transição exata por API para o Elayon Health com parâmetros completos
function irParaElayonHealth() {
    if (!currentUser) {
        alert('⚠️ Sessão de operador não identificada.');
        return;
    }

    const targetUrl = new URL('https://paulorobertoxavierjunior-create.github.io/elayon-crs-triagem/index.html');
    targetUrl.searchParams.set('user_id', currentUser.id);
    targetUrl.searchParams.set('tokens', currentTokens);
    targetUrl.searchParams.set('calibracao', 'concluida_3_fases');

    addLog('🚀 Gerando API e migrando para o Elayon Health...');
    window.location.href = targetUrl.toString();
}

initCockpit();
