import { parsePatientBirthDate, getBirthdayAlertInfo } from './birthday.js';

/**
 * Informação de próximo aniversário para um paciente mapeado.
 * @param {object} patient
 * @param {string | null} hojeIso hoje no calendário da clínica
 */
export function getPatientNextBirthdayInfo(patient, hojeIso) {
  const parts = parsePatientBirthDate(patient?.dataNascimento);
  if (!parts) return null;
  const info = getBirthdayAlertInfo(parts, hojeIso);
  if (!info) return null;
  return { parts, ...info };
}

/** Rótulo de proximidade para sidebar / listas. */
export function formatBirthdayCountdown(birthdayInfo) {
  if (!birthdayInfo) return { label: '', variant: 'default' };
  if (birthdayInfo.isToday || birthdayInfo.daysUntil === 0) {
    return { label: 'HOJE!!', variant: 'today' };
  }
  if (birthdayInfo.daysUntil === 1) {
    return { label: 'Amanhã', variant: 'soon' };
  }
  return { label: `Em ${birthdayInfo.daysUntil} dias`, variant: 'default' };
}
