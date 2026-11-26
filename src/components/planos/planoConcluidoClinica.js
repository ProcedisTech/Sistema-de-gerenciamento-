import { isItemCancelado, isItemFinalizado } from '../../utils/planejamentoStatusUi.js';

export function loteConcluiuPlano(respostas) {
  const list = Array.isArray(respostas) ? respostas : [];
  return list.some((r) => r && r.planoConcluidoNesteFinalizar === true);
}

/**
 * Extrai o UUID do planejamento a partir das respostas do lote ou do contexto da jornada.
 * Retorna null quando não estiver presente (ex.: EncerramentoResultadoDTO.Procedimento), permitindo fallback via API.
 */
export function extrairPlanejamentoIdDoLote(respostas, ctx = null) {
  const list = Array.isArray(respostas) ? respostas : [];
  const itemConcluiu = list.find((r) => r && r.planoConcluidoNesteFinalizar === true) || null;
  const candidatos = [
    itemConcluiu?.planejamentoId,
    itemConcluiu?.planoId,
    ctx?.planejamentoId,
    ctx?.id,
    ctx?.planoId,
  ];
  for (const cand of candidatos) {
    const str = String(cand ?? '').trim();
    if (str) return str;
  }
  return null;
}

const STATUS_AGENDA_ABERTA = new Set(['pendente', 'confirmado', 'aguardando_confirmacao']);

function itemTemSessaoAberta(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.sessaoAtiva?.agendaId || item.sessaoRetornoAtiva?.agendaId) return true;
  if (Array.isArray(item.sessoes)) {
    return item.sessoes.some((s) => {
      const st = String(s?.statusCodigo ?? s?.status ?? '').trim().toLowerCase();
      return STATUS_AGENDA_ABERTA.has(st);
    });
  }
  return false;
}

/**
 * Checa se um plano ativo está 100% executado e sem sessões/retornos pendentes em aberto,
 * pronto para revisão final ou conclusão explícita do profissional.
 */
export function isPlanoProntoParaConcluir(plano) {
  if (!plano || String(plano.statusCodigo ?? '').trim().toLowerCase() !== 'ativo') return false;
  const itens = Array.isArray(plano.itens) ? plano.itens : [];
  if (itens.length === 0) return false;
  const naoCancelados = itens.filter(
    (item) => !isItemCancelado(item?.statusItem ?? item?.statusItemNome ?? item?.statusCodigo),
  );
  if (naoCancelados.length === 0) return false;
  return naoCancelados.every((item) => {
    const statusOk = isItemFinalizado(item?.statusItem ?? item?.statusItemNome ?? item?.statusCodigo);
    return statusOk && !itemTemSessaoAberta(item);
  });
}

/** Fecha Encerrar/Sair antes do pop-up — um diálogo só na cena. */
export function aplicarCenaAntesDoPlanoConcluido({
  setEncerrarConsultaOpen,
  setFinishingMode,
} = {}) {
  setEncerrarConsultaOpen?.(false);
  setFinishingMode?.(null);
}
