import React, { useRef } from 'react';
import { Camera, ImageIcon, RotateCcw, Trash2 } from 'lucide-react';

const SATISFACAO_OPTS = [1, 2, 3, 4, 5];
const SIMETRIA_OPTS = [
  { value: 'sim', label: 'Simétrico' },
  { value: 'leve', label: 'Assimetria leve' },
  { value: 'moderada', label: 'Assimetria moderada' },
  { value: 'na', label: 'N/A' },
];
const DOR_OPTS = [
  { value: 0, label: 'Sem dor' },
  { value: 3, label: 'Leve' },
  { value: 6, label: 'Moderada' },
  { value: 9, label: 'Intensa' },
];

/** Fluxo de retorno: avaliação + foto resultado + toggle retoque (sem mapa). */
export function ConsultaRetornoFlow({
  retornoAvaliacao = {},
  setRetornoAvaliacao,
  houveRetoque = false,
  setHouveRetoque,
  evaluationCapturedPhotos = [],
  evaluationPhotoMax = 30,
  onEvaluationUploadFiles,
  onEvaluationRemovePhoto,
  onConcluirRetorno,
  isConcluirBusy = false,
}) {
  const uploadInputRef = useRef(null);
  const photos = evaluationCapturedPhotos || [];
  const av = retornoAvaliacao || {};

  const patchAvaliacao = (patch) => {
    setRetornoAvaliacao?.((prev) => ({ ...(prev || {}), ...patch }));
  };

  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (files?.length) onEvaluationUploadFiles?.(files);
    e.target.value = '';
  };

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-app-border bg-app-nav-active p-2.5 text-app-accent shadow-sm">
          <RotateCcw className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-app-ink">Retorno</h3>
          <p className="text-[13px] font-medium text-[#64748b]">
            Avaliação do resultado, foto e registro de retoque
          </p>
        </div>
      </div>

      <div className="mb-8 space-y-6 rounded-2xl border border-[#00a88e]/25 bg-white p-6">
        <div>
          <h4 className="mb-3 text-[15px] font-bold text-[#0f172a]">Avaliação</h4>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Satisfação (1–5)</p>
              <div className="flex flex-wrap gap-2">
                {SATISFACAO_OPTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchAvaliacao({ satisfacao: n })}
                    className={`min-h-[40px] min-w-[40px] rounded-full px-3 text-[14px] font-bold transition-colors ${
                      av.satisfacao === n
                        ? 'bg-[#00a88e] text-white shadow-sm'
                        : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Simetria</p>
              <div className="flex flex-wrap gap-2">
                {SIMETRIA_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patchAvaliacao({ simetria: opt.value })}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      av.simetria === opt.value
                        ? 'bg-[#00a88e] text-white'
                        : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold text-[#00a88e]">Dor</p>
              <div className="flex flex-wrap gap-2">
                {DOR_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patchAvaliacao({ dor: opt.value })}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      av.dor === opt.value
                        ? 'bg-[#00a88e] text-white'
                        : 'border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] hover:border-[#00a88e]/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-[#0f172a]">Houve retoque nesta visita?</p>
            <p className="text-[12px] text-[#64748b]">Marque Sim se foi realizado procedimento corretivo</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={houveRetoque}
            onClick={() => setHouveRetoque?.(!houveRetoque)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              houveRetoque ? 'bg-[#00a88e]' : 'bg-[#cbd5e1]'
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                houveRetoque ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[13px] font-bold text-[#00a88e]">Foto do resultado</h4>
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
          Registre fotos do resultado final deste retorno.
        </p>
      ) : null}

      <div className="mt-8 flex justify-end border-t border-app-border pt-6">
        <button
          type="button"
          onClick={() => onConcluirRetorno?.()}
          disabled={isConcluirBusy}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isConcluirBusy ? 'Salvando…' : 'Concluir Retorno'}
        </button>
      </div>
    </div>
  );
}
