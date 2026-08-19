import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  PATIENT_FILTER_SECTIONS,
  getFiltersForSection,
  countActivePatientFilters,
  clearAllPatientFilters,
} from './patientListFilters.js';

export const PatientFilterPanel = forwardRef(function PatientFilterPanel(
  { ctx, onFilterChange, className = '' },
  ref,
) {
  const checkboxRefs = useRef({});

  useImperativeHandle(ref, () => ({
    focusFirstEnabled() {
      for (const section of PATIENT_FILTER_SECTIONS) {
        for (const def of getFiltersForSection(section.id)) {
          const el = checkboxRefs.current[def.id];
          if (el && !def.disabled(ctx)) {
            el.focus();
            return;
          }
        }
      }
    },
  }));

  const activeCount = countActivePatientFilters(ctx);

  const handleToggle = (def, checked) => {
    if (checked) {
      def.activate(ctx);
    } else {
      def.deactivate(ctx);
    }
    onFilterChange?.(def, checked);
  };

  const handleClearAll = () => {
    clearAllPatientFilters(ctx);
    onFilterChange?.(null, false);
  };

  return (
    <div className={className}>
      {ctx.isSearching ? (
        <p className="mb-4 text-[12px] text-[#94a3b8]">
          Filtros de indicador ficam indisponíveis durante a busca por texto.
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        {PATIENT_FILTER_SECTIONS.map((section) => {
          const filters = getFiltersForSection(section.id);
          return (
            <section key={section.id} aria-labelledby={`patient-filter-section-${section.id}`}>
              <h3
                id={`patient-filter-section-${section.id}`}
                className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#64748b]"
              >
                {section.label}
              </h3>
              <ul className="flex list-none flex-col gap-2">
                {filters.map((def) => {
                  const disabled = def.disabled(ctx);
                  const title = def.disabledTitle?.(ctx);
                  const inputId = `patient-filter-${def.id}`;
                  return (
                    <li key={def.id}>
                      <label
                        htmlFor={inputId}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-[14px] text-[#334155] ${
                          disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-[#0f172a]'
                        }`}
                        title={title}
                      >
                        <input
                          ref={(el) => {
                            checkboxRefs.current[def.id] = el;
                          }}
                          id={inputId}
                          type="checkbox"
                          checked={def.isActive(ctx)}
                          disabled={disabled}
                          title={title}
                          onChange={(e) => handleToggle(def, e.target.checked)}
                          className="h-4 w-4 shrink-0 rounded border-[#cbd5e1] text-[#00a88e] focus:ring-[#00a88e]/40 disabled:cursor-not-allowed"
                        />
                        <span>{def.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {activeCount > 0 ? (
        <div className="mt-5 border-t border-[#e2e8f0] pt-4">
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[13px] font-semibold text-[#00a88e] hover:text-[#00967f]"
          >
            Limpar todos
          </button>
        </div>
      ) : null}
    </div>
  );
});
