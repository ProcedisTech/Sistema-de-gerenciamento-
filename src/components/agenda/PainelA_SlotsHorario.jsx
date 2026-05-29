import React from 'react';
import { RefreshCw, CalendarX, Users, Clock, Lock } from 'lucide-react';
import { useDisponibilidadeDoDia } from '../../hooks/agenda/useDisponibilidadeDoDia.js';
import { addMinutesToTime } from '../../utils/agendaMapping.js';

function formatarHora(hhmm) {
  return String(hhmm || '').slice(0, 5);
}

// MVP: grade fixa 08–18h, granularidade 1h. Futuro: buscar horário comercial da clínica via config.
const GRADE_HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

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

  const durMin = Number(duracaoTotalMin) || 45;
  const slotsDisponiveis = new Set(slots.map((s) => formatarHora(s.hora)));

  return (
    <div className="space-y-1" role="listbox" aria-label="Horários disponíveis">
      {GRADE_HORAS.map((hora) => {
        const horaFim = addMinutesToTime(hora, durMin).slice(0, 5);
        const disponivel = slotsDisponiveis.has(hora);
        const isSelecionado = horaSelecionada === hora;

        if (!disponivel) {
          return (
            <div
              key={hora}
              role="option"
              aria-selected={false}
              aria-disabled="true"
              title="Horário indisponível"
              className="flex w-full cursor-not-allowed items-center justify-between rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 opacity-50"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-ink-500">{hora}</span>
                  <span className="text-[11px] text-ink-400">– {horaFim}</span>
                </div>
              </div>
              <span className="text-[10px] text-ink-400">ocupado</span>
            </div>
          );
        }

        const slot = slots.find((s) => formatarHora(s.hora) === hora);
        const qtdProfs = Array.isArray(slot?.profissionais) ? slot.profissionais.length : 0;

        function handleClick() {
          if (profissionalFixado) {
            const profissional = slot?.profissionais?.[0] || null;
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
