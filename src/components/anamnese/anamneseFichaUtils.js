import { canalCatalogoPublico, isTipoCatalogo, isTipoCatalogoMulti } from './anamneseTipoLabels';

export function buildPerguntaTipoById(ficha) {
  const map = {};
  for (const item of ficha?.itens ?? []) {
    const id = item.pergunta?.id ?? item.perguntaId;
    const tipo = item.pergunta?.tipoResposta ?? item.pergunta?.tipo_resposta;
    if (id != null && tipo) map[String(id)] = tipo;
  }
  return map;
}

/** Converte resposta da API para o estado usado em `DynamicQuestion`. */
export function mapApiRespostaToEstado(r) {
  const perguntaId = r.perguntaId ?? r.pergunta?.id;
  if (perguntaId == null) return null;
  const row = { perguntaId };
  if (r.respostaTexto != null && r.respostaTexto !== '') row.respostaTexto = r.respostaTexto;
  if (r.respostaNumero !== null && r.respostaNumero !== undefined && r.respostaNumero !== '') {
    const n = typeof r.respostaNumero === 'number' ? r.respostaNumero : Number(r.respostaNumero);
    row.respostaNumero = Number.isFinite(n) ? n : null;
  }
  if (r.respostaBoolean === true || r.respostaBoolean === false) row.respostaBoolean = r.respostaBoolean;
  if (r.respostaTrivalente) row.respostaTrivalente = r.respostaTrivalente;
  if (r.declarouAusencia === true) row.declarouAusencia = true;
  const po = r.perguntaOpcaoId ?? r.opcaoId ?? r.pergunta_opcao_id;
  if (po != null && po !== '') row.perguntaOpcaoId = po;
  const multi = r.opcoesSelecionadas ?? r.opcoes_selecionadas;
  if (Array.isArray(multi) && multi.length > 0) {
    row.opcoesSelecionadas = multi.map((x) => (typeof x === 'object' && x != null && x.id != null ? x.id : x));
  }
  if (r.reacaoAdversaId) {
    row.reacaoAdversaId = r.reacaoAdversaId;
    row.catalogoItens = [{
      id: r.reacaoAdversaId,
      nome: r.opcaoSelecionada || r.reacaoAdversaNome || String(r.reacaoAdversaId),
      fonte: 'catalogo',
    }];
    return row;
  }
  const catalogId =
    r.alergiaCatalogoId
    || r.principioAtivoId
    || r.medicamentoCatalogoId
    || r.antecedenteCatalogoId;
  if (catalogId) {
    row.catalogoItens = [{ id: catalogId, nome: r.catalogoNome || r.opcaoSelecionada || String(catalogId), fonte: 'catalogo' }];
  }
  return row;
}

/**
 * Agrupa respostas da API por perguntaId.
 * Back devolve múltipla escolha como N linhas (perguntaOpcaoId cada) — evita sobrescrever no forEach.
 */
export function mergeApiRespostasToMap(respostasApi, perguntaTipoById = {}) {
  const map = {};
  const opcaoAccum = new Map();

  for (const r of respostasApi || []) {
    const mapped = mapApiRespostaToEstado(r);
    if (!mapped) continue;
    const key = String(mapped.perguntaId);

    if (Array.isArray(mapped.opcoesSelecionadas) && mapped.opcoesSelecionadas.length > 0) {
      const prev = map[key];
      const ids = new Set((prev?.opcoesSelecionadas || []).map(String));
      mapped.opcoesSelecionadas.forEach((id) => ids.add(String(id)));
      map[key] = { perguntaId: mapped.perguntaId, opcoesSelecionadas: [...ids] };
      continue;
    }

    const tipoPergunta = perguntaTipoById[key] || '';
    const isCatMulti = isTipoCatalogoMulti(tipoPergunta);

    if (mapped.declarouAusencia) {
      map[key] = { perguntaId: mapped.perguntaId, declarouAusencia: true };
      continue;
    }

    if (mapped.respostaTrivalente) {
      map[key] = { perguntaId: mapped.perguntaId, respostaTrivalente: mapped.respostaTrivalente };
      continue;
    }

    if (tipoPergunta === 'catalogo_reacao' && mapped.reacaoAdversaId) {
      map[key] = {
        perguntaId: mapped.perguntaId,
        reacaoAdversaId: mapped.reacaoAdversaId,
        catalogoItens: mapped.catalogoItens || [],
      };
      continue;
    }

    if (isCatMulti) {
      const prev = map[key] || { perguntaId: mapped.perguntaId, catalogoItens: [], textosLivres: [] };
      const catalogoItens = [...(prev.catalogoItens || [])];
      const textosLivres = [...(prev.textosLivres || [])];
      if (mapped.catalogoItens) {
        for (const it of mapped.catalogoItens) {
          if (!catalogoItens.some((c) => String(c.id) === String(it.id))) catalogoItens.push(it);
        }
      }
      if (mapped.respostaTexto) {
        textosLivres.push({ idLocal: `api-${key}-${textosLivres.length}`, texto: mapped.respostaTexto, fonte: 'livre' });
      }
      map[key] = { perguntaId: mapped.perguntaId, catalogoItens, textosLivres };
      continue;
    }

    const hasScalar =
      (mapped.respostaTexto != null && mapped.respostaTexto !== '')
      || (mapped.respostaNumero != null && mapped.respostaNumero !== '')
      || mapped.respostaBoolean === true
      || mapped.respostaBoolean === false;

    if (hasScalar) {
      map[key] = mapped;
      continue;
    }

    if (mapped.perguntaOpcaoId != null && mapped.perguntaOpcaoId !== '') {
      if (!opcaoAccum.has(key)) {
        const tipoResposta =
          r.tipoResposta
          ?? r.tipo_resposta
          ?? r.pergunta?.tipoResposta
          ?? r.pergunta?.tipo_resposta
          ?? '';
        opcaoAccum.set(key, { perguntaId: mapped.perguntaId, opcoes: [], tipoResposta });
      }
      const acc = opcaoAccum.get(key);
      const idStr = String(mapped.perguntaOpcaoId);
      if (!acc.opcoes.includes(idStr)) acc.opcoes.push(idStr);
    }
  }

  for (const [key, { perguntaId, opcoes, tipoResposta }] of opcaoAccum) {
    if (map[key]) continue;
    const tipo = perguntaTipoById[key] ?? tipoResposta ?? '';
    if (tipo === 'multipla_escolha') {
      map[key] = { perguntaId, opcoesSelecionadas: opcoes };
    } else if (opcoes.length === 1) {
      map[key] = { perguntaId, perguntaOpcaoId: opcoes[0] };
    } else if (opcoes.length > 1) {
      map[key] = { perguntaId, opcoesSelecionadas: opcoes };
    }
  }

  return map;
}

