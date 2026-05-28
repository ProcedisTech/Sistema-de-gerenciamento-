import { AlertTriangle, BadgeCheck, CalendarOff, Cake, FileX, UserPlus } from 'lucide-react';
import { MinorAgeIcon } from './MinorAgeIcon.jsx';
import { patientUltimaVisitaDayFromDto } from '../../utils/patientProfileDerivedDates.js';

/**
 * Mapa de configuração para os ícones de status do card de paciente.
 *
 * circleClass  — classe Tailwind para o fundo do círculo (vazio = sem fundo).
 * iconClass    — classe Tailwind de cor para o ícone.
 * hasBg        — se true, renderiza círculo colorido; se false, só o ícone (menor_idade).
 *
 * Tokens de cor reutilizados de tailwind.config.js:
 *   status-danger-bg / status-danger-ink — vermelho
 *   status-warn-bg / status-warn-ink     — âmbar
 *   status-info-bg / status-info         — azul
 *   status-ok-bg / vivid-teal-700        — verde/teal
 *   ink-100 / ink-500                    — cinza
 */
export const PATIENT_STATUS_CONFIG = {
  anamnese_vencida: {
    label: 'Anamnese vencida',
    Icon: AlertTriangle,
    circleClass: 'bg-status-danger-bg',
    iconClass: 'text-status-danger-ink',
    hasBg: true,
  },
  sem_retorno_marcado: {
    label: 'Sem retorno agendado',
    Icon: CalendarOff,
    circleClass: 'bg-status-warn-bg',
    iconClass: 'text-status-warn-ink',
    hasBg: true,
  },
  sem_plano: {
    label: 'Sem plano',
    Icon: FileX,
    circleClass: 'bg-ink-100',
    iconClass: 'text-ink-500',
    hasBg: true,
  },
  plano_ativo: {
    label: 'Plano ativo',
    Icon: BadgeCheck,
    circleClass: 'bg-status-info-bg',
    iconClass: 'text-status-info',
    hasBg: true,
  },
  paciente_novo: {
    label: 'Paciente novo',
    Icon: UserPlus,
    circleClass: 'bg-status-ok-bg',
    iconClass: 'text-vivid-teal-700',
    hasBg: true,
  },
  menor_idade: {
    label: 'Menor de idade',
    Icon: MinorAgeIcon,
    circleClass: '',
    iconClass: 'text-status-danger',
    hasBg: false,
  },
  aniversariante: {
    label: 'Aniversariante',
    Icon: Cake,
    circleClass: 'bg-pink-50',
    iconClass: 'text-pink-700',
    hasBg: true,
  },
};

/** Próxima agenda futura presente no DTO (listagem). */
function hasProximoAgendamento(patient) {
  const v = patient?.proximoAgendamento;
  return v != null && String(v).trim() !== '';
}

/** Paciente já teve ao menos uma consulta (ultimaVinda ISO ou ultimaVisita legado). */
function hasUltimaVisita(patient) {
  const day = patientUltimaVisitaDayFromDto(patient);
  return day !== '-' && day !== '—' && day !== '';
}

/**
 * Retorna os ids de status ativos para um paciente, na ordem de importância:
 * anamnese_vencida → sem_retorno_marcado → sem_plano | plano_ativo → paciente_novo → menor_idade → aniversariante
 *
 * sem_retorno_marcado: somente quando já houve primeira consulta (hasUltimaVisita) e
 * não há retorno agendado (!hasProximoAgendamento). Pacientes recém-cadastrados sem
 * consulta não recebem este badge.
 */
export function getPatientCardStatuses(patient) {
  const statuses = [];
  if (patient.anamneseDesatualizada) statuses.push('anamnese_vencida');
  if (hasUltimaVisita(patient) && !hasProximoAgendamento(patient)) statuses.push('sem_retorno_marcado');
  if (patient.statusPlanoCodigo === 'sem_plano') {
    statuses.push('sem_plano');
  } else if (patient.statusPlanoCodigo != null) {
    statuses.push('plano_ativo');
  }
  if (patient.ehNovo) statuses.push('paciente_novo');
  if (patient.menorDeIdade) statuses.push('menor_idade');
  if (patient.ehAniversariante) statuses.push('aniversariante');
  return statuses;
}
