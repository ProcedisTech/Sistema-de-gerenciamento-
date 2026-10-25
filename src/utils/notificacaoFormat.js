import {
  BellRing, CalendarClock, CalendarPlus, CalendarX, CheckCircle, ClipboardCheck, ClipboardX,
  HelpCircle, Link2Off, PenLine, RotateCcw, Stethoscope, UserPlus, XCircle,
} from 'lucide-react';
import { inicioSemanaNoFuso, isoDateNoFuso } from './dateLimits.js';
import { diferencaDias, hojeDaClinica, instanteMs, somarDias } from './datasClinica.js';

export const TIPO_META = {
  AGENDA_NOVO: { Icon: CalendarPlus, iconClass: 'text-[#00a88e] bg-teal-50' },
  AGENDA_CANCELADO: { Icon: CalendarX, iconClass: 'text-red-600 bg-red-50' },
  AGENDA_REAGENDADO: { Icon: CalendarClock, iconClass: 'text-blue-600 bg-blue-50' },
  CONFIRMACAO_CONFIRMOU: { Icon: CheckCircle, iconClass: 'text-emerald-600 bg-emerald-50' },
  CONFIRMACAO_RECUSOU: { Icon: XCircle, iconClass: 'text-red-600 bg-red-50' },
  CONFIRMACAO_SEM_RESPOSTA: { Icon: HelpCircle, iconClass: 'text-amber-600 bg-amber-50' },
  ANAMNESE_RESPONDIDA: { Icon: ClipboardCheck, iconClass: 'text-violet-600 bg-violet-50' },
  ANAMNESE_VENCIDA: { Icon: ClipboardX, iconClass: 'text-amber-600 bg-amber-50' },
  TERMO_ASSINADO: { Icon: PenLine, iconClass: 'text-[#0f766e] bg-teal-50' },
  TERMO_LINK_EXPIRADO: { Icon: Link2Off, iconClass: 'text-orange-600 bg-orange-50' },
  CONSULTA_ENCERRADA: { Icon: Stethoscope, iconClass: 'text-rose-600 bg-rose-50' },
  EQUIPE_NOVO_MEMBRO: { Icon: UserPlus, iconClass: 'text-pink-600 bg-pink-50' },
  RETORNO_LEMBRETE_VENCIDO: { Icon: RotateCcw, iconClass: 'text-slate-500 bg-slate-100' },
};

export const getTipoMeta = (codigo) =>
  TIPO_META[codigo] || { Icon: HelpCircle, iconClass: 'text-[#64748b] bg-[#f1f5f9]' };

export const ICONE_URGENTE = BellRing;

/** Chips: "todas" + um por grupo; o grupo vem do prefixo do código do tipo. */
export const CHIP_FILTERS = [
  { id: 'todas', label: 'Todas' },
  { id: 'AGENDA', label: 'Agenda' },
  { id: 'CONFIRMACAO', label: 'Confirmações' },
  { id: 'ANAMNESE', label: 'Fichas' },
  { id: 'TERMOS', label: 'Termos' },
  { id: 'ATENDIMENTO', label: 'Consulta' },
  { id: 'ACESSO', label: 'Equipe' },
];

const GRUPO_POR_PREFIXO = {
  AGENDA: 'AGENDA',
  CONFIRMACAO: 'CONFIRMACAO',
  ANAMNESE: 'ANAMNESE',
  TERMO: 'TERMOS',
  CONSULTA: 'ATENDIMENTO',
  EQUIPE: 'ACESSO',
};

export const grupoDoTipo = (codigo) => GRUPO_POR_PREFIXO[String(codigo || '').split('_')[0]] || null;

export const GRUPO_LABELS = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Esta semana',
  anteriores: 'Anteriores',
};
export const GRUPO_ORDER = ['hoje', 'ontem', 'semana', 'anteriores'];

/** Contrato do back (tipo/autor/lidaEm) -> formato usado pelas telas. */
export function normalizarNotificacao(n) {
  return {
    ...n,
    tipo: n.tipo.codigo,
    tipoNome: n.tipo.nome,
    nivel: n.tipo.nivel.codigo,
    acendeSino: n.tipo.nivel.acendeSino,
    lida: n.lidaEm != null,
    motivo: n.motivo,
    autorNome: n.autor?.nome,
    pacienteNome: n.paciente?.nome,
  };
}

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

