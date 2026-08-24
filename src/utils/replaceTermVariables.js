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

    // 2. Fallbacks Literais Simples
    out = out.replace(new RegExp(`\\[${v.name}\\]`, 'gi'), val);
    out = out.replace(new RegExp(`&#91;${v.name}&#93;`, 'gi'), val);
  }

  // Fallback e limpeza graciosa para termos legados:
  // Se o termo legado continha [RG DO PACIENTE] e o paciente não tem RG cadastrado (ou fluxo remoto/OTP),
  // removemos o token e prefixos gramaticais para evitar vazamento de placeholders crus em documentos jurídicos.
  if (!pac.rg) {
    out = out.replace(/portador(\(a\))?\s+do\s+RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)\s+e\s+/gi, 'portador$1 do ');
    out = out.replace(/portador(\(a\))?\s+do\s+RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, 'portador$1');
    out = out.replace(/RG:\s*(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
    out = out.replace(/RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
    out = out.replace(/(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
  }

  return out;
}
