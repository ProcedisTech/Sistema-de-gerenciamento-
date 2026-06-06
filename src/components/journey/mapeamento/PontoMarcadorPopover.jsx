import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import {
  normalizeTamanho,
  TAMANHO_MAX,
  TAMANHO_MIN,
} from '../../../constants/mapeamentoMarcador.js';

function PontoMarcadorPopoverForm({
  ponto,
  nomeProcedimento,
  catalogoId,
  anchorLeft,
  anchorTop,
  onSave,
  onRemove,
  onCancel,
}) {
  const inputRef = useRef(null);
  const [tamanhoLocal, setTamanhoLocal] = useState(() => normalizeTamanho(ponto.tamanho));

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const cor = corParaProcedimento(catalogoId);
  const left = anchorLeft ?? 50;
  const top = anchorTop ?? 50;

  const handleSubmit = (e) => {
    e.preventDefault();
    const raw = inputRef.current?.value ?? '';
    const qty = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return;
    onSave?.({ quantidade: qty, tamanho: normalizeTamanho(tamanhoLocal) });
  };

  const popoverStyle = {
    left: `${Math.min(Math.max(left, 12), 88)}%`,
    top: `${Math.min(Math.max(top, 12), 88)}%`,
  };

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 z-[20] cursor-default bg-transparent"
        aria-label="Fechar popover"
        onClick={onCancel}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ponto-edit-title"
        onSubmit={handleSubmit}
        style={popoverStyle}
        className="absolute z-[25] w-[min(240px,calc(100%-1rem))] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-app-border bg-white p-4 shadow-app-card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
          <div className="min-w-0 flex-1">
            <p id="ponto-edit-title" className="truncate text-[13px] font-bold text-app-ink">
              {nomeProcedimento || 'Procedimento'}
            </p>
            <p className="text-[11px] font-medium text-[#94a3b8]">Ponto #{ponto.ordem}</p>
          </div>
        </div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
          Quantidade
        </label>
        <input
          ref={inputRef}
          type="number"
          step="any"
          min="0.01"
          required
          defaultValue={ponto.quantidade}
          className="mb-3 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-[14px] font-medium text-app-ink outline-none focus:border-app-accent focus:ring-4 focus:ring-[#00a88e]/10"
        />
        <label
          htmlFor="ponto-tamanho-slider"
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]"
        >
          Tamanho do marcador
        </label>
        <div className="mb-3 flex items-center gap-2">
          <input
            id="ponto-tamanho-slider"
            type="range"
            min={TAMANHO_MIN}
            max={TAMANHO_MAX}
            step={0.1}
            value={tamanhoLocal}
            onChange={(e) => setTamanhoLocal(normalizeTamanho(Number(e.target.value)))}
            className="min-w-[120px] flex-1 shrink-0 accent-[#00a88e]"
          />
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#64748b]">
            {tamanhoLocal.toFixed(1)}×
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-app-accent py-2 text-[12px] font-semibold text-white hover:bg-[#00967f]"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => onRemove?.()}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>
        </div>
      </form>
    </>
  );
}

export function PontoMarcadorPopover({
  open,
  ponto,
  nomeProcedimento,
  catalogoId,
  /** @deprecated use anchorLeft/anchorTop (container %) */
  anchorPercent,
  anchorLeft,
  anchorTop,
  onSave,
  onRemove,
  onCancel,
}) {
  if (!open || !ponto) return null;

  return (
    <PontoMarcadorPopoverForm
      key={ponto.localId}
      ponto={ponto}
      nomeProcedimento={nomeProcedimento}
      catalogoId={catalogoId}
      anchorLeft={anchorLeft ?? anchorPercent?.posX}
      anchorTop={anchorTop ?? anchorPercent?.posY}
      onSave={onSave}
      onRemove={onRemove}
      onCancel={onCancel}
    />
  );
}
