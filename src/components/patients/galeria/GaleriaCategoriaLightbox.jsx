import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GaleriaArquivoImage } from '../GaleriaArquivoImage.jsx';
import { ZoomableGalleryLightbox } from '../ZoomableGalleryLightbox.jsx';

export function GaleriaCategoriaLightbox({ open, fotos, categoriaLabel, onClose }) {
  const [zoomIndex, setZoomIndex] = useState(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (!open) return;
      if (e.key === 'Escape') {
        if (zoomIndex != null && fotos?.length) {
          setZoomIndex(null);
        } else {
          onClose?.();
        }
      }
    },
    [open, zoomIndex, fotos?.length, onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open || !fotos?.length) return null;

  const inZoom = zoomIndex != null && zoomIndex >= 0 && zoomIndex < fotos.length;
  const currentFoto = inZoom ? fotos[zoomIndex] : null;

  const goPrev = () => setZoomIndex((i) => (i > 0 ? i - 1 : fotos.length - 1));
  const goNext = () => setZoomIndex((i) => (i < fotos.length - 1 ? i + 1 : 0));

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={categoriaLabel ? `Fotos: ${categoriaLabel}` : 'Galeria de fotos'}
      onClick={() => (inZoom ? setZoomIndex(null) : onClose?.())}
    >
      <div
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-white">{categoriaLabel}</h3>
          <p className="text-[12px] font-medium text-white/60">
            {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
            {inZoom ? ` · ${zoomIndex + 1} de ${fotos.length}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (inZoom ? setZoomIndex(null) : onClose?.())}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label={inZoom ? 'Voltar ao grid' : 'Fechar'}
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {inZoom && currentFoto ? (
        <div className="relative mx-auto flex min-h-0 flex-1 flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {fotos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:-left-12"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:-right-12"
                aria-label="Próxima foto"
              >
                <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </>
          ) : null}
          <ZoomableGalleryLightbox
            url={currentFoto.url ?? currentFoto.src ?? currentFoto.presignedUrl}
            alt={currentFoto.fileName || categoriaLabel || 'Foto'}
            authFetch
          />
          <button
            type="button"
            onClick={() => setZoomIndex(null)}
            className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/10"
          >
            Voltar ao grid
          </button>
        </div>
      ) : (
        <div
          className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-4 gap-2 pb-4">
            {fotos.map((foto, idx) => (
              <button
                key={foto.serverId ?? idx}
                type="button"
                onClick={() => setZoomIndex(idx)}
                className="aspect-square overflow-hidden rounded-xl border border-white/20 bg-slate-900 transition hover:border-white/40"
              >
                <GaleriaArquivoImage
                  url={foto.url}
                  alt=""
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
