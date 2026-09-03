import { agendasApi } from '../services/api';
import { toDateKey } from './agendaDateUtils';
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

  // Rótulos literais no FE (seed grava 'Avaliacao' sem acento — não usar tipoProcedimentoNome).
  const MODALIDADE_LABEL = {
    retorno: 'Retorno',
    avaliacao: 'Avaliação',
    consulta: 'Consulta Inicial',
  };

  let procedimentoNome;
  if (tipo === 'bloqueio') {
    procedimentoNome =
      (dto.observacao != null && String(dto.observacao).trim()) || 'Bloqueio';
  } else if (MODALIDADE_LABEL[tipoCodigo]) {
    const label = MODALIDADE_LABEL[tipoCodigo];
    const cat = dto.catalogoProcedimentoNome?.trim() || dto.procedimentoFeitoOrigemNome?.trim();
    procedimentoNome = cat ? `${label}: ${cat}` : label;
  } else {
    procedimentoNome =
      dto.catalogoProcedimentoNome?.trim() ||
      (dto.observacao != null && String(dto.observacao).trim()) ||
      'Sem procedimento informado';
  }

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
    pacienteFotoUrl: dto.pacienteFotoUrl || '',
    telefone: '',
    procedimentoNome,
    catalogoProcedimentoSaudeId: catId,
    catalogoProcedimentoSaudeIds: catId ? [catId] : [],
    planejamentoItemId:
      dto.planejamentoItemId != null ? String(dto.planejamentoItemId).trim() : null,
    tipoProcedimentoCodigo: tipoCodigo,
    procedimentoFeitoOrigemId:
      dto.procedimentoFeitoOrigemId != null ? String(dto.procedimentoFeitoOrigemId).trim() : null,
    tipoProcedimentoId: dto.tipoProcedimentoId != null ? String(dto.tipoProcedimentoId) : '',
    tipoProcedimentoNome: dto.tipoProcedimentoNome || '',
    profissionalNome: dto.profissionalNome || '',
    observacao: dto.observacao != null ? String(dto.observacao) : '',
    criadoEm: dto.criadoEm || null,
    atualizadoEm: dto.atualizadoEm || null,
    dataAgendamento: dto.dataAgendamento || null,
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
 * Mescla linhas criadas no estado do dashboard: gate por range ISO + dedupe por agendaId
 * (incoming vence). Puro / testável — sem sort (a célula reordena).
 */
export function mergeDashboardRows(prev, createdRows, { startIso, endIso } = {}) {
  const start = String(startIso || '');
  const end = String(endIso || '');
  const incoming = (createdRows || []).filter((row) => {
    const d = toDateKey(row?.data);
    return Boolean(d) && d >= start && d <= end;
  });
  if (incoming.length === 0) return Array.isArray(prev) ? prev : [];

  const byId = new Map();
  for (const row of prev || []) {
    const id = String(row?.agendaId || row?.id || '').trim();
    if (id) byId.set(id, row);
  }
  for (const row of incoming) {
    const id = String(row?.agendaId || row?.id || '').trim();
    if (id) byId.set(id, row);
  }
  return Array.from(byId.values());
}

/**
 * Agendas no intervalo (1 linha por AgendaDTO — sem GET aninhado de agendamentos).
 */
export async function fetchDashboardAppointmentsForRange(startIso, endIso, opts = {}) {
  const raw = await agendasApi.byRange(startIso, endIso, opts);
  const dtos = normalizeApiList(raw);
  const rows = dtos
    .map(mapAgendaDtoToDashboardRow)
    .filter(Boolean)
    .filter(isAgendaVisibleOnDashboard);
  return sortByDateTime(rows);
}

/** POST bloquear-periodo — cancela conflitos + cria bloqueio (sem statusAgendaCodigo/diaInteiro). */
export function buildAgendaBloquearPeriodoBody({
  dataAgendamento,
  horaInicio,
  horaFim,
  profissionalRoleUserId,
  tipoProcedimentoId,
  motivoCancelamentoId,
  motivoCancelamentoTexto,
  observacaoBloqueio,
}) {
  const hi = String(horaInicio || '09:00').slice(0, 5);
  const hf = String(horaFim || addMinutesToTime(hi, 60)).slice(0, 5);
  const obs =
    observacaoBloqueio != null && String(observacaoBloqueio).trim()
      ? String(observacaoBloqueio).trim().slice(0, 500)
      : null;
  return {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: hf.length === 5 ? `${hf}:00` : hf,
    profissionalRoleUserId: String(profissionalRoleUserId || '').trim(),
    tipoProcedimentoId: String(tipoProcedimentoId || '').trim(),
    motivoCancelamentoId: String(motivoCancelamentoId || '').trim(),
    motivoCancelamentoTexto:
      motivoCancelamentoTexto != null && String(motivoCancelamentoTexto).trim()
        ? String(motivoCancelamentoTexto).trim()
        : null,
    ...(obs ? { observacaoBloqueio: obs } : {}),
  };
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
  tipoProcedimentoId,
  agendaIdOrigem,
  planejamentoItemId,
  procedimentoFeitoOrigemId,
}) {
  const hi = String(horaInicio || '09:00').slice(0, 5);
  const mins = Number(duracaoMin) || 45;
  const horaFim = addMinutesToTime(hi, mins);
  const cat = catalogoProcedimentoSaudeId != null ? String(catalogoProcedimentoSaudeId).trim() : '';
  const tipoId = tipoProcedimentoId != null ? String(tipoProcedimentoId).trim() : '';
  const base = {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
    profissionalRoleUserId,
    pacienteId: String(pacienteId || '').trim(),
    ...(cat ? { catalogoProcedimentoSaudeId: cat } : {}),
    ...(tipoId ? { tipoProcedimentoId: tipoId } : {}),
  };
  const origem =
    agendaIdOrigem != null && String(agendaIdOrigem).trim()
      ? { agendaIdOrigem: String(agendaIdOrigem).trim() }
      : {};
  const planejamento =
    planejamentoItemId != null && String(planejamentoItemId).trim()
      ? { planejamentoItemId: String(planejamentoItemId).trim() }
      : {};
  const paiId =
    procedimentoFeitoOrigemId != null ? String(procedimentoFeitoOrigemId).trim() : '';
  return {
    ...base,
    ...origem,
    ...planejamento,
    ...(paiId ? { procedimentoFeitoOrigemId: paiId } : {}),
    observacao: observacao != null && String(observacao).trim() ? String(observacao).trim().slice(0, 500) : undefined,
  };
}
