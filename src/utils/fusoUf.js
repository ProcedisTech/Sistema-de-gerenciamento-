import { FUSO_PADRAO } from './datasClinica.js';

const FUSO_SEM_UF = FUSO_PADRAO;

/**
 * Deslocamento do fuso na data dada, ex.: "UTC−5" (sinal de menos U+2212).
 * @param {string} fusoIana
 * @param {Date} [data]
 */
export function offsetUtc(fusoIana, data = new Date()) {
  const parte = new Intl.DateTimeFormat('en-US', { timeZone: fusoIana, timeZoneName: 'shortOffset' })
    .formatToParts(data)
    .find((p) => p.type === 'timeZoneName')?.value;
  if (!parte) return 'UTC';
  return parte.replace(/^GMT/, 'UTC').replace('-', '\u2212');
}

/**
 * Texto auxiliar abaixo do select de UF.
 * @param {{ nome: string, fusoIana: string } | null | undefined} uf
 * @param {Date} [data]
 */
export function textoFusoUf(uf, data = new Date()) {
  if (!uf) return `Sem UF: usa o horário de Brasília (${offsetUtc(FUSO_SEM_UF, data)})`;
  return `Fuso horário: ${offsetUtc(uf.fusoIana, data)} (${uf.nome})`;
}
