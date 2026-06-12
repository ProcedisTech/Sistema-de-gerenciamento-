import { STATUS_PROCEDIMENTO_FINALIZADO_ID } from '../constants/statusProcedimento.js';
import {
  coerceSessoesArray,
  pickSessaoAtiva,
  pickSessaoRetornoAtiva,
} from './planejamentoSessoes.js';



function normalizeListaPlanejamentos(payload) {

  if (payload == null) return [];

  if (Array.isArray(payload)) return payload;

  const c =

    payload.content ??

    payload.items ??

    payload.data ??

    payload.planejamentos ??

    payload.lista ??

    [];

  return Array.isArray(c) ? c : [];

}



function catalogoFromItem(raw) {

  if (!raw || typeof raw !== 'object') return { id: '', nome: '' };

  const catSaude = raw.catalogoProcedimentoSaude ?? {};

  const cat =

    raw.catalogo ??

    raw.procedimento ??

    raw.catalogoProcedimento ??

    (typeof catSaude === 'object' ? catSaude : {});

  const id =

    raw.catalogoProcedimentoSaudeId ??

    catSaude.id ??

    catSaude.catalogoProcedimentoSaudeId ??

    cat.id ??

    cat.catalogoProcedimentoSaudeId ??

    cat.catalogoId ??

    '';

  const nome =

    cat.nomeProcedimento ??

    cat.nome ??

    catSaude.nomeProcedimento ??

    catSaude.nome ??

    cat.catalogoProcedimento?.nomeProcedimento ??

    cat.catalogoProcedimento?.nome ??

    raw.catalogoProcedimentoNome ??

    raw.catalogoNome ??

    raw.nomeProcedimento ??

    raw.nome_procedimento ??

    raw.catalogo_procedimento_nome ??

    raw.procedimentoNome ??

    '';

  return { id: id != null ? String(id).trim() : '', nome: String(nome ?? '').trim() };

}



export function enriquecerNomeCatalogoItens(itens, catalogoOptions) {

  const list = Array.isArray(itens) ? itens : [];

  const opts = Array.isArray(catalogoOptions) ? catalogoOptions : [];

  if (list.length === 0 || opts.length === 0) return list;

  const byId = Object.fromEntries(

    opts

      .map((o) => {

        const id = String(o.id ?? o.catalogoProcedimentoSaudeId ?? '').trim();

        const nome = String(o.nomeProcedimento ?? o.nome ?? '').trim();

        return id && nome ? [id, nome] : null;

      })

      .filter(Boolean),

  );

  return list.map((item) => {

    if (item.catalogoNome) return item;

    const catId = String(item.catalogoId ?? item.catalogoProcedimentoSaudeId ?? '').trim();

    const nome = catId ? byId[catId] : '';

    return nome ? { ...item, catalogoNome: nome } : item;

  });

}



export function enriquecerPlanosComCatalogo(planos, catalogoOptions) {

  return (Array.isArray(planos) ? planos : []).map((plano) => ({

    ...plano,

    itens: enriquecerNomeCatalogoItens(plano.itens, catalogoOptions),

  }));

}



export function normalizePlanoItem(raw) {

  if (!raw || typeof raw !== 'object') return null;

  const id = raw.planejamentoItemId ?? raw.id ?? raw.itemId;

  if (id == null || String(id).trim() === '') return null;

  const cat = catalogoFromItem(raw);
  const sessoes = coerceSessoesArray(raw);

  return {

    id: String(id),

    catalogoId: cat.id,

    catalogoProcedimentoSaudeId: cat.id,

    catalogoNome: cat.nome,

    valorOrcado: raw.valorOrcado ?? raw.valor ?? null,

    dataPlanejada: raw.dataPlanejada ?? raw.data ?? null,

    statusItem:
      raw.statusItem ??
      raw.statusItemCodigo ??
      raw.status ??
      raw.statusProcedimento?.codigo ??
      raw.statusProcedimentoCodigo ??
      (raw.statusProcedimentoId === STATUS_PROCEDIMENTO_FINALIZADO_ID ? 'finalizado' : null),

    statusItemNome:
      raw.statusItemNome ?? raw.statusNome ?? raw.statusProcedimento?.nome ?? null,

    sessaoAtiva: pickSessaoAtiva(sessoes),

    sessaoRetornoAtiva: pickSessaoRetornoAtiva(sessoes),

  };

}



export function normalizePlano(raw) {

  if (!raw || typeof raw !== 'object') return null;

  const id = raw.planejamentoId ?? raw.id;

  if (id == null || String(id).trim() === '') return null;

  const itensRaw = raw.itens ?? raw.items ?? [];

  const itens = (Array.isArray(itensRaw) ? itensRaw : [])

    .map(normalizePlanoItem)

    .filter(Boolean);

  const progressoRaw = raw.progresso;

  const progresso =

    progressoRaw == null || progressoRaw === ''

      ? null

      : Math.min(1, Math.max(0, Number(progressoRaw)));

  return {

    id: String(id),

    statusCodigo: String(raw.statusCodigo ?? raw.status ?? '').trim().toLowerCase(),

    statusNome: raw.statusNome ?? raw.statusLabel ?? null,

    criadoEm: raw.criadoEm ?? raw.createdAt ?? null,

    concluidoEm: raw.concluidoEm ?? null,

    encerradoEm: raw.encerradoEm ?? null,

    valorTotal: raw.valorTotal ?? raw.valor ?? null,

    observacao: raw.observacao ?? '',

    progresso: Number.isFinite(progresso) ? progresso : null,

    itens,

  };

}



export function normalizeListaPlanos(payload) {

  return normalizeListaPlanejamentos(payload)

    .map(normalizePlano)

    .filter(Boolean);

}


