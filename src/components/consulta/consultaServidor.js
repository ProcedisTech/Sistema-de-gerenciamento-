/**
 * Regras puras entre a consulta do servidor (D4) e o estado do aparelho (useJourneyState).
 * - Mescla (C2, F5b): a linha é ligada ao item pelo `itemId` guardado nela; item que sumiu do servidor some (linha
 *   sem id fica); observação vazia do servidor é aplicada; campo com envio pendente (`pendente(chave)`) fica como está.
 * - Orientações por item (F5b): `orient` da linha = `null` (nunca definidas; a tela carrega o modelo) ou lista
 *   `[{ descricao, checado, ordem }]` (pode ser vazia), espelho de `AtendimentoItemDTO.orientacoes`.
 * - Diferenças: o que o aparelho tem e o servidor ainda não, para a fila enviar.
 */

const texto = (v) => (v == null ? '' : String(v));
const idOuNulo = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s || null;
};

/**
 * Orientações normalizadas para comparar e enviar: `null` quando nunca definidas (não é lista); senão a lista com
 * texto aparado, `checado` booleano, `ordem` = a do item ou a posição, vazias fora (o servidor recusa descrição vazia).
 * @param {Array<{ descricao?: string, checado?: boolean, ordem?: number }> | null | undefined} lista
 * @returns {Array<{ descricao: string, checado: boolean, ordem: number }> | null}
 */
export function orientacoesNormalizadas(lista) {
  if (!Array.isArray(lista)) return null;
  return lista
    .map((i, idx) => ({
      descricao: texto(i?.descricao).trim(),
      checado: Boolean(i?.checado),
      ordem: Number.isFinite(Number(i?.ordem)) ? Number(i.ordem) : idx,
    }))
    .filter((x) => x.descricao);
}

/** `true` se as duas listas (já normalizadas, ou `null`) têm as mesmas orientações (descrição, checado e ordem). */
export function mesmasOrientacoes(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (a.length !== b.length) return false;
  return a.every((x, i) => x.descricao === b[i].descricao && x.checado === b[i].checado && x.ordem === b[i].ordem);
}

/** `true` se só o `checado` difere entre as listas (mesmos textos e ordens): o envio sai sem espera. */
export function soMudouChecado(a, b) {
  if (a == null || b == null || a.length !== b.length) return false;
  return a.every((x, i) => x.descricao === b[i].descricao && x.ordem === b[i].ordem);
}

/** Campos de um item como o servidor os guarda. */
export function camposDoItemServidor(item) {
  return {
    obs: texto(item?.observacaoExecucao),
    cat: idOuNulo(item?.catalogoProcedimentoSaudeId),
    nome: texto(item?.nomeLivre ?? item?.procedimentoNome).trim(),
    orient: orientacoesNormalizadas(item?.orientacoes),
  };
}

/**
 * B-42 F3: rótulo que a tela inventa para a agenda sem catálogo, pelo código do tipo (os mesmos de
 * `agendaDashboardMapping.js`, MODALIDADE_LABEL). O servidor não guarda esse nome no item.
 */
const ROTULO_DA_MODALIDADE = Object.freeze({ consulta: 'Consulta', avaliacao: 'Avaliação', retorno: 'Retorno' });
const ROTULOS_DE_TELA = new Set(Object.values(ROTULO_DA_MODALIDADE));

export function rotuloDaModalidade(tipoCodigo) {
  return ROTULO_DA_MODALIDADE[String(tipoCodigo || '').trim().toLowerCase()] ?? null;
}

/** "Retorno: <nome>" da agenda de retorno sem catálogo, com o nome que a agenda mostra (agendaDashboardMapping.js). */
const RETORNO_COM_NOME = /^Retorno: \S/;

function ehRotuloDeTela(nome) {
  return ROTULOS_DE_TELA.has(nome) || RETORNO_COM_NOME.test(nome);
}

/**
 * Campos de uma linha de `procedimentosSessao`. Linha com a marca `nomeSoDeTela` (rótulo da agenda sem catálogo que
 * ninguém mudou) vai sem nome: o rótulo é só de tela e nunca vira `nomeLivre` no servidor.
 */
