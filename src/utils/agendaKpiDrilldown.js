import { agendasApi } from '../services/api';
import { monthRangeIso, toDateKey, toLocalDateIso } from './agendaDateUtils';
import {
  fetchDashboardAppointmentsForRange,
  mapAgendaDtoToDashboardRow,
  normalizeApiList,
} from './agendaDashboardMapping';

/** Linha do dashboard que entra em KPI / drill-down (exclui bloqueio de horário). */
export function isKpiCountableAppointment(row) {
  return row?.tipo !== 'bloqueio';
}

export function filterKpiCountableAppointments(rows) {
  return (Array.isArray(rows) ? rows : []).filter(isKpiCountableAppointment);
}

/** DTO bruto da API — antes do map para contagem "Hoje". */
export function isKpiCountableAgendaDto(dto) {
  return String(dto?.tipoProcedimentoCodigo || '').toLowerCase() !== 'bloqueio';
}

function parseIsoLocal(iso) {
  const k = toDateKey(iso);
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfWeekSundayIso(iso) {
  const date = parseIsoLocal(iso);
  date.setDate(date.getDate() - date.getDay());
  return toLocalDateIso(date);
}

function addDaysIso(iso, delta) {
  const date = parseIsoLocal(iso);
  date.setDate(date.getDate() + delta);
  return toLocalDateIso(date);
}

export const KPI_DRILLDOWN_PERIOD = {
  HOJE: 'hoje',
  SEMANA: 'semana',
  MES: 'mes',
};

/** Range ISO inclusivo para o chip de período. */
export function getKpiDrilldownRange(period, { todayIso, monthDate }) {
  const today = toDateKey(todayIso);
  if (period === KPI_DRILLDOWN_PERIOD.HOJE) {
    return { start: today, end: today };
  }
  if (period === KPI_DRILLDOWN_PERIOD.SEMANA) {
    const start = startOfWeekSundayIso(today);
    return { start, end: addDaysIso(start, 6) };
  }
  return monthRangeIso(monthDate);
}

export function filterByKpiStatus(rows, status) {
  const target = String(status || '').trim();
  return (Array.isArray(rows) ? rows : []).filter((row) => row?.status === target);
}

export function filterByProfissional(rows, profissionalRoleUserId) {
  const prof = String(profissionalRoleUserId || '').trim();
  if (!prof) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter(
    (row) => String(row.profissionalRoleUserId || row.roleUserId || '') === prof,
  );
}

export function filterByDateRange(rows, startIso, endIso) {
  const start = toDateKey(startIso);
  const end = toDateKey(endIso);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const d = toDateKey(row.data);
    return d >= start && d <= end;
  });
}

export function sortDrilldownRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) =>
    `${toDateKey(a.data)} ${String(a.horaInicio || '').slice(0, 5)}`.localeCompare(
      `${toDateKey(b.data)} ${String(b.horaInicio || '').slice(0, 5)}`,
    ),
  );
}

function monthKeyFromDate(monthDate) {
  const d = monthDate instanceof Date ? monthDate : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Este mês + Todos + mês já carregado no dashboard. */
export function canUseMonthAppointmentsCache(period, profissionalRoleUserId, monthDate, currentYm) {
  return (
    period === KPI_DRILLDOWN_PERIOD.MES &&
    !String(profissionalRoleUserId || '').trim() &&
    monthKeyFromDate(monthDate) === String(currentYm || '')
  );
}

async function fetchRangeRows(start, end, profissionalRoleUserId) {
  const prof = String(profissionalRoleUserId || '').trim();
  if (prof) {
    const raw = await agendasApi.byRange(start, end, { profissionalRoleUserId: prof });
    const dtos = normalizeApiList(raw);
    return dtos.map(mapAgendaDtoToDashboardRow).filter(Boolean);
  }
  return fetchDashboardAppointmentsForRange(start, end);
}

/**
 * Lista de agendamentos para o drawer KPI (status + período + profissional).
 */
export async function fetchKpiDrilldownRows({
  period,
  status,
  profissionalRoleUserId,
  todayIso,
  monthDate,
  monthLoadedAppointments,
  currentYm,
}) {
  const { start, end } = getKpiDrilldownRange(period, { todayIso, monthDate });

  let rows;
  if (canUseMonthAppointmentsCache(period, profissionalRoleUserId, monthDate, currentYm)) {
    rows = filterByDateRange(monthLoadedAppointments, start, end);
  } else {
    rows = await fetchRangeRows(start, end, profissionalRoleUserId);
    if (String(profissionalRoleUserId || '').trim()) {
      // already filtered by API
    }
  }

  rows = filterByKpiStatus(rows, status);
  if (!canUseMonthAppointmentsCache(period, profissionalRoleUserId, monthDate, currentYm)) {
    rows = filterByProfissional(rows, profissionalRoleUserId);
  } else if (String(profissionalRoleUserId || '').trim()) {
    rows = filterByProfissional(rows, profissionalRoleUserId);
  }

  rows = filterKpiCountableAppointments(rows);
  return sortDrilldownRows(rows);
}

export function kpiStatusTitle(status) {
  if (status === 'confirmado') return 'Confirmados';
  if (status === 'pendente') return 'Pendentes';
  return 'Agendamentos';
}
