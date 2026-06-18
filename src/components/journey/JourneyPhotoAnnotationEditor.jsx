import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../contexts/useToast.js';
import { CanvasZoomProvider } from '../../contexts/CanvasZoomContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useCanvasZoom } from '../../hooks/useCanvasZoom.js';
import { drawAnnotationPaths, drawLetterboxedImage } from '../../utils/canvasAnnotationDraw.js';
import { contentToLocalScreen, toCanvasCoordsFromEvent } from '../../utils/canvasZoomCoords.js';
import { formatPacienteGaleriaError } from '../../utils/pacienteGaleria.js';

const colors = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

/**
 * Editor fullscreen de anotação (canvas sobre imagem), compartilhado entre
 * avaliação, procedimento e resumo da finalização.
 */
export function JourneyPhotoAnnotationEditor({
  sidebarInsetPx = 220,
  photos = [],
  editingIndex,
  setEditingIndex,
  fallbackSelectedPhotoIndex = null,
  saveListLength,
  imageSrc,
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  pointSize,
  setPointSize,
  showPointNumbers,
  setShowPointNumbers,
  eraserSize,
  setEraserSize,
  cursorPos,
  setCursorPos,
  isHoveringCanvas,
  setIsHoveringCanvas,
  paths,
  setPaths,
  isDrawing,
  setIsDrawing,
  canvasRef,
  containerRef,
  evaluationAnnotatedPhotoUrl,
  setEvaluationAnnotatedPhotoUrl,
  selectedPatientCpf = '',
  cpf = '',
  setPatients,
  onSelectCapturedPhoto,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  onClose,
  onAfterSaveAnnotated,
}) {
  const toast = useToast();
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const isDrawingRef = useRef(false);
  const baseImageRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const [imageEpoch, setImageEpoch] = useState(0);

  useLayoutEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  const {
    scale,
    offsetX,
    offsetY,
    resetView,
    fitToScreen,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    zoomPercent,
    spaceDown,
    isPanning,
    isPinching,
    onPointerDown: onPanPointerDown,
    onPointerMove: onPanPointerMove,
    onPointerUp: onPanPointerUp,
  } = useCanvasZoom(canvasRef);

  const listLen = typeof saveListLength === 'number' ? saveListLength : photos?.length ?? 0;

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const im = baseImageRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    if (!im?.complete || !im.naturalWidth) return;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawLetterboxedImage(ctx, im, w, h, im.naturalWidth, im.naturalHeight);
    drawAnnotationPaths(ctx, paths, { showPointNumbers, viewScale: scale });
    ctx.restore();
  }, [canvasRef, offsetX, offsetY, scale, paths, showPointNumbers]);

  const redrawRef = useRef(redrawCanvas);
  useLayoutEffect(() => {
    redrawRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    if (!imageSrc) {
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
    im.src = imageSrc;
    return () => {
      im.onload = null;
      im.onerror = null;
    };
  }, [imageSrc]);

  useEffect(() => {
    resetView();
  }, [editingIndex, imageSrc, resetView]);

  useEffect(() => {
    if (!imageSrc || !canvasRef.current || !containerRef.current) return undefined;
    const updateCanvasSize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      redrawRef.current();
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [imageSrc, imageEpoch, canvasRef, containerRef]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, imageEpoch]);

  const saveAnnotatedPhoto = async () => {
    if (!imageSrc) return;
    if (!canvasRef.current) return;
    if (!paths || paths.length === 0) {
      toast.warning('Desenhe algo no canvas antes de salvar.');
      return;
    }

    redrawRef.current();
    const blob = await new Promise((resolve) => {
      try {
        canvasRef.current.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
      } catch {
        resolve(null);
      }
    });
    if (!blob) {
      toast.error('Não foi possível exportar a imagem.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const idx = typeof editingIndex === 'number' ? editingIndex : fallbackSelectedPhotoIndex;
    const hasSlot =
      typeof idx === 'number' && idx >= 0 && idx < listLen && typeof onAnnotatedCaptureSaved === 'function';

    if (hasSlot) {
      onAnnotatedCaptureSaved({ index: idx, newUrl: url, blob });
    } else if (evaluationAnnotatedPhotoUrl) {
      try {
        URL.revokeObjectURL(evaluationAnnotatedPhotoUrl);
      } catch {
        // ignore
      }
    }
    setEvaluationAnnotatedPhotoUrl(url);

    const targetCpf = (selectedPatientCpf || cpf || '').trim();
    if (targetCpf && !hasSlot && typeof setPatients === 'function') {
      setPatients((prev) =>
        prev.map((p) =>
          (p.cpf || '').trim() !== targetCpf ? p : { ...p, evaluationAnnotatedPhotoUrl: url }
        )
      );
    }

    let uploadedToServer = false;
    if (typeof persistAnnotatedPhotoToGallery === 'function') {
      try {
        const r = await persistAnnotatedPhotoToGallery(blob);
        if (r?.ok) uploadedToServer = true;
        else if (r?.reason === 'no_server_id') {
          toast.info(
            'Paciente sem ID no servidor: a foto anotada ficou só neste aparelho. Após cadastrar, envie pela galeria do perfil ou salve de novo aqui.'
          );
        }
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      }
    }

    toast.success(
      uploadedToServer
        ? 'Foto anotada salva na ficha e enviada à galeria no servidor.'
        : 'Foto anotada salva na ficha do paciente.'
    );

    onAfterSaveAnnotated?.();
  };

  const getContentPoint = (event) => {
    const c = canvasRef.current;
    if (!c) return null;
    return toCanvasCoordsFromEvent(event, c, offsetX, offsetY, scale);
  };

  const releaseCanvasPointerCapture = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const startDrawing = (e) => {
    if (e.button != null && e.button !== 0) return;
    if (onPanPointerDown(e)) {
      setIsDrawing(false);
      return;
    }
    const p = getContentPoint(e);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      canvasRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setIsDrawing(true);
    if (activeTool === 'point') {
      setPaths((prev) => [
        ...prev,
        { tool: 'point', points: [{ x: p.x, y: p.y }], color: activeColor, size: pointSize, width: 3 },
      ]);
    } else {
      setPaths((prev) => [
        ...prev,
        {
          tool: activeTool,
          points: [{ x: p.x, y: p.y }],
          color: activeColor,
          width: activeTool === 'erase' ? eraserSize : 3,
        },
      ]);
    }
  };

  const handlePointerMove = (e) => {
    if (onPanPointerMove(e)) {
      if (e.buttons === 0) setIsDrawing(false);
      return;
    }
    const p = getContentPoint(e);
    if (!p) return;
    setCursorPos(contentToLocalScreen(p.x, p.y, offsetX, offsetY, scale));
    if (!isDrawingRef.current) return;
    if (activeTool === 'point') return;
    e.preventDefault();
    e.stopPropagation();
    setPaths((prev) => {
      const newPaths = [...prev];
      if (newPaths.length > 0) {
        const lastPath = newPaths[newPaths.length - 1];
        lastPath.points.push({ x: p.x, y: p.y });
      }
      return newPaths;
    });
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    releaseCanvasPointerCapture(e);
    onPanPointerUp(e);
    setIsDrawing(false);
  };

  const handleLostPointerCapture = (e) => {
    releaseCanvasPointerCapture(e);
    setIsDrawing(false);
  };

  const handlePointerLeave = () => {
    setIsHoveringCanvas(false);
  };

  const handlePointerEnter = () => {
    setIsHoveringCanvas(true);
  };

  const hasPhoto = editingIndex != null && Boolean(photos[editingIndex]);
  const otherIndices = useMemo(
    () =>
      editingIndex == null || !photos[editingIndex] ? [] : photos.map((_, i) => i).filter((i) => i !== editingIndex),
    [editingIndex, photos]
  );

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isPinching
      ? 'cursor-zoom-in'
      : spaceDown
      ? 'cursor-grab'
      : activeTool === 'erase' || activeTool === 'point'
        ? 'cursor-none'
        : 'cursor-crosshair';

  const canvasZoomValue = useMemo(
    () => ({
      scale,
      offsetX,
      offsetY,
      zoomPercent,
      canZoomIn,
      canZoomOut,
      zoomIn,
      zoomOut,
      fitToScreen,
    }),
    [canZoomIn, canZoomOut, fitToScreen, offsetX, offsetY, scale, zoomIn, zoomOut, zoomPercent]
  );

  if (!hasPhoto) return null;

  return (
    <CanvasZoomProvider value={canvasZoomValue}>
      <div
        className="fixed inset-0 z-[140] flex min-w-0 flex-col overflow-x-hidden bg-[#0f172a]"
        style={{ left: isMdUp ? sidebarInsetPx : 0 }}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-700 bg-[#1e293b] px-3 py-2 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {(['draw', 'point', 'erase']).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTool(t)}
                className={`flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-[12px] font-semibold transition-colors lg:min-h-0 ${
                  activeTool === t ? 'bg-white text-[#1e293b]' : 'text-slate-300 active:text-white lg:hover:text-white'
                }`}
              >
                {t === 'draw' ? 'Desenhar' : t === 'point' ? 'Ponto' : 'Apagar'}
              </button>
            ))}
            <span className="hidden h-4 w-px shrink-0 bg-slate-500 sm:block" aria-hidden />
            <div
              className="flex min-h-[40px] min-w-0 items-center gap-0.5 rounded-md border border-slate-500/50 bg-slate-800/80 p-0.5"
              role="group"
              aria-label="Zoom do canvas"
            >
              <button
                type="button"
                onClick={zoomOut}
                disabled={!canZoomOut}
                className={`min-h-[40px] min-w-[40px] rounded px-1 text-lg font-bold leading-none text-white transition-opacity lg:min-h-0 lg:min-w-0 lg:px-2 ${
                  canZoomOut ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'
                }`}
                title={canZoomOut ? 'Reduzir zoom' : 'Zoom mínimo (100%)'}
              >
                −
              </button>
              <span className="min-w-[3.25rem] text-center text-[12px] font-semibold text-slate-200">
                {zoomPercent}%
              </span>
              <button
                type="button"
                onClick={zoomIn}
                disabled={!canZoomIn}
                className={`min-h-[40px] min-w-[40px] rounded px-1 text-lg font-bold leading-none text-white transition-opacity lg:min-h-0 lg:min-w-0 lg:px-2 ${
                  canZoomIn ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'
                }`}
                title="Aumentar zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={fitToScreen}
                className="ml-0.5 rounded border border-slate-500/60 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700/80"
                title="Encaixar (100% e central). Roda: zoom. Meio do mouse ou Espaço+arrastar: mover"
              >
                Encaixar
              </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {colors.slice(0, 12).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setActiveColor(color);
                    setActiveTool(activeTool === 'erase' ? 'draw' : activeTool);
                  }}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 outline-none lg:h-7 lg:w-7 ${
                    activeColor === color && activeTool !== 'erase'
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b]'
                      : ''
                  }`}
                  aria-label={`Cor ${color}`}
                >
                  <span
                    className="h-5 w-5 rounded-full sm:h-5 sm:w-5"
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(activeTool === 'point' || activeTool === 'erase') && (
              <input
                type="range"
                min={activeTool === 'point' ? '3' : '5'}
                max={activeTool === 'point' ? '40' : '100'}
                value={activeTool === 'point' ? pointSize : eraserSize}
                onChange={(e) =>
                  activeTool === 'point'
                    ? setPointSize(parseInt(e.target.value, 10))
                    : setEraserSize(parseInt(e.target.value, 10))
                }
                className="max-w-full min-w-[120px] flex-1 shrink-0 accent-white sm:max-w-[140px]"
              />
            )}
            {activeTool === 'point' && (
              <button
                type="button"
                onClick={() => setShowPointNumbers(!showPointNumbers)}
                className={`flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-[12px] font-semibold lg:min-h-0 lg:px-2 ${
                  showPointNumbers ? 'bg-white/20 text-white' : 'text-slate-300 active:text-white lg:hover:text-white'
                }`}
              >
                Nº
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaths((prev) => prev.slice(0, -1))}
              className="min-h-[44px] rounded-md px-2 text-[12px] font-medium text-slate-300 active:text-white lg:min-h-0 lg:hover:text-white"
            >
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => setPaths([])}
              className="min-h-[44px] rounded-md px-2 text-[12px] font-medium text-slate-300 active:text-white lg:min-h-0 lg:hover:text-white"
            >
              Limpar
            </button>
            <span className="ml-auto shrink-0 text-[12px] text-slate-400">
              Foto {editingIndex + 1} de {photos.length}
            </span>
          </div>
        </div>

        <div className="relative flex-1 min-h-[45dvh] overflow-hidden sm:min-h-0">
          <div className="relative h-full min-h-[50vh] w-full" ref={containerRef}>
            <canvas
              ref={canvasRef}
              onPointerDown={startDrawing}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerEnter={handlePointerEnter}
              onLostPointerCapture={handleLostPointerCapture}
              className={`absolute inset-0 h-full w-full touch-none ${cursorClass}`}
              style={{ zIndex: 10 }}
            />
            {isHoveringCanvas && (activeTool === 'erase' || activeTool === 'point') && (
              <div
                className="pointer-events-none absolute z-20 rounded-full shadow-sm"
                style={{
                  width: activeTool === 'erase' ? eraserSize : pointSize * 2,
                  height: activeTool === 'erase' ? eraserSize : pointSize * 2,
                  left: cursorPos.x - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                  top: cursorPos.y - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                  border: `2px solid ${activeTool === 'erase' ? 'rgba(255,255,255,0.8)' : activeColor}`,
                  backgroundColor: activeTool === 'erase' ? 'rgba(255,255,255,0.25)' : `${activeColor}55`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex min-w-0 shrink-0 flex-col gap-3 overflow-x-hidden border-t border-[#e2e8f0] bg-white px-3 py-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-4 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f] sm:w-auto sm:px-6 lg:min-h-0"
          >
            ← Voltar para fotos
          </button>
          <div className="min-w-0 w-full max-w-full flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:max-w-none">
            <div className="flex max-h-36 flex-wrap content-start justify-center gap-2 overflow-y-auto pb-0.5">
              {otherIndices.map((i) => {
                const ph = photos[i];
                const ann = ph?.meta?.annotated === true;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setEditingIndex(i);
                      onSelectCapturedPhoto?.(i);
                      setPaths([]);
                    }}
                    className={`relative h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 overflow-hidden rounded-lg border-2 lg:min-h-0 lg:min-w-0 ${
                      i === editingIndex ? 'border-[#00a88e]' : 'border-[#e2e8f0]'
                    }`}
                  >
                    <img src={ph?.url} alt="" className="h-full w-full object-cover" />
                    {ann ? (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-emerald-600 px-1 text-[9px] font-bold text-white">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={saveAnnotatedPhoto}
            disabled={!paths || paths.length === 0}
            className={`min-h-[48px] w-full flex-shrink-0 rounded-lg px-4 text-[14px] font-semibold transition-colors sm:min-h-[44px] sm:w-auto ${
              paths && paths.length > 0
                ? 'bg-[#00a88e] text-white active:bg-[#00967f] sm:hover:bg-[#00967f]'
                : 'cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]'
            }`}
          >
            Salvar anotação
          </button>
        </div>
      </div>
    </CanvasZoomProvider>
  );
}
