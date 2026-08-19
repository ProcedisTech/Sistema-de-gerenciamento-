import React from 'react';

const COPY_BLOQUEIO =
  'Este paciente não assinou nenhum termo vinculado a este procedimento. O procedimento está bloqueado até a liberação.';

/**
 * Modal de bloqueio T2 — só renderiza quando há faltantes.
 */
export function TermoBloqueioModal({
  open,
  nomeProcedimento,
  faltantes = [],
  onIrParaTermos,
  onClose,
}) {
  if (!open || !Array.isArray(faltantes) || faltantes.length === 0) return null;

  const nome = nomeProcedimento || 'procedimento';
  const primeiroId = faltantes[0]?.termoId != null ? String(faltantes[0].termoId) : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="termo-bloqueio-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="termo-bloqueio-title" className="text-[16px] font-bold text-[#0f172a]">
          Procedimento bloqueado
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">{COPY_BLOQUEIO}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-[13px] font-semibold text-[#64748b]"
            >
              Fechar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              onIrParaTermos?.({
                termoId: primeiroId,
                termoIds: faltantes.map((f) => String(f.termoId)).filter(Boolean),
                nomeProcedimento: nome,
              })
            }
            className="rounded-xl bg-[#00a88e] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            Ir para a aba de termos e assinar o termo de {nome}
          </button>
        </div>
      </div>
    </div>
  );
}

export { COPY_BLOQUEIO };
