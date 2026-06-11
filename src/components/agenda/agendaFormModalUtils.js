import { formatLongDate } from './useAgendaPage';

function capitalizeFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Quarta, 20/05 · 09:00–10:30" — CTA mobile e subtítulo do modal. */
export function formatAgendaDateTimeCta(iso, horaInicio, horaFimReal) {
  if (!iso || !horaInicio) return '';
  const long = formatLongDate(iso, { weekday: 'long' });
  const [, m, d] = iso.split('-').map(Number);
  const ddmm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const hi = String(horaInicio).slice(0, 5);
  const hf = horaFimReal ? String(horaFimReal).slice(0, 5) : '';
  const horario = hf ? `${hi}–${hf}` : hi;
  return `${capitalizeFirst(long.split(',')[0] || long)}, ${ddmm} · ${horario}`;
}
