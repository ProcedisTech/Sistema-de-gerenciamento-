/**
 * Monta o objeto `pacienteCtx` usado por replaceTermVariables/generateTermoPdf a partir de um
 * paciente do app (shape de patientMapping.js). Fonte única — evita que um campo novo (ex:
 * rg, dataNascimento) seja adicionado em alguns call sites e esquecido em outros.
 */
export function buildPacienteCtx(paciente) {
  return {
    nome: paciente?.nomeCompleto || paciente?.nome,
    cpf: paciente?.cpf,
    rg: paciente?.rg,
    dataNascimento: paciente?.dataNascimento,
    telefone:
      paciente?.telefone ||
      paciente?.phone ||
      paciente?.telefoneNumero ||
      paciente?.telefonePrincipal,
  };
}
