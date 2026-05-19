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

/** Deriva status da UI alinhado a agendaStatusColors (snake / texto livre do backend). */
export function deriveAgendaSlotStatus(dto) {
  if (!dto || typeof dto !== 'object') return 'pendente';

  const codigo = String(dto.statusCodigo || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  const nome = String(dto.statusNome || '').toLowerCase();

  if (codigo.includes('cancel') || nome.includes('cancel')) return 'cancelado';
  if (codigo.includes('reagend') || nome.includes('reagend')) return 'reagendado';
  if (codigo.includes('realiz') || nome.includes('realiz')) return 'realizado';
  if (
    codigo.includes('aguardando') ||
    codigo.includes('aguardando_confirmacao') ||
    nome.includes('aguardando')
  )
    return 'aguardando_confirmacao';
  if (codigo.includes('confirm') || nome.includes('confirm')) return 'confirmado';
  if (codigo.includes('pendent') || nome.includes('pendent')) return 'pendente';
  return 'pendente';
}

/**
 * Normaliza AgendaDTO do Spring para o modelo usado pela UI (calendário recepção).
 * Onda 4: paciente e catálogo vêm no próprio DTO; compromisso sintético quando há paciente.
 */
export function mapAgendaDtoToAppointment(dto) {
  if (!dto || !dto.id) return null;
  const date = dto.dataAgendamento || '';
  const time = (dto.horaInicio && String(dto.horaInicio).slice(0, 5)) || '00:00';
  const status = deriveAgendaSlotStatus(dto);
  const tipoCodigo = String(dto.tipoProcedimentoCodigo || '').toLowerCase();
  const tipo = tipoCodigo === 'bloqueio' ? 'bloqueio' : 'atendimento';

  const procedure =
    (dto.catalogoProcedimentoNome && String(dto.catalogoProcedimentoNome).trim()) ||
    dto.observacao?.trim() ||
    'Atendimento';

  const compromissos = [];
  if (dto.pacienteId && tipo !== 'bloqueio') {
    compromissos.push({
      id: dto.id,
      pacienteId: String(dto.pacienteId),
      pacienteNome: dto.pacienteNome || '',
      procedimentoNome: dto.catalogoProcedimentoNome || procedure,
      catalogoProcedimentoSaudeId:
        dto.catalogoProcedimentoSaudeId != null ? String(dto.catalogoProcedimentoSaudeId) : '',
      observacao: dto.observacao || '',
      removable: false,
    });
  }

  const patient =
    dto.pacienteNome || dto.pacienteId ? { id: dto.pacienteId, nome: dto.pacienteNome || '' } : null;

  return {
    id: dto.id,
    date: date.length >= 10 ? date.slice(0, 10) : date,
    time,
    procedure,
    status,
    patient,
    compromissos,
    profissionalNome: dto.profissionalNome || '',
    roleUserId: dto.roleUserId,
    tipo,
    statusCodigo: dto.statusCodigo,
    statusNome: dto.statusNome,
    raw: dto,
  };
}
