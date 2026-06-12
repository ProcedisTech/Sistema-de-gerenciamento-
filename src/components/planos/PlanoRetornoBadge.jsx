import React from 'react';
import { formatDataPt } from '../../utils/planejamentoDraftUtils.js';

export function PlanoRetornoBadge({ catalogoNome, dataAgendamento, horaInicio }) {
  if (!dataAgendamento) return null;

  const nome = catalogoNome?.trim() || 'Procedimento';
  const dataLabel = formatDataPt(dataAgendamento);
  const hora = horaInicio ? ` ${String(horaInicio).slice(0, 5)}` : '';

  return (
    <span className="mt-1.5 inline-flex w-fit rounded-lg border border-[#00a88e]/30 bg-[#e6f7f5] px-2 py-0.5 text-[10px] font-semibold text-[#0f766e]">
      Retorno para {nome} · agendado para {dataLabel}
      {hora}
    </span>
  );
}
