import React, { useEffect, useRef } from 'react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { getPresetsForUnidade, getPassoFallback, normalizeUnidadeMedida } from '../../../constants/quantidadePresets.js';
import { QuantidadeUnidadeInputGroup } from './UnidadeMedidaSelect.jsx';

/** Modal para definir quantidade ao criar um novo ponto. */
export function PontoQuantidadeModal({
  open,
  procedimentoArmado,
  onConfirm,
  onCancel,
  unidadeMedida,
  onUnidadeMedidaChange,
  presets,
  passo,
}) {
  const inputRef = useRef(null);
  const unit = normalizeUnidadeMedida(unidadeMedida);
  const step = getPassoFallback(unit, passo);
  const presetList = Array.isArray(presets) ? presets : getPresetsForUnidade(unit);
  const defaultQty = presetList[1] ?? presetList[0] ?? 1;
  const unidadeEditavel = typeof onUnidadeMedidaChange === 'function';

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open, unit]);

  if (!open) return null;

  const cor = procedimentoArmado?.id ? corParaProcedimento(procedimentoArmado.id) : '#00A88E';

  const submitQty = (qty) => {
    if (!Number.isFinite(qty) || qty <= 0) return;
    onConfirm?.(qty);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const raw = inputRef.current?.value ?? String(defaultQty);
    const qty = Number(String(raw).replace(',', '.'));
    submitQty(qty);
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presetList.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => submitQty(Number(p))}
              className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[12px] font-semibold text-[#475569] hover:border-app-accent hover:bg-app-nav-active"
            >
              {unidadeEditavel ? p : `${p} ${unit}`}
            </button>
          ))}
        </div>
        <label className="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
          Quantidade
        </label>
        <QuantidadeUnidadeInputGroup
          inputRef={inputRef}
          inputKey={`qty-${unit}`}
          defaultValue={defaultQty}
          step={step}
          min={step}
          unidadeMedida={unit}
          onUnidadeMedidaChange={unidadeEditavel ? onUnidadeMedidaChange : undefined}
        />
        {unidadeEditavel ? (
          <p className="mt-1.5 text-[11px] font-medium text-[#94a3b8]">
            Unidade aplicada a todos os pontos deste procedimento.
          </p>
        ) : null}
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
