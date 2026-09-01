/**

 * Estado de UI para solicitar assinatura do paciente (fato, não status).

 */

export function resolverEstadoAssinatura({

  assinada,

  envioStatus,

  preenchimentoId,

  pacienteId,

  imutavel,

  processandoResposta = false,

}) {

  const envioAtivo = envioStatus === 'PENDENTE';

  const concluido = Boolean(assinada);

  const podeSolicitar = Boolean(

    pacienteId && preenchimentoId && !assinada && !imutavel && !envioAtivo,

  );

  const aguardandoPaciente = Boolean(!assinada && envioAtivo && !processandoResposta);

  const mostrarBadgeAtualizando = Boolean(processandoResposta && !assinada);

  return { podeSolicitar, aguardandoPaciente, concluido, envioAtivo, mostrarBadgeAtualizando };

}

