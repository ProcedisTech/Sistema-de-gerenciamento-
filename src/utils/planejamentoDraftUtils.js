import {
  coerceSessoesArray,
  pickSessaoAtiva,
  pickSessaoRealizada,
  pickSessaoRetornoAtiva,
  pickSessaoRetornoRealizada,
} from './planejamentoSessoes.js';
import {
  compararCalendario,
  diferencaDias,
  formatarDataCalendario,
  normalizarDataCalendario,
} from './datasClinica.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRealUuid(id) {
  return id != null && UUID_RE.test(String(id).trim());
}

export function createTempId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `temp-${crypto.randomUUID()}`;
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Data de calendário por extenso curto (ex.: "1 de out. de 2026"). */
export function formatDataLongaPt(iso) {
  if (!iso) return '—';
  return (
    formatarDataCalendario(iso, { day: 'numeric', month: 'short', year: 'numeric' }) || String(iso)
  );
}

/** Data de calendário curta DD/MM/AAAA (ex.: linha "Agendado em …"). */
export function formatDataPt(iso) {
  if (!iso) return '—';
  return formatarDataCalendario(iso, 'curta') || String(iso);
}

/** Normaliza mapa { catalogoProcedimentoSaudeId → planejamentoItemId } para lookup no POST. */
export function normalizePlanoItemIdMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const ck = String(k ?? '').trim();
    const cv = String(v ?? '').trim();
    if (ck && cv && isRealUuid(cv)) out[ck] = cv;
  }
  return out;
}

/**
 * Resolve planejamentoItemId para um procedimento no save de agenda.
 * Fallback: mapa por catálogo → único valor do mapa (1 proc) → vínculo explícito.
 */
/** Mapa catálogo → item de plano a partir das options de iniciar atendimento (slot/lote). */
export function itemIdByCatalogoFromAttendanceOptions(options = {}) {
  const out = {};
  const add = (catRaw, itemRaw) => {
    const cat = catRaw != null ? String(catRaw).trim() : '';
    const item = itemRaw != null ? String(itemRaw).trim() : '';
    if (cat && item) out[cat] = item;
  };
  add(options.catalogoProcedimentoSaudeId, options.planejamentoItemId);
  if (Array.isArray(options.lote)) {
    for (const row of options.lote) {
      add(row?.catalogoProcedimentoSaudeId, row?.planejamentoItemId);
    }
  }
  return out;
}

export function resolvePlanejamentoItemIdForCatalogo(catalogoProcedimentoSaudeId, mapa, vinculoExplicito) {
  const catId = String(catalogoProcedimentoSaudeId ?? '').trim();
  const map = normalizePlanoItemIdMap(mapa);
  if (catId && map[catId]) return map[catId];

  const valores = Object.values(map);
  if (valores.length === 1) return valores[0];

  const explicito = String(vinculoExplicito ?? '').trim();
  if (explicito && isRealUuid(explicito)) return explicito;

  return null;
}

