import { addMinutesToTime } from './agendaMapping.js';
import { isAgendaNoShow } from './agendaCancelamentoMotivo.js';
import { isKpiCountableAppointment } from './agendaKpiDrilldown.js';
import { bloqueioMotivoLabel } from '../components/agenda/agendaBloqueioStyles.js';

export const STATUS_FILTER_KEYS = ['confirmado', 'pendente', 'cancelado', 'noshow'];

export const ALL_STATUS_FILTERS = new Set(STATUS_FILTER_KEYS);

/** Tie-break para count pill / status dominante no calendário. */
export const DOMINANT_STATUS_TIE_PRIORITY = ['pendente', 'confirmado', 'cancelado', 'noshow'];

const LOADBAR_BUCKETS = ['confirmado', 'pendente', 'cancelado', 'noshow'];

const ACTIVE_STATUSES = new Set(['confirmado', 'pendente', 'aguardando_confirmacao']);
const TERMINAL_STATUSES = new Set(['cancelado', 'realizado', 'reagendado']);

function normalizeHm(value) {
  const s = String(value || '00:00').trim();
  const parts = s.split(':');
  const h = String(Number(parts[0]) || 0).padStart(2, '0');
  const m = String(Number(parts[1]) || 0).padStart(2, '0');
  return `${h}:${m}`;
}

function compareHm(a, b) {
  return normalizeHm(a).localeCompare(normalizeHm(b));
}

export function getFirstName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || '';
}

export function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function formatGreetingLine(userDisplayName, now = new Date()) {
  const greeting = getGreeting(now);
  const first = getFirstName(userDisplayName);
  return first ? `${greeting}, ${first}` : greeting;
}

export function formatWeekdayLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export function formatSubtitleForDay({ selectedDay, appointmentCount, isToday }) {
  const weekday = formatWeekdayLong(selectedDay);
  const datePart = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(
    new Date(
      Number(selectedDay?.slice(0, 4)) || 0,
      Number(selectedDay?.slice(5, 7)) - 1 || 0,
      Number(selectedDay?.slice(8, 10)) || 1,
    ),
  );
  const n = appointmentCount ?? 0;
  const countLabel = `${n} agendamento${n === 1 ? '' : 's'}`;
  if (isToday) {
    return `${weekday}, ${datePart} · ${countLabel} hoje`;
  }
  return `${weekday}, ${datePart} · ${countLabel}`;
}

function isActiveSlot(appointment) {
  if (!appointment) return false;
  if (appointment.tipo === 'bloqueio') return appointment.status !== 'cancelado';
  return !TERMINAL_STATUSES.has(appointment.status);
}

export function sortAppointmentsByTime(appointments) {
  return [...(appointments || [])].sort((a, b) => compareHm(a.horaInicio, b.horaInicio));
}

export function getNextAppointment(appointments, { now = new Date(), todayIso } = {}) {
  const nowHm = normalizeHm(`${now.getHours()}:${now.getMinutes()}`);
  const candidates = sortAppointmentsByTime(appointments).filter((item) => {
    if (!isKpiCountableAppointment(item)) return false;
    if (!isActiveSlot(item)) return false;
    if (todayIso && String(item.data) !== String(todayIso)) return false;
    return compareHm(item.horaInicio, nowHm) >= 0;
  });
  return candidates[0] || null;
}

export function getInProgressAppointment(appointments, { now = new Date() } = {}) {
  const nowHm = normalizeHm(`${now.getHours()}:${now.getMinutes()}`);
  return (
    sortAppointmentsByTime(appointments).find((item) => {
      if (!ACTIVE_STATUSES.has(item.status) && item.tipo !== 'bloqueio') return false;
      if (item.tipo === 'bloqueio' && item.status === 'cancelado') return false;
      const start = normalizeHm(item.horaInicio);
      const dur = Number(item.duracaoMin) || 30;
      const end = normalizeHm(addMinutesToTime(start, dur));
      return compareHm(start, nowHm) <= 0 && compareHm(nowHm, end) < 0;
    }) || null
  );
}

export function countByStatus(appointments) {
  const counts = {
    confirmado: 0,
    pendente: 0,
    aguardando_confirmacao: 0,
    cancelado: 0,
    realizado: 0,
    reagendado: 0,
    bloqueio: 0,
  };
  for (const item of appointments || []) {
    if (item.tipo === 'bloqueio' && item.status !== 'cancelado') {
      counts.bloqueio += 1;
      continue;
    }
    const s = item.status;
    if (counts[s] != null) counts[s] += 1;
  }
  return {
    confirmado: counts.confirmado,
    pendente: counts.pendente + counts.aguardando_confirmacao,
    cancelado: counts.cancelado,
    realizado: counts.realizado,
    reagendado: counts.reagendado,
    bloqueio: counts.bloqueio,
    total: (appointments || []).length,
  };
}

export function getStatusDotColor(appointment) {
  if (appointment?.tipo === 'bloqueio') return 'bg-slate-400';
  const map = {
    confirmado: 'bg-emerald-500',
    pendente: 'bg-amber-500',
    aguardando_confirmacao: 'bg-amber-500',
    cancelado: 'bg-rose-500',
    reagendado: 'bg-purple-500',
    realizado: 'bg-blue-400',
  };
  return map[appointment?.status] || 'bg-slate-300';
}

/** Bucket para chips do control strip (no-show separado de cancelado). */
export function getAppointmentStatusBucket(row) {
  if (!row) return null;
  if (row.tipo === 'bloqueio') return 'bloqueio';
  if (row.status === 'pendente' || row.status === 'aguardando_confirmacao') return 'pendente';
  if (row.status === 'confirmado') return 'confirmado';
  if (row.status === 'cancelado') {
    return isAgendaNoShow(row) ? 'noshow' : 'cancelado';
  }
  return null;
}

