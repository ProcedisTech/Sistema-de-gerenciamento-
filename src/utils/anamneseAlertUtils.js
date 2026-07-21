/** Extrai o valor legível de uma resposta de anamnese, independente do tipo de pergunta. */
export function renderRespostaValue(resp) {
  if (resp.opcaoSelecionada) return resp.opcaoSelecionada;
  if (Array.isArray(resp.opcoesSelecionadasLabels) && resp.opcoesSelecionadasLabels.length > 0) {
    return resp.opcoesSelecionadasLabels.join(', ');
  }
  if (resp.respostaTexto) return resp.respostaTexto;
  if (resp.respostaNumero !== null && resp.respostaNumero !== undefined) return String(resp.respostaNumero);
  if (resp.respostaBoolean === true) return 'Sim';
  if (resp.respostaBoolean === false) return 'Não';
  return '-';
}

/** Resposta cuja pergunta foi marcada como alerta na ficha (ALERTA / alert). */
export function isRespostaPrioridadeAlerta(resp) {
  const p = resp?.pergunta;
  const pr = p?.prioridade ?? resp?.prioridade ?? resp?.priority ?? p?.priority;
  if (pr == null || pr === '') return false;
  const s = String(pr).trim().toLowerCase();
  return pr === 'ALERTA' || s === 'alerta' || s === 'alert';
}

/** Pergunta em ALERTA só entra no painel se o paciente de fato respondeu algo relevante. */
export function isRespostaPreocupante(resp) {
  if (resp.respostaBoolean === true) return true;
  if (resp.respostaBoolean === false) return false;
  if (resp.respostaTexto != null && String(resp.respostaTexto).trim() !== '') return true;
  if (resp.perguntaOpcaoId != null && resp.perguntaOpcaoId !== '') return true;
  if (Array.isArray(resp.opcoesSelecionadas) && resp.opcoesSelecionadas.length > 0) return true;
  if (Array.isArray(resp.opcoes_selecionadas) && resp.opcoes_selecionadas.length > 0) return true;
  if (resp.respostaNumero != null && resp.respostaNumero !== '') return true;
  return false;
}

export function textoPerguntaResposta(resp) {
  return (resp?.perguntaDescricao || resp?.pergunta?.descricao || 'Pergunta').trim() || 'Pergunta';
}

export function isRespostaCategoria(resp, nomeCategoria) {
  const cat = (
    resp?.pergunta?.categoria?.nome ||
    resp?.pergunta?.categoriaNome ||
    resp?.categoriaName ||
    resp?.categoria?.nome ||
    ''
  ).trim().toLowerCase();
  return cat === nomeCategoria.toLowerCase();
}

export function isRespostaPositiva(resp) {
  if (resp.respostaBoolean === false) return false;
  if (resp.respostaBoolean === true) return true;
  if (resp.respostaTexto && resp.respostaTexto.trim() !== '') return true;
  if (resp.perguntaOpcaoId) return true;
  if (Array.isArray(resp.opcoesSelecionadas) && resp.opcoesSelecionadas.length > 0) return true;
  if (Array.isArray(resp.opcoes_selecionadas) && resp.opcoes_selecionadas.length > 0) return true;
  return false;
}

export function getPerguntaIdFromResp(resp) {
  return resp.perguntaId ?? resp.pergunta?.id ?? null;
}
