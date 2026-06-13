import React, { useMemo } from 'react';
import {
  calcResumoProtocolo,
  formatDataLongaPt,
  formatValorBrl,
} from '../../utils/planejamentoDraftUtils.js';

export function PlanoProtocoloResumo({ itens }) {
  const resumo = useMemo(() => calcResumoProtocolo(itens), [itens]);

  const periodoLabel =
    resumo.periodo.inicio && resumo.periodo.fim
      ? `${formatDataLongaPt(resumo.periodo.inicio)} → ${formatDataLongaPt(resumo.periodo.fim)}`
      : '—';

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fbfb] p-2.5">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
        Resumo do protocolo
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-medium text-[#94a3b8]">Total de Procedimentos</p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[#0f172a]">
            {resumo.total}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#94a3b8]">Período do Tratamento</p>
          <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#0f172a]">
            {periodoLabel}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#94a3b8]">Valor Total</p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums text-[#0f766e]">
            {formatValorBrl(resumo.valorTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
