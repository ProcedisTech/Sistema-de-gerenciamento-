// Funções de formatação de dados

import { resolveApiUrl } from '../../config/apiEnv.js';
import {
  FUSO_PADRAO,
  aniversarioNoAno,
  hojeDaClinica,
  idadeEm,
  isoDeParts,
  parseDataCalendario,
} from '../../utils/datasClinica.js';

export const maskCPF = (value) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const RG_MAX_CORE_LENGTH = 14;
export const RG_MIN_CORE_LENGTH = 5;
export const RG_CANONICAL_PATTERN = /^(?=.{5,14}$)([A-Z]{2})?(\d{5,14}|\d{4,13}X)$/;

/**
 * Remove apenas separadores válidos de pontuação/espaço do RG e normaliza para maiúsculas.
 * Não descarta caracteres inválidos (ex.: '@', '#') para permitir rejeição explícita na validação.
 */
export function stripRgSeparators(value) {
  if (value == null) return '';
  return String(value).toUpperCase().replace(/[.\-/\s]+/g, '');
}

/**
 * Extrai prefixo opcional de até 2 letras (UF) + corpo numérico (com 'X' opcional apenas na última posição
 * quando já houver >= 4 dígitos), respeitando o limite total de 14 caracteres limpos.
 */
function extractRgParts(value) {
  if (value == null) return { prefix: '', body: '' };
  const raw = String(value).toUpperCase();
  let prefix = '';
  let digits = '';
  let trailingX = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch >= 'A' && ch <= 'Z') {
      if (digits.length === 0 && prefix.length < 2) {
        prefix += ch;
      } else if (ch === 'X' && digits.length >= 4 && !trailingX) {
        trailingX = true;
      }
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      if (trailingX) {
        trailingX = false;
      }
      digits += ch;
    }
  }

  const maxBody = Math.max(0, RG_MAX_CORE_LENGTH - prefix.length);
  if (trailingX) {
    const maxDigitsWithX = Math.max(0, maxBody - 1);
    const trimmedDigits = digits.slice(0, maxDigitsWithX);
    if (trimmedDigits.length >= 4) {
      return { prefix, body: `${trimmedDigits}X` };
    }
    return { prefix, body: trimmedDigits };
  }

  return { prefix, body: digits.slice(0, maxBody) };
}

function groupDigitsBy3FromRight(digits) {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRgBody(body) {
  if (!body) return '';
  if (body.endsWith('X')) {
    const numPart = body.slice(0, -1);
    return `${groupDigitsBy3FromRight(numPart)}-X`;
  }
  const len = body.length;
  if (len <= 3) return body;
  if (len <= 8) return groupDigitsBy3FromRight(body);
  if (len === 9) return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5, 8)}-${body.slice(8)}`;
  if (len === 10) return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5, 8)}-${body.slice(8)}`;
  if (len === 11) return `${body.slice(0, 3)}.${body.slice(3, 6)}.${body.slice(6, 9)}-${body.slice(9)}`;
  return `${groupDigitsBy3FromRight(body.slice(0, -1))}-${body.slice(-1)}`;
}

/**
 * Máscara adaptativa multi-UF para digitação de RG:
 * - DF (7): 3.456.789
 * - 8 dígitos: 12.345.678
 * - SP/RJ (9 ou com X): 12.345.678-9 / 12.345.678-X
 * - RS/BA (10): 12.345.678-90
 * - CIN (11): 123.456.789-01
 * - MG (UF + dígitos): MG-12.345.678
 */
export const maskRG = (value) => {
  const { prefix, body } = extractRgParts(value);
  const formattedBody = formatRgBody(body);
  if (prefix) {
    return formattedBody ? `${prefix}-${formattedBody}` : prefix;
  }
  return formattedBody;
};

/** Alias para compatibilidade com chamadas existentes. */
export const sanitizeRG = maskRG;

/**
 * Formata RG para exibição/documentos preservando valores legados fora do padrão (ex.: "/SSP" ou < 5 dígitos)
 * sem mutilar dados antigos salvos no banco.
 */
export function formatRgForDisplay(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const clean = stripRgSeparators(raw);
  if (RG_CANONICAL_PATTERN.test(clean)) {
    return maskRG(clean);
  }
  return raw;
}

/** Normaliza RG multi-UF para armazenamento limpo na API (ex.: "3456789", "12345678X", "MG12345678"), ou null se vazio. */
export const normalizeRgForApi = (value) => {
  const { prefix, body } = extractRgParts(value);
  const clean = `${prefix}${body}`;
  return clean || null;
};

