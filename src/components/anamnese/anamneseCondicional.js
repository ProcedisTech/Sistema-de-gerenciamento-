/** Categoria visível para o sexo da paciente. Sexo N/null mostra tudo. */
export function categoriaVisivelParaSexo(sexoAplicavel, pacienteSexo) {
  const cat = String(sexoAplicavel || '').trim().toUpperCase();
  if (!cat || cat === 'N') return true;
  const sexo = String(pacienteSexo || '').trim().toUpperCase();
  if (!sexo || sexo === 'N') return true;
  return cat === sexo;
}

export function isPaiSim(resposta) {
  return resposta?.respostaTrivalente === 'SIM';
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
export function aplicarMudancaResposta(respostas, perguntas, nextResposta) {
  const key = String(nextResposta.perguntaId);
  const next = { ...respostas, [key]: { ...nextResposta, perguntaId: nextResposta.perguntaId } };
  const pergunta = (perguntas || []).find((p) => p && String(p.id) === key);
  const tipo = pergunta?.tipoResposta || pergunta?.tipo;
  if (tipo === 'sim_nao_naosei' && nextResposta.respostaTrivalente !== 'SIM') {
    for (const filha of filhasDe(perguntas, nextResposta.perguntaId)) {
      delete next[String(filha.id)];
    }
  }
  return next;
}
