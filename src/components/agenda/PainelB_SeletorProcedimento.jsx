import React from 'react';
import { ArrowLeft } from 'lucide-react';

// STUB — Checkpoint 2 implementará catálogo de procedimentos com busca e chips por categoria.
export function PainelB_SeletorProcedimento({ procedimentoOptions, onVoltar }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onVoltar?.()}
          className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
          aria-label="Voltar para horários"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink-800">Selecionar procedimento</span>
      </div>

      <div className="space-y-1">
        {(procedimentoOptions || []).map((proc) => (
          <div
            key={proc.id}
            className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-700"
          >
            <span>{proc.nomeProcedimento || proc.nome}</span>
            {proc.duracaoMin && (
              <span className="text-xs text-ink-400">{proc.duracaoMin} min</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-ink-400">
        Implementação completa no Checkpoint 2
      </p>
    </div>
  );
}
