import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCanvasZoom } from '../../hooks/useCanvasZoom.js';
import { getLetterboxLayout } from '../../utils/canvasAnnotationDraw.js';

const EMPTY_LAYOUT = { drawW: 0, drawH: 0, dx: 0, dy: 0 };

/** Fullscreen com zoom/pan via CSS transform; `url` presigned direta no `<img>` (como o grid). */
export function ZoomableGalleryLightbox({ url, alt = 'Preview da foto', authFetch = false }) {
  void authFetch;

  const containerRef = useRef(null);
  const imgRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const imageSrc = typeof url === 'string' ? url.trim() : '';
  const [loadedSrc, setLoadedSrc] = useState('');
  const [errorSrc, setErrorSrc] = useState('');
  const [layout, setLayout] = useState(EMPTY_LAYOUT);

  const imageReady = Boolean(imageSrc) && loadedSrc === imageSrc;
  const imageError = Boolean(imageSrc) && errorSrc === imageSrc;

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
  } = useCanvasZoom(containerRef);

  const syncLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img?.naturalWidth) return;
    const { width, height } = container.getBoundingClientRect();
    setLayout(getLetterboxLayout(width, height, img.naturalWidth, img.naturalHeight));
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    syncLayout();
    const ro = new ResizeObserver(syncLayout);
    ro.observe(container);
    return () => ro.disconnect();
  }, [syncLayout, imageSrc]);

  const handleImgLoad = useCallback(() => {
    setLoadedSrc(imageSrc);
    setErrorSrc('');
    fitToScreen();
    syncLayout();
  }, [fitToScreen, imageSrc, syncLayout]);

  const handleImgError = useCallback(() => {
    setLoadedSrc('');
    setErrorSrc(imageSrc);
  }, [imageSrc]);

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isPinching
      ? 'cursor-zoom-in'
      : spaceDown
        ? 'cursor-grab'
        : 'cursor-default';

  if (!imageSrc) {
    return <p className="px-4 text-center text-[14px] font-medium text-white">Não foi possível carregar a imagem.</p>;
  }

  if (imageError) {
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
      <div
        ref={containerRef}
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
        className={`relative h-[78vh] w-[90vw] max-w-[90vw] overflow-hidden rounded-xl border border-white/30 bg-slate-950 touch-none ${cursorClass}`}
      >
        {(!imageReady || !layout.drawW) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-white" aria-label="Carregando" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            draggable={false}
            className="absolute pointer-events-none select-none"
            style={{
              left: layout.dx,
              top: layout.dy,
              width: layout.drawW,
              height: layout.drawH,
            }}
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
        </div>
      </div>
    </div>
  );
}
