import { parseSlotLocalDateTime } from './agendaStartTolerance.js';
import { getGuaranteedNow } from './serverTime.js';
import { groupConsecutiveAppointments } from './agendaDayInsights.js';

/**
 * Slot do painel "Agendamentos de hoje" já encerrado no relógio garantido (horaFim no fuso da clínica).
 * Status reais: pendente | confirmado | aguardando_confirmacao | cancelado | realizado | reagendado.
 * @param {{ status?: string, data?: string, horaFim?: string }} row
 * @param {string} fuso IANA da clínica
 * @param {Date} [now]
 */
export function isAgendamentoHojePassado(row, fuso, now = getGuaranteedNow()) {
  if (String(row?.status || '') === 'realizado') return true;
  const end = parseSlotLocalDateTime(row?.data, row?.horaFim, fuso);
  if (!end) return false;
  return end.getTime() < now.getTime();
}

/**
 * Próximos (horaInicio asc) primeiro; realizados / horaFim < agora no fim (ainda por hora).
 * @param {Array<object>} rows
 * @param {string} fuso IANA da clínica
 * @param {Date} [now]
 */
export function sortAgendamentosHojePulse(rows, fuso, now = getGuaranteedNow()) {
  const list = Array.isArray(rows) ? [...rows] : [];
  return list.sort((a, b) => {
    const aPast = isAgendamentoHojePassado(a, fuso, now) ? 1 : 0;
    const bPast = isAgendamentoHojePassado(b, fuso, now) ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    return String(a?.horaInicio || '').localeCompare(String(b?.horaInicio || ''));
  });
}

/**
 * Linha que representa o card na ordenação: a própria agenda (simples) ou
 * data/horaInicio/horaFim do grupo (grupo nunca tem realizado — o agrupador não junta realizado).
 */
function linhaDoCard(entrada) {
  if (entrada?.kind === 'group') {
    return { data: entrada.data, horaInicio: entrada.horaInicio, horaFim: entrada.horaFim };
  }
  return entrada?.appointment ?? null;
}

/**
 * Card do painel (simples ou grupo) já encerrado — mesmo critério de isAgendamentoHojePassado.
 * @param {{ kind: 'single', appointment: object } | { kind: 'group', data: string, horaInicio: string, horaFim: string }} entrada
 * @param {string} fuso IANA da clínica
 * @param {Date} [now]
 */
export function isEntradaHojePassada(entrada, fuso, now = getGuaranteedNow()) {
  return isAgendamentoHojePassado(linhaDoCard(entrada), fuso, now);
}

/**
 * Chave de partição paciente + profissional + dia (mesmos campos que o agrupador compara).
 * Linha sem paciente ou bloqueio nunca agrupa: vai sozinha na própria partição.
 */
function chaveParticao(row, indice) {
  const pacienteId = String(row?.pacienteId || '').trim();
  if (row?.tipo === 'bloqueio' || pacienteId === '') return `solo:${indice}`;
  const profissional = String(row?.profissionalRoleUserId || row?.roleUserId);
  return `${pacienteId}|${profissional}|${String(row?.data)}`;
}

/** Primeira linha do card (simples ou grupo), para desempate pela ordem de entrada. */
function primeiraLinhaDoCard(entrada) {
  return entrada?.kind === 'group' ? entrada.appointments?.[0] : entrada?.appointment;
}

/**
 * Cards do painel "Agendamentos de hoje" com o MESMO agrupamento da Agenda
 * (groupConsecutiveAppointments) e a mesma ordem de sortAgendamentosHojePulse:
 * próximos primeiro, passados no fim, cada bloco por horaInicio.
 *
 * Na sidebar as linhas de todas as profissionais vêm juntas; o agrupador reordena por
 * horaInicio e só junta vizinhos, então outro paciente no mesmo horário separaria a cadeia.
 * Por isso partimos por paciente + profissional + dia, chamamos o agrupador em cada
 * partição (o critério de juntar continua 100% o dele) e reordenamos os cards por horário.
 * @param {Array<object>} rows linhas do dashboard
 * @param {string} fuso IANA da clínica
 * @param {Date} [now]
 */
export function agruparAgendamentosHojePulse(rows, fuso, now = getGuaranteedNow()) {
  const lista = Array.isArray(rows) ? rows : [];
  const ordemEntrada = new Map();
  const particoes = new Map();
  lista.forEach((row, indice) => {
    ordemEntrada.set(row, indice);
    const chave = chaveParticao(row, indice);
    if (!particoes.has(chave)) particoes.set(chave, []);
    particoes.get(chave).push(row);
  });
  const entradas = [];
  for (const linhas of particoes.values()) {
    entradas.push(...groupConsecutiveAppointments(linhas));
  }
  return entradas.sort((a, b) => {
    const la = linhaDoCard(a);
    const lb = linhaDoCard(b);
    const aPast = isAgendamentoHojePassado(la, fuso, now) ? 1 : 0;
    const bPast = isAgendamentoHojePassado(lb, fuso, now) ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    const porHora = String(la?.horaInicio || '').localeCompare(String(lb?.horaInicio || ''));
    if (porHora !== 0) return porHora;
    return (ordemEntrada.get(primeiraLinhaDoCard(a)) ?? 0) - (ordemEntrada.get(primeiraLinhaDoCard(b)) ?? 0);
  });
}
