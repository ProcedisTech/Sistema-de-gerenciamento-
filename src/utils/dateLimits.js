import { agoraDaClinica, hojeDaClinica, instanteMs, parseDataCalendario, isoDeParts, somarDias, ultimoDiaDoMes } from './datasClinica.js';

/**
 * YYYY-MM-DD do instante `d` no fuso da clínica.
 * @param {Date|string|number} d instante (string ISO com "Z"/offset, Date ou ms)
 * @param {string} fuso IANA
 * @returns {string} '' se `d` não for um instante válido
 */
export function isoDateNoFuso(d, fuso) {
  const ms = instanteMs(d);
  if (Number.isNaN(ms)) return '';
  return hojeDaClinica(fuso, ms);
}

/**
 * Segunda-feira da semana corrente no fuso da clínica, como YYYY-MM-DD.
 * @param {string} fuso IANA
 * @param {number} [agoraMs]
 * @returns {string}
 */
export function inicioSemanaNoFuso(fuso, agoraMs = Date.now()) {
  const agora = agoraDaClinica(fuso, agoraMs);
  const daysFromMonday = agora.diaSemana === 0 ? 6 : agora.diaSemana - 1;
  return somarDias(agora.dataIso, -daysFromMonday);
}

/** Maior entre duas datas ISO YYYY-MM-DD (ordem lexicográfica). */
export function maxIsoDate(a, b) {
  if (!a) return b || '';
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Soma anos calendário a uma data YYYY-MM-DD (29/02 → 28/02 em ano não bissexto).
 * @param {string} isoYYYYMMDD
 * @param {number} years
 * @returns {string} '' se a data for inválida
 */
export function addCalendarYearsToIso(isoYYYYMMDD, years) {
  const p = parseDataCalendario(isoYYYYMMDD);
  if (!p) return '';
  const ano = p.ano + years;
  return isoDeParts(ano, p.mes, Math.min(p.dia, ultimoDiaDoMes(ano, p.mes)));
}
