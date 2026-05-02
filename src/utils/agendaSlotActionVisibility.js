/**
 * Chips secundárias do card de agenda (Realizado / Falta / WhatsApp / Reagendar / Cancelar).
 * Botões primários (Confirmar / Iniciar / Reagendar) e Editar ficam no AppointmentCard.
 */
export function getAgendaSlotActionVisibility(status) {
  const s = String(status || '');
  if (s === 'pendente' || s === 'aguardando_confirmacao' || s === 'confirmado') {
    return {
      showRealizado: false,
      showFalta: true,
      showWhatsApp: true,
      showReagendar: true,
      showCancelar: true,
    };
  }
  if (s === 'falta') {
    return {
      showRealizado: false,
      showFalta: false,
      showWhatsApp: true,
      showReagendar: true,
      showCancelar: false,
    };
  }
  if (s === 'realizado') {
    return {
      showRealizado: false,
      showFalta: false,
      showWhatsApp: false,
      showReagendar: true,
      showCancelar: false,
    };
  }
  if (s === 'cancelado') {
    return {
      showRealizado: false,
      showFalta: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
    };
  }
  return {
    showRealizado: false,
    showFalta: false,
    showWhatsApp: false,
    showReagendar: false,
    showCancelar: false,
  };
}
