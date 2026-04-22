import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const regionNames = new Intl.DisplayNames(['pt-BR'], { type: 'region' });

export const COUNTRY_PHONE_CODES = getCountries()
  .map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    ddi: '+' + getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/** Converte código ISO-2 para emoji de bandeira usando Regional Indicator Symbols. */
export function countryCodeToFlagEmoji(code) {
  if (!code || code.length !== 2) return '🌐';
  try {
    return [...code.toUpperCase()]
      .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
      .join('');
  } catch {
    return '🌐';
  }
}

/** Retorna o objeto do país pelo código ISO-2, com fallback para Brasil. */
export function getCountryByCode(code) {
  return COUNTRY_PHONE_CODES.find((c) => c.code === code) ?? COUNTRY_PHONE_CODES.find((c) => c.code === 'BR') ?? COUNTRY_PHONE_CODES[0];
}

/**
 * Texto curto para <option> / select fechado: bandeira + ISO + DDI.
 * Evita que o navegador dimensione o select pela opção mais longa (nome completo do país).
 */
export function countrySelectDisplayLabel(c) {
  if (!c) return '';
  return `${countryCodeToFlagEmoji(c.code)} ${c.code} ${c.ddi}`;
}
