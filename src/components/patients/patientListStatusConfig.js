import { AlertTriangle, BadgeCheck, Cake, Clock3, FileX, UserPlus } from 'lucide-react';
import { MinorAgeIcon } from './MinorAgeIcon.jsx';

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
  sem_retorno: {
    label: 'Sem retorno',
    Icon: Clock3,
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

/**
 * Retorna os ids de status ativos para um paciente, na ordem de importância:
 * anamnese_vencida → sem_retorno → sem_plano | plano_ativo → paciente_novo → menor_idade → aniversariante
 */
export function getPatientCardStatuses(patient) {
  const statuses = [];
  if (patient.anamneseDesatualizada) statuses.push('anamnese_vencida');
  if (patient.semRetorno60Dias) statuses.push('sem_retorno');
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
