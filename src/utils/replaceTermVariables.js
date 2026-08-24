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
/**
 * Normaliza o HTML ou texto do termo de consentimento preservando 100% das tags ricas do Quill
 * (<strong>, <em>, <u>, <s>, <span>, <ol>, <ul>, <li>, <a href>, <h1-6>, classes ql-align-*, etc.)
 * e reparando quebras de linha duras/hifenização de PDFs de forma genérica.
 */
export function normalizeTermHtml(inputHtml) {
  if (!inputHtml) return '';
  let str = String(inputHtml).trim();

  // Se a string contém quebras de linha \n (seja Plain Text ou vindo de colar no Quill):
  if (/\r?\n/.test(str)) {
    // Normaliza tags de bloco e quebras em \n para reconstrução linear
    str = str
      .replace(/<\/(?:p|div)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n');

    const rawLines = str
      .replace(/<[^>]+>/g, '')
      .split(/\r?\n/)
      .map((l) => l.trim());

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
          // Caso 2: Pontuação órfã (. A indicação, etc)
          if (/^[.,;:]\s*[A-ZÁ-Ú0-9]/.test(line) && !prev.endsWith('.')) {
            fixedLines[prevIdx] = prev + line;
            continue;
          }
          // Caso 3: Marcador isolado '-' ou '•'
          if (/^[-•*]$/.test(prev)) {
            fixedLines[prevIdx] = '• ' + line;
            continue;
          }
          // Caso 4: Hífen de quebra no final (inicia- + se -> inicia-se, aplicá- + la -> aplicá-la)
          if (prev.endsWith('-')) {
            fixedLines[prevIdx] = prev.slice(0, -1) + '-' + line;
            continue;
          }
          // Caso 5: Se o item anterior era item de lista e line é a continuação dele
          if (
            /^[-•*]/.test(prev) &&
            !prev.endsWith(';') &&
            !prev.endsWith('.') &&
            !/^[-•*]/.test(line) &&
            !line.endsWith(':')
          ) {
            if (
              /\b[a-zA-Zá-úÁ-Ú]{1,12}$/.test(prev) &&
              /^[a-zá-ú]{2,}/.test(line) &&
              (line.endsWith(';') || line.endsWith('.') || !line.includes(' '))
            ) {
              fixedLines[prevIdx] = prev + line;
            } else if (
              /\b(san|sangrame|dep|hiper|hipertrofiad|respons|aplic|suas\s+i|e\s+d|da\s+p)\s*$/i.test(prev)
            ) {
              fixedLines[prevIdx] = prev + line;
            } else {
              fixedLines[prevIdx] = prev + ' ' + line;
            }
            continue;
          }
          // Caso 6: Se prev não termina com pontuação forte (. : ! ?) e line é continuação
          if (
            !/[.:!?]$/.test(prev) &&
            !/^[-•*]/.test(prev) &&
            !/^[-•*]/.test(line) &&
            prev !== prev.toUpperCase() &&
            line !== line.toUpperCase()
          ) {
            if (
              /\b(san|sangrame|dep|hiper|hipertrofiad|responsa|aplic|po|um|suas\s+i|e\s+d|da\s+p|d)\s*$/i.test(prev) &&
              /^(nto|os;|ender|trofiados|bilidade|ação|is\b|a\s+nova|ndicações|iminuição|atologia|os\s+tratamentos)/i.test(
                line,
              )
            ) {
              fixedLines[prevIdx] = prev + line;
            } else if (/\b(d[oa]|n[oa])\s*$/i.test(prev) && /^s\s+/i.test(line)) {
              fixedLines[prevIdx] = prev + line;
            } else {
              fixedLines[prevIdx] = prev + ' ' + line;
            }
            continue;
          }
        }
      }

      fixedLines.push(line);
    }

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
        currentList.push(line.replace(/^[-•*]\s*/, '').trim());
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

  // CASO 2: Se já é HTML puro (sem \n interno), OPERA PRESERVANDO 100% DAS TAGS RICAS
  // 1. Repara palavras partidas com hífen entre tags de bloco:
  str = str.replace(
    /<p([^>]*)>((?:(?!<\/p>)[\s\S])*?[a-zA-Zá-úÁ-Ú])-+\s*<\/p>\s*<p[^>]*>\s*([a-zA-Zá-úÁ-Ú](?:(?!<\/p>)[\s\S])*?)<\/p>/g,
    '<p$1>$2-$3</p>',
  );

  // 2. Repara pontuação órfã no início de parágrafo:
  str = str.replace(
    /<p([^>]*)>((?:(?!<\/p>)[\s\S])*?)\s*<\/p>\s*<p[^>]*>\s*([.,;:(/](?:(?!<\/p>)[\s\S])*?)<\/p>/g,
    '<p$1>$2$3</p>',
  );

  // 3. Junta parágrafos ou itens com quebra dura antes de pontuação (onde p1 não termina com [.:;!?] e p2 começa em minúscula)
  let prevStr;
  let iterations = 0;
  do {
    prevStr = str;
    iterations++;
    str = str.replace(
      /<p([^>]*)>((?:(?!<\/p>)[\s\S])*?[^\s.:;!?<>])\s*<\/p>\s*<p[^>]*>\s*([a-zá-ú](?:(?!<\/p>)[\s\S])*?)<\/p>/g,
      (match, attrs, p1, p2) => {
        if (/<\/(?:h[1-6]|ul|ol|table)>$/i.test(p1.trim())) return match;
        if (/\b(d[oa]|n[oa])\s*$/i.test(p1) && /^s\s+/i.test(p2)) {
          return `<p${attrs}>${p1}${p2}</p>`;
        }
        if (
          /\b[a-zA-Zá-úÁ-Ú]{1,10}$/.test(p1) &&
          /^(nto|os;|ender|trofiados|ndicações|iminuição|tologia|se\b)/i.test(p2)
        ) {
          return `<p${attrs}>${p1}${p2}</p>`;
        }
        return `<p${attrs}>${p1} ${p2}</p>`;
      },
    );
  } while (str !== prevStr && iterations < 10);

  // 4. Repara marcadores de tópicos isolados (<p>-</p><p>Texto</p> -> <ul><li>Texto</li></ul>)
  str = str.replace(/<p[^>]*>\s*[-•*]\s*<\/p>\s*<p([^>]*)>((?:(?!<\/p>)[\s\S])*?)<\/p>/g, '<ul><li>$2</li></ul>');
  str = str.replace(/<p[^>]*>\s*[-•*]\s+((?:(?!<\/p>)[\s\S])*?)<\/p>/g, '<ul><li>$1</li></ul>');
  str = str.replace(/<p[^>]*>\s*([a-zA-Zá-úÁ-Ú][^<]*;)\s*<\/p>/g, '<ul><li>$1</li></ul>');
  str = str.replace(/<\/ul>\s*<ul>/g, '');

  return str;
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
