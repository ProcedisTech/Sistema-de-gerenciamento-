import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  UNIDADES_MEDIDA_OPCOES,
  normalizeUnidadeMedida,
  unidadeKeyMatches,
} from '../../../constants/quantidadePresets.js';

/** Classes alinhadas ao select modal do PatientForm (`selectPersonalClass`). */
export const UNIDADE_SELECT_CLASS =
  'w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none transition focus:border-[#00a88e] focus:ring-1 focus:ring-[#00a88e]/20';

const COMPOUND_GROUP_CLASS =
  'flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white transition focus-within:border-[#00a88e] focus-within:ring-1 focus-within:ring-[#00a88e]/20';

const COMPOUND_INPUT_CLASS =
  'min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[14px] text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto';

const COMPOUND_SELECT_CLASS =
  'h-full min-w-[4.25rem] shrink-0 cursor-pointer appearance-none border-0 bg-transparent py-2.5 pl-2 pr-7 text-[14px] font-semibold uppercase tracking-wide text-slate-900 outline-none';

function resolveSelectValue(unidadeMedida) {
  const normalized = normalizeUnidadeMedida(unidadeMedida);
  const match = UNIDADES_MEDIDA_OPCOES.find((o) => unidadeKeyMatches(normalized, o.key));
  return match?.label ?? normalized;
}

function labelToUnidade(label) {
  const found = UNIDADES_MEDIDA_OPCOES.find(
    (o) => o.label.toLowerCase() === String(label || '').toLowerCase(),
  );
  return found?.label ?? normalizeUnidadeMedida(label);
}

/** Select standalone (ex.: cabeçalho do mapa) — estilo PatientForm. */
export function UnidadeMedidaSelect({ value, onChange, disabled = false, className = '', id }) {
  if (!onChange) return null;

  const selectValue = resolveSelectValue(value);

  return (
    <div className={`relative ${className}`.trim()}>
      <select
        id={id}
        disabled={disabled}
        value={selectValue}
        onChange={(e) => onChange(labelToUnidade(e.target.value))}
        className={UNIDADE_SELECT_CLASS}
        aria-label="Unidade de medida"
      >
        {UNIDADES_MEDIDA_OPCOES.map(({ key, label }) => (
          <option key={key} value={label}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
    </div>
  );
}

/**
 * Grupo compacto: [input numérico] | [select unidade]
 * Mesma lógica de step/min; apenas layout visual.
 */
export function QuantidadeUnidadeInputGroup({
  inputRef,
  defaultValue,
  step,
  min,
  required = true,
  unidadeMedida,
  onUnidadeMedidaChange,
  inputKey,
}) {
  const unit = normalizeUnidadeMedida(unidadeMedida);
  const unidadeEditavel = typeof onUnidadeMedidaChange === 'function';
  const selectValue = resolveSelectValue(unit);

  if (!unidadeEditavel) {
    return (
      <div className={`relative ${COMPOUND_GROUP_CLASS}`}>
        <input
          ref={inputRef}
          key={inputKey}
          type="number"
          step={step}
          min={min ?? step}
          required={required}
          defaultValue={defaultValue}
          className={`${COMPOUND_INPUT_CLASS} pr-12`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold uppercase text-[#64748b]">
          {unit}
        </span>
      </div>
    );
  }

  return (
    <div className={COMPOUND_GROUP_CLASS}>
      <input
        ref={inputRef}
        key={inputKey}
        type="number"
        step={step}
        min={min ?? step}
        required={required}
        defaultValue={defaultValue}
        className={COMPOUND_INPUT_CLASS}
      />
      <div className="w-px shrink-0 self-stretch bg-slate-200" aria-hidden />
      <div className="relative shrink-0">
        <select
          value={selectValue}
          onChange={(e) => onUnidadeMedidaChange(labelToUnidade(e.target.value))}
          className={COMPOUND_SELECT_CLASS}
          aria-label="Unidade de medida"
        >
          {UNIDADES_MEDIDA_OPCOES.map(({ key, label }) => (
            <option key={key} value={label}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    </div>
  );
}
