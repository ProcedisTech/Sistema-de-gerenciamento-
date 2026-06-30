import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Modal de confirmação para navegação com alterações não salvas.
 * Sem window.confirm — overlay visual no padrão Procedi.
 *
 * @param {{
 *   isOpen: boolean,
 *   onContinue: () => void,
 *   onDiscard: () => void,
 *   message?: string,
 * }} props
 */
export function UnsavedChangesModal({ isOpen, onContinue, onDiscard, message }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onContinue}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
          </div>
          <h2
            id="unsaved-modal-title"
            className="text-[16px] font-bold text-[#0f172a]"
          >
            Alterações não salvas
          </h2>
        </div>

        <p className="mb-6 text-[14px] leading-relaxed text-[#475569]">
          {message ??
            'Você tem alterações não salvas no horário de atendimento. Deseja sair sem salvar?'}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20"
          >
            Sair sem salvar
          </button>
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="rounded-lg bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#008f78] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00a88e]/20"
          >
            Continuar editando
          </button>
        </div>
      </div>
    </div>
  );
}
