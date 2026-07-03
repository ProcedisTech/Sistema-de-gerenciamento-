import { useCallback, useState } from 'react';
import {
  normalizeTamanho,
  TAMANHO_DEFAULT,
} from '../../constants/mapeamentoMarcador.js';

let localIdSeq = 0;
function nextLocalId() {
  localIdSeq += 1;
  return `mp_${Date.now()}_${localIdSeq}`;
}

/** Mapeia ponto da API → objeto local (hydrate futuro). NULL tamanho → 1.0. */
export function mapApiPontoToLocal(apiPonto, ordem) {
  const p = apiPonto && typeof apiPonto === 'object' ? apiPonto : {};
  const row = {
    localId: nextLocalId(),
    posX: Number(p.posX), // fallback legado
    posY: Number(p.posY), // fallback legado
    quantidade: Number(p.quantidade),
    tamanho: normalizeTamanho(p.tamanho),
    ordem: Number(ordem) || 1,
    tipoGeometria: p.tipoGeometria || 'ponto',
    vertices: Array.isArray(p.vertices) ? p.vertices : [],
  };
  if (p.regiaoFacial != null && String(p.regiaoFacial).trim()) {
    row.regiaoFacial = String(p.regiaoFacial).trim();
  }
  return row;
}

function emptyProcedimentoEntry(catalogoProcedimentoSaudeId, nomeProcedimento) {
  return {
    catalogoProcedimentoSaudeId: String(catalogoProcedimentoSaudeId),
    nomeProcedimento: String(nomeProcedimento || ''),
    pontosPorVista: {},
  };
}

