/** @typedef {{ id?: string|null, clientKey: string, nome: string, sexoAplicavel?: string|null, ordem: number, perguntas: import('./editorDocumentoReducer.js').PerguntaEditor[] }} SecaoEditor */

import { perguntaAlimentaProntuario } from './editorTipoMeta.js';

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

  linkPerguntaPaiClientKeys(secoes);
  return secoes;
}

export const DECL_PADRAO =
  'Declaro que as informações por mim mencionadas são verdadeiras. Comprometo-me a informar qualquer alteração no meu quadro de saúde atual.';

export function emptySecao(ordem = 1) {
  return {
    id: null,
    clientKey: newClientKey('sec'),
    nome: '',
    sexoAplicavel: null,
    ordem,
    icone: null,
    descricao: null,
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
  const TIPOS_ESCOLHA = new Set(['escolha_unica', 'multipla_escolha']);
  return {
    nome: nome?.trim() || '',
    especialidadeId: especialidadeId || null,
    textoDeclaracao: textoDeclaracao ?? '',
    allowEmpty,
    secoes: (secoes || []).map((sec, si) => ({
      id: sec.id || undefined,
      clientKey: sec.clientKey,
      nome: sec.nome?.trim() || `Seção ${si + 1}`,
      sexoAplicavel: sec.sexoAplicavel || null,
      ordem: sec.ordem ?? si + 1,
      icone: sec.icone || undefined,
      descricao: sec.descricao || undefined,
      perguntas: (sec.perguntas || []).map((q, qi) => {
        const tipo = q.tipoRespostaCodigo || 'texto';
        const isEscolha = TIPOS_ESCOLHA.has(tipo);
        const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
        const alternativasPayload =
          isEscolha && alts.length
            ? alts.map((a, ai) => {
                const row = {
                  alternativa: String(a.alternativa || '').trim(),
                  ordem: a.ordem ?? ai + 1,
                };
                if (a.id) row.id = a.id;
                return row;
              }).filter((a) => a.alternativa)
            : undefined;
        return {
          id: q.id || undefined,
          clientKey: q.clientKey,
          tipoRespostaId: q.tipoRespostaId || undefined,
          tipoRespostaCodigo: tipo,
          descricao: q.descricao?.trim() || 'Pergunta',
          prioridade: q.prioridade || 'NORMAL',
          tipoAntecedentePessoalId: q.tipoAntecedentePessoalId || undefined,
          antecedenteCatalogoId: q.antecedenteCatalogoId || undefined,
          perguntaPaiId: q.perguntaPaiId || undefined,
          perguntaPaiClientKey: q.perguntaPaiClientKey || undefined,
          obrigatorio: Boolean(q.obrigatorio),
          ordem: q.ordem ?? qi + 1,
          alternativas: alternativasPayload,
        };
      }),
    })),
  };
}

/** Valida perguntas de escolha com menos de 2 alternativas preenchidas. */
export function findEscolhaSemAlternativas(secoes) {
  const TIPOS = new Set(['escolha_unica', 'multipla_escolha']);
  for (const s of secoes || []) {
    for (const q of s.perguntas || []) {
      if (!TIPOS.has(q.tipoRespostaCodigo)) continue;
      const n = (q.alternativas || []).filter((a) => String(a.alternativa || '').trim()).length;
      if (n < 2) {
        return q;
      }
    }
  }
  return null;
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
      if (perguntaAlimentaProntuario(q)) prontuario += 1;
    }
  }
  return { totalPerguntas: total, criticas, alertas, alimentamProntuario: prontuario };
}

/**
 * Reconcilia resposta do PUT/GET preservando clientKeys locais e carimbando IDs do servidor.
 */
export function reconcileDocumentoFromApi(state, ficha) {
  const apiSecoes = groupItensToSecoes(ficha);
  const localSecoes = state.secoes || [];

  if (localSecoes.length !== apiSecoes.length) {
    return {
      ...state,
      fichaId: ficha.id ?? state.fichaId,
      nome: ficha.nome ?? state.nome,
      especialidadeId: ficha.especialidadeId ?? state.especialidadeId,
      textoDeclaracao: ficha.textoDeclaracao ?? state.textoDeclaracao,
      dirty: state.dirty,
    };
  }

  const secoes = localSecoes.map((localSec, si) => {
    const apiSec = apiSecoes[si];
    const localPerguntas = localSec.perguntas || [];
    const apiPerguntas = apiSec?.perguntas || [];

    if (localPerguntas.length !== apiPerguntas.length) {
      return localSec;
    }

    const perguntas = localPerguntas.map((localQ, qi) => {
      const apiQ = apiPerguntas[qi];
      const apiAlts = apiQ?.alternativas;
      return {
        ...localQ,
        id: apiQ?.id ?? localQ.id,
        tipoRespostaId: apiQ?.tipoRespostaId ?? localQ.tipoRespostaId,
        perguntaPaiId: apiQ?.perguntaPaiId ?? localQ.perguntaPaiId,
        perguntaPaiClientKey: apiQ?.perguntaPaiClientKey ?? localQ.perguntaPaiClientKey,
        outrasFichasCount: apiQ?.outrasFichasCount ?? localQ.outrasFichasCount,
        alternativas: Array.isArray(apiAlts) ? apiAlts : localQ.alternativas ?? [],
      };
    });

    return {
      ...localSec,
      id: apiSec?.id ?? localSec.id,
      perguntas,
    };
  });

  linkPerguntaPaiClientKeys(secoes);

  return {
    ...state,
    fichaId: ficha.id ?? state.fichaId,
    nome: ficha.nome ?? state.nome,
    especialidadeId: ficha.especialidadeId ?? state.especialidadeId,
    textoDeclaracao: ficha.textoDeclaracao ?? state.textoDeclaracao,
    secoes,
    dirty: false,
  };
}

