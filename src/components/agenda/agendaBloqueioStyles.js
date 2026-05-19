/** Estilo compartilhado para cards de bloqueio na grade e no resumo. */
export const BLOQUEIO_HATCH_BG = {
  backgroundColor: '#f1f5f9',
  backgroundImage:
    'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(0,0,0,.06) 4px, rgba(0,0,0,.06) 8px)',
};

export const BLOQUEIO_CARD_CLASS =
  'border-l-[3px] border-l-slate-400 bg-slate-100 text-slate-800';

export function bloqueioMotivoLabel(appointment) {
  const obs = appointment?.observacao != null ? String(appointment.observacao).trim() : '';
  const proc = appointment?.procedimentoNome != null ? String(appointment.procedimentoNome).trim() : '';
  return obs || proc || 'Bloqueio';
}

export function bloqueioHoraFimLabel(appointment) {
  const hi = String(appointment?.horaInicio || '').slice(0, 5);
  const mins = Number(appointment?.duracaoMin) || 0;
  if (!hi || !mins) return hi;
  const parts = hi.split(':').map(Number);
  let total = (parts[0] || 0) * 60 + (parts[1] || 0) + mins;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
