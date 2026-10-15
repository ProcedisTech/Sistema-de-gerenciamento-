import { toDateKey } from './agendaDateUtils.js';
import { fetchDashboardAppointmentsForRange } from './agendaDashboardMapping.js';
import {
  agoraDaClinica,
  diaDoInstante,
  ehInstante,
  formatarDataCalendario,
  hojeDaClinica,
  instanteMs,
  normalizarDataCalendario,
  somarDias,
} from './datasClinica.js';

/**
 * YYYY-MM-DD de hoje no calendário da clínica (alinhado à agenda).
 * @param {string} fuso IANA da clínica
 * @param {number} [agoraMs]
 */
export function todayIsoInClinica(fuso, agoraMs = Date.now()) {
  return hojeDaClinica(fuso, agoraMs);
}

/**
 * `"YYYY-MM-DD HH:mm"` comparável lexicograficamente (relógio da clínica).
 * @param {string} fuso IANA da clínica
 * @param {number} [agoraMs]
 */
export function nowComparableDateTimeClinica(fuso, agoraMs = Date.now()) {
  const a = agoraDaClinica(fuso, agoraMs);
  return `${a.dataIso} ${a.hhmm}`;
}

export function normalizeRowHhmm(hmRaw) {
  const s = String(hmRaw ?? '00:00').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '00:00';
  const h = String(Number(m[1])).padStart(2, '0');
  return `${h}:${m[2]}`;
}

export function dashboardRowComparableDateTime(row) {
  const date = toDateKey(row?.data);
  const hm = normalizeRowHhmm(row?.horaInicio);
  return `${date} ${hm}`;
}

export function addCalendarDaysIsoYmd(startIso, deltaDays) {
  const key = toDateKey(startIso);
  return somarDias(key, deltaDays) || key;
}

/** Linha do dashboard → data+hora de calendário da clínica `"YYYY-MM-DDTHH:mm"` (sem fuso). */
export function dashboardRowToCalendarDateTime(row) {
  const date = normalizarDataCalendario(toDateKey(row?.data));
  if (!date) return null;
  const hm = normalizeRowHhmm(row?.horaInicio ?? '09:00');
  return `${date}T${hm}`;
}

/** Primeiro instant em ISO extraído do procedimento feito (Spring / aliases). */
export function procedureOccurredInstantIso(proc) {
  if (!proc || typeof proc !== 'object') return null;
  const keys = [
    'horaFim',
    'hora_fim',
    'horaInicio',
    'hora_inicio',
    'criadoEm',
    'finalizadoEm',
    'dataInicio',
    'data_inicio',
    'dataHora',
    'data_hora',
    'updatedAt',
    'updated_at',
  ];
  for (const k of keys) {
    const v = proc[k];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (!s) continue;
    if (!Number.isNaN(instanteMs(s))) return s;
  }
  return null;
}

