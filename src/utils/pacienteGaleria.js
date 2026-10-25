import { resolveApiUrl } from '../config/apiEnv.js';
import { diaDoInstante, formatarDataCalendario, instanteMs, normalizarDataCalendario } from './datasClinica.js';
import { getApiErrorDetail, MENSAGEM_SESSAO_EXPIRADA } from '../services/api.js';

/** Chaves persistidas no prefixo da legenda: `[antes] …` (sem mudança no backend). */
export const GALERIA_CATEGORIA = {
  ANTES: 'antes',
  PLANEJAMENTO: 'planejamento',
  DEPOIS: 'depois',
  MAPA: 'mapa',
  AVALIACAO: 'avaliacao',
  MODELO: 'modelo',
  OUTRO: 'outro',
};

export const GALERIA_CATEGORIA_LABELS = {
  antes: 'Antes',
  planejamento: 'Planejamento',
  depois: 'Depois',
  mapa: 'Mapa de Aplicação',
  avaliacao: 'Avaliação',
  modelo: 'Modelo',
  outro: 'Outros',
};

const LEGENDA_TAG_RE = /^\[(antes|depois|planejamento|avaliac[aã]o|modelo|mapa)\]\s*(.*)$/i;

/**
 * Lê categoria, flag de avulso e texto livre da legenda enviada/recuperada da API.
 */
export function parseGaleriaLegenda(legenda) {
  const s = typeof legenda === 'string' ? legenda.trim() : '';
  if (!s) return { categoria: GALERIA_CATEGORIA.OUTRO, descricao: null, isAvulso: false };
  const isAvulso = /\[avulso\]/i.test(s);
  const m = s.match(LEGENDA_TAG_RE);
  if (m) {
    const catRaw = m[1]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const catNorm =
      catRaw === 'avaliacao'
        ? GALERIA_CATEGORIA.AVALIACAO
        : catRaw === 'modelo'
          ? GALERIA_CATEGORIA.MODELO
          : catRaw;
    const descLimpa = m[2].replace(/\[avulso\]/gi, '').trim() || null;
    return {
      categoria: catNorm,
      descricao: descLimpa,
      isAvulso,
    };
  }
  if (/mapeamento|avalia(ç|c)(ã|a)o/i.test(s)) {
    return {
      categoria: GALERIA_CATEGORIA.PLANEJAMENTO,
      descricao: s.replace(/\[avulso\]/gi, '').trim() || null,
      isAvulso,
    };
  }
  return {
    categoria: GALERIA_CATEGORIA.OUTRO,
    descricao: s.replace(/\[avulso\]/gi, '').trim() || null,
    isAvulso,
  };
}

/**
 * Monta legenda para upload (categoria obrigatória + descrição opcional, ex. nome do procedimento).
 * Permite marcar flag isAvulso gerando tag clínica padronizada [categoria] [avulso] descrição.
 */
export function formatGaleriaLegendaForUpload(categoria, descricaoLivre = '', { isAvulso = false } = {}) {
  const allowed = new Set(Object.values(GALERIA_CATEGORIA));
  let cat = String(categoria || '').toLowerCase().trim();
  if (!allowed.has(cat)) cat = GALERIA_CATEGORIA.ANTES;
  const d = String(descricaoLivre || '').replace(/\[avulso\]/gi, '').trim();
  const avulsoTag = isAvulso ? ' [avulso]' : '';
  return d ? `[${cat}]${avulsoTag} ${d}` : `[${cat}]${avulsoTag}`;
}

