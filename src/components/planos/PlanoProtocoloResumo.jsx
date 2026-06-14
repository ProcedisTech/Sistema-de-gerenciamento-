import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import {
  calcResumoProtocolo,
  formatDataLongaPt,
  formatValorBrl,
} from '../../utils/planejamentoDraftUtils.js';

function resolvePeriodoBackend(plano) {
  const inicio =
    plano?.periodoInicio ?? plano?.periodo?.inicio ?? plano?.dataInicio ?? null;
  const fim = plano?.periodoFim ?? plano?.periodo?.fim ?? plano?.dataFim ?? null;
  if (!inicio && !fim) return null;
  return { inicio, fim };
}

function PeriodoColuna({ plano }) {
  const periodo = resolvePeriodoBackend(plano);

  if (periodo?.inicio && periodo?.fim) {
    return (
      <p className="mt-0.5 text-[12px] font-semibold tabular-nums leading-snug text-ink-900">
        {formatDataLongaPt(periodo.inicio)} → {formatDataLongaPt(periodo.fim)}
      </p>
    );
  }

  return (
    <div className="mt-0.5 inline-flex max-w-full flex-col gap-0.5 rounded-xl border border-dashed border-ink-300 bg-white px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-ink-400" strokeWidth={2} aria-hidden />
        <span className="text-[12px] font-semibold text-ink-700">A definir</span>
      </div>
      <span className="text-[10px] font-medium text-ink-500">Defina as datas dos procedimentos</span>
    </div>
  );
}

export function PlanoProtocoloResumo({ itens, plano }) {
  const resumo = useMemo(() => calcResumoProtocolo(itens), [itens]);

  return (
    <div className="animate-agenda-rise rounded-xl border border-ink-200 bg-[#f8fbfb] p-2.5">
      <p className="mb-2 font-display text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
        Resumo do protocolo
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0">
        <div className="sm:border-r sm:border-ink-200 sm:pr-4">
          <p className="font-display text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
            Total de procedimentos
          </p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums text-ink-900">{resumo.total}</p>
        </div>
        <div className="sm:border-r sm:border-ink-200 sm:px-4">
          <p className="font-display text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
            Período do tratamento
          </p>
          <PeriodoColuna plano={plano} />
        </div>
        <div className="sm:pl-4">
          <p className="font-display text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
            Valor total
          </p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums text-brand-primary">
            {formatValorBrl(resumo.valorTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
