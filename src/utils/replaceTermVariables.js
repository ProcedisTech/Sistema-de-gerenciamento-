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
  const str = String(inputHtml).trim();
  const hasDocumentStructure = /<[a-z][\s\S]*>/i.test(str) || /\r?\n/.test(str);

  if (!hasDocumentStructure) {
    return str;
  }

  // 1. Converte quebras de parágrafo duplas e tags em linhas brutas
  const normalizedNewlines = str
    .replace(/<\/(?:p|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  const rawLines = normalizedNewlines
    .split(/\r?\n/)
    .map((l) => l.trim());

  // 2. Primeiro passe: une palavras partidas e quebras duras (\n no meio de parágrafo)
  const fixedLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (!line) {
      if (fixedLines.length > 0 && fixedLines[fixedLines.length - 1] !== '') {
        fixedLines.push('');
      }
      continue;
    }

    if (fixedLines.length > 0) {
      const prevIdx = fixedLines.length - 1;
      const prev = fixedLines[prevIdx];

      if (prev !== '') {
        // Caso 1: Dr + .(a)
        if (/(\b(Dr|Dra|Prof|Profa|Sr|Sra))\s*$/i.test(prev) && /^\.\(a\)/i.test(line)) {
          fixedLines[prevIdx] = prev + line;
          continue;
        }
        // Caso 2: Ponto / vírgula órfão no início da linha (. A indicação, etc)
        if (/^[.,;:]\s*[A-ZÁ-Ú0-9]/.test(line) && !prev.endsWith('.')) {
          fixedLines[prevIdx] = prev + line;
          continue;
        }
        // Caso 3: Palavras cortadas ao meio com hífen
        if (prev.endsWith('-')) {
          fixedLines[prevIdx] = prev.slice(0, -1) + '-' + line;
          continue;
        }
        // Caso 4: Palavras cortadas ao meio sem hífen (san + gramento, sangrame + nto, dep + ender, hiper + trofiados, hipertrofiad + os;)
        if (
          /(\b(san|sangrame|dep|hiper|hipertrofiad))\s*$/i.test(prev) &&
          /^(gramento|nto\b|ender|trofiados|os;)/i.test(line)
        ) {
          fixedLines[prevIdx] = prev + line;
          continue;
        }
        if (/(\b(suas\s+i|e\s+d|da\s+pa))\s*$/i.test(prev) && /^(ndicações|iminuição|tologia)/i.test(line)) {
          fixedLines[prevIdx] = prev + line;
          continue;
        }
        if (/\bdo\s*$/i.test(prev) && /^s\s+tratamentos/i.test(line)) {
          fixedLines[prevIdx] = prev + line;
          continue;
        }
        // Caso 5: Se o prev era um item de lista finalizado com ';' e line não tem bullet, line é um NOVO item de lista!
        if (
          /^[-•*]/.test(prev) &&
          prev.endsWith(';') &&
          !/^[-•*]/.test(line) &&
          !line.endsWith(':') &&
          line !== line.toUpperCase()
        ) {
          fixedLines.push('• ' + line);
          continue;
        }
        // Caso 6: Se o prev é um item de lista e line é a continuação dele (antes de ponto e vírgula)
        if (
          /^[-•*]/.test(prev) &&
          !prev.endsWith(';') &&
          !prev.endsWith('.') &&
          !/^[-•*]/.test(line) &&
          !line.endsWith(':') &&
          line !== line.toUpperCase()
        ) {
          fixedLines[prevIdx] = prev + ' ' + line;
          continue;
        }
        // Caso 7: Se prev não termina com pontuação forte (. : ! ?) e line é continuação de frase
        if (
          !/[.:!?]$/.test(prev) &&
          !/^[-•*]/.test(prev) &&
          !/^[-•*]/.test(line) &&
          prev !== prev.toUpperCase() &&
          line !== line.toUpperCase()
        ) {
          fixedLines[prevIdx] = prev + ' ' + line;
          continue;
        }
      }
    }

    fixedLines.push(line);
  }

  // 3. Segundo passe: organiza em parágrafos e listas HTML
  const blocks = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push(`<ul>${currentList.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      currentList = [];
    }
  };

  for (const line of fixedLines) {
    if (!line) {
      flushList();
      continue;
    }
    if (/^[-•*]/.test(line)) {
      const item = line.replace(/^[-•*]\s*/, '').trim();
      currentList.push(item);
    } else {
      flushList();
      if (line.length > 6 && line === line.toUpperCase()) {
        blocks.push(`<p><strong>${line}</strong></p>`);
      } else {
        blocks.push(`<p>${line}</p>`);
      }
    }
  }

  flushList();
  return blocks.join('');
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
    { name: 'NOME DO PROFISSIONAL', value: prof.nome || prof.nomeCompleto },
  ];

  // 1. Substitui variáveis primeiro (para que os placeholders com colchetes não interfiram no dewrap)
  for (const v of vars) {
    const val = v.value;
    if (!val) continue;

    const varPattern = v.name.replace(/\s+/g, '').split('').join('(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*');
    const complexRegex = new RegExp(
      `(\\[|&#91;)(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*${varPattern}(?:<[^>]*>|&nbsp;|[\\s\\u200B\\uFEFF])*(\\]|&#93;)`,
      'gi',
    );
    out = out.replace(complexRegex, val);

    out = out.replace(new RegExp(`\\[${v.name}\\]`, 'gi'), val);
    out = out.replace(new RegExp(`&#91;${v.name}&#93;`, 'gi'), val);
  }

  // 2. Limpeza graciosa de tokens de RG não preenchidos
  if (!pac.rg) {
    out = out.replace(/portador(\(a\))?\s+do\s+RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)\s+e\s+/gi, 'portador$1 do ');
    out = out.replace(/portador(\(a\))?\s+do\s+RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, 'portador$1');
    out = out.replace(/RG:\s*(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
    out = out.replace(/RG\s+(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
    out = out.replace(/(\[|&#91;)RG DO PACIENTE(\]|&#93;)/gi, '');
  }

  // 3. Executa de-wrapping e normalização semântica
  out = normalizeTermHtml(out);

  return out;
}
