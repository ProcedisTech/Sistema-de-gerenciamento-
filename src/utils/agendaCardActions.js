/**
 * Matriz de ações do Day Rail (Rich card + Next-up).
 * @param {string} status
 * @returns {{ primary: 'confirmar' | 'iniciar' | null, secondary: Array<'whatsapp' | 'reagendar' | 'cancelar'> }}
 */
export function getRailCardActions(status) {
  const s = String(status || '');
  const isPending = s === 'pendente' || s === 'aguardando_confirmacao';
  const isConfirmed = s === 'confirmado';

  return {
    primary: isPending ? 'confirmar' : isConfirmed ? 'iniciar' : null,
    secondary:
      isPending || isConfirmed
        ? ['whatsapp', 'reagendar', 'cancelar']
        : ['whatsapp', 'reagendar'],
  };
}

export function getRailPrimaryLabel(primary) {
  if (primary === 'confirmar') return 'Confirmar';
  if (primary === 'iniciar') return 'Iniciar atendimento';
  return null;
}
