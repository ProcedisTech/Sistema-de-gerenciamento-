/**
 * Data local no formato YYYY-MM-DD (evita desvio de fuso de toISOString).
 * @param {Date} [d]
 * @returns {string}
 */
export function toLocalISODate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return toLocalISODate(new Date());
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Maior entre duas datas ISO YYYY-MM-DD (ordem lexicográfica). */
export function maxIsoDate(a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Soma anos calendário a partir de uma data local YYYY-MM-DD.
 * @param {string} isoYYYYMMDD
 * @param {number} years
 */
export function addCalendarYearsToIso(isoYYYYMMDD, years) {
  const parts = String(isoYYYYMMDD || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return toLocalISODate();
  }
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  d.setFullYear(d.getFullYear() + years);
  return toLocalISODate(d);
}
