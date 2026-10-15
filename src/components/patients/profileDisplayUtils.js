/** Utilitários de apresentação do perfil (sem lógica de API). */
import { diaDoInstante, diferencaDias, formatarDataCalendario, formatarInstante } from '../../utils/datasClinica.js';

/**
 * "hoje" / "há N dias" entre o dia do instante e hoje, ambos no calendário da clínica.
 * @param {string} iso instante (ISO com "Z"/offset)
 * @param {string} fuso IANA da clínica
 * @param {string} hojeIso hoje no calendário da clínica
 */
export function formatDiasAtrasPtBr(iso, fuso, hojeIso) {
  if (!iso || !hojeIso) return null;
  const dia = diaDoInstante(iso, fuso);
  if (!dia) return null;
  const days = diferencaDias(dia, hojeIso);
  if (Number.isNaN(days)) return null;
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

/**
 * Data de cadastro (instante) no fuso da clínica.
 * @param {string} iso instante (ISO com "Z"/offset)
 * @param {string} fuso IANA da clínica
 */
export function formatCreatedAtPtBr(iso, fuso) {
  if (!iso) return '—';
  return formatarInstante(iso, fuso, 'data') || '—';
}

/** Data de nascimento (calendário, sem fuso). */
export function formatBirthDatePtBr(dataNascimento) {
  if (!dataNascimento) return '—';
  const s = String(dataNascimento).trim();
  return formatarDataCalendario(s) || s || '—';
}

export function formatCityUf(patient) {
  if (!patient) return '—';
  const city = String(patient.enderecoCidade ?? '').trim();
  const uf = String(patient.enderecoEstado ?? '').trim();
  if (city && uf) return `${city}, ${uf}`;
  if (city) return city;
  if (uf) return uf;
  return '—';
}

export function phoneDigitsForWa(telefone) {
  const digits = String(telefone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

export function displayField(val, emptyLabel = 'Não informado') {
  const s = val != null ? String(val).trim() : '';
  return s || emptyLabel;
}

export function isEmptyField(val) {
  return !String(val ?? '').trim();
}
