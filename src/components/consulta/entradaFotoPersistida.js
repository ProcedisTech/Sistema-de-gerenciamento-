/**
 * Monta a entrada para `replaceEvaluationCapturedPhotoAt` após upload na galeria
 * sem espalhar `...currentPh` (evita stale closure de pontos/mapaOverlay)
 * e sem deixar chaves com valor `undefined` (evita apagar valores no merge do hook).
 */
export function montarEntradaFotoPersistida({ res, opts = {}, metaAtual = {} }) {
  const entrada = {
    uploaded: true,
  };

  const id = res?.id || res?.fotoId || opts?.fotoId;
  if (id) {
    entrada.id = id;
    entrada.fotoId = id;
  }

  entrada.meta = {
    ...(metaAtual || {}),
    ...(id ? { fotoId: id } : {}),
  };

  if (opts?.destinoAvaliacao) {
    entrada.destinoAvaliacao = opts.destinoAvaliacao;
  }
  if (opts?.planejamentoId) {
    entrada.planejamentoId = opts.planejamentoId;
  }
  if (opts?.planejamentoItemId) {
    entrada.planejamentoItemId = opts.planejamentoItemId;
  }

  return entrada;
}