export function camposDaLinhaSessao(linha) {
  return {
    obs: texto(linha?.observacoesExecucao),
    cat: idOuNulo(linha?.nomeProcedimentoCatalogoId ?? linha?.catalogoProcedimentoSaudeId),
    nome: linha?.nomeSoDeTela === true ? '' : texto(linha?.nomeProcedimento || linha?.procedimentoNome).trim(),
    orient: orientacoesNormalizadas(linha?.orient),
  };
}

/**
 * Marca `nomeSoDeTela` nas linhas que vêm de agenda sem catálogo com o rótulo da modalidade ("Consulta",
 * "Avaliação", "Retorno" ou "Retorno: <nome>"). Linha que já tem a marca decidida (`true`/`false`) fica como está.
 * Sem mudança, devolve o mesmo array.
 */
export function marcarNomesDeTela(linhas) {
  if (!Array.isArray(linhas)) return linhas;
  let mudou = false;
  const out = linhas.map((linha) => {
    if (!linha || linha.nomeSoDeTela != null) return linha;
    if (!idOuNulo(linha.agendaId)) return linha;
    if (idOuNulo(linha.nomeProcedimentoCatalogoId ?? linha.catalogoProcedimentoSaudeId)) return linha;
    if (!ehRotuloDeTela(texto(linha.nomeProcedimento || linha.procedimentoNome).trim())) return linha;
    mudou = true;
    return { ...linha, nomeSoDeTela: true };
  });
  return mudou ? out : linhas;
}

/** Rótulo do item de agenda sem catálogo, como a Agenda o mostra (`${modalidade}: ${nome}` ou só a modalidade). */
function rotuloDoItem(item) {
  const modalidade = rotuloDaModalidade(item?.agendaTipoProcedimentoCodigo);
  if (!modalidade) return null;
  const naAgenda = texto(item?.agendaCatalogoProcedimentoNome).trim();
  return naAgenda ? `${modalidade}: ${naAgenda}` : modalidade;
}

/** Com catálogo, o nome vem dele; sem catálogo, vale o nome livre. */
export function mesmoProcedimento(a, b) {
  if (a.cat || b.cat) return a.cat === b.cat;
  return a.nome === b.nome;
}

/**
 * Linha da sessão a partir do item do servidor. Item de agenda sem catálogo e sem nome volta com o rótulo da
 * modalidade e a marca `nomeSoDeTela` (F5/hidratação mostram o mesmo rótulo de antes, sem PATCH). Na agenda de
 * retorno, `agendaCatalogoProcedimentoNome` (o nome que a agenda mostra) remonta "Retorno: <nome>", como em
 * `agendaDashboardMapping.js`.
 */
export function linhaDoItemServidor(item) {
  const nomeDoServidor = texto(item?.nomeLivre ?? item?.procedimentoNome).trim();
  const cat = idOuNulo(item?.catalogoProcedimentoSaudeId);
  const rotulo = !nomeDoServidor && !cat ? rotuloDoItem(item) : null;
  const nome = rotulo ?? nomeDoServidor;
  return {
    itemId: idOuNulo(item?.id),
    agendaId: item?.agendaId ?? null,
    procedimentoNome: nome,
    nomeProcedimento: nome,
    nomeSoDeTela: rotulo != null,
    catalogoProcedimentoSaudeId: cat,
    nomeProcedimentoCatalogoId: cat,
    planejamentoItemId: item?.planejamentoItemId ?? null,
    isAgendaRetorno: String(item?.agendaTipoProcedimentoCodigo || '').toLowerCase() === 'retorno',
    observacoesExecucao: texto(item?.observacaoExecucao),
    orient: orientacoesNormalizadas(item?.orientacoes),
    // NÃO DETERMINADO: o AtendimentoItemDTO não diz se o item está ligado a um PF legado; vale `false`.
    legado: false,
  };
}

/**
 * Item do servidor de cada linha da sessão: pelo `itemId` guardado na linha; linha sem id, pela agenda e depois
 * pela posição entre os que sobraram. Linha com `itemId` que não está mais no servidor fica sem item (`null`), sem
 * reserva pela posição: a mescla a remove.
 * @returns {Array<string | null>} id do item por índice da sessão
 */
