import { addMinutesToTime } from './agendaMapping.js';

/**
 * Aplica uma ação sequencialmente a todas as agendas de um grupo.
 * Best-effort: para no primeiro erro se stopOnError=true (default).
 */
export async function applyActionToAppointmentGroup(items, actionFn, { stopOnError = true } = {}) {
  const succeeded = [];
  const failed = [];

  for (const item of items || []) {
    try {
      const result = await actionFn(item);
      if (result === false) throw new Error('action returned false');
      succeeded.push(item);
    } catch (error) {
      failed.push({ item, error });
      if (stopOnError) break;
    }
  }

  return {
    succeeded,
    failed,
    partial: succeeded.length > 0 && failed.length > 0,
    allOk: failed.length === 0 && succeeded.length > 0,
  };
}

export function formatGroupActionResultMessage({ succeeded, failed }, { verb = 'processadas' } = {}) {
  const total = (succeeded?.length || 0) + (failed?.length || 0);
  if (failed?.length === 0) return null;
  const ok = succeeded?.length || 0;
  const failNames = failed
    .map(({ item }) => item?.procedimentoNome || item?.pacienteNome || 'Agenda')
    .join(', ');
  return `${ok} de ${total} ${verb}. Falha em: ${failNames}.`;
}

/** Resolve lista de appointments a partir de target single ou group. */
export function resolveActionAppointments(target) {
  if (target?.kind === 'group' && Array.isArray(target.appointments)) return target.appointments;
  if (Array.isArray(target?.appointments)) return target.appointments;
  return target ? [target] : [];
}

/** Payload para modais de cancelar/reagendar com suporte a grupo. */
export function scheduleRowFromTarget(target) {
  const items = resolveActionAppointments(target);
  const first = items[0];
  if (!first) return null;
  return {
    agenda: first,
    groupAppointments: items.length > 1 ? items : undefined,
  };
}

/** Reagenda grupo mantendo durações consecutivas a partir do payload base. */
export async function reagendarAppointmentGroup(items, basePayload, handleReagendar) {
  let startHm = String(basePayload.novaHoraInicio || '').slice(0, 5);
  const date = basePayload.novaData;
  const succeeded = [];
  const failed = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const dur = Number(item.duracaoMin) || 45;
    const endHm = addMinutesToTime(startHm, dur);
    try {
      const ok = await handleReagendar(
        item.agendaId,
        {
          ...basePayload,
          novaData: date,
          novaHoraInicio: startHm.length === 5 ? `${startHm}:00` : startHm,
          novaHoraFim: endHm.length === 5 ? `${endHm}:00` : endHm,
        },
        {
          successToast: false,
        },
      );
      if (!ok) throw new Error('reagendar failed');
      succeeded.push(item);
      startHm = endHm;
    } catch (error) {
      failed.push({ item, error });
      break;
    }
  }

  return { succeeded, failed, partial: succeeded.length > 0 && failed.length > 0, allOk: failed.length === 0 };
}
