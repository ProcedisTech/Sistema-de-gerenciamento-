/**
 * Limites de caracteres para formulários de paciente (cadastro e edição de perfil).
 * Valores conservadores, típicos de VARCHAR / TEXT curto no backend; ajuste se o DTO exigir outro teto.
 */
export const PACIENTE_FIELD_MAX = Object.freeze({
  nomeCompleto: 200,
  email: 255,
  nomePai: 200,
  nomeMae: 200,
  /** CEP com máscara 99999-999 */
  cep: 9,
  enderecoRua: 200,
  enderecoNumero: 20,
  enderecoComplemento: 100,
  enderecoBairro: 120,
  enderecoCidade: 120,
  enderecoEstado: 2,
  endereco: 500,
  profissao: 120,
  alergias: 2000,
  condicoesSaude: 2000,
  medicamentos: 2000,
  genero: 100,
  instagram: 100,
  tiktok: 100,
  indicacao: 200,
  /** Dígitos+formatação do CPF (000.000.000-00) */
  cpfFormatado: 14,
  /** RG com máscara (varia por UF; teto seguro) */
  rgFormatado: 20,
  /** Número nacional após DDI (formatPhoneAsYouType) */
  telefoneNumero: 25,
});