export function mapearItensDaSessao(sessao, itensServidor) {
  const itens = Array.isArray(itensServidor) ? [...itensServidor].sort((a, b) => a.ordem - b.ordem) : [];
  const linhas = Array.isArray(sessao) ? sessao : [];
  const usados = new Set();
  const porId = linhas.map((linha) => {
    const id = idOuNulo(linha?.itemId);
    if (!id) return null;
    const item = itens.find((i) => !usados.has(i.id) && String(i.id) === id);
    if (!item) return null;
    usados.add(item.id);
    return item.id;
  });
  const porAgenda = porId.map((id, idx) => {
    if (id || idOuNulo(linhas[idx]?.itemId)) return id;
    const ag = idOuNulo(linhas[idx]?.agendaId);
    if (!ag) return null;
    const item = itens.find((i) => !usados.has(i.id) && idOuNulo(i.agendaId) === ag);
    if (!item) return null;
    usados.add(item.id);
    return item.id;
  });
  const livres = itens.filter((i) => !usados.has(i.id) && !idOuNulo(i.agendaId));
  return porAgenda.map((id, idx) => {
    if (id) return id;
    // F3: linha local sem itemId casa por posição com um item livre do servidor mesmo com agendaId local (o item
    // do servidor pode ter nascido sem agenda): sem isso o item vira aba fantasma ao lado da linha local.
    if (idOuNulo(linhas[idx]?.itemId)) return null;
    const item = livres.shift();
    return item ? item.id : null;
  });
}

/**
 * Sessão do aparelho com o que veio do servidor (F5b):
 * - linha com `itemId` cujo item sumiu do servidor é removida; linha sem `itemId` fica;
 * - observação do servidor é aplicada mesmo vazia, salvo `pendente('item:{id}:obs')`;
 * - procedimento (catálogo/nome) do servidor, salvo `pendente('item:{id}:proc')`;
 * - `orient` do servidor (nula ou lista), salvo `pendente('item:{id}:orient')`;
 * - a linha ganha o `itemId` do item que a mescla ligou a ela.
 * @param {(chave: string) => boolean} pendente chave da fila (`item:{id}:obs` | `item:{id}:proc` | `item:{id}:orient`)
 * @returns {{ sessao: object[], mudou: boolean }}
 */
export function mesclarSessao(sessao, itensServidor, pendente) {
  const itens = Array.isArray(itensServidor) ? [...itensServidor].sort((a, b) => a.ordem - b.ordem) : [];
  const linhas = Array.isArray(sessao) ? sessao : [];
  if (linhas.length === 0) {
    if (itens.length === 0) return { sessao: linhas, mudou: false };
    return { sessao: itens.map(linhaDoItemServidor), mudou: true };
  }
  const mapa = mapearItensDaSessao(linhas, itens);
  let mudou = false;
  const out = [];
  linhas.forEach((linha, idx) => {
    const item = itens.find((i) => i.id === mapa[idx]);
    if (!item) {
      // Linha ligada a um item que o servidor não tem mais: some. Linha ainda sem item (local) fica.
      if (idOuNulo(linha?.itemId)) mudou = true;
      else out.push(linha);
      return;
    }
    const srv = camposDoItemServidor(item);
    const mem = camposDaLinhaSessao(linha);
    let nova = linha;
    if (idOuNulo(linha?.itemId) !== String(item.id)) nova = { ...nova, itemId: String(item.id) };
    if (srv.obs !== mem.obs && !pendente(`item:${item.id}:obs`)) {
      nova = { ...nova, observacoesExecucao: srv.obs };
    }
    if ((srv.cat || srv.nome) && !mesmoProcedimento(srv, mem) && !pendente(`item:${item.id}:proc`)) {
      nova = {
        ...nova,
        nomeProcedimento: srv.nome,
        procedimentoNome: srv.nome,
        nomeSoDeTela: false,
        nomeProcedimentoCatalogoId: srv.cat,
        catalogoProcedimentoSaudeId: srv.cat,
      };
    }
    if (!mesmasOrientacoes(srv.orient, mem.orient) && !pendente(`item:${item.id}:orient`)) {
      nova = { ...nova, orient: srv.orient };
    }
    if (nova !== linha) mudou = true;
    out.push(nova);
  });
  const mapeados = new Set(mapa.filter(Boolean));
  const novos = itens.filter((i) => !mapeados.has(i.id));
  if (novos.length > 0) {
    mudou = true;
    out.push(...novos.map(linhaDoItemServidor));
  }
  // F3: ordem final = `ordem` do servidor em todas as abas. Linha ligada a item (ou item novo) segue a ordem do
  // servidor; linha ainda local (sem item) vai depois, na ordem em que estava.
  const ordemDoItem = new Map(itens.map((i, pos) => [String(i.id), pos]));
  const posicaoNoServidor = (linha) => {
    const id = idOuNulo(linha?.itemId);
    return id != null && ordemDoItem.has(id) ? ordemDoItem.get(id) : null;
  };
  const comItem = out.filter((l) => posicaoNoServidor(l) != null);
  const locais = out.filter((l) => posicaoNoServidor(l) == null);
  comItem.sort((a, b) => posicaoNoServidor(a) - posicaoNoServidor(b));
  const final = [...comItem, ...locais];
  if (!mudou && final.some((l, i) => l !== linhas[i])) mudou = true;
  return { sessao: mudou ? final : linhas, mudou };
}

