/** Normaliza data (YYYY-MM-DD ou ISO com hora) para comparação e filtros. */
export function toDateKey(value) {
  const s = String(value || '');
  return s.length >= 10 ? s.slice(0, 10) : s;
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

export function toLocalDateIso(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
