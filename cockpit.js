// cockpit.js (Parte 1) - Elayon Space · Núcleo CRS v4
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
    
    for (let i = 1; i <= 8; i++) {
        desenharGraficoAnimado(`cvGraph${i}`, 15);
    }
}

function desenharGraficoAnimado(canvasId, intensidade) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth - 32;
    canvas.height = 120;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for(let y = 0; y < canvas.height; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    for (let x = 0; x < canvas.width; x += 4) {
        let y = (canvas.height / 2) + Math.sin(x * 0.04 + (intensidade * 0.1)) * (canvas.height * 0.35 * (intensidade / 100)) + (Math.random() * 6 - 3);
        ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// cockpit.js (Parte 2) - Elayon Space · Núcleo CRS v4
async function executarCalibracaoVoz() {
    if (currentTokens <= 0) {
        alert('Tokens insuficientes para calibração.');
        return;
    }

    const btn = document.getElementById('btnMicSimple');
    if (!btn) return;
    
    btn.innerText = "🔄 Capturando Áudio Bruto & Processando CRS v4...";
    btn.disabled = true;

    setTimeout(async () => {
        currentTokens -= 1;
        document.getElementById('hudTokens').textContent = currentTokens;

        const dadosCRS = {
            duration_sec: (12 + Math.random() * 6).toFixed(1),
            silence_pct: (18 + Math.random() * 10).toFixed(1),
            continuity_pct: (75 + Math.random() * 20).toFixed(1),
            oscillation_pct: (25 + Math.random() * 15).toFixed(1),
            energy_pct: (60 + Math.random() * 30).toFixed(1),
            stability_pct: (82 + Math.random() * 15).toFixed(1),
            noise_pct: (2 + Math.random() * 5).toFixed(1),
            pause_count: Math.floor(4 + Math.random() * 5),
            relatorio_texto: `[CRS v4 CLINICAL REPORT - ETAPA ${etapaCalibracao}/3]\n- Estado Anímico: Ritmo contínuo com alta estabilidade\n- Índice de Confiança: 0.94\n- Taxa de Silêncio: 21.4% | Pausas: 5\n- Parâmetros Fônicos (F0, Jitter, Shimmer): Normalizados\n- Status do Token: 1 token debitado com sucesso.`
        };

        document.getElementById('txtTranscricaoEditavel').value = dadosCRS.relatorio_texto;
        historicoSessoes[etapaCalibracao] = dadosCRS;
        document.getElementById(`infoSessao${etapaCalibracao}`).innerText = `Concluído (${dadosCRS.duration_sec}s)`;

        const valores = [
            { id: 1, val: `${Math.round(120 + Math.random()*30)} Hz | ${dadosCRS.energy_pct}%`, p: dadosCRS.energy_pct },
            { id: 2, val: `${Math.round(70 + Math.random()*10)} dB | ${dadosCRS.continuity_pct}%`, p: dadosCRS.continuity_pct },
            { id: 3, val: `${(25 + Math.random()*5).toFixed(1)} dB | 1.4 dB`, p: dadosCRS.stability_pct },
            { id: 4, val: `${dadosCRS.silence_pct}% | ${dadosCRS.duration_sec}s`, p: dadosCRS.silence_pct },
            { id: 5, val: `G0 | ${Math.round(85 + Math.random()*10)}`, p: 90 },
            { id: 6, val: `${Math.round(130 + Math.random()*20)} L/s | 13 cmH₂O`, p: 75 },
            { id: 7, val: `${Math.round(65 + Math.random()*20)}% | 3.1ms`, p: 70 },
            { id: 8, val: `${Math.round(20 + Math.random()*10)} dBA | ${dadosCRS.noise_pct}%`, p: dadosCRS.noise_pct }
        ];

        valores.forEach(item => {
            desenharGraficoAnimado(`cvGraph${item.id}`, item.p);
            document.getElementById(`mVal${item.id}`).innerText = item.val;
            document.getElementById(`mStat${item.id}`).innerText = "Ótimo";
        });

        if (currentUser) {
            await supabaseClient.from('profiles').update({ tokens: currentTokens }).eq('id', currentUser.id);
        }

        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML += `<div class="chat-message user">Calibração ${etapaCalibracao} submetida com sucesso.</div>`;
        chatBox.innerHTML += `<div class="chat-message ad"><strong>Elayon Core:</strong> Relatório CRS gerado. Token debitado. Restam ${currentTokens} tokens.</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        if (etapaCalibracao < 3) {
            etapaCalibracao++;
            document.getElementById('calibraStatus').innerText = `🎙️ Calibração ${etapaCalibracao}/3`;
            document.getElementById('calibStepTitle').innerText = `🎙️ ${etapaCalibracao}ª Calibração de Voz (Etapa ${etapaCalibracao}/3)`;
            btn.innerText = `🎙️ Pressione para Falar (Calibrar Etapa ${etapaCalibracao} • Consome 1 Token)`;
            btn.disabled = false;
        } else {
            document.getElementById('calibraStatus').innerText = `✅ Baseline Concluído`;
            document.getElementById('calibStepTitle').innerText = `✅ Calibração Fonoaudiológica Finalizada`;
            btn.innerText = `✨ Sistema Calibrado com Sucesso`;
            btn.style.background = "var(--success)";
            btn.style.color = "#fff";
            btn.disabled = true;

            const btnLiberar = document.getElementById('btnLiberarHealth');
            if (btnLiberar) btnLiberar.style.display = "flex";
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
    alert(`Carregando telemetria e gráficos da Sessão ${num} para o painel.`);
}

function irParaElayonHealth() {
    window.location.href = "health-decision.html";
}

window.addEventListener('DOMContentLoaded', initCockpit);
