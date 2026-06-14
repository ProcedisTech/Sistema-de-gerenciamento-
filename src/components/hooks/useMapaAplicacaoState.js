import { useCallback, useState } from 'react';
import {
  normalizeTamanho,
  TAMANHO_DEFAULT,
} from '../../constants/mapeamentoMarcador.js';
import { VISTA_MAPA_APLICACAO_PADRAO } from '../../constants/vistasMapaAplicacao.js';
import { hydrateMapaFromGet } from '../../utils/procedimentoMapaPayload.js';

let localIdSeq = 0;
function nextLocalId() {
  localIdSeq += 1;
  return `ep_${Date.now()}_${localIdSeq}`;
}

/**
 * Estado local do mapa de aplicação (execução — um procedimento por sessão).
 */
export function useMapaAplicacaoState() {
  const [vistaAtual, setVistaAtual] = useState(VISTA_MAPA_APLICACAO_PADRAO);
  const [fotosPorVista, setFotosPorVista] = useState({});
  const [pontosPorVista, setPontosPorVista] = useState({});
  const [fotoGaleriaIdPorVista, setFotoGaleriaIdPorVista] = useState({});
  const [dirtyVistas, setDirtyVistas] = useState(() => new Set());

  const markDirty = useCallback((vista) => {
    const v = String(vista || '').trim();
    if (!v) return;
    setDirtyVistas((prev) => {
      if (prev.has(v)) return prev;
      const next = new Set(prev);
      next.add(v);
      return next;
    });
  }, []);

  const clearDirty = useCallback((vista) => {
    const v = String(vista || '').trim();
    if (!v) return;
    setDirtyVistas((prev) => {
      if (!prev.has(v)) return prev;
      const next = new Set(prev);
      next.delete(v);
      return next;
    });
  }, []);

  const clearAllDirty = useCallback(() => {
    setDirtyVistas(new Set());
  }, []);

  const getDirtyVistas = useCallback(() => Array.from(dirtyVistas), [dirtyVistas]);

  const setFotoVista = useCallback(
    (vistaCodigo, payload) => {
      const vista = String(vistaCodigo || '').trim();
      if (!vista || !payload) return;
      setFotosPorVista((prev) => ({ ...prev, [vista]: { ...payload } }));
      if (payload.fotoGaleriaId) {
        setFotoGaleriaIdPorVista((prev) => ({
          ...prev,
          [vista]: String(payload.fotoGaleriaId),
        }));
      }
      markDirty(vista);
    },
    [markDirty],
  );

  const getFotoVista = useCallback(
    (vistaCodigo) => fotosPorVista[String(vistaCodigo || '').trim()] ?? null,
    [fotosPorVista],
  );

  const adicionarPonto = useCallback(
    (vistaCodigo, { posX, posY, quantidade, regiaoFacial, tamanho }) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista) return false;
      const qty = Number(quantidade);
      if (!Number.isFinite(qty) || qty <= 0) return false;

      setPontosPorVista((prev) => {
        const lista = Array.isArray(prev[vista]) ? [...prev[vista]] : [];
        const ordem = lista.length + 1;
        lista.push({
          localId: nextLocalId(),
          posX: Number(posX),
          posY: Number(posY),
          quantidade: qty,
          tamanho: normalizeTamanho(tamanho ?? TAMANHO_DEFAULT),
          regiaoFacial: regiaoFacial != null ? String(regiaoFacial) : undefined,
          ordem,
        });
        return { ...prev, [vista]: lista };
      });
      markDirty(vista);
      return true;
    },
    [vistaAtual, markDirty],
  );

  const removerPonto = useCallback(
    (vistaCodigo, localId) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista || !localId) return;
      setPontosPorVista((prev) => {
        if (!prev[vista]?.length) return prev;
        return {
          ...prev,
          [vista]: prev[vista].filter((p) => p.localId !== localId),
        };
      });
      markDirty(vista);
    },
    [vistaAtual, markDirty],
  );

  const editarPonto = useCallback(
    (vistaCodigo, localId, patch) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista || !localId || !patch || typeof patch !== 'object') return;

      const hasQty = patch.quantidade != null;
      const hasTamanho = patch.tamanho != null;
      if (!hasQty && !hasTamanho) return;

      let qty;
      if (hasQty) {
        qty = Number(patch.quantidade);
        if (!Number.isFinite(qty) || qty <= 0) return;
      }

      let tamanhoNorm;
      if (hasTamanho) {
        tamanhoNorm = normalizeTamanho(patch.tamanho);
      }

      setPontosPorVista((prev) => {
        if (!prev[vista]?.length) return prev;
        const lista = prev[vista].map((p) => {
          if (p.localId !== localId) return p;
          const next = { ...p };
          if (hasQty) next.quantidade = qty;
          if (hasTamanho) next.tamanho = tamanhoNorm;
          return next;
        });
        return { ...prev, [vista]: lista };
      });
      markDirty(vista);
    },
    [vistaAtual, markDirty],
  );

  const importarPontosDoPlano = useCallback(
    (pontosPlano, vistaCodigo) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista || !Array.isArray(pontosPlano) || pontosPlano.length === 0) return false;

      const lista = pontosPlano.map((p, idx) => ({
        localId: nextLocalId(),
        posX: Number(p.posX),
        posY: Number(p.posY),
        quantidade: Number(p.quantidade),
        tamanho: normalizeTamanho(p.tamanho ?? TAMANHO_DEFAULT),
        regiaoFacial: p.regiaoFacial != null ? String(p.regiaoFacial) : undefined,
        ordem: idx + 1,
      }));

      setPontosPorVista((prev) => ({ ...prev, [vista]: lista }));
      markDirty(vista);
      return true;
    },
    [vistaAtual, markDirty],
  );

  const hydrateFromApi = useCallback((response) => {
    const data = hydrateMapaFromGet(response);
    setPontosPorVista(data.pontosPorVista || {});
    setFotoGaleriaIdPorVista(data.fotoGaleriaIdPorVista || {});
    setDirtyVistas(new Set());
    return data;
  }, []);

  const getPontosVista = useCallback(
    (vistaCodigo, catalogoId, nomeProcedimento) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      const lista = pontosPorVista[vista];
      if (!Array.isArray(lista) || lista.length === 0) return [];
      return [
        {
          catalogoProcedimentoSaudeId: String(catalogoId || ''),
          nomeProcedimento: String(nomeProcedimento || ''),
          pontos: lista,
        },
      ];
    },
    [pontosPorVista, vistaAtual],
  );

  const countPontosVista = useCallback(
    (vistaCodigo) => {
      const vista = String(vistaCodigo || '').trim();
      return pontosPorVista[vista]?.length ?? 0;
    },
    [pontosPorVista],
  );

  const getVistasPreenchidas = useCallback(() => {
    const codigos = new Set();
    Object.keys(fotosPorVista).forEach((v) => {
      if (fotosPorVista[v]?.displayUrl) codigos.add(v);
    });
    Object.entries(pontosPorVista).forEach(([vista, lista]) => {
      if (Array.isArray(lista) && lista.length > 0) codigos.add(vista);
    });
    Object.keys(fotoGaleriaIdPorVista).forEach((v) => {
      if (fotoGaleriaIdPorVista[v]) codigos.add(v);
    });
    return Array.from(codigos);
  }, [fotosPorVista, pontosPorVista, fotoGaleriaIdPorVista]);

  const getSnapshotForPersist = useCallback(
    () => ({
      fotosPorVista,
      pontosPorVista,
      fotoGaleriaIdPorVista,
      dirtyVistas: Array.from(dirtyVistas),
    }),
    [fotosPorVista, pontosPorVista, fotoGaleriaIdPorVista, dirtyVistas],
  );

  const resetMapa = useCallback(() => {
    setVistaAtual(VISTA_MAPA_APLICACAO_PADRAO);
    setFotosPorVista({});
    setPontosPorVista({});
    setFotoGaleriaIdPorVista({});
    setDirtyVistas(new Set());
  }, []);

  return {
    vistaAtual,
    setVistaAtual,
    fotosPorVista,
    pontosPorVista,
    fotoGaleriaIdPorVista,
    setFotoVista,
    getFotoVista,
    adicionarPonto,
    removerPonto,
    editarPonto,
    importarPontosDoPlano,
    hydrateFromApi,
    getPontosVista,
    countPontosVista,
    getVistasPreenchidas,
    getSnapshotForPersist,
    getDirtyVistas,
    clearDirty,
    clearAllDirty,
    markDirty,
    resetMapa,
  };
}
