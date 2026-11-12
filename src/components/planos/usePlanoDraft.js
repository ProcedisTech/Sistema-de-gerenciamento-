import { useCallback, useRef, useState } from 'react';
import { normalizePlano } from '../../utils/planejamentoNormalize.js';
import {
  createTempId,
  draftToPutItens,
  enriquecerDraftItemTipo,
  isRealUuid,
  normalizeDraftItemForCompare,
  normalizeDraftSnapshot,
  planoItemToDraftItem,
} from '../../utils/planejamentoDraftUtils.js';

function cloneItens(itens) {
  return (Array.isArray(itens) ? itens : []).map((i) => ({
    ...i,
    sessaoAtiva: i.sessaoAtiva ? { ...i.sessaoAtiva } : null,
    sessaoRealizada: i.sessaoRealizada ? { ...i.sessaoRealizada } : null,
    sessaoRetornoAtiva: i.sessaoRetornoAtiva ? { ...i.sessaoRetornoAtiva } : null,
    sessaoRetornoRealizada: i.sessaoRetornoRealizada ? { ...i.sessaoRetornoRealizada } : null,
  }));
}

function itemKey(item) {
  return String(item?.id ?? item?.tempId ?? '');
}

export function usePlanoDraft() {
  const [draftByPlanoId, setDraftByPlanoIdState] = useState({});
  // Espelho síncrono do rascunho: updateItem/removeItem seguidos de um PUT no mesmo tick (agendar em lote) já se veem.
  const draftRef = useRef(draftByPlanoId);
  const setDraftByPlanoId = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(draftRef.current) : updater;
    draftRef.current = next;
    setDraftByPlanoIdState(next);
  }, []);

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
  }, [setDraftByPlanoId]);

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
  }, [setDraftByPlanoId]);

  const setObservacao = useCallback((planoId, text) => {
    const id = String(planoId ?? '').trim();
    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, observacao: String(text ?? '') } };
    });
  }, [setDraftByPlanoId]);

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
      sessaoRetornoRealizada: null,
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
  }, [setDraftByPlanoId]);

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
  }, [setDraftByPlanoId]);

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
  }, [setDraftByPlanoId]);

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

  const getRemovedSinceBaseline = useCallback((planoId) => {
    const cur = draftRef.current[String(planoId)];
    if (!cur) return [];
    const currentKeys = new Set(cur.itens.map(itemKey));
    return cur.baseline.itens.filter((item) => !currentKeys.has(itemKey(item)));
  }, []);

  // PUT por diferença: só itens novos e alterados + ids removidos (o servidor não apaga o que não vem).
  const buildPutPayload = useCallback(
    (planoId) => {
      const cur = draftRef.current[String(planoId)];
      if (!cur) return { observacao: '', itens: [], removidos: [] };
      const basePorId = new Map(
        cur.baseline.itens.filter((i) => isRealUuid(i.id)).map((i) => [String(i.id), i]),
      );
      const mudados = cur.itens.filter((item) => {
        if (!isRealUuid(item.id)) return true;
        const base = basePorId.get(String(item.id));
        return (
          !base ||
          JSON.stringify(normalizeDraftItemForCompare(item)) !==
            JSON.stringify(normalizeDraftItemForCompare(base))
        );
      });
      return {
        observacao: String(cur.observacao ?? '').trim(),
        itens: draftToPutItens(mudados),
        removidos: getRemovedSinceBaseline(planoId)
          .filter((i) => isRealUuid(i.id))
          .map((i) => String(i.id).trim()),
      };
    },
    [getRemovedSinceBaseline],
  );

  // opts.manterObservacao: true mantém o texto local; false aplica o remoto; omitido = regra pelo texto alterado.
  // opts.preservarLocais: itens do rascunho sem id real ficam no fim da lista.
  // opts.idsEmVoo: tempIds de itens locais já enviados num Salvar em andamento — não reincluir (evita duplicar ao chegar a resposta).
  const applyDetalhe = useCallback((planoId, dto, catalogoOptions = [], opts = {}) => {
    const id = String(planoId ?? '').trim();
    const plano = normalizePlano(dto);
    if (!plano) return;

    const observacao = String(plano.observacao ?? '').trim();
    const itens = (Array.isArray(plano.itens) ? plano.itens : []).map((raw) =>
      enriquecerDraftItemTipo(planoItemToDraftItem(raw), catalogoOptions),
    );

    setDraftByPlanoId((prev) => {
      const cur = prev[id];
      const keepUserObs =
        opts?.manterObservacao ?? Boolean(cur && cur.observacao !== cur.baseline?.observacao);
      const finalObservacao = keepUserObs && cur ? cur.observacao : observacao;
      const emVoo = opts?.idsEmVoo;
      const locais =
        opts?.preservarLocais && cur
          ? cur.itens.filter((i) => !isRealUuid(i.id) && !emVoo?.has?.(itemKey(i)))
          : [];
      return {
        ...prev,
        [id]: {
          observacao: finalObservacao,
          itens: locais.length ? [...itens, ...locais] : itens,
          baseline: {
            observacao,
            itens: cloneItens(itens),
          },
        },
      };
    });
  }, [setDraftByPlanoId]);

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
  }, [setDraftByPlanoId]);

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
