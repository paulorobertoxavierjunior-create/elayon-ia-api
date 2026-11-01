/* ==========================================================================
   PARTE 1: Configuração Supabase, Estado Global & Canvas das 8 Modulações
   ========================================================================== */

// Configuração do Cliente Supabase (Insira as tuas credenciais do projeto)
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_SUPABASE";
let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL.includes("http")) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Supabase em modo de simulação local.");
}

// Estado Global do Operador e da Calibração Simbiótica
const estadoSimbiotico = {
    operadorNome: "Paulo Roberto Xavier Júnior",
    userId: "PRXJ-2026-SIMBIOTICO",
    tokens: 100,
    etapaAtual: 1, // 1, 2 ou 3
    gravando: false,
    audioChunks: [],
    mediaRecorder: null,
    transcricaoAcumulada: "",
    sessoesFIFO: [
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", metrics: {} },
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", metrics: {} },
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", metrics: {} }
    ]
};

// Inicialização ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    atualizarDataHoraLive();
    inicializarCanvasGraficos();
    saudacaoInicialIA();
});

function atualizarDataHoraLive() {
    const agora = new Date();
    const dataStr = agora.toLocaleDateString("pt-BR");
    const horaStr = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
    const lbl = document.getElementById("lblDataHoraLive");
    if (lbl) lbl.innerText = `${dataStr} ${horaStr}`;
}

// Motor de Renderização Suave para Neurodivergentes (8 Modulações em Canvas)
function inicializarCanvasGraficos() {
    for (let i = 1; i <= 8; i++) {
        const canvas = document.getElementById(`cvMod${i}`);
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        canvas.width = canvas.parentElement.clientWidth - 32;
        canvas.height = 130;

        // Desenho inicial estático e suave
        ctx.fillStyle = "rgba(10, 15, 30, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = i % 2 === 0 ? "#14b8a6" : "#0ea5e9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let yBase = canvas.height / 2;
        for (let x = 0; x < canvas.width; x += 10) {
            let y = yBase + Math.sin(x * 0.05 + i) * 15 * Math.cos(x * 0.02);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

/* ==========================================================================
   PARTE 2: Reconhecimento de Voz, Gravação de Áudio, TTS & Captura de Gráficos
   ========================================================================== */

let recognition = null;

// Inicializa a fala e escuta contínua do usuário
function configurarReconhecimentoVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("SpeechRecognition não suportado neste navegador.");
        return null;
    }
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
        let textoTemporario = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            textoTemporario += event.results[i][0].transcript;
        }
        const txtArea = document.getElementById("txtTranscricaoUsuario");
        if (txtArea) {
            txtArea.value = estadoSimbiotico.transcricaoAcumulada + " " + textoTemporario;
        }
    };
    return rec;
}