/** Escolha única/múltipla compacta: ≤4 opções e labels ≤24 chars → meia coluna em md+. */
function isCompactChoice(alternativas) {
  if (!Array.isArray(alternativas) || alternativas.length === 0) return false;
  return alternativas.length <= 4 && alternativas.every((a) => (a.alternativa || '').length <= 24);
}

/** true = pergunta ocupa largura total no grid md:2-cols (mobile sempre 1 coluna). */
export function isFullWidthItem(item) {
  const tipo = item.pergunta?.tipoResposta;
  if (tipo === 'texto') return true;
  if (isTipoCatalogo(tipo)) return true;
  if (tipo === 'escolha_unica' || tipo === 'multipla_escolha') {
    return !isCompactChoice(item.pergunta?.alternativas);
  }
  return false;
}

/** Agrupa itens por categoriaNome preservando a ordem interna. */
export function groupItensByCategoria(itens) {
  const groups = [];
  const seen = new Map();
  for (const item of itens) {
    const key = item.pergunta?.categoriaNome || '';
    if (!seen.has(key)) {
      const arr = [];
      seen.set(key, arr);
      groups.push({ categoriaNome: key, itens: arr });
    }
    seen.get(key).push(item);
  }
  return groups;
}

/** true se a resposta tem valor preenchido (critérios alinhados ao back). */
export function isRespostaPreenchida(pergunta, resposta) {
  if (!pergunta || !resposta) return false;
  const tipo = pergunta.tipoResposta;
  if (tipo === 'texto') {
    return Boolean(String(resposta.respostaTexto ?? '').trim());
  }
  if (tipo === 'numero') {
    return resposta.respostaNumero != null && resposta.respostaNumero !== '';
  }
  if (tipo === 'booleano') {
    return resposta.respostaBoolean === true || resposta.respostaBoolean === false;
  }
  if (tipo === 'escolha_unica') {
    const po = resposta.perguntaOpcaoId;
    return po != null && po !== '';
  }
  if (tipo === 'multipla_escolha') {
    return Array.isArray(resposta.opcoesSelecionadas) && resposta.opcoesSelecionadas.length > 0;
  }
  if (tipo === 'sim_nao_naosei') {
    return Boolean(resposta.respostaTrivalente);
  }
  if (tipo === 'catalogo_reacao') {
    if (resposta.declarouAusencia) return true;
    return Boolean(resposta.reacaoAdversaId)
      || (Array.isArray(resposta.catalogoItens) && resposta.catalogoItens.length > 0);
  }
  if (isTipoCatalogoMulti(tipo)) {
    if (resposta.declarouAusencia) return true;
    const hasCat = Array.isArray(resposta.catalogoItens) && resposta.catalogoItens.length > 0;
    const hasTxt = Array.isArray(resposta.textosLivres) && resposta.textosLivres.some((t) => String(t.texto || '').trim());
    return hasCat || hasTxt;
  }
  return false;
}

