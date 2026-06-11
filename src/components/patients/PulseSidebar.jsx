import React from 'react';
import { Cake, CalendarDays, CalendarOff, ChevronRight, Clock } from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import { formatCartaoDiaPtBr } from '../../utils/patientProfileDerivedDates.js';
import {
  formatBirthdayCountdown,
  getPatientNextBirthdayInfo,
} from '../../utils/patientBirthdayList.js';

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

function buildRetornoSegment(n) {
  return (
    <>
      <WelcomeTealNum n={n} />{' '}
      {n === 1 ? 'paciente precisa de retorno' : 'pacientes precisam de retorno'}
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

function buildWelcomeResumo({ nAtendimentos, nRetorno, nAniversarios }) {
  const segments = [];
  if (nAtendimentos > 0) segments.push(buildAtendimentosSegment(nAtendimentos));
  if (nRetorno > 0) segments.push(buildRetornoSegment(nRetorno));
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

function SectionHeader({
  icon,
  title,
  count,
  onVerTodos,
  verTodosLabel,
  iconBg = 'bg-[#e6f7f5]',
  iconColor = 'text-[#00a88e]',
}) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="flex-1 text-[13px] font-semibold leading-snug text-[#0f172a]">{title}</span>
      {count != null && count > 0 ? (
        <span className="rounded-full bg-[#e6f7f5] px-2 py-0.5 text-[11px] font-semibold text-[#00a88e]">
          {count}
        </span>
      ) : null}
      {onVerTodos ? (
        <button
          type="button"
          onClick={onVerTodos}
          className="text-[11px] font-medium text-[#00a88e] hover:underline"
        >
          {verTodosLabel || 'Ver todos'}
        </button>
      ) : null}
    </div>
  );
}

function AgendaRow({ slot }) {
  const nome = slot?.pacienteNome || 'Paciente';
  const hora = slot?.horaInicio ? String(slot.horaInicio).slice(0, 5) : '';
  const procedimento = slot?.procedimentoNome || '';

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6f7f5] text-[11px] font-bold text-[#00a88e]">
        {nome.charAt(0).toUpperCase()}
      </div>
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
}) {
  const nome = primeiroNome(nomeUsuario);

  const agendamentos = kpi?.agendamentosHoje ?? [];
  const semRetornoMarcado = kpi?.semRetornoMarcadoList ?? [];
  const totalSemRetornoMarcado = kpi?.totalSemRetornoMarcado ?? 0;
  const aniversariantes = kpi?.aniversariantesList ?? [];

  const nAtendimentos = agendamentos.length;
  const nRetorno = totalSemRetornoMarcado ?? 0;
  const nAniversarios = countAniversariantesEstaSemana(aniversariantes);
  const welcomeResumo = buildWelcomeResumo({ nAtendimentos, nRetorno, nAniversarios });
  const resumoVazio = !loading && nAtendimentos === 0 && nRetorno === 0 && nAniversarios === 0;

  return (
    <aside className="hidden w-[min(100%,340px)] shrink-0 flex-col gap-4 lg:flex xl:w-[380px]">
      <div className="sticky top-4 flex max-h-[calc(100dvh-7rem)] flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm custom-scrollbar">

        {/* Saudação */}
        <div className="relative overflow-hidden rounded-xl border border-[#e2e8f0] bg-white p-4">
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,#e6f7f5_0%,transparent_70%)] opacity-80"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[15px] font-bold text-[#0f172a]">
              {getSaudacao()}
              {nome ? `, ${nome}` : ''}{' '}
              <span aria-hidden="true">👋</span>
            </p>
            {loading ? (
              <div className="mt-1.5 h-4 w-3/4 animate-pulse rounded bg-[#e2e8f0]" />
            ) : welcomeResumo ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">{welcomeResumo}</p>
            ) : resumoVazio ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">
                Nenhum compromisso ou pendência urgente para hoje.
              </p>
            ) : null}
          </div>
        </div>

        {/* Agendamentos de hoje */}
        <div>
          <SectionHeader
            icon={CalendarDays}
            title="Agendamentos de hoje"
            count={agendamentos.length > 0 ? agendamentos.length : undefined}
            onVerTodos={agendamentos.length > 0 ? onNavigateToAgenda : undefined}
            verTodosLabel="Ver agenda"
          />
          {loading ? (
            <SidebarSkeleton />
          ) : agendamentos.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] text-[#94a3b8]">
              Nenhum agendamento hoje
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {agendamentos.slice(0, 5).map((slot) => (
                <AgendaRow key={slot.id} slot={slot} />
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
        </div>

        {/* Sem retorno marcado — atendido, sem próxima consulta, sem plano ativo */}
        <div>
          <SectionHeader
            icon={CalendarOff}
            title="Sem retorno marcado"
            count={totalSemRetornoMarcado > 0 ? totalSemRetornoMarcado : undefined}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
          />
          {loading ? (
            <SidebarSkeleton />
          ) : semRetornoMarcado.length === 0 ? (
            <p className="px-1 py-3 text-center text-[12px] leading-relaxed text-[#94a3b8]">
              Nenhum paciente sem retorno marcado
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {semRetornoMarcado.slice(0, 5).map((p) => {
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
        </div>

        {/* Próximos aniversários (por proximidade, não só do mês) */}
        <div>
          <SectionHeader
            icon={Cake}
            title="Próximos aniversários"
            count={aniversariantes.length > 0 ? aniversariantes.length : undefined}
            iconBg="bg-pink-50"
            iconColor="text-pink-500"
          />
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
        </div>

        <p className="text-center text-[10px] text-[#cbd5e1]">
          <Clock className="mr-1 inline h-3 w-3" strokeWidth={2} aria-hidden />
          Atualizado ao carregar a página
        </p>
      </div>
    </aside>
  );
}
