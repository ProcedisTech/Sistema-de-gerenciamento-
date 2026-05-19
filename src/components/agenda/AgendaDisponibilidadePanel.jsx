import React from 'react';
import { Loader2 } from 'lucide-react';
import { AgendaDisponibilidadeCalendar } from './AgendaDisponibilidadeCalendar.jsx';
import { AgendaDisponibilidadeSlots } from './AgendaDisponibilidadeSlots.jsx';

/**
 * Linha 3 do modal: calendário heatmap + lista de slots (lado a lado em lg+).
 */
export function AgendaDisponibilidadePanel({ agenda, formErrors }) {
  const role = String(agenda.roleUserIdAgenda || '').trim();
  const dataHoraError =
    formErrors?.data || formErrors?.horaInicio
      ? [formErrors.data, formErrors.horaInicio].filter(Boolean).join(' · ')
      : '';

  return (
    <section className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      {dataHoraError ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800">
          {dataHoraError}
        </p>
      ) : null}

      {!role ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-6">
          <p className="text-center text-[13px] text-gray-500">Selecione um profissional</p>
        </div>
      ) : (
        <>
          {agenda.dispMonthError ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
              {agenda.dispMonthError}
            </p>
          ) : null}

          {agenda.dispMonthLoading && !agenda.dispHeatmap ? (
            <div className="mb-3 flex items-center justify-center py-4 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" />
            </div>
          ) : null}

          <div className="grid gap-4 lg:h-[420px] lg:grid-cols-2 lg:gap-6">
            <div className="flex min-h-0 min-w-0 flex-col">
              <AgendaDisponibilidadeCalendar
                heatmap={agenda.dispHeatmap}
                loading={agenda.dispMonthLoading}
                onSelectDay={agenda.selectDispCalendarioDia}
                onPrevMonth={agenda.goDispPrevMonth}
                onNextMonth={agenda.goDispNextMonth}
                onNextFree={agenda.handleProximoHorarioLivre}
              />
            </div>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
              <AgendaDisponibilidadeSlots
                dayModel={agenda.dispDaySlots}
                selectedIso={agenda.dispCalendarioDia}
                onSelectSlot={agenda.selectDispSlot}
                loading={agenda.dispMonthLoading}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
