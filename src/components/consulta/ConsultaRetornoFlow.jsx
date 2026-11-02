import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { corParaProcedimento } from '../../constants/mapeamentoPaletaCores.js';
import { isRealUuid } from '../../utils/planejamentoDraftUtils.js';
import { Camera, Copy, ImageIcon, Loader2, Lock, RotateCcw, Trash2, ZoomIn, X } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { mapasApi, pacientesGaleriaApi, procedimentosApi } from '../../services/api.js';
import { normalizePacienteGaleriaResponse } from '../../utils/pacienteGaleria.js';
import { buildGrupoPontosVista, hydrateMapaFromGet } from '../../utils/procedimentoMapaPayload.js';
import { VISTA_MAPA_APLICACAO_PADRAO } from '../../constants/vistasMapaAplicacao.js';
import { FotoVistaCanvas, FotoVistaCanvasCore } from '../journey/mapeamento/FotoVistaCanvas.jsx';
import { MapeamentoFullscreenOverlay } from '../journey/mapeamento/MapeamentoFullscreenOverlay.jsx';
import { VistaAtivaHeader, VistaChipsBar } from '../journey/mapeamento/VistaChipsBar.jsx';
import { ZoomableGalleryLightbox } from '../patients/ZoomableGalleryLightbox.jsx';
import { formatarInstante } from '../../utils/datasClinica.js';
import { useFusoClinica } from '../hooks/useFusoClinica.js';

const SATISFACAO_OPTS = [1, 2, 3, 4, 5];
const SIMETRIA_OPTS = [
  { value: 'sim', label: 'Simétrico' },
  { value: 'leve', label: 'Assimetria leve' },
  { value: 'moderada', label: 'Assimetria moderada' },
  { value: 'na', label: 'N/A' },
];
const DOR_OPTS = [
  { value: 0, label: 'Sem dor' },
  { value: 3, label: 'Leve' },
  { value: 6, label: 'Moderada' },
  { value: 9, label: 'Intensa' },
];

const FOTO_TIPOS_COLUNA = [
  { codigo: 'ANTES', label: 'Antes' },
  { codigo: 'POS_IMEDIATO', label: 'Pós-imediato' },
  { codigo: 'DEPOIS', label: 'Depois' },
];

function formatDataHora(iso, fuso) {
  if (!iso) return '—';
  return formatarInstante(iso, fuso, { dateStyle: 'short', timeStyle: 'short' }) || String(iso);
}

function resolveNomeProcedimento(meta) {
  if (!meta) return '—';
  const nome = String(meta.procedimentoNome || meta.nomeManual || '').trim();
  return nome || '—';
}

