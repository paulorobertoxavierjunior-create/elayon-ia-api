// cockpit.js (Parte 1) - Elayon Space · Núcleo CRS v4 Multiview
const SUPABASE_URL = 'https://xlktkelumtpugidnecbj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let etapaCalibracao = 1;
let currentTokens = 100;
let currentUser = null;
const historicoSessoes = {};

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
    
    renderizarTodosOsGraficos(20);
}

function renderizarTodosOsGraficos(intensidade) {
    desenharMod1Onda(`cvMod1`, intensidade);
    desenharMod2Rosca(`cvMod2`, intensidade);
    desenharMod3Barras(`cvMod3`, intensidade);
    desenharMod4Area(`cvMod4`, intensidade);
    desenharMod5Dispersao(`cvMod5`, intensidade);
    desenharMod6LinhasDuplas(`cvMod6`, intensidade);
    desenharMod7Degrau(`cvMod7`, intensidade);
    desenharMod8Radial(`cvMod8`, intensidade);
}

// 1. Onda Contínua (FFT)
function desenharMod1Onda(id, val) {
    const canvas = document.getElementById(id); if (!canvas) return;
    const ctx = canvas.getContext('2d'); canvas.width = canvas.parentElement.clientWidth - 32; canvas.height = 130;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    for (let x = 0; x < canvas.width; x += 4) {
        let y = (canvas.height / 2) + Math.sin(x * 0.05 + (val * 0.1)) * (canvas.height * 0.35 * (val / 100));
        ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// 2. Gráfico de Rosca / Pizza Modular
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
    // Furo central da rosca
    ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
}

// 3. Espectrograma em Barras Verticais
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

// 4. Área com Gradiente
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

// 5. Dispersão Vetorial (Pontos)
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

// 6. Linhas Duplas Oscilatórias
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

// 7. Histograma em Degrau
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

// 8. Medidor Radial Progressivo
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


// cockpit.js (Parte 2) - Elayon Space · Lógica e Transição
async function executarCalibracaoVoz() {
    if (currentTokens <= 0) {
        alert('Tokens insuficientes para calibração.');
        return;
    }

    const btn = document.getElementById('btnMicSimple');
    if (!btn) return;
    
    btn.innerText = "🔄 Processando Telemetria Multimodal no CRS v4...";
    btn.disabled = true;

    setTimeout(async () => {
        currentTokens -= 1;
        document.getElementById('hudTokens').textContent = currentTokens;

        const dadosCRS = {
            duration_sec: (14 + Math.random() * 5).toFixed(1),
            silence_pct: (19 + Math.random() * 8).toFixed(1),
            continuity_pct: (78 + Math.random() * 15).toFixed(1),
            oscillation_pct: (28 + Math.random() * 12).toFixed(1),
            energy_pct: (65 + Math.random() * 25).toFixed(1),
            stability_pct: (85 + Math.random() * 12).toFixed(1),
            noise_pct: (3 + Math.random() * 4).toFixed(1),
            relatorio_texto: `[CRS v4 MULTIVIEW REPORT - ETAPA ${etapaCalibracao}/3]\n- Modulação 8-Eixos: Sincronizada\n- Estabilidade Espectral: 0.96\n- Token debitado com sucesso. Restam ${currentTokens} tokens.`
        };

        document.getElementById('txtTranscricaoEditavel').value = dadosCRS.relatorio_texto;
        historicoSessoes[etapaCalibracao] = dadosCRS;
        document.getElementById(`infoSessao${etapaCalibracao}`).innerText = `Concluído (${dadosCRS.duration_sec}s)`;

        // Atualiza os valores e re-renderiza os 8 gráficos com a nova intensidade
        const pVal = parseFloat(dadosCRS.energy_pct);
        renderizarTodosOsGraficos(pVal);

        document.getElementById('mVal1').innerText = `130 Hz | ${dadosCRS.energy_pct}%`;
        document.getElementById('mVal2').innerText = `72 dB | ${dadosCRS.continuity_pct}%`;
        document.getElementById('mVal3').innerText = `28.1 dB | 1.2 dB`;
        document.getElementById('mVal4').innerText = `${dadosCRS.silence_pct}% | ${dadosCRS.duration_sec}s`;
        document.getElementById('mVal5').innerText = `G0 | 92`;
        document.getElementById('mVal6').innerText = `138 L/s | 12.5 cmH₂O`;
        document.getElementById('mVal7').innerText = `70% | 2.8ms`;
        document.getElementById('mVal8').innerText = `22 dBA | ${dadosCRS.noise_pct}%`;

        for(let i=1; i<=8; i++) {
            document.getElementById(`mStat${i}`).innerText = "Ativo";
        }

        if (currentUser) {
            await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id);
        }

        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML += `<div class="chat-message user">Calibração ${etapaCalibracao} submetida com sucesso.</div>`;
        chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> 8 Modulações atualizadas via CRS v4. Token debitado.</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        if (etapaCalibracao < 3) {
            etapaCalibracao++;
            document.getElementById('calibraStatus').innerText = `🎙️ Calibração ${etapaCalibracao}/3`;
            document.getElementById('calibStepTitle').innerText = `🎙️ ${etapaCalibracao}ª Calibração de Voz (Etapa ${etapaCalibracao}/3)`;
            btn.innerText = `🎙️ Pressione para Falar (Calibrar Etapa ${etapaCalibracao} • Consome 1 Token)`;
            btn.disabled = false;
        } else {
            document.getElementById('calibraStatus').innerText = `✅ Baseline Multimodal Concluído`;
            document.getElementById('calibStepTitle').innerText = `✅ Calibração Fonoaudiológica Completa`;
            btn.innerText = `✨ Sistema Calibrado com Sucesso`;
            btn.style.background = "var(--success)";
            btn.style.color = "#fff";
            btn.disabled = true;

            const btnLiberar = document.getElementById('btnLiberarHealth');
            if (btnLiberar) btnLiberar.style.display = "block";
        }
    }, 1200);
}

function carregarSessaoVisual(num) {
    const sessao = historicoSessoes[num];
    if (!sessao) {
        alert(`A sessão de calibração ${num} ainda não foi executada.`);
        return;
    }
    document.getElementById('txtTranscricaoEditavel').value = sessao.relatorio_texto;
    alert(`Carregando telemetria das 8 modulações da Sessão ${num}.`);
}

function irParaElayonHealth() {
    window.location.href = "health-decision.html";
}

window.addEventListener('DOMContentLoaded', initCockpit);
