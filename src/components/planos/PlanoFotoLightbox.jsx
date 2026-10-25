import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Syringe,
  RotateCcw,
  ClipboardList,
  Info,
} from 'lucide-react';
import { GaleriaArquivoImage } from '../patients/GaleriaArquivoImage.jsx';
import { GaleriaMapaThumb } from '../patients/galeria/GaleriaMapaThumb.jsx';
import { GALERIA_CATEGORIA_LABELS, formatDataSessaoPtBr } from '../../utils/pacienteGaleria.js';
import { marcacoesApiToOverlayPontos } from '../journey/mapeamento/mapaMarcacoesOverlayUtils.js';

const MIN_SCALE = 1;
const MAX_SCALE = 8;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function useLightboxPanZoom(containerRef) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pointersRef = useRef(new Map());
  const pinchStartRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const getBounds = useCallback((currentScale) => {
    const el = containerRef.current;
    if (!el || currentScale <= 1) return { maxX: 0, maxY: 0 };
    const rect = el.getBoundingClientRect();
    const maxX = Math.max(0, ((currentScale - 1) * rect.width) / 2);
    const maxY = Math.max(0, ((currentScale - 1) * rect.height) / 2);
    return { maxX, maxY };
  }, [containerRef]);

  const resetZoom = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (pointersRef.current.size === 1) {
      setIsDragging(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartRef.current = {
        dist,
        scale: transform.scale,
      };
    }
  }, [transform.scale]);

  const handlePointerMove = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / pinchStartRef.current.dist;
      const targetScale = clamp(pinchStartRef.current.scale * ratio, 1, 5);

      setTransform((prev) => {
        const { maxX, maxY } = getBounds(targetScale);
        return {
          scale: targetScale,
          x: clamp(prev.x, -maxX, maxX),
          y: clamp(prev.y, -maxY, maxY),
        };
      });
    } else if (pointersRef.current.size === 1 && isDragging) {
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };

      setTransform((prev) => {
        const { maxX, maxY } = getBounds(prev.scale);
        return {
          ...prev,
          x: clamp(prev.x + dx, -maxX, maxX),
          y: clamp(prev.y + dy, -maxY, maxY),
        };
      });
    }
  }, [getBounds, isDragging]);

  const handlePointerUp = useCallback((e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      setIsDragging(false);
    }
  }, []);

  // Wheel zoom no cursor com limite de bordas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setTransform((prev) => {
        const newScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
        if (newScale <= 1.01) {
          return { scale: 1, x: 0, y: 0 };
        }
        const { maxX, maxY } = getBounds(newScale);
        return {
          scale: newScale,
          x: clamp(prev.x * (newScale / prev.scale), -maxX, maxX),
          y: clamp(prev.y * (newScale / prev.scale), -maxY, maxY),
        };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, getBounds]);

  const handleDoubleClick = useCallback(() => {
    setTransform((prev) => {
      if (prev.scale > 1.1) {
        return { scale: 1, x: 0, y: 0 };
      }
      return { scale: 2.2, x: 0, y: 0 };
    });
  }, []);

  return {
    scale: transform.scale,
    x: transform.x,
    y: transform.y,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    resetZoom,
  };
}

