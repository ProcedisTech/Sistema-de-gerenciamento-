/**
 * Estado de UI para solicitar assinatura do paciente (fato, não status).
 */
export function resolverEstadoAssinatura({
  assinada,
  envioStatus,
  preenchimentoId,
  pacienteId,
  imutavel,
}) {
  const envioAtivo = envioStatus === 'PENDENTE';
  const podeSolicitar = Boolean(
    pacienteId && preenchimentoId && !assinada && !imutavel && !envioAtivo,
  );
  const aguardandoPaciente = Boolean(!assinada && envioAtivo);
  const concluido = Boolean(assinada || envioStatus === 'CONCLUIDO');
  return { podeSolicitar, aguardandoPaciente, concluido, envioAtivo };
}
