/**
 * Validadores compartilhados cadastro / edição de paciente (UI).
 * Regras alinhadas a `PatientCreateView` (cadastro como canônico).
 */
import { normalizeCpf, isCpfValidCheckDigits } from '../components/utils/formatters';
import { isPhoneValid } from './phoneUtils';

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
  if (!String(v.email ?? '').trim()) e.email = true;
  return e;
}

/**
 * Cadastro mínimo inline na agenda (nome + telefone; CPF opcional).
 * @param {{ nome?: string, telefoneCountryCode?: string, telefoneNumero?: string, cpf?: string }} v
 * @returns {Record<string, boolean>}
 */
export function validatePacienteInlineAgenda(v) {
  const e = {};
  if (!String(v.nome ?? '').trim()) e.nome = true;
  if (
    !String(v.telefoneNumero ?? '').trim() ||
    !isPhoneValid(v.telefoneCountryCode ?? 'BR', v.telefoneNumero ?? '')
  ) {
    e.telefone = true;
  }
  const cpfDigits = normalizeCpf(String(v.cpf ?? ''));
  if (cpfDigits.length > 0 && (cpfDigits.length !== 11 || !isCpfValidCheckDigits(cpfDigits))) {
    e.cpf = true;
  }
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
