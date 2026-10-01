/**
 * Calcula próximo aniversário e dias restantes (calendário local).
 * Trata 29/02 em anos não bissextos como 28/02.
 */

export function parsePatientBirthDate(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [ys, ms, ds] = s.slice(0, 10).split('-');
    const y = Number(ys);
    const m = Number(ms);
    const d = Number(ds);
    if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) {
    const d = Number(br[1]);
    const m = Number(br[2]);
    const y = Number(br[3]);
    if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) return { y, m, d };
  }
  return null;
}

function celebrationDateLocal(year, birthMonth, birthDay) {
  const dt = new Date(year, birthMonth - 1, birthDay);
  if (dt.getMonth() !== birthMonth - 1) {
    return new Date(year, birthMonth - 1, 0);
  }
  return new Date(year, birthMonth - 1, birthDay);
}

/**
 * @returns {null | { daysUntil: number, isToday: boolean, turningAge: number, birthMonth: number, birthDay: number }}
 */
export function getBirthdayAlertInfo(birthParts, now = new Date()) {
  if (!birthParts) return null;
  const { y: by, m: bm, d: bd } = birthParts;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ty = today.getFullYear();

  let next = celebrationDateLocal(ty, bm, bd);
  if (next < today) {
    next = celebrationDateLocal(ty + 1, bm, bd);
  }

  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
  const isToday = daysUntil === 0;
  const turningAge = ty - by;

  return {
    daysUntil,
    isToday,
    turningAge,
    birthMonth: bm,
    birthDay: bd,
  };
}

/**
 * Texto do selo de aniversário do painel do paciente (calendário local).
 * 29/02 em ano não bissexto conta como 28/02.
 * @returns {string | null}
 */
export function getBirthdayBadgeLabel(rawBirthDate, now = new Date()) {
  const parts = parsePatientBirthDate(rawBirthDate);
  if (!parts) return null;

  const year = now.getFullYear();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const adjusted = parts.m === 2 && parts.d === 29 && !isLeapYear ? { ...parts, d: 28 } : parts;

  const info = getBirthdayAlertInfo(adjusted, now);
  if (!info) return null;

  if (info.daysUntil === 0) return 'Aniversariante hoje!';
  if (info.daysUntil === 1) return 'Aniversário amanhã';
  if (info.daysUntil >= 2 && info.daysUntil <= 6) return `Aniversário em ${info.daysUntil} dias`;
  if (parts.m === now.getMonth() + 1) return 'Aniversariante do mês';
  return null;
}

export function birthdayModalStorageKey(cpf, dateKey) {
  const c = String(cpf || 'sem-cpf').trim();
  return `procedi_bday_modal_${c}_${dateKey}`;
}
