import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  X,
  Loader2,
  MousePointer2,
  MoveDiagonal,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  ChevronUp,
  ChevronDown,
  Minus,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { useCanvasZoom } from '../../hooks/useCanvasZoom.js';
import {
  MAPEAMENTO_PALETA_CORES,
  corParaProcedimento,
  getCorLivreParaProcedimento,
} from '../../constants/mapeamentoPaletaCores.js';
import { formatQuantidadeEtiqueta } from '../../constants/mapeamentoMarcador.js';
import { getLetterboxLayout } from '../../utils/canvasAnnotationDraw.js';
import { toCanvasCoordsFromEvent } from '../../utils/canvasZoomCoords.js';
import { simplifyCurveRDP, distance } from '../../utils/geometry.js';
import { createPortal } from 'react-dom';
import { MapeamentoFullscreenToolbar } from './mapeamento/MapeamentoFullscreenToolbar.jsx';
import { useMapeamentoFullscreenKeyboardShortcuts } from './mapeamento/useMapeamentoFullscreenKeyboardShortcuts.js';
import { PontoMarcadorPopover } from './mapeamento/PontoMarcadorPopover.jsx';
import { mapasApi, planejamentosApi, catalogosApi } from '../../services/api.js';

const COR_PADRAO_AVALIACAO = '#0ea5e9'; // Ciano/Azul de alto contraste padrão
const RAIO_BORRACHA_PERCENT = 2.8; // ~2.8% da largura da foto para o diâmetro da borracha

/**
 * Distância mínima de um ponto (px, py) a um segmento [(x1, y1), (x2, y2)]
 */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Desenha badge arredondado de dose sobre o canvas nativo.
 */
function drawDoseBadge(ctx, text, x, y, bgCor, scale) {
  if (!text) return;
  ctx.save();
  const fontSize = Math.max(9.5, 11 / scale);
  ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const padX = Math.max(3.5, 4.5 / scale);
  const badgeH = Math.max(13, 15 / scale);
  const badgeW = Math.max(badgeH, textWidth + padX * 2);
  const badgeY = y - (14 / scale);
  const badgeX = x;
  const radius = badgeH / 2;

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, radius);
  } else {
    ctx.rect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
  }
  ctx.fillStyle = bgCor || COR_PADRAO_AVALIACAO;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 / scale);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, badgeX, badgeY + (0.5 / scale));
  ctx.restore();
}

/**
 * AnnotationCanvasAvaliacao: Editor moderno de avaliação e mapeamento facial sobre Canvas Nativo 2D.
 * Integra:
 * - Múltiplos procedimentos com pesquisa no catálogo da clínica
 * - Paleta de cores exclusiva e personalizada por mapa
 * - Marcação e exibição de doses/quantidades por ponto com botão de Olho (mostrar/ocultar)
 * - Traço livre contínuo e Ponto direto
 * - Borracha contínua com atualização reativa de contadores
 * - Zoom suave por scroll em tela cheia e pan
 * - Exportação offscreen em 100% da resolução nativa com doses desenhadas no JPEG
 * - Repasse dos procedimentos avaliados para inclusão no Plano de Tratamento
 */
