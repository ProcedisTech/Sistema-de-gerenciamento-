import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PatientFilterPanel } from './PatientFilterPanel.jsx';

/**
 * Bottom sheet de filtros — mobile only. Toggle imediato, sem botão Aplicar.
 */
export function PatientFiltersSheet({ open, onClose, ctx, onFilterChange }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => {
      panelRef.current?.focusFirstEnabled();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Filtros da lista de pacientes"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        aria-label="Fechar filtros"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-h-[75dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl border border-b-0 border-[#e2e8f0] bg-white pb-[env(safe-area-inset-bottom)] [-webkit-overflow-scrolling:touch] custom-scrollbar">
        <div className="sticky top-0 z-20 flex justify-center bg-white pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#e2e8f0]" aria-hidden />
        </div>
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 pb-3">
          <h2 className="text-[15px] font-semibold text-[#0f172a]">Filtros</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="px-4 py-4">
          <PatientFilterPanel ref={panelRef} ctx={ctx} onFilterChange={onFilterChange} />
        </div>
      </div>
    </div>
  );
}
