import React from 'react';
import { ImageIcon } from 'lucide-react';
import { getVistaLabel, getVistasPorGrupo } from '../../../constants/vistasMapeamento.js';

export function EscolherVistaModal({
  open,
  grupo,
  onSelectVista,
  onBack,
  onClose,
  hasFoto,
  countPontosVista,
}) {
  if (!open || !grupo) return null;

  const vistas = getVistasPorGrupo(grupo);
  const grupoLabel = grupo === 'rosto' ? 'Rosto' : 'Corpo';

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vista-foto-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-app-border bg-white shadow-app-card"
      >
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <div>
            <h3 id="vista-foto-title" className="text-[17px] font-bold text-app-ink">
              Escolher vista — {grupoLabel}
            </h3>
            <p className="mt-0.5 text-[12px] font-medium text-[#64748b]">Selecione o ângulo da foto</p>
          </div>
          <div className="flex gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-slate-100"
              >
                Voltar
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vistas.map((v) => {
              const comFoto = typeof hasFoto === 'function' ? hasFoto(v.codigo) : false;
              const pontos = typeof countPontosVista === 'function' ? countPontosVista(v.codigo) : 0;
              return (
                <button
                  key={v.codigo}
                  type="button"
                  onClick={() => onSelectVista?.(v.codigo)}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-all ${
                    comFoto || pontos > 0
                      ? 'border-app-accent/40 bg-app-nav-active hover:border-app-accent'
                      : 'border-app-border bg-white hover:border-app-accent/30 hover:bg-[#f8fafc]'
                  }`}
                >
                  <span className="text-[13px] font-bold text-app-ink">{getVistaLabel(v.codigo)}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {comFoto ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#e6f7f5] px-1.5 py-0.5 text-[10px] font-semibold text-[#00a88e]">
                        <ImageIcon className="h-3 w-3" />
                        Com foto
                      </span>
                    ) : null}
                    {pontos > 0 ? (
                      <span className="rounded-md bg-app-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {pontos} pt{pontos !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                    {!comFoto && pontos === 0 ? (
                      <span className="text-[10px] font-medium text-[#94a3b8]">Nova vista</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
