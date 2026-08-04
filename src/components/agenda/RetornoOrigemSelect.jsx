import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Search, Calendar, Check, ChevronRight } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';
import {
  formatProcedimentoRaizData,
  filtrarProcedimentosRaiz,
  nomeProcedimentoRaiz,
} from './retornoOrigemUtils.js';
import { SearchDropdownShell } from './SearchDropdownShell.jsx';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:ring-offset-1';

function OrigemOptionButton({ r, isSelected, onSelect, active }) {
  const nome = nomeProcedimentoRaiz(r);
  const dataFmt = formatProcedimentoRaizData(r.data);
  const cor = gerarCorAvatar(nome);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      aria-label={`${nome}, realizado em ${dataFmt}`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect?.(r.id)}
      className={
        isSelected
          ? `flex w-full items-center gap-3 rounded-xl border-2 border-[#00a88e] bg-[#e6f7f5] px-3 py-2.5 text-left ${FOCUS_RING}`
          : `flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left hover:bg-ink-50 ${FOCUS_RING} ${
              active ? 'ring-2 ring-[#14B8A6] ring-offset-1' : ''
            }`
      }
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${cor.bg} ${cor.fg}`}
      >
        {iniciaisDoNome(nome)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] font-semibold ${
            isSelected ? 'text-[#0f766e]' : 'text-ink-900'
          }`}
        >
          {nome}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{dataFmt}</span>
        </p>
      </div>
      {isSelected ? (
        <Check className="h-5 w-5 shrink-0 text-[#00a88e]" aria-hidden />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
      )}
    </button>
  );
}

/**
 * Seletor de procedimento raiz para retorno órfão / modal de agenda.
 * @param {boolean} [flutuante=false] — se true, lista via SearchDropdownShell (só AgendaFormModal).
 */
export function RetornoOrigemSelect({
  value,
  onChange,
  options = [],
  loading = false,
  error = '',
  fieldError = '',
  id = 'retorno-origem-select',
  flutuante = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listId = `${id}-list`;

  const filtered = useMemo(
    () => filtrarProcedimentosRaiz(options, query),
    [options, query],
  );

  const emptyMessage =
    options.length === 0
      ? 'Este paciente ainda não tem procedimento realizado para vincular o retorno.'
      : 'Nenhum procedimento encontrado';

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(0);
  }, []);

  const selectId = useCallback(
    (optId) => {
      onChange?.(optId);
      setQuery('');
      close();
      inputRef.current?.focus();
    },
    [onChange, close],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && flutuante && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
      inputRef.current?.focus();
      return;
    }
    if (!flutuante) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' && open && filtered.length > 0) {
      const idx = Math.min(highlight, filtered.length - 1);
      const item = filtered[idx];
      if (item) {
        e.preventDefault();
        selectId(item.id);
      }
    }
  };

  const listContent =
    filtered.length === 0 ? (
      <p className="py-8 text-center text-[13px] text-[#6b7280]">{emptyMessage}</p>
    ) : (
      <div className={flutuante ? 'space-y-2 p-2' : 'space-y-2'}>
        {filtered.map((r, idx) => (
          <OrigemOptionButton
            key={r.id}
            r={r}
            isSelected={String(value) === String(r.id)}
            onSelect={selectId}
            active={flutuante && open && idx === highlight}
          />
        ))}
      </div>
    );

  const inputEl = (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        role={flutuante ? 'combobox' : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (flutuante) setOpen(true);
        }}
        onFocus={() => {
          if (flutuante) setOpen(true);
        }}
        onClick={() => {
          if (flutuante) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Buscar por nome ou data…"
        aria-controls={listId}
        aria-expanded={flutuante ? open : undefined}
        aria-autocomplete={flutuante ? 'list' : undefined}
        className={`w-full rounded-xl border border-ink-200 bg-white py-2 pl-10 pr-3 text-sm text-ink-800 outline-none focus:border-[#00a88e] focus:ring-2 focus:ring-[#e6f7f5] ${FOCUS_RING}`}
        autoComplete="off"
      />
    </div>
  );

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-ink-500"
      >
        Retorno de qual procedimento? <span className="text-red-500">*</span>
      </label>
      {loading ? (
        <p className="text-[12px] text-[#6b7280]">Carregando procedimentos…</p>
      ) : error ? (
        <p className="text-[11px] font-bold text-red-600">{error}</p>
      ) : flutuante ? (
        <>
          <SearchDropdownShell
            open={open}
            onRequestClose={close}
            dropdown={
              <div
                id={listId}
                role="listbox"
                aria-label="Procedimentos de origem do retorno"
              >
                {listContent}
              </div>
            }
          >
            {inputEl}
          </SearchDropdownShell>
        </>
      ) : (
        <>
          {inputEl}
          <div
            id={listId}
            role="listbox"
            aria-label="Procedimentos de origem do retorno"
            className="mt-2 max-h-[300px] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
          >
            {listContent}
          </div>
        </>
      )}
      {fieldError ? (
        <p className="text-[11px] font-bold text-red-600">{fieldError}</p>
      ) : null}
    </div>
  );
}
