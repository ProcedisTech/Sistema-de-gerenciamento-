/**
 * Compara dois horários HH:MM lexicograficamente.
 * Válido porque <input type="time"> sempre produz zero-padded HH:MM.
 */
export function hhmm(str) {
  return String(str || '').slice(0, 5);
}

/**
 * Retorna um Set com os índices dos turnos sobrepostos dentro de um array de turnos.
 * Turnos são comparados em pares após ordenação por horaInicio.
 */
export function encontrarSobrepostos(turnos) {
  if (!turnos || turnos.length < 2) return new Set();
  const indexed = turnos.map((t, i) => ({ ...t, _orig: i }));
  indexed.sort((a, b) => hhmm(a.horaInicio).localeCompare(hhmm(b.horaInicio)));
  const conflitantes = new Set();
  for (let i = 0; i < indexed.length - 1; i++) {
    if (hhmm(indexed[i].horaFim) > hhmm(indexed[i + 1].horaInicio)) {
      conflitantes.add(indexed[i]._orig);
      conflitantes.add(indexed[i + 1]._orig);
    }
  }
  return conflitantes;
}
