import { getAppointmentStatusBucket, sortAppointmentsByTime } from './agendaDayInsights.js';

export const TIMELINE_START_MIN = 6 * 60;
export const TIMELINE_END_MIN = 22 * 60;
export const TIMELINE_SPAN_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;

const TERMINAL_STATUSES = new Set(['cancelado', 'realizado', 'reagendado']);

function isActiveSlot(appointment) {
  if (!appointment) return false;
  if (appointment.tipo === 'bloqueio') return appointment.status !== 'cancelado';
  return !TERMINAL_STATUSES.has(appointment.status);
}

export function parseHmToMinutes(hm) {
  const s = String(hm || '00:00').trim();
  const parts = s.split(':');
  return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
}

export function formatHmFromMinutes(totalMin) {
  const m = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function formatHmDisplay(hm) {
  return String(hm || '').slice(0, 5);
}

export function formatDurationLabel(totalMin) {
  const mins = Number(totalMin) || 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${mins}min`;
}

export function appointmentInitials(appointment) {
  if (appointment?.tipo === 'bloqueio') {
    const label = String(appointment.motivo || appointment.observacao || 'Bloqueio').trim();
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return (parts[0] || 'BL').slice(0, 2).toUpperCase();
  }
  const parts = String(appointment?.pacienteNome || 'Paciente').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getTimelineBlockColorClass(statusBucket) {
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
    bloqueio: 'bg-ink-400',
    realizado: 'bg-blue-500',
  };
  return map[statusBucket] || 'bg-ink-300';
}

export function getHeroIndicator(appointments) {
  let totalMin = 0;
  for (const item of appointments || []) {
    if (!isActiveSlot(item)) continue;
    totalMin += Number(item.duracaoMin) || 30;
  }
  if (totalMin <= 0) return 'Dia livre';
  const hours = Math.round((totalMin / 60) * 10) / 10;
  if (hours < 1) return `${totalMin}min prev.`;
  const label = Number.isInteger(hours) ? String(hours) : String(hours).replace('.', ',');
  return `${label}h prev.`;
}

export function getHeroStats(appointments) {
  let agendados = 0;
  let cancelados = 0;
  for (const item of appointments || []) {
    if (item?.tipo === 'bloqueio') continue;
    const bucket = getAppointmentStatusBucket(item);
    if (bucket === 'confirmado' || bucket === 'pendente' || bucket === 'realizado') agendados += 1;
    else if (bucket === 'cancelado' || bucket === 'noshow') cancelados += 1;
  }
  return { agendados, cancelados };
}

export function getTimelineBlocks(appointments) {
  const blocks = [];
  for (const item of appointments || []) {
    if (item.tipo === 'bloqueio' && item.status === 'cancelado') continue;
    if (item.tipo !== 'bloqueio' && item.status === 'reagendado') continue;

    const startMin = parseHmToMinutes(item.horaInicio);
    const dur = Number(item.duracaoMin) || 30;
    const endMin = startMin + dur;
    if (endMin <= TIMELINE_START_MIN || startMin >= TIMELINE_END_MIN) continue;

    const clampedStart = Math.max(startMin, TIMELINE_START_MIN);
    const clampedEnd = Math.min(endMin, TIMELINE_END_MIN);
    let leftPercent = ((clampedStart - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
    let widthPercent = ((clampedEnd - clampedStart) / TIMELINE_SPAN_MIN) * 100;
    widthPercent = Math.max(widthPercent, 2);

    const statusBucket =
      item.tipo === 'bloqueio' ? 'bloqueio' : getAppointmentStatusBucket(item) || 'pendente';
    const faded = statusBucket === 'cancelado' || statusBucket === 'noshow';

    blocks.push({
      id: String(item.id),
      leftPercent,
      widthPercent,
      statusBucket,
      colorClass: getTimelineBlockColorClass(statusBucket),
      initials: appointmentInitials(item),
      faded,
    });
  }
  return blocks;
}

export function getNowLineLeftPercent(now, selectedDay, todayIso) {
  if (!selectedDay || !todayIso || selectedDay !== todayIso) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < TIMELINE_START_MIN || nowMin > TIMELINE_END_MIN) return null;
  return ((nowMin - TIMELINE_START_MIN) / TIMELINE_SPAN_MIN) * 100;
}

const PERIOD_ORDER = ['manha', 'tarde', 'noite'];

function periodForHm(hm) {
  const min = parseHmToMinutes(hm);
  if (min < 12 * 60) return 'manha';
  if (min < 18 * 60) return 'tarde';
  return 'noite';
}

export function groupAppointmentsByPeriod(appointments) {
  const grouped = { manha: [], tarde: [], noite: [] };
  for (const item of sortAppointmentsByTime(appointments)) {
    const key = periodForHm(item.horaInicio);
    grouped[key].push(item);
  }
  return grouped;
}

/** Agrupa entries (single/group) por período do dia usando horaInicio da entry. */
export function groupEntriesByPeriod(entries) {
  const grouped = { manha: [], tarde: [], noite: [] };
  for (const entry of entries || []) {
    const hm =
      entry?.kind === 'group'
        ? entry.horaInicio
        : entry?.appointment?.horaInicio;
    const key = periodForHm(hm);
    grouped[key].push(entry);
  }
  return grouped;
}

export function getEntrySortKey(entry) {
  if (!entry) return '';
  if (entry.kind === 'group') return entry.horaInicio || '';
  return entry.appointment?.horaInicio || '';
}

export function getEntryDomId(entry) {
  if (!entry) return '';
  if (entry.kind === 'group') return String(entry.id);
  return String(entry.appointment?.id || '');
}

export function getPeriodSuffix(period, { selectedDay, todayIso, now }) {
  if (!selectedDay || !todayIso || selectedDay !== todayIso || !now) return '';
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (period === 'manha' && nowMin >= 12 * 60) return 'concluída';
  if (period === 'tarde' && nowMin >= 12 * 60 && nowMin < 18 * 60) return 'em andamento';
  if (period === 'noite' && nowMin >= 18 * 60) return 'em andamento';
  return '';
}

export const PERIOD_LABELS = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

export function formatCountdown(targetHm, now) {
  const startMin = parseHmToMinutes(targetHm);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = startMin - nowMin;
  if (diff <= 0) return 'agora';
  if (diff < 60) return `${diff}min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function formatHeroMonth(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function formatHeroWeekLine(iso) {
  if (!iso) return '';
  const year = iso.slice(0, 4);
  const week = getIsoWeekNumber(iso);
  return `${year} · semana ${week}`;
}

function getIsoWeekNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

export function formatAgendaShortId(agendaId) {
  const raw = String(agendaId || '').replace(/[^a-zA-Z0-9]/g, '');
  const slice = raw.slice(0, 4) || '----';
  return `#${slice.toUpperCase()}`;
}

export function getStatusBadgePresentation(appointment) {
  if (appointment?.tipo === 'bloqueio') {
    return {
      label: 'Bloqueio',
      dotClass: 'bg-ink-400',
      pillClass: 'bg-ink-100 text-ink-700',
    };
  }
  const bucket = getAppointmentStatusBucket(appointment);
  const map = {
    confirmado: {
      label: 'Confirmado',
      dotClass: 'bg-status-ok',
      pillClass: 'bg-status-ok-bg text-vivid-teal-700',
    },
    pendente: {
      label: 'Pendente',
      dotClass: 'bg-status-warn',
      pillClass: 'bg-status-warn-bg text-status-warn-ink',
    },
    cancelado: {
      label: 'Cancelado',
      dotClass: 'bg-status-danger',
      pillClass: 'bg-status-danger-bg text-status-danger-ink',
    },
    noshow: {
      label: 'No-show',
      dotClass: 'bg-status-noshow',
      pillClass: 'bg-status-noshow-bg text-status-noshow-ink',
    },
    realizado: {
      label: 'Realizado',
      dotClass: 'bg-blue-500',
      pillClass: 'bg-blue-100 text-blue-800',
    },
    reagendado: {
      label: 'Reagendado',
      dotClass: 'bg-ink-400',
      pillClass: 'bg-ink-100 text-ink-600',
    },
    misto: {
      label: 'Parcial',
      dotClass: 'bg-gradient-to-r from-status-warn to-status-ok',
      pillClass: 'bg-ink-100 text-ink-700',
    },
  };
  if (bucket && map[bucket]) return map[bucket];
  const status = appointment?.status || 'pendente';
  return (
    map[status] || {
      label: status,
      dotClass: 'bg-ink-300',
      pillClass: 'bg-ink-100 text-ink-600',
    }
  );
}

/** Badge para grupo de agendas (status uniforme ou MISTO). */
export function getGroupedStatusBadgePresentation(appointments) {
  const buckets = (appointments || [])
    .map((a) => getAppointmentStatusBucket(a))
    .filter(Boolean);
  const unique = [...new Set(buckets)];
  if (unique.length === 1) {
    return getStatusBadgePresentation({ ...appointments[0], tipo: 'atendimento', status: appointments[0]?.status });
  }
  const pending = buckets.filter((b) => b === 'pendente').length;
  const confirmed = buckets.filter((b) => b === 'confirmado').length;
  const parts = [];
  if (pending) parts.push(`${pending} pend`);
  if (confirmed) parts.push(`${confirmed} conf`);
  return {
    label: parts.length ? parts.join(' · ') : 'Parcial',
    dotClass: 'bg-gradient-to-r from-status-warn to-status-ok',
    pillClass: 'bg-ink-100 text-ink-700',
  };
}

export function getGroupedRailStripeClass(appointments) {
  const bucket = getGroupedStatusBucketFromList(appointments);
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
    misto: 'bg-gradient-to-b from-status-warn to-status-ok',
  };
  return map[bucket] || 'bg-ink-300';
}

function getGroupedStatusBucketFromList(appointments) {
  const buckets = (appointments || [])
    .map((a) => getAppointmentStatusBucket(a))
    .filter(Boolean);
  const unique = [...new Set(buckets)];
  if (unique.length === 0) return 'pendente';
  if (unique.length === 1) return unique[0];
  return 'misto';
}

export function getRailStripeClass(appointment) {
  const bucket =
    appointment?.tipo === 'bloqueio' ? 'bloqueio' : getAppointmentStatusBucket(appointment);
  const map = {
    confirmado: 'bg-status-ok',
    pendente: 'bg-status-warn',
    cancelado: 'bg-status-danger',
    noshow: 'bg-status-noshow',
    bloqueio: 'bg-ink-400',
    realizado: 'bg-blue-500',
  };
  return map[bucket] || 'bg-ink-300';
}

export { PERIOD_ORDER };