/** Valida campo RG opcional: vazio é válido; preenchido exige padrão multi-UF (0 ou 2 letras + 5..14 chars). */
export function validateRgField(value) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { ok: true, rgNormalized: null, message: '' };
  }
  const clean = stripRgSeparators(raw);
  if (/^[A-Z]\d/.test(clean)) {
    return {
      ok: false,
      rgNormalized: null,
      message: 'Informe a sigla da UF com 2 letras (ex.: MG-12.345.678) ou apenas números.',
    };
  }
  if (!RG_CANONICAL_PATTERN.test(clean)) {
    return {
      ok: false,
      rgNormalized: null,
      message: 'RG inválido. Informe entre 5 e 14 caracteres (ex.: 3.456.789, 12.345.678-X ou MG-12.345.678).',
    };
  }
  return { ok: true, rgNormalized: clean, message: '' };
}


export const normalizeCpf = (cpf) => {
  return (cpf || '').replace(/\D/g, '');
};

/** CPF parcial para exibição em listas: 123.***.***-12 */
export function maskCpfPartial(cpf) {
  const d = normalizeCpf(cpf);
  if (d.length < 5) return d.length >= 3 ? `${d.slice(0, 3)}.***.***-**` : d;
  return `${d.slice(0, 3)}.***.***-${d.slice(-2)}`;
}

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

/** Hoje da clínica para chamadores que ainda não passam `hojeIso` (cai no fuso padrão). */
function hojeIsoOuPadrao(hojeIso) {
  return parseDataCalendario(hojeIso) ? hojeIso : hojeDaClinica(FUSO_PADRAO);
}

/**
 * Idade completa em `hojeIso` (calendário da clínica); '' se a data for inválida.
 * @param {string} iso "AAAA-MM-DD"
 * @param {string} [hojeIso] hoje no calendário da clínica (useAgoraDaClinica().hojeIso)
 */
export const calculateAgeFromISODate = (iso, hojeIso) => {
  if (!iso) return '';
  const idade = idadeEm(iso, hojeIsoOuPadrao(hojeIso));
  return idade == null ? '' : idade;
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

/**
 * @param {string} iso "AAAA-MM-DD" válida no calendário
 * @param {string} [hojeIso] hoje no calendário da clínica
 */
function birthDateRulesCheck(iso, hojeIso) {
  const hoje = hojeIsoOuPadrao(hojeIso);
  const h = parseDataCalendario(hoje);
  const y = parseDataCalendario(iso).ano;
  if (y < MIN_BIRTH_YEAR || y > h.ano) {
    return { ok: false, reason: /** @type {const} */ ('year_range') };
  }
  if (iso > hoje) {
    return { ok: false, reason: /** @type {const} */ ('future') };
  }
  const minByAge = aniversarioNoAno(h.mes, h.dia, h.ano - MAX_BIRTH_AGE_YEARS);
  const minByYear = isoDeParts(MIN_BIRTH_YEAR, 1, 1);
  const minDate = minByAge > minByYear ? minByAge : minByYear;
  if (iso < minDate) {
    return { ok: false, reason: /** @type {const} */ ('max_age') };
  }
  return { ok: true };
}

/**
 * Valida exatamente 8 dígitos DDMMYYYY. Não corrige entrada.
 * @param {string} digits
 * @param {string} [hojeIso] hoje no calendário da clínica
 * @returns {{ ok: true, iso: string } | { ok: false, reason: BirthDateInvalidReason }}
 */
export function validateBirthDateDigits8(digits, hojeIso) {
  const cal = validateCalendarDateDigits8(digits);
  if (!cal.ok) return cal;
  const rules = birthDateRulesCheck(cal.iso, hojeIso);
  if (!rules.ok) return rules;
  return cal;
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
  if (!parseDataCalendario(isoDeParts(y, m, d))) {
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
export function birthDateValidationUserMessage(reason, currentYear = parseDataCalendario(hojeIsoOuPadrao()).ano) {
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

/**
 * Data real, não futura, não anterior a 01/01/MIN_BIRTH_YEAR nem ao limite de idade máxima.
 * @param {string} iso "AAAA-MM-DD"
 * @param {string} [hojeIso] hoje no calendário da clínica
 */
export function isPlausibleBirthISODate(iso, hojeIso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  if (!parseDataCalendario(iso)) return false;
  return birthDateRulesCheck(iso, hojeIso).ok;
}

export const api = (path) => resolveApiUrl(path);

