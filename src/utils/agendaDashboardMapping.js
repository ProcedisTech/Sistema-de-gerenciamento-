import { agendasApi } from '../services/api';
import { addMinutesToTime, deriveAgendaSlotStatus } from './agendaMapping';

export function normalizeApiList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.content)) return raw.content;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

function timeToMinutes(t) {
  if (t == null || t === '') return 0;
  const parts = String(t).trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function minutesBetweenHhmm(hi, hf) {
  const sm = timeToMinutes(String(hi || '').slice(0, 5));
  const em = timeToMinutes(String(hf || '').slice(0, 5));
  const d = em - sm;
  return d > 0 ? d : 45;
}

function sortByDateTime(rows) {
  return [...rows].sort((a, b) => `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`));
}

function roleUserIdFromDto(dto) {
  return dto?.roleUserId != null ? String(dto.roleUserId) : '';
}

/**
 * Uma linha do dashboard = uma agenda (Onda 4: paciente + catálogo no próprio AgendaDTO).
 */
export function mapAgendaDtoToDashboardRow(dto) {
  if (!dto?.id) return null;
  const date = dto.dataAgendamento ? String(dto.dataAgendamento).slice(0, 10) : '';
  const hi = dto.horaInicio != null ? String(dto.horaInicio).slice(0, 5) : '09:00';
  const hf = dto.horaFim != null ? String(dto.horaFim).slice(0, 5) : '';
  const duracaoMin = hf ? minutesBetweenHhmm(hi, hf) : 45;
  const horaFim = hf || addMinutesToTime(hi, duracaoMin).slice(0, 5);
  const tipoCodigo = String(dto.tipoProcedimentoCodigo || '').toLowerCase();
  const tipo = tipoCodigo === 'bloqueio' ? 'bloqueio' : 'atendimento';
  const catId = dto.catalogoProcedimentoSaudeId != null ? String(dto.catalogoProcedimentoSaudeId).trim() : '';
  const status = deriveAgendaSlotStatus(dto);
  const pacienteId = dto.pacienteId != null ? String(dto.pacienteId) : '';
  const profissionalRoleUserId =
    dto.profissionalRoleUserId != null ? String(dto.profissionalRoleUserId) : roleUserIdFromDto(dto);

  return {
    id: String(dto.id),
    agendaId: String(dto.id),
    data: date,
    horaInicio: hi,
    horaFim,
    duracaoMin,
    tipo,
    status,
    statusNome: dto.statusNome,
    motivoCancelamentoId: dto.motivoCancelamentoId != null ? String(dto.motivoCancelamentoId) : null,
    motivoCancelamentoCodigo: dto.motivoCancelamentoCodigo ?? null,
    motivoCancelamentoNome: dto.motivoCancelamentoNome ?? null,
    profissionalRoleUserId,
    roleUserId: profissionalRoleUserId,
    corHex: '#00a88e',
    pacienteNome: dto.pacienteNome || (tipo === 'bloqueio' ? '' : 'Sem paciente'),
    pacienteId,
    telefone: '',
    procedimentoNome:
      tipo === 'bloqueio'
        ? (dto.observacao != null && String(dto.observacao).trim()) || 'Bloqueio'
        : dto.catalogoProcedimentoNome?.trim() ||
          (dto.observacao != null && String(dto.observacao).trim()) ||
          'Sem procedimento informado',
    catalogoProcedimentoSaudeId: catId,
    catalogoProcedimentoSaudeIds: catId ? [catId] : [],
    tipoProcedimentoId: dto.tipoProcedimentoId != null ? String(dto.tipoProcedimentoId) : '',
    tipoProcedimentoNome: dto.tipoProcedimentoNome || '',
    profissionalNome: dto.profissionalNome || '',
    observacao: dto.observacao != null ? String(dto.observacao) : '',
    rawSlot: dto,
    rawAgendamento: null,
  };
}

/** Bloqueio removido (cancelado) não deve aparecer na grade/painel/calendário. */
export function isAgendaVisibleOnDashboard(row) {
  if (!row) return false;
  if (row.tipo === 'bloqueio' && row.status === 'cancelado') return false;
  return true;
}

/**
 * Agendas no intervalo (1 linha por AgendaDTO — sem GET aninhado de agendamentos).
 */
