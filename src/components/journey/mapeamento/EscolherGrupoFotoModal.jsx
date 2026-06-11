import React from 'react';
import { PersonStanding, ScanFace, X } from 'lucide-react';

export function EscolherGrupoFotoModal({ open, onSelectGrupo, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grupo-foto-title"
        className="w-full max-w-md rounded-2xl border border-app-border bg-white p-6 shadow-app-card"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 id="grupo-foto-title" className="text-[17px] font-bold text-app-ink">
            Rosto ou Corpo?
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#64748b] hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 text-[13px] font-medium text-[#64748b]">
          Escolha a região para associar a foto à vista correta.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectGrupo?.('rosto')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-app-border bg-[#f8fafc] p-6 transition-all hover:border-app-accent hover:bg-app-nav-active"
          >
            <div className="rounded-xl bg-app-nav-active p-3 text-app-accent">
              <ScanFace className="h-8 w-8" strokeWidth={1.75} />
            </div>
            <span className="text-[15px] font-bold text-app-ink">Rosto</span>
            <span className="text-center text-[12px] font-medium text-[#64748b]">Frontal, perfis, detalhes faciais…</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectGrupo?.('corpo')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-app-border bg-[#f8fafc] p-6 transition-all hover:border-app-accent hover:bg-app-nav-active"
          >
            <div className="rounded-xl bg-app-nav-active p-3 text-app-accent">
              <PersonStanding className="h-8 w-8" strokeWidth={1.75} />
            </div>
            <span className="text-[15px] font-bold text-app-ink">Corpo</span>
            <span className="text-center text-[12px] font-medium text-[#64748b]">Frontal, lateral, abdômen, mãos…</span>
          </button>
        </div>
      </div>
    </div>
  );
}
