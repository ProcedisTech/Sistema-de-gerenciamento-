import { startOfWeekSaoPauloISODate, toSaoPauloISODate } from './dateLimits.js';

export const TIPO_VERBO = {
  paciente_confirmou: 'confirmou presença',
  paciente_recusou: 'recusou',
  paciente_sem_resposta: 'não respondeu',
  agenda_cancelada: 'Agendamento cancelado',
  agenda_reagendada: 'Agendamento reagendado',
  SUGESTAO_PROCEDIMENTO: 'sugeriu procedimento',
};

export const TIPOS_SUGESTAO = ['SUGESTAO_PROCEDIMENTO'];

export const TIPOS_CONFIRMACAO = [
  'paciente_confirmou',
  'paciente_recusou',
  'paciente_sem_resposta',
];

export const TIPOS_AGENDA = ['agenda_cancelada', 'agenda_reagendada'];

export const CHIP_FILTERS = [
  { id: 'todas', label: 'Todas' },
  { id: 'sugestoes', label: 'Sugestões' },
  { id: 'confirmacoes', label: 'Confirmações' },
  { id: 'agenda', label: 'Agenda' },
];

export const GRUPO_LABELS = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  anteriores: 'Anteriores',
};

export function lerPayload(p) {
  if (!p) return {};
  if (typeof p === 'object') return p;
  if (typeof p === 'string') {
    try {
      return JSON.parse(p);
    } catch {
      return {};
    }
  }
  return {};
}

function formatarQuando(data, hora) {
  if (!data) return null;
  let dataBr;
  if (/^\d{4}-\d{2}-\d{2}/.test(data)) {
    const [, m, d] = data.split('-');
    dataBr = `${d}/${m}`;
  } else if (/^\d{2}\/\d{2}/.test(data)) {
    dataBr = data.substring(0, 5);
  } else {
    return null;
  }
  return hora ? `${dataBr} às ${hora}` : dataBr;
}

export function formatarMensagemNotificacao(n) {
  const payload = lerPayload(n?.payload);
  const nome = payload.pacienteNome;
  const quando = formatarQuando(payload.dataAgendamento, payload.horaInicio);
  const procStr = payload.procedimentoNome ? ` (${payload.procedimentoNome})` : '';

  switch (n?.tipo) {
    case 'paciente_confirmou':
    case 'paciente_recusou':
    case 'paciente_sem_resposta': {
      const verbo = TIPO_VERBO[n.tipo];
      if (nome && quando) return `${nome} ${verbo} em ${quando}${procStr}`;
      if (nome) return `${nome} ${verbo}`;
      return `Paciente ${verbo}`;
    }
    case 'agenda_cancelada': {
      if (nome && quando) return `Agendamento de ${nome} em ${quando}${procStr} cancelado`;
      if (nome) return `Agendamento de ${nome} cancelado`;
      return 'Agendamento cancelado';
    }
    case 'agenda_reagendada': {
      const whenAntigo = formatarQuando(payload.dataAntiga, payload.horarioAntigo);
      const whenNovo = formatarQuando(payload.dataNova ?? payload.dataAgendamento, payload.horarioNovo ?? payload.horaInicio);
      if (nome && whenAntigo && whenNovo)
        return `Agendamento de ${nome} reagendado de ${whenAntigo} para ${whenNovo}${procStr}`;
      if (nome && whenNovo)
        return `Agendamento de ${nome} reagendado para ${whenNovo}${procStr}`;
      if (nome)
        return `Agendamento de ${nome} reagendado`;
      return 'Agendamento reagendado';
    }
    case 'SUGESTAO_PROCEDIMENTO': {
      const { nomeSugerido, profissionalNome } = payload;
      if (profissionalNome && nomeSugerido) {
        return `${profissionalNome} sugeriu incluir "${nomeSugerido}" no catálogo`;
      }
      if (nomeSugerido) return `Sugestão de procedimento: ${nomeSugerido}`;
      return 'Sugestão de procedimento no catálogo';
    }
    default:
      return TIPO_VERBO[n?.tipo] || n?.tipo || '';
  }
}

export function formatarTempoRelativo(iso) {
  if (!iso) return '';
  try {
    const diff = (new Date() - new Date(iso)) / 1000;
    if (diff < 60) return 'agora há pouco';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    return `há ${Math.floor(diff / 86400)} dias`;
  } catch {
    return '';
  }
}

export function matchesChip(notificacao, chipId) {
  const tipo = notificacao?.tipo;
  if (!chipId || chipId === 'todas') return true;
  if (chipId === 'sugestoes') return TIPOS_SUGESTAO.includes(tipo);
  if (chipId === 'confirmacoes') return TIPOS_CONFIRMACAO.includes(tipo);
  if (chipId === 'agenda') return TIPOS_AGENDA.includes(tipo);
  return true;
}

/**
 * @param {string|Date} criadoEm
 * @returns {'hoje'|'semana'|'anteriores'}
 */
export function grupoTemporal(criadoEm) {
  const dateSp = toSaoPauloISODate(criadoEm);
  const hojeSp = toSaoPauloISODate();
  if (dateSp === hojeSp) return 'hoje';

  const inicioSemana = startOfWeekSaoPauloISODate();
  if (dateSp >= inicioSemana && dateSp < hojeSp) return 'semana';
  return 'anteriores';
}

/** @param {object[]} items */
export function countByChip(items) {
  const list = Array.isArray(items) ? items : [];
  return CHIP_FILTERS.reduce((acc, chip) => {
    acc[chip.id] = list.filter((n) => matchesChip(n, chip.id)).length;
    return acc;
  }, {});
}

/** @param {object[]} items @param {string} chipId */
export function filterByChip(items, chipId) {
  const list = Array.isArray(items) ? items : [];
  return list.filter((n) => matchesChip(n, chipId));
}

/** @param {object[]} items @param {string} chipId */
export function groupNotificacoes(items, chipId) {
  const filtered = filterByChip(items, chipId);
  const groups = { hoje: [], semana: [], anteriores: [] };
  for (const n of filtered) {
    const g = grupoTemporal(n.criadoEm);
    groups[g].push(n);
  }
  return groups;
}
