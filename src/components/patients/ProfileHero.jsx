import React from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Download,
  Mail,
  MapPin,
  Phone,
  Play,
  Plus,
  User as UserIcon,
  UserMinus,
} from 'lucide-react';
import { PatientAvatar } from './PatientAvatar.jsx';
import {
  formatBirthDatePtBr,
  formatCityUf,
  formatCreatedAtPtBr,
  phoneDigitsForWa,
} from './profileDisplayUtils.js';
import { maskCPF } from '../utils/formatters';

function ContactChip({ href, onClick, children, className = '', placeholder = false }) {
  const base =
    'inline-flex h-[34px] max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-medium text-white transition-colors';
  const styles = placeholder
    ? 'border-dashed border-white/30 bg-white/[0.12] hover:border-white/40 hover:bg-white/20'
    : 'border-white/20 bg-white/[0.12] hover:border-white/30 hover:bg-white/20';

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={`${base} ${styles} ${className}`}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

const secondaryActionBtn =
  'inline-flex h-11 min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-1.5 rounded-xl border-0 bg-white px-2 text-[13px] font-semibold text-vivid-teal-800 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[7rem] sm:flex-none sm:gap-2 sm:px-4 sm:text-[14px]';

export function ProfileHero({
  patient,
  getPatientInitials,
  isPerfilAtivo,
  isNivel1,
  canEditPacientes,
  showInativarPaciente,
  profilePhotoInputRef,
  profilePhotoBusy,
  onProfilePhotoClick,
  onStartAttendance,
  onAgendar,
  onEdit,
  onCadastro,
  onInativar,
  onAddAddress,
  onAddResponsavel,
  profileNav,
  onNavigatePrev,
  onNavigateNext,
}) {
  const cpfFormatted = patient.cpf ? maskCPF(String(patient.cpf).replace(/\D/g, '')) : '—';
  const cadastroEm = formatCreatedAtPtBr(patient.createdAt);
  const cityUf = formatCityUf(patient);
  const birthLabel = formatBirthDatePtBr(patient.dataNascimento);
  const telefone = String(patient.telefone ?? '').trim();
  const email = String(patient.email ?? '').trim();
  const waDigits = phoneDigitsForWa(telefone);
  const hasAddress =
    Boolean(String(patient.cep ?? '').trim()) ||
    Boolean(String(patient.enderecoRua ?? '').trim()) ||
    Boolean(String(patient.endereco ?? '').trim());

  const renderInativarButton = () =>
    showInativarPaciente ? (
      <button
        type="button"
        onClick={onInativar}
        title="Inativar paciente"
        className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-600 bg-red-600 text-white shadow-sm transition-colors hover:border-red-700 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/80"
        aria-label="Inativar paciente"
      >
        <UserMinus className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        <span
          className="pointer-events-none absolute -bottom-9 right-0 z-20 hidden whitespace-nowrap rounded-md border border-ink-200 bg-ink-900 px-2 py-1 text-[11px] font-medium text-white shadow-md group-hover:block group-focus-visible:block sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
          role="tooltip"
        >
          Inativar paciente
        </span>
      </button>
    ) : null;

  const metaProntuario = (
    <div className="font-mono text-[10.5px] uppercase tracking-wider text-white/75">
      Prontuário
      <span className="mt-0.5 block text-[13px] font-semibold normal-case tracking-normal text-white">
        #{cpfFormatted}
      </span>
    </div>
  );

  const metaCadastro = (
    <div className="font-mono text-[10.5px] uppercase tracking-wider text-white/75">
      Cadastrado em
      <span className="mt-0.5 block text-[13px] font-semibold normal-case tracking-normal text-white">
        {cadastroEm}
      </span>
    </div>
  );

  const profileNavBlock = profileNav ? (
    <div className="flex items-center gap-2 sm:justify-end">
      <span className="font-mono text-[11.5px] text-white/75">
        {profileNav.globalIndex} de {profileNav.totalElements}
      </span>
      <div className="flex gap-0.5" role="group" aria-label="Navegar entre pacientes">
        <button
          type="button"
          disabled={!profileNav.hasPrev}
          onClick={onNavigatePrev}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/[0.12] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Paciente anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          disabled={!profileNav.hasNext}
          onClick={onNavigateNext}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/25 bg-white/[0.12] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Próximo paciente"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section
      className="bg-gradient-to-bl from-vivid-teal-600 via-vivid-teal-700 to-vivid-teal-800 text-white"
      aria-labelledby="profile-hero-name"
    >
      <div className="relative px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
        {showInativarPaciente ? (
          <div className="absolute right-3 top-3 z-20 sm:hidden">{renderInativarButton()}</div>
        ) : null}

        <div className="absolute right-4 top-4 z-10 hidden flex-col items-end gap-2 text-right sm:flex">
          {renderInativarButton()}
          {metaProntuario}
          {metaCadastro}
          {profileNavBlock}
        </div>

        <div
          className={`min-w-0 sm:pr-[11.5rem] ${showInativarPaciente ? 'pr-11' : ''}`}
        >
          <div className="flex items-start gap-3 sm:gap-5">
            <div className="relative shrink-0">
              <input
                ref={profilePhotoInputRef}
                type="file"
                accept={
                  patient?.id ? 'image/jpeg,image/jpg,image/png,image/webp' : 'image/*'
                }
                className="hidden"
                disabled={profilePhotoBusy}
                onChange={onProfilePhotoClick}
              />
              <div className="relative h-[88px] w-[88px] overflow-hidden rounded-2xl border-[3px] border-white/35 bg-white shadow-md sm:h-24 sm:w-24">
                <PatientAvatar
                  patient={patient}
                  getPatientInitials={getPatientInitials}
                  className="flex h-full w-full items-center justify-center overflow-hidden"
                  initialsClassName="font-display text-[28px] font-bold text-vivid-teal-800"
                  spinnerClassName="h-6 w-6"
                />
              </div>
              {canEditPacientes ? (
                <button
                  type="button"
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={profilePhotoBusy}
                  className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/30 bg-white text-vivid-teal-700 shadow-md transition-colors hover:bg-white/90 disabled:opacity-50"
                  aria-label="Trocar foto do paciente"
                  title="Trocar foto"
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-start gap-2">
                <h1
                  id="profile-hero-name"
                  className="font-display text-[22px] font-bold leading-tight tracking-tight text-white sm:text-[28px]"
                >
                  {patient.nome || '—'}
                </h1>
                {isPerfilAtivo ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/[0.15] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-white"
                    role="status"
                  >
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300"
                      aria-hidden
                    />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-white/[0.15] px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-white/90">
                    Inativo
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1 text-[13px] text-white/90">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-white/70" strokeWidth={2} aria-hidden />
                  {patient.idade != null ? `${patient.idade} anos` : '—'}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-white/40 sm:inline" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-white/70" strokeWidth={2} aria-hidden />
                  Nasc. {birthLabel}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-white/40 sm:inline" aria-hidden />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-white/70" strokeWidth={2} aria-hidden />
                  {cityUf}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2 text-left sm:hidden">
                {metaProntuario}
                {metaCadastro}
                {profileNavBlock}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-start gap-2" aria-label="Formas de contato">
          {waDigits ? (
            <ContactChip href={`https://wa.me/${waDigits}`}>
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{telefone}</span>
            </ContactChip>
          ) : null}
          {telefone ? (
            <ContactChip href={`tel:${telefone.replace(/\s/g, '')}`}>
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Ligar
            </ContactChip>
          ) : null}
          {email ? (
            <ContactChip href={`mailto:${email}`}>
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="max-w-[200px] truncate">{email}</span>
            </ContactChip>
          ) : null}
          {!hasAddress && canEditPacientes ? (
            <ContactChip placeholder onClick={onAddAddress}>
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Adicionar endereço
            </ContactChip>
          ) : null}
          {canEditPacientes ? (
            <ContactChip placeholder onClick={onAddResponsavel}>
              <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Responsável
            </ContactChip>
          ) : null}
        </div>

        {!isNivel1 ? (
          <div className="mt-4 flex flex-wrap items-start justify-start gap-2">
            <button
              type="button"
              onClick={() => onStartAttendance?.(patient)}
              className="inline-flex h-11 min-w-[min(100%,12rem)] flex-1 items-center justify-center gap-2 rounded-xl border-0 bg-white px-3 text-[13px] font-semibold text-vivid-teal-800 shadow-md transition-colors hover:bg-white/90 sm:min-w-[9.5rem] sm:flex-none sm:px-4 sm:text-[14px]"
            >
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-vivid-teal-100">
                <Play className="h-2.5 w-2.5 fill-vivid-teal-700 text-vivid-teal-700" aria-hidden />
              </span>
              <span className="truncate">Iniciar atendimento</span>
            </button>
            <button
              type="button"
              onClick={onAgendar}
              disabled={!isPerfilAtivo || !patient?.id}
              className={secondaryActionBtn}
            >
              <Calendar className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">Agendar</span>
            </button>
            {canEditPacientes ? (
              <>
                <button type="button" onClick={onCadastro} className={secondaryActionBtn}>
                  <FileText className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">Cadastro</span>
                </button>
                <button type="button" onClick={onEdit} className={secondaryActionBtn}>
                  <UserIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span className="truncate">Editar</span>
                </button>
              </>
            ) : null}
            <button type="button" disabled className={`${secondaryActionBtn} opacity-60`}>
              <Download className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">Gerar PDF</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/25 bg-white/[0.12] p-4 text-left">
            <p className="text-sm font-bold text-white">Acesso limitado</p>
            <p className="mt-1 text-xs leading-relaxed text-white/80">
              Seu nível de permissão (Nível 1) permite apenas visualizar dados cadastrais básicos.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
