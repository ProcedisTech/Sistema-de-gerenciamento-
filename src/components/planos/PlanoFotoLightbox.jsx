import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { X, Calendar, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { GaleriaArquivoImage } from '../patients/GaleriaArquivoImage.jsx';
import { GaleriaMapaThumb } from '../patients/galeria/GaleriaMapaThumb.jsx';
import { GALERIA_CATEGORIA_LABELS, formatDataSessaoPtBr } from '../../utils/pacienteGaleria.js';

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
      className={`relative h-auto max-h-[70vh] w-auto max-w-[88vw] overflow-hidden rounded-lg bg-slate-950 touch-none select-none ${cursorClass}`}
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
          <div className="h-[70vh] max-h-[70vh] w-[min(88vw,70vh)] aspect-square flex items-center justify-center">
            <GaleriaMapaThumb
              url={foto.url}
              mapaOverlay={foto.mapaOverlay}
              pacienteId={pacienteId}
              fotoId={foto.fotoId || foto.id}
              alt={foto.descricaoLegenda || 'Mapa ampliado'}
              density="full"
              className="h-full w-full rounded"
            />
          </div>
        ) : (
          <GaleriaArquivoImage
            url={foto.url}
            pacienteId={pacienteId}
            fotoId={foto.fotoId || foto.id}
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
    const fId = String(foto.id || foto.fotoId || foto.url);
    const idx = fotos.findIndex((item) => String(item.id || item.fotoId || item.url) === fId);
    return idx >= 0 ? idx : 0;
  });

  const [prevFoto, setPrevFoto] = useState(foto);
  if (foto !== prevFoto) {
    setPrevFoto(foto);
    if (foto && Array.isArray(fotos) && fotos.length > 0) {
      const fId = String(foto.id || foto.fotoId || foto.url);
      const idx = fotos.findIndex((item) => String(item.id || item.fotoId || item.url) === fId);
      if (idx >= 0 && idx !== indiceAtual) {
        setIndiceAtual(idx);
      }
    }
  }

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
        onClose?.();
      } else if (e.key === 'ArrowLeft') {
        handleAnterior();
      } else if (e.key === 'ArrowRight') {
        handleProxima();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnterior, handleProxima, onClose]);

  if (!fotoAtual) return null;

  const isMapa = Boolean(fotoAtual?.mapaOverlay?.marcacoes?.length) || fotoAtual?.categoria === 'mapa';
  const categoria = fotoAtual.categoria || 'outro';
  const catLabel = GALERIA_CATEGORIA_LABELS[categoria] || categoria;
  const dataLabel = formatDataSessaoPtBr(fotoAtual.dataISO);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-fit w-auto max-h-[96vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compacto com Estilo Neutro */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10.5px] font-extrabold uppercase tracking-wider bg-slate-200/80 text-slate-700 border border-slate-300/80">
              {catLabel}
            </span>
            <span className="text-xs font-bold text-slate-800">
              {fotoAtual.nomeProcedimento || fotoAtual.descricaoLegenda || 'Registro Fotográfico'}
            </span>
            {dataLabel && dataLabel !== '—' && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Calendar className="w-3 h-3" />
                {dataLabel}
              </span>
            )}
            {totalFotos > 1 && (
              <span className="text-[10.5px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-600">
                {indiceAtual + 1} de {totalFotos}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Ajustado ao Tamanho da Imagem com Setas de Navegação */}
        <div className="relative p-2 bg-slate-950 flex flex-1 items-center justify-center overflow-hidden">
          {totalFotos > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnterior();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-lg transition-all hover:scale-110 border border-slate-700/60"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white shadow-lg transition-all hover:scale-110 border border-slate-700/60"
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
          />
        </div>

        {/* Faixa de Miniaturas para Navegação Rápida */}
        {totalFotos > 1 && (
          <div className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-1.5 overflow-x-auto max-w-[88vw] shrink-0">
            {listaFotos.map((f, idx) => {
              const ativo = idx === indiceAtual;
              return (
                <div
                  key={f.id || f.fotoId || idx}
                  onClick={() => setIndiceAtual(idx)}
                  className={`w-9 h-9 rounded-md overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${ativo ? 'border-[#00a88e] scale-105 shadow-md' : 'border-slate-700 opacity-50 hover:opacity-90'
                    }`}
                  title={f.descricaoLegenda || `Foto ${idx + 1}`}
                >
                  <GaleriaArquivoImage
                    url={f.url}
                    pacienteId={pacienteId}
                    fotoId={f.fotoId || f.id}
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
          <div className="px-4 py-2 bg-white border-t border-slate-200 text-xs text-slate-600 flex items-center gap-1.5 shrink-0">
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{fotoAtual.descricaoLegenda}</span>
          </div>
        )}
      </div>
    </div>
  );
}

