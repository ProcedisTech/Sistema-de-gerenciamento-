import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Gera itens de paginação numerada com reticências.
 * @param {number} currentPage — índice 0-based
 * @param {number} totalPages — total de páginas (≥ 1)
 * @returns {Array<{ type: 'page', value: number } | { type: 'ellipsis' }>}
 */
export function buildPatientListPageItems(currentPage, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: 'page', value: i + 1 }));
  }

  const current = currentPage + 1;
  const items = [];

  const addPage = (n) => items.push({ type: 'page', value: n });
  const addEllipsis = () => {
    if (items.length && items[items.length - 1].type !== 'ellipsis') {
      items.push({ type: 'ellipsis' });
    }
  };

  addPage(1);

  let start = Math.max(2, current - 1);
  let end = Math.min(totalPages - 1, current + 1);

  if (current <= 3) {
    start = 2;
    end = Math.min(4, totalPages - 1);
  } else if (current >= totalPages - 2) {
    start = Math.max(2, totalPages - 3);
    end = totalPages - 1;
  }

  if (start > 2) addEllipsis();

  for (let i = start; i <= end; i += 1) {
    addPage(i);
  }

  if (end < totalPages - 1) addEllipsis();

  if (totalPages > 1) addPage(totalPages);

  return items;
}

const navBtnClass =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#475569] transition-colors hover:border-[#cbd5e1] hover:bg-white disabled:pointer-events-none disabled:opacity-40';

const pageBtnClass =
  'inline-flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-[14px] font-semibold text-[#475569] transition-colors hover:bg-[#f1f5f9] disabled:pointer-events-none';

/**
 * Paginação numerada da lista de pacientes — salto direto por página.
 */
export function PatientListPagination({
  page = 0,
  totalPages = 0,
  loading = false,
  first = true,
  last = true,
  onPageChange,
}) {
  const effectiveTotalPages = Math.max(totalPages, 1);
  const items = useMemo(
    () => buildPatientListPageItems(page, effectiveTotalPages),
    [page, effectiveTotalPages]
  );

  const disabled = loading || !onPageChange;

  return (
    <div className="mt-4 w-full">
      <nav
        className="flex w-full items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm"
        aria-label="Paginação da lista"
      >
        <button
          type="button"
          disabled={disabled || first}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          className={navBtnClass}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto custom-scrollbar">
          {items.map((item, idx) =>
            item.type === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="inline-flex h-10 min-w-[2rem] shrink-0 items-center justify-center px-1 text-[14px] font-semibold text-[#94a3b8]"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={`page-${item.value}`}
                type="button"
                disabled={disabled || item.value - 1 === page}
                onClick={() => onPageChange(item.value - 1)}
                className={`${pageBtnClass} ${
                  item.value - 1 === page
                    ? 'min-w-[2.75rem] bg-[#00a88e] text-white hover:bg-[#00a88e]'
                    : ''
                }`}
                aria-label={`Ir para página ${item.value}`}
                aria-current={item.value - 1 === page ? 'page' : undefined}
              >
                {item.value}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          disabled={disabled || last}
          onClick={() => onPageChange(page + 1)}
          className={navBtnClass}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>
      </nav>
    </div>
  );
}