function msOuZero(v) {
  const ms = instanteMs(v);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Dia (AAAA-MM-DD) da foto: `dataReferencia` é calendário; sem ela, o dia em que `createdAt` (instante) aconteceu na clínica.
 * @param {string} [fuso] IANA da clínica (ausente → fuso padrão)
 */
export function itemDataReferenciaISO(item, fuso) {
  if (item?.dataReferencia != null && String(item.dataReferencia).trim()) {
    const dia = normalizarDataCalendario(item.dataReferencia);
    if (dia) return dia;
  }
  if (item?.createdAt) {
    const dia = diaDoInstante(item.createdAt, fuso);
    if (dia) return dia;
  }
  return null;
}

/** YYYY-MM para filtros por mês. */
export function itemMesReferenciaISO(item, fuso) {
  const d = itemDataReferenciaISO(item, fuso);
  return d ? d.slice(0, 7) : null;
}

export function formatDataSessaoPtBr(dataISO) {
  if (!dataISO || dataISO === 'sem-data') return '—';
  return formatarDataCalendario(dataISO) || String(dataISO);
}

export function formatMesAnoCurtoPt(dataISO) {
  if (!dataISO || dataISO === 'sem-data') return '';
  const month = parseInt(dataISO.slice(5, 7), 10);
  const y = dataISO.slice(0, 4);
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  if (!month || month < 1 || month > 12) return y;
  return `${meses[month - 1]}/${y}`;
}

/**
 * Filtro client-side antes de agrupar sessões.
 */
export function filterGaleriaItemsForUi(items, filters) {
  const categoria = filters?.categoria;
  const mesAno = filters?.mesAno;
  const procedimentoToken = filters?.procedimentoToken;
  const fuso = filters?.fuso;
  return (items || []).filter((it) => {
    if (categoria && categoria !== 'all' && it.categoria !== categoria) return false;
    if (mesAno && mesAno !== 'all') {
      const m = itemMesReferenciaISO(it, fuso);
      if (m !== mesAno) return false;
    }
    if (procedimentoToken && procedimentoToken !== 'all') {
      const hay = `${it.nomeProcedimento || ''} ${it.descricaoLegenda || ''}`.toLowerCase();
      if (!hay.includes(String(procedimentoToken).toLowerCase())) return false;
    }
    return true;
  });
}

/**
 * Agrupa fotos em “sessões” (data de referência), ordena fotos Antes → Planejamento/Avaliação → Depois.
 * @param {string} [fuso] IANA da clínica (ausente → fuso padrão)
 */
export function groupGaleriaItemsBySession(items, fuso) {
  const groups = new Map();
  for (const it of items || []) {
    const dataISO = itemDataReferenciaISO(it, fuso) || 'sem-data';
    const feitoId = it.procedimentoFeitoId != null && String(it.procedimentoFeitoId).trim() !== ''
      ? String(it.procedimentoFeitoId).trim()
      : null;
    const atendId = it.atendimentoId != null && String(it.atendimentoId).trim() !== ''
      ? String(it.atendimentoId).trim()
      : null;
    const key = feitoId ? `${dataISO}_${feitoId}` : (atendId ? `${dataISO}_${atendId}` : dataISO);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        dataISO,
        fotos: [],
        _nomesSet: new Set(),
      });
    }
    const g = groups.get(key);
    const nome = (it.nomeProcedimento || '').trim();
    if (nome) g._nomesSet.add(nome);
    g.fotos.push(it);
  }

  for (const g of groups.values()) {
    g.nomeProcedimento =
      Array.from(g._nomesSet).join(', ') || 'Consulta / Avaliação';
    delete g._nomesSet;
  }

  const order = { antes: 0, planejamento: 1, avaliacao: 2, mapa: 3, depois: 4, outro: 5 };
  for (const g of groups.values()) {
    g.fotos.sort((a, b) => {
      const da = order[a.categoria] ?? 99;
      const db = order[b.categoria] ?? 99;
      if (da !== db) return da - db;
      return msOuZero(a.createdAt) - msOuZero(b.createdAt);
    });
  }

  const arr = Array.from(groups.values());
  const sortedAsc = [...arr].sort((a, b) => {
    if (a.dataISO === 'sem-data') return 1;
    if (b.dataISO === 'sem-data') return -1;
    if (a.dataISO !== b.dataISO) {
      return a.dataISO.localeCompare(b.dataISO);
    }
    return msOuZero(a.fotos[0]?.createdAt) - msOuZero(b.fotos[0]?.createdAt);
  });
  const sessionNumberByKey = new Map(sortedAsc.map((s, idx) => [s.key, idx + 1]));

  for (const s of arr) {
    s.sessionNumber = sessionNumberByKey.get(s.key) || 0;
  }

  arr.sort((a, b) => {
    if (a.dataISO === 'sem-data') return 1;
    if (b.dataISO === 'sem-data') return -1;
    if (a.dataISO !== b.dataISO) {
      return b.dataISO.localeCompare(a.dataISO);
    }
    return (b.sessionNumber || 0) - (a.sessionNumber || 0);
  });

  return arr;
}

/**
 * Normaliza JSON da galeria quando o GET retorna 200.
 * Contrato Spring: { fotos: [ { id, url, dataReferencia, registradoEm, legenda, … } ] }
 * (também aceita array direto, itens, content — legado / stubs).
 *
 * url costuma ser path /api/v1/pacientes/{pacienteId}/galeria/{fotoId}/arquivo?v=…
 */
