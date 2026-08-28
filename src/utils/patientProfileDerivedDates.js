import { toDateKey } from './agendaDateUtils.js';
import { fetchDashboardAppointmentsForRange } from './agendaDashboardMapping.js';

const TZ_BR = 'America/Sao_Paulo';

/** YYYY-MM-DD do calendário em São Paulo (alinhado à agenda). */
export function todayIsoInSaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** `"YYYY-MM-DD HH:mm"` comparável lexicograficamente (hora em São Paulo). */
export function nowComparableDateTimeSaoPaulo(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_BR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const pad = (v) => String(v ?? '').padStart(2, '0');
  const y = map.year;
  const mo = pad(map.month);
  const d = pad(map.day);
  const h = pad(map.hour);
  const mi = pad(map.minute);
  return `${y}-${mo}-${d} ${h}:${mi}`;
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
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const ms = Date.UTC(y, m - 1, d + deltaDays);
  const dt = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Converte linha do dashboard em instante UTC (interpretação horário local do navegador).
 * Alinha-se ao uso de `Date` na agenda ao editar slots no mesmo fuso da clínica.
 */
export function dashboardRowToUtcApproxIso(row) {
  const date = toDateKey(row?.data);
  const hm = normalizeRowHhmm(row?.horaInicio ?? '09:00');
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hm.split(':').map((x) => Number(x));
  if (!y || !mo || !d) return null;
  const local = new Date(y, mo - 1, d, Number.isFinite(h) ? h : 0, Number.isFinite(mi) ? mi : 0, 0, 0);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
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
    const t = new Date(s).getTime();
    if (!Number.isNaN(t)) return s;
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
    const ms = new Date(iso).getTime();
    if (ms > bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}

/** Cartões resumo (Última visita / Próximo retorno): só dia em America/Sao_Paulo. */
export function formatCartaoDiaPtBr(iso) {
  if (!iso) return '-';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '-';
  return t.toLocaleDateString('pt-BR', { timeZone: TZ_BR });
}

/** ISO instant em string legada → somente data para o cartão. */
export function formatCartaoIfIsoString(raw) {
  const leg = String(raw ?? '').trim();
  if (!leg || leg === '-' || leg === '—') return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(leg) && !leg.includes('T')) return null;
  const t = new Date(leg);
  if (Number.isNaN(t.getTime())) return null;
  return t.toLocaleDateString('pt-BR', { timeZone: TZ_BR });
}

/**
 * Data do último atendimento a partir do DTO (lista/perfil): ultimaVinda (ISO) → ultimaVisita (dd/mm ou ISO legado).
 * Retorna '-' quando ausente.
 */
export function patientUltimaVisitaDayFromDto(p) {
  if (!p) return '-';
  if (p.ultimaVinda != null && String(p.ultimaVinda).trim() !== '') {
    return formatCartaoDiaPtBr(p.ultimaVinda);
  }
  const leg = String(p.ultimaVisita || '').trim();
  const isoFmt = formatCartaoIfIsoString(leg);
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
 * Próximo compromisso futuro do paciente no intervalo [hoje BR, +366 dias],
 * usando o mesmo pipeline da agenda (`fetchDashboardAppointmentsForRange`).
 *
 * @param {string} pacienteId UUID do paciente
 * @param {{ pacienteNome?: string }} [opts] — se o backend não enviar `pacienteId` no compromisso, tenta casar pelo nome (homônimos podem colidir).
 */
export async function fetchNextAppointmentIsoForPaciente(pacienteId, opts = {}) {
  const pid = pacienteId != null ? String(pacienteId).trim() : '';
  if (!pid) return null;
  const nomeRef = nomeCarteiraNorm(opts.pacienteNome ?? opts.nome ?? '');
  const today = todayIsoInSaoPaulo();
  const end = addCalendarDaysIsoYmd(today, 366);
  let rows = [];
  try {
    rows = await fetchDashboardAppointmentsForRange(today, end);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const nowCmp = nowComparableDateTimeSaoPaulo();
  for (const row of rows) {
    if (!row || row.tipo === 'bloqueio') continue;
    if (rowLooksCanceled(row)) continue;
    if (!rowMatchesPaciente(row, pid, nomeRef)) continue;
    const cmp = dashboardRowComparableDateTime(row);
    if (cmp < nowCmp) continue;
    return dashboardRowToUtcApproxIso(row);
  }
  return null;
}