export function findPerguntaLocation(secoes, clientKey) {
  for (let si = 0; si < secoes.length; si += 1) {
    const qi = secoes[si].perguntas.findIndex((q) => q.clientKey === clientKey);
    if (qi >= 0) return { secaoIndex: si, perguntaIndex: qi };
  }
  return null;
}

export function getPerguntaDisplayNum(secao) {
  let n = 0;
  const map = new Map();
  for (const q of secao.perguntas || []) {
    if (!q.perguntaPaiClientKey) n += 1;
    map.set(q.clientKey, q.perguntaPaiClientKey ? null : n);
  }
  return map;
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

/** Descarta resposta de PUT quando uma gravação mais recente já foi iniciada. */
export function isSaveGenerationCurrent(requestGen, currentGen) {
  return requestGen === currentGen;
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

/** Clona seções de um documento (GET starter / PUT shape), novos clientKeys e ids nulos. */
export function cloneSecoesFromDocumento(secoes) {
  const oldToNew = new Map();
  const cloned = (secoes || []).map((sec, si) => {
    const perguntas = (sec.perguntas || []).map((q, qi) => {
      const clientKey = newClientKey('pq');
      if (q.clientKey) oldToNew.set(String(q.clientKey), clientKey);
      return {
        id: null,
        clientKey,
        tipoRespostaId: q.tipoRespostaId ?? null,
        tipoRespostaCodigo: q.tipoRespostaCodigo || q.tipoResposta || 'texto',
        descricao: q.descricao ?? '',
        prioridade: String(q.prioridade || 'NORMAL').toUpperCase(),
        tipoAntecedentePessoalId: q.tipoAntecedentePessoalId ?? null,
        antecedenteCatalogoId: q.antecedenteCatalogoId ?? null,
        perguntaPaiId: null,
        perguntaPaiClientKey: q.perguntaPaiClientKey || null,
        obrigatorio: Boolean(q.obrigatorio),
        ordem: q.ordem ?? qi + 1,
        alternativas: q.alternativas ?? [],
        outrasFichasCount: 0,
      };
    });
    return {
      id: null,
      clientKey: newClientKey('sec'),
      nome: sec.nome || '',
      sexoAplicavel: sec.sexoAplicavel ?? null,
      ordem: sec.ordem ?? si + 1,
      icone: sec.icone ?? null,
      descricao: sec.descricao ?? null,
      perguntas,
    };
  });
  for (const sec of cloned) {
    sec.perguntas = sec.perguntas.map((q) => ({
      ...q,
      perguntaPaiClientKey: q.perguntaPaiClientKey
        ? oldToNew.get(String(q.perguntaPaiClientKey)) ?? null
        : null,
    }));
  }
  return cloned;
}

export function isNomeVazio(nome) {
  return !String(nome || '').trim();
}

export const NOME_VAZIO_TOAST = 'Dê um nome para a ficha';
export const COMPOSE_PENDENTE_TOAST =
  'Você tem uma pergunta não finalizada. Use Adicionar pergunta para incluí-la.';
export const COMPOSE_TITULO_VAZIO_HINT = 'Escreva o texto da pergunta';
export const SEM_PERGUNTAS_TOAST = 'Adicione ao menos uma pergunta antes de salvar.';
export const ESCOLHA_INCOMPLETA_TOAST =
  'Perguntas de lista precisam de pelo menos 2 opções de resposta.';

const TIPOS_ESCOLHA = new Set(['escolha_unica', 'multipla_escolha']);

function countAltsDraft(compose) {
  return (compose?.alternativasDraft || []).filter((a) => String(a.alternativa || '').trim()).length;
}

/** Compose aberto com texto ou alternativas em draft — ainda não é pergunta. */
export function composeHasPending(compose) {
  if (!compose) return false;
  if (String(compose.texto || '').trim()) return true;
  return countAltsDraft(compose) > 0;
}

export function canCommitCompose(compose, stickyTipo) {
  if (!compose) return false;
  if (!String(compose.texto || '').trim()) return false;
  if (TIPOS_ESCOLHA.has(stickyTipo)) return countAltsDraft(compose) >= 2;
  return true;
}

export function composeCommitHint(compose, stickyTipo) {
  if (canCommitCompose(compose, stickyTipo)) return '';
  if (!String(compose?.texto || '').trim()) return COMPOSE_TITULO_VAZIO_HINT;
  if (TIPOS_ESCOLHA.has(stickyTipo)) return ESCOLHA_INCOMPLETA_TOAST;
  return COMPOSE_TITULO_VAZIO_HINT;
}

export function needsCreateShell(fichaId) {
  return !fichaId;
}

export function allowEmptyDocumento(secoes) {
  return !(secoes || []).some((s) => (s.perguntas || []).length > 0);
}

export function usarFichaNeedsConfirm(secoes) {
  return (secoes?.length || 0) > 0;
}

export function planPadraoSync({ padrao, fichaId, clinicaPadraoId }) {
  if (!fichaId) return null;
  const wasPadrao = clinicaPadraoId != null && String(clinicaPadraoId) === String(fichaId);
  if (padrao && !wasPadrao) return { anamnesePadraoId: fichaId };
  if (!padrao && wasPadrao) return { anamnesePadraoId: null };
  return null;
}

export function countPerguntas(secoes) {
  return (secoes || []).reduce((n, s) => n + (s.perguntas?.length || 0), 0);
}