export function normalizePacienteGaleriaResponse(data) {
  if (data == null) return [];
  let rows = [];
  if (Array.isArray(data)) rows = data;
  else if (Array.isArray(data.fotos)) rows = data.fotos;
  else if (Array.isArray(data.itens)) rows = data.itens;
  else if (Array.isArray(data.content)) rows = data.content;

  const out = [];
  for (const raw of rows) {
    const item = normalizePacienteGaleriaItem(raw);
    if (item) out.push(item);
  }
  return out;
}

function absolutizeUrl(u) {
  if (!u || typeof u !== 'string') return '';
  const t = u.trim();
  if (!t) return '';
  if (t.startsWith('data:')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  const path = t.startsWith('/') ? t : `/${t}`;
  return resolveApiUrl(path);
}

export function normalizePacienteGaleriaItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.foto && typeof raw.foto === 'object') return normalizePacienteGaleriaItem(raw.foto);
  if (raw.item && typeof raw.item === 'object') return normalizePacienteGaleriaItem(raw.item);
  const url = raw.url || raw.urlFoto || raw.urlPublica || raw.link || raw.caminho;
  if (!url) return null;
  const id = raw.id ?? raw.fotoId;
  if (id == null || id === '') return null;
  const legenda = typeof raw.legenda === 'string' ? raw.legenda.trim() : '';
  const parsed = parseGaleriaLegenda(legenda);
  const nomeProcedimento =
    (typeof raw.procedimentoNome === 'string' && raw.procedimentoNome.trim()) ||
    (typeof raw.nomeProcedimento === 'string' && raw.nomeProcedimento.trim()) ||
    null;
  const procedimentoFeitoId =
    raw.procedimentoFeitoId ?? raw.procedimento_feito_id ?? raw.procedimentoFeito?.id ?? null;
  const procedimentoFeitoCardId =
    raw.procedimentoFeitoCardId ?? raw.procedimento_feito_card_id ?? null;
  const tipoFotoCodigoRaw =
    raw.tipoFotoCodigo ?? raw.tipo_foto_codigo ?? raw.tipoFoto?.codigo ?? null;
  const tipoFotoCodigo =
    tipoFotoCodigoRaw != null && String(tipoFotoCodigoRaw).trim() !== ''
      ? String(tipoFotoCodigoRaw).trim().toUpperCase()
      : null;

  const agendaId =
    raw.agendaId ?? raw.agenda_id ?? raw.agenda?.id ?? null;
  const atendimentoId =
    raw.atendimentoId ?? raw.atendimento_id ?? raw.atendimento?.id ?? null;
  const planejamentoItemId =
    raw.planejamentoItemId ?? raw.planejamento_item_id ?? null;
  const planejamentoId =
    raw.planejamentoId ?? raw.planejamento_id ?? null;

  const mapaOverlayRaw = raw.mapaOverlay ?? raw.mapa_overlay ?? null;
  let mapaOverlay = null;
  if (mapaOverlayRaw && typeof mapaOverlayRaw === 'object') {
    const marcacoes = Array.isArray(mapaOverlayRaw.marcacoes)
      ? mapaOverlayRaw.marcacoes
      : [];
    const procedimentos = Array.isArray(mapaOverlayRaw.procedimentos)
      ? mapaOverlayRaw.procedimentos
      : [];
    mapaOverlay = {
      mapaId:
        mapaOverlayRaw.mapaId != null ? String(mapaOverlayRaw.mapaId) : null,
      anguloFotoCodigo:
        mapaOverlayRaw.anguloFotoCodigo != null
          ? String(mapaOverlayRaw.anguloFotoCodigo)
          : null,
      planejamentoItemId:
        mapaOverlayRaw.planejamentoItemId != null
          ? String(mapaOverlayRaw.planejamentoItemId).trim()
          : (planejamentoItemId ? String(planejamentoItemId).trim() : null),
      planejamentoId:
        mapaOverlayRaw.planejamentoId != null
          ? String(mapaOverlayRaw.planejamentoId).trim()
          : (planejamentoId ? String(planejamentoId).trim() : null),
      tipoMapaCodigo:
        mapaOverlayRaw.tipoMapaCodigo != null
          ? String(mapaOverlayRaw.tipoMapaCodigo)
          : null,
      tipoMapaNome:
        mapaOverlayRaw.tipoMapaNome != null
          ? String(mapaOverlayRaw.tipoMapaNome)
          : null,
      procedimentos,
      marcacoes,
    };
  }

  const effectivePlanejamentoItemId =
    planejamentoItemId != null && String(planejamentoItemId).trim() !== ''
      ? String(planejamentoItemId).trim()
      : mapaOverlay?.planejamentoItemId || null;

  const effectivePlanejamentoId =
    planejamentoId != null && String(planejamentoId).trim() !== ''
      ? String(planejamentoId).trim()
      : mapaOverlay?.planejamentoId || null;

  return {
    id: String(id),
    fotoId: String(id),
    serverId: String(id),
    url: absolutizeUrl(String(url)),
    tipoFotoCodigo,
    fileName:
      legenda ||
      raw.nomeArquivo ||
      raw.fileName ||
      raw.descricao ||
      raw.titulo ||
      'Foto',
    legenda: legenda || null,
    dataReferencia: raw.dataReferencia || null,
    createdAt: raw.registradoEm || raw.criadoEm || raw.dataUpload || raw.createdAt || null,
    categoria: parsed.categoria,
    descricaoLegenda: parsed.descricao,
    nomeProcedimento,
    procedimentoFeitoId: procedimentoFeitoId != null && String(procedimentoFeitoId).trim() !== '' ? String(procedimentoFeitoId) : null,
    procedimentoFeitoCardId:
      procedimentoFeitoCardId != null && String(procedimentoFeitoCardId).trim() !== ''
        ? String(procedimentoFeitoCardId)
        : null,
    agendaId: agendaId != null && String(agendaId).trim() !== '' ? String(agendaId).trim() : null,
    atendimentoId: atendimentoId != null && String(atendimentoId).trim() !== '' ? String(atendimentoId).trim() : null,
    planejamentoItemId: effectivePlanejamentoItemId,
    planejamentoId: effectivePlanejamentoId,
    mapaOverlay,
  };
}

