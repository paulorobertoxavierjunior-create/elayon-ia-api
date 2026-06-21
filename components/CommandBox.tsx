"use client";
import { useState } from "react";

interface CommandBoxProps {
  command: string;
  label?: string;
}

export default function CommandBox({ command, label }: CommandBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reseta o texto após 2 segundos
    } catch (err) {
      console.error("Falha ao copiar comando", err);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-4 font-mono">
      {/* Label opcional estilo Firebase (ex: "Passo 1: Instale a CLI") */}
      {label && (
        <span className="text-xs font-semibold text-slate-400 block mb-2 tracking-wide">
          {label}
        </span>
      )}

      {/* Caixa do Terminal */}
      <div className="relative flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 pl-4 pr-3 py-3.5 shadow-md shadow-black/40 backdrop-blur-md group hover:border-cyan-500/30 transition-all duration-300">
        
        {/* Linha do Comando com o sinal de prompt "$" */}
        <div className="flex items-center gap-2.5 text-xs text-slate-300 overflow-x-auto whitespace-nowrap scrollbar-none pr-12 select-all">
          <span className="text-cyan-500 font-bold select-none">$</span>
          <code className="text-emerald-400">{command}</code>
        </div>

        {/* Botão de Copiar Estilo Firebase */}
        <button
          onClick={handleCopy}
          className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider uppercase transition-all duration-200 ${
            copied
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copiado
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
