import React from 'react';
import { MapPin } from 'lucide-react';

import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { somaQuantidadeListaPontos } from '../../../utils/mapeamentoQuantidade.js';
import { normalizeUnidadeMedida } from '../../../constants/quantidadePresets.js';

export function PontosResumoPanel({ gruposPontos, gruposSessao, unidadeMedida, isModal = false }) {
  const grupos = Array.isArray(gruposPontos) ? gruposPontos : [];
  const gruposSessaoArr = Array.isArray(gruposSessao) ? gruposSessao : [];
  const unitSuffix = unidadeMedida ? ` ${normalizeUnidadeMedida(unidadeMedida)}` : '';

  const totalSessao = gruposSessaoArr.reduce(
    (acc, g) => {
      const pontosDaSessao = Object.values(g.pontosPorVista || {}).flat();
      return acc + somaQuantidadeListaPontos(pontosDaSessao);
    },
    0,
  );

  return (
    <div className={`flex min-h-0 flex-1 flex-col rounded-xl border border-app-border bg-white p-5 shadow-app-card ${isModal ? 'w-full max-w-sm max-h-[80vh]' : ''}`}>
      <h4 className="text-[13px] font-bold text-app-ink">
        Resumo de Insumos
      </h4>

      {grupos.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] px-4 py-6 text-center">
          <MapPin className="h-8 w-8 text-[#94a3b8]" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-[#64748b]">
            Nenhum ponto nesta vista.
          </p>
          <p className="text-[12px] font-medium text-[#94a3b8]">
            Arme um procedimento e clique na foto.
          </p>
        </div>
      ) : (
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {grupos.map((g) => {
            const cor = corParaProcedimento(g.catalogoProcedimentoSaudeId);
            const subtotal = somaQuantidadeListaPontos(g.pontos);
            return (
              <div key={g.catalogoProcedimentoSaudeId} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: cor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-app-ink">{g.nomeProcedimento}</span>
                  <span className="shrink-0 rounded-md bg-[#e6f7f5] px-2 py-0.5 text-[11px] font-semibold text-[#00a88e]">
                    Σ {subtotal}{unitSuffix}
                  </span>
                </div>
                <ul className="space-y-1 pl-5">
                  {(g.pontos || []).map((p) => (
                    <li key={p.localId} className="text-[12px] font-medium text-[#64748b]">
                      #{p.ordem} · {p.quantidade}{unitSuffix}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {gruposSessaoArr.length > 0 && (
        <div className="mt-4 border-t border-[#e2e8f0] pt-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
            <span>Total da Sessão</span>
            <span>(Todas as fotos)</span>
          </div>
          <div className="space-y-2">
            {gruposSessaoArr.map((g) => {
              const cor = corParaProcedimento(g.catalogoProcedimentoSaudeId);
              const pontosDaSessao = Object.values(g.pontosPorVista || {}).flat();
              const subtotalSessao = somaQuantidadeListaPontos(pontosDaSessao);
              if (subtotalSessao === 0) return null;
              
              return (
                <div key={g.catalogoProcedimentoSaudeId} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
                    <span className="text-[12px] font-semibold text-app-ink">{g.nomeProcedimento}</span>
                  </div>
                  <span className="text-[12px] font-bold text-app-accent-deep">
                    {subtotalSessao}{unitSuffix}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="text-[11px] font-bold text-[#64748b] uppercase">Total Geral</span>
            <span className="text-[13px] font-bold text-app-accent">{totalSessao}{unitSuffix}</span>
          </div>
        </div>
      )}
    </div>
  );
}