function GestureZoomViewport({
  isMapa,
  foto,
  pacienteId,
  filtroProcedimentoId = null,
  procedimentosOcultosIds = [],
  hoveredPontoId = null,
  onMarkerHover = null,
  onMarkerClick = null,
  onBackgroundClick = null,
  ocultarMarcacoes = false,
}) {
  const containerRef = useRef(null);
  const {
    scale,
    x,
    y,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    resetZoom,
  } = useLightboxPanZoom(containerRef);

  // Reset zoom ao trocar de foto
  useEffect(() => {
    resetZoom();
  }, [foto?.id, foto?.fotoId, foto?.url, resetZoom]);

  const cursorClass = scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onClick={() => {
        if (!isDragging) {
          onBackgroundClick?.();
        }
      }}
      className={`relative h-auto max-h-[75vh] w-auto max-w-full overflow-hidden rounded-xl bg-slate-400/80 border-2 border-slate-400/90 shadow-xl touch-none select-none ${cursorClass}`}
    >
      <div
        className="flex items-center justify-center pointer-events-auto"
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: '50% 50%',
          transition: isDragging ? 'none' : 'transform 100ms ease-out',
        }}
      >
        {isMapa ? (
          <div className="h-[74vh] max-h-[74vh] w-[min(74vh,85vw)] aspect-square flex items-center justify-center">
            <GaleriaMapaThumb
              url={foto.url}
              mapaOverlay={
                foto.mapaOverlay ||
                (foto.pontos
                  ? {
                      pontos: foto.pontos,
                      procedimentos: foto.procedimentosMapeados || foto.procedimentos || [],
                    }
                  : null)
              }
              pacienteId={pacienteId}
              fotoId={foto.serverId || foto.fotoId || foto.id}
              alt={foto.descricaoLegenda || 'Mapa ampliado'}
              density="full"
              className="h-full w-full rounded"
              interactive={true}
              filtroProcedimentoId={filtroProcedimentoId}
              procedimentosOcultosIds={procedimentosOcultosIds}
              hoveredPontoId={hoveredPontoId}
              onMarkerHover={onMarkerHover}
              onMarkerClick={onMarkerClick}
              ocultarMarcacoes={ocultarMarcacoes}
            />
          </div>
        ) : (
          <GaleriaArquivoImage
            url={foto.url}
            pacienteId={pacienteId}
            fotoId={foto.serverId || foto.fotoId || foto.id}
            alt={foto.descricaoLegenda || 'Foto ampliada'}
            imgClassName="max-h-[70vh] w-auto max-w-[88vw] object-contain rounded"
          />
        )}
      </div>
    </div>
  );
}

