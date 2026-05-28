import React from 'react';
import { RefreshCw, CalendarX, Users, Clock } from 'lucide-react';
import { useDisponibilidadeDoDia } from '../../hooks/agenda/useDisponibilidadeDoDia.js';
import { addMinutesToTime } from '../../utils/agendaMapping.js';

function formatarHora(hhmm) {
  return String(hhmm || '').slice(0, 5);
}

export function PainelA_SlotsHorario({
  diaSelecionado,
  roleUserIdFiltro,
  duracaoTotalMin,
  horaSelecionada,
  profissionalFixado,
  onSelecionarSlot,
  onAbrirPainelC,
}) {
  const { slots, loading, error, reload } = useDisponibilidadeDoDia({
    data: diaSelecionado || '',
    roleUserId: roleUserIdFiltro || undefined,
    enabled: Boolean(diaSelecionado),
  });

  if (!diaSelecionado) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CalendarX className="h-8 w-8 text-ink-300" />
        <p className="text-sm text-ink-400">Selecione um dia no calendário</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-1.5 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-xs text-ink-500">Falha ao carregar horários</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-vivid-teal-700 hover:bg-vivid-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
        >
          <RefreshCw className="h-3 w-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <CalendarX className="h-8 w-8 text-ink-300" />
        <p className="text-sm font-medium text-ink-600">Sem horários disponíveis</p>
        <p className="text-xs text-ink-400">Nenhum profissional atende neste dia</p>
      </div>
    );
  }

  const durMin = Number(duracaoTotalMin) || 45;

  return (
    <div className="space-y-1" role="listbox" aria-label="Horários disponíveis">
      {slots.map((slot) => {
        const hora = formatarHora(slot.hora);
        const horaFim = addMinutesToTime(hora, durMin).slice(0, 5);
        const qtdProfs = Array.isArray(slot.profissionais) ? slot.profissionais.length : 0;
        const isSelecionado = horaSelecionada === hora;

        function handleClick() {
          if (profissionalFixado) {
            const profissional = slot.profissionais?.[0] || null;
            onSelecionarSlot?.({ hora, profissional });
          } else {
            onAbrirPainelC?.(hora);
          }
        }

        let cardClass =
          'flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500';

        if (isSelecionado) {
          cardClass += ' border-vivid-teal-400 bg-vivid-teal-50 ring-1 ring-vivid-teal-400';
        } else {
          cardClass += ' border-ink-100 bg-white hover:border-vivid-teal-200 hover:bg-vivid-teal-50';
        }

        return (
          <button
            key={hora}
            type="button"
            role="option"
            aria-selected={isSelecionado}
            onClick={handleClick}
            className={cardClass}
          >
            <div className="flex items-center gap-2">
              <Clock
                className={`h-3.5 w-3.5 shrink-0 ${isSelecionado ? 'text-vivid-teal-600' : 'text-ink-400'}`}
              />
              <div className="flex items-baseline gap-1">
                <span className={`text-sm font-semibold ${isSelecionado ? 'text-vivid-teal-700' : 'text-ink-800'}`}>
                  {hora}
                </span>
                <span className="text-[11px] text-ink-400">– {horaFim}</span>
              </div>
            </div>

            {!profissionalFixado && qtdProfs > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-ink-400">
                <Users className="h-3 w-3" />
                <span>{qtdProfs}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
