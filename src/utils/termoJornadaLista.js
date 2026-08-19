import { stripHtml } from './stripHtml.js';

export const ROTULO_DROPDOWN_TERMOS =
  'Selecione os termos que deseja assinar nesta consulta';

/** Contagem laranja do catálogo: não usar. Obrigatório aparece só na fila exigida. */
export function mostrarContagemPendentesCatalogo() {
  return false;
}

/** Selo da linha do dropdown: Obrigatório só se está na fila exigida. */
export function seloLinhaTermo(termoId, idsFilaExigida) {
  if (termoId == null) return null;
  const exigidos =
    idsFilaExigida instanceof Set
      ? idsFilaExigida
      : new Set([...(idsFilaExigida || [])].map(String));
  return exigidos.has(String(termoId)) ? 'OBRIGATORIO' : null;
}

export function linhasDropdownTermos(termos, idsFilaExigida) {
  const exigidos =
    idsFilaExigida instanceof Set
      ? idsFilaExigida
      : new Set([...(idsFilaExigida || [])].map(String));
  return (termos || []).map((t) => ({
    id: String(t.id),
    titulo: t.titulo ?? t.title ?? '—',
    preview: previewTermoLista(t.conteudo ?? t.content ?? '') || '—',
    selo: seloLinhaTermo(t.id, exigidos),
  }));
}

export function idsPendentesSemAssinadosNestaJornada(pendentesIds, termosAssinados) {
  const signed = idsAssinadosNestaJornada(termosAssinados);
  return (pendentesIds || [])
    .map((id) => (id != null ? String(id) : ''))
    .filter((id) => id && !signed.has(id));
}

export function mesclarFilaExigida(pendentesAtuais, idsFilaExigida, termosAssinados) {
  const signed = idsAssinadosNestaJornada(termosAssinados);
  const next = new Set(idsPendentesSemAssinadosNestaJornada(pendentesAtuais, termosAssinados));
  for (const raw of idsFilaExigida || []) {
    const id = raw != null ? String(raw) : '';
    if (id && !signed.has(id)) next.add(id);
  }
  return Array.from(next);
}

export function proximoTermoPendente(pendentesIds, termosAssinados, idsRemover = []) {
  const skip = new Set([...(idsRemover || [])].filter((id) => id != null).map(String));
  return (
    idsPendentesSemAssinadosNestaJornada(pendentesIds, termosAssinados).find((id) => !skip.has(id)) ||
    null
  );
}

/**
 * IDs de termos com ASSINADO nesta visita (não o histórico do paciente).
 * RECUSADO nesta jornada continua selecionável.
 */
export function idsAssinadosNestaJornada(termosAssinados) {
  const ids = new Set();
  for (const item of termosAssinados || []) {
    const status = item?.resultadoCompleto?.statusCodigo;
    const recusado = status === 'RECUSADO' || Boolean(item?.resultadoCompleto?.recusadoEm);
    if (recusado) continue;
    if (item?.termoId != null && String(item.termoId).trim() !== '') {
      ids.add(String(item.termoId));
    }
  }
  return ids;
}

/** Itens do dropdown: catálogo filtrado menos os já assinados nesta jornada. */
export function termosDropdownSelecionaveis(termosFiltradosBusca, idsAssinadosJornada) {
  const signed = idsAssinadosJornada instanceof Set ? idsAssinadosJornada : new Set();
  return (termosFiltradosBusca || []).filter((t) => !signed.has(String(t.id)));
}

export function previewTermoLista(conteudo, max = 96) {
  const text = stripHtml(conteudo).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, max);
}

/** Zera estado React de termos da visita (jornada nova / reset). */
export function clearTermosJornadaState(journeyState) {
  if (!journeyState) return;
  journeyState.setTermosAssinados([]);
  journeyState.setTermosPendentesIds([]);
  journeyState.setTermoSelecionadoId(null);
}