export function useMapeamentoFacialState() {
  const [vistaAtual, setVistaAtual] = useState(null);
  const [procedimentoArmado, setProcedimentoArmado] = useState(null);
  const [planoPorProcedimento, setPlanoPorProcedimento] = useState({});
  /** Uma foto por vista (compartilhada entre procedimentos). */
  const [fotosPorVista, setFotosPorVista] = useState({});

  const ensureProcedimento = useCallback((id, nome) => {
    const key = String(id || '').trim();
    if (!key) return null;
    setPlanoPorProcedimento((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: emptyProcedimentoEntry(key, nome) };
    });
    return key;
  }, []);

  const armarProcedimento = useCallback(
    (proc) => {
      if (!proc?.id) {
        setProcedimentoArmado(null);
        return;
      }
      const id = String(proc.id).trim();
      const nome = String(proc.nome || proc.nomeProcedimento || '').trim();
      ensureProcedimento(id, nome);
      setProcedimentoArmado((prev) => {
        if (prev?.id === id) return null;
        return { id, nome };
      });
    },
    [ensureProcedimento],
  );

  const setFotoVista = useCallback((vistaCodigo, payload) => {
    const vista = String(vistaCodigo || '').trim();
    if (!vista || !payload) return;
    setFotosPorVista((prev) => ({ ...prev, [vista]: { ...payload } }));
  }, []);

  const getFotoVista = useCallback(
    (vistaCodigo) => fotosPorVista[String(vistaCodigo || '').trim()] ?? null,
    [fotosPorVista],
  );

  const adicionarPonto = useCallback(
    (vistaCodigo, { posX, posY, quantidade, regiaoFacial, tamanho, tipoGeometria = 'ponto', vertices = [] }) => {
      if (!procedimentoArmado?.id) return false;
      const catId = String(procedimentoArmado.id).trim();
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista) return false;
      const qty = Number(quantidade);
      if (!Number.isFinite(qty) || qty <= 0) return false;

      setPlanoPorProcedimento((prev) => {
        const next = { ...prev };
        const base = next[catId] || emptyProcedimentoEntry(catId, procedimentoArmado.nome);
        const pontosPorVista = { ...(base.pontosPorVista || {}) };
        const lista = Array.isArray(pontosPorVista[vista]) ? [...pontosPorVista[vista]] : [];
        let ordemGlobal = 0;
        Object.values(prev).forEach((e) => {
          const pts = e?.pontosPorVista?.[vista];
          ordemGlobal += Array.isArray(pts) ? pts.length : 0;
        });
        ordemGlobal += 1;
        lista.push({
          localId: nextLocalId(),
          posX: posX != null ? Number(posX) : undefined,
          posY: posY != null ? Number(posY) : undefined,
          quantidade: qty,
          tamanho: normalizeTamanho(tamanho ?? TAMANHO_DEFAULT),
          tipoGeometria,
          vertices: Array.isArray(vertices) ? vertices : [],
          regiaoFacial: regiaoFacial != null ? String(regiaoFacial) : undefined,
          ordem: ordemGlobal,
        });
        pontosPorVista[vista] = lista;
        next[catId] = { ...base, pontosPorVista };
        return next;
      });
      return true;
    },
    [procedimentoArmado, vistaAtual],
  );

  const removerPonto = useCallback((catalogoId, vistaCodigo, localId) => {
    const catId = String(catalogoId || '').trim();
    const vista = String(vistaCodigo || '').trim();
    if (!catId || !vista || !localId) return;

    setPlanoPorProcedimento((prev) => {
      const entry = prev[catId];
      if (!entry?.pontosPorVista?.[vista]) return prev;
      const filtrados = entry.pontosPorVista[vista].filter((p) => p.localId !== localId);
      return {
        ...prev,
        [catId]: {
          ...entry,
          pontosPorVista: { ...entry.pontosPorVista, [vista]: filtrados },
        },
      };
    });
  }, []);

  const editarPonto = useCallback((catalogoId, vistaCodigo, localId, patch) => {
    const catId = String(catalogoId || '').trim();
    const vista = String(vistaCodigo || '').trim();
    if (!catId || !vista || !localId || !patch || typeof patch !== 'object') return;

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

    setPlanoPorProcedimento((prev) => {
      const entry = prev[catId];
      if (!entry?.pontosPorVista?.[vista]) return prev;
      const lista = entry.pontosPorVista[vista].map((p) => {
        if (p.localId !== localId) return p;
        const next = { ...p };
        if (hasQty) next.quantidade = qty;
        if (hasTamanho) next.tamanho = tamanhoNorm;
        return next;
      });
      return {
        ...prev,
        [catId]: {
          ...entry,
          pontosPorVista: { ...entry.pontosPorVista, [vista]: lista },
        },
      };
    });
  }, []);

  const desfazerUltimoPontoVista = useCallback(
    (vistaCodigo) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista) return false;

      let bestCatId = null;
      let bestPonto = null;
      Object.entries(planoPorProcedimento).forEach(([catId, entry]) => {
        const lista = entry?.pontosPorVista?.[vista];
        if (!Array.isArray(lista)) return;
        lista.forEach((p) => {
          if (!bestPonto || Number(p.ordem) > Number(bestPonto.ordem)) {
            bestCatId = catId;
            bestPonto = p;
          }
        });
      });
      if (!bestCatId || !bestPonto) return false;

      const catId = bestCatId;
      const localId = bestPonto.localId;
      setPlanoPorProcedimento((prev) => {
        const entry = prev[catId];
        if (!entry?.pontosPorVista?.[vista]) return prev;
        const filtrados = entry.pontosPorVista[vista].filter((p) => p.localId !== localId);
        return {
          ...prev,
          [catId]: {
            ...entry,
            pontosPorVista: { ...entry.pontosPorVista, [vista]: filtrados },
          },
        };
      });
      return true;
    },
    [planoPorProcedimento, vistaAtual],
  );

  const limparPontosVista = useCallback(
    (vistaCodigo) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista) return;

      setPlanoPorProcedimento((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((catId) => {
          const entry = next[catId];
          if (!entry?.pontosPorVista?.[vista]?.length) return;
          changed = true;
          next[catId] = {
            ...entry,
            pontosPorVista: { ...entry.pontosPorVista, [vista]: [] },
          };
        });
        return changed ? next : prev;
      });
    },
    [vistaAtual],
  );

  const getPontosVista = useCallback(
    (vistaCodigo) => {
      const vista = String(vistaCodigo || vistaAtual || '').trim();
      if (!vista) return [];
      const grupos = [];
      Object.entries(planoPorProcedimento).forEach(([catId, entry]) => {
        if (!entry?.pontosPorVista?.[vista]?.length) return;
        grupos.push({
          catalogoProcedimentoSaudeId: catId,
          nomeProcedimento: entry.nomeProcedimento,
          pontos: entry.pontosPorVista[vista],
        });
      });
      return grupos;
    },
    [planoPorProcedimento, vistaAtual],
  );

  const countPontosVista = useCallback(
    (vistaCodigo) => {
      const vista = String(vistaCodigo || '').trim();
      let n = 0;
      Object.values(planoPorProcedimento).forEach((entry) => {
        n += entry?.pontosPorVista?.[vista]?.length ?? 0;
      });
      return n;
    },
    [planoPorProcedimento],
  );

  const totalPontos = useCallback(() => {
    let n = 0;
    Object.values(planoPorProcedimento).forEach((entry) => {
      Object.values(entry?.pontosPorVista || {}).forEach((lista) => {
        n += Array.isArray(lista) ? lista.length : 0;
      });
    });
    return n;
  }, [planoPorProcedimento]);

  const getProcedimentosComPontos = useCallback(() => {
    return Object.entries(planoPorProcedimento)
      .filter(([, entry]) =>
        Object.values(entry?.pontosPorVista || {}).some(
          (lista) => Array.isArray(lista) && lista.length > 0,
        ),
      )
      .map(([catId, entry]) => ({ catalogoProcedimentoSaudeId: catId, ...entry }));
  }, [planoPorProcedimento]);

  const procedimentosUsados = useCallback(() => {
    return Object.entries(planoPorProcedimento).map(([catId, entry]) => ({
      id: catId,
      nome: entry.nomeProcedimento,
    }));
  }, [planoPorProcedimento]);

  const getVistasPreenchidas = useCallback(() => {
    const codigos = new Set();
    Object.keys(fotosPorVista).forEach((v) => {
      if (fotosPorVista[v]?.displayUrl) codigos.add(v);
    });
    Object.values(planoPorProcedimento).forEach((entry) => {
      Object.entries(entry?.pontosPorVista || {}).forEach(([vista, lista]) => {
        if (Array.isArray(lista) && lista.length > 0) codigos.add(vista);
      });
    });
    return Array.from(codigos);
  }, [fotosPorVista, planoPorProcedimento]);

  return {
    vistaAtual,
    setVistaAtual,
    procedimentoArmado,
    armarProcedimento,
    planoPorProcedimento,
    fotosPorVista,
    setFotoVista,
    getFotoVista,
    adicionarPonto,
    removerPonto,
    editarPonto,
    desfazerUltimoPontoVista,
    limparPontosVista,
    getPontosVista,
    countPontosVista,
    totalPontos,
    getProcedimentosComPontos,
    procedimentosUsados,
    ensureProcedimento,
    getVistasPreenchidas,
  };
}