/** Mais recente `procedureOccurredInstantIso` na lista (mesma ideia do preview por criadoEm). */
export function latestProcedureOccurredInstantIso(procedures) {
  const arr = Array.isArray(procedures) ? procedures : [];
  let best = null;
  let bestMs = -Infinity;
  for (const proc of arr) {
    const iso = procedureOccurredInstantIso(proc);
    if (!iso) continue;
    const nome = String(proc?.statusNome || proc?.status || '').toLowerCase();
    if (nome.includes('cancel')) continue;
    const ms = instanteMs(iso);
    if (ms > bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}

/**
 * "YYYY-MM-DD" de um valor de data: instante (com "Z"/offset) → dia no fuso da clínica;
 * calendário ("YYYY-MM-DD[THH:mm]" sem fuso) → o próprio dia. '' se não reconhecido.
 */
export function diaDoValorData(valor, fuso) {
  if (valor == null || valor === '') return '';
  const s = String(valor).trim();
  if (ehInstante(s)) return diaDoInstante(s, fuso);
  return normalizarDataCalendario(s);
}

/**
 * Cartões resumo (Última visita / Próximo retorno): só o dia (dd/mm/aaaa).
 * @param {string} valor instante (ultimaVinda) ou data+hora de calendário (proximoAgendamento)
 * @param {string} fuso IANA da clínica
 */
export function formatCartaoDiaPtBr(valor, fuso) {
  const dia = diaDoValorData(valor, fuso);
  return dia ? formatarDataCalendario(dia) : '-';
}

/** Data ISO (instante ou calendário) em string legada → somente data para o cartão. */
export function formatCartaoIfIsoString(raw, fuso) {
  const leg = String(raw ?? '').trim();
  if (!leg || leg === '-' || leg === '—') return null;
  const dia = diaDoValorData(leg, fuso);
  return dia ? formatarDataCalendario(dia) : null;
}

/**
 * Data do último atendimento a partir do DTO (lista/perfil): ultimaVinda (ISO) → ultimaVisita (dd/mm ou ISO legado).
 * Retorna '-' quando ausente.
 * @param {object} p paciente mapeado
 * @param {string} fuso IANA da clínica
 */
export function patientUltimaVisitaDayFromDto(p, fuso) {
  if (!p) return '-';
  if (p.ultimaVinda != null && String(p.ultimaVinda).trim() !== '') {
    return formatCartaoDiaPtBr(p.ultimaVinda, fuso);
  }
  const leg = String(p.ultimaVisita || '').trim();
  const isoFmt = formatCartaoIfIsoString(leg, fuso);
  if (isoFmt) return isoFmt;
  return leg && leg !== '-' && leg !== '—' ? leg : '-';
}

function uuidDigits(value) {
  return String(value ?? '')
    .replace(/-/g, '')
    .trim()
    .toLowerCase();
}

function pacienteIdsMatch(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  const da = uuidDigits(a);
  const db = uuidDigits(b);
  if (da.length >= 16 && db.length >= 16 && da === db) return true;
  return false;
}

function nomeCarteiraNorm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** IDs do paciente na linha do dashboard (DTO pode omitir no nível raiz e mandar só em rawAgendamento). */
function collectRowPacienteIds(row) {
  const out = [];
  const push = (v) => {
    if (v == null || v === '') return;
    const s = String(v).trim();
    if (s) out.push(s);
  };
  push(row?.pacienteId);
  push(row?.paciente_id);
  const raw = row?.rawAgendamento;
  if (raw && typeof raw === 'object') {
    push(raw.pacienteId);
    push(raw.paciente_id);
  }
  return out;
}

function rowMatchesPaciente(row, pid, nomePacienteNorm) {
  const ids = collectRowPacienteIds(row).filter((id) => String(id).trim() !== '');
  if (ids.length > 0) {
    return ids.some((id) => pacienteIdsMatch(id, pid));
  }
  if (!nomePacienteNorm || nomePacienteNorm.length < 2) return false;
  const rowNome = nomeCarteiraNorm(row?.pacienteNome);
  return rowNome.length >= 2 && rowNome === nomePacienteNorm;
}

function rowLooksCanceled(row) {
  const st = String(row?.status ?? '').toLowerCase();
  const sn = String(row?.statusNome ?? '').toLowerCase();
  return st === 'cancelado' || sn.includes('cancel');
}

/**
 * Próximo compromisso futuro do paciente no intervalo [hoje da clínica, +366 dias],
 * usando o mesmo pipeline da agenda (`fetchDashboardAppointmentsForRange`).
 *
 * @param {string} pacienteId UUID do paciente
 * @param {{ pacienteNome?: string, fuso?: string }} [opts] — `fuso` da clínica (IANA); se o backend não enviar
 *   `pacienteId` no compromisso, tenta casar pelo nome (homônimos podem colidir).
 * @returns {Promise<string | null>} data+hora de calendário da clínica `"YYYY-MM-DDTHH:mm"`
 */
export async function fetchNextAppointmentIsoForPaciente(pacienteId, opts = {}) {
  const pid = pacienteId != null ? String(pacienteId).trim() : '';
  if (!pid) return null;
  const nomeRef = nomeCarteiraNorm(opts.pacienteNome ?? opts.nome ?? '');
  const today = todayIsoInClinica(opts.fuso);
  const end = addCalendarDaysIsoYmd(today, 366);
  let rows = [];
  try {
    rows = await fetchDashboardAppointmentsForRange(today, end);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const nowCmp = nowComparableDateTimeClinica(opts.fuso);
  for (const row of rows) {
    if (!row || row.tipo === 'bloqueio') continue;
    if (rowLooksCanceled(row)) continue;
    if (!rowMatchesPaciente(row, pid, nomeRef)) continue;
    const cmp = dashboardRowComparableDateTime(row);
    if (cmp < nowCmp) continue;
    return dashboardRowToCalendarDateTime(row);
  }
  return null;
}
