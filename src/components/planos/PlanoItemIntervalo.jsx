import React from 'react';
import { calcIntervaloDias } from '../../utils/planejamentoDraftUtils.js';

export function PlanoItemIntervalo({ dataAnterior, dataAtual }) {
  const dias = calcIntervaloDias(dataAnterior, dataAtual);
  if (dias == null || dias <= 0) return null;

  const label = dias === 1 ? '1 dia de intervalo' : `${dias} dias de intervalo`;

  return (
    <div className="flex items-center justify-center py-0">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#94a3b8]">
        <span className="h-px w-4 bg-[#e2e8f0]" aria-hidden />
        <span>{label}</span>
        <span className="h-px w-4 bg-[#e2e8f0]" aria-hidden />
      </div>
    </div>
  );
}