/**
 * O que a sessão tem e o servidor (pela `base`) não. A diferença `orient` leva a lista inteira e `imediato: true`
 * quando só o `checado` mudou (caixa marcada sai sem espera; texto espera o debounce). Linha com `orient` nula não
 * gera diferença (nunca definida aqui).
 * @param {Map<string, { obs: string, cat: string | null, nome: string, orient: object[] | null }>} base
 * @returns {{ alterar: Array<{ itemId: string, campo: 'obs' | 'proc' | 'orient', campos: object, imediato?: boolean }>, criar: Array<{ indice: number, catalogoProcedimentoSaudeId: string | null, nomeLivre: string | null }> }}
 */
export function diferencasDosItens(sessao, mapa, base) {
  const alterar = [];
  const criar = [];
  (Array.isArray(sessao) ? sessao : []).forEach((linha, idx) => {
    const mem = camposDaLinhaSessao(linha);
    const itemId = mapa[idx];
    if (!itemId) {
      if (mem.cat || mem.nome) {
        criar.push({ indice: idx, catalogoProcedimentoSaudeId: mem.cat, nomeLivre: mem.cat ? null : mem.nome || null });
      }
      return;
    }
    const srv = base.get(itemId);
    if (!srv) return;
    if (mem.obs !== srv.obs) {
      alterar.push({ itemId, campo: 'obs', campos: { observacaoExecucao: mem.obs } });
    }
    if (!mesmoProcedimento(mem, srv)) {
      alterar.push({
        itemId,
        campo: 'proc',
        campos: { catalogoProcedimentoSaudeId: mem.cat, nomeLivre: mem.cat ? null : mem.nome || null },
      });
    }
    if (mem.orient != null && !mesmasOrientacoes(mem.orient, srv.orient)) {
      alterar.push({
        itemId,
        campo: 'orient',
        campos: { orientacoes: mem.orient },
        imediato: soMudouChecado(mem.orient, srv.orient),
      });
    }
  });
  return { alterar, criar };
}

/** `true` se a linha precisa de ao menos 1 orientação marcada (decisão 7): item com catálogo ou retorno, não legado. */
function exigeOrientacao(linha, retornoDaConsulta) {
  if (!linha || linha.legado === true) return false;
  const cat = idOuNulo(linha.nomeProcedimentoCatalogoId ?? linha.catalogoProcedimentoSaudeId);
  return Boolean(cat) || linha.isAgendaRetorno === true || retornoDaConsulta === true;
}

/**
 * Linhas da sessão que ainda não têm orientação marcada e precisam (decisão 7). A tela mostra a mensagem; o
 * encerrar pelo módulo espera a lista vazia.
 * @param {object[]} sessao
 * @param {{ retorno?: boolean }} [opcoes] `retorno`: a consulta é de retorno (vale para todas as linhas)
 * @returns {Array<{ indice: number, itemId: string | null, nome: string }>}
 */
export function itensSemOrientacaoMarcada(sessao, { retorno = false } = {}) {
  const out = [];
  (Array.isArray(sessao) ? sessao : []).forEach((linha, indice) => {
    if (!exigeOrientacao(linha, retorno)) return;
    const lista = orientacoesNormalizadas(linha.orient);
    if (lista && lista.some((o) => o.checado)) return;
    out.push({
      indice,
      itemId: idOuNulo(linha.itemId),
      nome: texto(linha.nomeProcedimento || linha.procedimentoNome).trim(),
    });
  });
  return out;
}

/**
 * O que a tela de orientações recebe (contrato com ConsultaProcedimentoFlow/Step5Finalization): um bloco por linha.
 * @returns {Array<{ itemId: string | null, nome: string, orient: object[] | null, legado: boolean }>}
 */
