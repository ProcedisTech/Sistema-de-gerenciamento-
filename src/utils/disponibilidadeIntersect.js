const DIA_PREFIX = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function identificarSufixoPeriodo(horaSlot, periodos) {
  if (!horaSlot || !Array.isArray(periodos)) return null;
  const horaNorm = String(horaSlot).slice(0, 5);

  for (const p of periodos) {
    const inicio = String(p?.horaInicio || '').slice(0, 5);
    const fim = String(p?.horaFim || '').slice(0, 5);
    if (!inicio || !fim) continue;

    if (horaNorm >= inicio && horaNorm < fim) {
      const cod = String(p?.codigo || '').toLowerCase();
      const nome = String(p?.nome || '').toLowerCase();

      if (cod.includes('matut') || nome.includes('matut') || nome.includes('manh')) return 'man';
      if (cod.includes('vesper') || nome.includes('vesper') || nome.includes('tarde')) return 'tar';
      if (cod.includes('notur') || nome.includes('notur') || nome.includes('noite')) return 'noi';
    }
  }

  return null;
}

export function dentroDaDisponibilidade(appointment, disponibilidade, periodos) {
  if (!appointment || !disponibilidade || !Array.isArray(periodos)) return true;
  if (!appointment.dataAgendamento || !appointment.horaInicio) return true;

  const data = new Date(`${appointment.dataAgendamento}T00:00:00`);
  if (Number.isNaN(data.getTime())) return true;
  const diaPrefix = DIA_PREFIX[data.getDay()];

  const sufixo = identificarSufixoPeriodo(appointment.horaInicio, periodos);
  if (!sufixo) return true;

  const chave = `${diaPrefix}${sufixo.charAt(0).toUpperCase()}${sufixo.slice(1)}`;
  const valor = disponibilidade[chave];
  return valor === true;
}
