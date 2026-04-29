import { agendasApi, agendamentosApi } from '../services/api';
import { mapAgendaDtoToAppointment, addMinutesToTime } from './agendaMapping';

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

function normalizeCorHex(src) {
  if (src == null || src === '') return '#00a88e';
  const s = String(src).trim();
  if (!s) return '#00a88e';
  if (s.startsWith('#')) return s.length >= 4 ? s : '#00a88e';
  if (/^[0-9a-fA-F]{3,8}$/.test(s)) return `#${s}`;
  return '#00a88e';
}

/** Cor do catálogo / agendamento vinda do backend (nomes alternativos tolerados). */
function corHexFromCompromisso(compromisso) {
  const c = compromisso || {};
  const raw =
    c.corHex ||
    c.cor_hex ||
    c.corCatalogo ||
    c.catalogoCorHex ||
    c.procedimentoCorHex ||
    c.cor;
  return normalizeCorHex(raw);
}

function roleUserIdFromSlot(slot) {
  const raw = slot?.raw || {};
  return slot?.roleUserId || raw.roleUserId || '';
}

/** Espera padrão gravado no slot: `procedimento - paciente` (opcionalmente seguido de ` — notas`). */
function procedimentoPacienteFromSlotObservacao(obs) {
  const s = obs != null ? String(obs).trim() : '';
  if (!s) return { procedimentoNome: '', pacienteNome: '' };
  const sep = ' - ';
  const i = s.indexOf(sep);
  if (i === -1) return { procedimentoNome: s, pacienteNome: '' };
  return {
    procedimentoNome: s.slice(0, i).trim() || '',
    pacienteNome: s.slice(i + sep.length).trim() || '',
  };
}

/**
 * Uma linha do dashboard = um compromisso (tb_agendamento).
 * `id` = agendamento.id (chave React); `agendaId` = slot (tb_agenda).
 */
export function mapSlotAndCompromissoToDashboardRow(slot, compromisso) {
  if (!slot?.id || !compromisso?.id) return null;
  const raw = slot.raw || {};
  const hi = (raw.horaInicio && String(raw.horaInicio).slice(0, 5)) || slot.time || '09:00';
  const hfRaw = raw.horaFim && String(raw.horaFim).slice(0, 5);
  const duracaoMin = hfRaw ? minutesBetweenHhmm(hi, hfRaw) : 45;

  const catId =
    compromisso.catalogoProcedimentoSaudeId ||
    compromisso.catalogoProcedimentoId ||
    compromisso.catalogoId ||
    '';

  return {
    id: String(compromisso.id),
    agendaId: String(slot.id),
    data: slot.date,
    horaInicio: hi,
    duracaoMin,
    tipo: slot.tipo || 'atendimento',
    status: slot.status,
    statusNome: slot.statusNome,
    roleUserId: roleUserIdFromSlot(slot),
    corHex: corHexFromCompromisso(compromisso),
    pacienteNome: compromisso.pacienteNome || '',
    pacienteId: compromisso.pacienteId ? String(compromisso.pacienteId) : '',
    telefone:
      compromisso.telefone ||
      compromisso.telefonePrincipal ||
      compromisso.telefoneNumero ||
      '',
    procedimentoNome: compromisso.procedimentoNome || compromisso.nomeProcedimento || '',
    catalogoProcedimentoSaudeId: catId ? String(catId) : '',
    profissionalNome: slot.profissionalNome || '',
    observacao: compromisso.observacao || '',
    rawSlot: raw,
    rawAgendamento: compromisso,
  };
}

const DEFAULT_BATCH = 8;

/**
 * Slots no intervalo + listByAgenda por slot (em lotes paralelos).
 */
