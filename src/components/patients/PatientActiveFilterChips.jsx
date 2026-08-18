import React from 'react';
import { getActivePatientFilters } from './patientListFilters.js';

export function PatientActiveFilterChips({ ctx, onFilterChange }) {
  const active = getActivePatientFilters(ctx);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {active.map((def) => (
        <span
          key={def.id}
          className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[12px] text-[#475569]"
        >
          {def.label}
          <button
            type="button"
            onClick={() => {
              def.deactivate(ctx);
              onFilterChange?.(def, false);
            }}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[#94a3b8] hover:bg-[#e2e8f0] hover:text-[#475569]"
            aria-label={`Remover filtro ${def.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
