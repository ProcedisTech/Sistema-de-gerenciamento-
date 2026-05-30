import React from 'react';
import { Calendar, Clock } from 'lucide-react';

export function ProfileKpiStrip({
  ultimaVisitaDisplay,
  ultimaVisitaMeta,
  proximoRetornoDisplay,
  proximoRetornoMeta,
}) {
  return (
    <div
      className="grid grid-cols-1 bg-white sm:grid-cols-2"
      role="list"
      aria-label="Indicadores do paciente"
    >
      <div
        className="flex gap-3 border-b border-ink-150 p-4 sm:border-b-0 sm:border-r sm:p-5"
        role="listitem"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-status-ok-bg text-vivid-teal-700"
          aria-hidden
        >
          <Clock className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Última visita
          </div>
          <div className="font-display text-[20px] font-bold leading-tight tracking-tight text-ink-900 sm:text-[22px]">
            {ultimaVisitaDisplay}
          </div>
          {ultimaVisitaMeta ? (
            <div className="mt-0.5 text-[12px] text-ink-500">{ultimaVisitaMeta}</div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-3 p-4 sm:p-5" role="listitem">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-status-info-bg text-status-info"
          aria-hidden
        >
          <Calendar className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Próximo retorno
          </div>
          <div
            className={`font-display text-[20px] font-bold leading-tight tracking-tight sm:text-[22px] ${
              proximoRetornoDisplay === '-' || proximoRetornoDisplay === '—'
                ? 'font-semibold text-ink-400'
                : 'text-ink-900'
            }`}
          >
            {proximoRetornoDisplay}
          </div>
          {proximoRetornoMeta ? (
            <div className="mt-0.5 text-[12px] text-ink-500">{proximoRetornoMeta}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
