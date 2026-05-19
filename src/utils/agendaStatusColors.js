/**
 * Mapeamento de status da agenda → cor visual.
 * Cores casam com a paleta Procedi (sutis, sem berrar).
 */
export const STATUS_COLORS = {
  pendente: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    label: 'Pendente',
  },
  aguardando_confirmacao: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    label: 'Aguardando confirmação',
  },
  confirmado: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
    label: 'Confirmado',
  },
  realizado: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    label: 'Realizado',
  },
  cancelado: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    label: 'Cancelado',
  },
};

export function getStatusColors(codigo) {
  return STATUS_COLORS[codigo] || STATUS_COLORS.pendente;
}
