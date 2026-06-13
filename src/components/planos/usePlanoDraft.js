import { useCallback, useState } from 'react';
import { normalizePlano } from '../../utils/planejamentoNormalize.js';
import {
  createTempId,
  draftToPutItens,
  enriquecerDraftItemTipo,
  normalizeDraftSnapshot,
  planoItemToDraftItem,
} from '../../utils/planejamentoDraftUtils.js';

function cloneItens(itens) {
  return (Array.isArray(itens) ? itens : []).map((i) => ({
    ...i,
    sessaoAtiva: i.sessaoAtiva ? { ...i.sessaoAtiva } : null,
    sessaoRetornoAtiva: i.sessaoRetornoAtiva ? { ...i.sessaoRetornoAtiva } : null,
  }));
}

function itemKey(item) {
  return String(item?.id ?? item?.tempId ?? '');
}

export function usePlanoDraft() {
  const [draftByPlanoId, setDraftByPlanoId] = useState({});

  const getDraft = useCallback(
    (planoId) => draftByPlanoId[String(planoId)] ?? null,
    [draftByPlanoId],
  );

  const hydrateFromPlano = useCallback((plano, catalogoOptions = []) => {
    const planoId = String(plano?.id ?? '').trim();
    if (!planoId) return;

    const observacao = String(plano.observacao ?? '').trim();
    const itens = (Array.isArray(plano.itens) ? plano.itens : []).map((raw) =>
      enriquecerDraftItemTipo(planoItemToDraftItem(raw), catalogoOptions),
    );

    const snapshot = { observacao, itens: itens.map((i) => ({ ...i })) };

    setDraftByPlanoId((prev) => ({
      ...prev,
      [planoId]: {
        observacao,
        itens,
        baseline: {
          observacao,
          itens: cloneItens(itens),
        },
      },
    }));

    return snapshot;
  }, []);

  const initEmptyDraft = useCallback((planoId) => {
    const id = String(planoId ?? '').trim();
    if (!id) return;
    setDraftByPlanoId((prev) => {
      if (prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          observacao: '',
          itens: [],
          baseline: { observacao: '', itens: [] },
        },
      };
    });
  }, []);

  const setObservacao = useCallback((planoId, text) => {
    const id = String(planoId ?? '').trim();
    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, observacao: String(text ?? '') } };
    });
  }, []);

  const addItem = useCallback((planoId, fields, catalogoOptions = []) => {
    const id = String(planoId ?? '').trim();
    const tempId = createTempId();
    const base = {
      id: null,
      tempId,
      catalogoProcedimentoSaudeId: String(fields.catalogoProcedimentoSaudeId ?? '').trim(),
      catalogoNome: String(fields.catalogoNome ?? '').trim(),
      tipoCodigo: String(fields.tipoCodigo ?? '').trim().toLowerCase(),
      valorOrcado:
        fields.valorOrcado != null && String(fields.valorOrcado).trim() !== ''
          ? Number(fields.valorOrcado)
          : null,
      dataPlanejada: fields.dataPlanejada ? String(fields.dataPlanejada).slice(0, 10) : null,
      statusItem: null,
      statusItemNome: null,
      sessaoAtiva: null,
      sessaoRetornoAtiva: null,
    };
    const item = enriquecerDraftItemTipo(base, catalogoOptions);
    setDraftByPlanoId((prev) => {
      const cur = prev[id] ?? {
        observacao: '',
        itens: [],
        baseline: { observacao: '', itens: [] },
      };
      return { ...prev, [id]: { ...cur, itens: [...cur.itens, item] } };
    });
  }, []);

  const updateItem = useCallback((planoId, key, patch, catalogoOptions = []) => {
    const id = String(planoId ?? '').trim();
    const k = String(key ?? '').trim();
    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const itens = cur.itens.map((item) => {
        if (itemKey(item) !== k) return item;
        const next = {
          ...item,
          ...patch,
          catalogoProcedimentoSaudeId:
            patch.catalogoProcedimentoSaudeId != null
              ? String(patch.catalogoProcedimentoSaudeId).trim()
              : item.catalogoProcedimentoSaudeId,
          catalogoNome:
            patch.catalogoNome != null ? String(patch.catalogoNome).trim() : item.catalogoNome,
          valorOrcado:
            patch.valorOrcado !== undefined
              ? patch.valorOrcado == null || String(patch.valorOrcado).trim() === ''
                ? null
                : Number(patch.valorOrcado)
              : item.valorOrcado,
          dataPlanejada:
            patch.dataPlanejada !== undefined
              ? patch.dataPlanejada
                ? String(patch.dataPlanejada).slice(0, 10)
                : null
              : item.dataPlanejada,
        };
        return enriquecerDraftItemTipo(next, catalogoOptions);
      });
      return { ...prev, [id]: { ...cur, itens } };
    });
  }, []);

  const removeItem = useCallback((planoId, key) => {
    const id = String(planoId ?? '').trim();
    const k = String(key ?? '').trim();
    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return {
        ...prev,
        [id]: { ...cur, itens: cur.itens.filter((item) => itemKey(item) !== k) },
      };
    });
  }, []);

  const isDirty = useCallback(
    (planoId) => {
      const cur = draftByPlanoId[String(planoId)];
      if (!cur) return false;
      return (
        normalizeDraftSnapshot(cur.observacao, cur.itens) !==
        normalizeDraftSnapshot(cur.baseline.observacao, cur.baseline.itens)
      );
    },
    [draftByPlanoId],
  );

  const buildPutPayload = useCallback(
    (planoId) => {
      const cur = draftByPlanoId[String(planoId)];
      if (!cur) return { observacao: '', itens: [] };
      return {
        observacao: String(cur.observacao ?? '').trim(),
        itens: draftToPutItens(cur.itens),
      };
    },
    [draftByPlanoId],
  );

  const getRemovedSinceBaseline = useCallback(
    (planoId) => {
      const cur = draftByPlanoId[String(planoId)];
      if (!cur) return [];
      const currentKeys = new Set(cur.itens.map(itemKey));
      return cur.baseline.itens.filter((item) => !currentKeys.has(itemKey(item)));
    },
    [draftByPlanoId],
  );

  const applyDetalhe = useCallback((planoId, dto, catalogoOptions = []) => {
    const id = String(planoId ?? '').trim();
    const plano = normalizePlano(dto);
    if (!plano) return;

    const observacao = String(plano.observacao ?? '').trim();
    const itens = (Array.isArray(plano.itens) ? plano.itens : []).map((raw) =>
      enriquecerDraftItemTipo(planoItemToDraftItem(raw), catalogoOptions),
    );

    setDraftByPlanoId((prev) => ({
      ...prev,
      [id]: {
        observacao,
        itens,
        baseline: {
          observacao,
          itens: cloneItens(itens),
        },
      },
    }));
  }, []);

  const rollbackRemoved = useCallback((planoId, removedItems) => {
    const id = String(planoId ?? '').trim();
    const toRestore = Array.isArray(removedItems) ? removedItems : [];
    if (toRestore.length === 0) return;

    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const existingKeys = new Set(cur.itens.map(itemKey));
      const merged = [...cur.itens];
      for (const item of toRestore) {
        const k = itemKey(item);
        if (!existingKeys.has(k)) {
          merged.push({ ...item });
          existingKeys.add(k);
        }
      }
      return { ...prev, [id]: { ...cur, itens: merged } };
    });
  }, []);

  return {
    draftByPlanoId,
    getDraft,
    hydrateFromPlano,
    initEmptyDraft,
    setObservacao,
    addItem,
    updateItem,
    removeItem,
    isDirty,
    buildPutPayload,
    getRemovedSinceBaseline,
    applyDetalhe,
    rollbackRemoved,
  };
}
