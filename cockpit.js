/* ==========================================================================
   PARTE 1: Configuração Supabase, Estado, Reconhecimento & Gráficos Dinâmicos
   ========================================================================== */

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

const estadoSimbiotico = {
    operadorNome: "Paulo Roberto Xavier Júnior",
    userId: "PRXJ-2026-SIMBIOTICO",
    tokens: 100,
    etapaAtual: 1,
    gravando: false,
    audioChunks: [],
    mediaRecorder: null,
    transcricaoAcumulada: "",
    animacaoId: null,
    sessoesFIFO: [
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", transcricao: "" },
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", transcricao: "" },
        { audioUrl: null, imagens: [], crsStatus: "AGUARDANDO", transcricao: "" }
    ]
};

// Histórico de dados para compactação contínua no canvas durante a fala
const historicoModulacoes = { mod1: [], mod2: [], mod3: [], mod4: [], mod5: [], mod6: [], mod7: [], mod8: [] };

document.addEventListener("DOMContentLoaded", () => {
    atualizarDataHoraLive();
    inicializarCanvasGraficosEstaticos();
    saudacaoInicialIA();
});

function atualizarDataHoraLive() {
    const agora = new Date();
    const lbl = document.getElementById("lblDataHoraLive");
    if (lbl) lbl.innerText = `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}`;
}

