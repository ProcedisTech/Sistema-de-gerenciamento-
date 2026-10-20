import React from 'react';
import { X } from 'lucide-react';
import { ViewportDialog } from '../shared/ViewportDialog.jsx';
import { PacienteSearchInput } from '../agenda/PacienteSearchInput.jsx';

const TITULO_ID = 'atalho-consulta-busca-titulo';

/**
 * Busca de paciente do atalho da consulta (V1, sem consulta aberta).
 * @param {{ open: boolean, onClose: () => void, onEscolher: (paciente: object) => void }} props
 */
export function AtalhoConsultaBusca({ open, onClose, onEscolher }) {
  return (
    <ViewportDialog open={open} onDismiss={onClose} titleId={TITULO_ID}>
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <h2 id={TITULO_ID} className="text-[15px] font-semibold text-[#0f172a]">
          Iniciar consulta
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-[18rem] px-4 py-4" data-dialog-initial-focus tabIndex={-1}>
        <PacienteSearchInput
          value=""
          onChange={(_id, paciente) => {
            if (paciente?.id) onEscolher(paciente);
          }}
        />
      </div>
    </ViewportDialog>
  );
}
