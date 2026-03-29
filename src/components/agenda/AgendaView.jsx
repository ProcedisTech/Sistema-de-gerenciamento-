import React from 'react';
import { Calendar } from 'lucide-react';
import { AgendaModal } from './AgendaModal';

export function AgendaView({
  openAgendaModal,
  monthPatientCpfs,
  monthConfirmedPatientCpfs,
  monthPendingPatientCpfs,
  todayPatientCpfs,
  goPrevCalendarMonth,
  monthLabel,
  goNextCalendarMonth,
  calendarCells,
  appointments,
  selectedDay,
  setSelectedDay,
  appointmentsForSelectedDay,
  toggleAppointmentStatus,
  agendaModalProps,
}) {
  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Agenda</h3>
          <p className="text-[#64748b] text-[13px] font-medium">
            Clique em um dia para ver os agendamentos
          </p>
        </div>

        <button
          type="button"
          onClick={openAgendaModal}
          className="px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border-[3px] border-transparent flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" /> + Novo Agendamento
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border-[3px] border-[#00a88e]/15 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Total do Mes</div>
          <div className="text-[20px] font-extrabold text-[#0f172a]">{monthPatientCpfs.size}</div>
        </div>
        <div className="bg-white border-[3px] border-[#22c55e]/15 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Confirmados</div>
          <div className="text-[20px] font-extrabold text-[#16a34a]">{monthConfirmedPatientCpfs.size}</div>
        </div>
        <div className="bg-white border-[3px] border-[#f59e0b]/20 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Pendentes</div>
          <div className="text-[20px] font-extrabold text-[#b45309]">{monthPendingPatientCpfs.size}</div>
        </div>
        <div className="bg-white border-[3px] border-[#00a88e]/10 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Hoje</div>
          <div className="text-[20px] font-extrabold text-[#0f766e]">{todayPatientCpfs.size}</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="flex-1 bg-[#f8fbfb] border-[3px] border-[#00a88e]/15 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              type="button"
              onClick={goPrevCalendarMonth}
              className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white border-[3px] border-[#00a88e]/20 text-[#0f766e] font-bold hover:bg-[#e6f7f5]"
            >
              Anterior
            </button>
            <div className="text-[16px] font-bold text-[#0f172a]">{monthLabel}</div>
            <button
              type="button"
              onClick={goNextCalendarMonth}
              className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white border-[3px] border-[#00a88e]/20 text-[#0f766e] font-bold hover:bg-[#e6f7f5]"
            >
              Proximo
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-[12px] font-bold text-[#64748b] mb-2 sm:mb-3">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              const { dayNum, dateStr } = cell;
              const count = dayNum && dateStr ? appointments.filter((a) => a.date === dateStr).length : 0;
              const isSelected = dateStr && dateStr === selectedDay;

              return (
                <button
                  key={`${idx}`}
                  type="button"
                  disabled={!dayNum}
                  onClick={() => dayNum && dateStr && setSelectedDay(dateStr)}
                  className={`h-[44px] sm:h-[54px] rounded-xl border-[3px] text-left px-1.5 sm:px-2 py-1.5 sm:py-2 transition-all ${
                    dayNum
                      ? isSelected
                        ? 'border-[#00a88e] bg-[#e6f7f5]'
                        : 'border-[#00a88e]/15 bg-white hover:border-[#00a88e]/30'
                      : 'border-transparent bg-transparent'
                  }`}
                >
                  <div className="text-[11px] sm:text-[12px] font-bold text-[#0f172a]">{dayNum || ''}</div>
                  {count > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="w-5 h-3 sm:w-6 sm:h-4 rounded-md bg-[#00a88e] text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center">
                        {count}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full lg:w-[340px]">
          <div className="bg-white border-[3px] border-[#00a88e]/15 rounded-2xl p-3 sm:p-4 mt-2 lg:mt-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h4 className="text-[16px] font-bold text-[#0f172a]">{selectedDay}</h4>
              <span className="text-[12px] font-bold text-[#0f766e] bg-[#e6f7f5] border-[3px] border-[#00a88e]/20 px-2 py-0.5 rounded-lg">
                {appointmentsForSelectedDay.length}
              </span>
            </div>

            {appointmentsForSelectedDay.length === 0 ? (
              <div className="text-[#64748b] text-[13px] font-medium">Sem agendamentos para este dia.</div>
            ) : (
              <div className="space-y-3">
                {appointmentsForSelectedDay.map((a) => {
                  const status = a?.status || 'pendente';
                  const statusLabel = status === 'confirmado' ? 'confirmado' : 'pendente';
                  const statusPill =
                    status === 'confirmado'
                      ? 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20'
                      : 'bg-[#fef9c3] text-[#b45309] border-[#f59e0b]/20';
                  const toggleNext = status === 'pendente' ? 'confirmado' : 'pendente';

                  return (
                    <div key={a.id} className="p-4 rounded-xl border-[3px] border-[#00a88e]/15 bg-[#f8fbfb]">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="text-[14px] font-bold text-[#0f766e]">{a.patient?.nome || 'Paciente'}</div>
                        <div className="text-[12px] font-bold text-[#64748b]">{a.time}</div>
                      </div>
                      <div className="text-[13px] font-medium text-[#334155]">{a.procedure}</div>

                      <div className="flex items-center justify-between gap-3 mt-3">
                        <span className={`text-[12px] font-bold px-2 py-1 rounded-lg border-[3px] ${statusPill}`}>
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAppointmentStatus(a.id, toggleNext)}
                          className="text-[12px] font-bold px-3 py-2 rounded-xl border-[3px] border-transparent bg-white text-[#00a88e] hover:bg-[#e6f7f5] transition-all"
                        >
                          {toggleNext === 'confirmado' ? 'Confirmar' : 'Marcar pendente'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AgendaModal {...agendaModalProps} />
    </div>
  );
}

