import {
  AsYouType,
  isValidPhoneNumber,
  parsePhoneNumber,
  getCountryCallingCode,
} from 'libphonenumber-js';

/** Máximo de dígitos nacionais (sem DDI) por país; demais usam 15 (teto prático ITU). */
const NATIONAL_DIGITS_CAP = {
  BR: 11,
  US: 10,
  CA: 10,
  GB: 10,
  AU: 9,
  NZ: 9,
  PT: 9,
  ES: 9,
  FR: 9,
  DE: 11,
  IT: 10,
  AR: 10,
  MX: 10,
  JP: 10,
  KR: 11,
  CN: 11,
  IN: 10,
};

function nationalDigitsForCountry(countryCode, rawInput) {
  const d = String(rawInput || '').replace(/\D/g, '');
  const cap = NATIONAL_DIGITS_CAP[countryCode] ?? 15;
  return d.slice(0, Math.min(cap, 15));
}

/**
 * Formata o número enquanto o usuário digita, respeitando o formato do país.
 * @param {string} countryCode - Código ISO-2 do país (ex: 'BR', 'US').
 * @param {string} rawInput - Valor bruto do input.
 * @returns {string} Número formatado.
 */
export function formatPhoneAsYouType(countryCode, rawInput) {
  const digits = nationalDigitsForCountry(countryCode, rawInput);
  return new AsYouType(countryCode).input(digits);
}

/**
 * Retorna o DDI do país (ex: '+55') derivado do countryCode.
 * Não manter DDI como estado separado — usar esta função na UI.
 */
export function getDdi(countryCode) {
  try {
    return '+' + getCountryCallingCode(countryCode);
  } catch {
    return '';
  }
}

/**
 * Valida se o número está completo e válido para o país.
 * Deve ser chamado apenas após o campo perder foco (use com touched/blur).
 * @returns {boolean}
 */
export function isPhoneValid(countryCode, rawInput) {
  const digits = nationalDigitsForCountry(countryCode, rawInput);
  if (digits.length < 4) return false;
  try {
    return isValidPhoneNumber(digits, countryCode);
  } catch {
    return false;
  }
}

/**
 * Serializa o número para E.164 (ex: +5511999999999) para enviar à API.
 * Retorna string vazia se não houver dígitos.
 */
export function formatPhoneForApi(countryCode, rawInput) {
  const digits = nationalDigitsForCountry(countryCode, rawInput);
  if (!digits) return '';
  try {
    const parsed = parsePhoneNumber(digits, countryCode);
    return parsed?.format('E.164') ?? `${getDdi(countryCode)}${digits}`;
  } catch {
    return `${getDdi(countryCode)}${digits}`;
  }
}

/**
 * Faz parse do telefone salvo no backend.
 * Funciona com E.164 (+5511999...) ou número nacional com fallbackCountry.
 * @param {string} savedPhone - Valor vindo do backend.
 * @param {string} [fallbackCountry='BR'] - País padrão se não for possível detectar.
 * @returns {{ countryCode: string, nationalNumber: string }}
 */
export function parsePhoneFromApi(savedPhone, fallbackCountry = 'BR') {
  if (!savedPhone || !String(savedPhone).trim()) {
    return { countryCode: fallbackCountry, nationalNumber: '' };
  }
  try {
    const parsed = parsePhoneNumber(String(savedPhone), fallbackCountry);
    return {
      countryCode: parsed.country ?? fallbackCountry,
      nationalNumber: parsed.formatNational(),
    };
  } catch {
    return { countryCode: fallbackCountry, nationalNumber: String(savedPhone) };
  }
}
