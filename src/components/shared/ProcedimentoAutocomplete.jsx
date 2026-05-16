import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';
import { filterCatalogos } from '../../utils/fuzzyMatch.js';

const CREATE_ROW_DEBOUNCE_MS = 300;

function exactCatalogHit(trimmedLower, catalogoOptions) {
  const t = String(trimmedLower || '').trim().toLowerCase();
  if (!t) return false;
  return (Array.isArray(catalogoOptions) ? catalogoOptions : []).some(
    (c) => String(c.nomeProcedimento || '').trim().toLowerCase() === t,
  );
}

/**
 * Autocomplete de procedimento com fuzzy match no catálogo.
 * @param {{
 *   value: string,
 *   onInputChange: (nome: string) => void,
 *   onCommit: (nome: string, catalogoId: string | null) => void,
 *   placeholder?: string,
 *   catalogoOptions: { id: string, nomeProcedimento: string }[],
 *   error?: boolean,
 *   disabled?: boolean,
 *   showCatalogCommitBadge?: boolean — quando false, não exibe o banner verde "Do catálogo" após commit (default true).
 * }} props
 */
export function ProcedimentoAutocomplete({
  value,
  onInputChange,
  onCommit,
  placeholder = '',
  catalogoOptions = [],
  error = false,
  disabled = false,
  showCatalogCommitBadge = true,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  /** Após blur: mostrar badge laranja conforme regra. */
  const [showCommitBadges, setShowCommitBadges] = useState(false);
  /** Seleção explícita de linha do catálogo. */
  const [lockedCatalog, setLockedCatalog] = useState(null);
  const lockedCatalogRef = useRef(null);

  const [debouncedCreateTerm, setDebouncedCreateTerm] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const pointerSelectingRef = useRef(false);
  const [dropdownDirection, setDropdownDirection] = useState('down');

  const updateDropdownDirection = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownDirection(rect.bottom + 300 > window.innerHeight ? 'up' : 'down');
  }, []);

  useEffect(() => {
    const t = String(draft || '').trim();
    const id = window.setTimeout(() => setDebouncedCreateTerm(t), CREATE_ROW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft]);

  useEffect(() => {
    const v = String(value ?? '');
    setDraft(v);
    const lock = lockedCatalogRef.current;
    if (lock && v.trim() !== String(lock.nome || '').trim()) {
      lockedCatalogRef.current = null;
      setLockedCatalog(null);
    }
    if (!v.trim()) {
      lockedCatalogRef.current = null;
      setLockedCatalog(null);
      setShowCommitBadges(false);
    }
  }, [value]);

  const filtered = useMemo(
    () => filterCatalogos(draft, catalogoOptions, 50, 8),
    [draft, catalogoOptions],
  );

  const draftTrim = String(draft || '').trim();
  const showCreateRow =
    Boolean(debouncedCreateTerm) && !exactCatalogHit(debouncedCreateTerm, catalogoOptions);
  const totalListItems = filtered.length + (showCreateRow ? 1 : 0);
  const showCatalogDropdown = filtered.length > 0;

  useEffect(() => {
    setHighlightIndex((i) => {
      if (totalListItems <= 0) return 0;
      return Math.min(i, totalListItems - 1);
    });
  }, [totalListItems]);

  const closeList = useCallback(() => {
    setOpen(false);
    setHighlightIndex(0);
  }, []);

  const selectCatalogRow = useCallback(
    (row) => {
      const pick = { id: row.id, nome: row.nomeProcedimento };
      lockedCatalogRef.current = pick;
      setLockedCatalog(pick);
      onCommit(row.nomeProcedimento, row.id);
      setDraft(row.nomeProcedimento);
      setShowCommitBadges(true);
      closeList();
      inputRef.current?.blur();
    },
    [onCommit, closeList],
  );

  const selectCreateRow = useCallback(() => {
    const nome = String(draft || '').trim();
    lockedCatalogRef.current = null;
    setLockedCatalog(null);
    onCommit(nome, null);
    setShowCommitBadges(true);
    closeList();
  }, [draft, onCommit, closeList]);

  const clearAll = useCallback(() => {
    lockedCatalogRef.current = null;
    setLockedCatalog(null);
    setDraft('');
    setShowCommitBadges(false);
    onInputChange('');
    onCommit('', null);
    closeList();
  }, [onInputChange, onCommit, closeList]);

  const applyBlurCommit = useCallback(() => {
    const nome = String(draft || '').trim();
    setShowCommitBadges(true);
    if (pointerSelectingRef.current) {
      pointerSelectingRef.current = false;
      setTimeout(() => setOpen(false), 0);
      return;
    }
    const lock = lockedCatalogRef.current;
    if (lock && nome === String(lock.nome || '').trim()) {
      onCommit(nome, lock.id);
    } else {
      lockedCatalogRef.current = null;
      setLockedCatalog(null);
      onInputChange(nome);
    }
    setTimeout(() => setOpen(false), 0);
  }, [draft, onInputChange, onCommit]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!containerRef.current?.contains(e.target)) closeList();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [closeList]);

  const greenBadge =
    showCommitBadges &&
    lockedCatalog &&
    String(draft || '').trim() === String(lockedCatalog.nome || '').trim();

  const orangeBadge =
    showCommitBadges &&
    !greenBadge &&
    String(draft || '').trim() &&
    !exactCatalogHit(String(draft || '').trim(), catalogoOptions);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (draftTrim || catalogoOptions.length > 0) {
        setOpen(true);
        setHighlightIndex(0);
        requestAnimationFrame(() => updateDropdownDirection());
        e.preventDefault();
      }
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      closeList();
      e.preventDefault();
      return;
    }
    if (totalListItems <= 0) return;
    if (e.key === 'ArrowDown') {
      setHighlightIndex((i) => Math.min(totalListItems - 1, i + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlightIndex((i) => Math.max(0, i - 1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex < filtered.length) {
        const row = filtered[highlightIndex];
        if (row) selectCatalogRow(row);
      } else if (showCreateRow) {
        selectCreateRow();
      }
    }
  };

  const borderClass = error
    ? 'border-red-400 bg-red-50'
    : 'border-[#e2e8f0] focus:border-[#00a88e]';

  return (
    <div className="w-full space-y-2">
      <div ref={containerRef} className="relative flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="procedimento-autocomplete-listbox"
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            lockedCatalogRef.current = null;
            setLockedCatalog(null);
            setShowCommitBadges(false);
            onInputChange(next);
            setOpen(true);
            setHighlightIndex(0);
            requestAnimationFrame(() => updateDropdownDirection());
          }}
          onFocus={() => {
            setOpen(true);
            setHighlightIndex(0);
            requestAnimationFrame(() => updateDropdownDirection());
          }}
          onBlur={() => {
            applyBlurCommit();
          }}
          onKeyDown={onKeyDown}
          className={`min-w-0 flex-1 rounded-xl border-[2px] px-4 py-3 text-[16px] outline-none sm:text-[14px] ${borderClass}`}
        />
        {(greenBadge || orangeBadge) && String(draft || '').trim() ? (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]"
            aria-label="Limpar procedimento"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}

        {open && !disabled && (showCatalogDropdown || showCreateRow) ? (
          <ul
            ref={listRef}
            id="procedimento-autocomplete-listbox"
            role="listbox"
            className={`absolute left-0 right-0 z-50 max-h-[min(360px,55vh)] overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white py-1 shadow-lg ${
              dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            }`}
          >
            {showCatalogDropdown ? (
              <>
                <li className="pointer-events-none select-none px-3 pb-1 pt-2" role="presentation">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
                    Procedimentos cadastrados
                  </p>
                </li>
                <li className="pointer-events-none select-none px-3 pb-2" role="presentation">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[#0f766e]">
                    <Check className="h-4 w-4 shrink-0 text-green-600" strokeWidth={2.5} aria-hidden />
                    Cadastrados
                  </div>
                </li>
              </>
            ) : null}
            {filtered.map((row, idx) => (
              <li key={row.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightIndex === idx}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium ${
                    highlightIndex === idx ? 'bg-[#f0fdf9]' : 'hover:bg-[#f8fafc]'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pointerSelectingRef.current = true;
                  }}
                  onClick={() => selectCatalogRow(row)}
                >
                  <Check className="h-4 w-4 shrink-0 text-green-600" strokeWidth={2.5} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[#0f172a]">{row.nomeProcedimento}</span>
                  {draftTrim ? (
                    <span className="shrink-0 text-[11px] font-bold text-[#64748b]">{Math.round(row.score)}%</span>
                  ) : null}
                </button>
              </li>
            ))}
            {showCreateRow ? (
              <li role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightIndex === filtered.length}
                  className={`w-full px-3 py-2.5 text-left text-[13px] font-semibold text-[#00a88e] ${
                    highlightIndex === filtered.length ? 'bg-[#f0fdf9]' : 'hover:bg-[#f8fafc]'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pointerSelectingRef.current = true;
                  }}
                  onClick={selectCreateRow}
                >
                  + Cadastrar &quot;{debouncedCreateTerm}&quot; como novo
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {showCatalogCommitBadge && greenBadge ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-[12px] font-semibold text-green-800">
          <Check className="h-4 w-4 shrink-0 text-green-600" strokeWidth={2.5} aria-hidden />
          Do catálogo
        </div>
      ) : null}
      {orangeBadge ? (
        <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" strokeWidth={2} aria-hidden />
          Não está no catálogo
        </div>
      ) : null}
    </div>
  );
}
