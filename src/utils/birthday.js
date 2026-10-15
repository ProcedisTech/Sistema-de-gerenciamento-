/**
 * Aniversário do paciente sobre o calendário da clínica (`hojeIso` = "AAAA-MM-DD" de hoje na clínica).
 * Delega para `proximoAniversario` (29/02 → 28/02 em ano não bissexto).
 */
import { parseDataCalendario, proximoAniversario, isoDeParts } from './datasClinica.js';

export function parsePatientBirthDate(raw) {
  const p = parseDataCalendario(raw);
  return p ? { y: p.ano, m: p.mes, d: p.dia } : null;
}

/**
 * @param {{ y: number, m: number, d: number } | null} birthParts
 * @param {string | null} hojeIso hoje no calendário da clínica
 * @returns {null | { daysUntil: number, isToday: boolean, turningAge: number, birthMonth: number, birthDay: number, dataIso: string }}
 */
export function getBirthdayAlertInfo(birthParts, hojeIso) {
  if (!birthParts || !hojeIso) return null;
  const info = proximoAniversario(isoDeParts(birthParts.y, birthParts.m, birthParts.d), hojeIso);
  if (!info) return null;
  return {
    daysUntil: info.dias,
    isToday: info.ehHoje,
    turningAge: info.idadeQueCompleta,
    birthMonth: info.mes,
    birthDay: info.dia,
    dataIso: info.dataIso,
  };
}

/**
 * Texto do selo de aniversário do painel do paciente.
 * @param {string} rawBirthDate
 * @param {string | null} hojeIso hoje no calendário da clínica
 * @returns {string | null}
 */
export function getBirthdayBadgeLabel(rawBirthDate, hojeIso) {
  const parts = parsePatientBirthDate(rawBirthDate);
  const hoje = parseDataCalendario(hojeIso);
  if (!parts || !hoje) return null;

  const info = getBirthdayAlertInfo(parts, hojeIso);
  if (!info) return null;

  if (info.daysUntil === 0) return 'Aniversariante hoje!';
  if (info.daysUntil === 1) return 'Aniversário amanhã';
  if (info.daysUntil >= 2 && info.daysUntil <= 6) return `Aniversário em ${info.daysUntil} dias`;
  if (parts.m === hoje.mes) return 'Aniversariante do mês';
  return null;
}

export function birthdayModalStorageKey(cpf, dateKey) {
  const c = String(cpf || 'sem-cpf').trim();
  return `procedi_bday_modal_${c}_${dateKey}`;
}
