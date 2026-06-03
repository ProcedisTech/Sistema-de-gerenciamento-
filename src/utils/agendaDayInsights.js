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

/** horaFim de uma linha do dashboard (campo explícito ou derivado). */
export function appointmentHoraFim(appointment) {
  if (!appointment) return '00:00';
  const hf = appointment.horaFim != null ? String(appointment.horaFim).slice(0, 5) : '';
  if (hf) return normalizeHm(hf);
  const hi = normalizeHm(appointment.horaInicio);
  const dur = Number(appointment.duracaoMin) || 45;
  return normalizeHm(addMinutesToTime(hi, dur));
}

function isGroupEligible(appointment) {
  return (
    appointment?.tipo !== 'bloqueio' &&
    String(appointment?.pacienteId || '').trim() !== ''
  );
}

function canMergeConsecutive(prev, next) {
  if (!prev || !next) return false;
  if (!isGroupEligible(prev) || !isGroupEligible(next)) return false;
  if (String(prev.pacienteId) !== String(next.pacienteId)) return false;
  if (String(prev.profissionalRoleUserId || prev.roleUserId) !== String(next.profissionalRoleUserId || next.roleUserId)) {
    return false;
  }
  if (String(prev.data) !== String(next.data)) return false;
  return normalizeHm(appointmentHoraFim(prev)) === normalizeHm(next.horaInicio);
}

function buildGroupEntry(appointments) {
  const first = appointments[0];
  const last = appointments[appointments.length - 1];
  const horaInicio = normalizeHm(first.horaInicio);
  const horaFim = appointmentHoraFim(last);
  const duracaoTotalMin = appointments.reduce((sum, a) => sum + (Number(a.duracaoMin) || 45), 0);
  return {
    kind: 'group',
    id: `group-${appointments.map((a) => a.id).join('__')}`,
    appointments,
    horaInicio,
    horaFim,
    duracaoTotalMin,
    pacienteId: first.pacienteId,
    pacienteNome: first.pacienteNome,
    profissionalRoleUserId: first.profissionalRoleUserId || first.roleUserId,
    profissionalNome: first.profissionalNome,
    data: first.data,
  };
}

/**
 * Agrupa agendas consecutivas do mesmo paciente/profissional/dia.
 * Retorna array de { kind: 'single', appointment } | { kind: 'group', ... }.
 */
export function groupConsecutiveAppointments(items) {
  const rows = sortAppointmentsByTime(items || []);
  const result = [];
  let chain = [];

  function flushChain() {
    if (chain.length === 0) return;
    if (chain.length === 1) {
      result.push({ kind: 'single', appointment: chain[0] });
    } else {
      result.push(buildGroupEntry(chain));
    }
    chain = [];
  }

  for (const item of rows) {
    if (!isGroupEligible(item)) {
      flushChain();
      result.push({ kind: 'single', appointment: item });
      continue;
    }
    if (chain.length === 0) {
      chain.push(item);
      continue;
    }
    const prev = chain[chain.length - 1];
    if (canMergeConsecutive(prev, item)) {
      chain.push(item);
    } else {
      flushChain();
      chain.push(item);
    }
  }
  flushChain();
  return result;
}

/** Bucket de status para um grupo de agendas. */
export function getGroupedStatusBucket(appointments) {
  const buckets = (appointments || [])
    .map((a) => getAppointmentStatusBucket(a))
    .filter(Boolean);
  const unique = [...new Set(buckets)];
  if (unique.length === 0) return 'pendente';
  if (unique.length === 1) return unique[0];
  return 'misto';
}

/** IDs de todas as agendas em uma entry (single ou group). */
export function getEntryAppointmentIds(entry) {
  if (!entry) return [];
  if (entry.kind === 'group') return (entry.appointments || []).map((a) => String(a.id));
  if (entry.kind === 'single' && entry.appointment) return [String(entry.appointment.id)];
  return [];
}

/** Primeiro appointment representativo de uma entry. */
export function getEntryPrimaryAppointment(entry) {
  if (!entry) return null;
  if (entry.kind === 'group') return entry.appointments?.[0] || null;
  return entry.appointment || null;
}

/** Todas as agendas de uma entry (single ou group). */
export function getAppointmentsFromEntry(entry) {
  if (!entry) return [];
  if (entry.kind === 'group') return entry.appointments || [];
  return entry.appointment ? [entry.appointment] : [];
}

/** Chave estável de agenda (dashboard row). */
export function appointmentIdKey(appointment) {
  return String(appointment?.agendaId || appointment?.id || '');
}

/**
 * Entry (single ou group) que contém a agenda clicada.
 * @param {Array} entries — saída de groupConsecutiveAppointments
 */
export function findEntryForAppointmentId(entries, agendaId) {
  const id = String(agendaId || '');
  if (!id) return null;
  for (const entry of entries || []) {
    const apps = getAppointmentsFromEntry(entry);
    if (apps.some((a) => appointmentIdKey(a) === id)) return entry;
  }
  return null;
}

/**
 * Resolve target de ação (entry group/single) a partir de uma linha clicada e do dia.
 * Única regra de contiguidade: groupConsecutiveAppointments.
 */
export function resolveActionTargetFromDayAppointments(dayRows, clickedRow) {
  if (!clickedRow) return null;
  const entries = groupConsecutiveAppointments(dayRows || []);
  const entry = findEntryForAppointmentId(entries, appointmentIdKey(clickedRow));
  if (entry) return entry;
  return { kind: 'single', appointment: clickedRow };
}

/** Próximo slot (single ou group) a partir de entries já agrupadas. */
export function getNextAppointmentEntry(entries, { now = new Date(), todayIso } = {}) {
  const nowHm = normalizeHm(`${now.getHours()}:${now.getMinutes()}`);
  for (const entry of entries || []) {
    const primary = getEntryPrimaryAppointment(entry);
    if (!primary) continue;
    if (!isKpiCountableAppointment(primary)) continue;
    if (!isActiveSlot(primary)) continue;
    if (todayIso && String(primary.data) !== String(todayIso)) continue;
    if (compareHm(entry.horaInicio || primary.horaInicio, nowHm) >= 0) return entry;
  }
  return null;
}

/** Preview agrupado para ListDayCards. */
export function formatListDayPreviewEntry(entry) {
  if (!entry) return '';
  if (entry.kind === 'single') return formatListDayPreviewLabel(entry.appointment);
  const names = (entry.appointments || [])
    .map((a) => a.procedimentoNome || 'Sem procedimento')
    .filter(Boolean);
  const patient = entry.pacienteNome || 'Paciente';
  if (names.length <= 2) return `${patient} · ${names.join(' + ')}`;
  return `${patient} · ${names[0]} +${names.length - 1} proc.`;
}

/** Faixa horária formatada para card agrupado. */
export function formatGroupedTimeRange(entry) {
  if (!entry) return '';
  if (entry.kind === 'single') {
    const a = entry.appointment;
    return `${normalizeHm(a.horaInicio)} · ${Number(a.duracaoMin) || 0}min`;
  }
  const totalMin = entry.duracaoTotalMin || 0;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const durLabel = hours > 0 ? (mins ? `${hours}h ${mins}min` : `${hours}h`) : `${totalMin}min`;
  return `${entry.horaInicio} → ${entry.horaFim} · ${durLabel}`;
}
