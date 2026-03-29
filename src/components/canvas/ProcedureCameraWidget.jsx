import React from 'react';
import { Camera, X } from 'lucide-react';

export function ProcedureCameraWidget({
  visible,
  photoThumbUrl,
  photoModalOpen,
  openPhotoModal,
  closePhotoModal,
  videoRef,
  videoReady,
  isCameraStarting,
  photoPreviewUrl,
  photoPreviewBlob,
  cameraError,
  capturePhoto,
  retakePhoto,
  confirmPhoto,
}) {
  if (!visible) return null;

  return (
    <>
      <div className="fixed right-4 bottom-[122px] md:right-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[55] flex flex-col items-end gap-3">
        {photoThumbUrl && (
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-[3px] border-[#00a88e]/25 bg-white shadow-sm">
            <img
              src={photoThumbUrl}
              alt="Foto do procedimento"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <button
          type="button"
          onClick={openPhotoModal}
          className="w-16 h-16 rounded-full bg-[#ef4444] hover:bg-[#dc2626] transition-all shadow-lg flex items-center justify-center border-[3px] border-red-200"
          aria-label="Tirar foto durante o procedimento"
        >
          <Camera className="w-7 h-7 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {photoModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onMouseDown={closePhotoModal}>
          <div className="absolute inset-0 bg-black/60" onClick={closePhotoModal} />

          <div
            className="relative w-full max-w-[900px] bg-white rounded-2xl border-[3px] border-[#00a88e]/25 shadow-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b-[3px] border-[#00a88e]/15">
              <div className="flex items-center gap-3">
                <div className="bg-[#e6f7f5] p-2 rounded-xl border-[3px] border-[#00a88e]/25">
                  <Camera className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[#0f172a]">Foto ao vivo</h4>
                  <p className="text-[12px] font-medium text-[#64748b]">
                    Capture durante o procedimento e confirme.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closePhotoModal}
                className="w-10 h-10 rounded-xl hover:bg-[#f8fbfb] border-[3px] border-transparent text-[#94a3b8] hover:text-[#00a88e] transition-all flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-4">
              <div className="relative rounded-[20px] overflow-hidden border-[3px] border-[#00a88e]/15 bg-[#f8fbfb]">
                <video
                  ref={videoRef}
                  playsInline
                  className="w-full max-h-[70vh] object-contain bg-black"
                />

                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
                    alt="Previa da foto"
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                )}

                {!videoReady && !photoPreviewUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="text-white text-[14px] font-bold">
                      {isCameraStarting ? 'Abrindo camera...' : 'Carregando...'}
                    </div>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="mt-3 bg-red-50 text-red-600 border-[3px] border-red-200 rounded-xl p-3 text-[13px] font-bold">
                  {cameraError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                {!photoPreviewUrl ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!videoReady || isCameraStarting}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-white bg-[#00a88e] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00967f] transition-all border-[3px] border-transparent shadow-md"
                  >
                    Capturar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[#0f172a] bg-white hover:bg-[#f8fbfb] transition-all border-[3px] border-[#00a88e]/20"
                    >
                      Repetir
                    </button>
                    <button
                      type="button"
                      onClick={confirmPhoto}
                      disabled={!photoPreviewBlob}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-white bg-[#00a88e] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00967f] transition-all border-[3px] border-transparent shadow-md"
                    >
                      Confirmar
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={closePhotoModal}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[#64748b] bg-white hover:bg-[#f8fbfb] transition-all border-[3px] border-[#94a3b8]/30"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

