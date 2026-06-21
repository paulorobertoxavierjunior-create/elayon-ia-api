"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const FASES = [
  { label: 'Fase 01', texto: 'Iniciando processo de auto calibração. Lucidez. Conte até 10, tranquilamente. Finalize no botão vermelho e confirme.', fala: 'Iniciando processo de auto calibração. Lucidez. Conte até 10, tranquilamente. Finalize no botão vermelho e confirme.' },
  { label: 'Fase 02', texto: 'Respire fundo e lembre-se de quem você é. Fale o seu nome completo firmeza.', fala: 'Identifique-se. Diga o seu nome completo.' },
  { label: 'Fase 03', texto: 'Observe-se. Você faz parte de todo o processo. Pronto para se conectar ao seu sistema de captação sensorial?', fala: 'Pronto para se conectar ao seu sistema de captação sensorial?' }
];

export default function CalibracaoPage() {
  const [fase, setFase] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Toque para iniciar");
  const [timer, setTimer] = useState(0);
  const [estadoBtn, setEstadoBtn] = useState<"iniciar" | "gravando" | "confirmar">("iniciar");
  const [isFinalizado, setIsFinalizado] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Barras para a animação da onda (estilo o seu HTML original)
  const bars = [10, 20, 32, 24, 36, 24, 32, 20, 10];

  // Sintetizador de voz do Elayon Core
  const falar = (txt: string) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(txt);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Erro na síntese de voz", e);
    }
  };

  useEffect(() => {
    falar(FASES[fase - 1].fala);
    return () => window.speechSynthesis.cancel();
  }, [fase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      setTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);

      mediaRecorder.start(100);
      setIsRecording(true);
      setStatus("Gravando...");
      setEstadoBtn("gravando");
    } catch (err) {
      setStatus("Microfone bloqueado ou indisponível");
    }
  };

  const concluirEtapa = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);

    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          localStorage.setItem(`audio_fase_${fase}`, e.target.result as string);
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setStatus("Etapa concluída e salva!");
    setEstadoBtn("confirmar");
  };

  const confirmarEtapa = () => {
    if (fase < 3) {
      setFase((prev) => prev + 1);
      setEstadoBtn("iniciar");
      setStatus("Toque para iniciar");
      setTimer(0);
    } else {
      setIsFinalizado(true);
    }
  };

  const refazerEtapa = () => {
    localStorage.removeItem(`audio_fase_${fase}`);
    setEstadoBtn("iniciar");
    setStatus("Toque para iniciar");
    setTimer(0);
    falar(FASES[fase - 1].fala);
  };

  if (isFinalizado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050708] p-4 text-[#dff0f0] font-sans relative">
        <div className="w-full max-w-sm rounded-3xl border border-white/[0.06] bg-slate-900/40 p-6 backdrop-blur-xl shadow-2xl text-center">
          <span className="text-xs font-mono tracking-[0.3em] text-[#2a9d8f] uppercase block mb-4">Registros - Calibração</span>
          
          <div className="space-y-3 my-6">
            {[1, 2, 3].map((f) => (
              <div key={f} className="flex justify-between items-center py-3 border-b border-white/[0.04] last:border-none">
                <span className="text-xs font-mono text-slate-400">Fase 0{f} - Registro por Voz</span>
                <span className="text-xs text-[#2a9d8f] font-mono tracking-wider font-bold">SALVO EM CACHE ✓</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-mono text-left bg-slate-950/60 p-3 rounded-xl border border-white/[0.04] leading-relaxed mb-6">
            <span className="text-[#3ecfcf] font-bold">$</span> Tudo pronto localmente. Próximo passo: construir e conectar o painel Cockpit.
          </div>

          <Link href="/" className="block w-full py-4 rounded-xl bg-[#2a9d8f] text-white font-mono text-xs font-bold tracking-widest hover:opacity-90 transition shadow-lg shadow-teal-500/10">
            VOLTAR AO INÍCIO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050708] p-4 text-[#dff0f0] font-sans relative">
      <div className="w-full max-w-sm">
        
        {/* Barra de Progresso Superior */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i < fase ? "bg-[#2a9d8f] opacity-50" : i === fase ? "bg-[#3ecfcf] shadow-[0_0_10px_rgba(62,207,207,0.4)]" : "bg-white/[0.05]"
              }`}
            />
          ))}
        </div>

        {/* Caixa de Texto da Fase */}
        <div className="bg-slate-900/40 border border-white/[0.06] rounded-3xl p-6 mb-4 backdrop-blur-md">
          <span className="text-[10px] font-mono tracking-[0.3em] text-[#3ecfcf] uppercase block mb-3">{FASES[fase - 1].label}</span>
          <p className="text-base text-slate-200 font-sans leading-relaxed font-light">{FASES[fase - 1].texto}</p>
        </div>

        {/* Painel do Gravador */}
        <div className="bg-slate-900/40 border border-white/[0.06] rounded-3xl p-6 text-center backdrop-blur-md">
          <span className="text-[9px] font-mono tracking-[0.2em] text-[#3ecfcf] uppercase block mb-5">{status}</span>
          
          {/* Visualizador de Ondas Animado com Tailwind puro */}
          <div className="flex items-center justify-center gap-1.5 h-11 mb-6">
            {bars.map((height, i) => (
              <div
                key={i}
                style={{
                  height: `${height}px`,
                  animationDelay: isRecording ? `${(i > 4 ? 8 - i : i) * 0.1}s` : "0s",
                }}
                className={`w-1 rounded-full bg-[#3ecfcf] transition-all duration-300 ${
                  isRecording ? "animate-[pulse_1s_ease-in-out_infinite] opacity-100 shadow-[0_0_8px_rgba(62,207,207,0.4)]" : "opacity-10"
                }`}
              />
            ))}
          </div>

          {/* Cronômetro */}
          <div className="text-4xl font-mono tracking-[0.15em] text-slate-100 font-bold mb-6">{formatTime(timer)}</div>

          {/* Controle de Botões Dinâmicos */}
          {estadoBtn === "iniciar" && (
            <button onClick={iniciarGravacao} className="w-full py-4 rounded-xl bg-[#3ecfcf] text-[#050708] font-mono text-xs font-bold tracking-[0.2em] shadow-lg shadow-cyan-400/10 active:scale-95 transition-all">
              INICIAR GRADAÇÃO
            </button>
          )}

          {estadoBtn === "gravando" && (
            <button onClick={concluirEtapa} className="w-full py-4 rounded-xl bg-[#ef4444] text-white font-mono text-xs font-bold tracking-[0.2em] animate-pulse shadow-lg shadow-red-500/20 active:scale-95 transition-all">
              CONCLUIR ETAPA
            </button>
          )}

          {estadoBtn === "confirmar" && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400 text-left font-mono tracking-wide">Etapa gravada. Continuar ou refazer?</p>
              <button onClick={confirmarEtapa} className="w-full py-4 rounded-xl bg-[#3ecfcf] text-[#050708] font-mono text-xs font-bold tracking-[0.2em] active:scale-95 transition-all shadow-lg shadow-cyan-400/10">
                CONFIRMAR
              </button>
              <button onClick={refazerEtapa} className="w-full py-3 rounded-xl border border-white/[0.06] bg-transparent text-slate-500 font-mono text-[10px] tracking-widest uppercase hover:text-slate-300 transition-all">
                REFAZER
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
