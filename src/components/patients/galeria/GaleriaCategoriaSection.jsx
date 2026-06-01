import React, { useRef } from 'react';
import { Plus } from 'lucide-react';
import { GALERIA_CATEGORIA_LABELS } from '../../../utils/pacienteGaleria.js';
import { GaleriaArquivoImage } from '../GaleriaArquivoImage.jsx';
import {
  GALERIA_CATEGORIA_BADGE_CLASS,
  GALERIA_INLINE_PREVIEW_LIMIT,
} from './galeriaUiConstants.js';

function fotoToGridItem(foto) {
  return {
    id: `api_${foto.serverId}`,
    url: foto.url,
    fileName: foto.fileName,
    serverId: foto.serverId,
    source: 'api',
    index: -1,
  };
}

export function GaleriaCategoriaSection({
  categoria,
  fotos,
  modoComparar,
  compararSelecionadas,
  emEdicao,
  onToggleEdicao,
  onFotoClick,
  onOpenLightbox,
  onRemoveFoto,
  onUpload,
  uploadDisabled,
  uploadDisabledTitle,
}) {
  const fileInputRef = useRef(null);
  const labelText = GALERIA_CATEGORIA_LABELS[categoria] || categoria;
  const badgeClass = GALERIA_CATEGORIA_BADGE_CLASS[categoria] || GALERIA_CATEGORIA_BADGE_CLASS.outro;
  const visiveis = fotos.slice(0, GALERIA_INLINE_PREVIEW_LIMIT);
  const hiddenCount = fotos.length - GALERIA_INLINE_PREVIEW_LIMIT;
  const temMais = hiddenCount > 0;

  const handleAddClick = () => {
    if (uploadDisabled) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && onUpload) onUpload(file);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badgeClass}`}
        >
          {labelText}
          <span className="font-medium normal-case tracking-normal opacity-80">
            · {fotos.length} foto{fotos.length !== 1 ? 's' : ''}
          </span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {fotos.length > 0 ? (
            <button
              type="button"
              onClick={() => onOpenLightbox?.(0)}
              className="text-[12px] font-semibold text-[#00a88e] hover:underline"
            >
              Ver todas →
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleEdicao}
            className={`p-1.5 rounded-lg border-[2px] transition-all ${
              emEdicao
                ? 'bg-red-50 border-red-300 text-red-500'
                : 'bg-white border-[#e2e8f0] text-[#94a3b8] hover:border-[#00a88e] hover:text-[#00a88e]'
            }`}
            title={emEdicao ? 'Sair da edição' : 'Editar fotos'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {visiveis.map((foto) => {
          const gridItem = fotoToGridItem(foto);
          const selected =
            modoComparar &&
            (compararSelecionadas?.antes?.serverId === foto.serverId ||
              compararSelecionadas?.depois?.serverId === foto.serverId);
          return (
            <div key={foto.serverId} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onFotoClick?.(foto)}
                className={`aspect-square w-full rounded-xl overflow-hidden border cursor-pointer flex items-center justify-center transition-all ${
                  selected
                    ? 'border border-[#00a88e] ring-2 ring-[#00a88e]/40'
                    : 'border border-[#e2e8f0] hover:border-[#00a88e]/40'
                }`}
              >
                <GaleriaArquivoImage
                  url={foto.url}
                  alt=""
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
              </button>
              {emEdicao ? (
                <button
                  type="button"
                  onClick={() => onRemoveFoto?.(gridItem)}
                  className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-[2px] border-white bg-red-500 text-[11px] font-bold text-white shadow-sm hover:bg-red-600"
                  aria-label="Remover foto"
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}

        {temMais ? (
          <button
            type="button"
            onClick={() => onOpenLightbox?.(GALERIA_INLINE_PREVIEW_LIMIT)}
            className="aspect-square w-full rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] flex flex-col items-center justify-center text-[#64748b] hover:border-[#00a88e]/50 hover:bg-[#e6f7f5] hover:text-[#0f766e] transition-colors"
          >
            <span className="text-[18px] font-bold leading-none">+{hiddenCount}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleAddClick}
          disabled={uploadDisabled}
          title={uploadDisabled ? uploadDisabledTitle : 'Adicionar foto'}
          className="aspect-square w-full rounded-xl border-2 border-dashed border-[#cbd5e1] bg-white flex flex-col items-center justify-center gap-1 text-[#94a3b8] transition-colors hover:border-[#00a88e]/50 hover:bg-[#f8fbfb] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          <span className="text-[10px] font-semibold">Adicionar</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />
    </div>
  );
}
