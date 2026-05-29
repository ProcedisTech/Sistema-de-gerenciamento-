import { parsePatientBirthDate, getBirthdayAlertInfo } from './birthday.js';

/** Informação de próximo aniversário para um paciente mapeado. */
export function getPatientNextBirthdayInfo(patient, now = new Date()) {
  const parts = parsePatientBirthDate(patient?.dataNascimento);
  if (!parts) return null;
  const info = getBirthdayAlertInfo(parts, now);
  if (!info) return null;
  return { parts, ...info };
}

/** Ordena por proximidade do próximo aniversário (hoje → fim do ano → jan do ano seguinte). */
export function sortPatientsByNextBirthday(patients, now = new Date()) {
  return [...(Array.isArray(patients) ? patients : [])]
    .map((patient) => ({ patient, birthday: getPatientNextBirthdayInfo(patient, now) }))
    .filter((row) => row.birthday != null)
    .sort((a, b) => a.birthday.daysUntil - b.birthday.daysUntil)
    .map((row) => row.patient);
}

/** Pacientes cujo aniversário (mês/dia) cai no mês calendário informado. */
export function filterPatientsWithBirthdayInMonth(patients, month, now = new Date()) {
  const targetMonth = month ?? now.getMonth() + 1;
  return (Array.isArray(patients) ? patients : []).filter((patient) => {
    const info = getPatientNextBirthdayInfo(patient, now);
    return info != null && info.birthMonth === targetMonth;
  });
}

export function countPatientsWithBirthdayInMonth(patients, month, now = new Date()) {
  return filterPatientsWithBirthdayInMonth(patients, month, now).length;
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
