import React from 'react';
import { Camera, Trash2, ImageIcon } from 'lucide-react';
import { GALERIA_CATEGORIA_LABELS, GALERIA_CATEGORIA } from '../../utils/pacienteGaleria.js';

const STEP4_FOTO_OVERLAY_BADGE = {
  [GALERIA_CATEGORIA.ANTES]: 'bg-[#f59e0b]',
  [GALERIA_CATEGORIA.MAPA]: 'bg-[#a855f7]',
  [GALERIA_CATEGORIA.DEPOIS]: 'bg-[#22c55e]',
};

const getUIAlias = (cat) => {
  return GALERIA_CATEGORIA_LABELS[cat] || GALERIA_CATEGORIA_LABELS.antes;
};

export function PhotoCarouselLane({
  title,
  category,
  items = [],
  legendas,
  setLegendas,
  onUpload,
  onRemove,
  onAnnotate,
  showUpload = true,
  emptyHint = 'Nenhuma foto adicionada nesta categoria.',
}) {
  return (
    <div className="mb-4 flex flex-col gap-2">
      {title && (
        <h4 className="text-[13px] font-bold text-[#00a88e]">{title}</h4>
      )}

      <div className="flex flex-row overflow-x-auto flex-nowrap gap-3 pb-2 scroll-smooth overscroll-x-contain scrollbar-thin scrollbar-thumb-[#cbd5e1] scrollbar-track-transparent">
        
        {items.map(({ photo, originalIndex }) => (
          <div key={photo.url || originalIndex} className="w-32 shrink-0 flex flex-col gap-1">
            <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]">
              <div
                className={`absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                  STEP4_FOTO_OVERLAY_BADGE[photo.meta?.categoria] || STEP4_FOTO_OVERLAY_BADGE[GALERIA_CATEGORIA.ANTES]
                }`}
              >
                {getUIAlias(photo.meta?.categoria)}
              </div>
              
              <img src={photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              
              {typeof onAnnotate === 'function' && (
                <button
                  type="button"
                  onClick={() => onAnnotate(originalIndex)}
                  className="absolute inset-0 z-[1] flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
                >
                  <span className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-[#0f172a] shadow sm:py-1.5">
                    Anotar
                  </span>
                </button>
              )}
              
              {typeof onRemove === 'function' && (
                <button
                  type="button"
                  onClick={() => onRemove(originalIndex)}
                  className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                  aria-label="Remover imagem"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
            
            <input
              type="text"
              value={legendas[photo.url] ?? ''}
              onChange={(e) =>
                setLegendas((prev) => ({ ...prev, [photo.url]: e.target.value }))
              }
              placeholder="Ex: Detalhe..."
              className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1 text-[11px] text-[#0f172a] outline-none placeholder:text-[#cbd5e1] focus:border-[#00a88e]"
            />
          </div>
        ))}

        {showUpload && (
          <button
            type="button"
            onPointerDown={() => typeof onUpload === 'function' && onUpload(null, category, true)}
            onFocus={() => typeof onUpload === 'function' && onUpload(null, category, true)}
            onClick={() => typeof onUpload === 'function' && onUpload(null, category, false)}
            className="w-32 shrink-0 aspect-square flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafafa] px-2 py-2 text-[#64748b] transition-colors active:border-[#00a88e]/50 active:bg-[#f0fdf9] active:text-[#00a88e] sm:hover:border-[#00a88e]/50 sm:hover:bg-[#f0fdf9] sm:hover:text-[#00a88e]"
          >
            <Camera className="h-6 w-6" strokeWidth={2} />
            <span className="px-1 text-center text-[10px] font-semibold leading-tight mt-1">Adicionar foto</span>
          </button>
        )}

        {items.length === 0 && !showUpload && (
          <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc] p-2 text-center">
             <ImageIcon className="h-6 w-6 text-[#cbd5e1]" strokeWidth={1.5} />
             <span className="text-[10px] font-medium text-[#94a3b8]">{emptyHint}</span>
          </div>
        )}
      </div>
    </div>
  );
}
