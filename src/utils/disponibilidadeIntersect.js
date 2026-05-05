export function dentroDaDisponibilidade(appointment, disponibilidade) {
  if (!appointment || !Array.isArray(disponibilidade)) return true;
  if (!appointment.dataAgendamento || !appointment.horaInicio) return true;

  const data = new Date(`${appointment.dataAgendamento}T00:00:00`);
  if (Number.isNaN(data.getTime())) return true;
  const diaSemana = data.getDay();
  const hora = String(appointment.horaInicio).slice(0, 5);
  const slotsDia = disponibilidade.filter((d) => Number(d?.diaSemana) === diaSemana && d?.ativo !== false);
  if (slotsDia.length === 0) return false;
  return slotsDia.some((s) => {
    const inicio = String(s?.horaInicio || '').slice(0, 5);
    const fim = String(s?.horaFim || '').slice(0, 5);
    if (!inicio || !fim) return false;
    return hora >= inicio && hora < fim;
  });
}
