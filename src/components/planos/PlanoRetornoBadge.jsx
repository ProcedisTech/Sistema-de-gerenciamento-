import React from 'react';
import { RefreshCw } from 'lucide-react';
import { formatDataPt } from '../../utils/planejamentoDraftUtils.js';

export function PlanoRetornoBadge({ dataAgendamento, horaInicio }) {
  if (!dataAgendamento) return null;

  const dataLabel = formatDataPt(dataAgendamento);
  const hora = horaInicio ? ` ${String(horaInicio).slice(0, 5)}` : '';

  return (
    <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-lg border border-brand-primary/30 bg-brand-primaryGhost px-2 py-0.5 text-[10px] font-semibold tabular-nums text-brand-primaryDark">
      <RefreshCw className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
      Retorno · {dataLabel}
      {hora}
    </span>
  );
}