export async function fetchDashboardAppointmentsForRange(startIso, endIso) {
  const raw = await agendasApi.byRange(startIso, endIso);
  const dtos = normalizeApiList(raw);
  const rows = dtos
    .map(mapAgendaDtoToDashboardRow)
    .filter(Boolean)
    .filter(isAgendaVisibleOnDashboard);
  return sortByDateTime(rows);
}

/** POST de bloqueio de horário (sem paciente/catálogo). */
export function buildAgendaBloqueioCreateBody({
  dataAgendamento,
  horaInicio,
  horaFim,
  profissionalRoleUserId,
  tipoProcedimentoId,
  observacao,
  statusAgendaCodigo = 'confirmado',
}) {
  const hi = String(horaInicio || '09:00').slice(0, 5);
  const hf = String(horaFim || addMinutesToTime(hi, 60)).slice(0, 5);
  const motivo =
    observacao != null && String(observacao).trim() ? String(observacao).trim().slice(0, 500) : '';
  return {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: hf.length === 5 ? `${hf}:00` : hf,
    profissionalRoleUserId: String(profissionalRoleUserId || '').trim(),
    tipoProcedimentoId: String(tipoProcedimentoId || '').trim(),
    observacao: motivo,
    statusAgendaCodigo: String(statusAgendaCodigo || 'confirmado').trim(),
  };
}

export function buildAgendaCreateBody({
  dataAgendamento,
  horaInicio,
  duracaoMin,
  profissionalRoleUserId,
  observacao,
  pacienteId,
  catalogoProcedimentoSaudeId,
  agendaIdOrigem,
}) {
  const hi = String(horaInicio || '09:00').slice(0, 5);
  const mins = Number(duracaoMin) || 45;
  const horaFim = addMinutesToTime(hi, mins);
  const cat = catalogoProcedimentoSaudeId != null ? String(catalogoProcedimentoSaudeId).trim() : '';
  const base = {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
    profissionalRoleUserId,
    pacienteId: String(pacienteId || '').trim(),
    ...(cat ? { catalogoProcedimentoSaudeId: cat } : {}),
  };
  const origem =
    agendaIdOrigem != null && String(agendaIdOrigem).trim()
      ? { agendaIdOrigem: String(agendaIdOrigem).trim() }
      : {};
  return {
    ...base,
    ...origem,
    observacao: observacao != null && String(observacao).trim() ? String(observacao).trim().slice(0, 500) : undefined,
  };
}

/** `form` = campos do modal (`data`, `horaInicio`, `duracaoMin`, `observacao`, catálogo). */
export function buildAgendaUpdateBody(rawSlot, form, profissionalRoleUserId) {
  const raw = rawSlot && typeof rawSlot === 'object' ? rawSlot : {};
  const dataAgendamento =
    (form.data && String(form.data).slice(0, 10)) ||
    (raw.dataAgendamento && String(raw.dataAgendamento).slice(0, 10)) ||
    '';
  const hi = String(
    form.horaInicio ?? ((raw.horaInicio && String(raw.horaInicio).slice(0, 5)) || '09:00')
  ).slice(0, 5);
  const mins = Number(form.duracaoMin) || 45;
  const horaFim = addMinutesToTime(hi, mins);
  const obs =
    form.observacao !== undefined
      ? String(form.observacao || '').trim() || undefined
      : raw.observacao != null
        ? String(raw.observacao).trim() || undefined
        : undefined;

  const catFromForm =
    (form.catalogoProcedimentoSaudeId != null && String(form.catalogoProcedimentoSaudeId).trim()) ||
    (Array.isArray(form.catalogoProcedimentoSaudeIds) && form.catalogoProcedimentoSaudeIds[0]
      ? String(form.catalogoProcedimentoSaudeIds[0]).trim()
      : '');
  const catFromRaw = raw.catalogoProcedimentoSaudeId != null ? String(raw.catalogoProcedimentoSaudeId).trim() : '';
  const catalogoProcedimentoSaudeId = catFromForm || catFromRaw || '';

  return {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
    profissionalRoleUserId: String(profissionalRoleUserId || '').trim(),
    pacienteId: String(form.pacienteId || raw.pacienteId || '').trim(),
    ...(catalogoProcedimentoSaudeId ? { catalogoProcedimentoSaudeId } : {}),
    observacao: obs,
  };
}
