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
