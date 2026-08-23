import React from 'react';
import { Cake, CalendarDays, ChevronRight, Clock, FileX } from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import { formatCartaoDiaPtBr } from '../../utils/patientProfileDerivedDates.js';
import {
  formatBirthdayCountdown,
  getPatientNextBirthdayInfo,
} from '../../utils/patientBirthdayList.js';
import { getRailCardActions } from '../../utils/agendaCardActions.js';
import { AgendaRailCardActions } from '../agenda/AgendaRailCardActions.jsx';
import { usePapel } from '../../hooks/usePapel.js';
import { CollapsibleSection } from '../shared/CollapsibleSection.jsx';
import { isAgendamentoHojePassado } from '../../utils/sortAgendamentosHojePulse.js';

function getSaudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function primeiroNome(nomeCompleto) {
  if (!nomeCompleto) return '';
  return String(nomeCompleto).trim().split(/\s+/)[0];
}

function countAniversariantesEstaSemana(aniversariantesList) {
  return (aniversariantesList ?? []).filter((p) => {
    const info = getPatientNextBirthdayInfo(p);
    return info != null && info.daysUntil <= 6;
  }).length;
}

function WelcomeTealNum({ n }) {
  return <span className="font-semibold text-[#00a88e]">{n}</span>;
}

function buildAtendimentosSegment(n) {
  return (
    <>
      Hoje você tem <WelcomeTealNum n={n} /> {n === 1 ? 'atendimento' : 'atendimentos'}
    </>
  );
}

function buildSemPlanoSegment(n) {
  return (
    <>
      <WelcomeTealNum n={n} />{' '}
      {n === 1 ? 'paciente sem plano definido' : 'pacientes sem plano definido'}
    </>
  );
}

function buildAniversariosSegment(n) {
  return (
    <>
      <WelcomeTealNum n={n} /> {n === 1 ? 'aniversariante esta semana' : 'aniversariantes esta semana'}
    </>
  );
}

function joinWelcomeSegments(segments) {
  if (segments.length === 0) return null;
  if (segments.length === 1) {
    return (
      <>
        {segments[0]}.
      </>
    );
  }
  if (segments.length === 2) {
    return (
      <>
        {segments[0]} e {segments[1]}.
      </>
    );
  }
  return (
    <>
      {segments[0]}, {segments[1]} e {segments[2]}.
    </>
  );
}

function buildWelcomeResumo({ nAtendimentos, nSemPlano, nAniversarios }) {
  const segments = [];
  if (nAtendimentos > 0) segments.push(buildAtendimentosSegment(nAtendimentos));
  if (nSemPlano > 0) segments.push(buildSemPlanoSegment(nSemPlano));
  if (nAniversarios > 0) segments.push(buildAniversariosSegment(nAniversarios));
  return joinWelcomeSegments(segments);
}

function formatarDataAniversario(dataNascimento) {
  if (!dataNascimento) return '';
  try {
    const [, m, d] = String(dataNascimento).split('-');
    return `${d}/${m}`;
  } catch {
    return '';
  }
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-[#e2e8f0]" />
      ))}
    </div>
  );
}

function AgendaRow({
  slot,
  agendaSchedule,
  onStartAttendance,
  getPatientInitials,
  onSolicitarAnamnese,
  onSlotCancelar,
}) {
  const { isNivel1, canStartAnamnese } = usePapel();
  const nome = slot?.pacienteNome || 'Paciente';
  const hora = slot?.horaInicio ? String(slot.horaInicio).slice(0, 5) : '';
  const procedimento = slot?.procedimentoNome || '';
  const isPast = isAgendamentoHojePassado(slot);

  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <PatientAvatar
          patient={{ id: slot?.pacienteId, nome: slot?.pacienteNome, fotoPerfilUrl: slot?.pacienteFotoUrl }}
          getPatientInitials={getPatientInitials}
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e6f7f5]"
          initialsClassName="text-[11px] font-bold"
          spinnerClassName="h-3 w-3"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-snug text-[#0f172a]">{nome}</p>
          {procedimento ? (
            <p className="truncate text-[11px] text-[#64748b]">{procedimento}</p>
          ) : null}
        </div>
        {hora ? (
          <span className="shrink-0 text-[11px] font-semibold text-[#64748b]">{hora}</span>
        ) : null}
      </div>

      {agendaSchedule && !isNivel1 && (
        <div className="border-t border-[#f1f5f9] pt-2">
          <AgendaRailCardActions
            appointment={slot}
            actions={getRailCardActions(slot.status, canStartAnamnese)}
            compact={true}
            onConfirmar={() => agendaSchedule.handleAtualizarStatus(slot.agendaId, 'confirmado')}
            onIniciarAtendimento={() => onStartAttendance?.(slot)}
            onWhatsApp={() => agendaSchedule.handleEnviarWhatsApp(slot.agendaId)}
            onEnviarAnamnese={() => onSolicitarAnamnese?.(slot)}
            onReagendar={() => agendaSchedule.openReagendarModal(slot, [slot])}
            onCancelar={() => onSlotCancelar?.(slot)}
          />
        </div>
      )}
    </div>
  );
}