/**
 * Filtro client-side por Set de status (confirmado, pendente, cancelado, noshow).
 * Bloqueios sempre visíveis; realizado/reagendado ocultos.
 */
export function filterAppointmentsByStatusFilters(appointments, filters) {
  const active = filters instanceof Set ? filters : new Set(filters);
  if (active.size === 0) {
    return (appointments || []).filter((item) => item?.tipo === 'bloqueio' && item.status !== 'cancelado');
  }
  return (appointments || []).filter((item) => {
    if (item?.tipo === 'bloqueio' && item.status !== 'cancelado') return true;
    const bucket = getAppointmentStatusBucket(item);
    return bucket != null && active.has(bucket);
  });
}

/** Contagens do mês para pills dos chips (sem aplicar filtro ativo). */
export function countAppointmentsByStatusBucket(appointments) {
  const counts = { confirmado: 0, pendente: 0, cancelado: 0, noshow: 0, all: 0 };
  for (const item of appointments || []) {
    if (item?.tipo === 'bloqueio') continue;
    const bucket = getAppointmentStatusBucket(item);
    if (bucket && bucket !== 'bloqueio' && counts[bucket] != null) {
      counts[bucket] += 1;
      counts.all += 1;
    }
  }
  return counts;
}

/** Distribuição por bucket no dia (loadbar + dominante). */
export function getStatusDistributionForDay(dayAppointments) {
  const dist = { confirmado: 0, pendente: 0, cancelado: 0, noshow: 0, bloqueio: 0 };
  for (const item of dayAppointments || []) {
    const bucket = getAppointmentStatusBucket(item);
    if (bucket && dist[bucket] != null) dist[bucket] += 1;
  }
  return dist;
}

/** Status com mais ocorrências no dia; null se nenhum countable. */
export function getDominantStatusForDay(dayAppointments) {
  const dist = getStatusDistributionForDay(dayAppointments);
  let best = null;
  let bestCount = 0;
  for (const key of DOMINANT_STATUS_TIE_PRIORITY) {
    const n = dist[key] || 0;
    if (n > bestCount) {
      bestCount = n;
      best = key;
    }
  }
  return bestCount > 0 ? best : null;
}

export function getStatusSwatchClass(bucket) {
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
    bloqueio: 'bg-ink-400',
  };
  return map[bucket] || 'bg-ink-300';
}

export function getStatusPillBgClass(bucket) {
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
  };
  return map[bucket] || 'bg-ink-500';
}

export function getLoadbarSegments(dayAppointments) {
  const dist = getStatusDistributionForDay(dayAppointments);
  return LOADBAR_BUCKETS.map((key) => ({ key, count: dist[key] || 0 })).filter((s) => s.count > 0);
}

export function formatCalendarPreviewHeader(iso) {
  if (!iso) return '';
  const weekday = formatWeekdayLong(iso).slice(0, 3);
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const monthDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(date);
  return `${weekday}, ${monthDay}`;
}

export function countCountableAppointments(rows) {
  return (rows || []).filter((item) => item?.tipo !== 'bloqueio' && getAppointmentStatusBucket(item)).length;
}

/** Dia com eventos no mês bruto, mas filtro F2 escondeu todos na grade. */
export function isDayEmptyByFilter(iso, appointmentsByDate, appointmentsByDateRaw) {
  const filtered = appointmentsByDate?.[iso] || [];
  const raw = appointmentsByDateRaw?.[iso] || [];
  const rawCountable = countCountableAppointments(raw);
  return rawCountable > 0 && filtered.length === 0;
}

export function getEventDisplayLabel(appointment) {
  if (appointment?.tipo === 'bloqueio') {
    const m = String(appointment.motivo || appointment.observacao || '').trim();
    return m || 'Bloqueio';
  }
  return getFirstName(appointment?.pacienteNome) || 'Paciente';
}

export function filterAppointmentsByStatus(appointments, statusFilter) {
  if (!statusFilter) return appointments || [];
  return (appointments || []).filter((item) => {
    if (statusFilter === 'bloqueio') {
      return item.tipo === 'bloqueio' && item.status !== 'cancelado';
    }
    if (statusFilter === 'pendente') {
      return item.status === 'pendente' || item.status === 'aguardando_confirmacao';
    }
    return item.status === statusFilter;
  });
}

/** Contagens separadas para cards da aba Lista (agendamentos vs bloqueios). */
export function countListDayItems(items) {
  const rows = Array.isArray(items) ? items : [];
  return {
    agendamentos: rows.filter(isKpiCountableAppointment).length,
    bloqueios: rows.filter((item) => item?.tipo === 'bloqueio').length,
  };
}

function pluralPt(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Badge/modal da aba Lista — omite contadores zero; separador " · ". */
export function formatListDayCountLabel(items, { suffix = '' } = {}) {
  const { agendamentos, bloqueios } = countListDayItems(items);
  const parts = [];
  if (agendamentos > 0) parts.push(pluralPt(agendamentos, 'agendamento', 'agendamentos'));
  if (bloqueios > 0) parts.push(pluralPt(bloqueios, 'bloqueio', 'bloqueios'));
  if (parts.length === 0) return suffix ? `0 agendamentos${suffix}` : '0 agendamentos';
  return `${parts.join(' · ')}${suffix}`;
}

/** Preview do primeiro item cronológico no card da aba Lista. */
export function formatListDayPreviewLabel(item) {
  if (item?.tipo === 'bloqueio') {
    return `[BLOQUEIO] ${bloqueioMotivoLabel(item)}`;
  }
  return item?.pacienteNome || 'Paciente';
}
