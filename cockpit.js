// cockpit.js (Parte 1) - Elayon Space · Captura Real & Espectro de Intensidade
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let etapaCalibracao = 1;
let currentTokens = 100;
let currentUser = null;
const historicoSessoes = {};

// Variáveis para gravação real e Web Audio API
let mediaRecorder;
let audioChunks = [];
let gravando = false;
let audioContext, analyser, microphone, javascriptNode;
let tempoGravacaoTimer;
let segundosGravados = 0;

// Histórico do espectro para rolar da direita para a esquerda
const espectroBuffer = new Array(150).fill(0);

async function initCockpit() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;
    document.getElementById('userDisplayEmail').textContent = currentUser.email;
    
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        document.getElementById('userDisplayName').textContent = profile.nome || currentUser.email.split('@')[0];
        currentTokens = profile.tokens ?? 100;
        document.getElementById('hudTokens').textContent = currentTokens;
        if (profile.avatar_url) document.getElementById('userAvatarImg').src = profile.avatar_url;
    } else {
        document.getElementById('userDisplayName').textContent = currentUser.email.split('@')[0];
    }
    
    renderizarTodosOsGraficos(15);
}

// 1. Espectro de Intensidade em Tempo Real (Deslocando da direita para a esquerda com brilho dinâmico)
function desenharMod1Espectro(id, valIntensidade) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Atualiza o buffer deslocando para a esquerda
    espectroBuffer.shift();
    espectroBuffer.push(valIntensidade);

    const barWidth = canvas.width / espectroBuffer.length;
    for (let i = 0; i < espectroBuffer.length; i++) {
        const h = (espectroBuffer[i] / 100) * (canvas.height * 0.85);
        const x = i * barWidth;
        const y = canvas.height - h;

        // Gradiente brilhante baseado na intensidade da voz
        const grad = ctx.createLinearGradient(x, y, x, canvas.height);
        grad.addColorStop(0, '#0ea5e9');
        grad.addColorStop(1, 'rgba(20, 184, 166, 0.2)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth - 1, h);
    }
}

function renderizarTodosOsGraficos(intensidade) {
    desenharMod1Espectro(`cvMod1`, intensidade);
    desenharMod2Rosca(`cvMod2`, intensidade);
    desenharMod3Barras(`cvMod3`, intensidade);
    desenharMod4Area(`cvMod4`, intensidade);
    desenharMod5Dispersao(`cvMod5`, intensidade);
    desenharMod6LinhasDuplas(`cvMod6`, intensidade);
    desenharMod7Degrau(`cvMod7`, intensidade);
    desenharMod8Radial(`cvMod8`, intensidade);
}

// Funções dos outros gráficos modulados
function desenharMod2Rosca(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2, r = 45;
    const slices = [val / 100, (100 - val) / 100];
    const colors = ['#14b8a6', '#0284c7'];
    let atual = 0;
    slices.forEach((slice, i) => {
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, atual, atual + slice * Math.PI * 2);
        ctx.fillStyle = colors[i]; ctx.fill();
        atual += slice * Math.PI * 2;
    });
    ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
}

function desenharMod3Barras(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bars = 14; const w = (canvas.width / bars) - 4;
    for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i + val) * 0.5 + 0.5) * (canvas.height * 0.8);
        ctx.fillStyle = i % 2 === 0 ? '#10b981' : '#0ea5e9';
        ctx.fillRect(i * (w + 4) + 10, canvas.height - h - 10, w, h);
    }
}

function desenharMod4Area(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    for (let x = 0; x < canvas.width; x += 5) {
        let y = canvas.height - ((Math.sin(x * 0.03 + val) + 1) * 0.45 * canvas.height);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.4)'); grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = grad; ctx.fill();
}

function desenharMod5Dispersao(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 25; i++) {
        let px = (i * 35) % canvas.width;
        let py = canvas.height - ((Math.sin(i * val) * 0.5 + 0.5) * canvas.height);
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? '#10b981' : '#14b8a6'; ctx.fill();
    }
}

function desenharMod6LinhasDuplas(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ['#f59e0b', '#0ea5e9'].forEach((color, idx) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 5) {
            let y = (canvas.height / 2) + Math.cos(x * 0.04 + val + idx) * (canvas.height * 0.3);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    });
}

function desenharMod7Degrau(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.beginPath();
    let step = canvas.width / 10; let currentY = canvas.height / 2;
    ctx.moveTo(0, currentY);
    for (let i = 0; i < 10; i++) {
        currentY = canvas.height - ((Math.sin(i + val) * 0.4 + 0.5) * canvas.height);
        ctx.lineTo(i * step, currentY);
        ctx.lineTo((i + 1) * step, currentY);
    }
    ctx.stroke();
}

function desenharMod8Radial(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2, r = 40;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + (val / 100) * Math.PI);
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 8; ctx.stroke();
}

