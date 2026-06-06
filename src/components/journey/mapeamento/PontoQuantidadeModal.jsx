import React, { useEffect, useRef } from 'react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';

/** Modal para definir quantidade ao criar um novo ponto. */
export function PontoQuantidadeModal({
  open,
  procedimentoArmado,
  onConfirm,
  onCancel,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const cor = procedimentoArmado?.id ? corParaProcedimento(procedimentoArmado.id) : '#00A88E';

  const handleSubmit = (e) => {
    e.preventDefault();
    const raw = inputRef.current?.value ?? '';
    const qty = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return;
    onConfirm?.(qty);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="qty-ponto-title"
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-xl border border-app-border bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h4 id="qty-ponto-title" className="text-[15px] font-bold text-app-ink">
          Quantidade no ponto
        </h4>
        {procedimentoArmado?.nome ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-app-nav-active px-3 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
            <span className="text-[12px] font-semibold text-[#0f766e]">{procedimentoArmado.nome}</span>
          </div>
        ) : null}
        <p className="mt-2 text-[13px] font-medium text-[#64748b]">
          Informe a quantidade (maior que zero).
        </p>
        <input
          ref={inputRef}
          type="number"
          step="any"
          min="0.01"
          required
          defaultValue="1"
          className="mt-4 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-app-ink outline-none focus:border-app-accent focus:ring-4 focus:ring-[#00a88e]/10"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-[#64748b] hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-app-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#00967f]"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
