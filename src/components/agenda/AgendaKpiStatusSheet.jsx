import React from 'react';
import { Loader2, X } from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { KPI_DRILLDOWN_PERIOD, kpiStatusTitle } from '../../utils/agendaKpiDrilldown';
import { toDateKey } from '../../utils/agendaDateUtils';

const PERIOD_OPTIONS = [
  { id: KPI_DRILLDOWN_PERIOD.HOJE, label: 'Hoje' },
  { id: KPI_DRILLDOWN_PERIOD.SEMANA, label: 'Esta semana' },
  { id: KPI_DRILLDOWN_PERIOD.MES, label: 'Este mês' },
];

function formatListMeta(appointment) {
  const day = toDateKey(appointment.data);
  const today = appointment._todayIso;
  const showDate = day && day !== today;
  const datePart = showDate ? `${formatLongDate(day, { month: 'short' })} · ` : '';
  return `${datePart}${appointment.horaInicio}`;
}

/**
 * Drawer de drill-down dos KPIs Confirmados / Pendentes.
 */
export function AgendaKpiStatusSheet({
  status,
  onClose,
  period,
  onPeriodChange,
  profissionalRoleUserId,
  onProfissionalChange,
  equipeList = [],
  showProfissionalFilter = false,
  rows = [],
  loading = false,
  error = '',
  onRetry,
  onSelectAppointment,
  todayIso,
}) {
  if (!status) return null;

  const title = kpiStatusTitle(status);
  const countLabel = loading
    ? 'Carregandoâ€¦'
    : `${rows.length} no perÃ­odo selecionado`;

  return (
    <div className="fixed inset-0 z-[216] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fechar lista" />
      <div className="relative flex max-h-[min(92dvh,720px)] w-full max-w-[720px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-[#E8E8E8] bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[16px] font-black leading-tight text-[#1A1A2E] sm:text-[18px]">{title}</h3>
              <p className="mt-1 text-[12px] font-medium text-[#888888]">{countLabel}</p>
              {status === 'pendente' ? (
                <p className="mt-0.5 text-[11px] text-[#94a3b8]">NÃ£o inclui aguardando confirmaÃ§Ã£o.</p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-xl p-2 text-[#64748b] hover:bg-[#F5F6FA]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#888888]">PerÃ­odo</p>
              <div className="flex flex-wrap gap-2">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPeriodChange(opt.id)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      period === opt.id
                        ? 'bg-brand-primary text-white'
                        : 'bg-[#F5F6FA] text-[#64748b] hover:bg-[#E8E8E8]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {showProfissionalFilter ? (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#888888]">
                  Profissional
                </label>
                <select
                  value={profissionalRoleUserId || ''}
                  onChange={(e) => onProfissionalChange(e.target.value)}
                  className="w-full rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A2E] focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                  <option value="">Todos</option>
                  {equipeList.map((p) => (
                    <option key={p.roleUserId} value={p.roleUserId}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-[13px] font-semibold text-red-800">{error}</p>
              {typeof onRetry === 'function' ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 text-[12px] font-bold text-brand-primary hover:underline"
                >
                  Tentar novamente
                </button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E8E8E8] bg-[#F5F6FA] p-6 text-center text-[13px] font-semibold text-[#888888]">
              Nenhum agendamento com este status no perÃ­odo.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((appt) => (
                <li key={appt.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAppointment(appt)}
                    className="w-full rounded-xl border border-[#E8E8E8] bg-white p-3 text-left transition-colors hover:border-brand-primary/40 hover:bg-teal-50/30"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-black text-brand-primary">{formatListMeta({ ...appt, _todayIso: todayIso })}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-bold text-[#1A1A2E]">{appt.pacienteNome}</p>
                    <p className="mt-0.5 truncate text-[11px] font-medium text-[#888888]">
                      {appt.procedimentoNome || 'Sem procedimento'}
                      {appt.profissionalNome ? (
                        <>
                          <span className="text-[#CBD5E1]"> Â· </span>
                          {appt.profissionalNome}
                        </>
                      ) : null}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

