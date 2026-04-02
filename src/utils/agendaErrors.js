/**
 * Mensagens amigáveis para conflitos da API de compromissos no slot (409).
 */
export function formatAgendamentoApiError(err) {
  const status = err?.status;
  const msg = String(err?.message || '').toLowerCase();

  if (status === 409) {
    if (msg.includes('delete') || msg.includes('apag') || msg.includes('procedimento')) {
      return 'Não é possível remover: já existe procedimento feito ligado a este agendamento.';
    }
    return 'Já existe o mesmo paciente e procedimento neste horário. Escolha outro paciente, outro procedimento ou outro horário.';
  }
  return err?.message || 'Não foi possível concluir a operação.';
}
