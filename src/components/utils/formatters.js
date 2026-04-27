// Funções de formatação de dados

import { resolveApiUrl } from '../../config/apiEnv.js';

export const maskCPF = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const maskRG = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{1})\d+?$/, '$1');
};


export const normalizeCpf = (cpf) => {
  return (cpf || '').replace(/\D/g, '');
};

/** Quantidade esperada de dígitos numéricos do CPF. */
export const CPF_DIGIT_COUNT = 11;

export function cpfDigitCount(value) {
  return normalizeCpf(value).length;
}

/** Pelo menos um dígito e menos de 11 — entrada incompleta (blur / validação incremental). */
export function isCpfIncomplete(value) {
  const n = cpfDigitCount(value);
  return n > 0 && n < CPF_DIGIT_COUNT;
}

/**
 * CPF com 11 dígitos e dígitos verificadores corretos (rejeita sequências repetidas).
 * @param {string} digits Apenas números
 * @returns {boolean}
 */
export function isCpfValidCheckDigits(digits) {
  const s = normalizeCpf(digits);
  if (s.length !== CPF_DIGIT_COUNT) return false;
  if (/^(\d)\1{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += parseInt(s[i], 10) * (10 - i);
  }
  let d1 = 11 - (sum % 11);
  if (d1 > 9) d1 = 0;
  if (d1 !== parseInt(s[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += parseInt(s[i], 10) * (11 - i);
  }
  let d2 = 11 - (sum % 11);
  if (d2 > 9) d2 = 0;
  return d2 === parseInt(s[10], 10);
}

export const normalizeTelefone = (tel) => {
  return (tel || '').replace(/\D/g, '');
};

export const calculateAgeFromISODate = (iso) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  const dataNasc = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(dataNasc.getTime())) return '';
  const hoje = new Date();
  let idadeCalculada = hoje.getFullYear() - dataNasc.getFullYear();
  const m = hoje.getMonth() - dataNasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dataNasc.getDate())) {
    idadeCalculada--;
  }
  return idadeCalculada;
};

export const getPatientInitials = (name) => {
  const parts = (name || '')
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return initials || 'P';
};

export const generateJourneyId = () => {
  try {
    if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // ignore and fallback
  }
  return `journey_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

/** Idade máxima aceita no cadastro (anos). */
export const MAX_BIRTH_AGE_YEARS = 130;

/** Ano mínimo de nascimento (inclusive). */
export const MIN_BIRTH_YEAR = 1900;

/** Apenas dígitos, no máximo 8 (DDMMYYYY). Não altera valores digitados. */
export function sanitizeBirthDateDigits(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 8);
}

/**
 * @typedef {'incomplete' | 'invalid_calendar' | 'year_range' | 'future' | 'max_age'} BirthDateInvalidReason
 */

/** @param {Date} dt data local válida no calendário @param {number} y ano (componente) */
function birthDateRulesCheck(dt, y) {
  const t = new Date();
  const cy = t.getFullYear();
  if (y < MIN_BIRTH_YEAR || y > cy) {
    return { ok: false, reason: /** @type {const} */ ('year_range') };
  }
  const endToday = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
  if (dt > endToday) {
    return { ok: false, reason: /** @type {const} */ ('future') };
  }
  const minByAge = new Date(t.getFullYear() - MAX_BIRTH_AGE_YEARS, t.getMonth(), t.getDate());
  minByAge.setHours(0, 0, 0, 0);
  const minByYear = new Date(MIN_BIRTH_YEAR, 0, 1);
  minByYear.setHours(0, 0, 0, 0);
  const minDate = minByAge.getTime() > minByYear.getTime() ? minByAge : minByYear;
  if (dt < minDate) {
    return { ok: false, reason: /** @type {const} */ ('max_age') };
  }
  return { ok: true };
}

/**
 * Valida exatamente 8 dígitos DDMMYYYY. Não corrige entrada.
 * @returns {{ ok: true, iso: string } | { ok: false, reason: BirthDateInvalidReason }}
 */
export function validateBirthDateDigits8(digits) {
  if (digits.length !== 8) {
    return { ok: false, reason: 'incomplete' };
  }
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  const rules = birthDateRulesCheck(dt, y);
  if (!rules.ok) return rules;
  const iso = birthDigitsToISO(digits);
  return { ok: true, iso: iso || '' };
}

/**
 * Valida exatamente 8 dígitos DDMMYYYY como data de calendário (sem regras de nascimento).
 * @returns {{ ok: true, iso: string } | { ok: false, reason: 'incomplete' | 'invalid_calendar' }}
 */
export function validateCalendarDateDigits8(digits) {
  if (digits.length !== 8) {
    return { ok: false, reason: 'incomplete' };
  }
  const d = Number(digits.slice(0, 2));
  const m = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { ok: false, reason: 'invalid_calendar' };
  }
  const iso = birthDigitsToISO(digits);
  return { ok: true, iso: iso || '' };
}

/** Mensagens para campo de data genérico (ex.: retorno) — mesmo texto base do nascimento onde aplicável. */
export function calendarDateValidationUserMessage(reason) {
  switch (reason) {
    case 'incomplete':
      return 'Informe a data completa no formato DD/MM/AAAA.';
    case 'invalid_calendar':
      return 'Esta data não existe no calendário (ex.: 31/02 ou 29/02 em ano que não é bissexto).';
    default:
      return 'Data inválida.';
  }
}

/** Mensagem em português para exibição abaixo do campo ou no submit. */
export function birthDateValidationUserMessage(reason, currentYear = new Date().getFullYear()) {
  switch (reason) {
    case 'incomplete':
      return 'Informe a data completa no formato DD/MM/AAAA.';
    case 'invalid_calendar':
      return 'Esta data não existe no calendário (ex.: 31/02 ou 29/02 em ano que não é bissexto).';
    case 'year_range':
      return `O ano deve estar entre ${MIN_BIRTH_YEAR} e ${currentYear}.`;
    case 'future':
      return 'A data de nascimento não pode ser futura.';
    case 'max_age':
      return `Data muito antiga: idade máxima permitida é ${MAX_BIRTH_AGE_YEARS} anos.`;
    default:
      return 'Data de nascimento inválida.';
  }
}

export function formatBirthDigitsBR(digits) {
  const d = digits.slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function birthDigitsToISO(digits) {
  if (digits.length !== 8) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

/** Data real, não futura, não anterior a 01/01/MIN_BIRTH_YEAR nem ao limite de idade máxima. */
export function isPlausibleBirthISODate(iso) {
  if (!iso) return false;
  const parts = iso.split('-');
  if (parts.length !== 3) return false;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return false;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  return birthDateRulesCheck(dt, y).ok;
}

export const api = (path) => resolveApiUrl(path);

