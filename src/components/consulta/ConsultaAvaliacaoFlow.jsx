import React, { useRef } from 'react';
import { Camera, Eye, ImageIcon, Trash2 } from 'lucide-react';

/** Fluxo modular: queixa/expectativas → fotos livres → desenho → concluir. */
export function ConsultaAvaliacaoFlow({
  queixa,
  setQueixa,
  expectativas,
  setExpectativas,
  evaluationCapturedPhotos = [],
  evaluationPhotoMax = 30,
  onEvaluationUploadFiles,
  onEvaluationRemovePhoto,
  onAnnotatePhoto,
  onConcluirAvaliacao,
  isConcluirBusy = false,
}) {
  const uploadInputRef = useRef(null);
  const photos = evaluationCapturedPhotos || [];

  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (files?.length) onEvaluationUploadFiles?.(files);
    e.target.value = '';
  };

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-app-border bg-app-nav-active p-2.5 text-app-accent shadow-sm">
          <Eye className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-app-ink">Avaliação</h3>
          <p className="text-[13px] font-medium text-[#64748b]">
            Fotos e desenho sobre as imagens
          </p>
        </div>
      </div>

      <div className="mb-8 space-y-6 rounded-2xl border border-[#00a88e]/25 bg-white p-6">
        <div>
          <h4 className="mb-1 text-[15px] font-bold text-[#0f172a]">Queixa e Expectativas</h4>
          <p className="text-[12px] font-medium text-[#64748b]">
            Mesmos campos da anamnese — editáveis aqui também
          </p>
        </div>
        <div className="space-y-2">
          <label className="ml-1 text-[13px] font-bold text-[#00a88e]" htmlFor="consulta-avaliacao-queixa">
            Queixa Principal
          </label>
          <textarea
            id="consulta-avaliacao-queixa"
            value={queixa ?? ''}
            onChange={(e) => setQueixa?.(e.target.value)}
            rows={3}
            className="w-full rounded-xl border-[2px] border-[#e2e8f0] bg-[#f8fbfb] p-3 text-[16px] font-medium outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/25 sm:text-[14px]"
            placeholder="Descreva o motivo da consulta..."
          />
        </div>
        <div className="space-y-2">
          <label className="ml-1 text-[13px] font-bold text-[#00a88e]" htmlFor="consulta-avaliacao-expectativas">
            Expectativas do Paciente
          </label>
          <textarea
            id="consulta-avaliacao-expectativas"
            value={expectativas ?? ''}
            onChange={(e) => setExpectativas?.(e.target.value)}
            rows={3}
            className="w-full rounded-xl border-[2px] border-[#e2e8f0] bg-[#f8fbfb] p-3 text-[16px] font-medium outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#00a88e]/25 sm:text-[14px]"
            placeholder="O que o paciente espera alcançar..."
          />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-[#00a88e]">Fotos da avaliação</h4>
        <span className="text-[12px] font-semibold text-[#64748b]">
          {photos.length}/{evaluationPhotoMax}
        </span>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((ph, idx) => (
          <div key={ph.url ? `${ph.url}_${idx}` : idx} className="min-w-0">
            <div className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]">
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
              {typeof onAnnotatePhoto === 'function' ? (
                <button
                  type="button"
                  onClick={() => onAnnotatePhoto(idx)}
                  className="absolute inset-0 z-[1] flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
                >
                  <span className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-[#0f172a] shadow sm:py-1.5">
                    Anotar
                  </span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onEvaluationRemovePhoto?.(idx)}
                className="absolute right-1 top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                aria-label="Remover imagem"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          className="col-span-2 flex min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-2 text-[#64748b] transition-colors active:border-[#00a88e]/50 active:bg-[#f0fdf9] active:text-[#00a88e] sm:col-span-1 sm:aspect-square sm:min-h-0 sm:hover:border-[#00a88e]/50 sm:hover:bg-[#f0fdf9] sm:hover:text-[#00a88e]"
        >
          <Camera className="h-6 w-6" strokeWidth={2} />
          <span className="px-1 text-center text-[11px] font-semibold leading-tight">Upload de imagens</span>
        </button>
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] font-medium text-[#94a3b8]">
          <ImageIcon className="h-4 w-4 shrink-0" />
          A câmera flutuante também adiciona fotos aqui.
        </p>
      ) : null}

      <div className="mt-8 flex justify-end border-t border-app-border pt-6">
        <button
          type="button"
          onClick={() => onConcluirAvaliacao?.()}
          disabled={isConcluirBusy}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConcluirBusy ? 'Salvando…' : 'Concluir Avaliação'}
        </button>
      </div>
    </div>
  );
}
