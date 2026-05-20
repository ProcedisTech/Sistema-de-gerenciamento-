import { formatLongDate } from './useAgendaPage';

function capitalizeFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Quarta, 20/05 às 09:00" — CTA mobile e subtítulo do modal. */
export function formatAgendaDateTimeCta(iso, horaHm) {
  if (!iso || !horaHm) return '';
  const long = formatLongDate(iso, { weekday: 'long' });
  const [, m, d] = iso.split('-').map(Number);
  const ddmm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const hi = String(horaHm).slice(0, 5);
  return `${capitalizeFirst(long.split(',')[0] || long)}, ${ddmm} às ${hi}`;
}
