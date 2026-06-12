import React from 'react';

const INPUT_CLASS =
  'app-date-input relative w-full px-4 py-3 bg-[#f8fbfb] border border-slate-200 rounded-xl text-[14px] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/10 focus:border-[#00a88e] disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Date input compartilhado (padrão AgendaModal) com ícone nativo do Chrome oculto.
 */
export function AppDateInput({
  value,
  onChange,
  disabled = false,
  className = '',
  id,
  min,
  max,
}) {
  return (
    <input
      id={id}
      type="date"
      value={value ?? ''}
      min={min}
      max={max}
      disabled={disabled}
      onChange={onChange}
      className={`${INPUT_CLASS}${className ? ` ${className}` : ''}`}
    />
  );
}
