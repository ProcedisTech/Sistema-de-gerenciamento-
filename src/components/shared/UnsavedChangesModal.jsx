import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ViewportDialog } from './ViewportDialog.jsx';

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
  return (
    <ViewportDialog open={isOpen} onDismiss={onContinue} titleId="unsaved-modal-title">
      <div className="px-5 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
          </div>
          <h2 id="unsaved-modal-title" className="text-[16px] font-bold text-[#0f172a]">
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
            data-dialog-initial-focus
            onClick={onContinue}
            className="rounded-lg bg-[#00a88e] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#008f78] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00a88e]/20"
          >
            Continuar editando
          </button>
        </div>
      </div>
    </ViewportDialog>
  );
}