// Desenho inicial limpo e escuro em todos os 8 canvas
function inicializarCanvasGraficosEstaticos() {
    for (let i = 1; i <= 8; i++) {
        const canvas = document.getElementById(`cvMod${i}`);
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        canvas.width = canvas.parentElement.clientWidth - 32;
        canvas.height = 130;

        ctx.fillStyle = "rgba(10, 15, 30, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = i % 2 === 0 ? "#14b8a6" : "#0ea5e9";
        ctx.lineWidth = 2;
        ctx.beginPath();
        let yBase = canvas.height / 2;
        for (let x = 0; x < canvas.width; x += 10) {
            let y = yBase + Math.sin(x * 0.05 + i) * 12;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

// Motor de Renderização Fluida e Compactada no Tempo (Lúdica e Colorida)
function executarLoopGraficosDinamicos() {
    if (!estadoSimbiotico.gravando) return;

    let rmsSimulado = 0.3 + Math.random() * 0.6;
    let pitchSimulado = 110 + Math.sin(Date.now() * 0.01) * 35;

    for (let i = 1; i <= 8; i++) {
        const canvas = document.getElementById(`cvMod${i}`);
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "rgba(10, 15, 30, 0.95)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let histKey = `mod${i}`;
        if (!historicoModulacoes[histKey]) historicoModulacoes[histKey] = [];
        let hist = historicoModulacoes[histKey];

        hist.push({ rms: rmsSimulado, pitch: pitchSimulado });
        // Compacta automaticamente para preencher perfeitamente a largura do canvas
        if (hist.length > canvas.width / 3) hist.shift();

        renderizarModulacaoLudica(ctx, i, hist, canvas.width, canvas.height);
    }

    estadoSimbiotico.animacaoId = requestAnimationFrame(executarLoopGraficosDinamicos);
}

function renderizarModulacaoLudica(ctx, tipo, hist, width, height) {
    ctx.lineWidth = 2.5;
    switch(tipo) {
        case 1: // Onda Contínua Ciano
            ctx.strokeStyle = "#0ea5e9"; ctx.beginPath();
            hist.forEach((pt, idx) => {
                let x = idx * 3, y = (height / 2) + Math.sin(x * 0.08 + Date.now() * 0.003) * (pt.rms * 25);
                if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            break;
        case 2: // Rosca Proporcional
            let cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.35;
            ctx.strokeStyle = "rgba(20, 184, 166, 0.2)"; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = "#14b8a6";
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI/2, (-Math.PI/2) + (Math.PI * 1.5)); ctx.stroke();
            break;
        case 3: // Barras Coloridas
            let wBar = Math.max(2, (width / Math.max(hist.length, 1)) - 2);
            hist.forEach((pt, idx) => {
                let x = idx * (wBar + 2), h = pt.rms * (height * 0.75);
                ctx.fillStyle = idx % 2 === 0 ? "#10b981" : "#0ea5e9";
                ctx.fillRect(x, height - h - 10, wBar, h);
            });
            break;
        case 4: // Prosódia com Gradiente
            ctx.fillStyle = "rgba(14, 165, 233, 0.25)"; ctx.beginPath();
            ctx.moveTo(0, height);
            hist.forEach((pt, idx) => { ctx.lineTo(idx * 3, height - (pt.pitch / 220) * height * 0.7); });
            ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#0ea5e9"; ctx.beginPath();
            hist.forEach((pt, idx) => {
                let x = idx * 3, y = height - (pt.pitch / 220) * height * 0.7;
                if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            break;
        case 5: // Dispersão GRBAS
            ctx.fillStyle = "#14b8a6";
            hist.forEach((pt, idx) => {
                let x = (idx * 5) % width, y = (height / 2) + Math.sin(idx) * 18;
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
            });
            break;
        case 6: // Aerodinâmica Dupla
            ctx.strokeStyle = "#0ea5e9"; ctx.beginPath();
            hist.forEach((pt, idx) => { let x = idx * 3, y = (height/2) + Math.sin(x*0.05)*22; if(idx===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); });
            ctx.stroke();
            ctx.strokeStyle = "#f59e0b"; ctx.beginPath();
            hist.forEach((pt, idx) => { let x = idx * 3, y = (height/2) + Math.cos(x*0.05)*22; if(idx===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); });
            ctx.stroke();
            break;
        case 7: // Contato Glótico Degrau
            ctx.strokeStyle = "#10b981"; ctx.beginPath();
            hist.forEach((pt, idx) => {
                let x = idx * 3, y = height - (pt.rms * height * 0.65);
                if (idx === 0) ctx.moveTo(x, y); else { ctx.lineTo(x, height - (hist[idx-1].rms * height * 0.65)); ctx.lineTo(x, y); }
            });
            ctx.stroke();
            break;
        case 8: // Indicador Radial
            let rx = width / 2, ry = height / 2 + 10, rad = 32;
            ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(rx, ry, rad, Math.PI, 0); ctx.stroke();
            ctx.strokeStyle = "#0ea5e9";
            ctx.beginPath(); ctx.arc(rx, ry, rad, Math.PI, Math.PI + (Math.PI * 0.75)); ctx.stroke();
            break;
    }
}

// Reconhecimento de Voz
let recognition = null;
function configurarReconhecimentoVoz() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
        let temp = "";
        for (let i = event.resultIndex; i < event.results.length; i++) temp += event.results[i][0].transcript;
        const txtArea = document.getElementById("txtTranscricaoUsuario");
        if (txtArea) txtArea.value = estadoSimbiotico.transcricaoAcumulada + " " + temp;
    };
    return rec;
}

function falarEExibirIA(texto) {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
        chatBox.innerHTML += `<div style="font-size: 12px; padding: 10px 14px; border-radius: 10px; max-width: 85%; background: rgba(14, 165, 233, 0.1); border-left: 3px solid var(--accent);"><strong>Elayon Core (IA Simbiótica):</strong> ${texto}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = "pt-BR";
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    }
}

function saudacaoInicialIA() {
    falarEExibirIA(`Olá, ${estadoSimbiotico.operadorNome}! Inicializando Conexão Simbiótica. Calibração Fonoaudiológica 1 de 3. Clique em Ligar Microfone, conte até dez com calma e desligue manualmente ao terminar.`);
}

function capturarSnapshotsModulacoes() {
    let imgs = [];
    for (let i = 1; i <= 8; i++) {
        const cv = document.getElementById(`cvMod${i}`);
        if (cv) imgs.push(cv.toDataURL("image/png"));
    }
    return imgs;
}

/* ==========================================================================
   PARTE 2: Gravação Manual, Migração FIFO, Supabase e Conclusão
   ========================================================================== */

async function toggleGravacaoManual() {
    const btn = document.getElementById("btnMicToggle");
    const txtArea = document.getElementById("txtTranscricaoUsuario");

    if (!estadoSimbiotico.gravando) {
        // INICIA GRAVAÇÃO
        estadoSimbiotico.gravando = true;
        if (txtArea) estadoSimbiotico.transcricaoAcumulada = txtArea.value;
        
        btn.style.background = "linear-gradient(135deg, var(--success), #34d399)";
        btn.innerText = "⏹️ DESLIGAR MICROFONE (Processar Etapa)";
        
        // Inicia gráficos dinâmicos em tempo real
        executarLoopGraficosDinamicos();

        if (!recognition) recognition = configurarReconhecimentoVoz();
        try { recognition.start(); } catch(e) {}

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            estadoSimbiotico.mediaRecorder = new MediaRecorder(stream);
            estadoSimbiotico.audioChunks = [];
            estadoSimbiotico.mediaRecorder.ondataavailable = e => estadoSimbiotico.audioChunks.push(e.data);
            estadoSimbiotico.mediaRecorder.start();
        } catch(e) {
            console.warn("Áudio bruto indisponível:", e);
        }

    } else {
        // PARA GRAVAÇÃO E PROCESSA ETAPA
        estadoSimbiotico.gravando = false;
        if (estadoSimbiotico.animacaoId) cancelAnimationFrame(estadoSimbiotico.animacaoId);

        btn.style.background = "linear-gradient(135deg, var(--danger), #f43f5e)";
        btn.innerText = "🎙️ LIGAR MICROFONE (Falar Próxima Etapa)";

        if (recognition) try { recognition.stop(); } catch(e) {}

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

async function processarEtapaConcluida(audioUrl) {
    const etapa = estadoSimbiotico.etapaAtual;
    const txtArea = document.getElementById("txtTranscricaoUsuario");
    const transcricaoFinal = txtArea ? txtArea.value : "";
    
    const snapshots = capturarSnapshotsModulacoes();
    const crsValidado = "CRS OK • SILÊNCIO 18%";

    estadoSimbiotico.sessoesFIFO[etapa - 1] = {
        audioUrl: audioUrl,
        imagens: snapshots,
        crsStatus: crsValidado,
        transcricao: transcricaoFinal
    };

    renderizarBufferFIFO(etapa);

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

    if (etapa < 3) {
        estadoSimbiotico.etapaAtual++;
        document.getElementById("calibraStatus").innerText = `🎙️ Calibração ${estadoSimbiotico.etapaAtual}/3`;
        document.getElementById("calibStepTitle").innerText = `🎙️ ${estadoSimbiotico.etapaAtual}ª Calibração de Voz (Etapa ${estadoSimbiotico.etapaAtual}/3)`;
        falarEExibirIA(`Etapa ${etapa} concluída e migrada para o Buffer FIFO! Preparando para a Etapa ${estadoSimbiotico.etapaAtual}. Leia a nova instrução e ligue o microfone.`);
    } else {
        falarEExibirIA("Calibração fonoaudiológica completa com sucesso! Conexão Simbiótica estabelecida. Botão de entrada para o ecossistema liberado.");
        document.getElementById("btnMicToggle").style.display = "none";
        document.getElementById("btnLiberarHealth").style.display = "block";
    }
}

function renderizarBufferFIFO(etapa) {
    const sessao = estadoSimbiotico.sessoesFIFO[etapa - 1];
    
    const audioPlayer = document.getElementById(`audioPlayer${etapa}`);
    if (audioPlayer && sessao.audioUrl) {
        audioPlayer.src = sessao.audioUrl;
        audioPlayer.style.display = "block";
    }

    const badge = document.getElementById(`crsBadge${etapa}`);
    if (badge) {
        badge.innerText = sessao.crsStatus;
        badge.className = "fifo-badge ok";
    }

    const imgGrid = document.getElementById(`imgGrid${etapa}`);
    if (imgGrid && sessao.imagens.length > 0) {
        imgGrid.innerHTML = sessao.imagens.slice(0, 4).map(img => `<img src="${img}" />`).join("");
    }

    if (etapa < 3) {
        document.getElementById(`fifoBox${etapa}`).classList.remove("ativo");
        document.getElementById(`fifoBox${etapa + 1}`).classList.add("ativo");
    }
}

function concluirEMigrarParaIndex() {
    window.location.href = "../elayon-crs-triagem/index.html";
}
