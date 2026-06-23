/**
 * Utility para substituir variáveis nos termos de consentimento de forma extremamente resiliente.
 */
export function replaceTermVariables(html, ctx) {
  if (!html) return '';
  let out = String(html);

  const { pac = {}, clinica = {}, prof = {} } = ctx || {};

  const vars = [
    { name: 'NOME DO PACIENTE', value: pac.nome || pac.nomeCompleto },
    { name: 'CPF DO PACIENTE', value: pac.cpf },
    { name: 'NOME DA CLÍNICA', value: clinica.nome },
    { name: 'CNPJ DA CLÍNICA', value: clinica.cnpj },
    { name: 'NOME DO PROFISSIONAL', value: prof.nome || prof.nomeCompleto }
  ];

  for (const v of vars) {
    const val = v.value;
    if (!val) continue;

    // 1. Regex Robusto
    const varPattern = v.name.replace(/\s+/g, '').split('').join('(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*');
    const complexRegex = new RegExp(`(\\[|&#91;)(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*${varPattern}(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*(\\]|&#93;)`, 'gi');
    out = out.replace(complexRegex, val);

    // 2. Fallbacks Literais Simples (caso o regex complexo falhe por algum motivo bizarro de engine)
    out = out.replace(new RegExp(`\\[${v.name}\\]`, 'gi'), val);
    out = out.replace(new RegExp(`&#91;${v.name}&#93;`, 'gi'), val);
  }

  return out;
}
