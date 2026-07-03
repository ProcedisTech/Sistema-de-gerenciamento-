import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import {
  normalizeTamanho,
  TAMANHO_MAX,
  TAMANHO_MIN,
} from '../../../constants/mapeamentoMarcador.js';
import { getPresetsForUnidade, getPassoFallback, normalizeUnidadeMedida } from '../../../constants/quantidadePresets.js';
import { QuantidadeUnidadeInputGroup } from './UnidadeMedidaSelect.jsx';

function PontoMarcadorPopoverForm({
  ponto,
  nomeProcedimento,
  catalogoId,
  anchorLeft,
  anchorTop,
  onSave,
  onRemove,
  onCancel,
  unidadeMedida,
  onUnidadeMedidaChange,
  presets,
  passo,
}) {
  const inputRef = useRef(null);
  const [tamanhoLocal, setTamanhoLocal] = useState(() => normalizeTamanho(ponto.tamanho));
  const unit = normalizeUnidadeMedida(unidadeMedida);
  const step = getPassoFallback(unit, passo);
  const presetList = Array.isArray(presets) ? presets : getPresetsForUnidade(unit);
  const unidadeEditavel = typeof onUnidadeMedidaChange === 'function';

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [unit]);

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
        className="absolute z-[25] w-[280px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl border border-app-border bg-white p-4 shadow-app-card"
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
        <div className="mb-2 flex flex-wrap gap-1">
          {presetList.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = String(p);
              }}
              className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-semibold text-[#475569] hover:border-app-accent"
            >
              {unidadeEditavel ? p : `${p} ${unit}`}
            </button>
          ))}
        </div>
        <div className="mb-3">
          <QuantidadeUnidadeInputGroup
            inputRef={inputRef}
            inputKey={`edit-${unit}`}
            defaultValue={ponto.quantidade}
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
        </div>
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
  unidadeMedida,
  onUnidadeMedidaChange,
  presets,
  passo,
}) {
  if (!open || !ponto) return null;

  return (
    <PontoMarcadorPopoverForm
      key={`${ponto.localId}-${normalizeUnidadeMedida(unidadeMedida)}`}
      ponto={ponto}
      nomeProcedimento={nomeProcedimento}
      catalogoId={catalogoId}
      anchorLeft={anchorLeft ?? anchorPercent?.posX}
      anchorTop={anchorTop ?? anchorPercent?.posY}
      onSave={onSave}
      onRemove={onRemove}
      onCancel={onCancel}
      unidadeMedida={unidadeMedida}
      onUnidadeMedidaChange={onUnidadeMedidaChange}
      presets={presets}
      passo={passo}
    />
  );
}
