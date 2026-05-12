import { agendasApi } from '../services/api';
import { addMinutesToTime } from './agendaMapping';
import { isAgendaSlotOverlapError } from './agendaErrors';

const DURATION_MIN = 45;
const STEP_MIN = 15;
const MAX_TRIES = 48;

/**
 * Cria slot em tb_agenda para fechar a jornada. Se o horário inicial colidir com
 * fn_validar_conflito_agenda, avança de STEP_MIN em STEP_MIN até achar intervalo livre.
 * Sem isso, “finalizar jornada” falha sempre que já existir qualquer sobreposição no dia.
 */
export async function createJourneyAgendaSlotWithBackoff({
  dataAgendamento,
  roleUserId,
  startHhMm,
  observacao = 'Jornada — horário automático',
}) {
  let hi = String(startHhMm || '09:00').slice(0, 5);
  let lastOverlapError = null;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const hf = addMinutesToTime(hi, DURATION_MIN);
    try {
      const agenda = await agendasApi.create({
        dataAgendamento,
        horaInicio: `${hi}:00`,
        horaFim: `${hf}:00`,
        roleUserId,
        observacao,
      });
      return {
        agenda,
        shiftedByMinutes: attempt * STEP_MIN,
        usedStart: hi,
        usedEnd: hf,
      };
    } catch (e) {
      if (isAgendaSlotOverlapError(e)) {
        lastOverlapError = e;
        hi = addMinutesToTime(hi, STEP_MIN);
        continue;
      }
      throw e;
    }
  }

  throw lastOverlapError ?? new Error('Não foi possível achar horário livre hoje para este profissional.');
}
