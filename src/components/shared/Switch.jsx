import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Toggle booleano acessível (padrão Procedi: verde ativo / cinza inativo).
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  loading = false,
  ariaLabel,
  id,
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onChange?.(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#00a88e]/20 ${
        checked ? 'bg-[#00a88e]' : 'bg-[#cbd5e1]'
      } ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-[#64748b]" aria-hidden />
        ) : null}
      </span>
    </button>
  );
}
