import React, { useState } from 'react';
import { CheckSquare, Square, Loader2, ChevronDown } from 'lucide-react';

// Apenas as permissões de visualização raiz dos módulos são ocultadas como checkbox individual
// e marcadas automaticamente ao expandir o módulo pelo botão "Ver".
// Permissões funcionais específicas (ex: PACIENTE_GALERIA_VER, ANAMNESE_PREENCHIMENTO_VER,
// AGENDA_MULTI_VER, AGENDA_PROPRIA_VER, PACIENTE_NOTA_VER, PACIENTE_DOCUMENTO_VER,
// PACIENTE_ORCAMENTO_VER, PERFIL_ACESSO_VER e todas as etapas de Atendimento)
// permanecem visíveis como checkboxes de controle explícito pelo usuário.
const PERMISSOES_RAIZ_MODULO = new Set([
  'AGENDA_VER',
  'PACIENTE_VER',
  'PRONTUARIO_VER',
  'CATALOGO_VER',
  'DOC_MODELO_VER',
  'ANAMNESE_MODELO_VER',
  'USUARIO_VER',
  'NOTIFICACAO_VER',
  'AUDITORIA_VER',
]);

const ehPermissaoRaizModulo = (p) => PERMISSOES_RAIZ_MODULO.has((p.codigo || '').toUpperCase());

/**
 * Checklist de permissões agrupadas por módulo. Reaproveitado no modal "Novo Perfil"
 * (GestaoPerfisTab) e nos modais de criar/editar membro (InviteModal, EditRoleModal).
 *
 * Em modo editável (disabled=false), cada módulo vem fechado e só mostra as permissões
 * de ação e funcionais. Abrir o módulo pelo botão "Ver" já marca sozinho a permissão
 * raiz "_VER" daquele módulo (ex: PRONTUARIO_VER, AGENDA_VER) — não faz sentido dar acesso
 * pra mexer em algo sem poder ver aquele algo. Permissões de escopo funcional específico
 * (como fotos, respostas de anamnese e etapas do atendimento) ficam visíveis para seleção.
 */
export function PermissoesPorModuloPanel({ permissoes, selecionadas, onChange, disabled = false, loading = false, columns = 2, showModuloActions = false, onToggleModulo }) {
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set());

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

  const alternarGrupo = (modulo, perms) => {
    setGruposAbertos(prev => {
      const next = new Set(prev);
      if (next.has(modulo)) {
        next.delete(modulo);
        return next;
      }
      next.add(modulo);
      const idsRaiz = perms.filter(ehPermissaoRaizModulo).map(p => p.permissaoId);
      if (idsRaiz.length) {
        if (onToggleModulo) {
          onToggleModulo(idsRaiz, true);
        } else {
          idsRaiz.forEach(id => {
            if (!(selecionadas || []).includes(id)) onChange(id, true);
          });
        }
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {Object.entries(permissoesPorModulo).map(([modulo, perms]) => {
        const aberto = disabled || gruposAbertos.has(modulo);
        // Em modo editável, apenas a permissão raiz de visualização do módulo some
        // da lista de checkboxes (marcada automaticamente ao abrir o grupo). Em modo
        // somente leitura (preview de nível/perfil) mostra tudo, já que não há nada pra "abrir".
        const permsExibidas = disabled ? perms : perms.filter(p => !ehPermissaoRaizModulo(p));
        // Contador e "Marcar/Desmarcar todos" refletem só o que o usuário vê e controla —
        // a "_VER" auto-marcada não entra na conta pra não confundir (ex: "1/4" com só 3
        // checkboxes visíveis).
        const ativasNoModulo = permsExibidas.filter(p => (selecionadas || []).includes(p.permissaoId)).length;
        const todosSelecionados = permsExibidas.length > 0 && ativasNoModulo === permsExibidas.length;
        return (
        <div key={modulo}>
          <h5 className="sticky top-0 z-10 flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100 shadow-sm">
            <span className="flex items-center gap-2">
              {modulo}
              {showModuloActions && aberto && (
                <button
                  type="button"
                  onClick={() => onToggleModulo?.(permsExibidas.map(p => p.permissaoId), !todosSelecionados)}
                  className="normal-case tracking-normal font-semibold text-teal-600 hover:text-teal-700"
                >
                  {todosSelecionados ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className={`font-semibold normal-case tracking-normal ${todosSelecionados ? 'text-teal-600' : 'text-slate-400'}`}>{ativasNoModulo}/{permsExibidas.length}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => alternarGrupo(modulo, perms)}
                  className="flex shrink-0 items-center gap-1 normal-case tracking-normal font-semibold text-teal-700 hover:text-teal-800"
                >
                  {aberto ? 'Ocultar' : 'Ver'}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                </button>
              )}
            </span>
          </h5>
          {aberto && (
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''} gap-2 pl-1`}>
              {permsExibidas.map(p => {
                const checked = (selecionadas || []).includes(p.permissaoId);
                return (
                  <label
                    key={p.permissaoId}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-teal-200 bg-teal-50/40 shadow-sm' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
                  >
                    <div className="mt-0.5 text-teal-600 shrink-0">
                      {checked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-500" />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-bold ${checked ? 'text-teal-900' : 'text-slate-900'} flex items-center gap-1.5 flex-wrap`}>
                        {p.nome}
                        {p.codigo === 'AGENDA_APARECER' && (
                          <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-300">
                            📅 Atende na Agenda
                          </span>
                        )}
                      </span>
                      {p.descricao && <span className="text-[11px] text-slate-600 leading-snug mt-1">{p.descricao}</span>}
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
          )}
        </div>
        );
      })}
    </div>
  );
}
