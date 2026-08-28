export function newOrientacaoId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Normaliza resposta do GET template (array ou objeto com `itens`). */
export function normalizeOrientacoesTemplateResponse(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.itens || raw.items || raw.orientacoes || [];
  return list
    .map((row, idx) => ({
      id: newOrientacaoId(),
      descricao: String(row.descricao ?? row.texto ?? row.nome ?? '').trim(),
      ordem: Number.isFinite(Number(row.ordem)) ? Number(row.ordem) : idx,
      checado: Boolean(row.checado),
    }))
    .filter((x) => x.descricao);
}

/** Compara listas de orientações pelo par (ordem, descrição), ignorando checado e id. */
export function orientacoesTemplateSignature(itens) {
  if (!Array.isArray(itens)) return '';
  return [...itens]
    .map((i, idx) => ({
      ordem: Number.isFinite(Number(i.ordem)) ? Number(i.ordem) : idx,
      desc: String(i.descricao || '').trim().toLowerCase(),
    }))
    .filter((x) => x.desc)
    .sort((a, b) => a.ordem - b.ordem || a.desc.localeCompare(b.desc))
    .map((x) => `${x.ordem}:${x.desc}`)
    .join('|');
}

/** Dígitos com DDI 55 para wa.me */
export function normalizeWaPhoneDigits(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55')) return d;
  return `55${d}`;
}

export const PREENCHIMENTO_ORIENTACOES = [
  'Aplicar compressas frias ou gelo protegido nas primeiras 24 a 48 horas para controle de inchaço e hematomas.',
  'Não massagear, pressionar ou manipular as regiões preenchidas nas primeiras 48 horas.',
  'Evite exposição solar direta, calor intenso, saunas e banhos muito quentes por 7 dias.',
  'Evite atividades físicas intensas por 24 a 48 horas.',
  'Evite dormir de bruços ou de lado pressionando o rosto nas primeiras noites.',
  'Evite o uso de maquiagem na área tratada nas primeiras 24 horas.',
  'Use protetor solar SPF 50+ diariamente e mantenha a pele hidratada.',
  'Entre em contato imediatamente em caso de dor intensa, palidez na pele ou dúvidas.',
];

export const TOXINA_ORIENTACOES = [
  'Não deitar ou abaixar a cabeça nas primeiras 4 horas após a aplicação.',
  'Não massagear, esfregar ou pressionar as regiões tratadas por 24 horas.',
  'Evite atividades físicas intensas e exposição solar direta por 24 a 48 horas.',
  'Não realizar outros procedimentos faciais (peelings, massagens ou limpezas) nas primeiras 72 horas.',
  'Evite o consumo de bebidas alcoólicas nas primeiras 24 horas.',
  'O efeito inicia-se entre 48 e 72 horas, com resultado final máximo em cerca de 15 dias (data para reavaliação).',
  'Use protetor solar SPF 50+ e entre em contato conosco em caso de dúvidas ou reações.',
];

export const BIOESTIMULADOR_ORIENTACOES = [
  'Realizar a massagem recomendada pelo profissional (regra dos 5: 5 minutos, 5 vezes ao dia, por 5 dias).',
  'Aplicar compressas frias locais caso sinta leve desconforto ou inchaço.',
  'Evite exposição solar direta e calor intenso nos primeiros 7 dias.',
  'Evite atividades físicas intensas nas primeiras 24 a 48 horas.',
  'Use protetor solar SPF 50+ e mantenha a pele hidratada.',
  'Entre em contato conosco em caso de dúvidas ou reações.',
];

export const FIOS_ORIENTACOES = [
  'Evitar movimentos faciais exagerados, mastigação de alimentos duros ou falar em excesso nas primeiras 48 horas.',
  'Dormir de barriga para cima com a cabeça elevada nos primeiros 5 dias.',
  'Não massagear ou esfregar o rosto por 15 dias.',
  'Evitar atividades físicas intensas por 7 a 10 dias.',
  'Evite exposição ao calor, saunas e sol direto por 7 dias.',
  'Usar protetor solar SPF 50+ e entrar em contato em caso de dor intensa ou assimetria.',
];

export const PEELING_LASER_ORIENTACOES = [
  'Não puxar, arrancar ou forçar a descamação da pele.',
  'Evitar exposição solar direta e luz intensa por no mínimo 15 dias.',
  'Aplicar protetor solar SPF 50+ de 3 em 3 horas.',
  'Usar apenas os hidratantes e cicatrizantes recomendados pelo profissional.',
  'Evite banhos muito quentes, sauna e exercícios com sudorese excessiva por 48 horas.',
  'Não aplicar ácidos ou esfoliantes até a liberação do profissional.',
];

export const DEFAULT_ORIENTACOES = [
  'Evite exposição solar direta por 48 horas',
  'Não toque na área tratada nas primeiras 6 horas',
  'Mantenha a pele hidratada',
  'Use protetor solar SPF 50+ nos próximos 7 dias',
  'Evite atividades físicas intensas por 24 horas',
  'Entre em contato conosco em caso de dúvidas ou reações',
];

/**
 * Retorna o catálogo clínico de orientações pós-procedimento correspondente ao nome do procedimento.
 * Suporta busca por palavra-chave em lote ou unitária.
 */
export function getPresetOrientacoesByProcedimento(nomesProcedimentos = []) {
  const nomes = Array.isArray(nomesProcedimentos)
    ? nomesProcedimentos.map((n) => String(n || '').toLowerCase().trim())
    : [String(nomesProcedimentos || '').toLowerCase().trim()];

  if (
    nomes.some(
      (n) =>
        n.includes('preench') ||
        n.includes('hialur') ||
        n.includes('labial') ||
        n.includes('malar') ||
        n.includes('mandíbula') ||
        n.includes('mandibula') ||
        /\bmento\b/.test(n) ||
        n.includes('olheira') ||
        n.includes('rinomodela') ||
        n.includes('ácido hialur') ||
        n.includes('acido hialur'),
    )
  ) {
    return PREENCHIMENTO_ORIENTACOES;
  }

  if (
    nomes.some(
      (n) =>
        n.includes('toxina') ||
        n.includes('botul') ||
        n.includes('botox') ||
        n.includes('dysport') ||
        n.includes('xeomin') ||
        n.includes('botulift'),
    )
  ) {
    return TOXINA_ORIENTACOES;
  }

  if (
    nomes.some(
      (n) =>
        n.includes('bioestimula') ||
        n.includes('sculptra') ||
        n.includes('radiesse') ||
        n.includes('elleva') ||
        n.includes('harmonyca') ||
        n.includes('hidroxiapatita') ||
        n.includes('poli-l-l') ||
        n.includes('plla'),
    )
  ) {
    return BIOESTIMULADOR_ORIENTACOES;
  }

  if (nomes.some((n) => n.includes('fio') || n.includes('pdo') || n.includes('sustenta'))) {
    return FIOS_ORIENTACOES;
  }

  if (
    nomes.some(
      (n) =>
        n.includes('peeling') ||
        n.includes('laser') ||
        n.includes('microagulh') ||
        n.includes('lavieen') ||
        n.includes('ipl'),
    )
  ) {
    return PEELING_LASER_ORIENTACOES;
  }

  return DEFAULT_ORIENTACOES;
}

