import React from 'react';
import { Plus, X } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

function badgeTipo(tipoCodigo) {
  if (tipoCodigo === 'avaliacao') return 'Avaliação';
  if (tipoCodigo === 'retorno') return 'Retorno';
  return null;
}

export function ProcedimentosMultiSeletor({ procedimentos, onRemover, onAbrirPainelB, readOnly, showAdicionar = true }) {
  const podeAdicionar = !readOnly && showAdicionar && typeof onAbrirPainelB === 'function';

  if (!procedimentos || procedimentos.length === 0) {
    return (
      <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3 py-2">
        <span className="text-xs text-[#6b7280]">Nenhum procedimento selecionado</span>
        {podeAdicionar && (
          <button
            type="button"
            onClick={() => onAbrirPainelB?.()}
            className={`ml-auto inline-flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-vivid-teal-700 hover:bg-vivid-teal-100 ${FOCUS_RING}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 bg-white">
      <ul className="max-h-[7.5rem] divide-y divide-ink-100 overflow-y-auto overscroll-contain">
        {procedimentos.map((proc) => {
          const cor = gerarCorAvatar(proc.nome);
          const iniciais = iniciaisDoNome(proc.nome);
          const badge = badgeTipo(proc.tipoCodigo);

          return (
            <li key={proc.id} className="flex items-center gap-2 px-3 py-1">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${cor.bg} ${cor.fg}`}
              >
                {iniciais}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="truncate text-xs font-medium text-ink-800">{proc.nome}</span>
                  {badge && (
                    <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-500">
                      {badge}
                    </span>
                  )}
                </div>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemover?.(proc.id)}
                  className={`inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md p-2 text-[#6b7280] hover:bg-red-50 hover:text-red-500 ${FOCUS_RING}`}
                  aria-label={`Remover ${proc.nome}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {podeAdicionar && (
        <div className="flex items-center justify-end border-t border-ink-100 px-3 py-1">
          <button
            type="button"
            onClick={() => onAbrirPainelB?.()}
            className={`inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 ${FOCUS_RING}`}
          >
            <Plus className="h-3 w-3" />
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}
