import React, { useCallback, useRef, useState } from 'react';
import { Search, Check, Plus, X } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';
import { SearchDropdownShell } from './SearchDropdownShell.jsx';
import { ProcedimentosMultiSeletor } from './ProcedimentosMultiSeletor.jsx';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20';

/**
 * Seleção inline de procedimentos.
 * Modo multi (Agenda): toggle acumula chips via ProcedimentosMultiSeletor abaixo.
 * Modo single (Planejamento): campo preenchido estilo PacienteSearchInput (teal + nome + X).
 */
export function ProcedimentoSearchInput({
  procedimentoOptions,
  procedimentosSelecionados,
  onToggle,
  onRemover,
  readOnly = false,
  selectionMode = 'multi',
  selectedVariant = 'list',
  showDuracao = true,
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const isSingle = selectionMode === 'single';

  const close = useCallback(() => setOpen(false), []);

  if (readOnly) {
    if (selectedVariant === 'chips') {
      return (
        <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Procedimentos selecionados">
          {(procedimentosSelecionados || []).map((proc) => (
            <span
              key={proc.id}
              role="listitem"
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-semibold text-teal-900 shadow-2xs"
            >
              <span className="truncate max-w-[240px]">{proc.nome}</span>
            </span>
          ))}
        </div>
      );
    }
    return (
      <ProcedimentosMultiSeletor
        procedimentos={procedimentosSelecionados}
        readOnly
        showAdicionar={false}
      />
    );
  }

  const termo = query.trim().toLowerCase();
  const lista = (procedimentoOptions || []).filter((p) => !termo || p.nome.toLowerCase().includes(termo));
  const idsSelecionados = new Set((procedimentosSelecionados || []).map((p) => p.id));

  const handleToggle = (proc) => {
    if (isSingle) {
      onSelect?.(proc);
      setQuery('');
      close();
      inputRef.current?.blur();
      return;
    }
    onToggle?.(proc);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
  };

  const dropdown = open ? (
    <ul
      role="listbox"
      aria-label="Procedimentos"
      aria-multiselectable={!isSingle}
      className="py-1"
    >
      {lista.length === 0 ? (
        <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">
          {termo ? `Nenhum resultado para "${query}"` : 'Nenhum procedimento disponível'}
        </li>
      ) : (
        lista.map((proc) => {
          const selecionado = idsSelecionados.has(proc.id);
          const cor = gerarCorAvatar(proc.nome);
          return (
            <li key={proc.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={selecionado}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleToggle(proc)}
                className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-0 ${
                  selecionado ? 'bg-teal-50' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${cor.bg} ${cor.fg}`}
                >
                  {iniciaisDoNome(proc.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-bold ${selecionado ? 'text-teal-900' : 'text-gray-900'}`}
                  >
                    {proc.nome}
                  </p>
                  {showDuracao ? (
                    <p className="text-[12px] font-medium text-gray-500">{proc.duracaoMin} min</p>
                  ) : null}
                </div>
                {selecionado ? (
                  <Check className="h-4 w-4 shrink-0 text-teal-600" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-gray-400" />
                )}
              </button>
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  if (isSingle) {
    const selected = procedimentosSelecionados?.[0];
    const displayNome = selected?.nome ?? '';
    const hasSelection = Boolean(selected && displayNome);
    const isSearching = open || query.length > 0;
    const showFilledValue = hasSelection && !isSearching;
    const inputValue = isSearching ? query : showFilledValue ? displayNome : '';
    const showClearButton = hasSelection && !open;

    const inputClassName = [
      INPUT_CLASS,
      showFilledValue
        ? 'border-teal-300 bg-teal-50 text-teal-900 focus:border-teal-500 focus:ring-teal-500/20'
        : '',
      showClearButton ? 'pr-10' : 'pr-3',
    ]
      .filter(Boolean)
      .join(' ');

    const handleClear = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setQuery('');
      close();
      if (selected?.id != null) {
        onRemover?.(selected.id);
      }
    };

    const handleFocus = () => {
      setOpen(true);
      if (hasSelection && displayNome && !query) {
        setQuery('');
      }
    };

    return (
      <SearchDropdownShell open={open} onRequestClose={close} dropdown={dropdown}>
        <Search
          className={`pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 ${showFilledValue ? 'text-teal-500' : 'text-gray-400'}`}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label={
            showFilledValue ? `Procedimento selecionado: ${displayNome}` : 'Buscar procedimento'
          }
          value={inputValue}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar procedimento..."
          className={inputClassName}
          autoComplete="off"
        />
        {showClearButton ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1 text-teal-600 hover:bg-teal-100 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label="Remover procedimento selecionado"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </SearchDropdownShell>
    );
  }

  return (
    <div>
      <SearchDropdownShell open={open} onRequestClose={close} dropdown={dropdown}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Buscar procedimento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar procedimento..."
          className={INPUT_CLASS}
          autoComplete="off"
        />
      </SearchDropdownShell>

      {!isSingle && procedimentosSelecionados.length > 0 ? (
        <div className="mt-2.5">
          {selectedVariant === 'chips' ? (
            <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Procedimentos selecionados">
              {procedimentosSelecionados.map((proc) => {
                const isPlano = Boolean(proc.planejamentoItemId) || proc.isAvulso === false;
                return (
                  <span
                    key={proc.id}
                    role="listitem"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-semibold text-teal-900 shadow-2xs transition-all"
                  >
                    <span className="truncate max-w-[240px]">{proc.nome}</span>
                    {isPlano ? (
                      <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200/80">
                        Plano
                      </span>
                    ) : proc.isAvulso ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                        Avulso
                      </span>
                    ) : null}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemover?.(proc.id);
                        }}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-teal-600 hover:bg-teal-200/60 hover:text-teal-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 cursor-pointer"
                        aria-label={`Remover ${proc.nome}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <ProcedimentosMultiSeletor
              procedimentos={procedimentosSelecionados}
              onRemover={onRemover}
              showAdicionar={false}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
