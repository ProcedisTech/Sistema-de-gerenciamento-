import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCanvasZoom } from '../../hooks/useCanvasZoom.js';
import { usePacienteGaleriaArquivoBlobUrl } from '../../hooks/usePacienteGaleriaArquivoBlobUrl.js';
import { drawLetterboxedImage } from '../../utils/canvasAnnotationDraw.js';

export function ZoomableGalleryLightbox({ url, alt = 'Preview da foto', authFetch = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const [loadedSrc, setLoadedSrc] = useState('');
  const { src: authSrc, loading: authLoading, error: authError } = usePacienteGaleriaArquivoBlobUrl(url, authFetch);
  const imageSrc = authFetch ? authSrc : url;

  const {
    scale,
    offsetX,
    offsetY,
    zoomIn,
    zoomOut,
    fitToScreen,
    canZoomIn,
    canZoomOut,
    zoomPercent,
    spaceDown,
    isPanning,
    isPinching,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useCanvasZoom(canvasRef);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);
    if (!image?.complete || !image.naturalWidth) return;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawLetterboxedImage(ctx, image, w, h, image.naturalWidth, image.naturalHeight);
    ctx.restore();
  }, [offsetX, offsetY, scale]);

  const redrawRef = useRef(redrawCanvas);
  useLayoutEffect(() => {
    redrawRef.current = redrawCanvas;
  }, [redrawCanvas]);

  useEffect(() => {
    if (!imageSrc) {
      imageRef.current = null;
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      imageRef.current = image;
      setLoadedSrc(image.src);
      fitToScreen();
      redrawRef.current();
    };
    image.onerror = () => {
      imageRef.current = null;
      setLoadedSrc('');
    };
    image.src = imageSrc;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [fitToScreen, imageSrc]);

  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      redrawRef.current();
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, loadedSrc]);

  const imageReady = Boolean(imageSrc) && loadedSrc === imageSrc;

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isPinching
      ? 'cursor-zoom-in'
      : spaceDown
        ? 'cursor-grab'
        : 'cursor-default';

  if (authError) {
    return <p className="px-4 text-center text-[14px] font-medium text-white">Não foi possível carregar a imagem.</p>;
  }

  return (
    <div className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-2">
      <div
        className="flex items-center gap-1 rounded-lg border border-white/20 bg-slate-900/90 p-1 text-white shadow-lg"
        role="group"
        aria-label="Zoom da foto"
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={!canZoomOut}
          className={`min-h-[36px] min-w-[36px] rounded px-2 text-lg font-bold ${canZoomOut ? 'hover:bg-white/10' : 'cursor-not-allowed opacity-40'}`}
          title={canZoomOut ? 'Reduzir zoom' : 'Zoom mínimo (100%)'}
        >
          −
        </button>
        <span className="min-w-[3.25rem] text-center text-[12px] font-semibold">{zoomPercent}%</span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={!canZoomIn}
          className={`min-h-[36px] min-w-[36px] rounded px-2 text-lg font-bold ${canZoomIn ? 'hover:bg-white/10' : 'cursor-not-allowed opacity-40'}`}
          title="Aumentar zoom"
        >
          +
        </button>
        <button
          type="button"
          onClick={fitToScreen}
          className="ml-1 rounded border border-white/20 px-2 py-1.5 text-[11px] font-semibold hover:bg-white/10"
          title="Voltar para 100% e centralizar"
        >
          Encaixar
        </button>
      </div>
      <div ref={containerRef} className="relative h-[78vh] w-[90vw] max-w-[90vw] overflow-hidden rounded-xl border border-white/30 bg-slate-950">
        {(authLoading || !imageReady) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-white" aria-label="Carregando" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          aria-label={alt}
          onPointerDown={(e) => {
            if (!onPointerDown(e)) {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          className={`h-full w-full touch-none ${cursorClass}`}
        />
      </div>
    </div>
  );
}