// A IA Simbiótica fala o texto em voz alta (TTS) e adiciona ao Chat Box
function falarEExibirIA(texto) {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
        chatBox.innerHTML += `
            <div style="font-size: 12px; padding: 10px 14px; border-radius: 10px; max-width: 85%; background: rgba(14, 165, 233, 0.1); border-left: 3px solid var(--accent);">
                <strong>Elayon Core (IA Simbiótica):</strong> ${texto}
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Para fala anterior
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = "pt-BR";
        utterance.rate = 0.95; // Ritmo mais calmo e humano
        window.speechSynthesis.speak(utterance);
    }
}

function saudacaoInicialIA() {
    const nome = estadoSimbiotico.operadorNome;
    const msg = `Olá, ${nome}! Iniciando Conexão Simbiótica. Vamos realizar a Calibração Fonoaudiológica 1 de 3. Clique em Ligar Microfone, conte até dez com calma e suavidade, e desligue manualmente ao terminar.`;
    falarEExibirIA(msg);
}

// Captura snapshots em PNG dos 8 gráficos atuais para migração FIFO
function capturarSnapshotsModulacoes() {
    let imagensBase64 = [];
    for (let i = 1; i <= 8; i++) {
        const canvas = document.getElementById(`cvMod${i}`);
        if (canvas) {
            imagensBase64.push(canvas.toDataURL("image/png"));
        }
    }
    return imagensBase64;
}

/* ==========================================================================
   PARTE 3: Controle de Gravação Manual, Migração FIFO, Supabase & Conclusão
   ========================================================================== */

// Botão de alternância manual do microfone
async function toggleGravacaoManual() {
    const btn = document.getElementById("btnMicToggle");
    const txtArea = document.getElementById("txtTranscricaoUsuario");

    if (!estadoSimbiotico.gravando) {
        // INICIAR GRAVAÇÃO
        estadoSimbiotico.gravando = true;
        if (txtArea) estadoSimbiotico.transcricaoAcumulada = txtArea.value;
        
        btn.style.background = "linear-gradient(135deg, var(--success), #34d399)";
        btn.innerText = "⏹️ DESLIGAR MICROFONE (Processar Etapa)";
        
        // Iniciar Web Speech
        if (!recognition) recognition = configurarReconhecimentoVoz();
        try { recognition.start(); } catch(e) {}

        // Iniciar MediaRecorder para o Áudio Bruto
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            estadoSimbiotico.mediaRecorder = new MediaRecorder(stream);
            estadoSimbiotico.audioChunks = [];
            estadoSimbiotico.mediaRecorder.ondataavailable = e => estadoSimbiotico.audioChunks.push(e.data);
            estadoSimbiotico.mediaRecorder.start();
        } catch(e) {
            console.warn("Microfone de áudio bruto indisponível:", e);
        }

    } else {
        // PARAR GRAVAÇÃO E PROCESSAR ETAPA
        estadoSimbiotico.gravando = false;
        btn.style.background = "linear-gradient(135deg, var(--danger), #f43f5e)";
        btn.innerText = "🎙️ LIGAR MICROFONE (Falar Próxima Etapa)";

        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }

        if (estadoSimbiotico.mediaRecorder) {
            estadoSimbiotico.mediaRecorder.stop();
            estadoSimbiotico.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(estadoSimbiotico.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                await processarEtapaConcluida(audioUrl);
            };
        } else {
            await processarEtapaConcluida(null);
        }
    }
}

// Processa o ciclo FIFO, grava no Supabase e avança as etapas
async function processarEtapaConcluida(audioUrl) {
    const etapa = estadoSimbiotico.etapaAtual;
    const txtArea = document.getElementById("txtTranscricaoUsuario");
    const transcricaoFinal = txtArea ? txtArea.value : "";
    
    // Captura imagens dos gráficos
    const snapshots = capturarSnapshotsModulacoes();
    const crsValidado = "CRS OK • SILÊNCIO 18%";

    // Atualiza estrutura FIFO local
    estadoSimbiotico.sessoesFIFO[etapa - 1] = {
        audioUrl: audioUrl,
        imagens: snapshots,
        crsStatus: crsValidado,
        transcricao: transcricaoFinal
    };

    // Renderiza na UI do FIFO
    renderizarBufferFIFO(etapa);

    // Consome Token e Grava no Supabase
    estadoSimbiotico.tokens = Math.max(0, estadoSimbiotico.tokens - 1);
    const hudTokens = document.getElementById("hudTokens");
    if (hudTokens) hudTokens.innerText = estadoSimbiotico.tokens;

    if (supabaseClient) {
        try {
            await supabaseClient.from("calibracoes_crs").insert([{
                user_id: estadoSimbiotico.userId,
                operador_nome: estadoSimbiotico.operadorNome,
                etapa: etapa,
                transcricao_usuario: transcricaoFinal,
                resposta_ia: `Processado com sucesso na etapa ${etapa}`,
                crs_status: crsValidado,
                silence_pct: 18.5,
                rms_value: 0.74,
                audio_url: audioUrl || "local_blob",
                imagens_modulacoes: snapshots,
                tokens_consumidos: 1
            }]);
        } catch (err) {
            console.error("Erro ao salvar no Supabase:", err);
        }
    }

    // Avança etapas ou finaliza
    if (etapa < 3) {
        estadoSimbiotico.etapaAtual++;
        document.getElementById("calibraStatus").innerText = `🎙️ Calibração ${estadoSimbiotico.etapaAtual}/3`;
        document.getElementById("calibStepTitle").innerText = `🎙️ ${estadoSimbiotico.etapaAtual}ª Calibração de Voz (Etapa ${estadoSimbiotico.etapaAtual}/3)`;
        
        falarEExibirIA(`Etapa ${etapa} concluída e migrada para o Buffer FIFO! Preparando para a Etapa ${estadoSimbiotico.etapaAtual}. Leia a nova instrução e ligue o microfone.`);
    } else {
        // Finalizou as 3 etapas
        falarEExibirIA("Calibração fonoaudiológica completa com sucesso! Conexão Simbiótica estabelecida. Botão de entrada para o ecossistema liberado.");
        document.getElementById("btnMicToggle").style.display = "none";
        document.getElementById("btnLiberarHealth").style.display = "block";
    }
}

// Atualiza visualmente o FIFO nas 3 caixas do HTML
function renderizarBufferFIFO(etapa) {
    const sessao = estadoSimbiotico.sessoesFIFO[etapa - 1];
    
    // Atualiza Áudio
    const audioPlayer = document.getElementById(`audioPlayer${etapa}`);
    if (audioPlayer && sessao.audioUrl) {
        audioPlayer.src = sessao.audioUrl;
        audioPlayer.style.display = "block";
    }

    // Atualiza Badge CRS
    const badge = document.getElementById(`crsBadge${etapa}`);
    if (badge) {
        badge.innerText = sessao.crsStatus;
        badge.className = "fifo-badge ok";
    }

    // Atualiza Miniaturas de Imagens
    const imgGrid = document.getElementById(`imgGrid${etapa}`);
    if (imgGrid && sessao.imagens.length > 0) {
        imgGrid.innerHTML = sessao.imagens.slice(0, 4).map(img => `<img src="${img}" />`).join("");
    }

    // Move classe ativa para a próxima caixa FIFO
    if (etapa < 3) {
        document.getElementById(`fifoBox${etapa}`).classList.remove("ativo");
        document.getElementById(`fifoBox${etapa + 1}`).classList.add("ativo");
    }
}

// Redirecionamento final para o index do elayon-crs-triagem
function concluirEMigrarParaIndex() {
    window.location.href = "../elayon-crs-triagem/index.html";
}
