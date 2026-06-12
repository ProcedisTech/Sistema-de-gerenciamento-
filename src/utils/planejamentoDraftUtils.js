import {
  coerceSessoesArray,
  pickSessaoAtiva,
  pickSessaoRetornoAtiva,
} from './planejamentoSessoes.js';

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

export function formatDataLongaPt(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

/** Data curta DD/MM/AAAA (ex.: linha "Agendado em …"). */
export function formatDataPt(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

export function parseIsoDateOnly(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sortItensPorData(itens) {
  const list = Array.isArray(itens) ? [...itens] : [];
  return list.sort((a, b) => {
    const da = parseIsoDateOnly(a?.dataPlanejada);
    const db = parseIsoDateOnly(b?.dataPlanejada);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });
}

export function calcIntervaloDias(isoA, isoB) {
  const da = parseIsoDateOnly(isoA);
  const db = parseIsoDateOnly(isoB);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function calcResumoProtocolo(itens) {
  const list = Array.isArray(itens) ? itens : [];
  const total = list.length;
  const datas = list
    .map((i) => parseIsoDateOnly(i?.dataPlanejada))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  const valorTotal = list.reduce((acc, i) => {
    const v = Number(i?.valorOrcado);
    return Number.isFinite(v) ? acc + v : acc;
  }, 0);
  return {
    total,
    periodo: {
      inicio: datas[0] ? datas[0].toISOString().slice(0, 10) : null,
      fim: datas.length ? datas[datas.length - 1].toISOString().slice(0, 10) : null,
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
  const id = raw?.id ? String(raw.id).trim() : null;
  const sessoes = coerceSessoesArray(raw);
  return {
    id: isRealUuid(id) ? id : null,
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
    sessaoRetornoAtiva: raw?.sessaoRetornoAtiva ?? pickSessaoRetornoAtiva(sessoes),
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
