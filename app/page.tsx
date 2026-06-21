"use client";
import Link from "next/link";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050708] text-[#dff0f0] px-6 font-sans">
      
      {/* Container de Apresentação */}
      <main className="w-full max-w-sm text-center space-y-8">
        
        {/* Título e Texto */}
        <div className="space-y-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#3ecfcf]">
            Apresentação Oficial
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white font-sans">
            ELAYON
          </h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed font-light">
            Plataforma interativa para testes de interface sensorial e calibração de voz.
          </p>
        </div>

        {/* Caixa de Status Simples */}
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4">
          <p className="font-mono text-[11px] text-slate-400">
            Ambiente estático carregado com sucesso.
          </p>
        </div>

        {/* Botão Simples para Avançar para a Outra Tela */}
        <div>
          <Link 
            href="/calibracao" 
            className="block w-full text-center py-4 rounded-xl bg-[#3ecfcf] text-[#050708] font-mono text-xs font-bold tracking-[0.2em] uppercase transition-all shadow-[0_4px_20px_rgba(62,207,207,0.2)] hover:opacity-90 active:scale-[0.98]"
          >
            AVANÇAR PARA CALIBRAÇÃO
          </Link>
        </div>

      </main>

    </div>
  );
}
