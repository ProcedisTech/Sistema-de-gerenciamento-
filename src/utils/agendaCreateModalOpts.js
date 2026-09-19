import {
  TIPO_ATENDIMENTO_CONSULTA,
  TIPO_ATENDIMENTO_PROCEDIMENTO,
  TIPO_ATENDIMENTO_RETORNO,
} from './agendaTipoProcedimento.js';

export function resolveAgendaCreateModalPatch(opts = {}, { catIds = [], baseData = '' } = {}) {
  const isModoRetorno = Boolean(opts.modoRetorno);
  const isConsultaClinica = opts.tipoAtendimento === TIPO_ATENDIMENTO_CONSULTA;
  const semDataInicial = Boolean(opts.semDataInicial);
  const dataPrevia = opts.data || opts.dataAgendamento || (semDataInicial ? '' : baseData);
  return {
    catalogoProcedimentoSaudeIds: isConsultaClinica ? [] : catIds,
    data: dataPrevia,
    tipoAtendimento: isModoRetorno
      ? TIPO_ATENDIMENTO_RETORNO
      : isConsultaClinica
        ? TIPO_ATENDIMENTO_CONSULTA
        : TIPO_ATENDIMENTO_PROCEDIMENTO,
    tipoAtendimentoLocked: isModoRetorno || isConsultaClinica,
    agendamentoTipoRetorno: isModoRetorno,
  };
}
