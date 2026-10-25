/* eslint-disable react-refresh/only-export-components -- funções utilitárias exportadas para testes e canvas */
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Menu,
  Check,
  Loader2,
  Minimize2,
  MoveDiagonal,
  CircleDot,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  ChevronDown,
  ChevronUp,
  Minus,
  ImageIcon,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  usePacienteGaleriaArquivoBlobUrl,
  buildGaleriaArquivoFallbackPath,
} from '../../../hooks/usePacienteGaleriaArquivoBlobUrl.js';
import { FotoVistaCanvasCore } from './FotoVistaCanvas.jsx';
import { MapeamentoFullscreenToolbar } from './MapeamentoFullscreenToolbar.jsx';
import { PontosResumoPanel } from './PontosResumoPanel.jsx';
import { useMapeamentoFullscreenKeyboardShortcuts } from './useMapeamentoFullscreenKeyboardShortcuts.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { useToast } from '../../../contexts/useToast.js';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import {
  MAPEAMENTO_PALETA_CORES,
  corParaProcedimento,
  getCorLivreParaProcedimento,
} from '../../../constants/mapeamentoPaletaCores.js';
import { AssistiveTouchToolbar } from './AssistiveTouchToolbar.jsx';
import { mapasApi, planejamentosApi, catalogosApi } from '../../../services/api.js';
import { isRealUuid } from '../../../utils/planejamentoDraftUtils.js';
import { garantirProcedimentosNoPlano } from '../../../utils/sincronizarProcedimentosPlanoAgenda.js';
import { normalizeListaPlanos, enriquecerPlanosComCatalogo } from '../../../utils/planejamentoNormalize.js';
import { isItemFinalizado, isItemCancelado } from '../../../utils/planejamentoStatusUi.js';

const COR_PADRAO_AVALIACAO = '#0d9488';

/**
 * Normaliza qualquer objeto de procedimento para o formato uniforme consumido pela UI e pelo canvas.
 * Garante nome legível, cor válida e catalogoProcedimentoSaudeId preenchido.
 */
export function normalizarProcedimento(p, catMap = null) {
  if (!p) return null;
  const catId = String(
    p.catalogoProcedimentoSaudeId || p.catalogoId || p.nomeProcedimentoCatalogoId || p.id || ''
  ).trim() || null;
  const catInfo = catId && catMap instanceof Map ? catMap.get(catId) : null;
  const candidatosNome = [
    p.nomeProcedimento,
    p.procedimentoNome,
    p.catalogoNome,
    p.nome,
    catInfo?.nomeProcedimento,
    catInfo?.nome,
  ];
  const nomeLimpo =
    candidatosNome
      .map((n) => String(n || '').trim())
      .find((n) => n && n.toLowerCase() !== 'procedimento' && n.toLowerCase() !== 'avaliação' && n.toLowerCase() !== 'avaliacao') ||
    'Procedimento';
  return {
    ...p,
    id: catId || p.id,
    catalogoProcedimentoSaudeId: catId,
    nome: nomeLimpo,
    catalogoNome: nomeLimpo,
    nomeProcedimento: nomeLimpo,
    corHex: p.corHex || p.cor || (catId ? corParaProcedimento(catId) : COR_PADRAO_AVALIACAO),
    unidadeMedida: p.unidadeMedida || catInfo?.unidadeMedida || catInfo?.unidadePadrao || 'un',
  };
}

export function normalizarListaProcedimentos(lista, catMap = null) {
  if (!Array.isArray(lista)) return [];
  return lista.map((p) => normalizarProcedimento(p, catMap)).filter(Boolean);
}

function MapeamentoFotoThumbnail({ photo, pacienteId, alt = '' }) {
  const rawUrl = photo?.cleanUrl || photo?.url || photo?.displayUrl || '';
  const isApiUrl = typeof rawUrl === 'string' && (rawUrl.startsWith('/api/') || rawUrl.includes('/arquivo') || rawUrl.includes('/pacientes/'));
  const fid = photo?.fotoId || photo?.id || photo?.meta?.fotoId || null;
  const fallback = buildGaleriaArquivoFallbackPath(pacienteId || photo?.pacienteId, fid);
  const { src, loading, error, onImgError } = usePacienteGaleriaArquivoBlobUrl(isApiUrl ? rawUrl : null, isApiUrl, false, fallback);

  const displaySrc = isApiUrl ? src : (src || rawUrl);

  if (error && !displaySrc) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
        <ImageIcon className="h-4 w-4" />
      </div>
    );
  }
  if (isApiUrl && (loading || !displaySrc)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
      </div>
    );
  }
  return <img src={displaySrc} alt={alt} className="h-full w-full object-cover" onError={onImgError} />;
}

/**
 * Resolução de Ângulo Anatômico Canônico (Defesa contra HTTP 404).
 * Mapeia qualquer foto/meta para um ângulo válido de tb_angulo_foto (ex: 'frontal').
 * NUNCA retorna 'avaliacao' nem 'procedimento'.
 */
export function resolveAnguloCanonico(foto, vistaAtual) {
  const raw = foto?.anguloFotoCodigo || foto?.meta?.anguloFotoCodigo || vistaAtual || 'frontal';
  const norm = String(raw || '').toLowerCase().trim();
  if (!norm || norm === 'frente' || norm === 'avaliacao' || norm === 'procedimento') {
    return 'frontal';
  }
  return norm;
}