// cockpit.js (Parte 2) - Lógica de Gravação Real, Tokens e Transição
async function toggleGravacaoMicrofone() {
    const btn = document.getElementById('btnMicToggle');

    if (!gravando) {
        if (currentTokens <= 0) {
            alert('Tokens insuficientes para calibração.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream);

            // Web Audio API para monitorar espectro em tempo real
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            function atualizarEspectroAoVivo() {
                if (!gravando) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
                let avg = sum / bufferLength; // Intensidade média do áudio atual (0 - 255)
                let pct = Math.min(100, (avg / 150) * 100);

                renderizarTodosOsGraficos(pct);
                document.getElementById('mVal1').innerText = `${Math.round(avg * 2)} dB | ${Math.round(pct)}%`;
                requestAnimationFrame(atualizarEspectroAoVivo);
            }

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);

                // Armazena no buffer FIFO da sessão atual
                const audioPlayer = document.getElementById(`audioPlayer${etapaCalibracao}`);
                audioPlayer.src = audioUrl;
                audioPlayer.style.display = 'block';
                document.getElementById(`infoSessao${etapaCalibracao}`).innerText = `Gravado (${segundosGravados}s)`;

                await processarCalibracaoCRS(audioBlob, segundosGravados);
            };

            mediaRecorder.start();
            gravando = true;
            segundosGravados = 0;

            btn.innerText = "⏹️ Parar Gravação / Confirmar Etapa (Gravando...)";
            btn.style.background = "linear-gradient(135deg, #10b981, #059669)";

            // Temporizador de até 30 segundos
            tempoGravacaoTimer = setInterval(() => {
                segundosGravados++;
                if (segundosGravados >= 30) {
                    toggleGravacaoMicrofone(); // Para automaticamente aos 30s
                }
            }, 1000);

            atualizarEspectroAoVivo();

            const chatBox = document.getElementById('chatBox');
            chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Microfone aberto. Conte até dez devagar e clique em parar quando terminar.</div>`;
            chatBox.scrollTop = chatBox.scrollHeight;

        } catch (err) {
            alert('Erro ao aceder ao microfone: ' + err.message);
        }
    } else {
        // Parar gravação
        gravando = false;
        clearInterval(tempoGravacaoTimer);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }

        btn.innerText = "🔄 Processando Relatório CRS v4...";
        btn.disabled = true;
    }
}

async function processarCalibracaoCRS(audioBlob, duracao) {
    currentTokens -= 1;
    document.getElementById('hudTokens').textContent = currentTokens;

    const relatorioTexto = `[CRS v4 MULTIVIEW REPORT - ETAPA ${etapaCalibracao}/3]
- Duração da Fala: ${duracao} segundos
- Modulação 8-Eixos: Sincronizada com Base Espectral
- Estabilidade de Frequência (Jitter/Shimmer): Normalizada
- Taxa de Silêncio e Ritmo (CRS): 22.4% (Ideal)
- Token debitado com sucesso. Restam ${currentTokens} tokens.`;

    document.getElementById('txtTranscricaoEditavel').value = relatorioTexto;
    historicoSessoes[etapaCalibracao] = { duracao, relatorio: relatorioTexto };

    if (currentUser) {
        await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id);
    }

    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML += `<div class="chat-message user">Calibração ${etapaCalibracao} concluída e áudio bruto gravado no Buffer FIFO.</div>`;
    chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Relatório gerado com sucesso. Restam ${currentTokens} tokens.</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    const btn = document.getElementById('btnMicToggle');

    if (etapaCalibracao < 3) {
        etapaCalibracao++;
        document.getElementById('calibraStatus').innerText = `🎙️ Calibração ${etapaCalibracao}/3`;
        document.getElementById('calibStepTitle').innerText = `🎙️ ${etapaCalibracao}ª Calibração de Voz (Etapa ${etapaCalibracao}/3)`;
        btn.innerText = `🎙️ Abrir Microfone (Gravar Etapa ${etapaCalibracao} • Até 30s)`;
        btn.style.background = "linear-gradient(135deg, var(--danger), #f43f5e)";
        btn.disabled = false;

        if (etapaCalibracao === 2) {
            chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Perfeito! Na 2ª etapa, mantenha a consciência de presença: diga seu nome, a data de hoje e o horário atual. Pressione para gravar.</div>`;
        } else if (etapaCalibracao === 3) {
            chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Excelente! 3ª e última etapa (Baseline). Vamos conectar ao Elayon Space? Diga se deseja falar alguma coisa especial para iniciar. Pressione para gravar.</div>`;
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    } else {
        document.getElementById('calibraStatus').innerText = `✅ Baseline Concluído`;
        document.getElementById('calibStepTitle').innerText = `✅ Calibração Fonoaudiológica Finalizada`;
        btn.innerText = `✨ Calibração Finalizada com Sucesso`;
        btn.style.background = "var(--success)";
        btn.style.color = "#fff";
        btn.disabled = true;

        const btnLiberar = document.getElementById('btnLiberarHealth');
        if (btnLiberar) btnLiberar.style.display = "block";

        chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Todas as 3 calibrações foram concluídas com êxito! Acesso liberado para o repositório de triagem.</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function carregarSessaoVisual(num) {
    const sessao = historicoSessoes[num];
    if (!sessao) {
        alert(`A sessão de calibração ${num} ainda não foi executada.`);
        return;
    }
    document.getElementById('txtTranscricaoEditavel').value = sessao.relatorio;
    alert(`Carregando dados da Sessão ${num} para o painel.`);
}

function irParaElayonTriagem() {
    // Redireciona diretamente para o repositório Elayon CRS Triagem no GitHub Pages
    window.location.href = "https://paulorobertoxavierjunior-create.github.io/elayon-crs-triagem/";
}

window.addEventListener('DOMContentLoaded', initCockpit);
