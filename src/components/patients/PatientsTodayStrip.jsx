import React, { useMemo } from 'react';
import { Cake, CalendarDays } from 'lucide-react';
import { getPatientNextBirthdayInfo } from '../../utils/patientBirthdayList.js';

function primeiroNome(nome) {
  if (!nome) return '';
  return String(nome).trim().split(/\s+/)[0];
}

function DotSep() {
  return <span className="shrink-0 text-[#e2e8f0]" aria-hidden>·</span>;
}

/**
 * Faixa compacta "Hoje" — mobile only (lg:hidden).
 * Reaproveita dados do usePatientsKpi (mesma fonte da PulseSidebar).
 */
export function PatientsTodayStrip({ kpi, loading = false, onSelectPatient }) {
  const agendamentos = kpi?.agendamentosHoje ?? [];
  const proximo = agendamentos[0] ?? null;
  const restantes = agendamentos.length > 1 ? agendamentos.length - 1 : 0;

  const aniversariantesHoje = useMemo(() => {
    const list = kpi?.aniversariantesList ?? [];
    return list.filter((p) => {
      const info = getPatientNextBirthdayInfo(p);
      return info?.isToday;
    });
  }, [kpi?.aniversariantesList]);

  if (loading) {
    return (
      <div
        className="lg:hidden flex items-center px-4 py-2.5 bg-white border-b border-[#e2e8f0]"
        role="status"
        aria-live="polite"
      >
        <div className="h-4 w-[80%] max-w-xs animate-pulse rounded bg-[#e2e8f0]" />
        <span className="sr-only">Carregando resumo de hoje…</span>
      </div>
    );
  }

  const temAgenda = Boolean(proximo);
  const temAniv = aniversariantesHoje.length > 0;

  return (
    <div
      className="lg:hidden flex items-center gap-3 overflow-x-auto whitespace-nowrap px-4 py-2.5 bg-white border-b border-[#e2e8f0] text-sm custom-scrollbar"
      role="region"
      aria-label="Resumo de hoje"
    >
      {temAgenda && onSelectPatient && proximo?.pacienteId ? (
        <button
          type="button"
          onClick={() => onSelectPatient(proximo)}
          className="flex shrink-0 items-center gap-1.5 hover:opacity-80 transition-opacity focus:outline-none"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.2} aria-hidden />
          <span className="font-medium text-[#0f172a] hover:underline">{proximo.pacienteNome || 'Paciente'}</span>
          <span className="text-[#64748b]">
            {proximo.horaInicio ? String(proximo.horaInicio).slice(0, 5) : ''}
          </span>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.2} aria-hidden />
          {temAgenda ? (
            <>
              <span className="font-medium text-[#0f172a]">{proximo.pacienteNome || 'Paciente'}</span>
              <span className="text-[#64748b]">
                {proximo.horaInicio ? String(proximo.horaInicio).slice(0, 5) : ''}
              </span>
            </>
          ) : (
            <span className="text-[#64748b]">Nenhum agendamento hoje</span>
          )}
        </div>
      )}

      {restantes > 0 ? (
        <>
          <DotSep />
          <span className="shrink-0 text-[#64748b]">+{restantes} mais hoje</span>
        </>
      ) : null}

      {temAniv ? (
        <>
          <DotSep />
          <div className="flex shrink-0 items-center gap-1 text-[#854d0b]">
            <Cake className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
            {aniversariantesHoje.length === 1 ? (
              <span className="font-medium">{primeiroNome(aniversariantesHoje[0].nome)}</span>
            ) : (
              <span className="font-medium">
                {primeiroNome(aniversariantesHoje[0].nome)} · +{aniversariantesHoje.length - 1}{' '}
                aniversários
              </span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
