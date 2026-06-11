import React from 'react';

/** Placeholder v1 — textarea local, sem persistência. */
export function PlanejamentoPlaceholder({ onVoltar }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] font-bold text-[#0f172a] sm:text-[20px]">Planejamento</h2>
      <textarea
        rows={8}
        placeholder="Rascunho do plano de tratamento…"
        className="w-full resize-y rounded-xl border border-app-border bg-[#f8fbfb] px-4 py-3 text-[14px] text-[#0f172a] outline-none transition-all placeholder:text-[#94a3b8] focus:border-[#00a88e]/40 focus:ring-4 focus:ring-[#00a88e]/10"
      />
      <button
        type="button"
        onClick={() => onVoltar?.()}
        className="self-start rounded-xl border border-app-border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active"
      >
        Voltar ao hub
      </button>
    </div>
  );
}
