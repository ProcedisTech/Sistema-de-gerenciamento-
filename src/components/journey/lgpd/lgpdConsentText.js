/**
 * lgpdConsentText.js
 *
 * Função utilitária PURA para interpolação do Termo de Consentimento LGPD.
 * - Isolada do componente para testabilidade máxima (Jest sem DOM).
 * - Sem side effects: recebe contexto e devolve string interpolada.
 * - Fallbacks defensivos para todos os campos: nunca lança erro por dado ausente.
 *
 * @module lgpdConsentText
 */

/** @typedef {{ nome?: string, cpf?: string }} PacienteCtx */
/** @typedef {{ nome?: string, cnpj?: string }} ClinicaCtx */
/** @typedef {{ nome?: string }} ProfissionalCtx */

/**
 * @typedef {Object} LgpdConsentContext
 * @property {PacienteCtx}     [paciente]
 * @property {ClinicaCtx}      [clinica]
 * @property {ProfissionalCtx} [profissional]
 */

/** Placeholder exibido quando um campo não está disponível no contexto. */
export const PLACEHOLDER_AUSENTE = '[não informado]';

/**
 * Template bruto do Termo LGPD sem interpolação.
 * Usado pelo TermosManager para pré-preencher o formulário de criação.
 * Os dados dinâmicos (nome, CPF, etc.) serão preenchidos automaticamente
 * pelo sistema no momento do aceite, a partir do cadastro do paciente.
 */
export const LGPD_TEMPLATE_BRUTO = `Termo de Consentimento para Tratamento de Dados Pessoais (LGPD)

Lei Geral de Proteção de Dados — Lei nº 13.709/2018

Eu, [NOME DO PACIENTE], portador(a) do CPF nº [CPF DO PACIENTE], declaro por meio deste termo que autorizo esta clínica a realizar o tratamento dos meus dados pessoais e dados pessoais sensíveis, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).

1. Dos Dados Coletados
Para a prestação dos serviços estéticos, autorizo a coleta dos seguintes dados:
- Dados Cadastrais: Nome, CPF, RG, data de nascimento, endereço, telefone e e-mail.
- Dados Sensíveis (Saúde e Biometria): Histórico de saúde (anamnese), alergias, uso de medicamentos, condições pré-existentes, além de registros fotográficos (fotos de 'antes e depois' para acompanhamento da evolução do tratamento).

2. Da Finalidade do Tratamento
Os dados coletados serão utilizados única e exclusivamente para as seguintes finalidades:
- Realização de avaliação, diagnóstico e execução de procedimentos estéticos;
- Agendamento e lembretes de consultas;
- Emissão de receituários, atestados e notas fiscais;
- Acompanhamento da evolução clínica e estética do paciente.

3. Do Armazenamento e Compartilhamento (Sistema Procedi)
Estou ciente e concordo que os meus dados serão armazenados de forma digital e segura através do sistema de gerenciamento Procedi, utilizado pela Clínica para a organização de prontuários, agendas e rotinas administrativas. A plataforma Procedi atua como Operadora dos dados, adotando as melhores práticas de segurança da informação. Os dados não serão comercializados ou compartilhados com terceiros para outros fins sem minha prévia autorização.

4. Dos Direitos do Titular
Estou ciente de que, a qualquer momento, posso exercer meus direitos previstos no art. 18 da LGPD, solicitando à Clínica acesso, correção, anonimização ou eliminação dos dados, além da revogação deste consentimento (exceto nos casos de retenção legal).

Por estar de acordo, aceito o presente termo.`;

/**
 * Sanitiza um valor de contexto: retorna o valor string se não vazio,
 * ou o placeholder padrão se ausente/indefinido/nulo.
 *
 * @param {unknown} value
 * @param {string}  [fallback]
 * @returns {string}
 */
export function sanitizeField(value, fallback = PLACEHOLDER_AUSENTE) {
  if (value == null) return fallback;
  const str = String(value).trim();
  return str.length > 0 ? str : fallback;
}

