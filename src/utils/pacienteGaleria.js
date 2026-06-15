import { resolveApiUrl } from '../config/apiEnv.js';

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
 * Lê categoria e texto livre da legenda enviada/recuperada da API.
 */
export function parseGaleriaLegenda(legenda) {
  const s = typeof legenda === 'string' ? legenda.trim() : '';
  if (!s) return { categoria: GALERIA_CATEGORIA.OUTRO, descricao: null };
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
    return {
      categoria: catNorm,
      descricao: m[2].trim() || null,
    };
  }
  if (/mapeamento|avalia(ç|c)(ã|a)o/i.test(s)) {
    return { categoria: GALERIA_CATEGORIA.PLANEJAMENTO, descricao: s };
  }
  return { categoria: GALERIA_CATEGORIA.OUTRO, descricao: s };
}

/**
 * Monta legenda para upload (categoria obrigatória + descrição opcional, ex. nome do procedimento).
 */
export function formatGaleriaLegendaForUpload(categoria, descricaoLivre = '') {
  const allowed = new Set(Object.values(GALERIA_CATEGORIA));
  let cat = String(categoria || '').toLowerCase().trim();
  if (!allowed.has(cat)) cat = GALERIA_CATEGORIA.ANTES;
  const d = String(descricaoLivre || '').trim();
  return d ? `[${cat}] ${d}` : `[${cat}]`;
}

export function itemDataReferenciaISO(item) {
  if (item?.dataReferencia != null && String(item.dataReferencia).trim()) {
    const s = String(item.dataReferencia).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  if (item?.createdAt) {
    const t = new Date(item.createdAt);
    if (!Number.isNaN(t.getTime())) return t.toISOString().slice(0, 10);
  }
  return null;
}

/** YYYY-MM para filtros por mês. */
export function itemMesReferenciaISO(item) {
  const d = itemDataReferenciaISO(item);
  return d ? d.slice(0, 7) : null;
}

export function formatDataSessaoPtBr(dataISO) {
  if (!dataISO || dataISO === 'sem-data') return '—';
  const [y, m, day] = dataISO.split('-').map(Number);
  if (!y || !m || !day) return String(dataISO);
  return `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
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
  return (items || []).filter((it) => {
    if (categoria && categoria !== 'all' && it.categoria !== categoria) return false;
    if (mesAno && mesAno !== 'all') {
      const m = itemMesReferenciaISO(it);
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
 * Agrupa fotos em “sessões” (data de referência + opcional procedimento), ordena fotos Antes → Planejamento/Avaliação → Depois.
 */
export function groupGaleriaItemsBySession(items) {
  const groups = new Map();
  for (const it of items || []) {
    const dataISO = itemDataReferenciaISO(it) || 'sem-data';
    const procId =
      it.procedimentoFeitoId != null && String(it.procedimentoFeitoId).trim() !== ''
        ? String(it.procedimentoFeitoId).trim()
        : null;
    const key = `${dataISO}|${procId || '—'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        dataISO,
        procedimentoFeitoId: procId,
        nomeProcedimento: it.nomeProcedimento || null,
        fotos: [],
      });
    }
    const g = groups.get(key);
    if (!g.nomeProcedimento && it.nomeProcedimento) g.nomeProcedimento = it.nomeProcedimento;
    g.fotos.push(it);
  }

  const order = { antes: 0, planejamento: 1, avaliacao: 2, mapa: 3, depois: 4, outro: 5 };
  for (const g of groups.values()) {
    g.fotos.sort((a, b) => {
      const da = order[a.categoria] ?? 99;
      const db = order[b.categoria] ?? 99;
      if (da !== db) return da - db;
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
  }

  const arr = Array.from(groups.values());
  const sortedAsc = [...arr].sort((a, b) => {
    if (a.dataISO === 'sem-data') return 1;
    if (b.dataISO === 'sem-data') return -1;
    return a.dataISO.localeCompare(b.dataISO);
  });
  const sessionNumberByKey = new Map(sortedAsc.map((s, idx) => [s.key, idx + 1]));

  for (const s of arr) {
    s.sessionNumber = sessionNumberByKey.get(s.key) || 0;
  }

  arr.sort((a, b) => {
    if (a.dataISO === 'sem-data') return 1;
    if (b.dataISO === 'sem-data') return -1;
    return b.dataISO.localeCompare(a.dataISO);
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
  return {
    serverId: String(id),
    url: absolutizeUrl(String(url)),
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
  };
}

/** Mensagens amigáveis para upload/lista/delete da galeria (401 em JSON dispara auth:expired na api.js). */
export function formatPacienteGaleriaError(err) {
  const status = err?.status;
  const base = typeof err?.message === 'string' ? err.message.trim() : '';
  if (status === 413) return 'Arquivo acima do limite permitido pelo servidor.';
  if (status === 400) return base || 'Arquivo ou dados inválidos (tipo, tamanho, legenda ou vínculos).';
  if (status === 404) return base || 'Foto ou paciente não encontrado.';
  if (status === 401) {
    return (
      base ||
      'Não autorizado (401). Faça login de novo; confira se a organização no app bate com a do banco e se o usuário (ex.: seed-admin) tem permissão nas rotas da galeria e do arquivo no Spring. Isso não é causado por paciente novo.'
    );
  }
  if (status === 403) {
    return base || 'Sem permissão nesta organização para esta operação na galeria.';
  }
  return base || 'Erro ao usar a galeria.';
}
