import { PATIENT_STATUS_CONFIG } from './patientListStatusConfig.js';

/**
 * Ícone circular de status para os cards da lista de pacientes.
 *
 * - Todos os status (exceto menor_idade): ícone dentro de círculo com fundo colorido.
 * - menor_idade: só o ícone (MinorAgeIcon), sem fundo, em vermelho.
 * - title + aria-label no wrapper para tooltip nativo e acessibilidade.
 */
export function PatientStatusIconBadge({ statusId }) {
  const config = PATIENT_STATUS_CONFIG[statusId];
  if (!config) return null;

  const { label, Icon, circleClass, iconClass, hasBg } = config;

  if (!hasBg) {
    return (
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8 ${iconClass}`}
        title={label}
        aria-label={label}
      >
        <Icon
          className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
          strokeWidth={1.5}
          aria-hidden
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${circleClass}`}
      title={label}
      aria-label={label}
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${iconClass}`}
        strokeWidth={2.2}
        aria-hidden
      />
    </span>
  );
}
