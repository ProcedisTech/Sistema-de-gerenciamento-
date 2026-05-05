export function isSlotCanceladoPorReagendamento(appointment) {
  return Boolean(appointment && appointment.status === 'reagendado');
}

/**
 * @returns {string|null} "Reagendado para DD/MM as HH:mm" ou null se incompleto
 */
export function formatDestinoReagendamentoLabel(appointment) {
  if (!isSlotCanceladoPorReagendamento(appointment)) return null;
  return 'Reagendado';
}