function PatientRow({ patient, sub, getPatientInitials, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(patient)}
      className="flex min-w-0 w-full items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#cbd5e1] hover:bg-[#f8fafc] active:bg-[#f1f5f9]"
    >
      <PatientAvatar
        patient={patient}
        getPatientInitials={getPatientInitials}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e6f7f5]"
        initialsClassName="text-[10px] font-bold"
        spinnerClassName="h-3 w-3"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-[#0f172a]">{patient.nome}</p>
        {sub ? <p className="truncate text-[11px] text-[#64748b]">{sub}</p> : null}
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#cbd5e1]" strokeWidth={2} aria-hidden />
    </button>
  );
}

function BirthdayPatientRow({ patient, getPatientInitials, onSelect }) {
  const birthday = getPatientNextBirthdayInfo(patient);
  const dataAniv = formatarDataAniversario(patient.dataNascimento);
  const countdown = formatBirthdayCountdown(birthday);
  const isToday = countdown.variant === 'today';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(patient)}
      className={`flex min-w-0 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-[#cbd5e1] active:bg-[#f1f5f9] ${
        isToday
          ? 'border-pink-300 bg-gradient-to-r from-pink-50 to-white shadow-sm hover:bg-pink-50/80'
          : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]'
      }`}
    >
      <PatientAvatar
        patient={patient}
        getPatientInitials={getPatientInitials}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e6f7f5]"
        initialsClassName="text-[10px] font-bold"
        spinnerClassName="h-3 w-3"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-[#0f172a]">{patient.nome}</p>
        {dataAniv ? (
          <p className="truncate text-[11px] text-[#64748b]">Aniversário · {dataAniv}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${
            isToday
              ? 'bg-pink-500 text-white'
              : countdown.variant === 'soon'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-[#f1f5f9] text-[#64748b]'
          }`}
        >
          <Cake className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
          {countdown.label}
        </span>
      </div>
    </button>
  );
}

/**
 * Painel lateral direito da tela de Pacientes — visível apenas lg+.
 */
export function PulseSidebar({
  kpi,
  loading,
  nomeUsuario,
  onNavigateToAgenda,
  onSelectPatient,
  getPatientInitials,
  agendaSchedule,
  onStartAttendance,
  onSolicitarAnamnese,
  onSlotCancelar,
}) {
  const nome = primeiroNome(nomeUsuario);

  const agendamentos = kpi?.agendamentosHoje ?? [];
  const semPlano = kpi?.semPlanoList ?? [];
  const totalSemPlano = kpi?.totalSemPlano ?? 0;
  const aniversariantes = kpi?.aniversariantesList ?? [];

  const nAtendimentos = agendamentos.length;
  const nSemPlano = totalSemPlano ?? 0;
  const nAniversarios = countAniversariantesEstaSemana(aniversariantes);
  const welcomeResumo = buildWelcomeResumo({ nAtendimentos, nSemPlano, nAniversarios });
  const resumoVazio = !loading && nAtendimentos === 0 && nSemPlano === 0 && nAniversarios === 0;

  const verAgendaBtn =
    agendamentos.length > 0 && onNavigateToAgenda ? (
      <button
        type="button"
        onClick={onNavigateToAgenda}
        className="shrink-0 text-[11px] font-medium text-[#00a88e] hover:underline"
      >
        Ver agenda
      </button>
    ) : null;

  return (
    <aside className="hidden w-[min(100%,340px)] shrink-0 flex-col gap-4 lg:flex xl:w-[380px]">
      <div className="sticky top-4 flex max-h-[calc(100dvh-7rem)] flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm custom-scrollbar">

        {/* Saudação — shrink-0 evita compressão no flex com max-h; overflow só no decorativo */}
        <div className="relative shrink-0 overflow-visible rounded-xl border border-[#e2e8f0] bg-white p-4">
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,#e6f7f5_0%,transparent_70%)] opacity-80" />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="min-w-0 break-words text-[15px] font-bold leading-snug text-[#0f172a]">
              {getSaudacao()}
              {nome ? `, ${nome}` : ''}{' '}
              <span aria-hidden="true">👋</span>
            </p>
            {loading ? (
              <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-[#e2e8f0]" />
            ) : welcomeResumo ? (
              <p className="mt-1.5 min-w-0 break-words text-[13px] leading-relaxed text-[#64748b]">
                {welcomeResumo}
              </p>
            ) : resumoVazio ? (
              <p className="mt-1.5 min-w-0 break-words text-[13px] leading-relaxed text-[#64748b]">
                Nenhum compromisso ou pendência urgente para hoje.
              </p>
            ) : null}
          </div>
        </div>

        <CollapsibleSection
          id="agendamentos"
          icon={CalendarDays}
          title="Agendamentos de hoje"
          count={agendamentos.length > 0 ? agendamentos.length : undefined}
          headerExtra={verAgendaBtn}
        >
          {loading ? (
            <SidebarSkeleton />
          ) : agendamentos.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] text-[#94a3b8]">
              Nenhum agendamento hoje
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {agendamentos.slice(0, 5).map((slot) => (
                <AgendaRow
                  key={slot.id}
                  slot={slot}
                  agendaSchedule={agendaSchedule}
                  onStartAttendance={onStartAttendance}
                  getPatientInitials={getPatientInitials}
                  onSolicitarAnamnese={onSolicitarAnamnese}
                  onSlotCancelar={onSlotCancelar}
                />
              ))}
              {agendamentos.length > 5 ? (
                <button
                  type="button"
                  onClick={onNavigateToAgenda}
                  className="flex items-center justify-center gap-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] py-2 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9]"
                >
                  +{agendamentos.length - 5} mais
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="semPlano"
          icon={FileX}
          title="Sem plano"
          count={totalSemPlano > 0 ? totalSemPlano : undefined}
          iconBg="bg-ink-100"
          iconColor="text-ink-500"
        >
          {loading ? (
            <SidebarSkeleton />
          ) : semPlano.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] leading-relaxed text-[#94a3b8]">
              Nenhum paciente sem plano
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {semPlano.slice(0, 5).map((p) => {
                const ultimaVisitaLabel = p.ultimaVinda
                  ? `Última visita · ${formatCartaoDiaPtBr(p.ultimaVinda)}`
                  : p.ultimaVisita && p.ultimaVisita !== '-'
                    ? `Última visita · ${p.ultimaVisita}`
                    : 'Sem visita registrada';
                return (
                  <PatientRow
                    key={p.id}
                    patient={p}
                    sub={ultimaVisitaLabel}
                    getPatientInitials={getPatientInitials}
                    onSelect={onSelectPatient}
                  />
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="aniversarios"
          icon={Cake}
          title="Próximos aniversários"
          count={aniversariantes.length > 0 ? aniversariantes.length : undefined}
          iconBg="bg-pink-50"
          iconColor="text-pink-500"
        >
          {loading ? (
            <SidebarSkeleton />
          ) : aniversariantes.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] text-[#94a3b8]">
              Nenhum aniversário próximo
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {aniversariantes.slice(0, 5).map((p) => (
                <BirthdayPatientRow
                  key={p.id}
                  patient={p}
                  getPatientInitials={getPatientInitials}
                  onSelect={onSelectPatient}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        <p className="shrink-0 text-center text-[10px] text-[#cbd5e1]">
          <Clock className="mr-1 inline h-3 w-3" strokeWidth={2} aria-hidden />
          Atualizado ao carregar a página
        </p>
      </div>
    </aside>
  );
}
