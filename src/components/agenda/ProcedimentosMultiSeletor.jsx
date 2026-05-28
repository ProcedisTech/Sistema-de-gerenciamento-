import React from 'react';
import { Plus } from 'lucide-react';

// STUB — Checkpoint 2 implementará multi-seleção real com chips, duração por proc e catálogo.
export function ProcedimentosMultiSeletor({ procedimentoOptions: _procedimentoOptions, onAbrirPainelB }) {
  return (
    <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3 py-2">
      <span className="text-xs text-ink-400">Nenhum procedimento selecionado</span>
      <button
        type="button"
        onClick={() => onAbrirPainelB?.()}
        className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-vivid-teal-700 hover:bg-vivid-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar
      </button>
    </div>
  );
}
