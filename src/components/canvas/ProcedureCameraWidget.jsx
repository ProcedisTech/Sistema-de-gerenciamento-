import React from 'react';
import { Camera, Upload, X, SwitchCamera } from 'lucide-react';

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
  uploadPhotoFiles,
  uploadDocumentFiles,
  cameraFacing = 'environment',
  onToggleCameraFacing,
}) {
  if (!visible) return null;

  return (
    <>
      <div className="fixed right-4 top-1/2 z-[55] flex -translate-y-1/2 flex-col items-end gap-3 md:right-6">
        {photoThumbUrl && (
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-app-border bg-white shadow-sm">
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
          className="w-16 h-16 rounded-full bg-[#ef4444] hover:bg-[#dc2626] transition-all shadow-lg flex items-center justify-center border border-red-200"
          aria-label="Tirar foto durante o procedimento"
        >
          <Camera className="w-7 h-7 text-white" strokeWidth={2.5} />
        </button>

        {/* Upload de arquivos / documentos */}
        <label
          title="Enviar arquivos (upload)"
          className="group w-14 h-14 rounded-2xl bg-white hover:bg-[#eff6ff] transition-all shadow-md flex flex-col items-center justify-center border border-[#3b82f6]/40 cursor-pointer gap-1"
        >
          <Upload className="w-5 h-5 text-[#3b82f6]" strokeWidth={2.5} />
          <span className="text-[9px] font-bold text-[#3b82f6] leading-none">Upload</span>
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              uploadDocumentFiles?.(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {photoModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 min-h-0"
          onMouseDown={closePhotoModal}
        >
          <div className="absolute inset-0 bg-black/60" onClick={closePhotoModal} />

          <div
            className="relative w-full max-w-[900px] max-h-[100dvh] min-h-0 flex flex-col bg-white rounded-2xl border border-app-border shadow-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 p-4 flex items-center justify-between border-b border-app-border">
              <div className="flex items-center gap-3">
                <div className="bg-[#e6f7f5] p-2 rounded-xl border border-app-border">
                  <Camera className="w-6 h-6 text-[#00a88e]" strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold text-[#0f172a]">Foto ao vivo</h4>
                  <p className="text-[12px] font-medium text-[#64748b]">
                    Capture durante o procedimento e confirme.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!photoPreviewUrl && onToggleCameraFacing && (
                  <button
                    type="button"
                    onClick={onToggleCameraFacing}
                    disabled={isCameraStarting}
                    className="w-10 h-10 rounded-xl hover:bg-[#f8fbfb] border border-slate-200 text-[#00a88e] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    aria-label={
                      cameraFacing === 'environment' ? 'Usar camera frontal' : 'Usar camera traseira'
                    }
                    title={
                      cameraFacing === 'environment' ? 'Usar camera frontal' : 'Usar camera traseira'
                    }
                  >
                    <SwitchCamera className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePhotoModal}
                  className="w-10 h-10 rounded-xl hover:bg-[#f8fbfb] border border-transparent text-[#94a3b8] hover:text-[#00a88e] transition-all flex items-center justify-center"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto p-4"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="relative rounded-[20px] overflow-hidden border border-app-border bg-[#f8fbfb]">
                <video
                  ref={videoRef}
                  playsInline
                  className="w-full max-h-[50vh] sm:max-h-[70vh] object-contain bg-black"
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
                <div className="mt-3 bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-[13px] font-bold">
                  {cameraError}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                {!photoPreviewUrl ? (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!videoReady || isCameraStarting}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-white bg-[#00a88e] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00967f] transition-all border border-transparent shadow-md"
                  >
                    Capturar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[#0f172a] bg-white hover:bg-[#f8fbfb] transition-all border border-slate-200"
                    >
                      Repetir
                    </button>
                    <button
                      type="button"
                      onClick={confirmPhoto}
                      disabled={!photoPreviewBlob}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-white bg-[#00a88e] disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#00967f] transition-all border border-transparent shadow-md"
                    >
                      Confirmar
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={closePhotoModal}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-[#64748b] bg-white hover:bg-[#f8fbfb] transition-all border border-[#94a3b8]/30"
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