export function itensOrientacoesDaSessao(sessao) {
  return (Array.isArray(sessao) ? sessao : []).map((linha) => ({
    itemId: idOuNulo(linha?.itemId),
    nome: texto(linha?.nomeProcedimento || linha?.procedimentoNome).trim(),
    orient: Array.isArray(linha?.orient) ? linha.orient : null,
    legado: linha?.legado === true,
  }));
}

/**
 * "Salvar como padrão?" depois do encerrar, por item (decisão 6): cada linha com `orient` definida (não nula), não
 * legada e com nome, com a lista que o encerrar devolveu para o procedimento desse item (`procedimentos[].orientacoes`
 * ligado pelo `atendimentoItemId`) ou, sem ela, a da linha. Lista vazia não pergunta.
 * @param {object[]} sessao
 * @param {Array<{ atendimentoItemId?: string, orientacoes?: object[] }>} procedimentos do EncerramentoResultadoDTO
 * @returns {Array<{ itemId: string | null, nome: string, catalogoProcedimentoSaudeId: string | null, orientacoes: Array<{ descricao: string, checado: boolean, ordem: number }> }>}
 */
export function orientacoesPorItemParaPadrao(sessao, procedimentos) {
  const pfs = Array.isArray(procedimentos) ? procedimentos : [];
  const out = [];
  (Array.isArray(sessao) ? sessao : []).forEach((linha) => {
    if (!linha || linha.legado === true || !Array.isArray(linha.orient)) return;
    const itemId = idOuNulo(linha.itemId);
    const pf = itemId ? pfs.find((p) => idOuNulo(p?.atendimentoItemId) === itemId) : null;
    const lista = orientacoesNormalizadas(Array.isArray(pf?.orientacoes) ? pf.orientacoes : linha.orient) ?? [];
    const nome = texto(linha.nomeProcedimento || linha.procedimentoNome).trim();
    if (lista.length === 0 || !nome) return;
    out.push({
      itemId,
      nome,
      catalogoProcedimentoSaudeId: idOuNulo(linha.nomeProcedimentoCatalogoId ?? linha.catalogoProcedimentoSaudeId),
      orientacoes: lista,
    });
  });
  return out;
}

export function baseDosItens(itensServidor) {
  return new Map((Array.isArray(itensServidor) ? itensServidor : []).map((i) => [i.id, camposDoItemServidor(i)]));
}

/**
 * Textos da avaliação (F4): campo do `AtendimentoDTO` → chave da fila (`avaliacao:queixa|expectativas|observacoes`).
 * Cada campo é uma entrada própria da fila e o PATCH leva só ele.
 */
export const CHAVE_AVALIACAO = Object.freeze({
  queixa: 'avaliacao:queixa',
  expectativas: 'avaliacao:expectativas',
  observacoesAvaliacao: 'avaliacao:observacoes',
});

/** Campos da avaliação, na ordem de `CHAVE_AVALIACAO`. */
export const CAMPOS_AVALIACAO = Object.freeze(Object.keys(CHAVE_AVALIACAO));

/**
 * Os 3 textos da avaliação como o servidor os guarda (`null`/ausente → `''`).
 * @param {{ queixa?: string | null, expectativas?: string | null, observacoesAvaliacao?: string | null } | null | undefined} dto
 * @returns {{ queixa: string, expectativas: string, observacoesAvaliacao: string }}
 */
export function textosDaAvaliacao(dto) {
  return {
    queixa: texto(dto?.queixa),
    expectativas: texto(dto?.expectativas),
    observacoesAvaliacao: texto(dto?.observacoesAvaliacao),
  };
}

/**
 * Textos da avaliação do aparelho com o que veio do servidor: cada campo do servidor é aplicado (mesmo vazio),
 * salvo `pendente(CHAVE_AVALIACAO[campo])` (envio deste aparelho ainda não chegou).
 * @param {{ queixa?: string, expectativas?: string, observacoesAvaliacao?: string } | null | undefined} local
 * @param {{ queixa: string, expectativas: string, observacoesAvaliacao: string }} servidor (de `textosDaAvaliacao`)
 * @param {(chave: string) => boolean} pendente
 * @returns {{ valores: { queixa: string, expectativas: string, observacoesAvaliacao: string }, mudou: boolean }}
 */
