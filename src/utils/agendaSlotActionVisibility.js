/**
 * Chips secundárias do card de agenda (Realizado / Não compareceu / WhatsApp / Reagendar / Cancelar).
 * Botões primários (Confirmar / Iniciar / Reagendar) ficam no AppointmentCard.
 * @param {string} status
 * @param {{ tipo?: string }} [opts]
 */
export function getAgendaSlotActionVisibility(status, opts = {}) {
  if (String(opts.tipo || '').toLowerCase() === 'bloqueio') {
    const s = String(status || '');
    if (s === 'cancelado' || s === 'reagendado') {
      return {
        showRealizado: false,
        showNaoCompareceu: false,
        showWhatsApp: false,
        showReagendar: false,
        showCancelar: false,
        showRemoverBloqueio: false,
      };
    }
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
      showRemoverBloqueio: true,
    };
  }

  const s = String(status || '');
  if (s === 'pendente' || s === 'aguardando_confirmacao' || s === 'confirmado') {
    return {
      showRealizado: false,
      showNaoCompareceu: true,
      showWhatsApp: true,
      showReagendar: true,
      showCancelar: true,
      showRemoverBloqueio: false,
    };
  }
  if (s === 'realizado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: true,
      showCancelar: false,
      showRemoverBloqueio: false,
    };
  }
  if (s === 'cancelado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
      showRemoverBloqueio: false,
    };
  }
  if (s === 'reagendado') {
    return {
      showRealizado: false,
      showNaoCompareceu: false,
      showWhatsApp: false,
      showReagendar: false,
      showCancelar: false,
      showRemoverBloqueio: false,
    };
  }
  return {
    showRealizado: false,
    showNaoCompareceu: false,
    showWhatsApp: false,
    showReagendar: false,
    showCancelar: false,
    showRemoverBloqueio: false,
  };
}
