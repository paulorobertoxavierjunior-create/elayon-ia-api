"use client";
import Link from "next/link";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050708] text-[#dff0f0] px-6 font-sans relative overflow-hidden">
      {/* Gradiente de fundo sutil estilo Elayon */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(62,207,207,0.08)_0%,transparent_65%)]" />

      <main className="relative z-10 w-full max-w-sm text-center space-y-8">
        {/* Identificação da Marca */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#3ecfcf]">
            Ecosystem Core v2.0
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent font-sans">
            ELAYON
          </h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto font-light leading-relaxed">
            Bem-vindo ao sistema de processamento e interação por voz. Inicialize sua interface sensorial.
          </p>
        </div>

        {/* Caixa de Status Operacional */}
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-500">DIRETÓRIO:</span>
            <span className="text-emerald-400">PRONTO PARA OPERAR</span>
          </div>
        </div>

        {/* Botão de Entrada Principal (Avança para o percurso) */}
        <div>
          <Link href="/calibracao" className="block w-full text-center py-4 rounded-xl bg-[#3ecfcf] text-[#050708] font-mono text-xs font-bold tracking-[0.2em] uppercase transition-all duration-300 shadow-[0_4px_20px_rgba(62,207,207,0.25)] hover:shadow-[0_4px_30px_rgba(62,207,207,0.4)] active:scale-[0.98]">
            INICIAR CALIBRAÇÃO
          </Link>
          <p className="text-[9px] font-mono text-slate-600 mt-3 tracking-wider">
            REQUISITA ACESSO AO MICROFONE
          </p>
        </div>
      </main>

      <footer className="absolute bottom-6 font-mono text-[8px] tracking-widest text-slate-700">
        ELAYON CORE SYSTEM
      </footer>
    </div>
  );
}
