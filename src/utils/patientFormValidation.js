/**
 * Validadores compartilhados cadastro / edição de paciente (UI).
 * Regras alinhadas a `PatientCreateView` (cadastro como canônico).
 */
import { normalizeCpf, isCpfValidCheckDigits } from '../components/utils/formatters';
import { isPhoneValid } from './phoneUtils';

const PACIENTE_EMAIL_FORMAT = /^\S+@\S+\.\S+$/;

export function isPacienteEmailFormatValid(email) {
  return PACIENTE_EMAIL_FORMAT.test(String(email ?? '').trim());
}

/**
 * Campos esperados em `v` (valor cru do formulário, antes do payload da API).
 * Inclui `profissaoId` (UUID) para profissão obrigatória.
 * @param {object} opts
 * @param {boolean} [opts.skipCpf] — true em modo edição (CPF só leitura e já válido).
 * @returns {Record<string, boolean>}
 */
export function validatePacienteFormBasics(v, opts = {}) {
  const e = {};
  if (!String(v.nome ?? '').trim()) e.nome = true;
  if (!String(v.dataNascimentoIso ?? '').trim()) e.dataNascimento = true;
  if (!String(v.sexo ?? '').trim()) e.sexo = true;
  if (!String(v.estadoCivilId ?? '').trim()) e.estadoCivil = true;
  if (!v.profissaoId) e.profissao = true;

  if (!opts.skipCpf) {
    const cpfDigits = normalizeCpf(String(v.cpf ?? ''));
    if (cpfDigits.length !== 11 || !isCpfValidCheckDigits(cpfDigits)) e.cpf = true;
  }

  if (!String(v.telefoneNumero ?? '').trim() || !isPhoneValid(v.telefoneCountryCode ?? 'BR', v.telefoneNumero ?? '')) {
    e.telefone = true;
  }
  const emailTrimmed = String(v.email ?? '').trim();
  if (emailTrimmed && !isPacienteEmailFormatValid(emailTrimmed)) e.email = true;
  return e;
}

export function validateCpfField(cpfMasked) {
  const cpfDigits = normalizeCpf(String(cpfMasked ?? ''));
  if (cpfDigits.length !== 11) {
    return { ok: false, message: 'O CPF deve conter 11 dígitos.' };
  }
  if (!isCpfValidCheckDigits(cpfDigits)) {
    return { ok: false, message: 'CPF inválido. Verifique os dígitos verificadores.' };
  }
  return { ok: true, cpfDigits };
}
