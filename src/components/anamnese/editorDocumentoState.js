/** @typedef {{ id?: string|null, clientKey: string, nome: string, sexoAplicavel?: string|null, ordem: number, perguntas: import('./editorDocumentoReducer.js').PerguntaEditor[] }} SecaoEditor */

let clientKeySeq = 0;

export function newClientKey(prefix = 'ck') {
  clientKeySeq += 1;
  return `${prefix}-${Date.now()}-${clientKeySeq}`;
}

/** Agrupa itens planos da ficha (GET) em seções para o editor. */
export function groupItensToSecoes(ficha) {
  const itens = [...(ficha?.itens || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const secoes = [];
  const byCat = new Map();

  for (const item of itens) {
    const p = item.pergunta || {};
    const catId = p.categoriaId ?? p.categoria_id ?? '';
    const catNome = p.categoriaNome ?? p.categoria_nome ?? 'Geral';
    const catKey = catId ? String(catId) : catNome || 'geral';

    if (!byCat.has(catKey)) {
      const secao = {
        id: catId || null,
        clientKey: newClientKey('sec'),
        nome: catNome,
        sexoAplicavel: p.categoriaSexoAplicavel ?? p.categoria_sexo_aplicavel ?? null,
        ordem: secoes.length + 1,
        perguntas: [],
      };
      byCat.set(catKey, secao);
      secoes.push(secao);
    }

    const secao = byCat.get(catKey);
    secao.perguntas.push({
      id: p.id ?? null,
      clientKey: newClientKey('pq'),
      tipoRespostaId: p.tipoRespostaId ?? null,
      tipoRespostaCodigo: p.tipoResposta ?? p.tipo_resposta ?? 'texto',
      descricao: p.descricao ?? '',
      prioridade: p.prioridade ?? 'NORMAL',
      tipoAntecedentePessoalId: p.tipoAntecedentePessoalId ?? null,
      antecedenteCatalogoId: p.antecedenteCatalogoId ?? null,
      perguntaPaiId: p.perguntaPaiId ?? null,
      perguntaPaiClientKey: null,
      obrigatorio: item.obrigatorio ?? false,
      ordem: item.ordem ?? secao.perguntas.length + 1,
      alternativas: p.alternativas ?? [],
      outrasFichasCount: item.outrasFichasCount ?? 0,
    });
  }

  if (secoes.length === 0) {
    secoes.push(emptySecao(1));
  }

  linkPerguntaPaiClientKeys(secoes);
  return secoes;
}

export function emptySecao(ordem = 1) {
  return {
    id: null,
    clientKey: newClientKey('sec'),
    nome: 'Nova seção',
    sexoAplicavel: null,
    ordem,
    perguntas: [],
  };
}

export function emptyPergunta(ordem = 1, tipoRespostaCodigo = 'texto') {
  return {
    id: null,
    clientKey: newClientKey('pq'),
    tipoRespostaId: null,
    tipoRespostaCodigo,
    descricao: '',
    prioridade: 'NORMAL',
    tipoAntecedentePessoalId: null,
    antecedenteCatalogoId: null,
    perguntaPaiId: null,
    perguntaPaiClientKey: null,
    obrigatorio: false,
    ordem,
    alternativas: [],
    outrasFichasCount: 0,
  };
}

function linkPerguntaPaiClientKeys(secoes) {
  const byId = new Map();
  for (const s of secoes) {
    for (const q of s.perguntas) {
      if (q.id) byId.set(String(q.id), q.clientKey);
    }
  }
  for (const s of secoes) {
    for (const q of s.perguntas) {
      if (q.perguntaPaiId && !q.perguntaPaiClientKey) {
        q.perguntaPaiClientKey = byId.get(String(q.perguntaPaiId)) ?? null;
      }
    }
  }
}

/** Converte estado do editor para payload PUT /documento. */
export function secoesToDocumentoPayload({ nome, especialidadeId, textoDeclaracao, secoes, allowEmpty = false }) {
  return {
    nome: nome?.trim() || 'Sem nome',
    especialidadeId: especialidadeId || null,
    textoDeclaracao: textoDeclaracao ?? '',
    allowEmpty,
    secoes: (secoes || []).map((sec, si) => ({
      id: sec.id || undefined,
      clientKey: sec.clientKey,
      nome: sec.nome?.trim() || `Seção ${si + 1}`,
      sexoAplicavel: sec.sexoAplicavel || null,
      ordem: sec.ordem ?? si + 1,
      perguntas: (sec.perguntas || []).map((q, qi) => ({
        id: q.id || undefined,
        clientKey: q.clientKey,
        tipoRespostaId: q.tipoRespostaId || undefined,
        tipoRespostaCodigo: q.tipoRespostaCodigo || 'texto',
        descricao: q.descricao?.trim() || 'Pergunta',
        prioridade: q.prioridade || 'NORMAL',
        tipoAntecedentePessoalId: q.tipoAntecedentePessoalId || undefined,
        antecedenteCatalogoId: q.antecedenteCatalogoId || undefined,
        perguntaPaiId: q.perguntaPaiId || undefined,
        perguntaPaiClientKey: q.perguntaPaiClientKey || undefined,
        obrigatorio: Boolean(q.obrigatorio),
        ordem: q.ordem ?? qi + 1,
        alternativas: q.alternativas?.length ? q.alternativas : undefined,
      })),
    })),
  };
}

export function computeCounts(secoes) {
  let total = 0;
  let criticas = 0;
  let alertas = 0;
  let prontuario = 0;
  for (const s of secoes || []) {
    for (const q of s.perguntas || []) {
      total += 1;
      const pri = String(q.prioridade || 'NORMAL').toUpperCase();
      if (pri === 'CRITICA') criticas += 1;
      else if (pri === 'ALERTA') alertas += 1;
      if (q.antecedenteCatalogoId || q.tipoAntecedentePessoalId) prontuario += 1;
    }
  }
  return { totalPerguntas: total, criticas, alertas, alimentamProntuario: prontuario };
}

export function findPerguntaLocation(secoes, clientKey) {
  for (let si = 0; si < secoes.length; si += 1) {
    const qi = secoes[si].perguntas.findIndex((q) => q.clientKey === clientKey);
    if (qi >= 0) return { secaoIndex: si, perguntaIndex: qi };
  }
  return null;
}

/** Enter — insere pergunta abaixo na mesma seção. */
export function applyEnter(secoes, focusedKey, defaultTipo = 'texto') {
  const loc = findPerguntaLocation(secoes, focusedKey);
  const next = secoes.map((s) => ({ ...s, perguntas: [...s.perguntas] }));
  if (!loc) {
    if (next.length === 0) next.push(emptySecao(1));
    const si = next.length - 1;
    const ordem = next[si].perguntas.length + 1;
    const nova = emptyPergunta(ordem, defaultTipo);
    next[si].perguntas.push(nova);
    return { secoes: reindexPerguntas(next), focusKey: nova.clientKey, tabPaiMode: false };
  }
  const { secaoIndex, perguntaIndex } = loc;
  const sec = next[secaoIndex];
  const tipo = sec.perguntas[perguntaIndex]?.tipoRespostaCodigo || defaultTipo;
  const nova = emptyPergunta(perguntaIndex + 2, tipo);
  sec.perguntas.splice(perguntaIndex + 1, 0, nova);
  return { secoes: reindexPerguntas(next), focusKey: nova.clientKey, tabPaiMode: false };
}

/** Tab — define pergunta anterior como pai da atual. */
export function applyTab(secoes, focusedKey) {
  const loc = findPerguntaLocation(secoes, focusedKey);
  if (!loc || loc.perguntaIndex === 0) {
    return { secoes, focusKey: focusedKey, tabPaiMode: true };
  }
  const next = secoes.map((s) => ({ ...s, perguntas: s.perguntas.map((q) => ({ ...q })) }));
  const sec = next[loc.secaoIndex];
  const atual = sec.perguntas[loc.perguntaIndex];
  const anterior = sec.perguntas[loc.perguntaIndex - 1];
  atual.perguntaPaiId = anterior.id ?? null;
  atual.perguntaPaiClientKey = anterior.clientKey;
  return { secoes: next, focusKey: focusedKey, tabPaiMode: true };
}

/** Esc — limpa foco e modo pai. */
export function applyEsc() {
  return { focusKey: null, tabPaiMode: false };
}

export function reindexPerguntas(secoes) {
  return secoes.map((s, si) => ({
    ...s,
    ordem: si + 1,
    perguntas: s.perguntas.map((q, qi) => ({ ...q, ordem: qi + 1 })),
  }));
}

export function reindexSecoes(secoes) {
  return secoes.map((s, i) => ({ ...s, ordem: i + 1 }));
}

/** Pergunta compartilhada exige modal antes de salvar alteração global. */
export function needsCompartilhamentoModal(pergunta) {
  return Boolean(pergunta?.id) && (pergunta.outrasFichasCount ?? 0) >= 1;
}

/** 'destacar' = cópia só nesta ficha; 'global' = alterar em todas. */
export function resolveSharedSaveAction(choice) {
  return choice === 'destacar' ? 'destacar' : 'global';
}

export function shouldDestacarBeforeSave(action) {
  return action === 'destacar';
}

/** Clona seções de outra ficha materializada, gerando novos clientKeys. */
export function cloneSecoesFromFicha(ficha) {
  return groupItensToSecoes(ficha).map((sec) => ({
    ...sec,
    id: null,
    clientKey: newClientKey('sec'),
    perguntas: sec.perguntas.map((q) => ({
      ...q,
      id: null,
      clientKey: newClientKey('pq'),
      perguntaPaiId: null,
      perguntaPaiClientKey: null,
      outrasFichasCount: 0,
    })),
  }));
}