/** Monta N linhas XOR do POST autenticado. */
export function buildRespostaApiRows(pergunta, resposta) {
  if (!isRespostaPreenchida(pergunta, resposta)) return [];
  const perguntaId = resposta.perguntaId ?? pergunta.id;
  const tipo = pergunta.tipoResposta;

  if (tipo === 'texto') {
    return [{ perguntaId, respostaTexto: resposta.respostaTexto }];
  }
  if (tipo === 'numero') {
    return [{ perguntaId, respostaNumero: resposta.respostaNumero }];
  }
  if (tipo === 'booleano') {
    return [{ perguntaId, respostaBoolean: resposta.respostaBoolean }];
  }
  if (tipo === 'escolha_unica') {
    return [{ perguntaId, perguntaOpcaoId: resposta.perguntaOpcaoId }];
  }
  if (tipo === 'multipla_escolha') {
    return [{ perguntaId, opcoesSelecionadas: resposta.opcoesSelecionadas }];
  }
  if (tipo === 'sim_nao_naosei') {
    return [{ perguntaId, respostaTrivalente: resposta.respostaTrivalente }];
  }
  if (tipo === 'catalogo_reacao') {
    if (resposta.declarouAusencia) {
      return [{ perguntaId, declarouAusencia: true }];
    }
    const reacaoId = resposta.reacaoAdversaId ?? resposta.catalogoItens?.[0]?.id;
    if (reacaoId) return [{ perguntaId, reacaoAdversaId: reacaoId }];
    return [];
  }
  if (isTipoCatalogoMulti(tipo)) {
    if (resposta.declarouAusencia) {
      return [{ perguntaId, declarouAusencia: true }];
    }
    const rows = [];
    const fkField =
      tipo === 'catalogo_alergia' ? 'alergiaCatalogoId'
      : tipo === 'catalogo_principio_ativo' ? 'principioAtivoId'
      : tipo === 'catalogo_medicamento' ? 'medicamentoCatalogoId'
      : 'antecedenteCatalogoId';
    for (const it of resposta.catalogoItens || []) {
      const row = { perguntaId, [fkField]: it.id };
      if (tipo === 'catalogo_principio_ativo' && it.medicamentoDeclaradoId) {
        row.medicamentoDeclaradoId = it.medicamentoDeclaradoId;
      }
      rows.push(row);
    }
    for (const t of resposta.textosLivres || []) {
      const texto = String(t.texto || '').trim();
      if (texto) rows.push({ perguntaId, respostaTexto: texto });
    }
    return rows;
  }
  return [];
}

/** @deprecated use buildRespostaApiRows — uma pergunta de catálogo vira N linhas. */
export function buildRespostaApiRow(pergunta, resposta) {
  const rows = buildRespostaApiRows(pergunta, resposta);
  return rows.length === 1 ? rows[0] : rows.length > 1 ? rows : null;
}

/** Valor do Map público (escalar legado ou List `{tipo,valor}`). */
export function serializeRespostaPublica(pergunta, resposta) {
  if (!isRespostaPreenchida(pergunta, resposta)) return undefined;
  const tipo = pergunta.tipoResposta || pergunta.tipo;
  if (tipo === 'texto') return resposta.respostaTexto;
  if (tipo === 'numero') return resposta.respostaNumero;
  if (tipo === 'booleano') return resposta.respostaBoolean;
  if (tipo === 'escolha_unica') return resposta.perguntaOpcaoId;
  if (tipo === 'multipla_escolha') return resposta.opcoesSelecionadas;
  if (tipo === 'sim_nao_naosei') {
    return [{ tipo: 'trivalente', valor: resposta.respostaTrivalente }];
  }
  if (tipo === 'catalogo_reacao') {
    if (resposta.declarouAusencia) {
      return [{ tipo: 'declarou_ausencia', valor: true }];
    }
    const reacaoId = resposta.reacaoAdversaId ?? resposta.catalogoItens?.[0]?.id;
    if (reacaoId) return [{ tipo: 'reacao', valor: reacaoId }];
    return undefined;
  }
  if (isTipoCatalogoMulti(tipo)) {
    if (resposta.declarouAusencia) {
      return [{ tipo: 'declarou_ausencia', valor: true }];
    }
    const canal = canalCatalogoPublico(tipo);
    const list = [];
    for (const it of resposta.catalogoItens || []) {
      const entry = { tipo: canal, valor: it.id };
      if (tipo === 'catalogo_principio_ativo' && it.medicamentoDeclaradoId) {
        entry.medicamento_declarado_id = it.medicamentoDeclaradoId;
      }
      list.push(entry);
    }
    for (const t of resposta.textosLivres || []) {
      const texto = String(t.texto || '').trim();
      if (texto) list.push({ tipo: 'texto', valor: texto });
    }
    return list;
  }
  return undefined;
}

export function toPerguntaFromPublica(p) {
  return {
    id: p.perguntaId,
    descricao: p.texto,
    tipoResposta: p.tipo,
    perguntaPaiId: p.perguntaPaiId,
    tipoAntecedentePessoalId: p.tipoAntecedentePessoalId,
    tipoAntecedenteCodigo: p.tipoAntecedenteCodigo,
    antecedenteCatalogoId: p.antecedenteCatalogoId,
    obrigatorio: p.obrigatorio,
    prioridade: p.alerta ? 'ALERTA' : 'NORMAL',
    alternativas: (p.opcoes || []).map((o, i) => ({
      id: o.opcaoId,
      alternativa: o.texto,
      ordem: i,
    })),
  };
}

/** Itens da ficha ordenados por `ordem`. */
export function sortFichaItens(ficha) {
  return [...(ficha?.itens || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
