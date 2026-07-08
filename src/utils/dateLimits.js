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

const SP_TZ = 'America/Sao_Paulo';

const SP_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const SP_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: SP_TZ,
  weekday: 'short',
});

const WEEKDAY_TO_DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * YYYY-MM-DD no fuso America/Sao_Paulo (independente do browser).
 * @param {Date|string|number} [d]
 * @returns {string}
 */
export function toSaoPauloISODate(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return toSaoPauloISODate(new Date());
  const parts = SP_DATE_FORMATTER.formatToParts(x);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) return toSaoPauloISODate(new Date());
  return `${y}-${m}-${day}`;
}

/**
 * Segunda-feira da semana corrente em America/Sao_Paulo, como YYYY-MM-DD.
 * @param {Date|string|number} [d]
 * @returns {string}
 */
export function startOfWeekSaoPauloISODate(d = new Date()) {
  const todayIso = toSaoPauloISODate(d);
  const x = d instanceof Date ? d : new Date(d);
  const weekdayStr = SP_WEEKDAY_FORMATTER.format(x);
  const dow = WEEKDAY_TO_DOW[weekdayStr] ?? 1;
  const daysFromMonday = dow === 0 ? 6 : dow - 1;

  const [y, mo, da] = todayIso.split('-').map(Number);
  const base = new Date(Date.UTC(y, mo - 1, da));
  base.setUTCDate(base.getUTCDate() - daysFromMonday);
  const yy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
