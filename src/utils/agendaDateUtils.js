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

export function toLocalDateIso(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/** Grade 7×6 (domingo = primeira coluna). */
export function buildCalendarCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toLocalDateIso(date);
    return {
      iso,
      day: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: iso === toLocalDateIso(),
    };
  });
}

export function formatMonthYearLabel(monthDate) {
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(monthDate);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