export function AnnotationCanvasAvaliacao({
  photos = [],
  editingIndex = 0,
  setEditingIndex: _setEditingIndex,
  onSelectCapturedPhoto: _onSelectCapturedPhoto,
  imageSrc,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  onClose,
  pacienteId,
}) {
  const toast = useToast();


  // Ferramentas: 'traco' | 'ponto' | 'borracha'
  const [modo, setModo] = useState('traco');

  // Estado dos múltiplos procedimentos selecionados para este mapa
  const [procedimentos, setProcedimentos] = useState([]);
  const [activeProcedimentoId, setActiveProcedimentoId] = useState(null);
  const [corLivre, setCorLivre] = useState(COR_PADRAO_AVALIACAO);

  // Procedimentos oriundos do Plano de Tratamento Ativo do paciente (Bandeja de Chips Rápidos)
  const [procedimentosDoPlano, setProcedimentosDoPlano] = useState([]);
  const [carregandoPlano, setCarregandoPlano] = useState(false);

  // Ilha Flutuante de Ferramentas
  const [islandDockedBottom, setIslandDockedBottom] = useState(false);
  const [isIslandMinimized, setIsIslandMinimized] = useState(false);
  const [islandColorPickerOpen, setIslandColorPickerOpen] = useState(false);

  // Controles de Configuração da Barra Lateral Oficial
  const [configMarcacao, setConfigMarcacao] = useState({
    dosePadrao: 1,
    profundidade: '',
    confirmarDose: false,
  });
  const [tamanhoMarcador, setTamanhoMarcador] = useState(1.0);
  const [mostrarDoses, setMostrarDoses] = useState(true);
  const [configPopoverOpen, setConfigPopoverOpen] = useState(false);

  // Modal de confirmação de dose por clique (se confirmarDose for true)
  const [modalDosePonto, setModalDosePonto] = useState(null);
  const [modalDoseValor, setModalDoseValor] = useState('1');

  // Modal de confirmação para remover procedimento com marcações na tela (Padrão Procedi)
  const [procParaRemover, setProcParaRemover] = useState(null);


  // Estado das anotações e histórico para Undo
  const [pontos, setPontos] = useState([]);
  const [history, setHistory] = useState([]);

  // Ponto ou traço selecionado para exibição do popover de resumo e edição
  const [pontoSelecionado, setPontoSelecionado] = useState(null);
  const [hoveredPontoId, setHoveredPontoId] = useState(null);

  // Imagem base e época de carregamento
  const baseImageRef = useRef(null);
  const [imageEpoch, setImageEpoch] = useState(0);

  // Referências DOM do canvas e container
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Traço livre em andamento
  const isDrawing = useRef(false);
  const liveVerticesRef = useRef([]);

  // Borracha em andamento
  const isErasing = useRef(false);
  const eraserCursorRef = useRef(null);

  // Arraste com ferramenta Mover
  const isToolPanning = useRef(false);
  const lastToolPanRef = useRef({ x: 0, y: 0 });

  // Estado de salvamento
  const [isSaving, setIsSaving] = useState(false);

  // Motor de Zoom e Pan em Canvas Nativo 2D
  const {
    scale,
    offsetX,
    offsetY,
    setView,
    zoomIn,
    zoomOut,
    resetView,
    fitToScreen,
    canZoomIn,
    canZoomOut,
    zoomPercent,
    spaceDown,
    isPanning: isHookPanning,
    onPointerDown: onPanPointerDown,
    onPointerMove: onPanPointerMove,
    onPointerUp: onPanPointerUp,
  } = useCanvasZoom(canvasRef);

  const activePhoto = photos[editingIndex];
  const displayUrl = activePhoto?.url || activePhoto?.displayUrl || imageSrc;

  // Procedimento ativo atual
  const activeProc = useMemo(() => {
    return procedimentos.find((p) => p.id === activeProcedimentoId) || procedimentos[0] || null;
  }, [procedimentos, activeProcedimentoId]);

  const activeCor = activeProc?.corHex || corLivre || COR_PADRAO_AVALIACAO;
  const activeUnidade = activeProc?.unidadeMedida || 'un';


  // Carrega a imagem HTML e atualiza imagem base
  useEffect(() => {
    if (!displayUrl) {
      baseImageRef.current = null;
      return;
    }
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      baseImageRef.current = im;
      setImageEpoch((n) => n + 1);
    };
    im.onerror = () => {
      baseImageRef.current = null;
    };
    im.src = displayUrl;
    return () => {
      im.onload = null;
      im.onerror = null;
    };
  }, [displayUrl]);

  // Limpa marcações e reseta visualização ao trocar de foto
  useEffect(() => {
    setPontos([]);
    setHistory([]);
    resetView();
  }, [editingIndex, displayUrl, resetView]);

  // Carrega procedimentos do Plano de Tratamento Ativo do paciente para a Bandeja de Chips
  useEffect(() => {
    if (!pacienteId) {
      setProcedimentosDoPlano([]);
      return;
    }

    let isMounted = true;
    setCarregandoPlano(true);

    Promise.all([
      planejamentosApi.listarPorPaciente(pacienteId).catch(() => []),
      catalogosApi.list(false).catch(() => []),
    ])
      .then(([planosRes, catRes]) => {
        if (!isMounted) return;

        const planos = Array.isArray(planosRes) ? planosRes : planosRes?.content || [];
        const planoAtivo = planos.find(
          (p) =>
            p.statusCodigo === 'ativo' ||
            p.status === 'ativo' ||
            p.status === 'em_andamento'
        );

        if (!planoAtivo || !Array.isArray(planoAtivo.itens) || planoAtivo.itens.length === 0) {
          setProcedimentosDoPlano([]);
          return;
        }

        const rawCat = Array.isArray(catRes) ? catRes : catRes?.content || [];
        const catMap = new Map();
        rawCat.forEach((c) => {
          const cid = String(c.id || '').trim();
          if (cid) {
            catMap.set(cid, {
              nome: String(c.nomeProcedimento || c.nome || '').trim(),
              unidadeMedida: c.unidadeMedida ? String(c.unidadeMedida).toLowerCase() : 'un',
            });
          }
        });

        // Agrupa itens do plano por catalogoProcedimentoSaudeId para evitar duplicidade de chips
        const itensMap = new Map();
        planoAtivo.itens.forEach((it) => {
          const catId = String(it.catalogoProcedimentoSaudeId || it.catalogoId || '').trim();
          if (!catId) return;

          const catInfo = catMap.get(catId);
          const hasRetornoSession =
            Array.isArray(it.sessoes) &&
            it.sessoes.some(
              (s) => String(s.tipoProcedimentoCodigo || '').toLowerCase() === 'retorno'
            );
          const isRealizado =
            String(it.statusProcedimentoCodigo || '').toLowerCase() === 'realizado';
          const isRetorno = Boolean(it.isRetorno || hasRetornoSession || isRealizado);

          if (!itensMap.has(catId)) {
            itensMap.set(catId, {
              id: catId,
              planejamentoItemId: it.planejamentoItemId || it.id || null,
              nome: it.catalogoNome || it.nome || catInfo?.nome || 'Procedimento',
              unidadeMedida: it.unidadeMedida || catInfo?.unidadeMedida || 'un',
              isRetorno,
            });
          } else if (isRetorno) {
            const existing = itensMap.get(catId);
            itensMap.set(catId, { ...existing, isRetorno: true });
          }
        });

        setProcedimentosDoPlano(Array.from(itensMap.values()));
      })
      .catch((err) => {
        console.warn('[AnnotationCanvasAvaliacao] Falha ao carregar procedimentos do plano:', err);
        if (isMounted) setProcedimentosDoPlano([]);
      })
      .finally(() => {
        if (isMounted) setCarregandoPlano(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pacienteId]);

  // Higienização de integridade cromática: assegura que NENHUM par de procedimentos divida a mesma cor
  useEffect(() => {
    if (!procedimentos || procedimentos.length <= 1) return;

    const seen = new Set();
    let hasDuplicate = false;

    for (const p of procedimentos) {
      const c = String(p.corHex || corParaProcedimento(p.id) || '').trim().toLowerCase();
      if (seen.has(c)) {
        hasDuplicate = true;
        break;
      }
      if (c) seen.add(c);
    }

    if (hasDuplicate) {
      const occupied = new Set();
      const sanitized = procedimentos.map((proc) => {
        const currentCor = String(proc.corHex || corParaProcedimento(proc.id) || '').trim().toLowerCase();
        if (!occupied.has(currentCor)) {
          occupied.add(currentCor);
          return proc.corHex ? proc : { ...proc, corHex: proc.corHex || corParaProcedimento(proc.id) };
        }
        // Conflito! Encontra a próxima cor verdadeiramente livre na paleta para este procedimento
        const freeColor = getCorLivreParaProcedimento(proc.id, occupied);
        occupied.add(freeColor.toLowerCase());
        return { ...proc, corHex: freeColor };
      });

      setProcedimentos(sanitized);
      setPontos((prev) =>
        prev.map((pt) => {
          const matched = sanitized.find((p) => p.id === pt.catalogoProcedimentoSaudeId);
          return matched ? { ...pt, cor: matched.corHex } : pt;
        })
      );
    }
  }, [procedimentos]);



  // Histórico para Undo
  const pushToHistory = useCallback((currentPontos) => {
    setHistory((prev) => [...prev.slice(-20), currentPontos]);
  }, []);

  const handleUndo = useCallback(() => {
    setPontoSelecionado(null);
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setPontos(previous);
  }, [history]);

  const handleClearAll = useCallback(() => {
    setPontoSelecionado(null);
    if (pontos.length === 0) return;
    pushToHistory(pontos);
    setPontos([]);
  }, [pontos, pushToHistory]);

  const handleConfirmarModalDose = useCallback(() => {
    if (!modalDosePonto) return;
    const qtd = parseFloat(modalDoseValor) || (activeUnidade === 'ml' ? 0.5 : 1);
    pushToHistory(pontos);
    const novoPonto = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipoGeometria: 'ponto',
      posX: modalDosePonto.posX,
      posY: modalDosePonto.posY,
      cor: activeCor,
      quantidade: qtd,
      profundidade: configMarcacao.profundidade || null,
      tamanho: tamanhoMarcador,
      catalogoProcedimentoSaudeId: activeProc?.id || null,
      unidadeMedida: activeUnidade,
    };
    setPontos((prev) => [...prev, novoPonto]);
    setModalDosePonto(null);
  }, [modalDosePonto, modalDoseValor, activeUnidade, pontos, activeCor, configMarcacao.profundidade, tamanhoMarcador, activeProc?.id, pushToHistory]);

  // Tratamento do Escape inteligente e atalhos de teclado do modo tela cheia
  const handleEscape = useCallback(() => {
    if (procParaRemover) {
      setProcParaRemover(null);
      return;
    }
    if (pontoSelecionado) {
      setPontoSelecionado(null);
      return;
    }
    if (modalDosePonto) {
      setModalDosePonto(null);
      return;
    }
    if (islandColorPickerOpen) {
      setIslandColorPickerOpen(false);
      return;
    }
    if (configPopoverOpen) {
      setConfigPopoverOpen(false);
      return;
    }
    onClose?.();
  }, [procParaRemover, pontoSelecionado, modalDosePonto, islandColorPickerOpen, configPopoverOpen, onClose]);

  useMapeamentoFullscreenKeyboardShortcuts({
    enabled: true,
    blocked: Boolean(procParaRemover || modalDosePonto),
    onSetModo: setModo,
    onDesfazer: handleUndo,
    onResetZoom: fitToScreen,
    onToggleDoses: () => setMostrarDoses((prev) => !prev),
    onEscape: handleEscape,
  });

  // Sincroniza o tamanho do bitmap do canvas com as dimensões do container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        redrawRef.current();
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Estatísticas reativas por procedimento (pontos, traços e doses totais)
  const getProcedimentoStats = useCallback(
    (procId) => {
      const pts = pontos.filter((p) => p.catalogoProcedimentoSaudeId === procId);
      const pontosCount = pts.filter((p) => p.tipoGeometria === 'ponto').length;
      const tracosCount = pts.filter((p) => p.tipoGeometria === 'traco').length;
      const doseTotal = pts
        .filter((p) => p.quantidade != null)
        .reduce((sum, p) => sum + (Number(p.quantidade) || 0), 0);
      return { pontosCount, tracosCount, doseTotal, totalMarks: pts.length };
    },
    [pontos]
  );

  // Salva alterações de quantidade e tamanho vindas do PontoMarcadorPopover
  const handleSavePonto = useCallback(
    ({ quantidade, tamanho }) => {
      if (!pontoSelecionado?.ponto) return;
      const targetId = pontoSelecionado.ponto.id;
      pushToHistory(pontos);
      setPontos((prev) =>
        prev.map((pt) => {
          if (pt.id !== targetId) return pt;
          return {
            ...pt,
            quantidade,
            tamanho,
          };
        })
      );
      setPontoSelecionado(null);
      toast.success('Marcação atualizada!');
    },
    [pontoSelecionado, pontos, pushToHistory, toast]
  );

  // Remove a marcação (ponto ou traço) via PontoMarcadorPopover
  const handleRemovePonto = useCallback(() => {
    if (!pontoSelecionado?.ponto) return;
    const targetId = pontoSelecionado.ponto.id;
    pushToHistory(pontos);
    setPontos((prev) => prev.filter((pt) => pt.id !== targetId));
    setPontoSelecionado(null);
    toast.info('Marcação removida.');
  }, [pontoSelecionado, pontos, pushToHistory, toast]);

  // Atualiza a unidade de medida do procedimento ou da marcação isolada
  const handleUnidadeMedidaChange = useCallback(
    (novaUnidade) => {
      if (!pontoSelecionado?.ponto) return;
      const catId = pontoSelecionado.catalogoId;
      if (catId) {
        setProcedimentos((prev) =>
          prev.map((p) => (p.id === catId ? { ...p, unidadeMedida: novaUnidade } : p))
        );
        setPontos((prev) =>
          prev.map((pt) =>
            pt.catalogoProcedimentoSaudeId === catId
              ? { ...pt, unidadeMedida: novaUnidade }
              : pt
          )
        );
      } else {
        setPontos((prev) =>
          prev.map((pt) =>
            pt.id === pontoSelecionado.ponto.id
              ? { ...pt, unidadeMedida: novaUnidade }
              : pt
          )
        );
      }
      setPontoSelecionado((prev) =>
        prev
          ? {
            ...prev,
            unidadeMedida: novaUnidade,
            ponto: { ...prev.ponto, unidadeMedida: novaUnidade },
          }
          : null
      );
    },
    [pontoSelecionado]
  );

  // Âncora calculada para o popover do ponto/traço selecionado (fixada na posição do marcador)
  const popoverAnchor = useMemo(() => {
    if (!pontoSelecionado || !canvasRef.current || !baseImageRef.current) return null;
    const canvas = canvasRef.current;
    const im = baseImageRef.current;
    const { drawW, drawH, dx, dy } = getLetterboxLayout(
      canvas.width,
      canvas.height,
      im.naturalWidth,
      im.naturalHeight
    );
    let posX = pontoSelecionado.ponto.posX;
    let posY = pontoSelecionado.ponto.posY;
    if (
      pontoSelecionado.ponto.tipoGeometria === 'traco' &&
      Array.isArray(pontoSelecionado.ponto.vertices) &&
      pontoSelecionado.ponto.vertices.length > 0
    ) {
      const lastV = pontoSelecionado.ponto.vertices[pontoSelecionado.ponto.vertices.length - 1];
      posX = lastV.posX ?? lastV.x;
      posY = lastV.posY ?? lastV.y;
    }
    if (posX == null || posY == null) return null;

    const contentX = dx + (posX / 100) * drawW;
    const contentY = dy + (posY / 100) * drawH;
    const screenX = offsetX + contentX * scale;
    const screenY = offsetY + contentY * scale;
    return {
      left: (screenX / canvas.width) * 100,
      top: (screenY / canvas.height) * 100,
    };
  }, [pontoSelecionado, offsetX, offsetY, scale]);

  // Hit-testing preciso em coordenadas nativas do canvas (pontos, terminais de traço e segmentos)
  const hitTestMarcacao = useCallback(
    (cx, cy) => {
      const canvas = canvasRef.current;
      const im = baseImageRef.current;
      if (!canvas || !im?.naturalWidth || pontos.length === 0) return null;

      const { drawW, drawH, dx, dy } = getLetterboxLayout(
        canvas.width,
        canvas.height,
        im.naturalWidth,
        im.naturalHeight
      );
      if (drawW <= 0 || drawH <= 0) return null;

      // 1. Alvos discretos: pontos e terminais de traço (com prioridade no clique)
      let bestPointHit = null;
      let minPointDistScreen = Infinity;

      for (let i = pontos.length - 1; i >= 0; i--) {
        const item = pontos[i];
        if (item.tipoGeometria === 'ponto' && item.posX != null && item.posY != null) {
          const px = dx + (item.posX / 100) * drawW;
          const py = dy + (item.posY / 100) * drawH;
          const distScreen = Math.hypot(cx - px, cy - py) * scale;
          const markerRadiusScreen = 7 * (item.tamanho ?? tamanhoMarcador ?? 1.0);
          const hitRadiusScreen = Math.max(22, markerRadiusScreen + 10);

          if (distScreen <= hitRadiusScreen && distScreen < minPointDistScreen) {
            minPointDistScreen = distScreen;
            bestPointHit = { item, anchorContent: { x: px, y: py } };
          }
        } else if (item.tipoGeometria === 'traco' && Array.isArray(item.vertices) && item.vertices.length > 0) {
          const lastV = item.vertices[item.vertices.length - 1];
          const lx = dx + ((lastV.posX ?? lastV.x) / 100) * drawW;
          const ly = dy + ((lastV.posY ?? lastV.y) / 100) * drawH;
          const distScreen = Math.hypot(cx - lx, cy - ly) * scale;
          const terminalRadiusScreen = 5.5 * (item.tamanho ?? tamanhoMarcador ?? 1.0);
          const hitRadiusScreen = Math.max(20, terminalRadiusScreen + 10);

          if (distScreen <= hitRadiusScreen && distScreen < minPointDistScreen) {
            minPointDistScreen = distScreen;
            bestPointHit = { item, anchorContent: { x: lx, y: ly } };
          }
        }
      }

      if (bestPointHit) return bestPointHit;

      // 2. Linhas de traço: verifica proximidade aos segmentos de reta
      let bestTraceHit = null;
      let minTraceDistScreen = Infinity;

      for (let i = pontos.length - 1; i >= 0; i--) {
        const item = pontos[i];
        if (item.tipoGeometria === 'traco' && Array.isArray(item.vertices) && item.vertices.length >= 2) {
          const strokeWidthScreen = 3.5 * (item.tamanho ?? tamanhoMarcador ?? 1.0);
          const hitThresholdScreen = Math.max(16, strokeWidthScreen + 10);

          for (let j = 1; j < item.vertices.length; j++) {
            const v1 = item.vertices[j - 1];
            const v2 = item.vertices[j];
            const x1 = dx + ((v1.posX ?? v1.x) / 100) * drawW;
            const y1 = dy + ((v1.posY ?? v1.y) / 100) * drawH;
            const x2 = dx + ((v2.posX ?? v2.x) / 100) * drawW;
            const y2 = dy + ((v2.posY ?? v2.y) / 100) * drawH;

            const segDistContent = distToSegment(cx, cy, x1, y1, x2, y2);
            const segDistScreen = segDistContent * scale;

            if (segDistScreen <= hitThresholdScreen && segDistScreen < minTraceDistScreen) {
              minTraceDistScreen = segDistScreen;
              const lastV = item.vertices[item.vertices.length - 1];
              const lx = dx + ((lastV.posX ?? lastV.x) / 100) * drawW;
              const ly = dy + ((lastV.posY ?? lastV.y) / 100) * drawH;
              bestTraceHit = { item, anchorContent: { x: lx, y: ly } };
            }
          }
        }
      }

      return bestTraceHit;
    },
    [pontos, scale, tamanhoMarcador]
  );

  // Adiciona um procedimento do catálogo à sessão atual do mapa com garantia anti-colisão
  const handleAdicionarProcedimento = (opt) => {
    const jaExiste = procedimentos.some((p) => p.id === opt.id);
    if (jaExiste) {
      setActiveProcedimentoId(opt.id);
      toast.info(`"${opt.nome}" já está na lista e foi ativado.`);
      return;
    }

    // Cores atualmente ocupadas pelos procedimentos na tela
    const coresOcupadas = new Set(
      procedimentos
        .map((p) => String(p.corHex || corParaProcedimento(p.id) || '').trim().toLowerCase())
        .filter(Boolean)
    );

    // Se opt já veio com corHex definida (do seletor de catálogo) e ela está livre, respeita; senão busca a próxima livre
    const corDesejada = opt.corHex ? String(opt.corHex).trim().toLowerCase() : null;
    let corEscolhida;
    if (corDesejada && !coresOcupadas.has(corDesejada)) {
      corEscolhida = opt.corHex;
    } else {
      corEscolhida = getCorLivreParaProcedimento(opt.id, coresOcupadas);
    }

    const novoProc = {
      id: opt.id,
      catalogoProcedimentoSaudeId: opt.id,
      nome: opt.nome,
      unidadeMedida: opt.unidadeMedida || 'un',
      corHex: corEscolhida,
      planejamentoItemId: opt.planejamentoItemId || null,
    };

    setProcedimentos((prev) => [...prev, novoProc]);
    setActiveProcedimentoId(opt.id);

    // Ajusta a dose padrão para a unidade do novo procedimento
    if (opt.unidadeMedida === 'ml') {
      setConfigMarcacao((prev) => ({ ...prev, dosePadrao: 0.5 }));
    } else {
      setConfigMarcacao((prev) => ({ ...prev, dosePadrao: 1 }));
    }

    toast.success(`"${opt.nome}" adicionado.`);
  };

  // Altera a cor de um procedimento neste mapa com swap inteligente para evitar colisões
  const handleMudarCorProcedimento = (procId, novaCor) => {
    const corNormalizada = String(novaCor || '').trim().toLowerCase();
    let outroAfetado = null;
    let corAntigaAlvo = null;

    setProcedimentos((prev) => {
      const alvo = prev.find((p) => p.id === procId);
      if (!alvo) return prev;
      corAntigaAlvo = alvo.corHex || corParaProcedimento(alvo.id);

      // Se outro procedimento já está usando a novaCor, ele troca de cor com o alvo
      outroAfetado = prev.find(
        (p) =>
          p.id !== procId &&
          (p.corHex || corParaProcedimento(p.id)).toLowerCase() === corNormalizada
      );

      return prev.map((p) => {
        if (p.id === procId) {
          return { ...p, corHex: novaCor };
        }
        if (outroAfetado && p.id === outroAfetado.id) {
          // Troca inteligente: o outro procedimento assume a cor antiga do alvo
          return { ...p, corHex: corAntigaAlvo };
        }
        return p;
      });
    });

    // Atualiza imediatamente todos os pontos e traços na tela de ambos os procedimentos
    setPontos((prev) =>
      prev.map((pt) => {
        if (pt.catalogoProcedimentoSaudeId === procId) {
          return { ...pt, cor: novaCor };
        }
        if (outroAfetado && pt.catalogoProcedimentoSaudeId === outroAfetado.id && corAntigaAlvo) {
          return { ...pt, cor: corAntigaAlvo };
        }
        return pt;
      })
    );

    if (outroAfetado) {
      toast.info(
        `Cor reatribuída. "${outroAfetado.nome}" agora usa outra cor para não colidir.`
      );
    }
  };

  // Remove um procedimento da sessão do mapa com proteção clínica e modal Procedi
  const handleRemoverProcedimento = useCallback(
    (procId) => {
      const proc = procedimentos.find((p) => p.id === procId);
      const stats = getProcedimentoStats(procId);
      if (stats.totalMarks > 0) {
        setProcParaRemover({
          id: procId,
          nome: proc?.nome || 'Procedimento',
          totalMarks: stats.totalMarks,
        });
        return;
      }
      // Sem marcações desenhadas: remoção instantânea e limpa (zero atrito)
      setProcedimentos((prev) => prev.filter((p) => p.id !== procId));
      if (activeProcedimentoId === procId) {
        const restantes = procedimentos.filter((p) => p.id !== procId);
        setActiveProcedimentoId(restantes[0]?.id || null);
      }
      toast.info(`"${proc?.nome || 'Procedimento'}" removido do mapa.`);
    },
    [procedimentos, getProcedimentoStats, activeProcedimentoId, toast]
  );

  const handleConfirmarRemocaoProcedimento = useCallback(() => {
    if (!procParaRemover) return;
    const targetId = procParaRemover.id;
    pushToHistory(pontos);
    setPontos((prev) => prev.filter((pt) => pt.catalogoProcedimentoSaudeId !== targetId));
    setProcedimentos((prev) => prev.filter((p) => p.id !== targetId));
    if (activeProcedimentoId === targetId) {
      const restantes = procedimentos.filter((p) => p.id !== targetId);
      setActiveProcedimentoId(restantes[0]?.id || null);
    }
    toast.success(`"${procParaRemover.nome}" e suas marcações foram removidos.`);
    setProcParaRemover(null);
  }, [procParaRemover, pushToHistory, pontos, procedimentos, activeProcedimentoId, toast]);

  // Teclado: Escape fecha o modal e Enter confirma a exclusão
  useEffect(() => {
    if (!procParaRemover) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setProcParaRemover(null);
      } else if (e.key === 'Enter') {
        handleConfirmarRemocaoProcedimento();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [procParaRemover, handleConfirmarRemocaoProcedimento]);

  // ── LOOP PRINCIPAL DE RENDERIZAÇÃO DO CANVAS ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const im = baseImageRef.current;

    // Limpa a tela inteira com o fundo Mesa de Luz Clínica (Slate Profundo anti-ofuscamento)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);

    if (!im?.complete || !im.naturalWidth || !im.naturalHeight) return;

    // Calcula layout letterbox centralizado no canvas de tela cheia
    const { drawW, drawH, dx, dy } = getLetterboxLayout(w, h, im.naturalWidth, im.naturalHeight);
    if (drawW <= 0 || drawH <= 0) return;

    // Aplica matriz de transformação 2D (Pan + Zoom livre)
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Desenha a foto base em alta nitidez
    ctx.drawImage(im, dx, dy, drawW, drawH);

    // 2. Traços livres gravados
    const strokeWidthOnScreen = (3.5 * (tamanhoMarcador ?? 1.0)) / scale;
    for (const item of pontos) {
      if (item.tipoGeometria === 'traco' && Array.isArray(item.vertices) && item.vertices.length >= 2) {
        const isSelected = pontoSelecionado?.ponto?.id === item.id;
        const corTraco = item.cor || COR_PADRAO_AVALIACAO;
        const traceWidth = (3.5 * (item.tamanho ?? tamanhoMarcador ?? 1.0)) / scale;

        // Halo de seleção vibrante ao redor do traço selecionado
        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = traceWidth + (6 / scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          item.vertices.forEach((v, idx) => {
            const vx = dx + ((v.x ?? v.posX) / 100) * drawW;
            const vy = dy + ((v.y ?? v.posY) / 100) * drawH;
            if (idx === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          });
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.strokeStyle = corTraco;
        ctx.lineWidth = traceWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        item.vertices.forEach((v, idx) => {
          const vx = dx + ((v.x ?? v.posX) / 100) * drawW;
          const vy = dy + ((v.y ?? v.posY) / 100) * drawH;
          if (idx === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        });
        ctx.stroke();

        // Pin terminal discreto e badge de dose no último vértice (como no mapa do procedimento)
        const lastV = item.vertices[item.vertices.length - 1];
        const lx = dx + ((lastV.x ?? lastV.posX) / 100) * drawW;
        const ly = dy + ((lastV.y ?? lastV.posY) / 100) * drawH;
        const terminalRadius = (5.5 * (item.tamanho ?? tamanhoMarcador ?? 1.0)) / scale;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(lx, ly, terminalRadius + (4 / scale), 0, 2 * Math.PI);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.5 / scale;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(lx, ly, terminalRadius, 0, 2 * Math.PI);
        ctx.fillStyle = corTraco;
        ctx.fill();
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        if (mostrarDoses && item.quantidade != null) {
          const textoEtiqueta = formatQuantidadeEtiqueta(item.quantidade, '');
          drawDoseBadge(ctx, textoEtiqueta, lx, ly, corTraco, scale);
        }
      }
    }

    // 3. Traço livre em andamento (enquanto arrasta o ponteiro)
    if (liveVerticesRef.current.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = activeCor;
      ctx.lineWidth = strokeWidthOnScreen;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      liveVerticesRef.current.forEach((v, idx) => {
        const vx = dx + (v.x / 100) * drawW;
        const vy = dy + (v.y / 100) * drawH;
        if (idx === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.stroke();
    }

    // 4. Pontos gravados e seus Badges de Dose
    for (const item of pontos) {
      if (item.tipoGeometria === 'ponto' && item.posX != null) {
        const isSelected = pontoSelecionado?.ponto?.id === item.id;
        const px = dx + (item.posX / 100) * drawW;
        const py = dy + (item.posY / 100) * drawH;
        const corPonto = item.cor || COR_PADRAO_AVALIACAO;
        const pointRadius = (7 * (item.tamanho ?? tamanhoMarcador ?? 1.0)) / scale;
        const pointBorder = 2 / scale;

        // Anel de seleção dourado vibrante ao redor do ponto selecionado
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, pointRadius + (4.5 / scale), 0, 2 * Math.PI);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.5 / scale;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px, py, pointRadius, 0, 2 * Math.PI);
        ctx.fillStyle = corPonto;
        ctx.fill();
        ctx.lineWidth = pointBorder;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Renderiza o badge numérico da dose se mostrarDoses estiver ativo
        if (mostrarDoses && item.quantidade != null) {
          const textoEtiqueta = formatQuantidadeEtiqueta(item.quantidade, '');
          drawDoseBadge(ctx, textoEtiqueta, px, py, corPonto, scale);
        }
      }
    }

    // 5. Cursor visual da borracha (círculo com borda rose)
    if (modo === 'borracha' && eraserCursorRef.current) {
      const { cx, cy } = eraserCursorRef.current;
      const eraserRadius = (RAIO_BORRACHA_PERCENT / 100) * drawW;
      ctx.beginPath();
      ctx.arc(cx, cy, eraserRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5 / scale;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }, [offsetX, offsetY, scale, pontos, modo, activeCor, mostrarDoses, pontoSelecionado, tamanhoMarcador]);

  const redrawRef = useRef(redrawCanvas);
  useLayoutEffect(() => {
    redrawRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, imageEpoch]);

  // ── CONVERSÃO DE COORDENADAS DE CONTEÚDO PARA PERCENTUAL DA FOTO ──
  const getPercentFromContent = useCallback((cx, cy) => {
    const canvas = canvasRef.current;
    const im = baseImageRef.current;
    if (!canvas || !im?.naturalWidth) return null;
    const { drawW, drawH, dx, dy } = getLetterboxLayout(
      canvas.width,
      canvas.height,
      im.naturalWidth,
      im.naturalHeight
    );
    if (drawW <= 0 || drawH <= 0) return null;
    const localX = cx - dx;
    const localY = cy - dy;
    if (localX < 0 || localX > drawW || localY < 0 || localY > drawH) return null;
    return {
      posX: Math.min(100, Math.max(0, (localX / drawW) * 100)),
      posY: Math.min(100, Math.max(0, (localY / drawH) * 100)),
    };
  }, []);

  // ── ALGORITMO DA BORRACHA CONTÍNUA ──
  const aplicarBorracha = useCallback(
    (cx, cy) => {
      const coords = getPercentFromContent(cx, cy);
      if (!coords) return;
      const { posX, posY } = coords;
      const r = RAIO_BORRACHA_PERCENT;

      setPontos((prevList) => {
        let mudou = false;
        const novaLista = [];

        for (const item of prevList) {
          if (item.tipoGeometria === 'ponto') {
            const dist = distance({ x: item.posX, y: item.posY }, { x: posX, y: posY });
            if (dist <= r) {
              mudou = true;
            } else {
              novaLista.push(item);
            }
          } else if (item.tipoGeometria === 'traco' && Array.isArray(item.vertices)) {
            const chunks = [];
            let currentChunk = [];

            for (const v of item.vertices) {
              const vx = v.posX ?? v.x;
              const vy = v.posY ?? v.y;
              const dist = distance({ x: vx, y: vy }, { x: posX, y: posY });

              if (dist > r) {
                currentChunk.push(v);
              } else {
                mudou = true;
                if (currentChunk.length >= 2) {
                  chunks.push(currentChunk);
                }
                currentChunk = [];
              }
            }

            if (currentChunk.length >= 2) {
              chunks.push(currentChunk);
            }

            if (chunks.length > 0) {
              chunks.forEach((chunk, idx) => {
                novaLista.push({
                  ...item,
                  id: idx === 0 ? item.id : `${item.id}_part_${idx}_${Date.now()}`,
                  vertices: chunk,
                });
              });
            }
          } else {
            novaLista.push(item);
          }
        }

        return mudou ? novaLista : prevList;
      });
    },
    [getPercentFromContent]
  );

  // ── TRATAMENTO DE EVENTOS DE PONTEIRO NO CANVAS ──
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Pan pelo motor nativo: botão do meio OU Espaço + clique esquerdo
    if (e.button === 1 || (spaceDown && e.button === 0)) {
      onPanPointerDown(e);
      return;
    }

    // 2. Pan pela ferramenta "Mover Foto"
    if (modo === 'mover' && e.button === 0) {
      isToolPanning.current = true;
      lastToolPanRef.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    if (e.button !== 0) return;

    // Se já havia um popover de ponto/traço aberto e o usuário clicou no canvas, fecha o popover
    if (pontoSelecionado) {
      setPontoSelecionado(null);
      return;
    }

    const coords = toCanvasCoordsFromEvent(e, canvas, offsetX, offsetY, scale);
    if (!coords) return;

    // Se a ferramenta NÃO for borracha, testa se clicou sobre um ponto ou traço existente para ver/editar o resumo
    if (modo !== 'borracha') {
      const hit = hitTestMarcacao(coords.x, coords.y);
      if (hit) {
        const { item } = hit;
        const proc = procedimentos.find(
          (p) => p.id === item.catalogoProcedimentoSaudeId
        );
        const procNome = proc
          ? proc.nome
          : item.catalogoProcedimentoSaudeId
            ? 'Procedimento'
            : null;
        const procCor = proc?.corHex || item.cor || COR_PADRAO_AVALIACAO;
        const procUnidade = proc?.unidadeMedida || item.unidadeMedida || activeUnidade || 'un';

        // Ordem sequencial da marcação dentro do seu procedimento e tipo de geometria
        const sameProcGeomMarks = pontos.filter(
          (p) =>
            (p.catalogoProcedimentoSaudeId || null) === (item.catalogoProcedimentoSaudeId || null) &&
            p.tipoGeometria === item.tipoGeometria
        );
        const procSubIndex = sameProcGeomMarks.findIndex((p) => p.id === item.id);
        const calcOrdem = procSubIndex >= 0 ? procSubIndex + 1 : 1;

        setPontoSelecionado({
          ponto: {
            ...item,
            ordem: item.ordem ?? calcOrdem,
            cor: procCor,
            unidadeMedida: procUnidade,
          },
          nomeProcedimento: procNome,
          catalogoId: proc?.id || item.catalogoProcedimentoSaudeId || null,
          cor: procCor,
          unidadeMedida: procUnidade,
        });
        return;
      }
    }

    const percent = getPercentFromContent(coords.x, coords.y);
    if (!percent) return;

    // 3. Ferramenta Ponto: clique direto posiciona marcador com a dose atual
    if (modo === 'ponto') {
      if (configMarcacao.confirmarDose) {
        setModalDosePonto(percent);
        setModalDoseValor(String(configMarcacao.dosePadrao || (activeUnidade === 'ml' ? 0.5 : 1)));
        return;
      }

      pushToHistory(pontos);
      const novoPonto = {
        id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tipoGeometria: 'ponto',
        posX: percent.posX,
        posY: percent.posY,
        cor: activeCor,
        quantidade: Number(configMarcacao.dosePadrao) || (activeUnidade === 'ml' ? 0.5 : 1),
        profundidade: configMarcacao.profundidade || null,
        tamanho: tamanhoMarcador,
        catalogoProcedimentoSaudeId: activeProc?.id || null,
        unidadeMedida: activeUnidade,
      };
      setPontos((prev) => [...prev, novoPonto]);
      return;
    }

    // 4. Ferramenta Traço Livre: inicia rascunho contínuo
    if (modo === 'traco') {
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      isDrawing.current = true;
      pushToHistory(pontos);
      liveVerticesRef.current = [{ x: percent.posX, y: percent.posY }];
      redrawRef.current();
      return;
    }

    // 5. Ferramenta Borracha: inicia apagamento contínuo
    if (modo === 'borracha') {
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      isErasing.current = true;
      pushToHistory(pontos);
      eraserCursorRef.current = { cx: coords.x, cy: coords.y };
      aplicarBorracha(coords.x, coords.y);
      redrawRef.current();
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isHookPanning) {
      onPanPointerMove(e);
      return;
    }

    if (isToolPanning.current) {
      const dx = e.clientX - lastToolPanRef.current.x;
      const dy = e.clientY - lastToolPanRef.current.y;
      lastToolPanRef.current = { x: e.clientX, y: e.clientY };
      setView((v) => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }));
      return;
    }

    const coords = toCanvasCoordsFromEvent(e, canvas, offsetX, offsetY, scale);
    if (!coords) return;

    // Detecta hover sobre ponto ou traço para mudar cursor para pointer
    if (!isDrawing.current && !isErasing.current && !isToolPanning.current && !isHookPanning) {
      if (modo !== 'borracha') {
        const hit = hitTestMarcacao(coords.x, coords.y);
        setHoveredPontoId(hit ? hit.item.id : null);
      } else {
        setHoveredPontoId(null);
      }
    }

    if (modo === 'borracha') {
      eraserCursorRef.current = { cx: coords.x, cy: coords.y };
      if (isErasing.current) {
        aplicarBorracha(coords.x, coords.y);
      }
      redrawRef.current();
      return;
    }

    if (isDrawing.current && modo === 'traco') {
      const percent = getPercentFromContent(coords.x, coords.y);
      if (percent) {
        const last = liveVerticesRef.current[liveVerticesRef.current.length - 1];
        if (!last || distance(last, { x: percent.posX, y: percent.posY }) >= 0.4) {
          liveVerticesRef.current.push({ x: percent.posX, y: percent.posY });
          redrawRef.current();
        }
      }
    }
  };

  const handlePointerUpOrCancel = (e) => {
    if (isHookPanning) {
      onPanPointerUp(e);
    }

    if (isToolPanning.current) {
      isToolPanning.current = false;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (isDrawing.current) {
      isDrawing.current = false;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      if (liveVerticesRef.current.length >= 2) {
        const simplified = simplifyCurveRDP(liveVerticesRef.current, 0.25);
        if (simplified.length >= 2) {
          const novoTraco = {
            id: `traco_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tipoGeometria: 'traco',
            vertices: simplified,
            cor: activeCor,
            quantidade: Number(configMarcacao.dosePadrao) || (activeUnidade === 'ml' ? 0.5 : 1),
            tamanho: tamanhoMarcador,
            profundidade: configMarcacao.profundidade || null,
            catalogoProcedimentoSaudeId: activeProc?.id || null,
            unidadeMedida: activeUnidade,
          };
          setPontos((prev) => [...prev, novoTraco]);
        }
      }
      liveVerticesRef.current = [];
      redrawRef.current();
    }

    if (isErasing.current) {
      isErasing.current = false;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerLeave = () => {
    setHoveredPontoId(null);
    if (modo === 'borracha') {
      eraserCursorRef.current = null;
      redrawRef.current();
    }
  };

  // ── SALVAMENTO OFFSCREEN EM RESOLUÇÃO TOTAL (100% NATIVA) ──
  const handleSalvar = async () => {
    const im = baseImageRef.current;
    if (!im?.complete || !im.naturalWidth || !im.naturalHeight) {
      toast.error('A imagem ainda não foi carregada.');
      return;
    }

    setIsSaving(true);
    try {
      const nw = im.naturalWidth;
      const nh = im.naturalHeight;

      // 1. Cria canvas offscreen na resolução real máxima da foto original
      const offCanvas = document.createElement('canvas');
      offCanvas.width = nw;
      offCanvas.height = nh;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) throw new Error('Falha ao inicializar contexto 2D');

      // 2. Desenha a foto original sem nenhum letterbox ou corte
      offCtx.drawImage(im, 0, 0, nw, nh);

      // Calcula layout da tela para espelhar exatamente a proporção visual que o usuário vê (WYSIWYG 1:1)
      const canvas = canvasRef.current;
      const cw = canvas?.width || window.innerWidth || 1200;
      const ch = canvas?.height || window.innerHeight || 800;
      const { drawW } = getLetterboxLayout(cw, ch, nw, nh);
      const screenPhotoWidth = drawW > 0 ? drawW : (nw > 0 ? Math.min(nw, 800) : 600);
      const scaleFactor = screenPhotoWidth > 0 ? (nw / screenPhotoWidth) : 1;

      // 3. Renderiza os traços livres gravados sobre a imagem nativa
      for (const item of pontos) {
        const itemTamanho = item.tamanho ?? tamanhoMarcador ?? 1.0;
        if (item.tipoGeometria === 'traco' && Array.isArray(item.vertices) && item.vertices.length >= 2) {
          offCtx.beginPath();
          offCtx.strokeStyle = item.cor || COR_PADRAO_AVALIACAO;
          offCtx.lineWidth = Math.max(2, 3.5 * itemTamanho * scaleFactor);
          offCtx.lineCap = 'round';
          offCtx.lineJoin = 'round';

          item.vertices.forEach((v, idx) => {
            const px = ((v.posX ?? v.x) / 100) * nw;
            const py = ((v.posY ?? v.y) / 100) * nh;
            if (idx === 0) offCtx.moveTo(px, py);
            else offCtx.lineTo(px, py);
          });
          offCtx.stroke();

          // Desenha pin terminal e dose gravada para traços na imagem offscreen se mostrarDoses estiver ativo
          if (mostrarDoses && item.quantidade != null) {
            const lastV = item.vertices[item.vertices.length - 1];
            const px = ((lastV.posX ?? lastV.x) / 100) * nw;
            const py = ((lastV.posY ?? lastV.y) / 100) * nh;
            const r = Math.max(3, 5.5 * itemTamanho * scaleFactor);
            const cor = item.cor || COR_PADRAO_AVALIACAO;

            offCtx.beginPath();
            offCtx.arc(px, py, r, 0, 2 * Math.PI);
            offCtx.fillStyle = cor;
            offCtx.fill();
            offCtx.lineWidth = Math.max(1.5, 1.5 * scaleFactor);
            offCtx.strokeStyle = '#ffffff';
            offCtx.stroke();

            const textoDose = formatQuantidadeEtiqueta(item.quantidade, '');
            const fontSize = Math.max(10, 11 * scaleFactor);
            offCtx.font = `bold ${fontSize}px sans-serif`;
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'middle';
            const m = offCtx.measureText(textoDose);
            const wBadge = Math.max(16 * scaleFactor, m.width + 8 * scaleFactor);
            const hBadge = 15 * scaleFactor;
            const yBadge = py - (14 * scaleFactor);

            offCtx.beginPath();
            if (typeof offCtx.roundRect === 'function') {
              offCtx.roundRect(px - wBadge / 2, yBadge - hBadge / 2, wBadge, hBadge, hBadge / 2);
            } else {
              offCtx.rect(px - wBadge / 2, yBadge - hBadge / 2, wBadge, hBadge);
            }
            offCtx.fillStyle = cor;
            offCtx.fill();
            offCtx.lineWidth = Math.max(1, 1.5 * scaleFactor);
            offCtx.strokeStyle = '#ffffff';
            offCtx.stroke();

            offCtx.fillStyle = '#ffffff';
            offCtx.fillText(textoDose, px, yBadge + 0.5 * scaleFactor);
          }
        } else if (item.tipoGeometria === 'ponto' && item.posX != null) {
          const px = (item.posX / 100) * nw;
          const py = (item.posY / 100) * nh;
          const r = Math.max(4, 7 * itemTamanho * scaleFactor);
          const cor = item.cor || COR_PADRAO_AVALIACAO;

          offCtx.beginPath();
          offCtx.arc(px, py, r, 0, 2 * Math.PI);
          offCtx.fillStyle = cor;
          offCtx.fill();
          offCtx.lineWidth = Math.max(2, 2 * scaleFactor);
          offCtx.strokeStyle = '#ffffff';
          offCtx.stroke();

          // Desenha dose gravada na imagem offscreen se mostrarDoses estiver ativo
          if (mostrarDoses && item.quantidade != null) {
            const textoDose = formatQuantidadeEtiqueta(item.quantidade, '');
            const fontSize = Math.max(10, 11 * scaleFactor);
            offCtx.font = `bold ${fontSize}px sans-serif`;
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'middle';
            const m = offCtx.measureText(textoDose);
            const wBadge = Math.max(16 * scaleFactor, m.width + 8 * scaleFactor);
            const hBadge = 15 * scaleFactor;
            const yBadge = py - (14 * scaleFactor);

            offCtx.beginPath();
            if (typeof offCtx.roundRect === 'function') {
              offCtx.roundRect(px - wBadge / 2, yBadge - hBadge / 2, wBadge, hBadge, hBadge / 2);
            } else {
              offCtx.rect(px - wBadge / 2, yBadge - hBadge / 2, wBadge, hBadge);
            }
            offCtx.fillStyle = cor;
            offCtx.fill();
            offCtx.lineWidth = Math.max(1, 1.5 * scaleFactor);
            offCtx.strokeStyle = '#ffffff';
            offCtx.stroke();

            offCtx.fillStyle = '#ffffff';
            offCtx.fillText(textoDose, px, yBadge + 0.5 * scaleFactor);
          }
        }
      }

      // 4. Exporta como Blob JPEG de alta fidelidade
      const blob = await new Promise((resolve) => {
        offCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
      });

      if (!blob) throw new Error('Não foi possível gerar a imagem anotada');

      const newUrl = URL.createObjectURL(blob);
      const targetIdx = typeof editingIndex === 'number' ? editingIndex : 0;

      // Monta o resumo consolidado de procedimentos mapeados para o Plano de Tratamento
      const resumoProcedimentos = procedimentos.map((proc) => {
        const stats = getProcedimentoStats(proc.id);
        return {
          catalogoProcedimentoSaudeId: proc.id,
          nomeProcedimento: proc.nome,
          unidadeMedida: proc.unidadeMedida || 'un',
          corHex: proc.corHex,
          pontosCount: stats.pontosCount,
          tracosCount: stats.tracosCount,
          quantidadeTotal: stats.doseTotal,
        };
      });

      // 5. Persiste o mapa relacional no banco se pacienteId estiver presente
      if (pacienteId) {
        try {
          const marcacoesPayload = pontos.map((p) => {
            const isTraco = p.tipoGeometria === 'traco' || Array.isArray(p.vertices);
            const procIdx = procedimentos.findIndex(
              (pr) => pr.id === (p.catalogoProcedimentoSaudeId || p.procedimentoId)
            );
            return {
              anguloFotoCodigo: 'frente',
              tipoGeometria: isTraco ? 'traco' : 'ponto',
              quantidade: Math.max(0.1, Number(p.quantidade) || (activeUnidade === 'ml' ? 0.5 : 1)),
              tamanho: p.tamanho ? Number(p.tamanho) : 1.0,
              procedimentoIndex: procIdx >= 0 ? procIdx : null,
              vertices:
                isTraco && Array.isArray(p.vertices)
                  ? p.vertices.map((v, i) => ({
                    ordem: i + 1,
                    posX: Number((v.posX ?? v.x).toFixed(2)),
                    posY: Number((v.posY ?? v.y).toFixed(2)),
                  }))
                  : [
                    {
                      ordem: 1,
                      posX: Number(p.posX.toFixed(2)),
                      posY: Number(p.posY.toFixed(2)),
                    },
                  ],
            };
          });

          const procedimentosPayload = procedimentos.map((proc) => ({
            catalogoProcedimentoSaudeId: proc.id,
            corHex: proc.corHex || null,
            planejamentoItemId: proc.planejamentoItemId || null,
          }));

          await mapasApi.salvar({
            pacienteId,
            tipoMapaCodigo: 'avaliacao',
            procedimentos: procedimentosPayload,
            marcacoes: marcacoesPayload,
          });
        } catch (errMapa) {
          console.warn('[AnnotationCanvasAvaliacao] Falha ao salvar mapa relacional:', errMapa);
        }
      }

      // Entrega o contrato downstream com os procedimentos mapeados
      onAnnotatedCaptureSaved?.({
        index: targetIdx,
        newUrl,
        blob,
        procedimentosMapeados: resumoProcedimentos,
        pontos,
      });

      if (typeof persistAnnotatedPhotoToGallery === 'function') {
        try {
          await persistAnnotatedPhotoToGallery(blob);
        } catch (e) {
          console.warn('[AnnotationCanvasAvaliacao] Falha ao enviar para galeria:', e);
        }
      }

      toast.success('Foto anotada e procedimentos mapeados com sucesso!');
      onClose?.();
    } catch (err) {
      console.error('[AnnotationCanvasAvaliacao] Erro ao salvar:', err);
      toast.error('Erro ao salvar foto anotada.');
    } finally {
      setIsSaving(false);
    }
  };

  const cursorClass =
    spaceDown || isHookPanning || isToolPanning.current
      ? isHookPanning || isToolPanning.current
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : modo === 'borracha'
        ? 'cursor-crosshair'
        : hoveredPontoId
          ? 'cursor-pointer'
          : 'cursor-crosshair';

  return createPortal(
    <div className="fixed inset-0 z-[150] flex overflow-hidden bg-[#f8fafc] text-slate-800 select-none">
      {/* ── BARRA LATERAL BRANCA (UNIFICADA COM PROCEDIMENTO) ── */}
      <MapeamentoFullscreenToolbar
        titulo="Avaliação Facial"
        procedimentoArmado={activeProc}
        procedimentos={procedimentos}
        procedimentosDoPlano={procedimentosDoPlano}
        carregandoPlano={carregandoPlano}
        activeProcedimentoId={activeProcedimentoId}
        onSelectProcedimento={(proc) => {
          setActiveProcedimentoId(proc.id);
          if (proc.unidadeMedida) {
            const isMl = proc.unidadeMedida.toLowerCase() === 'ml';
            setConfigMarcacao((prev) => ({
              ...prev,
              dosePadrao: isMl ? 0.5 : 1,
            }));
          }
        }}
        onAdicionarProcedimento={handleAdicionarProcedimento}
        onRemoverProcedimento={handleRemoverProcedimento}
        onMudarCorProcedimento={handleMudarCorProcedimento}
        corLivre={corLivre}
        onMudarCorLivre={setCorLivre}
        getProcedimentoStats={getProcedimentoStats}
        countPontosVista={pontos.length}
        onClose={onClose}
        configMarcacao={configMarcacao}
        setConfigMarcacao={setConfigMarcacao}
        unidadeMedida={activeUnidade}
        onClearVista={handleClearAll}
        modo={modo}
        setModo={setModo}
        tamanho={tamanhoMarcador}
        setTamanho={setTamanhoMarcador}
        mostrarValores={mostrarDoses}
        onToggleMostrarValores={() => setMostrarDoses((prev) => !prev)}
        onDesfazerUltimo={handleUndo}
        configPopoverOpen={configPopoverOpen}
        onConfigPopoverOpenChange={setConfigPopoverOpen}
        onSaveAction={handleSalvar}
        tituloAcaoPrimaria="Salvar Foto"
        isSaving={isSaving}
      />

      {/* ── PAINEL PRINCIPAL COM CANVAS E CONTROLES FLUTUANTES (Mesa de Luz Clínica Slate Profundo) ── */}
      <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0b0f19]" ref={containerRef}>
        {/* Barra Superior Discreta Flutuante — Branco Gelo Clínico */}
        <div className="absolute top-3.5 left-4 right-4 z-40 pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 backdrop-blur-xl border border-slate-200/90 shadow-md text-slate-800">
            <span className="text-xs font-bold text-slate-800">Avaliação Facial</span>
            {photos.length > 1 && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Foto {editingIndex + 1} de {photos.length}
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
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-xl shadow-teal-500/25 disabled:opacity-60 transition-all scale-100 active:scale-95 cursor-pointer"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[2.5]" />}
              <span>Salvar Foto</span>
            </button>
          </div>
        </div>

        {/* ILHA FLUTUANTE DE FERRAMENTAS — BRANCO GELO CLÍNICO (z-[60] GARANTIDO) */}
        <div
          className={`absolute z-[60] pointer-events-auto transition-all duration-200 ${
            islandDockedBottom
              ? 'bottom-5 left-1/2 -translate-x-1/2'
              : 'top-3.5 left-1/2 -translate-x-1/2'
          }`}
        >
          {isIslandMinimized ? (
            <button
              type="button"
              onClick={() => setIsIslandMinimized(false)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-xl backdrop-blur-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer animate-in fade-in zoom-in-95 duration-100"
              title="Expandir barra de ferramentas flutuante"
            >
              <MoveDiagonal className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ferramentas</span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {modo}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-xl backdrop-blur-xl">
              {/* Tríade de Ferramentas */}
              <button
                type="button"
                onClick={() => setModo('traco')}
                title="Traço Contínuo (T)"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  modo === 'traco'
                    ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <MoveDiagonal className="h-3.5 w-3.5" />
                <span>Traço</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('ponto')}
                title="Ponto Direto (P)"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  modo === 'ponto'
                    ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                <span>Ponto</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('borracha')}
                title="Borracha (B)"
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  modo === 'borracha'
                    ? 'border border-red-500/40 bg-red-50 text-red-600 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>Borracha</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Alternar Doses (Olho) */}
              <button
                type="button"
                onClick={() => setMostrarDoses((prev) => !prev)}
                title={mostrarDoses ? 'Ocultar Doses (D)' : 'Mostrar Doses (D)'}
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mostrarDoses
                    ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/70'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {mostrarDoses ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline text-[11px] font-bold">Doses</span>
              </button>

              {/* Desfazer */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={pontos.length === 0}
                title="Desfazer (Ctrl+Z)"
                className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Chip de Cor Ativa com Popover Rápido */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={`Cor ativa: ${activeCor}. Clique para mudar.`}
                  title={`Cor ativa: ${activeCor}`}
                  onClick={() => setIslandColorPickerOpen((prev) => !prev)}
                  className="flex items-center gap-1 rounded-xl p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span
                    className="h-4 w-4 rounded-full border border-black/20 shadow-2xs"
                    style={{ backgroundColor: activeCor }}
                  />
                </button>

                {islandColorPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[70]"
                      onClick={() => setIslandColorPickerOpen(false)}
                    />
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 ${
                        islandDockedBottom ? 'bottom-full mb-2' : 'top-full mt-2'
                      } z-[80] w-52 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100`}
                    >
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                        Trocar Cor Ativa
                      </p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {MAPEAMENTO_PALETA_CORES.map((c) => {
                          const procOwner = procedimentos.find(
                            (p) => (p.corHex || corParaProcedimento(p.id)).toLowerCase() === c.toLowerCase()
                          );
                          const isEmUso = Boolean(procOwner);
                          const isAtiva = activeCor.toLowerCase() === c.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              title={isEmUso ? `Em uso por: ${procOwner.nome}` : 'Cor livre'}
                              onClick={() => {
                                if (activeProc) {
                                  handleMudarCorProcedimento(activeProc.id, c);
                                } else {
                                  setCorLivre(c);
                                }
                                setIslandColorPickerOpen(false);
                              }}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-120 cursor-pointer ${
                                isAtiva ? 'ring-2 ring-emerald-500 ring-offset-1 scale-105' : 'border-black/10'
                              }`}
                              style={{ backgroundColor: c }}
                            >
                              {isEmUso ? (
                                <span className="h-1 w-1 rounded-full bg-white shadow-2xs" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Botão Enquadrar na Tela */}
              <button
                type="button"
                onClick={fitToScreen}
                title="Enquadrar na tela (0 ou R)"
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>Enquadrar</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Alternar Posição (Dock Inferior / Superior) */}
              <button
                type="button"
                onClick={() => setIslandDockedBottom((prev) => !prev)}
                title={islandDockedBottom ? 'Mover barra para o Topo' : 'Mover barra para a Base (Dock)'}
                className="flex items-center gap-1 rounded-xl px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                {islandDockedBottom ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>{islandDockedBottom ? 'Topo' : 'Dock'}</span>
              </button>

              {/* Minimizar Ilha */}
              <button
                type="button"
                onClick={() => setIsIslandMinimized(true)}
                title="Minimizar barra de ferramentas"
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Canvas da Foto */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onPointerLeave={handlePointerLeave}
          className={`absolute inset-0 h-full w-full touch-none select-none ${cursorClass}`}
        />

        {/* Popover de Resumo e Edição do Ponto / Traço */}
        <PontoMarcadorPopover
          open={Boolean(pontoSelecionado)}
          ponto={pontoSelecionado?.ponto}
          nomeProcedimento={pontoSelecionado?.nomeProcedimento}
          catalogoId={pontoSelecionado?.catalogoId}
          cor={pontoSelecionado?.cor}
          anchorLeft={popoverAnchor?.left}
          anchorTop={popoverAnchor?.top}
          onSave={handleSavePonto}
          onRemove={handleRemovePonto}
          onCancel={() => setPontoSelecionado(null)}
          unidadeMedida={pontoSelecionado?.unidadeMedida}
          onUnidadeMedidaChange={handleUnidadeMedidaChange}
        />

        {/* Controles Flutuantes de Zoom (Inferior Direito) — Branco Gelo Clínico */}
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-white/95 p-1 rounded-xl border border-slate-200/90 backdrop-blur-xl shadow-lg">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoomOut}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-35 transition-colors cursor-pointer"
            title="Afastar (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="min-w-[42px] text-center text-[10px] font-mono font-bold text-slate-600 px-1 select-none">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoomIn}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-35 transition-colors cursor-pointer"
            title="Aproximar (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={fitToScreen}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Enquadrar na tela"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal / Dialog para Confirmar Dose do Ponto */}
      {modalDosePonto && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <h4 className="text-sm font-bold text-slate-800">
              Confirmar Dose do Ponto
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {activeProc ? activeProc.nome : 'Procedimento ativo'}
            </p>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Dose ({activeUnidade})
              </label>
              <input
                type="number"
                min="0.1"
                step={activeUnidade === 'ml' ? '0.1' : '1'}
                value={modalDoseValor}
                onChange={(e) => setModalDoseValor(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmarModalDose();
                  if (e.key === 'Escape') setModalDosePonto(null);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setModalDosePonto(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarModalDose}
                className="flex-1 rounded-xl bg-teal-500 hover:bg-teal-600 py-2 text-xs font-bold text-white shadow-md shadow-teal-500/20 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Clínico de Confirmação para Remover Procedimento (Padrão Procedi) */}
      {procParaRemover && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 border border-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <h4 className="text-[16px] font-bold text-slate-900 leading-tight">
                Remover Procedimento?
              </h4>
            </div>

            <p className="text-[13px] text-slate-600 leading-relaxed">
              O procedimento <strong className="text-slate-800 font-semibold">{procParaRemover.nome}</strong> possui{' '}
              <span className="font-bold text-rose-600">
                {procParaRemover.totalMarks} marcação{procParaRemover.totalMarks > 1 ? 'ões' : ''}
              </span>{' '}
              desenhada{procParaRemover.totalMarks > 1 ? 's' : ''} nesta foto.
            </p>

            <p className="mt-2 text-[12px] text-slate-400">
              Ao remover, todas as marcações e doses associadas a ele nesta foto serão excluídas.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProcParaRemover(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRemocaoProcedimento}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition-colors cursor-pointer"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