/**
 * Prefixo `[HTTP n]` que o api.js põe na `message` (buildApiErrorMessage e o download presigned).
 * A galeria nunca mostra esse prefixo.
 */
const PREFIXO_HTTP_RE = /^\s*\[HTTP[^\]]*\]\s*/i;

/** Só o código ou a frase padrão do status (statusText do HTTP/1.1, `error` do Spring): não serve como texto. */
const FRASES_PADRAO_HTTP = new Set([
  'bad request',
  'unauthorized',
  'forbidden',
  'not found',
  'method not allowed',
  'request timeout',
  'conflict',
  'payload too large',
  'request entity too large',
  'content too large',
  'unprocessable entity',
  'unprocessable content',
  'too many requests',
  'internal server error',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
]);

function soCodigoOuVazio(texto) {
  const t = texto.trim();
  return !t || /^\d{3}$/.test(t) || FRASES_PADRAO_HTTP.has(t.toLowerCase());
}

/**
 * Texto do erro sem prefixo: primeiro o corpo do backend (getApiErrorDetail, que já junta as mensagens
 * de validação `errors[]`); sem corpo, a `message` sem o `[HTTP n]`. Vazio ou só código → ''.
 */
function textoDoErro(err) {
  const doCorpo = getApiErrorDetail(err);
  if (!soCodigoOuVazio(doCorpo)) return doCorpo.trim();
  const msg = typeof err?.message === 'string' ? err.message.replace(PREFIXO_HTTP_RE, '') : '';
  return soCodigoOuVazio(msg) ? '' : msg.trim();
}

/**
 * Mensagens amigáveis para upload/lista/delete da galeria. Nenhuma saída leva o prefixo `[HTTP n]`.
 * 401 com `sessaoExpirada` (renovação do acesso recusada, api.js): mensagem do backend; sem ela, o texto
 * de sessão expirada do api.js. Outro 401 cai no fim: mensagem do backend ou "Erro ao usar a galeria.".
 * (Importar do api.js não cria ciclo: o api.js não importa este arquivo.)
 */
export function formatPacienteGaleriaError(err) {
  const status = err?.status;
  const base = textoDoErro(err);
  if (status === 413) return 'Arquivo acima do limite permitido pelo servidor.';
  if (status === 400) return base || 'Arquivo ou dados inválidos (tipo, tamanho, legenda ou vínculos).';
  if (status === 404) return base || 'Foto ou paciente não encontrado.';
  if (status === 401 && err?.sessaoExpirada === true) {
    return base || MENSAGEM_SESSAO_EXPIRADA;
  }
  if (status === 403) {
    return base || 'Sem permissão nesta organização para esta operação na galeria.';
  }
  return base || 'Erro ao usar a galeria.';
}
