/**
 * Utility para substituir variáveis nos termos de consentimento de forma extremamente resiliente.
 */
export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const s = String(isoDate).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return s;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function replaceTermVariables(html, ctx) {
  if (!html) return '';
  let out = String(html);

  const { pac = {}, clinica = {}, prof = {} } = ctx || {};

  const vars = [
    { name: 'NOME DO PACIENTE', value: pac.nome || pac.nomeCompleto },
    { name: 'CPF DO PACIENTE', value: pac.cpf },
    { name: 'RG DO PACIENTE', value: pac.rg },
    { name: 'DATA DE NASCIMENTO DO PACIENTE', value: formatDateBR(pac.dataNascimento) },
    { name: 'TELEFONE DO PACIENTE', value: pac.telefone },
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
