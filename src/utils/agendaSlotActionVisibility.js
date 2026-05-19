/**
 * Chips secundárias do card de agenda (Realizado / Não compareceu / WhatsApp / Reagendar / Cancelar).
 * Botões primários (Confirmar / Iniciar / Reagendar) e Editar ficam no AppointmentCard.
 */
export function getAgendaSlotActionVisibility(status) {
  const s = String(status || '');
  if (s === 'pendente' || s === 'aguardando_confirmacao' || s === 'confirmado') {
    return {
      showRealizado: false,
      showNaoCompareceu: true,
      showWhatsApp: true,
      showReagendar: true,
      showCancelar: true,
    };
  }
  if (s === 'realizado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: true,
      showCancelar: false,
    };
  }
  if (s === 'cancelado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
    };
  }
  if (s === 'reagendado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
    };
  }
  return {
    showRealizado: false,
    showNaoCompareceu: false,
    showWhatsApp: false,
    showReagendar: false,
    showCancelar: false,
  };
}
