import React from 'react';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';

/**
 * Tabela pós-geração do plano — agendamento e ações por linha vêm em fatias futuras.
 * @param {{ linhas: Array<{ catalogoProcedimentoSaudeId: string, nomeProcedimento: string, pontosMapeados: number, quantidadeTotal: number }> }} props
 */
export function PlanejamentoPacoteTabela({ linhas = [] }) {
  const rows = Array.isArray(linhas) ? linhas : [];
  const total = rows.length;
  const agendados = 0;

  return (
    <div className="rounded-xl border border-app-border bg-white shadow-app-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-4">
        <div>
          <h4 className="text-[16px] font-bold text-app-ink">Planejamento do pacote</h4>
          <p className="mt-0.5 text-[12px] font-medium text-[#64748b]">
            Valide e agende cada procedimento antes de avançar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-[12px] font-semibold text-[#475569]">
            {agendados}/{total} agendados
          </span>
          <button
            type="button"
            disabled
            title="Disponível em versão futura"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#94a3b8] disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Procedimento
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
              <th className="px-5 py-3">Procedimento</th>
              <th className="px-5 py-3 w-28">Quantidade</th>
              <th className="px-5 py-3">Data · Profissional</th>
              <th className="px-5 py-3 w-24 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-[13px] font-medium text-[#64748b]">
                  Nenhum procedimento no plano.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const cor = corParaProcedimento(row.catalogoProcedimentoSaudeId);
                const nPontos = Number(row.pontosMapeados) || 0;
                const labelPontos = nPontos === 1 ? '1 ponto mapeado' : `${nPontos} pontos mapeados`;
                return (
                  <tr
                    key={row.catalogoProcedimentoSaudeId}
                    className="border-b border-[#e2e8f0] last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                          style={{ backgroundColor: cor }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-app-ink">{row.nomeProcedimento}</p>
                          <p className="text-[12px] font-medium text-[#64748b]">{labelPontos}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-md bg-[#e6f7f5] px-2.5 py-1 text-[13px] font-semibold text-[#00a88e]">
                        Σ {row.quantidadeTotal}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        disabled
                        title="Agendamento disponível na próxima etapa"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-[12px] font-semibold text-[#94a3b8] disabled:cursor-not-allowed"
                      >
                        <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                        Agendar
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled
                          title="Sessão de retorno — disponível em versão futura"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#94a3b8] disabled:cursor-not-allowed"
                          aria-label="Adicionar sessão de retorno"
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Remover procedimento — disponível em versão futura"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#94a3b8] disabled:cursor-not-allowed"
                          aria-label="Remover procedimento"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