export function formatValorBrl(val) {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Máscara pt-BR para input de valor (centavos implícitos, ex.: 150000 → 1.500,00). */
export function maskValorBrlInput(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 15);
  if (!digits) return '';
  const n = Number(digits) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte string mascarada em número para envio ao backend. */
export function parseValorBrlInput(display) {
  const digits = String(display ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits) / 100;
}

/** Inicializa campo mascarado a partir de valor numérico existente. */
export function valorBrlDisplayFromNumber(val) {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  return maskValorBrlInput(String(Math.round(n * 100)));
}

export function sortItensPorData(itens) {
  const list = Array.isArray(itens) ? [...itens] : [];
  return list.sort((a, b) => compararCalendario(a?.dataPlanejada, b?.dataPlanejada));
}

export function calcIntervaloDias(isoA, isoB) {
  const dias = diferencaDias(isoA, isoB);
  return Number.isNaN(dias) ? null : dias;
}

export function calcResumoProtocolo(itens) {
  const list = Array.isArray(itens) ? itens : [];
  const total = list.length;
  const datas = list
    .map((i) => normalizarDataCalendario(i?.dataPlanejada))
    .filter(Boolean)
    .sort();
  const valorTotal = list.reduce((acc, i) => {
    const v = Number(i?.valorOrcado);
    return Number.isFinite(v) ? acc + v : acc;
  }, 0);
  return {
    total,
    periodo: {
      inicio: datas[0] ?? null,
      fim: datas.length ? datas[datas.length - 1] : null,
    },
    valorTotal: list.some((i) => i?.valorOrcado != null && String(i.valorOrcado).trim() !== '')
      ? valorTotal
      : null,
  };
}


function normalizeDraftItemForCompare(item) {
  return {
    id: item.id ?? null,
    catalogoProcedimentoSaudeId: String(item.catalogoProcedimentoSaudeId ?? item.catalogoId ?? '').trim(),
    valorOrcado:
      item.valorOrcado == null || String(item.valorOrcado).trim() === ''
        ? null
        : Number(item.valorOrcado),
    dataPlanejada: item.dataPlanejada ? String(item.dataPlanejada).slice(0, 10) : null,
  };
}

export function normalizeDraftSnapshot(observacao, itens) {
  const sorted = [...(Array.isArray(itens) ? itens : [])].sort((a, b) => {
    const ka = String(a.id ?? a.tempId ?? '');
    const kb = String(b.id ?? b.tempId ?? '');
    return ka.localeCompare(kb);
  });
  return JSON.stringify({
    observacao: String(observacao ?? '').trim(),
    itens: sorted.map(normalizeDraftItemForCompare),
  });
}

export function draftToPutItens(itens) {
  return (Array.isArray(itens) ? itens : []).map((item) => {
    const catalogoProcedimentoSaudeId = String(
      item.catalogoProcedimentoSaudeId ?? item.catalogoId ?? '',
    ).trim();
    const body = { catalogoProcedimentoSaudeId };
    if (isRealUuid(item.id)) {
      body.id = String(item.id).trim();
    }
    if (item.valorOrcado != null && String(item.valorOrcado).trim() !== '') {
      const v = Number(item.valorOrcado);
      if (Number.isFinite(v)) body.valorOrcado = v;
    }
    if (item.dataPlanejada != null && String(item.dataPlanejada).trim() !== '') {
      body.dataPlanejada = String(item.dataPlanejada).slice(0, 10);
    }
    return body;
  });
}

export function planoItemToDraftItem(raw, tipoCodigo = '') {
  const rawId = raw?.planejamentoItemId || raw?.id;
  const id = rawId ? String(rawId).trim() : null;
  const validUuid = isRealUuid(id) ? id : null;
  const sessoes = coerceSessoesArray(raw);
  return {
    id: validUuid,
    planejamentoItemId: validUuid,
    tempId: id || createTempId(),
    catalogoProcedimentoSaudeId: String(
      raw?.catalogoProcedimentoSaudeId ?? raw?.catalogoId ?? '',
    ).trim(),
    catalogoNome: String(raw?.catalogoNome ?? '').trim(),
    tipoCodigo: String(tipoCodigo ?? '').trim().toLowerCase(),
    valorOrcado: raw?.valorOrcado ?? null,
    dataPlanejada: raw?.dataPlanejada ? String(raw.dataPlanejada).slice(0, 10) : null,
    statusItem: raw?.statusItem ?? null,
    statusItemNome: raw?.statusItemNome ?? null,
    sessaoAtiva: raw?.sessaoAtiva ?? pickSessaoAtiva(sessoes),
    sessaoRealizada: raw?.sessaoRealizada ?? pickSessaoRealizada(sessoes),
    sessaoRetornoAtiva: raw?.sessaoRetornoAtiva ?? pickSessaoRetornoAtiva(sessoes),
    sessaoRetornoRealizada: raw?.sessaoRetornoRealizada ?? pickSessaoRetornoRealizada(sessoes),
  };
}

export function enriquecerDraftItemTipo(item, catalogoOptions) {
  const catId = String(item.catalogoProcedimentoSaudeId ?? item.catalogoId ?? '').trim();
  const opt = (Array.isArray(catalogoOptions) ? catalogoOptions : []).find(
    (o) => String(o.id ?? '').trim() === catId,
  );
  const tipoCodigo = String(opt?.tipoCodigo ?? item.tipoCodigo ?? '').trim().toLowerCase();
  const catalogoNome =
    item.catalogoNome ||
    String(opt?.nomeProcedimento ?? opt?.nome ?? '').trim() ||
    'Procedimento';
  return { ...item, tipoCodigo, catalogoNome };
}