/**
 * Retorna o texto completo do Termo de Consentimento LGPD interpolado com os
 * dados de contexto fornecidos.
 *
 * Design decision: usamos uma função pura com template literal explícito ao
 * invés de eval/Function para prevenir XSS e garantir type safety. Todos os
 * campos passam por `sanitizeField` antes da interpolação.
 *
 * @param {LgpdConsentContext} ctx
 * @returns {string}
 */
export function buildLgpdConsentText(ctx) {
  const pacienteNome     = sanitizeField(ctx?.paciente?.nome);
  const pacienteCpf      = sanitizeField(ctx?.paciente?.cpf);
  const clinicaNome      = sanitizeField(ctx?.clinica?.nome);
  const clinicaCnpj      = sanitizeField(ctx?.clinica?.cnpj);
  const profissionalNome = sanitizeField(ctx?.profissional?.nome);

  return `Termo de Consentimento para Tratamento de Dados Pessoais (LGPD)

Clínica Controladora dos Dados: ${clinicaNome}
CNPJ: ${clinicaCnpj}
Sistema Operador: Procedi - Sistema de Gerenciamento
Profissional Responsável pelo Atendimento: ${profissionalNome}

Eu, ${pacienteNome}, portador(a) do CPF nº ${pacienteCpf}, declaro por meio deste termo que autorizo a clínica ${clinicaNome} a realizar o tratamento dos meus dados pessoais e dados pessoais sensíveis, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).

1. Dos Dados Coletados
Para a prestação dos serviços estéticos, autorizo a coleta dos seguintes dados:
- Dados Cadastrais: Nome, CPF, RG, data de nascimento, endereço, telefone e e-mail.
- Dados Sensíveis (Saúde e Biometria): Histórico de saúde (anamnese), alergias, uso de medicamentos, condições pré-existentes, além de registros fotográficos (fotos de 'antes e depois' para acompanhamento da evolução do tratamento).

2. Da Finalidade do Tratamento
Os dados coletados serão utilizados única e exclusivamente para as seguintes finalidades:
- Realização de avaliação, diagnóstico e execução de procedimentos estéticos;
- Agendamento e lembretes de consultas;
- Emissão de receituários, atestados e notas fiscais;
- Acompanhamento da evolução clínica e estética do paciente.

3. Do Armazenamento e Compartilhamento (Sistema Procedi)
Estou ciente e concordo que os meus dados serão armazenados de forma digital e segura através do sistema de gerenciamento Procedi, utilizado pela Clínica para a organização de prontuários, agendas e rotinas administrativas. A plataforma Procedi atua como Operadora dos dados, adotando as melhores práticas de segurança da informação. Os dados não serão comercializados ou compartilhados com terceiros para outros fins sem minha prévia autorização.

4. Dos Direitos do Titular
Estou ciente de que, a qualquer momento, posso exercer meus direitos previstos no art. 18 da LGPD, solicitando à Clínica acesso, correção, anonimização ou eliminação dos dados, além da revogação deste consentimento (exceto nos casos de retenção legal).

Por estar de acordo, aceito o presente termo.`;
}

/**
 * Verifica se o contexto possui todos os dados mínimos para interpolação
 * sem fallbacks. Útil para exibir avisos de campos faltando na UI.
 *
 * @param {LgpdConsentContext} ctx
 * @returns {{ isComplete: boolean, missingFields: string[] }}
 */
export function validateLgpdContext(ctx) {
  const missingFields = [];

  if (!ctx?.paciente?.nome?.trim())      missingFields.push('paciente.nome');
  if (!ctx?.paciente?.cpf?.trim())       missingFields.push('paciente.cpf');
  if (!ctx?.clinica?.nome?.trim())       missingFields.push('clinica.nome');
  if (!ctx?.clinica?.cnpj?.trim())       missingFields.push('clinica.cnpj');
  if (!ctx?.profissional?.nome?.trim())  missingFields.push('profissional.nome');

  return { isComplete: missingFields.length === 0, missingFields };
}
