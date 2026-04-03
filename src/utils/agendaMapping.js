/** Soma minutos a "HH:mm" (24h). */
export function addMinutesToTime(hhmm, minutesToAdd) {
  const parts = String(hhmm || '09:00').split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  let total = h * 60 + m + minutesToAdd;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/**
 * Normaliza AgendaDTO do Spring para o modelo usado pela UI (lista lateral).
 * Não inventa paciente: slot vem sem paciente até API de agendamentos no slot (A3).
 */
export function mapAgendaDtoToAppointment(dto) {
  if (!dto || !dto.id) return null;
  const date = dto.dataAgendamento || '';
  const time = (dto.horaInicio && String(dto.horaInicio).slice(0, 5)) || '00:00';
  const codigo = String(dto.statusCodigo || '').toLowerCase();
  const nomeStatus = String(dto.statusNome || '').toLowerCase();
  const cancelled = codigo.includes('cancel') || nomeStatus.includes('cancel');
  const confirmed =
    codigo.includes('confirm') ||
    codigo.includes('realiz') ||
    nomeStatus.includes('confirm');

  let status = 'pendente';
  if (cancelled) status = 'cancelado';
  else if (confirmed) status = 'confirmado';

  const procedure =
    dto.observacao?.trim() ||
    dto.motivoBloqueio?.trim() ||
    (dto.tipo === 'bloqueio' ? 'Bloqueio de agenda' : 'Atendimento');

  return {
    id: dto.id,
    date: date.length >= 10 ? date.slice(0, 10) : date,
    time,
    procedure,
    status,
    patient: null,
    /** Itens de GET /agendas/{id}/agendamentos (preenchido após byRange). */
    compromissos: [],
    profissionalNome: dto.profissionalNome || '',
    roleUserId: dto.roleUserId,
    tipo: dto.tipo || 'atendimento',
    statusCodigo: dto.statusCodigo,
    statusNome: dto.statusNome,
    raw: dto,
  };
}
