import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Hook que expõe modal de confirmação amarelo "Fora do horário do profissional"
 * + função que retorna Promise<boolean>.
 *
 * Padrão idêntico a askFinishJourneyConfirm em AppRefactored.jsx (useRef pra
 * resolve, useState pro payload, close zera ref + fecha + resolve).
 *
 * Uso típico:
 *   const { modal, abrirConfirmacao } = useConfirmacaoForaDisp();
 *   // ... renderizar { modal } no JSX
 *   const ok = await abrirConfirmacao();
 *   if (ok) { ... usuário confirmou ... }
 */
export function useConfirmacaoForaDisp() {
  const resolveRef = useRef(null);
  const [open, setOpen] = useState(false);

  const abrirConfirmacao = useCallback(
    () =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const fechar = useCallback((value) => {
    const fn = resolveRef.current;
    resolveRef.current = null;
    setOpen(false);
    if (typeof fn === 'function') fn(Boolean(value));
  }, []);

  const modal = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-fora-disp-title"
      className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-900/45 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar(false);
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-fora-disp-title"
              className="text-base font-semibold text-slate-900"
            >
              Fora do horário do profissional
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Esse horário está fora da disponibilidade cadastrada do profissional.
              Confirmar mesmo assim?
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => fechar(false)}
            className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => fechar(true)}
            className="h-10 rounded-lg bg-amber-500 px-4 text-[13px] font-semibold text-white hover:bg-amber-600"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { modal, abrirConfirmacao };
}
