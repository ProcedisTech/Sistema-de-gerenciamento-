import React from 'react';
import { maskValorBrlInput } from '../../utils/planejamentoDraftUtils.js';

const DEFAULT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] outline-none focus:border-[#00a88e] focus:ring-4 focus:ring-[#00a88e]/10';

export function ValorOrcadoInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Valor orçado (R$)',
  className = DEFAULT_CLASS,
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange?.(maskValorBrlInput(e.target.value))}
      className={className}
      autoComplete="off"
    />
  );
}