/** Fluxo de retorno: coluna pai (read-only) + avaliação/retoque editável. */
export function ConsultaRetornoFlow({
  pacienteId,
  procedimentoFeitoOrigemId,
  planejamentoItemId = null,
  catalogoId = null,
  nomeProcedimento = '',
  onOrigemResolved,
  procedimentosSessao = [],
  setProcedimentosSessao = () => {},
  activeProcedureIndex = 0,
  _setActiveProcedureIndex = () => {},
  mapaRetornoState,
  _retornoAvaliacao = {},
  _setRetornoAvaliacao,
  houveRetoque = false,
  setHouveRetoque,
  evaluationCapturedPhotos = [],
  evaluationPhotoMax = 30,
  onEvaluationUploadFiles,
  onEvaluationRemovePhoto,
  procedureCapturedPhotos = [],
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  onProcedureOpenCamera,
  onConcluirRetorno,
  isConcluirBusy = false,
  pendingMapaCapture = null,
  onMapaCaptureConsumed = () => {},
  onPrepareMapaCapture = () => {},
}) {
  const toast = useToast();
  const { fuso } = useFusoClinica();
  const uploadInputRef = useRef(null);
  const uploadPreRef = useRef(null);
  const uploadPosRef = useRef(null);
  const blobUrlsRef = useRef([]);
  const onOrigemResolvedRef = useRef(onOrigemResolved);
  onOrigemResolvedRef.current = onOrigemResolved;
  const loadedPaiKeyRef = useRef(null);
  const photos = evaluationCapturedPhotos || [];

  const procedurePhotos = procedureCapturedPhotos || [];
  const preRetoquePhotos = procedurePhotos.filter(
    (p) => (p.meta?.categoria || 'antes') === 'antes',
  );
  const posRetoquePhotos = procedurePhotos.filter(
    (p) => p.meta?.categoria === 'pos_imediato',
  );

  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState(null);
  const [parentMeta, setParentMeta] = useState(null);
  const [parentSemMapa, setParentSemMapa] = useState(false);
  const [fotosPorTipo, setFotosPorTipo] = useState({});
  const [parentFotosPorVista, setParentFotosPorVista] = useState({});
  const [parentPontosPorVista, setParentPontosPorVista] = useState({});
  const [vistaPai, setVistaPai] = useState(VISTA_MAPA_APLICACAO_PADRAO);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [parentMapaFullscreen, setParentMapaFullscreen] = useState(false);
  const [retornoFullscreenOpen, setRetornoFullscreenOpen] = useState(false);

  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (files?.length) onEvaluationUploadFiles?.(files);
    e.target.value = '';
  };

  const catalogoIdPai =
    parentMeta?.catalogoProcedimentoSaudeId ||
    parentMeta?.nomeProcedimentoCatalogoId ||
    parentMeta?.catalogoId ||
    catalogoId ||
    'retorno-catalogo';
  const nomeProcedimentoPai =
    resolveNomeProcedimento(parentMeta) !== '—'
      ? resolveNomeProcedimento(parentMeta)
      : (nomeProcedimento || 'Procedimento Retocado');
  const listaProcedimentosSessao = useMemo(() => {
    const isPlaceholder = (nome) => !nome || /^Procedimento\s*\d*$/i.test(String(nome).trim());

    if (Array.isArray(procedimentosSessao) && procedimentosSessao.length > 0) {
      const vistos = new Set();
      return procedimentosSessao
        .map((p, idx) => {
          let cid = p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId || null;
          if (!cid && (p.procedimentoFeitoOrigemId || p.id)) {
            const alvoId = String(p.procedimentoFeitoOrigemId || p.id);
            if (parentMeta && String(parentMeta.id) === alvoId) {
              cid = parentMeta.catalogoProcedimentoSaudeId || parentMeta.catalogoId || null;
            }
          }
          if (!cid && idx === 0 && catalogoIdPai && isRealUuid(catalogoIdPai)) {
            cid = String(catalogoIdPai);
          }
          const rawNome =
            p.nomeProcedimento ||
            p.procedimentoNome ||
            p.nome ||
            (idx === 0 ? nomeProcedimentoPai : `Procedimento ${idx + 1}`);
          const safeCid = cid && isRealUuid(cid) ? String(cid) : null;
          return {
            id: String(safeCid || p.id || `proc_${idx}`),
            catalogoProcedimentoSaudeId: safeCid,
            catalogoId: safeCid,
            nome: rawNome,
            unidadeMedida: p.unidadeMedida || 'u',
            corHex: p.corHex || (safeCid ? corParaProcedimento(safeCid) : null) || '#00a88e',
            index: idx,
            procedimentoIndex: idx,
          };
        })
        .filter((item) => {
          if (!item.nome || isPlaceholder(item.nome)) return false;
          const k = String(item.catalogoProcedimentoSaudeId || item.id);
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        });
    }
    const catValido = catalogoIdPai && isRealUuid(catalogoIdPai) ? String(catalogoIdPai) : null;
    return [{
      id: catValido || 'proc_0',
      catalogoProcedimentoSaudeId: catValido,
      catalogoId: catValido,
      nome: nomeProcedimentoPai,
      unidadeMedida: 'u',
      corHex: catValido ? corParaProcedimento(catValido) : '#00a88e',
      index: 0,
      procedimentoIndex: 0,
    }];
  }, [procedimentosSessao, catalogoIdPai, nomeProcedimentoPai, parentMeta]);

  const [procedimentoArmadoId, setProcedimentoArmadoId] = useState(() => {
    return (
      listaProcedimentosSessao[activeProcedureIndex]?.id ||
      listaProcedimentosSessao[0]?.id ||
      null
    );
  });

  useEffect(() => {
    if (listaProcedimentosSessao.length > 0) {
      const existe = listaProcedimentosSessao.some((p) => p.id === procedimentoArmadoId);
      if (!existe) {
        setProcedimentoArmadoId(listaProcedimentosSessao[0].id);
      }
    }
  }, [listaProcedimentosSessao, procedimentoArmadoId]);

  const procedimentoArmado = useMemo(() => {
    const proc = listaProcedimentosSessao.find((p) => p.id === procedimentoArmadoId);
    return proc || listaProcedimentosSessao[0] || null;
  }, [listaProcedimentosSessao, procedimentoArmadoId]);

  const handleAddPontoComProcedimento = useCallback(
    (vista, pontoData) => {
      const targetProc = procedimentoArmado || listaProcedimentosSessao[0];
      const targetCatId = targetProc?.catalogoProcedimentoSaudeId || targetProc?.catalogoId || null;
      const targetIndex = targetProc?.index ?? 0;
      mapaRetornoState?.adicionarPonto(vista, {
        ...pontoData,
        catalogoProcedimentoSaudeId: targetCatId,
        catalogoId: targetCatId,
        procedimentoIndex: targetIndex,
        index: targetIndex,
        nomeProcedimento: targetProc?.nome || pontoData?.nomeProcedimento || nomeProcedimentoPai,
        cor: targetProc?.corHex || pontoData?.cor || '#00a88e',
        corHex: targetProc?.corHex || pontoData?.cor || '#00a88e',
      });
    },
    [mapaRetornoState, procedimentoArmado, listaProcedimentosSessao, nomeProcedimentoPai],
  );

  const handleAdicionarProcedimentoRetorno = useCallback(
    (novoProc) => {
      if (!novoProc) return;
      const catId = novoProc.catalogoProcedimentoSaudeId || novoProc.catalogoId || novoProc.id;
      const catIdStr = String(catId || '').trim();
      if (!catIdStr) return;

      // Se for o mesmo catálogo do procedimento pai original do retorno, não duplica
      if (catalogoIdPai && String(catalogoIdPai).trim() === catIdStr) {
        setProcedimentoArmadoId(catIdStr);
        return;
      }

      const nome = novoProc.nomeProcedimento || novoProc.nome || 'Procedimento';
      if (typeof setProcedimentosSessao === 'function') {
        setProcedimentosSessao((prev) => {
          const listaAtual = Array.isArray(prev) ? prev : [];
          const jaExiste = listaAtual.some((p, idx) => {
            const cid = p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId;
            if (cid && String(cid).trim() === catIdStr) return true;
            if (p.id && String(p.id).trim() === catIdStr) return true;
            if (idx === 0 && catalogoIdPai && String(catalogoIdPai).trim() === catIdStr) return true;
            return false;
          });
          if (jaExiste) return listaAtual;
          return [
            ...listaAtual,
            {
              id: `item_retorno_${Date.now()}`,
              catalogoProcedimentoSaudeId: catId,
              catalogoId: catId,
              nomeProcedimento: nome,
              procedimentoNome: nome,
              nome: nome,
              unidadeMedida: novoProc.unidadeMedida || 'un',
              corHex: novoProc.corHex || (catId ? corParaProcedimento(catId) : '#00a88e'),
              isRetoque: false,
            },
          ];
        });
      }
      setProcedimentoArmadoId(catIdStr);
    },
    [setProcedimentosSessao, catalogoIdPai],
  );

  const handleMudarCorProcedimento = useCallback(
    (procId, novaCor, outroProcId, corAntiga) => {
      mapaRetornoState?.atualizarCorProcedimento?.(procId, novaCor, outroProcId, corAntiga);
      if (typeof setProcedimentosSessao === 'function') {
        setProcedimentosSessao((prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((p) => {
            const cid = p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId || p.id;
            if (String(cid) === String(procId)) {
              return { ...p, corHex: novaCor };
            }
            if (outroProcId && String(cid) === String(outroProcId)) {
              return { ...p, corHex: corAntiga };
            }
            return p;
          });
        });
      }
    },
    [mapaRetornoState, setProcedimentosSessao],
  );

  const procedimentoArmadoPai = {
    id: String(catalogoIdPai),
    nome: nomeProcedimentoPai,
  };

  useEffect(() => {
    if (!pacienteId) {
      loadedPaiKeyRef.current = null;
      setParentMeta(null);
      setFotosPorTipo({});
      setParentFotosPorVista({});
      setParentPontosPorVista({});
      setParentSemMapa(false);
      setParentError(null);
      return undefined;
    }

    if (
      procedimentoFeitoOrigemId &&
      loadedPaiKeyRef.current === `${pacienteId}:${procedimentoFeitoOrigemId}`
    ) {
      return undefined;
    }

    let cancelled = false;
    setParentLoading(true);
    setParentError(null);

    (async () => {
      try {
        const procListRaw = await procedimentosApi.byPaciente(pacienteId);
        if (cancelled) return;

        const procList = Array.isArray(procListRaw) ? procListRaw : procListRaw?.content ?? [];

        let pai = null;
        if (procedimentoFeitoOrigemId) {
          pai = procList.find((p) => String(p.id) === String(procedimentoFeitoOrigemId)) || null;
        }
        const cleanTargetId = String(planejamentoItemId || '').replace(/_retorno$/, '').trim();
        if (!pai && cleanTargetId) {
          // Busca o procedimento original realizado desse item de plano (não-retoque)
          pai =
            procList.find(
              (p) =>
                String(p.planejamentoItemId || '').replace(/_retorno$/, '').trim() === cleanTargetId &&
                !p.isRetoque &&
                !p.procedimentoFeitoOrigemId,
            ) ||
            procList.find(
              (p) =>
                String(p.planejamentoItemId || '').replace(/_retorno$/, '').trim() === cleanTargetId &&
                !p.isRetoque,
            ) ||
            null;
        }
        if (!pai && catalogoId) {
          // Fallback por catálogo
          pai =
            procList.find(
              (p) =>
                String(p.catalogoProcedimentoSaudeId || p.catalogoId || '') === String(catalogoId) &&
                !p.isRetoque,
            ) || null;
        }

        if (pai) {
          loadedPaiKeyRef.current = `${pacienteId}:${pai.id}`;
        }
        if (pai && (!procedimentoFeitoOrigemId || String(procedimentoFeitoOrigemId) !== String(pai.id))) {
          onOrigemResolvedRef.current?.(String(pai.id));
        }

        setParentMeta(pai);

        if (!pai) {
          setParentSemMapa(true);
          setParentFotosPorVista({});
          setParentPontosPorVista({});
          return;
        }

        const paiId = String(pai.id);
        const [galeriaRaw, mapaResp] = await Promise.all([
          pacientesGaleriaApi.list(pacienteId, { procedimentoFeitoId: paiId }),
          mapasApi.buscarPorProcedimento(paiId).catch(() => null),
        ]);
        if (cancelled) return;

        const galeriaItems = normalizePacienteGaleriaResponse(galeriaRaw);
        const grouped = { ANTES: [], POS_IMEDIATO: [], DEPOIS: [] };
        await Promise.all(
          galeriaItems.map(async (item) => {
            const codigo = String(item.tipoFotoCodigo || '').trim().toUpperCase();
            if (!grouped[codigo]) return;
            try {
              const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
              if (cancelled) return;
              const thumbUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(thumbUrl);
              grouped[codigo].push({ ...item, thumbUrl });
            } catch {
              grouped[codigo].push({ ...item, thumbUrl: null });
            }
          }),
        );
        if (cancelled) return;
        setFotosPorTipo(grouped);

        if (!mapaResp) {
          setParentSemMapa(true);
          setParentFotosPorVista({});
          setParentPontosPorVista({});
          return;
        }

        setParentSemMapa(false);
        const mapData = hydrateMapaFromGet(mapaResp);
        setParentPontosPorVista(mapData.pontosPorVista || {});

        const fotosMapa = {};
        const ids = Object.entries(mapData.fotoGaleriaIdPorVista || {});
        await Promise.all(
          ids.map(async ([vista, fid]) => {
            const item = galeriaItems.find((i) => String(i.serverId) === String(fid));
            if (!item?.url) return;
            try {
              const blob = await pacientesGaleriaApi.fetchArquivoBlob(item.url);
              if (cancelled) return;
              const displayUrl = URL.createObjectURL(blob);
              blobUrlsRef.current.push(displayUrl);
              fotosMapa[vista] = {
                displayUrl,
                fotoGaleriaId: String(fid),
                source: 'galeria',
              };
            } catch {
              /* foto indisponível — pontos ainda carregam */
            }
          }),
        );
        if (cancelled) return;
        setParentFotosPorVista(fotosMapa);

        const vistasComConteudo = new Set([
          ...Object.keys(fotosMapa),
          ...Object.keys(mapData.pontosPorVista || {}).filter(
            (v) => (mapData.pontosPorVista[v] || []).length > 0,
          ),
        ]);
        const primeira =
          Array.from(vistasComConteudo)[0] ||
          Object.keys(mapData.fotoGaleriaIdPorVista || {})[0] ||
          VISTA_MAPA_APLICACAO_PADRAO;
        setVistaPai(primeira);
      } catch (e) {
        if (!cancelled) {
          console.warn('[ConsultaRetornoFlow] Falha ao carregar dados do pai:', e);
          setParentError(e?.message || 'Não foi possível carregar o procedimento original.');
        }
      } finally {
        if (!cancelled) setParentLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pacienteId, procedimentoFeitoOrigemId, planejamentoItemId, catalogoId]);

  useEffect(
    () => () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
      blobUrlsRef.current = [];
    },
    [],
  );

  const resetMapa = mapaRetornoState?.resetMapa;

  // Sem reusar foto do pai: ao desligar retoque, limpa o mapa editável.
  useEffect(() => {
    if (!resetMapa) return;
    if (!houveRetoque) resetMapa();
  }, [houveRetoque, resetMapa]);

  // Consome captura da câmera flutuante (mesmo padrão do MapaAplicacaoPanel).
  useEffect(() => {
    if (!mapaRetornoState || !pendingMapaCapture?.blob || !pendingMapaCapture?.vista) return;
    const url = URL.createObjectURL(pendingMapaCapture.blob);
    mapaRetornoState.setFotoVista(pendingMapaCapture.vista, {
      displayUrl: url,
      blob: pendingMapaCapture.blob,
      source: 'capture',
    });
    mapaRetornoState.setVistaAtual(pendingMapaCapture.vista);
    onMapaCaptureConsumed?.();
  }, [pendingMapaCapture, mapaRetornoState, onMapaCaptureConsumed]);

  const vistasPaiPreenchidas = useMemo(() => {
    const codigos = new Set(Object.keys(parentFotosPorVista));
    Object.entries(parentPontosPorVista).forEach(([vista, lista]) => {
      if (Array.isArray(lista) && lista.length > 0) codigos.add(vista);
    });
    return codigos.size ? Array.from(codigos) : [vistaPai];
  }, [parentFotosPorVista, parentPontosPorVista, vistaPai]);

  const gruposPontosPai = buildGrupoPontosVista(
    parentPontosPorVista[vistaPai],
    catalogoIdPai,
    nomeProcedimentoPai,
  );

  const retornoVistaAtual = mapaRetornoState?.vistaAtual ?? VISTA_MAPA_APLICACAO_PADRAO;
  const retornoFotoAtual = mapaRetornoState?.getFotoVista?.(retornoVistaAtual) ?? null;
  const retornoGruposPontos =
    mapaRetornoState?.getPontosVista?.(
      retornoVistaAtual,
      procedimentoArmado?.id || catalogoIdPai,
      procedimentoArmado?.nome || nomeProcedimentoPai,
      listaProcedimentosSessao,
    ) ?? [];

  const gruposSessao = useMemo(() => {
    const pontosPorVista = mapaRetornoState?.pontosPorVista || {};
    if (Object.keys(pontosPorVista).length === 0) return [];
    const todosPontos = Object.values(pontosPorVista).flat();
    if (todosPontos.length === 0) return [];

    if (listaProcedimentosSessao.length > 0) {
      return listaProcedimentosSessao.map((proc) => {
        const procPontosPorVista = {};
        Object.entries(pontosPorVista).forEach(([vista, pts]) => {
          if (Array.isArray(pts)) {
            const filtrados = pts.filter((p) => {
              if (p.catalogoProcedimentoSaudeId || p.catalogoId) {
                return String(p.catalogoProcedimentoSaudeId || p.catalogoId) === proc.id;
              }
              return proc.index === 0;
            });
            if (filtrados.length > 0) {
              procPontosPorVista[vista] = filtrados;
            }
          }
        });

        return {
          catalogoProcedimentoSaudeId: proc.id,
          nomeProcedimento: proc.nome,
          unidadeMedida: proc.unidadeMedida || 'u',
          pontosPorVista: procPontosPorVista,
        };
      });
    }

    if (!catalogoIdPai) return [];
    return [{
      catalogoProcedimentoSaudeId: String(catalogoIdPai),
      nomeProcedimento: String(nomeProcedimentoPai || ''),
      unidadeMedida: 'u',
      pontosPorVista,
    }];
  }, [mapaRetornoState?.pontosPorVista, listaProcedimentosSessao, catalogoIdPai, nomeProcedimentoPai]);
  const retornoVistasPreenchidas = mapaRetornoState?.getVistasPreenchidas?.() ?? [];

  const countPontosPai = (codigo) =>
    Array.isArray(parentPontosPorVista[codigo]) ? parentPontosPorVista[codigo].length : 0;

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-app-border bg-app-nav-active p-2.5 text-app-accent shadow-sm">
          <RotateCcw className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-app-ink">Retorno</h3>
          <p className="text-[13px] font-medium text-[#64748b]">
            Procedimento original + fotos e mapa desta visita
          </p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        {/* Coluna esquerda — procedimento pai + fotos do resultado */}
        <div className="flex min-h-0 flex-col gap-6">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e2e8f0] bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-[15px] font-bold text-[#0f172a]">Procedimento original</h4>
                <p className="text-[12px] text-[#64748b]">Referência da sessão anterior</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                <Lock className="h-3 w-3" aria-hidden />
                Somente leitura
              </span>
            </div>

            {!procedimentoFeitoOrigemId ? (
              <p className="text-[13px] text-[#94a3b8]">Nenhum procedimento de origem vinculado.</p>
            ) : parentLoading ? (
              <div className="flex items-center gap-2 py-8 text-[13px] text-[#64748b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando procedimento original…
              </div>
            ) : parentError ? (
              <p className="text-[13px] text-[#dc2626]">{parentError}</p>
            ) : (
              <>
                <dl className="mb-4 space-y-2 text-[13px]">
                  <div>
                    <dt className="font-semibold text-[#64748b]">Procedimento</dt>
                    <dd className="font-bold text-[#0f172a]">{nomeProcedimentoPai}</dd>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="font-semibold text-[#64748b]">Data</dt>
                      <dd className="text-[#0f172a]">{formatDataHora(parentMeta?.horaInicio, fuso)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[#64748b]">Profissional</dt>
                      <dd className="text-[#0f172a]">
                        {String(parentMeta?.profissionalNome || '').trim() || '—'}
                      </dd>
                    </div>
                  </div>
                  {parentMeta?.observacao ? (
                    <div>
                      <dt className="font-semibold text-[#64748b]">Observações</dt>
                      <dd className="whitespace-pre-wrap text-[#0f172a]">{parentMeta.observacao}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mb-4 space-y-4">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#00a88e]">Fotos de referência</p>
                  {FOTO_TIPOS_COLUNA.map(({ codigo, label }) => {
                    const items = fotosPorTipo[codigo] || [];
                    return (
                      <div key={codigo}>
                        <p className="mb-1.5 text-[12px] font-semibold text-[#64748b]">{label}</p>
                        {items.length === 0 ? (
                          <p className="text-[11px] text-[#94a3b8]">Sem fotos</p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {items.map((item) => {
                              const imgUrl = item.thumbUrl || item.url;
                              return (
                                <button
                                  key={item.serverId}
                                  type="button"
                                  onClick={() => {
                                    if (imgUrl) {
                                      setLightboxPhoto({
                                        url: imgUrl,
                                        alt: `${label} — ${nomeProcedimentoPai}`,
                                        serverId: item.serverId,
                                      });
                                    }
                                  }}
                                  className="group relative h-28 w-28 sm:h-36 sm:w-36 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9] shadow-sm transition-all hover:border-[#00a88e] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00a88e]"
                                  title={`Clique para ampliar: ${label}`}
                                >
                                  {imgUrl ? (
                                    <>
                                      <img src={imgUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 transition-colors group-hover:bg-black/40">
                                        <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md" />
                                        <span className="text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 drop-shadow-md">
                                          Ampliar
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[#94a3b8]">
                                      <ImageIcon className="h-6 w-6" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {parentSemMapa ? (
                  <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-center text-[13px] text-[#64748b]">
                    Procedimento original sem mapa registrado.
                  </p>
                ) : (
                  <>
                    <VistaChipsBar
                      vistasPreenchidas={vistasPaiPreenchidas}
                      vistaAtual={vistaPai}
                      onSelectVista={setVistaPai}
                      countPontosVista={countPontosPai}
                    />
                    <div className="mt-3 min-h-0">
                      <VistaAtivaHeader vistaAtual={vistaPai} />
                      <FotoVistaCanvas
                        readOnly
                        showToolbar={false}
                        vistaAtual={vistaPai}
                        foto={parentFotosPorVista[vistaPai] ?? null}
                        procedimentoArmado={procedimentoArmadoPai}
                        pontosVista={gruposPontosPai}
                        emptyTitle="Sem foto nesta vista"
                        emptySubtitle="O mapa do procedimento original não possui imagem para esta vista."
                        onRequestFullscreen={() => setParentMapaFullscreen(true)}
                        className="border-0 p-0 shadow-none"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Fotos do Resultado (Posicionado na Esquerda) */}
          <div className="rounded-2xl border border-[#cbd5e1] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-[15px] font-bold text-[#0f172a]">Foto do resultado</h4>
                <p className="text-[12px] text-[#64748b]">Fotos do resultado final desta consulta de retorno</p>
              </div>
              <span className="text-[12px] font-semibold text-[#64748b]">
                {photos.length}/{evaluationPhotoMax}
              </span>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((ph, idx) => (
                <div key={ph.url ? `${ph.url}_${idx}` : idx} className="min-w-0">
                  <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]">
                    <img src={ph.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => onEvaluationRemovePhoto?.(idx)}
                      className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                      aria-label="Remover imagem"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="col-span-2 flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-2 text-[#64748b] transition-colors active:border-[#00a88e]/50 active:bg-[#f0fdf9] active:text-[#00a88e] sm:col-span-1 sm:aspect-square sm:min-h-0 sm:hover:border-[#00a88e]/50 sm:hover:bg-[#f0fdf9] sm:hover:text-[#00a88e]"
              >
                <Camera className="h-6 w-6" strokeWidth={2} />
                <span className="px-1 text-center text-[11px] font-semibold leading-tight">
                  Upload de imagens
                </span>
              </button>
            </div>

            {photos.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#94a3b8]">
                <ImageIcon className="h-4 w-4 shrink-0" />
                Registre fotos do resultado final deste retorno.
              </p>
            ) : null}
          </div>
        </div>

        {/* Coluna direita — retoque + conclusão */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#00a88e]/25 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[15px] font-bold text-[#0f172a]">Houve retoque nesta visita?</p>
              <p className="text-[12px] text-[#64748b]">
                Marque Sim para registrar fotos de retoque e mapa corretivo desta visita
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={houveRetoque}
              onClick={() => setHouveRetoque?.(!houveRetoque)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                houveRetoque ? 'bg-[#00a88e]' : 'bg-[#cbd5e1]'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  houveRetoque ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {houveRetoque ? (
            <div className="mb-6 space-y-6">
              {/* Fotos de Retoque (Pré e Pós-imediato) */}
              <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-5 shadow-sm">
                <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Fotos do retoque</h4>
                <p className="mb-4 text-[12px] text-[#64748b]">
                  Registre fotos do paciente antes de aplicar o retoque e pós-imediato desta visita.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Pré-retoque (Antes) */}
                  <div className="rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-[13px] font-bold text-[#0f172a]">Pré-retoque (Antes)</h5>
                        <p className="text-[11px] text-[#64748b]">Antes de aplicar o retoque</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {preRetoquePhotos.length} foto(s)
                      </span>
                    </div>

                    <input
                      ref={uploadPreRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          onProcedureUploadFiles?.(e.target.files, 'antes');
                        }
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2.5">
                      {preRetoquePhotos.map((ph) => {
                        const globalIdx = procedurePhotos.indexOf(ph);
                        return (
                          <div key={ph.url} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9]">
                            <img src={ph.url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => onProcedureRemovePhoto?.(globalIdx)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c]"
                              title="Remover foto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onProcedureOpenCamera?.('antes')}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-app-accent/40 bg-app-nav-active text-[#00a88e] hover:bg-[#e6f7f5] transition-colors"
                        title="Tirar foto com a câmera"
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Câmera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => uploadPreRef.current?.click()}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white text-[#64748b] hover:border-[#00a88e]/50 hover:bg-[#f0fdf9] hover:text-[#00a88e] transition-colors"
                        title="Upload de arquivo de imagem"
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Arquivo</span>
                      </button>
                    </div>
                  </div>

                  {/* Pós-imediato (Retoque) */}
                  <div className="rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-[13px] font-bold text-[#0f172a]">Pós-imediato (Retoque)</h5>
                        <p className="text-[11px] text-[#64748b]">Logo após aplicar o retoque</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {posRetoquePhotos.length} foto(s)
                      </span>
                    </div>

                    <input
                      ref={uploadPosRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          onProcedureUploadFiles?.(e.target.files, 'pos_imediato');
                        }
                        e.target.value = '';
                      }}
                    />

                    <div className="flex flex-wrap gap-2.5">
                      {posRetoquePhotos.map((ph) => {
                        const globalIdx = procedurePhotos.indexOf(ph);
                        return (
                          <div key={ph.url} className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#f1f5f9]">
                            <img src={ph.url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => onProcedureRemovePhoto?.(globalIdx)}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md hover:bg-[#b91c1c]"
                              title="Remover foto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onProcedureOpenCamera?.('pos_imediato')}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-app-accent/40 bg-app-nav-active text-[#00a88e] hover:bg-[#e6f7f5] transition-colors"
                        title="Tirar foto com a câmera"
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Câmera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => uploadPosRef.current?.click()}
                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white text-[#64748b] hover:border-[#00a88e]/50 hover:bg-[#f0fdf9] hover:text-[#00a88e] transition-colors"
                        title="Upload de arquivo de imagem"
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Arquivo</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mapa de retoque */}
              <div className="rounded-2xl border border-[#00a88e]/25 bg-white p-5 shadow-sm">
                <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Mapa de retoque</h4>
                <p className="mb-4 text-[12px] text-[#64748b]">
                  Tire ou envie uma foto nova desta visita e marque pontos e traços sobre ela.
                </p>
                {mapaRetornoState ? (
                  <>
                    <VistaChipsBar
                      vistasPreenchidas={
                        retornoVistasPreenchidas.length
                          ? retornoVistasPreenchidas
                          : [retornoVistaAtual]
                      }
                      vistaAtual={retornoVistaAtual}
                      onSelectVista={(v) => mapaRetornoState.setVistaAtual(v)}
                      countPontosVista={mapaRetornoState.countPontosVista}
                    />
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-2">
                        <VistaAtivaHeader vistaAtual={retornoVistaAtual} />
                        {parentFotosPorVista?.[retornoVistaAtual]?.displayUrl && !retornoFotoAtual ? (
                          <button
                            type="button"
                            onClick={() => {
                              const parentFoto = parentFotosPorVista[retornoVistaAtual];
                              mapaRetornoState.setFotoVista(retornoVistaAtual, {
                                displayUrl: parentFoto.displayUrl,
                                fotoGaleriaId: parentFoto.fotoGaleriaId,
                                source: 'galeria',
                              });
                              toast.success('Foto do procedimento original vinculada ao retoque!');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#00a88e]/40 bg-[#f0fdf9] px-2.5 py-1 text-[11px] font-semibold text-[#00a88e] hover:bg-[#e6fcf5] transition-colors"
                            title="Usar a mesma foto do procedimento original nesta vista"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Usar foto original
                          </button>
                        ) : null}
                      </div>
                      {listaProcedimentosSessao.length > 1 && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Procedimento:
                          </span>
                          {listaProcedimentosSessao.map((proc) => {
                            const isArmado = proc.id === procedimentoArmado?.id;
                            const cor = proc.corHex || corParaProcedimento(proc.id);
                            return (
                              <button
                                key={`${proc.id}_${proc.index}`}
                                type="button"
                                onClick={() => setProcedimentoArmadoId(proc.id)}
                                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                  isArmado
                                    ? 'border-2 text-slate-900 bg-white ring-2 ring-teal-500/20 shadow-md'
                                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                                style={isArmado ? { borderColor: cor } : {}}
                              >
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: cor }}
                                  aria-hidden
                                />
                                <span>{proc.nome}</span>
                                {isArmado && (
                                  <span className="ml-1 text-[9px] font-black uppercase text-teal-600 bg-teal-50 px-1 py-0.2 rounded">
                                    Ativo
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <FotoVistaCanvas
                        previewMode={false}
                        showToolbar={true}
                        vistaAtual={retornoVistaAtual}
                        foto={retornoFotoAtual}
                        procedimentoArmado={procedimentoArmado}
                        pontosVista={retornoGruposPontos}
                        onAddPonto={handleAddPontoComProcedimento}
                        onEditarPonto={(_catId, vista, localId, patch) =>
                          mapaRetornoState.editarPonto(vista, localId, patch)
                        }
                        onRemovePonto={(_catId, vista, localId) =>
                          mapaRetornoState.removerPonto(vista, localId)
                        }
                        onRequestCapture={() => {
                          onPrepareMapaCapture?.(retornoVistaAtual);
                          toast.info(
                            'Use o botão da câmera flutuante para capturar a foto desta vista.',
                          );
                        }}
                        onRequestUpload={(file) => {
                          if (!file) return;
                          mapaRetornoState.setFotoVista(retornoVistaAtual, {
                            displayUrl: URL.createObjectURL(file),
                            blob: file,
                            source: 'upload',
                          });
                        }}
                        onRequestFullscreen={() => setRetornoFullscreenOpen(true)}
                        className="border-0 p-0 shadow-none"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex justify-end border-t border-app-border pt-6">
            <button
              type="button"
              onClick={() => onConcluirRetorno?.()}
              disabled={isConcluirBusy}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConcluirBusy ? 'Salvando…' : 'Concluir Retorno'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Lightbox para foto de referência */}
      {lightboxPhoto ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.alt || 'Foto ampliada'}
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold text-white">{lightboxPhoto.alt}</h3>
            </div>
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <div
            className="relative mx-auto flex min-h-0 flex-1 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ZoomableGalleryLightbox
              url={lightboxPhoto.url}
              alt={lightboxPhoto.alt}
              pacienteId={pacienteId}
              fotoId={lightboxPhoto.serverId}
            />
          </div>
        </div>
      ) : null}

      {/* Modal de Zoom/Inspeção em Tela Cheia do Mapa Original (Somente Leitura) */}
      {parentMapaFullscreen ? (
        <div
          className="fixed inset-0 z-[300] flex flex-col bg-[#0f172a] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Zoom do Mapa Original"
          onClick={() => setParentMapaFullscreen(false)}
        >
          <div
            className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 pb-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-[15px] font-bold text-white">
                Mapa do procedimento original ({vistaPai})
              </h3>
              <p className="text-[12px] font-medium text-white/60">
                Modo de visualização e zoom — Somente leitura
              </p>
            </div>
            <button
              type="button"
              onClick={() => setParentMapaFullscreen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
          <div
            className="relative mx-auto flex h-[82vh] w-full max-w-6xl items-center justify-center pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <FotoVistaCanvasCore
              readOnly={true}
              vistaAtual={vistaPai}
              foto={parentFotosPorVista[vistaPai] ?? null}
              procedimentoArmado={procedimentoArmadoPai}
              pontosVista={gruposPontosPai}
              showToolbar={false}
              fillViewport={true}
              externalModo="mover"
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

      {/* Fullscreen Mapeamento de Retoque Overlay */}
      {retornoFullscreenOpen ? (
        <MapeamentoFullscreenOverlay
          scope="retorno"
          open={retornoFullscreenOpen}
          vistaAtual={retornoVistaAtual}
          foto={retornoFotoAtual}
          procedimentoArmado={procedimentoArmado}
          hideProcedimentoPicker={false}
          pacienteId={pacienteId}
          onArmar={(proc) => setProcedimentoArmadoId(proc?.id)}
          onAdicionarProcedimento={handleAdicionarProcedimentoRetorno}
          procedimentosUsados={listaProcedimentosSessao}
          pontosVista={retornoGruposPontos}
          gruposSessao={gruposSessao}
          countPontosVista={mapaRetornoState?.countPontosVista?.(retornoVistaAtual) ?? 0}
          onAddPonto={handleAddPontoComProcedimento}
          onEditarPonto={(_catId, vista, localId, patch) =>
            mapaRetornoState?.editarPonto(vista, localId, patch)
          }
          onRemovePonto={(_catId, vista, localId) =>
            mapaRetornoState?.removerPonto(vista, localId)
          }
          onDesfazerUltimo={() => mapaRetornoState?.desfazerUltimoPonto?.(retornoVistaAtual)}
          onClearVista={() => mapaRetornoState?.limparPontosVista?.(retornoVistaAtual)}
          onRemoverFotoVista={() => mapaRetornoState?.removerFotoVista?.(retornoVistaAtual)}
          onMudarCorProcedimento={handleMudarCorProcedimento}
          onClose={() => setRetornoFullscreenOpen(false)}
        />
      ) : null}
    </div>
  );
}
