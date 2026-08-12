import React from 'react';
import { CheckSquare, Square, Loader2 } from 'lucide-react';

/**
 * Checklist de permissões agrupadas por módulo. Reaproveitado no modal "Novo Perfil"
 * (GestaoPerfisTab) e nos modais de criar/editar membro (InviteModal, EditRoleModal).
 */
export function PermissoesPorModuloPanel({ permissoes, selecionadas, onChange, disabled = false, loading = false, columns = 2, showModuloActions = false, onToggleModulo }) {
  const permissoesPorModulo = (permissoes || []).reduce((acc, perm) => {
    const mod = perm.modulo || 'Geral';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(permissoesPorModulo).map(([modulo, perms]) => {
        const ativasNoModulo = perms.filter(p => (selecionadas || []).includes(p.permissaoId)).length;
        const todosSelecionados = ativasNoModulo === perms.length;
        return (
        <div key={modulo}>
          <h5 className="sticky top-0 z-10 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100 shadow-sm">
            <span className="flex items-center gap-2">
              {modulo}
              {showModuloActions && (
                <button
                  type="button"
                  onClick={() => onToggleModulo?.(perms.map(p => p.permissaoId), !todosSelecionados)}
                  className="normal-case tracking-normal font-semibold text-teal-600 hover:text-teal-700"
                >
                  {todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
            </span>
            <span className={`font-semibold normal-case tracking-normal ${todosSelecionados && perms.length > 0 ? 'text-teal-600' : 'text-slate-400'}`}>{ativasNoModulo}/{perms.length}</span>
          </h5>
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''} gap-2 pl-1`}>
            {perms.map(p => {
              const checked = (selecionadas || []).includes(p.permissaoId);
              return (
                <label
                  key={p.permissaoId}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-teal-200 bg-teal-50/40 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                >
                  <div className="mt-0.5 text-teal-600 shrink-0">
                    {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[13px] font-bold ${checked ? 'text-teal-900' : 'text-slate-700'}`}>{p.nome}</span>
                    {p.descricao && <span className="text-[11px] text-slate-500 leading-snug mt-1">{p.descricao}</span>}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(p.permissaoId, e.target.checked)}
                  />
                </label>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
