import React from 'react';
import { Calendar, Loader2, UserPlus } from 'lucide-react';
import { AgendaModal } from './AgendaModal';
import { MarcarCompromissoModal } from './MarcarCompromissoModal';
import CancelarAgendaModal from './CancelarAgendaModal.jsx';

export function AgendaView({
  openAgendaModal,
  monthPatientCpfs,
  monthConfirmedPatientCpfs,
  monthPendingPatientCpfs,
  agendaStats,
  todayPatientCpfs,
  goPrevCalendarMonth,
  monthLabel,
  goNextCalendarMonth,
  calendarCells,
  appointments,
  selectedDay,
  setSelectedDay,
  appointmentsForSelectedDay,
  openCancelAppointmentModal = () => {},
  closeCancelAppointmentModal = () => {},
  confirmCancelAppointment = async () => false,
  cancelModalSlotId = null,
  cancelAppointmentSubmitting = false,
  openMarcarCompromisso,
  agendaModalProps,
  compromissoModalProps,
  agendasLoading,
  agendasError,
}) {
  const stats = agendaStats || {
    monthTotal: monthPatientCpfs?.size ?? 0,
    monthConfirmed: monthConfirmedPatientCpfs?.size ?? 0,
    monthPending: monthPendingPatientCpfs?.size ?? 0,
    todayTotal: todayPatientCpfs?.size ?? 0,
    compromissosMes: 0,
    compromissosHoje: 0,
  };

  const compromissosNoDia = appointmentsForSelectedDay.reduce(
    (n, s) => n + (s.compromissos?.length || 0),
    0
  );

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Agenda</h3>
          <p className="text-[#64748b] text-[13px] font-medium leading-relaxed max-w-xl">
            Cada <span className="text-[#0f172a] font-semibold">horário</span> é um intervalo em que o profissional pode atender.
            Dentro dele você encaixa os <span className="text-[#0f172a] font-semibold">compromissos</span> (paciente + procedimento do
            catálogo).
          </p>
        </div>

        <button
          type="button"
          onClick={openAgendaModal}
          className="px-5 py-3 rounded-xl font-bold text-[14px] transition-all shadow-md bg-[#00a88e] hover:bg-[#00967f] text-white border border-transparent flex items-center justify-center gap-2"
        >
          <Calendar className="w-5 h-5" /> + Novo horário
        </button>
      </div>

      {agendasError ? (
        <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] font-medium">
          {agendasError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-app-border rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Horários no mês</div>
          <div className="text-[20px] font-extrabold text-[#0f172a]">{stats.monthTotal}</div>
          {stats.compromissosMes > 0 && (
            <div className="text-[11px] text-[#64748b] mt-1 font-medium">{stats.compromissosMes} compromisso(s)</div>
          )}
          {stats.monthConfirmed > 0 && (
            <div className="text-[11px] text-[#16a34a] mt-0.5 font-bold">{stats.monthConfirmed} confirmado(s)</div>
          )}
        </div>
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Pacientes únicos (mês)</div>
          <div className="text-[20px] font-extrabold text-[#16a34a]">{monthPatientCpfs?.size ?? 0}</div>
          <div className="text-[11px] text-[#64748b] mt-1 font-medium">nos compromissos</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Horários pendentes</div>
          <div className="text-[20px] font-extrabold text-[#b45309]">{stats.monthPending}</div>
        </div>
        <div className="bg-white border border-app-border rounded-2xl p-4 shadow-sm">
          <div className="text-[12px] font-bold text-[#64748b] mb-1">Hoje</div>
          <div className="text-[20px] font-extrabold text-[#0f766e]">{stats.todayTotal}</div>
          {stats.compromissosHoje > 0 && (
            <div className="text-[11px] text-[#64748b] mt-1 font-medium">{stats.compromissosHoje} compromisso(s)</div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="flex-1 bg-[#f8fbfb] border border-app-border rounded-2xl p-3 sm:p-4 relative">
          {agendasLoading && (
            <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-8 h-8 animate-spin text-[#00a88e]" />
            </div>
          )}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <button
              type="button"
              onClick={goPrevCalendarMonth}
              className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-[#0f766e] font-bold hover:bg-[#e6f7f5]"
            >
              Anterior
            </button>
            <div className="text-[16px] font-bold text-[#0f172a]">{monthLabel}</div>
            <button
              type="button"
              onClick={goNextCalendarMonth}
              className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-[#0f766e] font-bold hover:bg-[#e6f7f5]"
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
                  className={`h-[44px] sm:h-[54px] rounded-xl border text-left px-1.5 sm:px-2 py-1.5 sm:py-2 transition-all ${
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

        <div className="w-full lg:w-[420px] 3xl:w-[460px] 4xl:w-[500px]">
          <div className="bg-white border border-app-border rounded-2xl p-3 sm:p-4 mt-2 lg:mt-0">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h4 className="text-[16px] font-bold text-[#0f172a]">{selectedDay}</h4>
              <span className="text-[12px] font-bold text-[#0f766e] bg-[#e6f7f5] border border-slate-200 px-2 py-0.5 rounded-lg">
                {appointmentsForSelectedDay.length} horário(s)
                {compromissosNoDia > 0 ? ` · ${compromissosNoDia} comprom.` : ''}
              </span>
            </div>

            {appointmentsForSelectedDay.length === 0 ? (
              <div className="text-[#64748b] text-[13px] font-medium">Nenhum horário neste dia.</div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                {appointmentsForSelectedDay.map((a) => {
                  const status = a?.status || 'pendente';
                  const statusPill =
                    status === 'cancelado'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : status === 'confirmado'
                        ? 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20'
                        : 'bg-[#fef9c3] text-[#b45309] border-[#f59e0b]/20';

                  const comps = Array.isArray(a.compromissos) ? a.compromissos : [];
                  const raw = a.raw || {};
                  const podeMarcar =
                    a.tipo !== 'bloqueio' && status !== 'cancelado' && comps.length === 0 && !raw.pacienteId;

                  return (
                    <div key={a.id} className="p-4 rounded-xl border border-app-border bg-[#f8fbfb]">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="text-[14px] font-bold text-[#0f766e]">{a.profissionalNome || 'Profissional'}</div>
                        <div className="text-[12px] font-bold text-[#64748b]">{a.time}</div>
                      </div>
                      <div className="text-[12px] text-[#64748b] mb-1">
                        {a.tipo === 'bloqueio' ? 'Horário bloqueado (sem atendimento)' : 'Horário de atendimento'}
                      </div>
                      <div className="text-[13px] font-medium text-[#334155] mb-2">{a.procedure}</div>

                      {comps.length > 0 && (
                        <div className="space-y-2 mb-3 pl-2 border-l-[3px] border-[#00a88e]/30">
                          <div className="text-[11px] font-bold text-[#64748b] uppercase tracking-wide">Compromissos</div>
                          {comps.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-bold text-[#0f172a]">{c.pacienteNome || 'Paciente'}</div>
                                <div className="text-[12px] text-[#64748b]">{c.procedimentoNome || 'Procedimento'}</div>
                                {c.observacao ? (
                                  <div className="text-[11px] text-[#94a3b8] mt-0.5">{c.observacao}</div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`text-[12px] font-bold px-2 py-1 rounded-lg border ${statusPill}`}>
                          {a.statusNome || status}
                        </span>
                        {podeMarcar && (
                          <button
                            type="button"
                            onClick={() => openMarcarCompromisso?.(a)}
                            className="text-[12px] font-bold px-3 py-2 rounded-xl border border-app-border bg-white text-[#00a88e] hover:bg-[#e6f7f5] flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Marcar atendimento
                          </button>
                        )}
                        {status !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => openCancelAppointmentModal(a.id)}
                            className="text-[12px] font-bold px-3 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"
                          >
                            Cancelar horário
                          </button>
                        )}
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
      <MarcarCompromissoModal {...compromissoModalProps} />
      {cancelModalSlotId ? (
        <CancelarAgendaModal
          agenda={null}
          onClose={closeCancelAppointmentModal}
          onConfirm={confirmCancelAppointment}
          isSubmitting={cancelAppointmentSubmitting}
        />
      ) : null}
    </div>
  );
}
