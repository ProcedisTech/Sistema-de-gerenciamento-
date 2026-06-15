/** Mapa perguntaId → tipoResposta a partir do GET ficha (item.pergunta embutida). */
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
  const po = r.perguntaOpcaoId ?? r.opcaoId ?? r.pergunta_opcao_id;
  if (po != null && po !== '') row.perguntaOpcaoId = po;
  const multi = r.opcoesSelecionadas ?? r.opcoes_selecionadas;
  if (Array.isArray(multi) && multi.length > 0) {
    row.opcoesSelecionadas = multi.map((x) => (typeof x === 'object' && x != null && x.id != null ? x.id : x));
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
  return false;
}

/** Monta uma linha do POST /anamnese/paciente conforme tipo da pergunta. */
export function buildRespostaApiRow(pergunta, resposta) {
  if (!isRespostaPreenchida(pergunta, resposta)) return null;
  const base = { perguntaId: resposta.perguntaId };
  const tipo = pergunta.tipoResposta;

  if (tipo === 'texto') {
    return { ...base, respostaTexto: resposta.respostaTexto };
  }
  if (tipo === 'numero') {
    return { ...base, respostaNumero: resposta.respostaNumero };
  }
  if (tipo === 'booleano') {
    return { ...base, respostaBoolean: resposta.respostaBoolean };
  }
  if (tipo === 'escolha_unica') {
    return { ...base, perguntaOpcaoId: resposta.perguntaOpcaoId };
  }
  if (tipo === 'multipla_escolha') {
    return { ...base, opcoesSelecionadas: resposta.opcoesSelecionadas };
  }
  return null;
}

/** Itens da ficha ordenados por `ordem`. */
export function sortFichaItens(ficha) {
  return [...(ficha?.itens || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
