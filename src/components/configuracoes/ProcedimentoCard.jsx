import React from 'react';
import { Stethoscope, Plus, Trash2, Loader2 } from 'lucide-react';

export function ProcedimentoCard({ procedimento, isVinculado, onVincular, onDesvincular, loading }) {
  const { nome, tipoCodigo, descricao } = procedimento;

  const cardClass = 'flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition-all hover:border-[#00a88e]/30';
  const labelClass = 'text-[11px] font-bold text-[#00a88e] uppercase tracking-wider';
  const titleClass = 'text-[15px] font-bold text-[#0f172a] line-clamp-1';
  const descClass = 'text-[13px] font-medium text-[#64748b] line-clamp-2 min-h-[40px]';

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4 text-[#00a88e]" strokeWidth={2.5} />
          <span className={labelClass}>{tipoCodigo || 'Procedimento'}</span>
        </div>
        {isVinculado ? (
          <span className="rounded-md bg-[#e6f7f5] px-1.5 py-0.5 text-[10px] font-bold text-[#00a88e]">
            Vinculado
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        <h3 className={titleClass} title={nome}>{nome}</h3>
        <p className={descClass} title={descricao || 'Sem descrição.'}>
          {descricao || 'Sem descrição.'}
        </p>
      </div>

      <div className="mt-auto pt-3 border-t border-[#e2e8f0]">
        {isVinculado ? (
          <button
            type="button"
            onClick={onDesvincular}
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remover do banco
          </button>
        ) : (
          <button
            type="button"
            onClick={onVincular}
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#f0fdfa] px-3 py-2 text-[12px] font-bold text-[#00a88e] transition-colors hover:bg-[#e6f7f5] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
            Adicionar ao banco
          </button>
        )}
      </div>
    </div>
  );
}
