import { hojeDaClinica, instanteMs, isoDeParts } from './datasClinica.js';

/** Normaliza data (YYYY-MM-DD ou ISO com hora) para comparação e filtros. */
export function toDateKey(value) {
  const s = String(value || '');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Chave YYYY-MM do calendário local (para comparar meses sem identidade de Date). */
export function monthKey(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Primeiro e último dia do mês de `monthDate` em YYYY-MM-DD (calendário local). */
export function monthRangeIso(monthDate) {
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${y}-${pad(m + 1)}-01`;
  const last = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${pad(m + 1)}-${pad(last)}`;
  return { start, end };
}

/** True se `isoDate` cai no mês de `monthDate`. */
export function monthContainsIso(monthDate, isoDate) {
  const { start, end } = monthRangeIso(monthDate);
  const key = toDateKey(isoDate);
  return Boolean(key) && key >= start && key <= end;
}

/** True se `isoDate` cai no intervalo inclusivo da semana carregada. */
export function weekContainsIso(weekStartIso, weekEndIso, isoDate) {
  const key = toDateKey(isoDate);
  return Boolean(key) && key >= weekStartIso && key <= weekEndIso;
}

/**
 * Evita race skipNextAutoLoad + AbortController no effect de monthDate.
 * @returns {'loadMonth' | 'setMonthDateOnly'}
 */
export function resolveMonthRefreshAction(currentMonthDate, nextMonthDate) {
  if (monthKey(currentMonthDate) === monthKey(nextMonthDate)) {
    return 'loadMonth';
  }
  return 'setMonthDateOnly';
}

/**
 * Dia (YYYY-MM-DD) do instante `date` no fuso da clínica.
 * @param {Date|number|string} date instante (Date, ms ou ISO com "Z")
 * @param {string} fuso IANA da clínica
 */
export function toLocalDateIso(date, fuso) {
  const ms = instanteMs(date);
  return hojeDaClinica(fuso, Number.isNaN(ms) ? Date.now() : ms);
}

/** YYYY-MM-DD dos campos locais de um Date usado como data de calendário (grade do mês). */
export function isoDeDataCalendario(date) {
  return isoDeParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Grade 7×6 (domingo = primeira coluna).
 * @param {Date} monthDate mês exibido (campos locais)
 * @param {string | null} hojeIso hoje no calendário da clínica
 */
export function buildCalendarCells(monthDate, hojeIso) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = isoDeDataCalendario(date);
    return {
      iso,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: Boolean(hojeIso) && iso === hojeIso,
    };
  });
}

export function formatMonthYearLabel(monthDate) {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