export function PlanoFotoLightbox({
  foto,
  fotos = [],
  pacienteId,
  onClose,
}) {
  const listaFotos = useMemo(() => {
    if (Array.isArray(fotos) && fotos.length > 0) return fotos;
    if (foto) return [foto];
    return [];
  }, [fotos, foto]);

  const [indiceAtual, setIndiceAtual] = useState(() => {
    if (!foto || !Array.isArray(fotos) || fotos.length === 0) return 0;
    const fId = String(foto.serverId || foto.id || foto.fotoId || foto.url);
    const idx = fotos.findIndex((item) => String(item.serverId || item.id || item.fotoId || item.url) === fId);
    return idx >= 0 ? idx : 0;
  });

  const [prevFoto, setPrevFoto] = useState(foto);
  if (foto !== prevFoto) {
    setPrevFoto(foto);
    if (foto && Array.isArray(fotos) && fotos.length > 0) {
      const fId = String(foto.serverId || foto.id || foto.fotoId || foto.url);
      const idx = fotos.findIndex((item) => String(item.serverId || item.id || item.fotoId || item.url) === fId);
      if (idx >= 0 && idx !== indiceAtual) {
        setIndiceAtual(idx);
      }
    }
  }

  const [filtroProcedimentoId, setFiltroProcedimentoId] = useState(null);
  const [procedimentosOcultosIds, setProcedimentosOcultosIds] = useState([]);
  const [ocultarMarcacoes, setOcultarMarcacoes] = useState(false);
  const [hoveredPontoId, setHoveredPontoId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef(null);

  const toggleProcedimentoVisibilidade = useCallback((procId) => {
    setProcedimentosOcultosIds((prev) =>
      prev.includes(procId) ? prev.filter((id) => id !== procId) : [...prev, procId]
    );
  }, []);

  const handleMostrarTodos = useCallback(() => {
    setProcedimentosOcultosIds([]);
    setFiltroProcedimentoId(null);
  }, []);

  // Reset de estados interativos ao mudar foto sem disparar cascading render
  const [prevIndice, setPrevIndice] = useState(indiceAtual);
  if (prevIndice !== indiceAtual) {
    setPrevIndice(indiceAtual);
    setFiltroProcedimentoId(null);
    setProcedimentosOcultosIds([]);
    setHoveredPontoId(null);
    setIsDrawerOpen(false);
    setIsPopoverOpen(false);
  }

  // Fechar popover ao clicar fora
  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  const totalFotos = listaFotos.length;
  const fotoAtual = listaFotos[indiceAtual] || foto;

  const handleAnterior = useCallback(() => {
    if (totalFotos <= 1) return;
    setIndiceAtual((prev) => (prev > 0 ? prev - 1 : totalFotos - 1));
  }, [totalFotos]);

  const handleProxima = useCallback(() => {
    if (totalFotos <= 1) return;
    setIndiceAtual((prev) => (prev < totalFotos - 1 ? prev + 1 : 0));
  }, [totalFotos]);

  // Navegação por teclado: Seta Esquerda (←), Seta Direita (→) e Escape (Fechar)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isPopoverOpen) {
          setIsPopoverOpen(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else {
          onClose?.();
        }
      } else if (e.key === 'ArrowLeft') {
        handleAnterior();
      } else if (e.key === 'ArrowRight') {
        handleProxima();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnterior, handleProxima, onClose, isDrawerOpen, isPopoverOpen]);

  const tipoMapaCodigo = fotoAtual?.mapaOverlay?.tipoMapaCodigo;

  const isAvaliacao =
    fotoAtual?.categoria === 'avaliacao' ||
    fotoAtual?.tipoFotoCodigo === 'avaliacao' ||
    tipoMapaCodigo === 'avaliacao' ||
    (typeof fotoAtual?.fileName === 'string' && fotoAtual.fileName.toLowerCase().includes('avaliacao'));

  const isMapa =
    Boolean(fotoAtual?.mapaOverlay?.marcacoes?.length) ||
    fotoAtual?.categoria === 'mapa' ||
    Boolean(fotoAtual?.pontos?.length) ||
    Boolean(tipoMapaCodigo) ||
    isAvaliacao;

  const categoria = fotoAtual?.categoria || (isAvaliacao ? 'avaliacao' : 'outro');
  const catLabel =
    tipoMapaCodigo === 'avaliacao' || isAvaliacao
      ? 'Mapa de Avaliação'
      : tipoMapaCodigo === 'retorno'
        ? 'Mapa de Retorno'
        : tipoMapaCodigo === 'procedimento'
          ? 'Mapa de Procedimento'
          : (GALERIA_CATEGORIA_LABELS[categoria] || categoria);
  const dataRaw =
    fotoAtual?.dataISO ||
    fotoAtual?.dataReferencia ||
    (fotoAtual?.createdAt ? String(fotoAtual.createdAt).slice(0, 10) : null);
  const dataLabel = formatDataSessaoPtBr(dataRaw);

  const procedimentos = useMemo(
    () => fotoAtual?.mapaOverlay?.procedimentos || fotoAtual?.procedimentos || fotoAtual?.procedimentosSessao || [],
    [fotoAtual?.mapaOverlay?.procedimentos, fotoAtual?.procedimentos, fotoAtual?.procedimentosSessao]
  );
  const pontos = useMemo(() => {
    const marcacoes =
      fotoAtual?.mapaOverlay?.marcacoes ||
      fotoAtual?.mapaOverlay?.pontos ||
      fotoAtual?.pontos ||
      [];
    return marcacoesApiToOverlayPontos(marcacoes, procedimentos);
  }, [fotoAtual?.mapaOverlay?.marcacoes, fotoAtual?.mapaOverlay?.pontos, fotoAtual?.pontos, procedimentos]);

  const fallbackNomeProcedimento = fotoAtual?.procedimentoNome || fotoAtual?.nomeProcedimento || 'Procedimento';

  const resumoProcedimentos = useMemo(() => {
    const map = new Map();

    if (Array.isArray(procedimentos) && procedimentos.length > 0) {
      procedimentos.forEach((proc, idx) => {
        const key = String(proc.id || `proc_${idx}`);
        map.set(key, {
          id: proc.id || key,
          nome: proc.catalogoNome || proc.nome || fallbackNomeProcedimento,
          cor: proc.corHex || proc.cor || '#00a88e',
          unidade: proc.unidade || 'u',
          totalPontos: 0,
          doseTotal: 0,
          pontos: [],
        });
      });
    }

    pontos.forEach((p) => {
      const key = p.mapaProcedimentoId
        ? String(p.mapaProcedimentoId)
        : (p.nomeProcedimento || p.cor || 'geral');
      if (!map.has(key)) {
        const procMeta = Array.isArray(procedimentos)
          ? procedimentos.find((pr) => String(pr.id) === String(p.mapaProcedimentoId))
          : null;
        map.set(key, {
          id: p.mapaProcedimentoId || key,
          nome: p.nomeProcedimento || procMeta?.catalogoNome || procMeta?.nome || fallbackNomeProcedimento,
          cor: p.cor,
          unidade: p.unidadeMedida || procMeta?.unidade || 'u',
          totalPontos: 0,
          doseTotal: 0,
          pontos: [],
        });
      }
      const entry = map.get(key);
      entry.totalPontos += 1;
      const qtdNum = Number(p.quantidade) || 0;
      entry.doseTotal = Number((entry.doseTotal + qtdNum).toFixed(2));
      entry.pontos.push({
        id: p.localId || p.id,
        ordemPonto: entry.totalPontos,
        quantidade: p.quantidade,
        unidadeMedida: entry.unidade,
      });
    });

    return Array.from(map.values());
  }, [pontos, procedimentos, fallbackNomeProcedimento]);

  if (!fotoAtual) return null;

  const renderSidebarContent = () => {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            {isAvaliacao ? (
              <ClipboardList className="w-4 h-4 text-[#00a88e]" />
            ) : (
              <Syringe className="w-4 h-4 text-emerald-600" />
            )}
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isAvaliacao ? 'Procedimentos Planejados' : 'Resumo de Insumos'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isAvaliacao && (
              <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e6f7f5] text-[#00a88e] border border-[#00a88e]/20">
                Diagnóstico
              </span>
            )}
            {procedimentosOcultosIds.length > 0 && (
              <button
                type="button"
                onClick={handleMostrarTodos}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/90 hover:text-emerald-800 border border-emerald-200/90 shadow-2xs transition-all duration-150 cursor-pointer active:scale-95"
                title="Mostrar todos os procedimentos"
              >
                <RotateCcw className="w-3 h-3 text-emerald-600" />
                <span>Mostrar todos</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {resumoProcedimentos.map((proc) => {
            const isOculto = procedimentosOcultosIds.includes(proc.id);
            return (
              <div
                key={proc.id}
                onClick={() => toggleProcedimentoVisibilidade(proc.id)}
                title={isOculto ? `Exibir ${proc.nome}` : `Ocultar ${proc.nome}`}
                className={`rounded-xl border p-3 transition-all duration-150 border-l-4 shadow-xs cursor-pointer select-none ${isOculto
                    ? 'bg-slate-50/80 border-slate-200 opacity-45 hover:opacity-75'
                    : 'bg-white border-slate-200 hover:bg-slate-50/80 hover:border-slate-300 hover:shadow-sm'
                  }`}
                style={{ borderLeftColor: proc.cor || '#00a88e' }}
              >
                {/* Cabeçalho do procedimento */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs ring-2 ring-slate-100"
                      style={{ backgroundColor: isOculto ? '#94a3b8' : proc.cor || '#00a88e' }}
                    />
                    <span className={`text-xs font-bold truncate ${isOculto ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {proc.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {proc.doseTotal > 0 && (
                      <span
                        className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs"
                        style={{
                          backgroundColor: isOculto ? '#f1f5f9' : `${proc.cor || '#00a88e'}18`,
                          color: isOculto ? '#64748b' : proc.cor || '#00a88e',
                          border: `1px solid ${isOculto ? '#cbd5e1' : `${proc.cor || '#00a88e'}40`}`,
                        }}
                      >
                        {proc.doseTotal} {proc.unidade}
                      </span>
                    )}
                    <span className="p-0.5 text-slate-400">
                      {isOculto ? (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </span>
                  </div>
                </div>

                {/* Lista de pontos do procedimento */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {isAvaliacao ? `Pontos planejados (${proc.totalPontos}):` : `Pontos de aplicação (${proc.totalPontos}):`}
                  </span>
                  {proc.pontos && proc.pontos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proc.pontos.map((pt) => {
                        const isPtHovered = hoveredPontoId != null && String(hoveredPontoId) === String(pt.id);
                        return (
                          <button
                            key={pt.id}
                            type="button"
                            onMouseEnter={() => setHoveredPontoId(pt.id)}
                            onMouseLeave={() => setHoveredPontoId(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isOculto) {
                                toggleProcedimentoVisibilidade(proc.id);
                              }
                              setHoveredPontoId(pt.id);
                            }}
                            className={`text-[11px] font-mono px-2 py-1 rounded-md transition-all duration-150 flex items-center gap-1 cursor-pointer ${isPtHovered
                                ? 'bg-emerald-600 text-white font-bold scale-105 shadow-sm ring-2 ring-emerald-400'
                                : isOculto
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                          >
                            <span>Ponto #{pt.ordemPonto}</span>
                            <span className="text-slate-400">·</span>
                            <span className="font-semibold">{pt.quantidade} {pt.unidadeMedida}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic pt-0.5">Demarcação livre anatômica</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSidebarAvaliacao = () => {
    const totalPontosContados = pontos.length;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Cabeçalho da Sidebar de Avaliação */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#00a88e]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Resumo da Avaliação
            </h3>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e6f7f5] text-[#00a88e] border border-[#00a88e]/20">
            Diagnóstico
          </span>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {/* Card: Detalhes do Registro Clínico */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              Registro Clínico
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Finalidade</span>
              <span className="font-bold text-slate-800">Avaliação & Mapeamento</span>
            </div>

            {dataLabel && dataLabel !== '—' && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Data do registro</span>
                <span className="font-semibold font-mono text-slate-800 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {dataLabel}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Pontos no mapa</span>
              <span className="font-bold font-mono text-[#00a88e] bg-[#e6f7f5] px-2 py-0.5 rounded-md text-[11px]">
                {totalPontosContados > 0 ? `${totalPontosContados} ponto${totalPontosContados !== 1 ? 's' : ''}` : 'Demarcação livre'}
              </span>
            </div>
          </div>

          {/* Card Informativo: Sem Insumos / Referência Anatômica */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Info className="w-3.5 h-3.5 text-[#00a88e] shrink-0" />
              <span>Etapa de Avaliação Facial</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Esta sessão registra o diagnóstico estético e os vetores de planejamento. As marcações funcionam como referências visuais anatômicas prévias à aplicação dos produtos.
            </p>
          </div>

          {/* Lista de Pontos Anatômicos se houver */}
          {totalPontosContados > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Pontos de Referência ({totalPontosContados})
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {pontos.map((pt, idx) => {
                  const isPtHovered = hoveredPontoId != null && String(hoveredPontoId) === String(pt.id || pt.localId);
                  return (
                    <button
                      key={pt.id || pt.localId || idx}
                      type="button"
                      onMouseEnter={() => setHoveredPontoId(pt.id || pt.localId)}
                      onMouseLeave={() => setHoveredPontoId(null)}
                      onClick={() => setHoveredPontoId(pt.id || pt.localId)}
                      className={`text-[11px] font-mono px-2 py-1 rounded-md transition-all duration-150 flex items-center gap-1 cursor-pointer select-none ${
                        isPtHovered
                          ? 'bg-[#00a88e] text-white font-bold scale-105 shadow-sm ring-2 ring-[#00a88e]/40'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pt.cor || '#00a88e' }} />
                      <span>Ponto #{idx + 1}</span>
                      {pt.quantidade ? (
                        <span className="font-semibold text-[10px] text-slate-400">· {pt.quantidade} {pt.unidadeMedida || 'u'}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações da Consulta / Foto se houver */}
          {fotoAtual.descricaoLegenda && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1 shadow-2xs">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>Observações Clínicas</span>
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pt-0.5">
                {fotoAtual.descricaoLegenda}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const temSidebar = isMapa;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-300 ${temSidebar ? 'w-[96vw] max-w-[1300px] h-[92vh] max-h-[92vh]' : 'w-auto max-w-fit max-h-[96vh]'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com Chips e Controles */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="px-2 py-0.5 rounded text-[10.5px] font-extrabold uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-300">
              {catLabel}
            </span>
            {(!isMapa || resumoProcedimentos.length === 0) && (
              <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[280px]">
                {fotoAtual.nomeProcedimento || fotoAtual.descricaoLegenda || 'Registro Fotográfico'}
              </span>
            )}
            {dataLabel && dataLabel !== '—' && (
              <span className="hidden sm:flex text-[11px] text-slate-500 items-center gap-1 font-mono">
                <Calendar className="w-3 h-3" />
                {dataLabel}
              </span>
            )}
            {totalFotos > 1 && (
              <span className="text-[10.5px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {indiceAtual + 1} de {totalFotos}
              </span>
            )}

            {/* Chips Rápidos de Procedimentos com Estilo Neutro e Dot Colorido */}
            {isMapa && resumoProcedimentos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap ml-1">
                {resumoProcedimentos.slice(0, 2).map((proc) => {
                  const isOculto = procedimentosOcultosIds.includes(proc.id);
                  return (
                    <button
                      key={proc.id}
                      type="button"
                      onClick={() => toggleProcedimentoVisibilidade(proc.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer select-none border ${isOculto
                          ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                          : 'border-slate-300 text-slate-800 bg-white hover:bg-slate-50 hover:border-slate-400 shadow-2xs'
                        }`}
                      title={isOculto ? `Exibir ${proc.nome}` : `Ocultar ${proc.nome}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: isOculto ? '#94a3b8' : proc.cor || '#00a88e' }}
                      />
                      <span className={`truncate max-w-[120px] ${isOculto ? 'line-through text-slate-400' : ''}`}>
                        {proc.nome}
                      </span>
                      <span className="font-mono text-[10.5px] font-bold text-slate-500">
                        {proc.doseTotal} {proc.unidade}
                      </span>
                    </button>
                  );
                })}

                {/* Popover de Overflow quando há 3 ou mais procedimentos */}
                {resumoProcedimentos.length > 2 && (
                  <div className="relative inline-flex items-center" ref={popoverRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPopoverOpen((prev) => !prev);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer select-none bg-white border ${resumoProcedimentos.slice(2).some((p) => procedimentosOcultosIds.includes(p.id))
                          ? 'border-slate-300 bg-slate-100 text-slate-500'
                          : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-2xs'
                        }`}
                      title="Mais procedimentos"
                    >
                      <span>+{resumoProcedimentos.length - 2} outros</span>
                      <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isPopoverOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-slate-300 rounded-xl shadow-xl p-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1 border-b border-slate-100 mb-1">
                          Outros Procedimentos
                        </span>
                        {resumoProcedimentos.slice(2).map((proc) => {
                          const isOculto = procedimentosOcultosIds.includes(proc.id);
                          return (
                            <button
                              key={proc.id}
                              type="button"
                              onClick={() => {
                                toggleProcedimentoVisibilidade(proc.id);
                              }}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${isOculto
                                  ? 'bg-slate-100 text-slate-400'
                                  : 'text-slate-800 hover:bg-slate-100'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: isOculto ? '#94a3b8' : proc.cor || '#00a88e' }}
                                />
                                <span className={`truncate ${isOculto ? 'line-through text-slate-400' : ''}`}>{proc.nome}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-[11px] text-slate-500 font-bold">
                                  {proc.doseTotal} {proc.unidade}
                                </span>
                                {isOculto ? (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botão Foto Limpa (Alternar Marcações) */}
            {isMapa && (
              <button
                type="button"
                onClick={() => setOcultarMarcacoes((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${ocultarMarcacoes
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold shadow-xs hover:bg-amber-200'
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-300 shadow-xs'
                  }`}
                title={ocultarMarcacoes ? 'Mostrar pontos e traços' : 'Ver foto original sem marcações'}
              >
                {ocultarMarcacoes ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                    <span>Foto Limpa</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Foto Limpa</span>
                  </>
                )}
              </button>
            )}

            {/* Botão de Resumo/Insumos para Tablet/Mobile */}
            {temSidebar && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="lg:hidden flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-emerald-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
                title={resumoProcedimentos.length > 0 ? (isAvaliacao ? 'Abrir planejamento de procedimentos' : 'Abrir resumo de insumos') : 'Abrir resumo da avaliação'}
              >
                {resumoProcedimentos.length > 0 ? (
                  <>
                    {isAvaliacao ? <ClipboardList className="w-3.5 h-3.5 text-[#00a88e]" /> : <Syringe className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">
                      {isAvaliacao ? `Planejamento (${resumoProcedimentos.length})` : `Insumos (${resumoProcedimentos.length})`}
                    </span>
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-3.5 h-3.5 text-[#00a88e]" />
                    <span className="hidden sm:inline">Avaliação</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Principal Split: Foto Ampla à Esquerda + Sidebar de Insumos à Direita */}
        <div className="relative flex flex-1 min-h-0 overflow-hidden bg-slate-200/90">
          <div className="flex-1 min-w-0 flex items-center justify-center p-2 relative overflow-hidden bg-slate-300">
            {totalFotos > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnterior();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md transition-all hover:scale-110 border border-slate-300 cursor-pointer"
                  title="Foto anterior (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProxima();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md transition-all hover:scale-110 border border-slate-300 cursor-pointer"
                  title="Próxima foto (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <GestureZoomViewport
              isMapa={isMapa}
              foto={fotoAtual}
              pacienteId={pacienteId}
              filtroProcedimentoId={filtroProcedimentoId}
              procedimentosOcultosIds={procedimentosOcultosIds}
              hoveredPontoId={hoveredPontoId}
              onMarkerHover={(pt) => setHoveredPontoId(pt ? (pt.localId || pt.id) : null)}
              onMarkerClick={(pt) => {
                if (pt?.mapaProcedimentoId) {
                  toggleProcedimentoVisibilidade(pt.mapaProcedimentoId);
                }
              }}
              onBackgroundClick={() => {
                setHoveredPontoId(null);
              }}
              ocultarMarcacoes={ocultarMarcacoes}
            />
          </div>

          {/* Sidebar Lateral Fixa no PC (Não Oclusiva) */}
          {temSidebar && (
            <aside className="hidden lg:flex flex-col w-[300px] shrink-0 bg-white border-l border-slate-200 text-slate-900 p-3.5 overflow-hidden">
              {resumoProcedimentos.length > 0
                ? renderSidebarContent()
                : renderSidebarAvaliacao()}
            </aside>
          )}
        </div>

        {/* Faixa de Miniaturas para Navegação Rápida */}
        {totalFotos > 1 && (
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-1.5 overflow-x-auto max-w-full shrink-0">
            {listaFotos.map((f, idx) => {
              const ativo = idx === indiceAtual;
              return (
                <div
                  key={f.serverId || f.id || f.fotoId || idx}
                  onClick={() => setIndiceAtual(idx)}
                  className={`w-9 h-9 rounded-md overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${ativo ? 'border-[#00a88e] ring-2 ring-[#00a88e]/30 scale-105 shadow-sm' : 'border-slate-300 opacity-60 hover:opacity-100'
                    }`}
                  title={f.descricaoLegenda || `Foto ${idx + 1}`}
                >
                  <GaleriaArquivoImage
                    url={f.url}
                    pacienteId={pacienteId}
                    fotoId={f.serverId || f.fotoId || f.id}
                    alt="thumb"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {fotoAtual.descricaoLegenda && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center gap-1.5 shrink-0">
            <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{fotoAtual.descricaoLegenda}</span>
          </div>
        )}
      </div>

      {/* Drawer Flutuante Lateral / Bottom Sheet para Tablet e Celular */}
      {temSidebar && isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/40 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-full sm:w-[320px] max-h-[80vh] sm:max-h-full bg-white border-t sm:border-t-0 sm:border-l border-slate-200 rounded-t-2xl sm:rounded-none p-4 flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-200 shrink-0">
              <span className="text-xs font-bold text-slate-800">
                {resumoProcedimentos.length > 0
                  ? (isAvaliacao ? 'Procedimentos Planejados' : 'Insumos do Mapa')
                  : 'Resumo da Avaliação'}
              </span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {resumoProcedimentos.length > 0
                ? renderSidebarContent()
                : renderSidebarAvaliacao()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


