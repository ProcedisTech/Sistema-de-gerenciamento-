import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { gerarCorAvatar, iniciaisDoNome } from '../../utils/gerarCorAvatar.js';
import { SearchDropdownShell } from './SearchDropdownShell.jsx';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20';

function Avatar({ prof, size = 'h-7 w-7', text = 'text-[10px]' }) {
  if (prof?.fotoUrl) {
    return (
      <img
        src={prof.fotoUrl}
        alt={prof.nome}
        className={`${size} shrink-0 rounded-full object-cover`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  const cor = gerarCorAvatar(prof?.nome);
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center rounded-full ${text} font-bold ${cor.bg} ${cor.fg}`}>
      {iniciaisDoNome(prof?.nome)}
    </div>
  );
}

/**
 * Seleção inline (único) de profissional — espelha o padrão do paciente.
 * Busca local na `equipeList`; ao escolher, vira card (avatar+nome+cargo) + X.
 * Seta o profissional via `onSelecionar(roleUserId)` / limpa via `onClear`.
 */
export function ProfissionalSearchInput({
  roleUserIdAgenda,
  equipeList,
  equipeLoading = false,
  equipeError = '',
  onSelecionar,
  onClear,
  locked = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const selected = (equipeList || []).find(
    (p) => String(p.roleUserId) === String(roleUserIdAgenda || '')
  );

  const close = useCallback(() => setOpen(false), []);

  // Ao entrar em modo busca, foca o input.
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  if (locked) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" aria-hidden />
        <div className={`${INPUT_CLASS} bg-gray-50 pr-3`}>{selected?.nome || '—'}</div>
      </div>
    );
  }

  const termo = query.trim().toLowerCase();
  const lista = (equipeList || []).filter(
    (p) =>
      !termo ||
      p.nome.toLowerCase().includes(termo) ||
      (p.roleNome || '').toLowerCase().includes(termo) ||
      (p.especialidade || '').toLowerCase().includes(termo)
  );

  const handleSelect = (prof) => {
    onSelecionar?.(String(prof.roleUserId));
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    setOpen(false);
    if (typeof onClear === 'function') onClear();
    else onSelecionar?.('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      close();
      e.preventDefault();
    }
  };

  const hasSelection = Boolean(selected);
  const isSearching = open || query.length > 0;
  const showCard = hasSelection && !isSearching;

  const cargoSelected = selected ? selected.roleNome || selected.especialidade : '';

  const dropdown = open ? (
    <ul role="listbox" aria-label="Profissionais" className="py-1">
      {equipeLoading ? (
        <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">Carregando…</li>
      ) : equipeError ? (
        <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">Falha ao carregar profissionais.</li>
      ) : lista.length > 0 ? (
        lista.map((prof) => {
          const cargo = prof.roleNome || prof.especialidade;
          const isSel = String(prof.roleUserId) === String(roleUserIdAgenda || '');
          return (
            <li key={prof.roleUserId} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSel}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(prof)}
                className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-0 ${
                  isSel ? 'bg-teal-50' : 'hover:bg-gray-50'
                }`}
              >
                <Avatar prof={prof} size="h-10 w-10" text="text-[13px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-gray-900">{prof.nome}</p>
                  {cargo ? (
                    <p className="truncate text-[12px] font-medium text-gray-500">{cargo}</p>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })
      ) : (
        <li className="px-3 py-2.5 text-[12px] font-medium text-gray-500">Nenhum profissional encontrado</li>
      )}
    </ul>
  ) : null;

  return (
    <SearchDropdownShell open={open} onRequestClose={close} dropdown={dropdown}>
      {showCard ? (
        <div className="flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 py-1.5 pl-2.5 pr-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none"
            aria-label={`Profissional selecionado: ${selected.nome}. Trocar.`}
          >
            <Avatar prof={selected} size="h-8 w-8" text="text-[11px]" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-teal-900">{selected.nome}</p>
              {cargoSelected ? (
                <p className="truncate text-[11px] font-medium text-teal-700/80">{cargoSelected}</p>
              ) : null}
            </div>
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-md p-1 text-teal-600 hover:bg-teal-100 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            aria-label="Remover profissional selecionado"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
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
            aria-label="Buscar profissional"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Buscar profissional..."
            className={`${INPUT_CLASS} pr-3`}
            autoComplete="off"
          />
        </>
      )}
    </SearchDropdownShell>
  );
}
