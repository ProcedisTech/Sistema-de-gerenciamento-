import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Linha de resumo "X de Y permissões ativas" + barra de progresso + botão para
 * expandir/recolher o PermissoesPorModuloPanel sob demanda (InviteModal, EditRoleModal).
 */
export function PermissoesResumoToggle({ ativas, total, expandido, onToggle, disabled = false, readOnly = false }) {
  const pct = total > 0 ? Math.round((ativas / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/70 border border-slate-100 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-slate-700">{ativas} de {total} permissões ativas</p>
        <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {!disabled && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expandido}
          className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[#046a58] hover:text-[#00a88e] transition-colors"
        >
          {expandido ? 'Ocultar permissões' : (readOnly ? 'Ver permissões' : 'Editar permissões')}
          <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