export async function fetchDashboardAppointmentsForRange(startIso, endIso, batchSize = DEFAULT_BATCH) {
  const raw = await agendasApi.byRange(startIso, endIso);
  const dtos = normalizeApiList(raw);
  const slots = dtos.map(mapAgendaDtoToAppointment).filter(Boolean);
  const rows = [];

  for (let i = 0; i < slots.length; i += batchSize) {
    const chunk = slots.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (slot) => {
        if (!slot.id) return;
        if (slot.tipo === 'bloqueio') {
          const raw = slot.raw || {};
          const hi = raw.horaInicio != null ? String(raw.horaInicio).slice(0, 5) : String(slot.time || '').slice(0, 5);
          const hf = raw.horaFim != null ? String(raw.horaFim).slice(0, 5) : '';
          const motivo = raw.motivoBloqueio != null ? String(raw.motivoBloqueio).trim() : '';
          rows.push({
            id: String(slot.id),
            agendaId: String(slot.id),
            data: raw.dataAgendamento != null ? String(raw.dataAgendamento).slice(0, 10) : slot.date || '',
            horaInicio: hi,
            duracaoMin: hf ? minutesBetweenHhmm(hi, hf) : 45,
            tipo: 'bloqueio',
            status: 'bloqueio',
            statusNome: slot.statusNome,
            roleUserId: roleUserIdFromSlot(slot),
            corHex: '#94a3b8',
            procedimentoNome: 'Bloqueio',
            pacienteNome: motivo || 'Horário bloqueado',
            pacienteId: null,
            profissionalNome: slot.profissionalNome || '',
            telefone: '',
            catalogoProcedimentoSaudeId: '',
            observacao: '',
            rawSlot: raw,
            rawAgendamento: null,
          });
          return;
        }
        let items = [];
        try {
          const rawItems = await agendamentosApi.listByAgenda(slot.id);
          items = normalizeApiList(rawItems);
        } catch {
          items = [];
        }
        if (items.length === 0) {
          const raw = slot.raw || {};
          const hi = raw.horaInicio != null ? String(raw.horaInicio).slice(0, 5) : String(slot.time || '').slice(0, 5);
          const hf = raw.horaFim != null ? String(raw.horaFim).slice(0, 5) : '';
          const obs = raw.observacao != null ? String(raw.observacao).trim() : '';
          const { procedimentoNome: procFromObs, pacienteNome: pacFromObs } = procedimentoPacienteFromSlotObservacao(obs);
          rows.push({
            id: String(slot.id),
            agendaId: String(slot.id),
            data: raw.dataAgendamento != null ? String(raw.dataAgendamento).slice(0, 10) : slot.date || '',
            horaInicio: hi,
            duracaoMin: hf ? minutesBetweenHhmm(hi, hf) : 45,
            tipo: raw.tipo || slot.tipo || 'atendimento',
            status: slot.status,
            statusNome: slot.statusNome,
            roleUserId: roleUserIdFromSlot(slot),
            corHex: '#00a88e',
            procedimentoNome: procFromObs || 'Sem procedimento',
            pacienteNome: pacFromObs || 'Sem paciente',
            pacienteId: null,
            profissionalNome: slot.profissionalNome || '',
            telefone: '',
            catalogoProcedimentoSaudeId: '',
            observacao: '',
            rawSlot: raw,
            rawAgendamento: null,
          });
        } else {
          for (const c of items) {
            const row = mapSlotAndCompromissoToDashboardRow(slot, c);
            if (row) rows.push(row);
          }
        }
      })
    );
  }

  return sortByDateTime(rows);
}

export function buildAgendaCreateBody({
  dataAgendamento,
  horaInicio,
  duracaoMin,
  roleUserId,
  observacao,
  tipo = 'atendimento',
  motivoBloqueio,
}) {
  const hi = String(horaInicio || '09:00').slice(0, 5);
  const mins = Number(duracaoMin) || 45;
  const horaFim = addMinutesToTime(hi, mins);
  const base = {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
    roleUserId,
    tipo: tipo === 'bloqueio' ? 'bloqueio' : 'atendimento',
  };
  if (tipo === 'bloqueio') {
    const motivo = String(motivoBloqueio || '').trim().slice(0, 500);
    return {
      ...base,
      motivoBloqueio: motivo,
      observacao: motivo || undefined,
    };
  }
  return {
    ...base,
    observacao: observacao != null && String(observacao).trim() ? String(observacao).trim().slice(0, 500) : undefined,
  };
}

/** `form` = campos do modal (`data`, `horaInicio`, `duracaoMin`, `observacao`). */
export function buildAgendaUpdateBody(rawSlot, form, roleUserIdFallback) {
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
  const isBloqueio = form.tipo === 'bloqueio' || raw.tipo === 'bloqueio';
  const tipo = isBloqueio ? 'bloqueio' : raw.tipo || 'atendimento';
  const motivo =
    form.motivoBloqueio !== undefined
      ? String(form.motivoBloqueio || '').trim().slice(0, 500)
      : raw.motivoBloqueio != null
        ? String(raw.motivoBloqueio).trim().slice(0, 500)
        : '';
  if (isBloqueio) {
    const out = {
      dataAgendamento,
      horaInicio: hi.length === 5 ? `${hi}:00` : hi,
      horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
      roleUserId: raw.roleUserId || roleUserIdFallback,
      tipo,
      motivoBloqueio: motivo || undefined,
    };
    if (obs) out.observacao = obs;
    return out;
  }
  return {
    dataAgendamento,
    horaInicio: hi.length === 5 ? `${hi}:00` : hi,
    horaFim: horaFim.length === 5 ? `${horaFim}:00` : horaFim,
    roleUserId: raw.roleUserId || roleUserIdFallback,
    tipo,
    observacao: obs,
  };
}
