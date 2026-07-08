import React from 'react';
import { CalendarPlus, Plus, Search } from 'lucide-react';
import { usePapel } from '../../hooks/usePapel';
import { PacienteSearchInput } from '../agenda/PacienteSearchInput.jsx';
import NotificationBell from './NotificationBell.jsx';
import { ProcediSymbol } from './ProcediSymbol.jsx';

/**
 * @param {{
 *   activeView: string,
 *   onPatientSelect?: (patient: object) => void,
 *   onNovoPaciente?: () => void,
 *   onAgendamento?: () => void,
 *   onOpenNotificacoes?: () => void,
 *   notificacoesRefreshKey?: number,
 *   patientSearchQuery?: string,
 *   setPatientSearchQuery?: (v: string) => void,
 * }} props
 */
export function GlobalHeader({
  activeView,
  onPatientSelect,
  onNovoPaciente,
  onAgendamento,
  onOpenNotificacoes,
  notificacoesRefreshKey = 0,
  patientSearchQuery = '',
  setPatientSearchQuery,
}) {
  const { canCreatePacientes, canWriteAgenda, isNivel1 } = usePapel();

  const isPacientesView = activeView === 'pacientes';
  const showAgendamento = canWriteAgenda && !isNivel1;
  const showNovoPaciente = canCreatePacientes;

  const brandBlock = (
    <div className="flex shrink-0 items-center gap-2">
      <ProcediSymbol className="h-8 w-8 shrink-0" />
      <span className="truncate font-semibold text-teal-700">Procedi</span>
    </div>
  );

  const bell = (
    <NotificationBell
      variant="header"
      onVerTodas={onOpenNotificacoes}
      notificacoesRefreshKey={notificacoesRefreshKey}
    />
  );

  const searchSlot = isPacientesView ? (
    <div className="relative min-w-[12rem] max-w-md flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
        strokeWidth={2.25}
        aria-hidden
      />
      <input
        type="text"
        value={patientSearchQuery ?? ''}
        onChange={(e) => setPatientSearchQuery?.(e.target.value)}
        placeholder="Buscar por nome, CPF ou telefone…"
        aria-label="Buscar paciente"
        className="h-10 w-full rounded-xl border border-[#e2e8f0] bg-white py-2 pl-9 pr-3 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#00a88e]/50"
        autoComplete="off"
      />
    </div>
  ) : (
    <div className="min-w-[12rem] max-w-md flex-1">
      <PacienteSearchInput
        value=""
        onChange={(_id, patient) => {
          const cpf = String(patient?.cpf || '').trim();
          if (cpf) onPatientSelect?.(patient);
        }}
      />
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <header className="sticky top-0 z-30 hidden shrink-0 border-b border-app-border bg-white/95 backdrop-blur-sm lg:flex">
        <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          {brandBlock}
          {searchSlot}

          <div className="flex shrink-0 items-center gap-2">
            {showAgendamento ? (
              <button
                type="button"
                onClick={onAgendamento}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40"
              >
                <CalendarPlus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                Agendamento
              </button>
            ) : null}

            {showNovoPaciente ? (
              <button
                type="button"
                onClick={onNovoPaciente}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00a88e] px-3 text-[13px] font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40"
              >
                <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Novo Paciente
              </button>
            ) : null}

            {bell}
          </div>
        </div>
      </header>

      {/* Mobile compacto: símbolo + sino */}
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-app-border bg-white/95 px-4 backdrop-blur-sm lg:hidden">
        {brandBlock}
        {bell}
      </header>
    </>
  );
}