export function mesclarAvaliacao(local, servidor, pendente) {
  const valores = {};
  let mudou = false;
  for (const campo of CAMPOS_AVALIACAO) {
    const mem = texto(local?.[campo]);
    const srv = texto(servidor?.[campo]);
    if (srv !== mem && !pendente(CHAVE_AVALIACAO[campo])) {
      valores[campo] = srv;
      mudou = true;
    } else {
      valores[campo] = mem;
    }
  }
  return { valores, mudou };
}

/** Status em que a consulta não está mais aberta: a tela não entra nem continua nela. */
export const STATUS_FECHADOS = new Set(['encerrado', 'cancelado', 'abandonado']);

/** `true` se a consulta do servidor está fechada (encerrada, cancelada ou abandonada). */
export function consultaFechada(dto) {
  return STATUS_FECHADOS.has(dto?.status);
}

/** Opções do `handleStartAttendance` para entrar de novo numa consulta (atalho e "Voltar à consulta"). */
export function opcoesParaEntrar(dto) {
  const itens = Array.isArray(dto?.itens) ? [...dto.itens].sort((a, b) => a.ordem - b.ordem) : [];
  const lote = itens.filter((i) => i.agendaId).map(linhaDoItemServidor);
  const principal = itens.find((i) => i.agendaId && i.agendaId === dto?.agendaPrincipalId) ?? itens[0];
  const retorno = String(dto?.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno';
  return {
    agendaId: dto?.agendaPrincipalId ?? null,
    lote,
    fromAgendaSlot: false,
    procedimentoNome: principal ? linhaDoItemServidor(principal).procedimentoNome : '',
    catalogoProcedimentoSaudeId: principal?.catalogoProcedimentoSaudeId ?? null,
    isAgendaRetorno: retorno,
    tipoProcedimentoCodigo: dto?.tipoProcedimentoCodigo ?? null,
    procedimentoFeitoOrigemId: dto?.procedimentoFeitoOrigemId ?? null,
    initialModule: dto?.modulo || 'hub',
    consultaDoServidor: dto,
  };
}

/**
 * Horário de início ao entrar na consulta: o `iniciadoEm` da consulta do servidor (o aparelho não guarda o horário
 * com o CPF). Entrada nova e retorno aberto na mesma consulta do dia gravam esse horário; retomar a mesma consulta no
 * dia sem ser retorno mantém o que já está na memória (`undefined`). "Agora" só vale sem a consulta do servidor.
 * @param {{ retomadaNoMesmoDia: boolean, retorno: boolean, consultaDoServidor?: { iniciadoEm?: string } | null,
 *   agoraIso: string }} entrada
 * @returns {string | undefined}
 */
export function inicioAoEntrarNaConsulta({ retomadaNoMesmoDia, retorno, consultaDoServidor, agoraIso }) {
  if (retomadaNoMesmoDia && !retorno) return undefined;
  return consultaDoServidor?.iniciadoEm || agoraIso;
}

const TEXTO_SALVO = 'Rascunho salvo com sucesso.';
const TEXTO_GUARDADO = 'Rascunho guardado neste aparelho. Será enviado quando a conexão voltar.';
const TEXTO_ITEM_NOVO = 'Procedimento novo guardado neste aparelho. Será enviado quando você abrir esta consulta de novo.';

const ORIGEM_DAS_FOTOS = { avaliacao: ' de avaliação', procedimento: ' do procedimento', resultado: ' do resultado' };

/**
 * "Não foi possível enviar 1 foto. Ela não fica guardada: envie de novo." (plural: "N fotos. Elas não ficam guardadas").
 * Com `origem` ('avaliacao' | 'procedimento' | 'resultado'): "1 foto de avaliação" / "2 fotos do procedimento" /
 * "1 foto do resultado" (a seção "Foto do resultado" do Retorno). Sem origem: como antes.
 * @param {number} n
 * @param {'avaliacao' | 'procedimento' | 'resultado'} [origem]
 */
export function textoDasFotosNaoEnviadas(n, origem) {
  const deOnde = Object.hasOwn(ORIGEM_DAS_FOTOS, origem) ? ORIGEM_DAS_FOTOS[origem] : '';
  return n === 1
    ? `Não foi possível enviar 1 foto${deOnde}. Ela não fica guardada: envie de novo.`
    : `Não foi possível enviar ${n} fotos${deOnde}. Elas não ficam guardadas: envie de novo.`;
}

const RETORNO_SEM_ENCERRAR = 'O retorno foi registrado, mas a consulta ainda não foi encerrada';
/** Mesmo valor de `CODIGO_ENVIO_PENDENTE` (useAtendimentoServidor.js); importar de lá seria um ciclo de import. */
const CODIGO_ENVIO_PENDENTE = 'ENVIO_PENDENTE';

/**
 * Toast do "Concluir Retorno" quando o retorno já foi finalizado e o encerrar da consulta falhou (B-42 rodada 4):
 * nunca diz que deu certo.
 * - recusa ENVIO_PENDENTE, erro sem status (rede), 401, 408, 429 e 5xx: "… Verifique a conexão e clique em Concluir
 *   Retorno de novo.";
 * - outro 4xx com mensagem do servidor: "…: <mensagem>"; sem mensagem: "… Clique em Concluir Retorno de novo.".
 * @param {{ status?: number, codigo?: string } | null | undefined} err
 * @param {string} [mensagemDoServidor] a mensagem limpa (sem "[HTTP n]"), já extraída por quem chama
 *   (`getApiErrorDetail` de services/api.js), para este módulo continuar sem imports.
 */
export function textoRetornoSemEncerrar(err, mensagemDoServidor) {
  const status = err != null && typeof err === 'object' ? err.status : undefined;
  const conexao =
    err?.codigo === CODIGO_ENVIO_PENDENTE ||
    status == null ||
    status === 401 ||
    status === 408 ||
    status === 429 ||
    status >= 500;
  if (conexao) return `${RETORNO_SEM_ENCERRAR}. Verifique a conexão e clique em Concluir Retorno de novo.`;
  const msg = String(mensagemDoServidor ?? '').trim();
  return msg ? `${RETORNO_SEM_ENCERRAR}: ${msg}` : `${RETORNO_SEM_ENCERRAR}. Clique em Concluir Retorno de novo.`;
}

const TEXTO_ABANDONADA ='Esta consulta foi encerrada por falta de atividade.';

/**
 * Toast da consulta abandonada com a tela aberta. Com `n` alterações deste aparelho que não chegaram ao servidor:
 * n=1 "… 1 alteração feita neste aparelho não chegou ao servidor."; n≥2 "… N alterações … não chegaram …"; n=0 só a base.
 * @param {number} n
 */
export function textoDaConsultaAbandonada(n) {
  const qtd = Math.max(0, Math.trunc(Number(n) || 0));
  if (qtd === 0) return TEXTO_ABANDONADA;
  if (qtd === 1) return `${TEXTO_ABANDONADA} 1 alteração feita neste aparelho não chegou ao servidor.`;
  return `${TEXTO_ABANDONADA} ${qtd} alterações feitas neste aparelho não chegaram ao servidor.`;
}

/**
 * Toast do "Apenas Sair", só com o que é verdade:
 * - `modulo`/`item` que sobraram na fila saem sozinhos quando a conexão volta (fila em segundo plano);
 * - `itemNovo` só sai quando a pessoa abrir esta consulta de novo (precisa da sessão hidratada);
 * - foto que não subiu não fica guardada em lugar nenhum: a pessoa precisa enviar de novo.
 * Sem pendência nenhuma: "Rascunho salvo com sucesso.". Fila vazia com foto que falhou: o salvo + a frase das fotos.
 * @param {{ filaEsvaziou: boolean, tiposPendentes?: string[], fotosNaoEnviadas?: number }} situacao
 */
export function textoDoApenasSair({ filaEsvaziou, tiposPendentes = [], fotosNaoEnviadas = 0 }) {
  const tipos = Array.isArray(tiposPendentes) ? tiposPendentes : [];
  const itemNovo = tipos.includes('itemNovo');
  // Sobrou envio que não é item novo (ou a fila não esvaziou sem dizer o quê): o rascunho de texto.
  const texto = tipos.some((t) => t !== 'itemNovo') || (!filaEsvaziou && tipos.length === 0);
  const fotos = Math.max(0, Math.trunc(Number(fotosNaoEnviadas) || 0));
  const partes = [];
  if (texto) partes.push(TEXTO_GUARDADO);
  if (itemNovo) partes.push(TEXTO_ITEM_NOVO);
  if (partes.length === 0) partes.push(TEXTO_SALVO);
  if (fotos > 0) partes.push(textoDasFotosNaoEnviadas(fotos));
  return partes.join(' ');
}
