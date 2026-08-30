/** Categoria visível para o sexo da paciente. Sexo N/null mostra tudo. */
export function categoriaVisivelParaSexo(sexoAplicavel, pacienteSexo) {
  const cat = String(sexoAplicavel || '').trim().toUpperCase();
  if (!cat || cat === 'N') return true;
  const sexo = String(pacienteSexo || '').trim().toUpperCase();
  if (!sexo || sexo === 'N') return true;
  return cat === sexo;
}

export const TIPOS_PAI_CONDICIONAL = ['sim_nao_naosei', 'booleano'];

export function ehTipoPaiCondicional(tipo) {
  return TIPOS_PAI_CONDICIONAL.includes(tipo);
}

export function isPaiSim(resposta) {
  if (!resposta) return false;
  if (resposta.respostaTrivalente != null) {
    return resposta.respostaTrivalente === 'SIM';
  }
  return resposta.respostaBoolean === true;
}

export function perguntaFilhaVisivel(pergunta, respostas = {}) {
  const paiId = pergunta?.perguntaPaiId;
  if (paiId == null || paiId === '') return true;
  const pai = respostas[paiId] ?? respostas[String(paiId)];
  return isPaiSim(pai);
}

export function filhasDe(perguntas, paiId) {
  const key = String(paiId);
  return (perguntas || []).filter((p) => p && String(p.perguntaPaiId) === key);
}

/**
 * Atualiza o mapa de respostas e apaga filhas se o pai deixar de ser SIM.
 */
/**
 * Ids de perguntas visíveis no portal (sexo já filtrado no modelo + condicional).
 * Inclui perguntas vazias — define o escopo hint do POST público.
 */
export function collectPerguntaIdsVisiveis(categorias, respostas, mapPergunta) {
  const ids = [];
  for (const cat of categorias || []) {
    for (const raw of cat.perguntas || []) {
      const p = typeof mapPergunta === 'function' ? mapPergunta(raw) : raw;
      if (!p?.id && p?.perguntaId == null) continue;
      const pergunta = p.id != null ? p : { ...p, id: p.perguntaId };
      if (!perguntaFilhaVisivel(pergunta, respostas)) continue;
      ids.push(pergunta.id);
    }
  }
  return ids;
}

export function aplicarMudancaResposta(respostas, perguntas, nextResposta) {
  const key = String(nextResposta.perguntaId);
  const next = { ...respostas, [key]: { ...nextResposta, perguntaId: nextResposta.perguntaId } };
  const pergunta = (perguntas || []).find((p) => p && String(p.id) === key);
  const tipo = pergunta?.tipoResposta || pergunta?.tipo;
  if (ehTipoPaiCondicional(tipo) && !isPaiSim(nextResposta)) {
    for (const filha of filhasDe(perguntas, nextResposta.perguntaId)) {
      delete next[String(filha.id)];
    }
  }
  return next;
}