/** n = item normalizado { tipo: 'CODIGO', payload } */
export function formatarMensagemNotificacao(n) {
  const p = lerPayload(n?.payload);
  const nome = n?.pacienteNome || p.pacienteNome || 'Paciente';
  const q = formatarQuando(p.dataAgendamento, p.horaInicio);
  const em = q ? ` em ${q}` : '';
  const termo = p.termoNome ? ` "${p.termoNome}"` : '';
  const proc = p.procedimentoNome ? ` (${p.procedimentoNome})` : '';
  switch (n?.tipo) {
    case 'AGENDA_NOVO': return `Novo agendamento: ${nome}${em}${proc}`;
    case 'AGENDA_CANCELADO': return `Agendamento de ${nome}${em}${proc} cancelado`;
    case 'AGENDA_REAGENDADO': {
      const de = formatarQuando(p.dataAntiga, p.horarioAntigo);
      const para = formatarQuando(p.dataNova ?? p.dataAgendamento, p.horarioNovo ?? p.horaInicio);
      return `Agendamento de ${nome} reagendado${de ? ` de ${de}` : ''}${para ? ` para ${para}` : ''}${proc}`;
    }
    case 'CONFIRMACAO_CONFIRMOU': return `${nome} confirmou presença${em}${proc}`;
    case 'CONFIRMACAO_RECUSOU': return `${nome} recusou${em}${proc}`;
    case 'CONFIRMACAO_SEM_RESPOSTA': return `${nome} não respondeu${em}${proc}`;
    case 'ANAMNESE_RESPONDIDA': return `${nome} respondeu a ficha de anamnese`;
    case 'ANAMNESE_VENCIDA': return `Ficha de ${nome} vencida${q ? ` · horário em ${q}` : ''}`;
    case 'TERMO_ASSINADO': return `${nome} assinou o termo${termo}`;
    case 'TERMO_LINK_EXPIRADO': return `O link do termo${termo} de ${nome} expirou sem assinatura`;
    case 'CONSULTA_ENCERRADA': {
      const por = p.profissionalNome || n?.autorNome;
      return `Consulta de ${nome} encerrada${por ? ` por ${por}` : ''}`;
    }
    case 'EQUIPE_NOVO_MEMBRO': return `${p.membroNome || 'Um novo membro'} entrou na equipe${p.membroPerfil ? ` como ${p.membroPerfil}` : ''}`;
    default: return n?.tipoNome || n?.tipo || '';
  }
}

/** Dia de calendário no fuso da clínica (corrige o "há 1 dias"). */
export function formatarTempoRelativo(iso, agoraMs = Date.now(), fuso) {
  if (!iso) return '';
  const ms = instanteMs(iso);
  if (Number.isNaN(ms)) return '';
  const diff = (agoraMs - ms) / 1000;
  if (diff < 60) return 'agora há pouco';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  const dias = diferencaDias(isoDateNoFuso(ms, fuso), hojeDaClinica(fuso, agoraMs));
  if (dias <= 0) return `há ${Math.floor(diff / 3600)} h`;
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

const PAPEL_DO_TIPO = {
  ANAMNESE_RESPONDIDA: 'QUEM_ENVIOU_O_LINK',
  TERMO_ASSINADO: 'QUEM_ENVIOU_O_LINK',
  TERMO_LINK_EXPIRADO: 'QUEM_ENVIOU_O_LINK',
  CONSULTA_ENCERRADA: 'PROFISSIONAL_DA_CONSULTA',
};

/** "Você recebe porque…" pelo motivo do contrato (sem nome no acompanhamento). */
export function motivoTexto(item) {
  switch (item?.motivo) {
    case 'PAPEL_NO_FATO': {
      const papel = PAPEL_DO_TIPO[item.tipo];
      if (papel === 'QUEM_ENVIOU_O_LINK') return 'Você recebe porque enviou o link';
      if (papel === 'PROFISSIONAL_DA_CONSULTA') return 'Você recebe porque a consulta é sua';
      return 'Você recebe porque o horário é seu';
    }
    case 'PERFIL_EXTRA': return 'Você recebe pelo seu perfil de acesso';
    case 'PESSOA_EXTRA': return 'A clínica incluiu você neste aviso';
    case 'ACOMPANHAMENTO':
      return PAPEL_DO_TIPO[item.tipo] === 'PROFISSIONAL_DA_CONSULTA'
        ? 'Você recebe porque acompanha o profissional desta consulta'
        : 'Você recebe porque acompanha o profissional deste horário';
    default: return '';
  }
}

export function matchesChip(notificacao, chipId) {
  if (!chipId || chipId === 'todas') return true;
  return grupoDoTipo(notificacao?.tipo) === chipId;
}

/**
 * @param {string|Date} criadoEm instante (ISO com "Z")
 * @param {string} fuso fuso IANA da clínica
 * @param {number} [agoraMs]
 * @returns {'hoje'|'ontem'|'semana'|'anteriores'}
 */
export function grupoTemporal(criadoEm, fuso, agoraMs = Date.now()) {
  const dia = isoDateNoFuso(criadoEm, fuso);
  const hoje = hojeDaClinica(fuso, agoraMs);
  if (dia === hoje) return 'hoje';
  if (dia === somarDias(hoje, -1)) return 'ontem';

  const inicioSemana = inicioSemanaNoFuso(fuso, agoraMs);
  if (dia && dia >= inicioSemana && dia < hoje) return 'semana';
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

/** @param {object[]} items @param {string} chipId @param {string} fuso */
export function groupNotificacoes(items, chipId, fuso) {
  const filtered = filterByChip(items, chipId);
  const groups = { hoje: [], ontem: [], semana: [], anteriores: [] };
  for (const n of filtered) {
    groups[grupoTemporal(n.criadoEm, fuso)].push(n);
  }
  return groups;
}
