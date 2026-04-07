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

export const maskTelefone = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export const normalizeCpf = (cpf) => {
  return (cpf || '').replace(/\D/g, '');
};

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
export const MIN_BIRTH_YEAR = 1930;

/**
 * Ajusta até 8 dígitos DDMMYYYY: mês 01–12, dia válido para o mês/ano, ano entre MIN_BIRTH_YEAR e o atual (e respeitando MAX_BIRTH_AGE_YEARS).
 */
export function clampBirthDateDigits(raw) {
  let d = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 8);
  const now = new Date();
  const cy = now.getFullYear();

  let dd = d.slice(0, 2);
  let mm = d.slice(2, 4);
  let yyyy = d.slice(4, 8);

  if (dd.length === 1 && dd[0] > '3') dd = '3';

  if (mm.length === 1 && mm[0] > '1') mm = `0${mm[0]}`;

  if (yyyy.length === 4) {
    let y = parseInt(yyyy, 10);
    if (Number.isNaN(y)) y = cy;
    const minY = Math.max(MIN_BIRTH_YEAR, cy - MAX_BIRTH_AGE_YEARS);
    y = Math.min(cy, Math.max(minY, y));
    yyyy = String(y);
  }

  if (mm.length === 2) {
    let m = parseInt(mm, 10);
    if (Number.isNaN(m)) m = 1;
    m = Math.min(12, Math.max(1, m));
    mm = String(m).padStart(2, '0');
  }

  const yNum = yyyy.length === 4 ? parseInt(yyyy, 10) : cy;
  const mNum = mm.length === 2 ? parseInt(mm, 10) : null;

  if (dd.length === 2) {
    let day = parseInt(dd, 10);
    if (Number.isNaN(day)) day = 1;
    const dim = mNum != null ? new Date(yNum, mNum, 0).getDate() : 31;
    day = Math.min(dim, Math.max(1, day));
    dd = String(day).padStart(2, '0');
  }

  return dd + mm + yyyy;
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
  if (y < MIN_BIRTH_YEAR) return false;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  const t = new Date();
  const endToday = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999);
  if (dt > endToday) return false;
  const minByAge = new Date(t.getFullYear() - MAX_BIRTH_AGE_YEARS, t.getMonth(), t.getDate());
  minByAge.setHours(0, 0, 0, 0);
  const minByYear = new Date(MIN_BIRTH_YEAR, 0, 1);
  minByYear.setHours(0, 0, 0, 0);
  const minDate = minByAge.getTime() > minByYear.getTime() ? minByAge : minByYear;
  if (dt < minDate) return false;
  return true;
}

export const api = (path) => resolveApiUrl(path);

