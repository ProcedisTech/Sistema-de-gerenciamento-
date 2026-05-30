import React, { useRef } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { GaleriaArquivoImage } from './GaleriaArquivoImage.jsx';
import {
  GALERIA_CATEGORIA_BADGE_CLASS,
  GALERIA_CATEGORIA_LABELS,
} from '../../utils/pacienteGaleria.js';

const PREVIEW_LIMIT = 4;

export function GaleriaCategoryRow({
  sessKey: _sessKey,
  categoria,
  fotosCat,
  modoComparar,
  compararSelecionadas,
  editMode,
  onToggleEdit,
  onFotoClick,
  onOpenLightbox,
  onUpload,
  canUpload,
  onRemoveFoto,
}) {
  const inputRef = useRef(null);
  const labelText = GALERIA_CATEGORIA_LABELS[categoria] || categoria;
  const badgeClass =
    GALERIA_CATEGORIA_BADGE_CLASS[categoria] || GALERIA_CATEGORIA_BADGE_CLASS.outro;
  const previewFotos = fotosCat.slice(0, PREVIEW_LIMIT);
  const hiddenCount = fotosCat.length - PREVIEW_LIMIT;

  const handleAddClick = () => {
    if (!canUpload) return;
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      String(f.type || '').startsWith('image/'),
    );
    e.target.value = '';
    if (files.length) onUpload?.(files);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 bg-[#f8fafc] px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}
        >
          {labelText} · {fotosCat.length} foto{fotosCat.length !== 1 ? 's' : ''}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {fotosCat.length > 0 ? (
            <button
              type="button"
              onClick={() => onOpenLightbox?.({ openInGrid: true, initialIndex: 0 })}
              className="text-[12px] font-semibold text-[#00a88e] transition-colors hover:text-[#0f766e] hover:underline"
            >
              Ver todas →
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleEdit}
            className={`rounded-lg border-[2px] p-1.5 transition-all ${
              editMode
                ? 'border-red-300 bg-red-50 text-red-500'
                : 'border-[#e2e8f0] bg-white text-[#94a3b8] hover:border-[#00a88e] hover:text-[#00a88e]'
            }`}
            title={editMode ? 'Sair da edição' : 'Editar fotos'}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-4 gap-2">
          {previewFotos.map((foto, idx) => {
            const gridItem = {
              id: `api_${foto.serverId}`,
              url: foto.url,
              fileName: foto.fileName,
              serverId: foto.serverId,
              source: 'api',
              index: -1,
            };
            const selected =
              modoComparar &&
              (compararSelecionadas.antes?.serverId === foto.serverId ||
                compararSelecionadas.depois?.serverId === foto.serverId);

            return (
              <div key={foto.serverId} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => onFotoClick?.(foto, idx)}
                  className={`flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border transition-all ${
                    selected
                      ? 'border-[#00a88e] ring-2 ring-[#00a88e]/40'
                      : 'border-[#e2e8f0]'
                  }`}
                >
                  <GaleriaArquivoImage
                    url={foto.url}
                    alt=""
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                </button>
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => onRemoveFoto?.(gridItem)}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-[2px] border-white bg-red-500 text-[11px] font-bold text-white shadow-sm hover:bg-red-600"
                    aria-label="Remover foto"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => onOpenLightbox?.({ openInGrid: false, initialIndex: PREVIEW_LIMIT })}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] text-[#64748b] transition-colors hover:border-[#00a88e]/40 hover:bg-[#e6f7f5] hover:text-[#0f766e]"
            >
              <span className="text-[18px] font-bold">+{hiddenCount}</span>
            </button>
          ) : null}

          {canUpload ? (
            <>
              <button
                type="button"
                onClick={handleAddClick}
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white text-[#94a3b8] transition-colors hover:border-[#00a88e]/50 hover:bg-[#f8fafc] hover:text-[#00a88e]"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                <span className="text-[11px] font-semibold">Adicionar</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
                aria-label={`Adicionar foto em ${labelText}`}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
