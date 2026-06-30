import React from 'react';
import { ChevronRight, Settings } from 'lucide-react';

/**
 * Breadcrumb de navegação do Settings Hub.
 * "Configurações" é clicável e volta ao hub (activeCategory = null).
 * Quando categoryLabel é fornecido, exibe "Configurações › [Categoria]".
 */
export function ConfigBreadcrumb({ categoryLabel, onBackToHub }) {
  return (
    <nav aria-label="Navegação de configurações" className="flex items-center gap-1 text-[13px]">
      <button
        type="button"
        onClick={onBackToHub}
        className="flex items-center gap-1 rounded-md px-1 py-0.5 font-medium text-[#64748b] transition-colors hover:text-[#0f172a]"
      >
        <Settings className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span>Configurações</span>
      </button>

      {categoryLabel && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" strokeWidth={2} aria-hidden />
          <span className="font-semibold text-[#0f172a]">{categoryLabel}</span>
        </>
      )}
    </nav>
  );
}
