import { isItemFinalizado, isItemCancelado } from './planejamentoStatusUi.js';

/** Contagem de sessões realizadas vs total de itens não-cancelados do plano. */
export function calcSessoesPlano(itens) {
  const list = Array.isArray(itens) ? itens : [];
  const naoCancelados = list.filter(
    (item) => !isItemCancelado(item?.statusItem ?? item?.statusItemNome),
  );
  const total = naoCancelados.length;
  const feitas = naoCancelados.filter((item) =>
    isItemFinalizado(item?.statusItem ?? item?.statusItemNome),
  ).length;
  return { feitas, total };
}

/** Data de referência para card de histórico. */
export function dataReferenciaHistorico(plano) {
  if (plano?.statusCodigo === 'concluido') {
    return plano.concluidoEm ?? plano.criadoEm ?? null;
  }
  if (plano?.statusCodigo === 'encerrado') {
    return plano.encerradoEm ?? plano.criadoEm ?? null;
  }
  return plano?.criadoEm ?? null;
}

/** Motivo de encerramento — leitura defensiva; hoje provavelmente null. */
export function motivoEncerramentoPlano(plano) {
  return (
    plano?.motivoEncerramento ??
    plano?.motivoEncerramentoTexto ??
    plano?.observacaoEncerramento ??
    null
  );
}
