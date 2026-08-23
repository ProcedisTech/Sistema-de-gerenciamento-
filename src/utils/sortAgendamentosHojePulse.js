import { parseSlotLocalDateTime } from './agendaStartTolerance.js';
import { getGuaranteedNow } from './serverTime.js';

/**
 * Slot do painel "Agendamentos de hoje" já encerrado no relógio garantido.
 * Status reais: pendente | confirmado | aguardando_confirmacao | cancelado | realizado | reagendado.
 * @param {{ status?: string, data?: string, horaFim?: string }} row
 * @param {Date} [now]
 */
export function isAgendamentoHojePassado(row, now = getGuaranteedNow()) {
  if (String(row?.status || '') === 'realizado') return true;
  const end = parseSlotLocalDateTime(row?.data, row?.horaFim);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

/**
 * Próximos (horaInicio asc) primeiro; realizados / horaFim < agora no fim (ainda por hora).
 * @param {Array<object>} rows
 * @param {Date} [now]
 */
export function sortAgendamentosHojePulse(rows, now = getGuaranteedNow()) {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const aPast = isAgendamentoHojePassado(a, now) ? 1 : 0;
    const bPast = isAgendamentoHojePassado(b, now) ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    return String(a?.horaInicio || '').localeCompare(String(b?.horaInicio || ''));
  });
}
