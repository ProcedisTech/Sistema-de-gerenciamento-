/**
 * Matriz de ações do Day Rail (Rich card + Next-up).
 * @param {string} status
 * @returns {{ primary: 'confirmar' | 'iniciar' | null, secondary: Array<'anamnese' | 'whatsapp' | 'reagendar' | 'cancelar'> }}
 */
export function getRailCardActions(status, canStartAnamnese = true) {
  const s = String(status || '');
  const isPending = s === 'pendente' || s === 'aguardando_confirmacao';
  const isConfirmed = s === 'confirmado';

  return {
    primary: isPending ? 'confirmar' : (isConfirmed && canStartAnamnese) ? 'iniciar' : null,
    secondary:
      isPending || isConfirmed
        ? ['anamnese', 'whatsapp', 'reagendar', 'cancelar']
        : ['anamnese', 'whatsapp', 'reagendar'],
  };
}

export function getRailPrimaryLabel(primary) {
  if (primary === 'confirmar') return 'Confirmar';
  if (primary === 'iniciar') return 'Iniciar atendimento';
  return null;
}

/**
 * Matriz de ações para card agrupado (status misto ou uniforme).
 * @param {string[]} statuses — status bruto de cada agenda do grupo
 */
export function getGroupedRailCardActions(statuses = [], canStartAnamnese = true) {
  const list = (statuses || []).map((s) => String(s || ''));
  const hasPending = list.some((s) => s === 'pendente' || s === 'aguardando_confirmacao');
  const allConfirmed = list.length > 0 && list.every((s) => s === 'confirmado');
  const anyActive = list.some((s) =>
    ['pendente', 'aguardando_confirmacao', 'confirmado'].includes(s),
  );

  let primary = null;
  if (hasPending) primary = 'confirmar';
  else if (allConfirmed && canStartAnamnese) primary = 'iniciar';

  return {
    primary,
    secondary: anyActive ? ['anamnese', 'whatsapp', 'reagendar', 'cancelar'] : ['anamnese', 'whatsapp', 'reagendar'],
  };
}
