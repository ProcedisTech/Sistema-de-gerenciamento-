import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { GaleriaArquivoImage } from './GaleriaArquivoImage.jsx';
import { ZoomableGalleryLightbox } from './ZoomableGalleryLightbox.jsx';
import { GALERIA_CATEGORIA_BADGE_CLASS } from '../../utils/pacienteGaleria.js';

function resolveInitialDetailIndex(lightbox, total) {
  if (lightbox.openInGrid) return null;
  const idx = lightbox.initialIndex ?? 0;
  return idx >= 0 && idx < total ? idx : 0;
}

function GaleriaCategoryLightboxContent({ lightbox, onClose, categoriaKey }) {
  const fotos = lightbox?.fotos || [];
  const total = fotos.length;
  const [detailIndex, setDetailIndex] = useState(() => resolveInitialDetailIndex(lightbox, total));

  const closeAll = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const goPrev = useCallback(() => {
    setDetailIndex((i) => (i != null && i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setDetailIndex((i) => (i != null && i < total - 1 ? i + 1 : i));
  }, [total]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (detailIndex != null) {
          setDetailIndex(null);
        } else {
          closeAll();
        }
      } else if (detailIndex != null && e.key === 'ArrowLeft') {
        goPrev();
      } else if (detailIndex != null && e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailIndex, closeAll, goPrev, goNext]);

  const badgeClass =
    GALERIA_CATEGORIA_BADGE_CLASS[categoriaKey] || GALERIA_CATEGORIA_BADGE_CLASS.outro;
  const activeFoto = detailIndex != null ? fotos[detailIndex] : null;
  const activeUrl = activeFoto?.url ?? activeFoto?.src ?? activeFoto?.presignedUrl ?? '';

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={lightbox.categoriaLabel || 'Galeria'}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold ${badgeClass}`}
        >
          {lightbox.categoriaLabel} · {total} foto{total !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={closeAll}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>

      {detailIndex != null && activeUrl ? (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
          <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
            <button
              type="button"
              onClick={goPrev}
              disabled={detailIndex <= 0}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
          <div className="absolute right-4 top-1/2 z-10 -translate-y-1/2">
            <button
              type="button"
              onClick={goNext}
              disabled={detailIndex >= total - 1}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
          <p className="mb-2 text-[13px] font-semibold text-white/80">
            {detailIndex + 1} / {total}
          </p>
          <ZoomableGalleryLightbox url={activeUrl} alt={activeFoto?.fileName || 'Foto'} authFetch />
          <button
            type="button"
            onClick={() => setDetailIndex(null)}
            className="mt-3 text-[13px] font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Ver grade
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-4xl grid-cols-4 gap-2">
            {fotos.map((foto, idx) => (
              <button
                key={foto.serverId || idx}
                type="button"
                onClick={() => setDetailIndex(idx)}
                className="aspect-square overflow-hidden rounded-xl border border-white/20 transition-transform hover:scale-[1.02] hover:border-white/40"
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

export function GaleriaCategoryLightbox({ lightbox, onClose, categoriaKey }) {
  const fotos = lightbox?.fotos || [];
  if (!lightbox || fotos.length === 0) return null;

  const remountKey = `${lightbox.sessKey}_${lightbox.categoria}_${lightbox.openInGrid ? 'grid' : 'detail'}_${lightbox.initialIndex ?? 0}`;

  return (
    <GaleriaCategoryLightboxContent
      key={remountKey}
      lightbox={lightbox}
      onClose={onClose}
      categoriaKey={categoriaKey}
    />
  );
}
