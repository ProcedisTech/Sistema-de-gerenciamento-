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

/**
 * Normaliza o HTML ou texto do termo de consentimento, reparando:
 * 1. Palavras partidas com hífen ou quebra entre tags (ex: "inicia-</p><p>se" -> "inicia-se", "sangrame</p><p>nto" -> "sangramento").
 * 2. Pontuação órfã no início de parágrafos (ex: "</p><p>.(a)" -> ".(a)").
 * 3. Marcadores de tópicos isolados ("<p>-</p><p>Texto" -> "<li>Texto</li>").
 * 4. Parágrafos quebrados no meio de frases por hard line wraps de PDFs ou templates legados.
 */
export function normalizeTermHtml(inputHtml) {
  if (!inputHtml) return '';
  let str = String(inputHtml).trim();

  // Se não contém tags HTML, retorna string original
  if (!/<[a-z][\s\S]*>/i.test(str)) {
    return str;
  }

  // 1. Remove traços de hifenização de quebra de linha entre tags: "inicia-</p><p>se" -> "inicia-se"
  str = str.replace(/([a-zA-Zá-úÁ-Ú])-+\s*<\/(?:p|div|span)>\s*<(?:p|div|span)[^>]*>\s*([a-zA-Zá-úÁ-Ú])/gi, '$1-$2');

  // 2. Corrige quebra de palavras puras sem hífen entre tags: "suas i</p><p>ndicações" ou "sangrame</p><p>nto" ou "hipertrofiad</p><p>os"
  str = str.replace(/([a-zA-Zá-úÁ-Ú]{1,15})\s*<\/(?:p|div|span)>\s*<(?:p|div|span)[^>]*>\s*([a-zA-Zá-úÁ-Ú]{1,15}(?:[;,.]|\s|$))/gi, (match, p1, p2) => {
    if (/^(ndicações|iminuição|tologia|nto|os;|da|se|mente)/i.test(p2) || p1.length <= 2) {
      return `${p1}${p2}`;
    }
    return `${p1} ${p2}`;
  });

  // 3. Corrige pontuação órfã no início de parágrafo: "</p><p>.(a)" ou "</p><p>. A" ou "</p><p>, e"
  str = str.replace(/<\/(?:p|div)>\s*<(?:p|div)[^>]*>\s*([.,;:(/])/gi, '$1');

  // 4. Corrige marcadores isolados: "<p>-</p><p>Texto" ou "<p>- </p><p>Texto" -> "<li>Texto</li>"
  str = str.replace(/<(?:p|div)[^>]*>\s*[-•]\s*<\/(?:p|div)>\s*<(?:p|div)[^>]*>(.*?)<\/(?:p|div)>/gi, '<li>$1</li>');

  // 5. Converte parágrafos iniciados com traço ou bullet OU terminados em ';' em <li>
  str = str.replace(/<(?:p|div)[^>]*>\s*[-•]\s*(.*?)<\/(?:p|div)>/gi, '<li>$1</li>');
  str = str.replace(/<(?:p|div)[^>]*>\s*([a-zA-Zá-úÁ-Ú][^<]*;)\s*<\/(?:p|div)>/gi, '<li>$1</li>');

  // 6. Envolve sequências de <li> em <ul>...</ul>
  str = str.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/gi, (match) => `<ul>${match}</ul>`);

  // 7. Junta parágrafos quebrados no meio de frases normais (mas NUNCA junta títulos em caixa alta nem linhas que terminam em : ou .)
  str = str.replace(/<p>(.*?)<\/p>\s*<p>(.*?)<\/p>/gi, (match, p1, p2) => {
    const t1 = p1.trim();
    const t2 = p2.trim();
    if (!t1 || !t2) return match;

    // Se t1 é um título em caixa alta (ex: TERMO DE CONSENTIMENTO...), não junta
    const isT1Upper = t1.length > 5 && t1 === t1.toUpperCase();
    if (isT1Upper) return match;

    // Se t1 termina com pontuação terminal (. : ! ?), não junta
    if (/[.:!?]$/.test(t1) || t1.endsWith('</li>') || t1.endsWith('</ul>')) return match;

    // Se t2 começa com marcador de lista
    if (/^[-•]/.test(t2) || t2.startsWith('<li>') || t2.startsWith('<ul>')) return match;

    // Se t2 começa com pontuação órfã (ex: ".(a)", ". A", ", e") ou palavra continuação
    if (/^[.,;:(/]/.test(t2) || /^[a-zá-ú]/.test(t2)) {
      return `<p>${t1} ${t2}</p>`;
    }

    return match;
  });

  // 8. Limpa duplicações de <ul> aninhadas
  str = str.replace(/<ul>\s*<ul>/gi, '<ul>').replace(/<\/ul>\s*<\/ul>/gi, '</ul>');

  return str;
}

export function replaceTermVariables(html, ctx) {
  if (!html) return '';
  let out = normalizeTermHtml(String(html));

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