export function MapeamentoFullscreenOverlay({
  open,
  toolbarWidthPx = 240,
  vistaAtual: propVistaAtual,
  foto: propFoto,
  photos = [],
  editingIndex = 0,
  setEditingIndex,
  onSelectCapturedPhoto,
  procedimentoArmado,
  onArmar,
  procedimentosUsados = [],
  procedimentosIniciais = [],
  planoContexto,
  pacienteId,
  roleUserId,
  atendimentoId = null,
  pontosVista: propPontosVista,
  gruposSessao,
  countPontosVista: propCountPontosVista,
  onAddPonto: propOnAddPonto,
  onEditarPonto: propOnEditarPonto,
  onRemovePonto: propOnRemovePonto,
  onDesfazerUltimo: propOnDesfazerUltimo,
  onClearVista: propOnClearVista,
  onClose,
  onSalvarFotoAnotada,
  onAnnotatedCaptureSaved,
  _persistAnnotatedPhotoToGallery,
  aguardarFotosPendentes,
  obterFotoId,
  hideProcedimentoPicker = false,
  unidadeMedida,
  onUnidadeMedidaChange,
  presets,
  passo,
  onRemoverFotoVista,
  onMudarCorProcedimento,
  scope = 'evaluation', // 'evaluation' | 'procedure'
  tituloAcaoPrimaria: propTituloAcaoPrimaria,
  imageSrc,
}) {
  const toast = useToast();
  const [modo, setModo] = useState('ponto');
  const [tamanhoGlobalPonto, setTamanhoGlobalPonto] = useState(1.0);
  const [mostrarValores, setMostrarValores] = useState(true);
  const [resumoModalOpen, setResumoModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);
  const mainContainerRef = useRef(null);
  const transformWrapperRef = useRef(null);
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: false,
  });

  // Modo controlado (quando os handlers de pontos vêm de fora, ex: MapeamentoFacialPanel / ConsultaRetornoFlow)
  const isControlledMode = typeof propOnAddPonto === 'function';

  // Resolução da foto ativa e URL
  const activeIndex = typeof editingIndex === 'number' && editingIndex >= 0 ? editingIndex : 0;
  const activePhoto =
    propFoto ||
    (photos && photos[activeIndex]) ||
    (imageSrc ? { url: imageSrc, cleanUrl: imageSrc, displayUrl: imageSrc } : null);
  const resolvedDisplayUrl =
    activePhoto?.cleanUrl ||
    activePhoto?.url ||
    activePhoto?.displayUrl ||
    imageSrc ||
    null;

  const vistaAtual =
    propVistaAtual ||
    resolveAnguloCanonico(activePhoto, null);

  // ── DEFESA 1 & 2: Autonomia de estado e isolamento por foto no carrossel ────
  const [internalPontos, setInternalPontos] = useState(() => {
    return activePhoto?.mapaOverlay?.pontos || activePhoto?.pontos || [];
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const prevActiveIndexRef = useRef(activeIndex);
  const prevOverlaySigRef = useRef('');
  const removedProcIdsRef = useRef(new Set());
  const [catalogoMap, setCatalogoMap] = useState(() => new Map());

  useEffect(() => {
    removedProcIdsRef.current.clear();
  }, [activeIndex, open]);

  useEffect(() => {
    const novaFoto = (photos && photos[activeIndex]) || propFoto;
    const novosPontos = novaFoto?.mapaOverlay?.pontos || novaFoto?.pontos || [];
    const novosProcs = novaFoto?.mapaOverlay?.procedimentos || novaFoto?.procedimentosMapeados || [];
    const sig = JSON.stringify({
      idx: activeIndex,
      mapaId: novaFoto?.mapaOverlay?.mapaId || null,
      pts: novosPontos,
      procs: novosProcs,
    });

    if (prevActiveIndexRef.current !== activeIndex) {
      prevActiveIndexRef.current = activeIndex;
      prevOverlaySigRef.current = sig;
      setInternalPontos(novosPontos);
      if (Array.isArray(novosProcs) && novosProcs.length > 0) {
        const norm = normalizarListaProcedimentos(novosProcs, catalogoMap);
        const filtrados = norm.filter(
          (p) => !removedProcIdsRef.current.has(String(p.catalogoProcedimentoSaudeId || p.id).trim())
        );
        setProcedimentosLocais(filtrados);
      }
      setIsDirty(false);
      return;
    }

    if (!isDirty && !isSaving && sig !== prevOverlaySigRef.current) {
      prevOverlaySigRef.current = sig;
      setInternalPontos(novosPontos);
      if (Array.isArray(novosProcs) && novosProcs.length > 0) {
        const normNovosProcs = normalizarListaProcedimentos(novosProcs, catalogoMap);
        setProcedimentosLocais((prev) => {
          const getKey = (p) => String(p?.catalogoProcedimentoSaudeId || p?.catalogoId || p?.id || '').trim();
          const mapPrev = new Map((prev || []).map((p) => [getKey(p), p]));
          const merged = [...(prev || [])];
          for (const np of normNovosProcs) {
            const k = getKey(np);
            if (k && !mapPrev.has(k) && !removedProcIdsRef.current.has(k)) {
              merged.push(np);
            }
          }
          return merged;
        });
      }
    } else if (!isDirty && !isSaving && novosPontos.length === 0 && !novaFoto?.mapaOverlay && internalPontos.length > 0) {
      setInternalPontos([]);
    }
  }, [activeIndex, photos, propFoto, isDirty, isSaving, catalogoMap, internalPontos.length]);

  const [procedimentosLocais, setProcedimentosLocais] = useState(() => {
    const fromPhoto = activePhoto?.mapaOverlay?.procedimentos || activePhoto?.procedimentosMapeados;
    if (Array.isArray(fromPhoto) && fromPhoto.length > 0) return normalizarListaProcedimentos(fromPhoto);
    if (Array.isArray(procedimentosUsados) && procedimentosUsados.length > 0) return normalizarListaProcedimentos(procedimentosUsados);
    if (Array.isArray(procedimentosIniciais) && procedimentosIniciais.length > 0) return normalizarListaProcedimentos(procedimentosIniciais);
    return [];
  });

  useEffect(() => {
    const fonteExternaBruta =
      Array.isArray(procedimentosUsados) && procedimentosUsados.length > 0
        ? procedimentosUsados
        : Array.isArray(procedimentosIniciais) && procedimentosIniciais.length > 0
          ? procedimentosIniciais
          : [];
    if (fonteExternaBruta.length === 0) return;
    const fonteExterna = normalizarListaProcedimentos(fonteExternaBruta, catalogoMap).filter(
      (p) => !removedProcIdsRef.current.has(String(p.catalogoProcedimentoSaudeId || p.id).trim())
    );
    if (fonteExterna.length === 0) return;
    setProcedimentosLocais((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const getKey = (p) => String(p?.catalogoProcedimentoSaudeId || p?.catalogoId || p?.id || '').trim();
      const mapPrev = new Map(prev.map((p) => [getKey(p), p]));
      let mudou = false;
      const merged = [...prev];
      for (const ext of fonteExterna) {
        const k = getKey(ext);
        if (!k || removedProcIdsRef.current.has(k)) continue;
        if (!mapPrev.has(k)) {
          merged.push(ext);
          mudou = true;
        } else {
          const atual = mapPrev.get(k);
          if (!atual.planejamentoItemId && ext.planejamentoItemId) {
            const idx = merged.findIndex((m) => getKey(m) === k);
            if (idx >= 0) {
              merged[idx] = { ...atual, planejamentoItemId: ext.planejamentoItemId };
              mudou = true;
            }
          }
        }
      }
      return mudou ? merged : prev;
    });
  }, [procedimentosUsados, procedimentosIniciais, catalogoMap]);

  const listaProcedimentos = useMemo(() => {
    if (procedimentosLocais.length > 0) return procedimentosLocais;
    if (procedimentoArmado?.id && !removedProcIdsRef.current.has(String(procedimentoArmado.id).trim())) {
      return [procedimentoArmado];
    }
    return [];
  }, [procedimentosLocais, procedimentoArmado]);

  const [activeProcedimentoId, setActiveProcedimentoId] = useState(
    () => procedimentoArmado?.id || listaProcedimentos[0]?.id || null
  );

  useEffect(() => {
    if (procedimentoArmado?.id) {
      setActiveProcedimentoId(procedimentoArmado.id);
    } else if (!activeProcedimentoId && listaProcedimentos[0]?.id) {
      setActiveProcedimentoId(listaProcedimentos[0].id);
    } else if (activeProcedimentoId && !listaProcedimentos.some((p) => p.id === activeProcedimentoId)) {
      setActiveProcedimentoId(listaProcedimentos[0]?.id || null);
    }
  }, [procedimentoArmado?.id, activeProcedimentoId, listaProcedimentos]);

  const activeProc = useMemo(() => {
    if (activeProcedimentoId) {
      const found = listaProcedimentos.find((p) => p.id === activeProcedimentoId);
      if (found) return found;
    }
    return (procedimentoArmado?.id ? procedimentoArmado : null) || listaProcedimentos[0] || null;
  }, [listaProcedimentos, activeProcedimentoId, procedimentoArmado]);

  // Carregamento resiliente dos procedimentos do Plano Ativo do paciente com Catálogo em paralelo
  const [procedimentosDoPlano, setProcedimentosDoPlano] = useState([]);
  useEffect(() => {
    if (!pacienteId || !isRealUuid(pacienteId)) {
      setProcedimentosDoPlano([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      planejamentosApi.listarPorPaciente(pacienteId).catch(() => []),
      catalogosApi.list(false).catch(() => []),
    ])
      .then(([resPlanos, resCatalogos]) => {
        if (cancelled) return;
        const catalogosList = Array.isArray(resCatalogos) ? resCatalogos : resCatalogos?.content || [];
        const catMap = new Map(
          catalogosList
            .filter((c) => c?.id != null)
            .map((c) => [
              String(c.id).trim(),
              {
                ...c,
                id: String(c.id).trim(),
                nome: String(c.nomeProcedimento || c.nome || '').trim(),
                nomeProcedimento: String(c.nomeProcedimento || c.nome || '').trim(),
              },
            ])
        );
        setCatalogoMap(catMap);

        // Reidrata nomes de procedimentosLocais caso algum tenha vindo apenas com ID ou como 'Procedimento'
        setProcedimentosLocais((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          let mudou = false;
          const next = prev.map((p) => {
            const norm = normalizarProcedimento(p, catMap);
            if (norm && norm.nome !== p.nome) {
              mudou = true;
              return norm;
            }
            return p;
          });
          return mudou ? next : prev;
        });

        // Usa o normalizador canônico do sistema (mesmo do PlanosTab)
        const planosNormalizados = enriquecerPlanosComCatalogo(
          normalizeListaPlanos(resPlanos),
          Array.from(catMap.values())
        );

        // NUNCA usar || planos[0]! Só considera plano realmente aberto/ativo
        const planoAtivo = planosNormalizados.find((p) => {
          const st = String(p.statusCodigo || p.status || '').trim().toLowerCase();
          return (
            (st === 'ativo' || st === 'aberto' || st === 'rascunho' || st === 'montando' || st === 'em_andamento') &&
            !p.concluidoEm &&
            !p.encerradoEm
          );
        });

        if (planoAtivo && Array.isArray(planoAtivo.itens)) {
          const itensPendentes = planoAtivo.itens.filter((it) => {
            const status = it.statusItem ?? it.statusItemNome ?? it.status;
            return !isItemFinalizado(status) && !isItemCancelado(status);
          });
          const procs = itensPendentes
            .map((it) => {
              const catId = String(it.catalogoProcedimentoSaudeId || it.catalogoId || '').trim();
              if (!catId) return null;
              const catInfo = catMap.get(catId);
              const nomeResolvido =
                [it.catalogoNome, it.nomeProcedimento, it.procedimentoNome, it.nome, catInfo?.nomeProcedimento, catInfo?.nome]
                  .map((s) => String(s || '').trim())
                  .find((s) => s && s.toLowerCase() !== 'procedimento') || 'Procedimento';
              return {
                id: catId,
                catalogoProcedimentoSaudeId: catId,
                planejamentoItemId: it.id,
                nome: nomeResolvido,
                catalogoNome: nomeResolvido,
                nomeProcedimento: nomeResolvido,
                unidadeMedida: it.unidadeMedida || catInfo?.unidadeMedida || catInfo?.unidadePadrao || 'un',
                corHex: it.corHex || corParaProcedimento(catId),
                isRetorno: Boolean(it.isRetorno),
              };
            })
            .filter(Boolean);
          setProcedimentosDoPlano(procs);
        } else {
          setProcedimentosDoPlano([]);
        }
      })
      .catch((err) => {
        console.warn('[MapeamentoFullscreenOverlay] Erro ao carregar procedimentos do plano e catálogo:', err);
        if (!cancelled) setProcedimentosDoPlano([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pacienteId]);

  // Gatilho e aviso amigável quando o usuário clica na foto sem procedimento selecionado
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);
  const lastTentativaToastRef = useRef(0);

  const handleTentativaSemProcedimento = useCallback(() => {
    const agora = Date.now();
    if (agora - lastTentativaToastRef.current > 2000) {
      lastTentativaToastRef.current = agora;
      toast.info('Para desenhar, selecione um procedimento no menu lateral.');
    }
    setSidebarOpen(true);
    setFocusSearchTrigger((prev) => prev + 1);
  }, [toast]);

  const [corLivre, setCorLivre] = useState(COR_PADRAO_AVALIACAO);
  const activeCor =
    activeProc?.corHex || (activeProc?.id ? corParaProcedimento(activeProc.id) : null) || corLivre;
  const activeUnidade = activeProc?.unidadeMedida || unidadeMedida || 'un';

  const handleSelectProcedimento = (proc) => {
    setActiveProcedimentoId(proc.id);
    onArmar?.(proc);
  };

  const handleAdicionarProcedimento = (proc) => {
    const catId = String(proc.catalogoProcedimentoSaudeId || proc.catalogoId || proc.id || '').trim();
    if (catId) {
      removedProcIdsRef.current.delete(catId);
    }
    const catInfo = catId && catalogoMap instanceof Map ? catalogoMap.get(catId) : null;
    const candidatosNome = [
      proc.nomeProcedimento,
      proc.procedimentoNome,
      proc.catalogoNome,
      proc.nome,
      catInfo?.nomeProcedimento,
      catInfo?.nome,
    ];
    const nomeLimpo =
      candidatosNome
        .map((n) => String(n || '').trim())
        .find((n) => n && n.toLowerCase() !== 'procedimento' && n.toLowerCase() !== 'avaliação' && n.toLowerCase() !== 'avaliacao') ||
      'Procedimento';

    const coresOcupadas = new Set(
      (procedimentosLocais || []).map((p) => (p.corHex || '').toLowerCase()).filter(Boolean)
    );
    const corAtribuida = proc.corHex || getCorLivreParaProcedimento(catId, coresOcupadas);

    const procNormalizado = {
      ...proc,
      id: catId,
      catalogoProcedimentoSaudeId: catId,
      nome: nomeLimpo,
      catalogoNome: nomeLimpo,
      nomeProcedimento: nomeLimpo,
      corHex: corAtribuida,
      unidadeMedida: proc.unidadeMedida || catInfo?.unidadeMedida || catInfo?.unidadePadrao || 'un',
    };
    setProcedimentosLocais((prev) => {
      const jaExiste = prev.some((p) => matchProcId(p, catId));
      if (jaExiste) return prev;
      return [...prev, procNormalizado];
    });
    setActiveProcedimentoId(catId);
    onArmar?.(procNormalizado);
  };

  const handleRemoverProcedimento = useCallback(
    (procId) => {
      removedProcIdsRef.current.add(String(procId).trim());
      setProcedimentosLocais((prev) => {
        const filtered = prev.filter((p) => !matchProcId(p, procId));
        if (matchProcId({ id: activeProcedimentoId }, procId)) {
          const nextActive = filtered[0]?.id || null;
          setActiveProcedimentoId(nextActive);
          if (filtered[0]) {
            onArmar?.(filtered[0]);
          } else {
            onArmar?.(null);
          }
        }
        return filtered;
      });
      // Remove marcações órfãs do canvas que pertenciam ao procedimento excluído
      setInternalPontos((prev) =>
        prev.filter((pt) => !matchProcId(pt, procId))
      );
      setIsDirty(true);
    },
    [activeProcedimentoId, onArmar]
  );

  const matchProcId = (p, targetId) => {
    if (!targetId || !p) return false;
    const t = String(targetId).trim();
    return [p.id, p.catalogoProcedimentoSaudeId, p.catalogoId, p.nomeProcedimentoCatalogoId, p._uid]
      .filter(Boolean)
      .some((id) => String(id).trim() === t);
  };

  const handleMudarCorProcedimento = (procId, novaCor) => {
    const alvo = procedimentosLocais.find((p) => matchProcId(p, procId));
    const corAntigaAlvo = alvo?.corHex;
    const outroAfetado = procedimentosLocais.find(
      (p) => !matchProcId(p, procId) && (p.corHex || corParaProcedimento(p.id)).toLowerCase() === novaCor?.toLowerCase()
    );

    setProcedimentosLocais((prev) =>
      prev.map((p) => {
        if (matchProcId(p, procId)) return { ...p, corHex: novaCor };
        if (outroAfetado && matchProcId(p, outroAfetado.id)) return { ...p, corHex: corAntigaAlvo };
        return p;
      })
    );

    // Sincroniza imediatamente as marcações do canvas
    setInternalPontos((prev) =>
      prev.map((pt) => {
        if (matchProcId(pt, procId)) {
          return { ...pt, cor: novaCor, corHex: novaCor };
        }
        if (outroAfetado && matchProcId(pt, outroAfetado.id)) {
          return { ...pt, cor: corAntigaAlvo, corHex: corAntigaAlvo };
        }
        return pt;
      })
    );
    setIsDirty(true);

    onMudarCorProcedimento?.(procId, novaCor, outroAfetado?.id, corAntigaAlvo);

    if (outroAfetado) {
      toast?.info?.(
        `Cor já utilizada em ${outroAfetado.nome || 'outro procedimento'}. Cores foram invertidas para manter a distinção.`
      );
    }
  };

  // ── Manipulação de Pontos no Modo Autônomo ───────────────────────────────────
  const handleAddPonto = useCallback(
    (vista, pontoData) => {
      if (isControlledMode) {
        propOnAddPonto?.(vista, pontoData);
        return;
      }
      const catId =
        activeProc?.catalogoProcedimentoSaudeId ||
        activeProc?.catalogoId ||
        activeProc?.id ||
        pontoData?.catalogoProcedimentoSaudeId ||
        pontoData?.catalogoId;
      const corProc =
        pontoData?.cor ||
        activeCor ||
        activeProc?.corHex ||
        (catId && catId !== 'avaliacao_geral' ? corParaProcedimento(catId) : COR_PADRAO_AVALIACAO);

      const novoPonto = {
        localId: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        posX: pontoData.posX,
        posY: pontoData.posY,
        vertices: pontoData.vertices || [],
        quantidade: pontoData.quantidade != null ? Number(pontoData.quantidade) : (configMarcacao.dosePadrao || 1),
        tamanho: pontoData.tamanho || tamanhoGlobalPonto,
        tipoGeometria: pontoData.tipoGeometria || (pontoData.vertices?.length > 1 ? 'traco' : 'ponto'),
        catalogoProcedimentoSaudeId: isRealUuid(catId) ? catId : null,
        catalogoId: catId,
        procedimentoIndex: activeProc?.index ?? 0,
        nomeProcedimento: activeProc?.nome || pontoData.nomeProcedimento,
        cor: corProc,
        corHex: corProc,
      };

      setInternalPontos((prev) => [...prev, novoPonto]);
      setIsDirty(true);
    },
    [isControlledMode, propOnAddPonto, activeProc, activeCor, tamanhoGlobalPonto, configMarcacao.dosePadrao]
  );

  const handleEditarPonto = useCallback(
    (catId, vista, localId, patch) => {
      if (isControlledMode) {
        propOnEditarPonto?.(catId, vista, localId, patch);
        return;
      }
      setInternalPontos((prev) =>
        prev.map((pt) => (pt.localId === localId ? { ...pt, ...patch } : pt))
      );
      setIsDirty(true);
    },
    [isControlledMode, propOnEditarPonto]
  );

  const handleRemovePonto = useCallback(
    (catId, vista, localId) => {
      if (isControlledMode) {
        propOnRemovePonto?.(catId, vista, localId);
        return;
      }
      setInternalPontos((prev) => prev.filter((pt) => pt.localId !== localId));
      setIsDirty(true);
    },
    [isControlledMode, propOnRemovePonto]
  );

  const handleDesfazerUltimo = useCallback(() => {
    if (isControlledMode) {
      propOnDesfazerUltimo?.();
      return;
    }
    setInternalPontos((prev) => prev.slice(0, -1));
    setIsDirty(true);
  }, [isControlledMode, propOnDesfazerUltimo]);

  const handleClearVista = useCallback(() => {
    if (isControlledMode) {
      propOnClearVista?.();
      return;
    }
    setInternalPontos([]);
    setIsDirty(true);
  }, [isControlledMode, propOnClearVista]);

  // Agrupamento para FotoVistaCanvasCore
  const effectivePontosVista = useMemo(() => {
    if (isControlledMode) return propPontosVista;

    const gruposMap = new Map();
    internalPontos.forEach((pt) => {
      const key = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || 'geral');
      if (!gruposMap.has(key)) {
        gruposMap.set(key, {
          catalogoProcedimentoSaudeId: isRealUuid(pt.catalogoProcedimentoSaudeId)
            ? pt.catalogoProcedimentoSaudeId
            : null,
          catalogoId: pt.catalogoId || null,
          nomeProcedimento: pt.nomeProcedimento || 'Procedimento',
          corHex: pt.corHex || pt.cor || COR_PADRAO_AVALIACAO,
          pontos: [],
        });
      }
      gruposMap.get(key).pontos.push(pt);
    });
    return Array.from(gruposMap.values());
  }, [isControlledMode, propPontosVista, internalPontos]);

  const countPontosTotal = isControlledMode
    ? (propCountPontosVista || 0)
    : internalPontos.length;

  const getProcedimentoStats = useCallback(
    (procId) => {
      let pontosCount = 0;
      let doseTotal = 0;
      const targetId = String(procId || '');
      const colecao = Array.isArray(effectivePontosVista) ? effectivePontosVista : [];

      colecao.forEach((item) => {
        if (Array.isArray(item.pontos)) {
          const grupoCatId = String(item.catalogoProcedimentoSaudeId || item.catalogoId || '');
          item.pontos.forEach((pt) => {
            const ptId = String(pt.catalogoProcedimentoSaudeId || pt.catalogoId || pt.procedimentoId || grupoCatId);
            if (ptId === targetId) {
              pontosCount++;
              doseTotal += Number(pt.quantidade || pt.dose || 0);
            }
          });
        } else {
          const ptId = String(item.catalogoProcedimentoSaudeId || item.catalogoId || item.procedimentoId || '');
          if (ptId === targetId) {
            pontosCount++;
            doseTotal += Number(item.quantidade || item.dose || 0);
          }
        }
      });
      return { pontosCount, doseTotal: Number(doseTotal.toFixed(2)) };
    },
    [effectivePontosVista]
  );

  // ── ESTADO DO MODAL DE DESTINO CLÍNICO (Plano vs Avulso) ───────────────────
  const [modalDestinoOpen, setModalDestinoOpen] = useState(false);
  const [modalDestinoModo, setModalDestinoModo] = useState('novo_plano'); // 'novo_plano' | 'novo_procedimento'

  // ── SALVAMENTO CANÔNICO & AUTOSAVE (Defesa contra 404, SSE Real e Sincronização) ──
  const executarSalvar = useCallback(
    async ({ fecharApos = false, destino = 'plano', sincronizarPlano = false } = {}) => {
      if (isSaving) return;
      try {
        setIsSaving(true);
        if (typeof aguardarFotosPendentes === 'function') {
          try {
            await aguardarFotosPendentes();
          } catch (eWait) {
            console.warn('[MapeamentoFullscreenOverlay] Falha ao aguardar fotos:', eWait);
          }
        }

        let resolvedFotoId =
          activePhoto?.fotoId ||
          activePhoto?.id ||
          activePhoto?.meta?.fotoId ||
          null;
        if (!resolvedFotoId && typeof obterFotoId === 'function') {
          resolvedFotoId = obterFotoId(activeIndex, activePhoto);
        }
        if (resolvedFotoId && !isRealUuid(resolvedFotoId)) {
          resolvedFotoId = null;
        }

        // DEFESA 5: Sincronização com o Plano Ativo apenas quando autorizado
        let itensCriadosPorCatalogo = {};
        if (sincronizarPlano && destino === 'plano' && pacienteId && isRealUuid(pacienteId)) {
          const catIdsParaGarantir = listaProcedimentos
            .map((p) => p.catalogoProcedimentoSaudeId || p.catalogoId || p.id)
            .filter(isRealUuid);
          if (catIdsParaGarantir.length > 0) {
            try {
              itensCriadosPorCatalogo =
                (await garantirProcedimentosNoPlano({
                  pacienteId,
                  catalogoProcedimentoSaudeIds: catIdsParaGarantir,
                  roleUserId,
                })) || {};
            } catch (errGarantir) {
              console.warn('[MapeamentoFullscreenOverlay] Falha ao garantir procedimentos no plano:', errGarantir);
            }
          }
        }

        // DEFESA 6: Ângulo Anatômico Canônico de tb_angulo_foto (Zero 404)
        const anguloCanonico = resolveAnguloCanonico(activePhoto, vistaAtual);

        const listaProcedimentosEnriquecida = listaProcedimentos.map((proc) => {
          const catId = String(proc.catalogoProcedimentoSaudeId || proc.catalogoId || proc.id || '').trim();
          const resolvedPiId = proc.planejamentoItemId || itensCriadosPorCatalogo[catId] || null;
          return {
            ...proc,
            catalogoProcedimentoSaudeId: isRealUuid(catId) ? catId : proc.catalogoProcedimentoSaudeId,
            planejamentoItemId: isRealUuid(resolvedPiId) ? resolvedPiId : null,
          };
        });
        setProcedimentosLocais(listaProcedimentosEnriquecida);

        const procedimentosPayload = listaProcedimentosEnriquecida
          .filter((proc) => isRealUuid(proc.catalogoProcedimentoSaudeId || proc.id) || isRealUuid(proc.planejamentoItemId))
          .map((proc, idx) => ({
            catalogoProcedimentoSaudeId: isRealUuid(proc.catalogoProcedimentoSaudeId || proc.id)
              ? proc.catalogoProcedimentoSaudeId || proc.id
              : null,
            catalogoNome: proc.nome,
            ordem: idx + 1,
            corHex: proc.corHex || corParaProcedimento(proc.id),
            planejamentoItemId: isRealUuid(proc.planejamentoItemId) ? proc.planejamentoItemId : null,
          }));

        // Clamping estrito (0 a 100) para respeitar as validações @Min(0) @Max(100) do backend
        const clampCoord = (n) => Math.max(0, Math.min(100, Number(Number(n ?? 0).toFixed(4))));

        const marcacoesPayload = internalPontos.map((pt) => {
          const ptCatId = isRealUuid(pt.catalogoProcedimentoSaudeId)
            ? pt.catalogoProcedimentoSaudeId
            : isRealUuid(pt.catalogoId)
            ? pt.catalogoId
            : null;

          let procIndex = procedimentosPayload.findIndex(
            (proc) =>
              (ptCatId && (proc.catalogoProcedimentoSaudeId === ptCatId || proc.id === ptCatId)) ||
              (pt.planejamentoItemId && proc.planejamentoItemId === pt.planejamentoItemId)
          );
          if (procIndex < 0 && procedimentosPayload.length === 1) {
            procIndex = 0;
          }

          return {
            anguloFotoCodigo: anguloCanonico,
            tipoGeometria: pt.tipoGeometria || (pt.vertices?.length > 1 ? 'traco' : 'ponto'),
            quantidade: pt.quantidade != null ? Number(pt.quantidade) : 1,
            tamanho: pt.tamanho != null ? Number(pt.tamanho) : 1,
            procedimentoIndex: procIndex >= 0 ? procIndex : 0,
            catalogoProcedimentoSaudeId: ptCatId,
            corHex: pt.corHex || pt.cor || (ptCatId ? corParaProcedimento(ptCatId) : COR_PADRAO_AVALIACAO),
            vertices: pt.vertices?.length
              ? pt.vertices.map((v, i) => ({
                  ordem: i + 1,
                  posX: clampCoord(v.posX ?? v.x),
                  posY: clampCoord(v.posY ?? v.y),
                }))
              : [{
                  ordem: 1,
                  posX: clampCoord(pt.posX),
                  posY: clampCoord(pt.posY),
                }],
          };
        });

        const effectivePlanItemId =
          destino === 'plano'
            ? (procedimentosPayload.find((p) => isRealUuid(p.planejamentoItemId))?.planejamentoItemId ||
               listaProcedimentosEnriquecida.find((p) => isRealUuid(p.planejamentoItemId))?.planejamentoItemId ||
               null)
            : null;
        const effectivePlanId = destino === 'plano' ? (planoContexto?.id || itensCriadosPorCatalogo?.planoId || null) : null;

        const mapaPayload = {
          pacienteId: pacienteId || null,
          tipoMapaCodigo: scope === 'procedure' ? 'procedimento' : 'avaliacao',
          planejamentoId: effectivePlanId,
          planejamentoItemId: effectivePlanItemId,
          ...(effectivePlanItemId ? { origemTipo: 'planejamento', origemId: effectivePlanItemId } : {}),
          fotoGaleriaIdPorVista: resolvedFotoId ? { [anguloCanonico]: resolvedFotoId } : {},
          procedimentos: procedimentosPayload,
          marcacoes: marcacoesPayload,
          atendimentoId: isRealUuid(atendimentoId) ? atendimentoId : null,
        };

        let savedMapa = null;
        // Evita HTTP 400 Bad Request (@NotEmpty marcacoes) quando não há pontos no mapa
        if (internalPontos.length > 0) {
          try {
            savedMapa = await mapasApi.salvar(mapaPayload);
          } catch (errSalvar) {
            console.warn('[MapeamentoFullscreenOverlay] Erro ao salvar mapa:', errSalvar);
          }
        } else if (resolvedFotoId && typeof mapasApi.limparPorFotoGaleria === 'function') {
          try {
            await mapasApi.limparPorFotoGaleria(resolvedFotoId, {
              tipoMapaCodigo: scope === 'procedure' ? 'procedimento' : 'avaliacao',
              atendimentoId: isRealUuid(atendimentoId) ? atendimentoId : null,
            });
            savedMapa = null;
          } catch (errLimpar) {
            console.warn('[MapeamentoFullscreenOverlay] Erro ao limpar mapa da foto:', errLimpar);
          }
        }

        const cleanBlob = activePhoto?.cleanBlob || activePhoto?.blob || null;
        const cleanUrl = activePhoto?.cleanUrl || activePhoto?.url || resolvedDisplayUrl;

        const saveCallback = onSalvarFotoAnotada || onAnnotatedCaptureSaved;
        if (typeof saveCallback === 'function') {
          saveCallback({
            index: activeIndex,
            newUrl: cleanUrl,
            blob: cleanBlob,
            cleanBlob,
            cleanUrl,
            procedimentosMapeados: listaProcedimentosEnriquecida,
            pontos: internalPontos,
            isAnnotated: internalPontos.length > 0,
            mapaId: internalPontos.length > 0 ? (savedMapa?.id || null) : null,
            planejamentoId: effectivePlanId,
            planejamentoItemId: effectivePlanItemId,
            destinoAvaliacao: destino,
            isAvulso: destino === 'avulso',
            mapaOverlay: internalPontos.length > 0 ? {
              mapaId: savedMapa?.id || null,
              tipoMapaCodigo: scope === 'procedure' ? 'procedimento' : 'avaliacao',
              tipoMapaNome: scope === 'procedure' ? 'Procedimento' : 'Avaliação',
              pontos: internalPontos,
              marcacoes: internalPontos,
              procedimentos: listaProcedimentosEnriquecida,
              planejamentoId: effectivePlanId,
              planejamentoItemId: effectivePlanItemId,
            } : null,
          });
        }

        setIsDirty(false);
        if (fecharApos) {
          onClose?.();
        }
      } catch (err) {
        console.error('[MapeamentoFullscreenOverlay] Erro ao persistir anotações:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [
      isSaving,
      aguardarFotosPendentes,
      activePhoto,
      obterFotoId,
      activeIndex,
      pacienteId,
      listaProcedimentos,
      roleUserId,
      vistaAtual,
      internalPontos,
      planoContexto,
      scope,
      resolvedDisplayUrl,
      onSalvarFotoAnotada,
      onAnnotatedCaptureSaved,
      onClose,
      atendimentoId,
    ]
  );

  // Iniciação do fluxo de salvamento com guarda do Destino Clínico
  const handleIniciarSalvar = useCallback(
    (e) => {
      if (e && e.preventDefault) e.preventDefault();
      if (isControlledMode || scope !== 'evaluation') {
        executarSalvar({ fecharApos: true });
        return;
      }

      // Verifica se há procedimentos mapeados que ainda não estão vinculados ao plano ativo
      const planoIdsSet = new Set(
        (procedimentosDoPlano || [])
          .map((p) => String(p.catalogoProcedimentoSaudeId || p.id).trim())
          .filter(Boolean)
      );

      const procsPendentes = listaProcedimentos.filter((p) => {
        const id = String(p.catalogoProcedimentoSaudeId || p.catalogoId || p.id || '').trim();
        return id && !planoIdsSet.has(id);
      });

      const temPlano = Boolean(planoContexto?.id || procedimentosDoPlano.length > 0);

      if (procsPendentes.length > 0 || !temPlano) {
        setModalDestinoModo(temPlano ? 'novo_procedimento' : 'novo_plano');
        setModalDestinoOpen(true);
      } else {
        // Todos os procedimentos já pertencem ao plano ativo
        executarSalvar({ fecharApos: true, destino: 'plano', sincronizarPlano: true });
      }
    },
    [isControlledMode, scope, procedimentosDoPlano, listaProcedimentos, planoContexto?.id, executarSalvar]
  );

  // Autosave 700ms debounced — NUNCA toca no plano de tratamento em segundo plano
  useEffect(() => {
    if (isControlledMode || !isDirty) return undefined;
    const timer = setTimeout(() => {
      executarSalvar({ fecharApos: false, destino: 'avulso', sincronizarPlano: false });
    }, 700);
    return () => clearTimeout(timer);
  }, [isControlledMode, isDirty, executarSalvar]);

  const handleResetView = useCallback(() => {
    if (transformWrapperRef.current?.resetTransform) {
      transformWrapperRef.current.resetTransform();
    }
  }, []);

  const handleEscape = useCallback(() => {
    if (modalDestinoOpen) {
      setModalDestinoOpen(false);
      return;
    }
    if (configPopoverOpen) {
      setConfigPopoverOpen(false);
      return;
    }
    if (resumoModalOpen) {
      setResumoModalOpen(false);
      return;
    }
    if (isDirty) {
      handleIniciarSalvar();
    } else {
      onClose?.();
    }
  }, [modalDestinoOpen, configPopoverOpen, resumoModalOpen, isDirty, handleIniciarSalvar, onClose]);

  useMapeamentoFullscreenKeyboardShortcuts({
    enabled: open,
    blocked: false,
    onSetModo: setModo,
    onDesfazer: handleDesfazerUltimo,
    onResetZoom: handleResetView,
    onToggleDoses: () => setMostrarValores((v) => !v),
    onEscape: handleEscape,
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex min-w-0 flex-row overflow-hidden bg-slate-300 text-slate-800 select-none">
      <MapeamentoFullscreenToolbar
        vistaAtual={vistaAtual}
        toolbarWidthPx={toolbarWidthPx}
        procedimentoArmado={activeProc}
        procedimentos={listaProcedimentos}
        procedimentosDoPlano={procedimentosDoPlano}
        focusSearchTrigger={focusSearchTrigger}
        activeProcedimentoId={activeProc?.id}
        onSelectProcedimento={handleSelectProcedimento}
        onAdicionarProcedimento={handleAdicionarProcedimento}
        onArmar={onArmar}
        onRemoverProcedimento={handleRemoverProcedimento}
        onMudarCorProcedimento={handleMudarCorProcedimento}
        corLivre={corLivre}
        onMudarCorLivre={setCorLivre}
        getProcedimentoStats={getProcedimentoStats}
        countPontosVista={countPontosTotal}
        onClose={onClose}
        configMarcacao={configMarcacao}
        setConfigMarcacao={setConfigMarcacao}
        unidadeMedida={activeUnidade}
        onClearVista={handleClearVista}
        onRemoverFotoVista={onRemoverFotoVista}
        hasFoto={Boolean(resolvedDisplayUrl)}
        hideProcedimentoPicker={hideProcedimentoPicker}
        drawerOpen={sidebarOpen}
        onCloseDrawer={() => setSidebarOpen(false)}
        modo={modo}
        setModo={setModo}
        tamanho={tamanhoGlobalPonto}
        setTamanho={setTamanhoGlobalPonto}
        mostrarValores={mostrarValores}
        onToggleMostrarValores={() => setMostrarValores((v) => !v)}
        onDesfazerUltimo={handleDesfazerUltimo}
        onOpenResumo={() => setResumoModalOpen(true)}
        configPopoverOpen={configPopoverOpen}
        onConfigPopoverOpenChange={setConfigPopoverOpen}
        onSaveAction={
          isControlledMode
            ? onClose
            : handleIniciarSalvar
        }
        tituloAcaoPrimaria={
          propTituloAcaoPrimaria ||
          (isControlledMode
            ? 'Concluir Mapeamento'
            : scope === 'procedure'
              ? 'Salvar Foto'
              : 'Salvar Avaliação')
        }
        isSaving={isSaving}
      />

      {/* ── ÁREA DA FOTO E ILHA FLUTUANTE DE FERRAMENTAS (Mesa de Luz Clínica) ── */}
      <main ref={mainContainerRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col p-0 overflow-hidden bg-slate-300">
        {!isMdUp && !sidebarOpen ? (
          <button
            type="button"
            aria-label="Abrir menu de ferramentas"
            title="Abrir menu"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-3 top-3.5 z-[50] flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 hover:text-emerald-700 cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : null}

        {/* Barra Superior Discreta Flutuante */}
        <div className="absolute top-3.5 left-4 right-4 z-40 pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 backdrop-blur-xl border border-slate-200/90 shadow-md text-slate-800">
            <span className="text-xs font-bold text-slate-800">
              {vistaAtual ? getVistaLabel(vistaAtual) : (scope === 'procedure' ? 'Mapeamento Procedimento' : 'Avaliação Facial')}
            </span>
            {photos.length > 1 && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Foto {activeIndex + 1} de {photos.length}
              </span>
            )}
            {activeProc?.nome && (
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold border shadow-2xs"
                style={{
                  backgroundColor: `${activeCor}15`,
                  borderColor: `${activeCor}40`,
                  color: activeCor,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeCor }} />
                <span className="truncate max-w-[140px]">{activeProc.nome}</span>
              </span>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {!isControlledMode && (
              <button
                type="button"
                onClick={handleIniciarSalvar}
                disabled={isSaving}
                aria-label="Salvar anotação"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-xl shadow-teal-500/25 disabled:opacity-60 transition-all scale-100 active:scale-95 cursor-pointer"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
                <span>{scope === 'procedure' ? 'Salvar Foto' : 'Salvar Avaliação'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isDirty) {
                  handleIniciarSalvar();
                } else {
                  onClose?.();
                }
              }}
              title="Fechar tela cheia (Esc)"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 text-xs font-bold shadow-md border border-slate-300 backdrop-blur-xl transition-all scale-100 active:scale-95 cursor-pointer"
            >
              <X className="h-4 w-4 stroke-[2.5] text-slate-600" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* BOLINHA FLUTUANTE ASSISTIVETOUCH (Idêntica ao Procedimento) */}
        <AssistiveTouchToolbar
          modo={modo}
          setModo={setModo}
          mostrarDoses={mostrarValores}
          setMostrarDoses={setMostrarValores}
          onUndo={handleDesfazerUltimo}
          canUndo={countPontosTotal > 0}
          activeCor={activeCor}
          activeProc={activeProc}
          procedimentos={listaProcedimentos}
          onArmar={handleSelectProcedimento}
          onMudarCor={(novaCor) => {
            if (activeProc) {
              handleMudarCorProcedimento(activeProc.id, novaCor);
            } else {
              setCorLivre(novaCor);
            }
          }}
          containerRef={mainContainerRef}
        />

        {/* DEFESA 3: Canvas Nativo Consolidado com normalização de URL */}
        <FotoVistaCanvasCore
          transformWrapperRef={transformWrapperRef}
          vistaAtual={vistaAtual}
          pacienteId={pacienteId || activePhoto?.pacienteId || null}
          foto={{
            ...activePhoto,
            displayUrl: resolvedDisplayUrl,
            url: resolvedDisplayUrl,
            fotoGaleriaId: activePhoto?.fotoId || activePhoto?.id || activePhoto?.meta?.fotoId || null,
            pacienteId: pacienteId || activePhoto?.pacienteId || null,
          }}
          procedimentoArmado={activeProc}
          pontosVista={effectivePontosVista}
          onAddPonto={handleAddPonto}
          onEditarPonto={handleEditarPonto}
          onRemovePonto={handleRemovePonto}
          onTentativaSemProcedimento={handleTentativaSemProcedimento}
          tamanhoGlobalPonto={tamanhoGlobalPonto}
          modo={modo}
          setModo={setModo}
          showToolbar={false}
          fillViewport
          className="h-full min-h-0 w-full flex-1"
          unidadeMedida={activeUnidade}
          onUnidadeMedidaChange={onUnidadeMedidaChange}
          presets={presets}
          passo={passo}
          externalModo={modo}
          onModoChange={setModo}
          configMarcacao={configMarcacao}
          mostrarValores={mostrarValores}
        />

        {/* DEFESA 2: Carrossel de Miniaturas com troca protegida por flush */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-xl max-w-[90vw] overflow-x-auto">
            {photos.map((ph, idx) => (
              <button
                key={ph.id || ph.fotoId || idx}
                type="button"
                onClick={() => {
                  if (idx === activeIndex) return;
                  if (isDirty) {
                    executarSalvar({ fecharApos: false });
                  }
                  if (typeof onSelectCapturedPhoto === 'function') onSelectCapturedPhoto(idx);
                  if (typeof setEditingIndex === 'function') setEditingIndex(idx);
                }}
                className={`relative h-12 w-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  idx === activeIndex
                    ? 'border-teal-500 scale-105 shadow-md'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                title={`Foto ${idx + 1}`}
              >
                <MapeamentoFotoThumbnail
                  photo={ph}
                  pacienteId={pacienteId}
                  alt={`Foto ${idx + 1}`}
                />
              </button>
            ))}
          </div>
        )}

        {resumoModalOpen ? (
          <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-sm">
              <button
                type="button"
                aria-label="Fechar resumo"
                onClick={() => setResumoModalOpen(false)}
                className="absolute -right-2 -top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748b] shadow-md hover:text-app-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <PontosResumoPanel
                vistaAtual={vistaAtual}
                gruposPontos={effectivePontosVista}
                gruposSessao={gruposSessao}
                unidadeMedida={activeUnidade}
                isModal={true}
              />
            </div>
          </div>
        ) : null}

        {/* Modal de Escolha do Destino da Avaliação (Plano vs Avulso) */}
        {modalDestinoOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col scale-100 transition-all">
              <div className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  {modalDestinoModo === 'novo_plano' ? (
                    <Sparkles className="h-6 w-6 stroke-[2]" />
                  ) : (
                    <Layers className="h-6 w-6 stroke-[2]" />
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {modalDestinoModo === 'novo_plano'
                    ? 'Criar Plano de Tratamento?'
                    : 'Adicionar ao Plano de Tratamento?'}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {modalDestinoModo === 'novo_plano'
                    ? 'Você mapeou procedimentos durante a avaliação. Deseja criar automaticamente um Plano de Tratamento para este paciente com estes itens?'
                    : 'Identificamos procedimentos na avaliação que ainda não constam no Plano Ativo. Deseja incluí-los como novos itens no plano?'}
                </p>
              </div>
              <div className="flex flex-col gap-2 bg-slate-50 p-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalDestinoOpen(false);
                    executarSalvar({ fecharApos: true, destino: 'plano', sincronizarPlano: true });
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-500 active:scale-98 transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {modalDestinoModo === 'novo_plano'
                      ? 'Sim, Criar Plano de Tratamento'
                      : 'Sim, Incluir no Plano Ativo'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalDestinoOpen(false);
                    executarSalvar({ fecharApos: true, destino: 'avulso', sincronizarPlano: false });
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 active:scale-98 transition-all cursor-pointer"
                >
                  <span>Apenas Salvar Avaliação (Avulsa)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalDestinoOpen(false)}
                  className="mt-1 text-center text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Voltar para a Foto
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>,
    document.body
  );
}
