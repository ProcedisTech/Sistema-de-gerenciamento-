import React from 'react';
import { CalendarDays, Lock } from 'lucide-react';

function capitalizeFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slotRowClass(state) {
  const base =
    'flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all';
  switch (state) {
    case 'selecionado':
      return `${base} border-transparent bg-white ring-2 ring-teal-600`;
    case 'livre':
      return `${base} border-transparent bg-white hover:bg-gray-50 cursor-pointer`;
    case 'ocupado':
      return `${base} border-transparent bg-gray-100 text-gray-600 cursor-default`;
    case 'bloqueio':
      return `${base} border-transparent bg-amber-50 text-amber-700 cursor-default`;
    default:
      return base;
  }
}

export function AgendaDisponibilidadeSlots({
  dayModel,
  selectedIso,
  onSelectSlot,
  loading,
  maxListHeight,
}) {
  if (!selectedIso) {
    return (
      <section className="flex h-full flex-1 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6 text-center">
        <CalendarDays className="mb-3 h-8 w-8 text-gray-300" strokeWidth={1.5} aria-hidden />
        <p className="max-w-[220px] text-[13px] leading-snug text-gray-500">
          Selecione um dia no calendário para ver os horários disponíveis
        </p>
      </section>
    );
  }

  if (!dayModel) return null;

  const hasWindows = dayModel.slots.length > 0 || Boolean(dayModel.expedienteLabel);

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="shrink-0 border-b border-gray-100 px-4 py-3">
        <h4 className="text-[14px] font-bold text-gray-900">
          {capitalizeFirst(dayModel.headerTitle)}
        </h4>
        {dayModel.expedienteLabel ? (
          <p className="mt-0.5 text-[11px] font-medium text-gray-500">{dayModel.expedienteLabel}</p>
        ) : null}
      </div>

      {!hasWindows ? (
        <p className="p-4 text-center text-[13px] text-gray-500">Sem expediente neste dia.</p>
      ) : (
        <ul
          className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 ${loading ? 'opacity-60' : ''}`}
          style={maxListHeight ? { maxHeight: maxListHeight } : { maxHeight: '380px' }}
        >
          {dayModel.slots.map((slot) => {
            const clickable = slot.state === 'livre' || slot.state === 'selecionado';
            return (
              <li key={slot.hhmm}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onSelectSlot(selectedIso, slot.hhmm)}
                  className={slotRowClass(slot.state)}
                >
                  <span className="w-12 shrink-0 font-mono text-[12px] font-bold tabular-nums">
                    {slot.hhmm}
                  </span>
                  {slot.state === 'bloqueio' ? (
                    <>
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="font-medium">{slot.observacao || 'Bloqueio'}</span>
                    </>
                  ) : slot.state === 'ocupado' ? (
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{slot.label || 'Ocupado'}</span>
                      {slot.sublabel ? (
                        <span className="text-gray-500"> · {slot.sublabel}</span>
                      ) : null}
                    </span>
                  ) : slot.state === 'selecionado' ? (
                    <span className="font-medium text-teal-700">Horário selecionado</span>
                  ) : (
                    <span className="text-gray-500">Livre</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
